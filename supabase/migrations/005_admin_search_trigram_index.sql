-- ============================================================================
-- 005_admin_search_trigram_index.sql
-- Enables pg_trgm and creates GIN trigram index on profiles(email)
-- Enables sub-millisecond wildcard/substring ILIKE '%query%' searches across 100k+ users
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm
    ON public.profiles
    USING gin (email extensions.gin_trgm_ops);

COMMIT;
