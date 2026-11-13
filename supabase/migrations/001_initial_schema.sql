-- ============================================================================
-- 001_initial_schema.sql
-- Automated Flight Price Drop Tracker - Complete PostgreSQL Schema,
-- Functions, Triggers, Locks, Grants, and Row Level Security
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'super_admin')),
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    telegram_chat_id TEXT NULL,
    telegram_link_token_hash TEXT NULL,
    telegram_link_expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_email ON public.profiles (email);
CREATE INDEX idx_profiles_role ON public.profiles (role);
CREATE INDEX idx_profiles_is_banned ON public.profiles (is_banned);
CREATE INDEX idx_profiles_telegram_token_hash
    ON public.profiles (telegram_link_token_hash)
    WHERE telegram_link_token_hash IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. MONITORED ROUTES TABLE (Shared Route Deduplication)
-- ----------------------------------------------------------------------------
CREATE TABLE public.monitored_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_key TEXT UNIQUE NOT NULL,
    search_parameters JSONB NOT NULL,
    origin VARCHAR(3) NOT NULL CHECK (origin ~ '^[A-Z]{3}$'),
    destination VARCHAR(3) NOT NULL CHECK (destination ~ '^[A-Z]{3}$' AND destination <> origin),
    departure_date DATE NOT NULL,
    return_date DATE NULL,
    provider TEXT NOT NULL DEFAULT 'travelpayouts',
    last_checked_at TIMESTAMPTZ NULL,
    next_check_at TIMESTAMPTZ NULL DEFAULT NOW(),
    last_price NUMERIC(12,2) NULL CHECK (last_price IS NULL OR last_price > 0),
    last_airline TEXT NULL,
    last_booking_url TEXT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired', 'failed')),
    failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_monitored_routes_status ON public.monitored_routes (status);
CREATE INDEX idx_monitored_routes_next_check_at ON public.monitored_routes (next_check_at);
CREATE INDEX idx_monitored_routes_departure_date ON public.monitored_routes (departure_date);
CREATE INDEX idx_monitored_routes_active_due
    ON public.monitored_routes (next_check_at ASC NULLS FIRST)
    WHERE status = 'active';

-- ----------------------------------------------------------------------------
-- 3. TRACKED FLIGHTS TABLE (User Subscriptions)
-- ----------------------------------------------------------------------------
CREATE TABLE public.tracked_flights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES public.monitored_routes(id) ON DELETE RESTRICT,
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
    target_price NUMERIC(12,2) NOT NULL CHECK (target_price > 0),
    last_seen_price NUMERIC(12,2) NULL,
    last_notified_price NUMERIC(12,2) NULL,
    last_notified_at TIMESTAMPTZ NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_tracked_flights_passengers CHECK (adults + children + infants <= 9),
    CONSTRAINT chk_tracked_flights_trip_dates CHECK (
        (trip_type = 'one_way' AND return_date IS NULL) OR
        (trip_type = 'round_trip' AND return_date IS NOT NULL AND return_date >= departure_date)
    ),
    CONSTRAINT uq_tracked_flights_user_route UNIQUE (user_id, route_id)
);

CREATE INDEX idx_tracked_flights_user_id ON public.tracked_flights (user_id);
CREATE INDEX idx_tracked_flights_route_id ON public.tracked_flights (route_id);
CREATE INDEX idx_tracked_flights_active_route
    ON public.tracked_flights (route_id, is_active)
    WHERE is_active = TRUE;
CREATE INDEX idx_tracked_flights_departure_date ON public.tracked_flights (departure_date);

-- ----------------------------------------------------------------------------
-- 4. PRICE HISTORY TABLE (Route-Level Observations)
-- ----------------------------------------------------------------------------
CREATE TABLE public.price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES public.monitored_routes(id) ON DELETE CASCADE,
    route_key TEXT NOT NULL,
    price NUMERIC(12,2) NOT NULL CHECK (price > 0),
    currency VARCHAR(3) NOT NULL,
    airline TEXT NULL,
    booking_url TEXT NULL,
    provider TEXT NOT NULL,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_history_route_checked
    ON public.price_history (route_id, checked_at DESC);
