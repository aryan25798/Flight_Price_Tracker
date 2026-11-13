# AeroDrop — Automated Flight Price Drop Tracker

A production-grade SaaS application for monitoring flight fares across global IATA routes, visualizing historical price trends, and receiving instant Telegram alerts when fares drop below your target price — complete with a Superuser Admin Console.

---

## Architecture & Tech Stack

- **Frontend:** Next.js 15 (App Router), TypeScript (strict), Tailwind CSS v4, Lucide Icons, Recharts, React Hook Form, Zod, `next-themes`, Sonner
- **Backend & Database:** Supabase PostgreSQL, Supabase Auth (`@supabase/ssr`), Row Level Security (RLS), `pg_cron`, `pg_net`, Supabase Vault
- **Background Workers & Admin API:** Supabase Edge Functions (Deno/TypeScript):
  - `check-flight-prices` — 4-hour scheduled polling with PostgreSQL advisory lock, `FOR UPDATE SKIP LOCKED` route claiming, bounded concurrency, 12-hour cooldown + 5% price-drop exception, and idempotent `notification_logs`
  - `admin-actions` — JWT + `super_admin` verified backend for user management, global tracker CRUD, audit logs, and system settings
  - `telegram-link` — Generates single-use 15-minute SHA-256-hashed deep links and sends test notifications
  - `telegram-webhook` — Verifies `X-Telegram-Bot-Api-Secret-Token` and atomically links `telegram_chat_id`
- **Flight Data Provider:** Modular `FlightProvider` adapter ([travelpayouts.ts](supabase/functions/_shared/flight-provider/travelpayouts.ts)) using Travelpayouts / Aviasales Data API v3 (`/aviasales/v3/prices_for_dates`)

---

## Local Development

1. Copy `.env.example` to `.env.local` and fill in your Supabase & Telegram values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose with `NEXT_PUBLIC_`)
2. Install dependencies and start the dev server:
   ```powershell
   npm install
   npm run dev
   ```
3. Open `http://localhost:3000`.
4. Sign up for an account, then promote your user to `super_admin` in Supabase **SQL Editor**:
   ```sql
   UPDATE public.profiles
   SET role = 'super_admin'
   WHERE email = 'your-email@example.com';
   ```

---

## Verification Commands

```powershell
# TypeScript strict check
npm run typecheck

# Production build
npm run build

# Unit, component & live Edge Function security tests
npm test
```

---

## Deploying to Vercel (Free Tier)

1. Push your repository to GitHub (`.env.local` is ignored by `.gitignore`).
2. Import the repository in [vercel.com](https://vercel.com).
3. Add **only** the Next.js environment variables in **Vercel → Project Settings → Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
   - `SUPABASE_SERVICE_ROLE_KEY` *(Server-only)*
4. Deploy.
5. Copy your production Vercel URL (e.g., `https://aerodrop.vercel.app`) and:
   - Update **Supabase → Authentication → URL Configuration**:
     - **Site URL:** `https://aerodrop.vercel.app`
     - **Redirect URLs:** add `https://aerodrop.vercel.app/auth/callback`
   - Update **Travelpayouts → Profile → Projects** with your live Vercel URL.

---

## Production Launch Checklist

### Security
- [ ] Rotate any secrets that were pasted into chat/dev logs (`CRON_SECRET` in Vault + Edge Function secrets, `TELEGRAM_BOT_TOKEN` via `@BotFather` `/revoke`, `TELEGRAM_WEBHOOK_SECRET`, and Supabase/Travelpayouts keys if needed).
- [ ] Confirm `.env.local` is not tracked in Git (`git status`).
- [ ] Verify `001_rls_verification.sql` passes on production/staging.
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` is never prefixed with `NEXT_PUBLIC_`.

### Database & Cron
- [ ] `pg_cron`, `pg_net`, and `supabase_vault` extensions are enabled.
- [ ] Vault secrets `project_url` and `cron_secret` are populated.
- [ ] `poll-flight-prices-4h` cron job is scheduled (`SELECT * FROM cron.job;`).

### Notifications & Quotas
- [ ] Telegram webhook is registered with `secret_token` (`getWebhookInfo` returns no `last_error_message`).
- [ ] Test notification succeeds from `/dashboard/settings`.
- [ ] `system_settings` quotas (`max_api_calls_per_cycle`, `max_trackers_per_user`, `price_history_retention_days`) are tuned for free-tier limits.

### Free-Tier Limitations & Upgrade Path
- **Supabase Free Tier:** 500 MB DB, 500k Edge Function invocations/month, 2 GB egress, pauses after 7 days of inactivity (no artificial keep-alive pings). Upgrade to Supabase Pro (\$25/mo) for >500 MB history or commercial SLAs.
- **Vercel Hobby Tier:** Non-commercial use, 10s serverless timeout. Upgrade to Vercel Pro (\$20/mo) for commercial SaaS traffic.
- **Travelpayouts Data API v3:** 600 req/min, returns **cached** 1-adult Economy base fares. Swap or add a live-search provider via `services/flight-provider` / `supabase/functions/_shared/flight-provider/registry.ts` if live multi-cabin pricing is needed later.
