-- 010_admin_update_user_tier_rpc.sql
-- Provides secure atomic RPC for super admins to update subscription tiers, custom quotas, and write audit logs.

CREATE OR REPLACE FUNCTION public.admin_update_user_tier(
    p_user_id UUID,
    p_tier TEXT,
    p_custom_tracker_limit INTEGER DEFAULT NULL,
    p_tier_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_target_email TEXT;
BEGIN
    -- 1. Verify caller is an active super admin
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: Only super admins can update user subscription tiers'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Validate tier
    IF p_tier NOT IN ('free', 'pro', 'enterprise') THEN
        RAISE EXCEPTION 'Invalid tier: %. Must be free, pro, or enterprise', p_tier
            USING ERRCODE = '22023';
    END IF;

    -- 3. Verify user exists
    SELECT email INTO v_target_email
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_target_email IS NULL THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
    END IF;

    -- 4. Update the user profile
    UPDATE public.profiles
    SET tier = p_tier,
        custom_tracker_limit = p_custom_tracker_limit,
        tier_notes = p_tier_notes,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- 5. Automatically insert immutable admin audit log
    INSERT INTO public.admin_audit_logs (
        admin_id,
        action,
        target_id,
        metadata
    )
    VALUES (
        v_admin_id,
        'update_user_tier',
        p_user_id::text,
        jsonb_build_object(
            'tier', p_tier,
            'custom_tracker_limit', p_custom_tracker_limit,
            'tier_notes', p_tier_notes,
            'target_email', v_target_email
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'tier', p_tier,
        'custom_tracker_limit', p_custom_tracker_limit
    );
END;
$$;

-- Grant execution to authenticated users (function internally enforces is_super_admin)
GRANT EXECUTE ON FUNCTION public.admin_update_user_tier(UUID, TEXT, INTEGER, TEXT) TO authenticated;

-- Also grant UPDATE on tier columns and INSERT on admin_audit_logs for defense-in-depth
GRANT UPDATE (tier, custom_tracker_limit, tier_notes, updated_at) ON public.profiles TO authenticated;
GRANT INSERT ON public.admin_audit_logs TO authenticated;