CREATE INDEX idx_price_history_checked_at
    ON public.price_history (checked_at);

-- ----------------------------------------------------------------------------
-- 5. NOTIFICATION LOGS TABLE (Idempotent Delivery Audit)
-- ----------------------------------------------------------------------------
CREATE TABLE public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tracker_id UUID NULL REFERENCES public.tracked_flights(id) ON DELETE SET NULL,
    route_id UUID NULL REFERENCES public.monitored_routes(id) ON DELETE SET NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('price_drop', 'test', 'system')),
    previous_price NUMERIC(12,2) NULL,
    current_price NUMERIC(12,2) NULL,
    currency VARCHAR(3) NULL,
    delivery_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (delivery_status IN ('pending', 'sent', 'failed', 'skipped')),
    telegram_message_id TEXT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    error_message TEXT NULL,
    sent_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_logs_user_created
    ON public.notification_logs (user_id, created_at DESC);
CREATE INDEX idx_notification_logs_status
    ON public.notification_logs (delivery_status);
CREATE INDEX idx_notification_logs_tracker_id
    ON public.notification_logs (tracker_id);

-- ----------------------------------------------------------------------------
-- 6. ADMIN AUDIT LOGS TABLE (Immutable Privileged Action Log)
-- ----------------------------------------------------------------------------
CREATE TABLE public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_id TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_logs_created_at ON public.admin_audit_logs (created_at DESC);
CREATE INDEX idx_admin_audit_logs_admin_id ON public.admin_audit_logs (admin_id);
CREATE INDEX idx_admin_audit_logs_action ON public.admin_audit_logs (action);

-- ----------------------------------------------------------------------------
-- 7. SYSTEM SETTINGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.system_settings (key, value, description) VALUES
    ('polling_interval_minutes', '240'::jsonb, 'Minutes between scheduled route price checks (default 4 hours).'),
    ('max_api_calls_per_cycle', '50'::jsonb, 'Maximum external flight API calls per polling cycle.'),
    ('max_concurrent_requests', '3'::jsonb, 'Maximum concurrent requests to the flight provider.'),
    ('notification_cooldown_hours', '12'::jsonb, 'Minimum hours between repeated alerts unless price drops further.'),
    ('price_drop_threshold_percent', '5'::jsonb, 'Minimum percentage drop from last_notified_price to bypass cooldown.'),
    ('price_history_retention_days', '90'::jsonb, 'Days to retain historical price observations.'),
    ('maintenance_mode', 'false'::jsonb, 'Pauses automated polling and non-admin mutations when true.'),
    ('max_trackers_per_user', '10'::jsonb, 'Maximum number of trackers a regular user can create.'),
    ('max_route_retries', '5'::jsonb, 'Maximum consecutive failures before marking a route as failed.')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 8. POLLING RUNS OBSERVABILITY TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE public.polling_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ NULL,
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'skipped_lock', 'skipped_maintenance', 'failed')),
    routes_claimed INTEGER NOT NULL DEFAULT 0,
    routes_succeeded INTEGER NOT NULL DEFAULT 0,
    routes_failed INTEGER NOT NULL DEFAULT 0,
    notifications_sent INTEGER NOT NULL DEFAULT 0,
    error_message TEXT NULL
);

CREATE INDEX idx_polling_runs_started_at ON public.polling_runs (started_at DESC);

-- ----------------------------------------------------------------------------
-- 9. SECURITY HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

-- Check if the current authenticated user is an active (unbanned) super_admin.
-- SECURITY DEFINER with fixed search_path prevents RLS recursion and search_path hijacking.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'super_admin'
          AND is_banned = FALSE
    );
$$;

-- Check if the current authenticated user exists and is not banned.
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND is_banned = FALSE
    );
$$;

