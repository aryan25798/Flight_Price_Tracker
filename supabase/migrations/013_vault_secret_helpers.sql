-- ============================================================================
-- 013_vault_secret_helpers.sql
-- Idempotent Supabase Vault Secret Configuration for pg_cron
-- ============================================================================

-- Function to safely insert or update secrets in Supabase Vault without throwing errors
CREATE OR REPLACE FUNCTION public.upsert_vault_secret(
    p_secret TEXT,
    p_name TEXT,
    p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Check if secret already exists
    SELECT id INTO v_id
    FROM vault.secrets
    WHERE name = p_name;

    IF v_id IS NOT NULL THEN
        -- Update existing secret
        UPDATE vault.secrets
        SET secret = p_secret,
            description = COALESCE(p_description, description),
            updated_at = NOW()
        WHERE id = v_id;
    ELSE
        -- Insert new secret using vault.create_secret
        v_id := vault.create_secret(p_secret, p_name, p_description);
    END IF;

    RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.upsert_vault_secret IS
'Idempotently creates or updates an encrypted secret in Supabase Vault for automated pg_cron Edge Function invocation.';

-- Example usage for administrators in Supabase SQL Editor:
-- SELECT public.upsert_vault_secret('https://vchicigycuwzkbxsgykp.supabase.co', 'project_url', 'Supabase Project Base URL');
-- SELECT public.upsert_vault_secret('ac6b18b5fedb2df9452564b4492b328fd0aa772a868f43991e57e82fd3f4d0ba', 'cron_secret', 'Edge Function CRON_SECRET authentication token');
