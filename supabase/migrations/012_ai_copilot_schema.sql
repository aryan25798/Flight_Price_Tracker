-- ============================================================================
-- 012_ai_copilot_schema.sql
-- AeroDrop AI 2.0 Security & Database Architecture
-- Conversations, Messages, Usage Telemetry, RLS Policies, and Quota Guards
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. AI CONVERSATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Flight Intelligence Chat',
    scope TEXT NOT NULL DEFAULT 'user' CHECK (scope IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user
    ON public.ai_conversations (user_id, updated_at DESC);

-- ----------------------------------------------------------------------------
-- 2. AI MESSAGES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL DEFAULT '',
    tool_calls JSONB NULL,
    tool_results JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
    ON public.ai_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user
    ON public.ai_messages (user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. AI USAGE LOGS TABLE (Zero-Cost Quota & Abuse Auditing)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'google',
    model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
    prompt_tokens INTEGER NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
    completion_tokens INTEGER NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
    tool_execution_count INTEGER NOT NULL DEFAULT 0 CHECK (tool_execution_count >= 0),
    latency_ms INTEGER NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
    status TEXT NOT NULL DEFAULT 'success'
        CHECK (status IN ('success', 'error', 'rate_limited', 'quota_exhausted')),
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user
    ON public.ai_usage_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at
    ON public.ai_usage_logs (created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. SYSTEM SETTINGS (AI Operational Controls & Kill Switch)
-- ----------------------------------------------------------------------------
INSERT INTO public.system_settings (key, value, description)
VALUES
    ('ai_enabled', 'true'::jsonb, 'Master administrator kill-switch for AeroDrop AI Copilot.'),
    ('ai_daily_user_limit', '30'::jsonb, 'Maximum daily AI interactions per free-tier member.'),
    ('ai_max_tokens_per_turn', '1024'::jsonb, 'Hard ceiling on output tokens generated per AI response.')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. ATOMIC QUOTA VERIFICATION RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_record_ai_quota(
    p_user_id UUID,
    p_provider TEXT DEFAULT 'google',
    p_model TEXT DEFAULT 'gemini-2.0-flash',
    p_prompt_tokens INTEGER DEFAULT 0,
    p_completion_tokens INTEGER DEFAULT 0,
    p_tool_count INTEGER DEFAULT 0,
    p_latency_ms INTEGER DEFAULT 0,
    p_status TEXT DEFAULT 'success',
    p_error TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ai_enabled BOOLEAN;
    v_is_banned BOOLEAN;
    v_role TEXT;
    v_tier TEXT;
    v_daily_limit INTEGER;
    v_used_today INTEGER;
BEGIN
    -- 1. Check master AI kill-switch
    SELECT COALESCE((value)::boolean, TRUE) INTO v_ai_enabled
    FROM public.system_settings WHERE key = 'ai_enabled';

    IF v_ai_enabled IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'allowed', FALSE,
            'reason', 'kill_switch_active',
            'message', 'AeroDrop AI is temporarily offline for scheduled system maintenance.'
        );
    END IF;

    -- 2. Validate user identity and ban status
    SELECT role, tier, is_banned INTO v_role, v_tier, v_is_banned
    FROM public.profiles WHERE id = p_user_id;

    IF v_is_banned IS TRUE THEN
        RETURN jsonb_build_object(
            'allowed', FALSE,
            'reason', 'account_banned',
            'message', 'Your account is suspended.'
        );
    END IF;

    -- Super admins bypass daily rate limits
    IF v_role = 'super_admin' THEN
        v_daily_limit := 500;
    ELSIF v_tier = 'enterprise' THEN
        v_daily_limit := 200;
    ELSIF v_tier = 'pro' THEN
        v_daily_limit := 100;
    ELSE
        SELECT COALESCE((value)::integer, 30) INTO v_daily_limit
        FROM public.system_settings WHERE key = 'ai_daily_user_limit';
    END IF;

    -- 3. Calculate usage today (UTC)
    SELECT COUNT(*) INTO v_used_today
    FROM public.ai_usage_logs
    WHERE user_id = p_user_id
      AND created_at >= date_trunc('day', NOW());

    IF v_used_today >= v_daily_limit AND v_role <> 'super_admin' THEN
        RETURN jsonb_build_object(
            'allowed', FALSE,
            'reason', 'quota_exceeded',
            'used_today', v_used_today,
            'limit', v_daily_limit,
            'message', format('Daily AI limit (%s requests) reached. Resets at midnight UTC.', v_daily_limit)
        );
    END IF;

    -- 4. Record usage log
    INSERT INTO public.ai_usage_logs (
        user_id, provider, model, prompt_tokens, completion_tokens,
        tool_execution_count, latency_ms, status, error_message
    ) VALUES (
        p_user_id, p_provider, p_model, p_prompt_tokens, p_completion_tokens,
        p_tool_count, p_latency_ms, p_status, p_error
    );

    RETURN jsonb_build_object(
        'allowed', TRUE,
        'used_today', v_used_today + 1,
        'remaining', GREATEST(0, v_daily_limit - (v_used_today + 1)),
        'limit', v_daily_limit
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) FOR AI TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- AI CONVERSATIONS POLICIES
CREATE POLICY "Users can view own conversations or super_admin all"
    ON public.ai_conversations FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "Users can create own conversations"
    ON public.ai_conversations FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() AND public.is_active_user());

CREATE POLICY "Users can update own conversations"
    ON public.ai_conversations FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() AND public.is_active_user())
    WITH CHECK (user_id = auth.uid() AND public.is_active_user());

CREATE POLICY "Users can delete own conversations or super_admin all"
    ON public.ai_conversations FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_super_admin());

-- AI MESSAGES POLICIES
CREATE POLICY "Users can view messages from own conversations"
    ON public.ai_messages FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "Users can insert messages into own conversations"
    ON public.ai_messages FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() AND public.is_active_user());

CREATE POLICY "Users can delete messages from own conversations"
    ON public.ai_messages FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_super_admin());

-- AI USAGE LOGS POLICIES (Immutable telemetry; super_admin or owner can read)
CREATE POLICY "Users can view own usage logs or super_admin all"
    ON public.ai_usage_logs FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "Service role and functions can insert usage logs"
    ON public.ai_usage_logs FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

COMMIT;
