-- ============================================================================
-- 006_status_update_and_timing_fix.sql
-- 1. Expands notification_type check constraint to include 'status_update'
-- 2. Enhances claim_due_routes with 5-minute jitter buffer to eliminate 4-hour skips
-- ============================================================================

-- 1. Allow 'status_update' in notification_logs
ALTER TABLE public.notification_logs
    DROP CONSTRAINT IF EXISTS notification_logs_notification_type_check,
    ADD CONSTRAINT notification_logs_notification_type_check
    CHECK (notification_type IN ('price_drop', 'status_update', 'test', 'system'));

-- 2. Enhanced claim_due_routes with jitter tolerance buffer
CREATE OR REPLACE FUNCTION public.claim_due_routes(p_limit INT DEFAULT 50)
RETURNS SETOF public.monitored_routes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH due_routes AS (
        SELECT id
        FROM public.monitored_routes
        WHERE status = 'active'
          AND departure_date >= CURRENT_DATE
          AND (next_check_at IS NULL OR next_check_at <= (NOW() + INTERVAL '5 minutes'))
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
