-- ============================================================================
-- 004_rls_initplan_and_security_hardening.sql
-- Optimizes RLS policies to use (SELECT auth.uid()) to avoid per-row re-evaluation
-- Consolidates multiple permissive UPDATE policies on profiles
-- Fixes search_path on public helper functions
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. FIX FUNCTION SEARCH_PATH
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_tracker_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.departure_date IS DISTINCT FROM OLD.departure_date) THEN
        IF NEW.departure_date < CURRENT_DATE THEN
            RAISE EXCEPTION 'Departure date cannot be in the past'
                USING ERRCODE = '22023';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_route_key(
    p_provider TEXT,
    p_origin VARCHAR(3),
    p_destination VARCHAR(3),
    p_departure_date DATE,
    p_return_date DATE,
    p_trip_type TEXT,
    p_adults INTEGER,
    p_children INTEGER,
    p_infants INTEGER,
    p_cabin_class TEXT,
    p_currency VARCHAR(3)
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT encode(
        sha256(
            convert_to(
                jsonb_build_object(
                    'adults', p_adults,
                    'cabin_class', LOWER(TRIM(p_cabin_class)),
                    'children', p_children,
                    'currency', UPPER(TRIM(p_currency)),
                    'departure_date', TO_CHAR(p_departure_date, 'YYYY-MM-DD'),
                    'destination', UPPER(TRIM(p_destination)),
                    'infants', p_infants,
                    'origin', UPPER(TRIM(p_origin)),
                    'provider', LOWER(TRIM(p_provider)),
                    'return_date', CASE WHEN p_return_date IS NULL THEN NULL ELSE TO_CHAR(p_return_date, 'YYYY-MM-DD') END,
                    'trip_type', LOWER(TRIM(p_trip_type))
                )::text,
                'UTF8'
            )
        ),
        'hex'
    );
$$;

-- ----------------------------------------------------------------------------
-- 2. OPTIMIZE PROFILES RLS (InitPlan & Single Permissive Policy)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = (SELECT auth.uid()) OR public.is_super_admin());

DROP POLICY IF EXISTS "Users can update own non-privileged profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can update any profile" ON public.profiles;
CREATE POLICY "Allow update own profile or super admin"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (
        (id = (SELECT auth.uid()) AND is_banned = FALSE)
        OR public.is_super_admin()
    )
    WITH CHECK (
        (id = (SELECT auth.uid()) AND is_banned = FALSE)
        OR public.is_super_admin()
    );

-- ----------------------------------------------------------------------------
-- 3. OPTIMIZE MONITORED ROUTES RLS
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view monitored routes they track" ON public.monitored_routes;
CREATE POLICY "Users can view monitored routes they track"
    ON public.monitored_routes FOR SELECT
    TO authenticated
    USING (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.tracked_flights tf
            WHERE tf.route_id = monitored_routes.id
              AND tf.user_id = (SELECT auth.uid())
        )
    );

-- ----------------------------------------------------------------------------
-- 4. OPTIMIZE TRACKED FLIGHTS RLS
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own trackers or super_admin all" ON public.tracked_flights;
CREATE POLICY "Users can view own trackers or super_admin all"
    ON public.tracked_flights FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_super_admin());

DROP POLICY IF EXISTS "Active users can create own trackers" ON public.tracked_flights;
CREATE POLICY "Active users can create own trackers"
    ON public.tracked_flights FOR INSERT
    TO authenticated
    WITH CHECK (
        (user_id = (SELECT auth.uid()) AND public.is_active_user())
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS "Active users can update own trackers or super_admin all" ON public.tracked_flights;
CREATE POLICY "Active users can update own trackers or super_admin all"
    ON public.tracked_flights FOR UPDATE
    TO authenticated
    USING (
        (user_id = (SELECT auth.uid()) AND public.is_active_user())
        OR public.is_super_admin()
    )
    WITH CHECK (
        (user_id = (SELECT auth.uid()) AND public.is_active_user())
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS "Active users can delete own trackers or super_admin all" ON public.tracked_flights;
CREATE POLICY "Active users can delete own trackers or super_admin all"
    ON public.tracked_flights FOR DELETE
    TO authenticated
    USING (
        (user_id = (SELECT auth.uid()) AND public.is_active_user())
        OR public.is_super_admin()
    );

-- ----------------------------------------------------------------------------
-- 5. OPTIMIZE PRICE HISTORY RLS
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view price history for tracked routes" ON public.price_history;
CREATE POLICY "Users can view price history for tracked routes"
    ON public.price_history FOR SELECT
    TO authenticated
    USING (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.tracked_flights tf
            WHERE tf.route_id = price_history.route_id
              AND tf.user_id = (SELECT auth.uid())
        )
    );

-- ----------------------------------------------------------------------------
-- 6. OPTIMIZE NOTIFICATION LOGS RLS
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own notification logs" ON public.notification_logs;
CREATE POLICY "Users can view own notification logs"
    ON public.notification_logs FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_super_admin());

COMMIT;