-- ----------------------------------------------------------------------------
-- 10. TRIGGERS & LIFECYCLE FUNCTIONS
-- ----------------------------------------------------------------------------

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_monitored_routes_updated_at
    BEFORE UPDATE ON public.monitored_routes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_tracked_flights_updated_at
    BEFORE UPDATE ON public.tracked_flights
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Automatically create a profile row when a new auth.users row is inserted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role, is_banned)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        'user',
        FALSE
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Prevent ordinary users from escalating privileges or modifying protected profile columns
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Allow service_role or postgres superuser (e.g., migrations, Edge Functions)
    IF COALESCE(current_setting('request.jwt.claim.role', TRUE), '') = 'service_role'
       OR current_user IN ('postgres', 'supabase_admin') THEN
        RETURN NEW;
    END IF;

    -- Block any attempt by authenticated/anon roles to alter protected columns
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.telegram_chat_id IS DISTINCT FROM OLD.telegram_chat_id
       OR NEW.telegram_link_token_hash IS DISTINCT FROM OLD.telegram_link_token_hash
       OR NEW.telegram_link_expires_at IS DISTINCT FROM OLD.telegram_link_expires_at THEN
        RAISE EXCEPTION 'Modification of protected profile fields is not permitted'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_protect_privileged
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- Validate tracker departure_date on INSERT or when departure_date changes.
-- Using a trigger instead of a static CHECK allows housekeeping to mark past trackers inactive.
CREATE OR REPLACE FUNCTION public.validate_tracker_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
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

CREATE TRIGGER trg_tracked_flights_validate_dates
    BEFORE INSERT OR UPDATE ON public.tracked_flights
    FOR EACH ROW EXECUTE FUNCTION public.validate_tracker_dates();

-- ----------------------------------------------------------------------------
-- 11. CANONICAL ROUTE KEY & ATOMIC TRACKER CREATION
-- ----------------------------------------------------------------------------

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

-- Atomic RPC for authenticated users to create a tracker and reuse/create monitored_route
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

    SELECT is_banned INTO v_is_banned
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_is_banned IS TRUE THEN
        RAISE EXCEPTION 'Account is banned' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE((value)::boolean, FALSE) INTO v_maintenance
    FROM public.system_settings WHERE key = 'maintenance_mode';

    IF v_maintenance IS TRUE THEN
        RAISE EXCEPTION 'System is currently in maintenance mode' USING ERRCODE = '55000';
    END IF;

    SELECT COALESCE((value)::integer, 10) INTO v_max_trackers
    FROM public.system_settings WHERE key = 'max_trackers_per_user';

    SELECT COUNT(*) INTO v_current_count
    FROM public.tracked_flights
    WHERE user_id = v_user_id;

    IF v_current_count >= v_max_trackers THEN
        RAISE EXCEPTION 'Maximum tracker limit (%) reached', v_max_trackers
            USING ERRCODE = '54000';
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
        'trip_type', LOWER(TRIM(p_trip_type)),
        'adults', p_adults,
        'children', p_children,
        'infants', p_infants,
        'cabin_class', LOWER(TRIM(p_cabin_class)),
        'currency', v_currency
    );

    -- Atomic upsert on monitored_routes
    INSERT INTO public.monitored_routes (
        route_key, search_parameters, origin, destination,
        departure_date, return_date, provider, status, next_check_at
    )
    VALUES (
        v_route_key, v_search_params, v_origin, v_destination,
        p_departure_date, p_return_date, LOWER(TRIM(p_provider)), 'active', NOW()
    )
    ON CONFLICT (route_key) DO UPDATE
    SET status = CASE
            WHEN public.monitored_routes.status IN ('paused', 'expired') THEN 'active'
            ELSE public.monitored_routes.status
        END,
        updated_at = NOW()
    RETURNING id INTO v_route_id;

    INSERT INTO public.tracked_flights (
        user_id, route_id, origin, destination, departure_date, return_date,
        trip_type, adults, children, infants, cabin_class, currency, target_price
    )
    VALUES (
        v_user_id, v_route_id, v_origin, v_destination, p_departure_date, p_return_date,
        LOWER(TRIM(p_trip_type)), p_adults, p_children, p_infants,
        LOWER(TRIM(p_cabin_class)), v_currency, p_target_price
    )
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

