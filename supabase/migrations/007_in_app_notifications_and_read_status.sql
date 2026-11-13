-- ============================================================================
-- 007_in_app_notifications_and_read_status.sql
-- 1. Adds in-app read tracking (is_read, read_at) to notification_logs
-- 2. Grants UPDATE policy for users to mark notifications as read
-- 3. Implements atomic stored procedure mark_all_notifications_read()
-- ============================================================================

-- 1. Add read status columns to notification_logs
ALTER TABLE public.notification_logs
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ NULL;

-- 2. Index for instant unread count and paginated user notification retrieval
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_read
    ON public.notification_logs (user_id, is_read, created_at DESC);

-- 3. Allow users to update is_read and read_at on their own notification records
DROP POLICY IF EXISTS "Users can update own notification logs read status" ON public.notification_logs;
CREATE POLICY "Users can update own notification logs read status"
    ON public.notification_logs FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- 4. Fast atomic function to mark all unread notifications as read for current user
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE public.notification_logs
    SET is_read = TRUE,
        read_at = NOW()
    WHERE user_id = auth.uid()
      AND is_read = FALSE;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
