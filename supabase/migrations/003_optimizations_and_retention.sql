-- ============================================================================
-- 003_optimizations_and_retention.sql
-- Optimizes get_admin_dashboard_stats() to single-pass filtered aggregation (DB-01)
-- Adds partial indexes for status filters
-- Schedules daily direct database housekeeping in pg_cron (SCALE-02)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. TARGETED PERFORMANCE INDEXES (DB-01 & SCALE-02)
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tracked_flights_is_active
    ON public.tracked_flights (is_active);

CREATE INDEX IF NOT EXISTS idx_notification_logs_status_sent
    ON public.notification_logs (delivery_status)
    WHERE delivery_status = 'sent';

CREATE INDEX IF NOT EXISTS idx_notification_logs_status_failed
    ON public.notification_logs (delivery_status)
    WHERE delivery_status = 'failed';

CREATE INDEX IF NOT EXISTS idx_price_history_checked_at_desc
    ON public.price_history (checked_at DESC);

-- Adjust default retention to 30 days to strictly fit free-tier 500MB storage
UPDATE public.system_settings
SET value = '30'::jsonb,
    description = 'Days to retain historical price observations (optimized for 500MB free-tier storage).'
WHERE key = 'price_history_retention_days';

-- ----------------------------------------------------------------------------
-- 2. SINGLE-PASS FILTERED AGGREGATION FOR ADMIN DASHBOARD STATS (DB-01)
-- Replaces 11 independent table scans with 4 single-pass scans using FILTER
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_users BIGINT := 0;
    v_active_users BIGINT := 0;
    v_banned_users BIGINT := 0;
    v_total_trackers BIGINT := 0;
    v_active_trackers BIGINT := 0;
    v_unique_routes BIGINT := 0;
    v_successful_alerts BIGINT := 0;
    v_failed_notifications BIGINT := 0;
    v_total_api_requests BIGINT := 0;
    v_total_failures BIGINT := 0;
    v_last_successful TIMESTAMPTZ := NULL;
BEGIN
    IF NOT public.is_super_admin()
       AND COALESCE(current_setting('request.jwt.claim.role', TRUE), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Forbidden: super_admin required' USING ERRCODE = '42501';
    END IF;

    -- Single pass over profiles
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE is_banned = FALSE),
        COUNT(*) FILTER (WHERE is_banned = TRUE)
    INTO v_total_users, v_active_users, v_banned_users
    FROM public.profiles;

    -- Single pass over tracked_flights
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE is_active = TRUE)
    INTO v_total_trackers, v_active_trackers
    FROM public.tracked_flights;

    -- Monitored routes count
    SELECT COUNT(*)
    INTO v_unique_routes
    FROM public.monitored_routes
    WHERE status = 'active';

    -- Single pass over notification_logs
    SELECT
        COUNT(*) FILTER (WHERE delivery_status = 'sent'),
        COUNT(*) FILTER (WHERE delivery_status = 'failed')
    INTO v_successful_alerts, v_failed_notifications
    FROM public.notification_logs;

    -- Single pass over polling_runs
    SELECT
        COALESCE(SUM(routes_succeeded + routes_failed), 0),
        COALESCE(SUM(routes_failed), 0),
        MAX(finished_at) FILTER (WHERE status = 'completed')
    INTO v_total_api_requests, v_total_failures, v_last_successful
    FROM public.polling_runs;

    RETURN jsonb_build_object(
        'total_users', v_total_users,
        'active_users', v_active_users,
        'banned_users', v_banned_users,
        'total_trackers', v_total_trackers,
        'active_trackers', v_active_trackers,
        'unique_monitored_routes', v_unique_routes,
        'successful_alerts', v_successful_alerts,
        'failed_notifications', v_failed_notifications,
        'total_api_requests', v_total_api_requests,
        'total_provider_failures', v_total_failures,
        'last_successful_poll', v_last_successful
    );
END;
$$;

COMMIT;

-- ----------------------------------------------------------------------------
-- 3. SCHEDULE DAILY CRON HOUSEKEEPING (SCALE-02)
-- Direct PostgreSQL cleanup at 03:00 UTC daily
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
        PERFORM cron.unschedule('daily-housekeeping-cleanup')
        WHERE EXISTS (
            SELECT 1 FROM cron.job WHERE jobname = 'daily-housekeeping-cleanup'
        );

        PERFORM cron.schedule(
            'daily-housekeeping-cleanup',
            '0 3 * * *',
            $cron$SELECT public.cleanup_expired_data();$cron$
        );
    END IF;
END;
$$;