-- Safe RPC for authenticated user to disconnect their own Telegram account
CREATE OR REPLACE FUNCTION public.disconnect_telegram()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    UPDATE public.profiles
    SET telegram_chat_id = NULL,
        telegram_link_token_hash = NULL,
        telegram_link_expires_at = NULL,
        updated_at = NOW()
    WHERE id = auth.uid();
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. POLLING LOCK, ATOMIC ROUTE CLAIMING & HOUSEKEEPING (Service Role)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.acquire_polling_lock()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT pg_try_advisory_lock(hashtext('check_flight_prices_poll'));
$$;

CREATE OR REPLACE FUNCTION public.release_polling_lock()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT pg_advisory_unlock(hashtext('check_flight_prices_poll'));
$$;

-- Atomically claim due active routes using SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_due_routes(p_limit INTEGER DEFAULT 50)
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
          AND (next_check_at IS NULL OR next_check_at <= NOW())
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

-- Housekeeping: expire past trackers/routes, clean stale tokens, prune old price history
CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_retention_days INTEGER;
    v_expired_trackers INTEGER := 0;
    v_expired_routes INTEGER := 0;
    v_cleared_tokens INTEGER := 0;
    v_pruned_history INTEGER := 0;
BEGIN
    SELECT COALESCE((value)::integer, 90) INTO v_retention_days
    FROM public.system_settings WHERE key = 'price_history_retention_days';

    -- 1. Deactivate trackers whose departure date has passed
    UPDATE public.tracked_flights
    SET is_active = FALSE
    WHERE is_active = TRUE
      AND departure_date < CURRENT_DATE;
    GET DIAGNOSTICS v_expired_trackers = ROW_COUNT;

    -- 2. Mark routes as expired if past departure_date or no active subscribers remain
    UPDATE public.monitored_routes mr
    SET status = 'expired'
    WHERE mr.status = 'active'
      AND (
          mr.departure_date < CURRENT_DATE
          OR NOT EXISTS (
              SELECT 1 FROM public.tracked_flights tf
              WHERE tf.route_id = mr.id AND tf.is_active = TRUE
          )
      );
    GET DIAGNOSTICS v_expired_routes = ROW_COUNT;

    -- 3. Clear expired Telegram linking tokens
    UPDATE public.profiles
    SET telegram_link_token_hash = NULL,
        telegram_link_expires_at = NULL
    WHERE telegram_link_expires_at IS NOT NULL
      AND telegram_link_expires_at < NOW();
    GET DIAGNOSTICS v_cleared_tokens = ROW_COUNT;

    -- 4. Prune old price_history beyond retention window
    DELETE FROM public.price_history
    WHERE checked_at < NOW() - MAKE_INTERVAL(days => v_retention_days);
    GET DIAGNOSTICS v_pruned_history = ROW_COUNT;

    RETURN jsonb_build_object(
        'expired_trackers', v_expired_trackers,
        'expired_routes', v_expired_routes,
        'cleared_tokens', v_cleared_tokens,
        'pruned_history', v_pruned_history
    );
END;
$$;

-- Efficient SQL aggregation for Superuser Admin Dashboard
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats JSONB;
BEGIN
    IF NOT public.is_super_admin()
       AND COALESCE(current_setting('request.jwt.claim.role', TRUE), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Forbidden: super_admin required' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_build_object(
        'total_users', (SELECT COUNT(*) FROM public.profiles),
        'active_users', (SELECT COUNT(*) FROM public.profiles WHERE is_banned = FALSE),
        'banned_users', (SELECT COUNT(*) FROM public.profiles WHERE is_banned = TRUE),
        'total_trackers', (SELECT COUNT(*) FROM public.tracked_flights),
        'active_trackers', (SELECT COUNT(*) FROM public.tracked_flights WHERE is_active = TRUE),
        'unique_monitored_routes', (SELECT COUNT(*) FROM public.monitored_routes WHERE status = 'active'),
        'successful_alerts', (SELECT COUNT(*) FROM public.notification_logs WHERE delivery_status = 'sent'),
        'failed_notifications', (SELECT COUNT(*) FROM public.notification_logs WHERE delivery_status = 'failed'),
        'total_api_requests', (SELECT COALESCE(SUM(routes_succeeded + routes_failed), 0) FROM public.polling_runs),
        'total_provider_failures', (SELECT COALESCE(SUM(routes_failed), 0) FROM public.polling_runs),
        'last_successful_poll', (
            SELECT MAX(finished_at) FROM public.polling_runs WHERE status = 'completed'
        )
    ) INTO v_stats;

    RETURN v_stats;
