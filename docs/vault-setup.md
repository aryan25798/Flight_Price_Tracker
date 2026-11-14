# Supabase Vault & Automated pg_cron Setup Guide

This guide details how to configure Supabase Vault to enable autonomous background flight fare polling every 4 hours via `pg_cron` and `pg_net`.

---

## 1. Prerequisites

AeroDrop's automated radar (`002_cron_setup.sql`) runs a PostgreSQL scheduled job every 4 hours:
```sql
SELECT cron.schedule('check-flight-prices-4h', '0 */4 * * *', 'SELECT public.invoke_flight_check();');
```
Inside `invoke_flight_check()`, `pg_net` issues an HTTP POST to:
```text
https://<PROJECT_REF>.supabase.co/functions/v1/check-flight-prices
```
with header:
```text
Authorization: Bearer <CRON_SECRET>
```

---

## 2. Vault Configuration Steps

To prevent storing credentials in plaintext SQL or database logs, Supabase Vault encrypts these two values at rest using AES-GCM.

### Option A: Run SQL in Supabase SQL Editor (Recommended)

Execute the idempotent helper in **Supabase Dashboard → SQL Editor**:

```sql
-- 1. Set your Supabase Project URL
SELECT public.upsert_vault_secret(
    'https://vchicigycuwzkbxsgykp.supabase.co', 
    'project_url', 
    'AeroDrop Supabase Project Base URL'
);

-- 2. Set your Edge Function CRON_SECRET token
SELECT public.upsert_vault_secret(
    'ac6b18b5fedb2df9452564b4492b328fd0aa772a868f43991e57e82fd3f4d0ba', 
    'cron_secret', 
    'Edge Function CRON_SECRET authentication token'
);
```

### Option B: Verify Secrets in Vault

To confirm secrets are stored and decrypted properly:

```sql
SELECT id, name, description, decrypted_secret 
FROM vault.decrypted_secrets 
WHERE name IN ('project_url', 'cron_secret');
```

---

## 3. Manual Test of Autonomous Radar

To trigger an immediate test poll without waiting 4 hours:

```sql
SELECT public.invoke_flight_check();
```

Inspect the result in the `cron.job_run_details` table:

```sql
SELECT jobid, runid, job_pid, status, return_message, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 5;
```
