-- ============================================================================
-- 001_rls_verification.sql
-- Transactional SQL Verification Suite for Phase 1 RLS, Privileges & Security
-- Run via: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/001_rls_verification.sql
-- ============================================================================

BEGIN;

-- 1. Create synthetic test users in auth.users (triggers auto-create profiles)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'user_a@test.local', 'hash', NOW(), NOW(), NOW(), '{}', '{}'),
    ('22222222-2222-2222-2222-222222222222', 'user_b@test.local', 'hash', NOW(), NOW(), NOW(), '{}', '{}'),
    ('33333333-3333-3333-3333-333333333333', 'banned@test.local', 'hash', NOW(), NOW(), NOW(), '{}', '{}'),
    ('44444444-4444-4444-4444-444444444444', 'admin@test.local',  'hash', NOW(), NOW(), NOW(), '{}', '{}');

-- Verify profile auto-creation
DO $$
DECLARE v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.profiles
    WHERE id IN (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333',
        '44444444-4444-4444-4444-444444444444'
    );
    IF v_count <> 4 THEN
        RAISE EXCEPTION 'Expected 4 auto-created profiles, got %', v_count;
    END IF;
END $$;

-- Configure banned user & super_admin as service/postgres
UPDATE public.profiles SET is_banned = TRUE WHERE id = '33333333-3333-3333-3333-333333333333';
UPDATE public.profiles SET role = 'super_admin' WHERE id = '44444444-4444-4444-4444-444444444444';

-- Insert an audit log entry as service_role
INSERT INTO public.admin_audit_logs (admin_id, action, target_id, metadata)
VALUES ('44444444-4444-4444-4444-444444444444', 'SEED_TEST', 'user_a', '{"test":true}');

-- ----------------------------------------------------------------------------
-- TEST A: User A creates a tracker & route deduplication check
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', TRUE);
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);

SELECT public.create_tracked_flight(
    'DEL', 'BOM', (CURRENT_DATE + 30)::DATE, NULL,
    'one_way', 1, 0, 0, 'economy', 'INR', 5000.00, 'travelpayouts'
);

-- Verify User A cannot escalate role or modify is_banned
DO $$
BEGIN
    BEGIN
        UPDATE public.profiles SET role = 'super_admin'
        WHERE id = '11111111-1111-1111-1111-111111111111';
        RAISE EXCEPTION 'FAIL: Role escalation succeeded unexpectedly';
    EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN
        NULL; -- Expected
    END;
END $$;

-- Verify User A cannot read admin_audit_logs
DO $$
DECLARE v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.admin_audit_logs;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL: Regular user saw % audit log rows', v_count;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- TEST B: User B isolation & shared route deduplication
-- ----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', TRUE);

-- User B must see 0 of User A's trackers
DO $$
DECLARE v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.tracked_flights;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL: User B saw % trackers belonging to User A', v_count;
    END IF;
END $$;

-- User B creates tracker for exact same route -> must reuse monitored_routes row
SELECT public.create_tracked_flight(
    'DEL', 'BOM', (CURRENT_DATE + 30)::DATE, NULL,
    'one_way', 1, 0, 0, 'economy', 'INR', 4800.00, 'travelpayouts'
);

RESET ROLE;
DO $$
DECLARE v_routes INTEGER; v_trackers INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_routes FROM public.monitored_routes WHERE origin = 'DEL' AND destination = 'BOM';
    SELECT COUNT(*) INTO v_trackers FROM public.tracked_flights WHERE origin = 'DEL' AND destination = 'BOM';
    IF v_routes <> 1 OR v_trackers <> 2 THEN
        RAISE EXCEPTION 'FAIL: Expected 1 deduplicated route and 2 trackers, got routes=%, trackers=%', v_routes, v_trackers;
    END IF;
END $$;

-- Seed price_history for this route as postgres
INSERT INTO public.price_history (route_id, route_key, price, currency, airline, provider)
SELECT id, route_key, 4900.00, 'INR', '6E', 'travelpayouts'
FROM public.monitored_routes WHERE origin = 'DEL' AND destination = 'BOM' LIMIT 1;

-- ----------------------------------------------------------------------------
-- TEST C: Historical price access for User A vs Banned User
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', TRUE);

DO $$
DECLARE v_hist INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_hist FROM public.price_history;
    IF v_hist <> 1 THEN
        RAISE EXCEPTION 'FAIL: User A should see 1 price_history row for tracked route, got %', v_hist;
    END IF;
END $$;

-- Banned user cannot create trackers
SELECT set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', TRUE);
DO $$
BEGIN
    BEGIN
        PERFORM public.create_tracked_flight(
            'BLR', 'DEL', (CURRENT_DATE + 20)::DATE, NULL,
            'one_way', 1, 0, 0, 'economy', 'INR', 5000.00, 'travelpayouts'
        );
        RAISE EXCEPTION 'FAIL: Banned user was allowed to create a tracker';
    EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN
        NULL; -- Expected
    END;
END $$;

-- ----------------------------------------------------------------------------
-- TEST D: Super-admin access
-- ----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', TRUE);
DO $$
DECLARE v_users INTEGER; v_logs INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_users FROM public.profiles;
    SELECT COUNT(*) INTO v_logs FROM public.admin_audit_logs;
    IF v_users < 4 OR v_logs < 1 THEN
        RAISE EXCEPTION 'FAIL: Super admin access check failed (users=%, logs=%)', v_users, v_logs;
    END IF;
END $$;

RESET ROLE;
ROLLBACK;
