-- ============================================================================
-- 009_user_tiers_and_custom_quotas.sql
-- AeroDrop 2.0 User Tier & Admin Quota Architecture
-- 1. Adds tier, custom_tracker_limit, and tier_notes to public.profiles
-- 2. Updates create_tracked_flight to enforce tier/custom tracker limits
-- 3. Exposes get_user_quota() for instant frontend capacity display
-- ============================================================================

BEGIN;

-- 1. Add Tier and Custom Limit columns to profiles
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
        CHECK (tier IN ('free', 'pro', 'enterprise')),
    ADD COLUMN IF NOT EXISTS custom_tracker_limit INTEGER NULL
        CHECK (custom_tracker_limit IS NULL OR custom_tracker_limit >= -1),
    ADD COLUMN IF NOT EXISTS tier_notes TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles (tier);

-- Update existing super_admin users to enterprise (unlimited)
UPDATE public.profiles
SET tier = 'enterprise',
    custom_tracker_limit = -1
WHERE role = 'super_admin';

-- 2. Helper function to compute user quota
CREATE OR REPLACE FUNCTION public.get_user_quota(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier TEXT;
    v_custom_limit INTEGER;
    v_effective_limit INTEGER;
    v_current_count INTEGER;
BEGIN
    SELECT tier, custom_tracker_limit
    INTO v_tier, v_custom_limit
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_tier IS NULL THEN
        v_tier := 'free';
    END IF;

    -- Determine effective limit: custom override takes precedence, then tier defaults
    IF v_custom_limit IS NOT NULL THEN
        v_effective_limit := v_custom_limit;
    ELSIF v_tier = 'enterprise' THEN
        v_effective_limit := -1; -- Unlimited
    ELSIF v_tier = 'pro' THEN
        v_effective_limit := 25;
    ELSE
        v_effective_limit := 3;  -- Free tier default
    END IF;

    SELECT COUNT(*) INTO v_current_count
    FROM public.tracked_flights
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'tier', v_tier,
        'effective_limit', v_effective_limit,
        'current_count', v_current_count,
        'is_unlimited', (v_effective_limit = -1),
        'remaining', CASE WHEN v_effective_limit = -1 THEN 999999 ELSE GREATEST(0, v_effective_limit - v_current_count) END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_quota(UUID) TO authenticated;

-- 3. Update create_tracked_flight RPC to enforce user tier quotas
CREATE OR REPLACE FUNCTION public.create_tracked_flight(
    p_origin VARCHAR(3),
    p_destination VARCHAR(3),
    p_departure_date DATE,
    p_return_date DATE,
    p_trip_type TEXT,
    p_adults INTEGER,
    p_children INTEGER,
    p_infants INTEGER,
    p_cabin_class TEXT,
    p_currency VARCHAR(3),
    p_target_price NUMERIC(12,2),
    p_provider TEXT DEFAULT 'travelpayouts'
)
RETURNS public.tracked_flights
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_is_banned BOOLEAN;
    v_maintenance BOOLEAN;
    v_tier TEXT;
    v_custom_limit INTEGER;
    v_max_trackers INTEGER;
    v_current_count INTEGER;
    v_origin VARCHAR(3);
    v_destination VARCHAR(3);
    v_currency VARCHAR(3);
    v_route_key TEXT;
    v_route_id UUID;
    v_search_params JSONB;
    v_result public.tracked_flights;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT is_banned, tier, custom_tracker_limit
    INTO v_is_banned, v_tier, v_custom_limit
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_is_banned IS TRUE THEN
        RAISE EXCEPTION 'Account is suspended by administrator' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE((value)::boolean, FALSE) INTO v_maintenance
    FROM public.system_settings WHERE key = 'maintenance_mode';

    IF v_maintenance IS TRUE THEN
        RAISE EXCEPTION 'System is currently in maintenance mode' USING ERRCODE = '55000';
    END IF;

    -- Calculate user-specific quota limit
    IF v_custom_limit IS NOT NULL THEN
        v_max_trackers := v_custom_limit;
    ELSIF v_tier = 'enterprise' THEN
        v_max_trackers := -1; -- Unlimited
    ELSIF v_tier = 'pro' THEN
        v_max_trackers := 25;
    ELSE
        v_max_trackers := 3;  -- Free plan: 3 trackers
    END IF;

    -- If not unlimited, enforce quota
    IF v_max_trackers <> -1 THEN
        SELECT COUNT(*) INTO v_current_count
        FROM public.tracked_flights
        WHERE user_id = v_user_id;

        IF v_current_count >= v_max_trackers THEN
            RAISE EXCEPTION 'Tracker limit reached (%/% for % tier). Contact an administrator to upgrade your plan or request higher limits.',
                v_current_count, v_max_trackers, UPPER(COALESCE(v_tier, 'FREE'))
                USING ERRCODE = '54000';
        END IF;
    END IF;

    v_origin := UPPER(TRIM(p_origin));
    v_destination := UPPER(TRIM(p_destination));
    v_currency := UPPER(TRIM(p_currency));

    v_route_key := public.compute_route_key(
        p_provider, v_origin, v_destination, p_departure_date, p_return_date,
        p_trip_type, p_adults, p_children, p_infants, p_cabin_class, v_currency
    );

    v_search_params := jsonb_build_object(
        'origin', v_origin,
        'destination', v_destination,
        'departure_date', TO_CHAR(p_departure_date, 'YYYY-MM-DD'),
        'return_date', CASE WHEN p_return_date IS NULL THEN NULL ELSE TO_CHAR(p_return_date, 'YYYY-MM-DD') END,
        'trip_type', p_trip_type,
        'adults', p_adults,
        'children', p_children,
        'infants', p_infants,
        'cabin_class', p_cabin_class,
        'currency', v_currency
    );

    -- Find or atomically insert the shared monitored route
    INSERT INTO public.monitored_routes (
        route_key, search_parameters, origin, destination,
        departure_date, return_date, provider, status, next_check_at
    )
    VALUES (
        v_route_key, v_search_params, v_origin, v_destination,
        p_departure_date, p_return_date, p_provider, 'active', NOW()
    )
    ON CONFLICT (route_key) DO UPDATE
        SET status = CASE
            WHEN public.monitored_routes.status IN ('paused', 'failed') THEN 'active'
            ELSE public.monitored_routes.status
        END,
        updated_at = NOW()
    RETURNING id INTO v_route_id;

    -- Insert user-specific tracker
    INSERT INTO public.tracked_flights (
        user_id, route_id, origin, destination, departure_date, return_date,
        trip_type, adults, children, infants, cabin_class, currency, target_price, is_active
    )
    VALUES (
        v_user_id, v_route_id, v_origin, v_destination, p_departure_date, p_return_date,
        p_trip_type, p_adults, p_children, p_infants, p_cabin_class, v_currency, p_target_price, TRUE
    )
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

COMMIT;
