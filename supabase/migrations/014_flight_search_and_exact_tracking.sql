-- ============================================================================
-- Migration 014: Flight Search Sessions & Exact Flight Itinerary Tracking
--
-- 1. Adds exact flight tracking columns to public.tracked_flights:
--    - tracking_mode ('route' vs 'exact_flight')
--    - flight_number, airline_code, airline_name
--    - departure_time, arrival_time (local strings)
--    - itinerary_fingerprint (deterministic segment hash)
--    - booking_url, initial_price, price_status, flight_details (JSONB)
--
-- 2. Updates unique constraint to allow tracking specific flights on the same route.
--
-- 3. Creates public.flight_search_sessions table with RLS for server-side
--    pagination, caching, and deduplication.
--
-- 4. Overloads create_tracked_flight RPC with backward-compatible defaults.
-- ============================================================================

-- 1. Add exact flight tracking columns to tracked_flights
ALTER TABLE public.tracked_flights
    ADD COLUMN IF NOT EXISTS tracking_mode TEXT NOT NULL DEFAULT 'route'
        CHECK (tracking_mode IN ('route', 'exact_flight')),
    ADD COLUMN IF NOT EXISTS flight_number TEXT NULL,
    ADD COLUMN IF NOT EXISTS airline_code TEXT NULL,
    ADD COLUMN IF NOT EXISTS airline_name TEXT NULL,
    ADD COLUMN IF NOT EXISTS departure_time TEXT NULL,
    ADD COLUMN IF NOT EXISTS arrival_time TEXT NULL,
    ADD COLUMN IF NOT EXISTS itinerary_fingerprint TEXT NULL,
    ADD COLUMN IF NOT EXISTS booking_url TEXT NULL,
    ADD COLUMN IF NOT EXISTS initial_price NUMERIC(12,2) NULL,
    ADD COLUMN IF NOT EXISTS price_status TEXT NOT NULL DEFAULT 'CACHED_PRICE'
        CHECK (price_status IN ('LIVE_SEARCH_PRICE', 'REVALIDATED_PRICE', 'INDICATIVE_PRICE', 'CACHED_PRICE', 'EXPIRED_PRICE', 'UNAVAILABLE', 'UNKNOWN')),
    ADD COLUMN IF NOT EXISTS flight_details JSONB NULL;

-- 2. Adjust uniqueness constraint to support multiple distinct flights on the same route
-- Drop old rigid constraint if present and replace with fingerprint-aware unique index
ALTER TABLE public.tracked_flights
    DROP CONSTRAINT IF EXISTS uq_tracked_flights_user_route;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tracked_flights_user_route_fingerprint
    ON public.tracked_flights (user_id, route_id, COALESCE(itinerary_fingerprint, 'ROUTE_WIDE'));

CREATE INDEX IF NOT EXISTS idx_tracked_flights_fingerprint
    ON public.tracked_flights (itinerary_fingerprint)
    WHERE itinerary_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracked_flights_flight_number
    ON public.tracked_flights (flight_number)
    WHERE flight_number IS NOT NULL;

-- 3. Create flight_search_sessions table
CREATE TABLE IF NOT EXISTS public.flight_search_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    origin VARCHAR(3) NOT NULL CHECK (origin ~ '^[A-Z]{3}$'),
    destination VARCHAR(3) NOT NULL CHECK (destination ~ '^[A-Z]{3}$' AND destination <> origin),
    departure_date DATE NOT NULL,
    return_date DATE NULL,
    trip_type TEXT NOT NULL CHECK (trip_type IN ('one_way', 'round_trip')),
    adults INTEGER NOT NULL DEFAULT 1 CHECK (adults >= 1 AND adults <= 9),
    children INTEGER NOT NULL DEFAULT 0 CHECK (children >= 0 AND children <= 8),
    infants INTEGER NOT NULL DEFAULT 0 CHECK (infants >= 0 AND infants <= adults),
    cabin_class TEXT NOT NULL DEFAULT 'economy'
        CHECK (cabin_class IN ('economy', 'premium_economy', 'business', 'first')),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR'
        CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD')),
    direct_only BOOLEAN NOT NULL DEFAULT FALSE,
    provider TEXT NOT NULL DEFAULT 'travelpayouts',
    total_offers INTEGER NOT NULL DEFAULT 0,
    best_price NUMERIC(12,2) NULL,
    price_status TEXT NOT NULL DEFAULT 'CACHED_PRICE',
    offers JSONB NOT NULL DEFAULT '[]'::jsonb,
    search_metadata JSONB NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for search sessions
CREATE INDEX IF NOT EXISTS idx_search_sessions_user_id
    ON public.flight_search_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_search_sessions_route_date
    ON public.flight_search_sessions (origin, destination, departure_date, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_sessions_expires_at
    ON public.flight_search_sessions (expires_at);

-- RLS for flight_search_sessions
ALTER TABLE public.flight_search_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access their own search sessions or public sessions" ON public.flight_search_sessions;
CREATE POLICY "Users can access their own search sessions or public sessions"
    ON public.flight_search_sessions
    FOR SELECT
    TO authenticated, anon
    USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create search sessions" ON public.flight_search_sessions;
CREATE POLICY "Users can create search sessions"
    ON public.flight_search_sessions
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access on flight_search_sessions" ON public.flight_search_sessions;
CREATE POLICY "Service role full access on flight_search_sessions"
    ON public.flight_search_sessions
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

-- 4. Overload create_tracked_flight to support exact flight parameters
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
    p_provider TEXT DEFAULT 'travelpayouts',
    p_flight_number TEXT DEFAULT NULL,
    p_airline_code TEXT DEFAULT NULL,
    p_airline_name TEXT DEFAULT NULL,
    p_departure_time TEXT DEFAULT NULL,
    p_arrival_time TEXT DEFAULT NULL,
    p_itinerary_fingerprint TEXT DEFAULT NULL,
    p_booking_url TEXT DEFAULT NULL,
    p_tracking_mode TEXT DEFAULT 'route',
    p_flight_details JSONB DEFAULT NULL
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

    -- Insert user-specific tracker with exact flight metadata if provided
    INSERT INTO public.tracked_flights (
        user_id, route_id, origin, destination, departure_date, return_date,
        trip_type, adults, children, infants, cabin_class, currency, target_price,
        is_active, tracking_mode, flight_number, airline_code, airline_name,
        departure_time, arrival_time, itinerary_fingerprint, booking_url,
        flight_details
    )
    VALUES (
        v_user_id, v_route_id, v_origin, v_destination, p_departure_date, p_return_date,
        p_trip_type, p_adults, p_children, p_infants, p_cabin_class, v_currency, p_target_price,
        TRUE, COALESCE(p_tracking_mode, 'route'), p_flight_number, p_airline_code, p_airline_name,
        p_departure_time, p_arrival_time, p_itinerary_fingerprint, p_booking_url,
        p_flight_details
    )
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tracked_flight(
    VARCHAR(3), VARCHAR(3), DATE, DATE, TEXT, INTEGER, INTEGER, INTEGER, TEXT,
    VARCHAR(3), NUMERIC(12,2), TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated;
