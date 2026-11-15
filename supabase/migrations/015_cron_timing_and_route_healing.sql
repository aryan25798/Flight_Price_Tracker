-- ============================================================================
-- 015_cron_timing_and_route_healing.sql
-- 1. Auto-heals monitored_routes that have active user subscriptions
-- 2. Enhances claim_due_routes with 30-minute jitter tolerance and stale fallback
--    to prevent 4-hour cron skips
-- ============================================================================

-- 1. Immediately reactivate any failed routes that have active subscriber trackers
UPDATE public.monitored_routes
SET status = 'active',
    failure_count = 0,
    next_check_at = NOW(),
    updated_at = NOW()
WHERE id IN (
    SELECT DISTINCT route_id
    FROM public.tracked_flights
    WHERE is_active = true
)
AND status != 'active';

-- 2. Enhanced claim_due_routes function with auto-healing and 30-minute jitter tolerance
CREATE OR REPLACE FUNCTION public.claim_due_routes(p_limit INT DEFAULT 50)
RETURNS SETOF public.monitored_routes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Auto-heal any routes that active users are monitoring
    UPDATE public.monitored_routes
    SET status = 'active',
        failure_count = 0,
        updated_at = NOW()
    WHERE status = 'failed'
      AND id IN (
        SELECT DISTINCT route_id
        FROM public.tracked_flights
        WHERE is_active = true
      );

    RETURN QUERY
    WITH due_routes AS (
        SELECT id
        FROM public.monitored_routes
        WHERE status = 'active'
          AND departure_date >= CURRENT_DATE
          AND (
            next_check_at IS NULL
            OR next_check_at <= (NOW() + INTERVAL '30 minutes')
            OR last_checked_at IS NULL
            OR last_checked_at <= (NOW() - INTERVAL '3 hours 30 minutes')
          )
        ORDER BY next_check_at ASC NULLS FIRST
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.monitored_routes mr
    SET next_check_at = NOW() + INTERVAL '15 minutes',
        updated_at = NOW()
    FROM due_routes dr
    WHERE mr.id = dr.id
    RETURNING mr.*;
END;
$$;

COMMENT ON FUNCTION public.claim_due_routes(INT) IS
'Claims due active routes for background price polling with automatic healing for routes with active subscribers and 30-minute jitter tolerance.';