END;
$$;

-- ----------------------------------------------------------------------------
-- 13. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitored_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polling_runs ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR public.is_super_admin());

CREATE POLICY "Users can update own non-privileged profile fields"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid() AND is_banned = FALSE)
    WITH CHECK (id = auth.uid() AND is_banned = FALSE);

CREATE POLICY "Super admins can update any profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- MONITORED ROUTES POLICIES (Read-only for users tracking them; full read for super_admin)
CREATE POLICY "Users can view monitored routes they track"
    ON public.monitored_routes FOR SELECT
    TO authenticated
    USING (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.tracked_flights tf
            WHERE tf.route_id = monitored_routes.id
              AND tf.user_id = auth.uid()
        )
    );

-- TRACKED FLIGHTS POLICIES
CREATE POLICY "Users can view own trackers or super_admin all"
    ON public.tracked_flights FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "Active users can create own trackers"
    ON public.tracked_flights FOR INSERT
    TO authenticated
    WITH CHECK (
        (user_id = auth.uid() AND public.is_active_user())
        OR public.is_super_admin()
    );

CREATE POLICY "Active users can update own trackers or super_admin all"
    ON public.tracked_flights FOR UPDATE
    TO authenticated
    USING (
        (user_id = auth.uid() AND public.is_active_user())
        OR public.is_super_admin()
    )
    WITH CHECK (
        (user_id = auth.uid() AND public.is_active_user())
        OR public.is_super_admin()
    );

CREATE POLICY "Active users can delete own trackers or super_admin all"
    ON public.tracked_flights FOR DELETE
    TO authenticated
    USING (
        (user_id = auth.uid() AND public.is_active_user())
        OR public.is_super_admin()
    );

-- PRICE HISTORY POLICIES
CREATE POLICY "Users can view price history for tracked routes"
    ON public.price_history FOR SELECT
    TO authenticated
    USING (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.tracked_flights tf
            WHERE tf.route_id = price_history.route_id
              AND tf.user_id = auth.uid()
        )
    );

-- NOTIFICATION LOGS POLICIES
CREATE POLICY "Users can view own notification logs"
    ON public.notification_logs FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_super_admin());

-- ADMIN AUDIT LOGS POLICIES (Immutable; super_admin read-only via client)
CREATE POLICY "Super admins can view audit logs"
    ON public.admin_audit_logs FOR SELECT
    TO authenticated
    USING (public.is_super_admin());

-- SYSTEM SETTINGS POLICIES
CREATE POLICY "Super admins can view and manage system settings"
    ON public.system_settings FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- POLLING RUNS POLICIES
CREATE POLICY "Super admins can view polling runs"
    ON public.polling_runs FOR SELECT
    TO authenticated
    USING (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 14. EXPLICIT SQL PRIVILEGES (GRANT / REVOKE)
-- ----------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Service role retains full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Authenticated role: minimal least-privilege grants
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (updated_at) ON public.profiles TO authenticated;

GRANT SELECT ON public.monitored_routes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracked_flights TO authenticated;
GRANT SELECT ON public.price_history TO authenticated;
GRANT SELECT ON public.notification_logs TO authenticated;
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT SELECT ON public.polling_runs TO authenticated;

-- RPC function grants
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_route_key(
    TEXT, VARCHAR, VARCHAR, DATE, DATE, TEXT, INTEGER, INTEGER, INTEGER, TEXT, VARCHAR
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_tracked_flight(
    VARCHAR, VARCHAR, DATE, DATE, TEXT, INTEGER, INTEGER, INTEGER, TEXT, VARCHAR, NUMERIC, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disconnect_telegram() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;

-- Restrict internal polling/housekeeping RPCs strictly to service_role
REVOKE EXECUTE ON FUNCTION public.acquire_polling_lock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_polling_lock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_due_routes(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_data() FROM PUBLIC, anon, authenticated;

COMMIT;
