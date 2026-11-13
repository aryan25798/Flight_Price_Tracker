-- ============================================================================
-- 008_fix_service_role_stats_check.sql
-- Fixes get_admin_dashboard_stats() permission check to support both:
-- 1. Authenticated super_admin user sessions via public.is_super_admin()
-- 2. Modern Supabase service_role keys (auth.role() = 'service_role' / current_user)
-- ============================================================================

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
       AND COALESCE(auth.role(), '') <> 'service_role'
       AND COALESCE(current_setting('request.jwt.claim.role', TRUE), '') <> 'service_role'
       AND COALESCE(current_setting('role', TRUE), '') <> 'service_role'
       AND COALESCE(current_user, '') NOT IN ('service_role', 'postgres') THEN
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

GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated, service_role;
