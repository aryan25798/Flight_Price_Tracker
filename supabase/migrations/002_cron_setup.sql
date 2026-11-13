-- ============================================================================
-- 002_cron_setup.sql
-- Configures pg_cron + pg_net + Supabase Vault to invoke check-flight-prices
-- every 4 hours without hardcoding secrets in SQL.
--
-- PREREQUISITES (run once in Supabase SQL Editor or Vault UI before enabling):
--   SELECT vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
--   SELECT vault.create_secret('<STRONG_RANDOM_CRON_SECRET>', 'cron_secret');
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_flight_price_poll()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net
AS $$
DECLARE
    v_project_url TEXT;
    v_cron_secret TEXT;
    v_request_id BIGINT;
BEGIN
    SELECT decrypted_secret INTO v_project_url
    FROM vault.decrypted_secrets
    WHERE name = 'project_url'
    LIMIT 1;

    SELECT decrypted_secret INTO v_cron_secret
    FROM vault.decrypted_secrets
    WHERE name = 'cron_secret'
    LIMIT 1;

    IF v_project_url IS NULL OR v_cron_secret IS NULL THEN
        RAISE WARNING 'Vault secrets project_url or cron_secret are not configured; skipping poll.';
        RETURN NULL;
    END IF;

    SELECT net.http_post(
        url := v_project_url || '/functions/v1/check-flight-prices',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', v_cron_secret
        ),
        body := jsonb_build_object('source', 'pg_cron', 'triggered_at', NOW())
    ) INTO v_request_id;

    RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trigger_flight_price_poll() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_flight_price_poll() TO service_role;

-- Schedule job every 4 hours at minute 0 (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
        PERFORM cron.unschedule('poll-flight-prices-4h')
        WHERE EXISTS (
            SELECT 1 FROM cron.job WHERE jobname = 'poll-flight-prices-4h'
        );

        PERFORM cron.schedule(
            'poll-flight-prices-4h',
            '0 */4 * * *',
            $cron$SELECT public.trigger_flight_price_poll();$cron$
        );
    END IF;
END;
$$;
