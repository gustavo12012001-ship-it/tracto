-- ============================================================
-- VERIFY SCHEMA — Confirma se todas as migrations foram aplicadas
-- Rode no Supabase SQL Editor pra validar estado atual.
-- ============================================================
-- Retorna uma única linha com colunas booleanas. TRUE = aplicado.

WITH expected_tables AS (
    SELECT unnest(ARRAY[
        'users',
        'farms',
        'fields',
        'conversations',
        'alerts',
        'push_subscriptions',
        'subscriptions',          -- 02_commercial
        'plans',                  -- 02_commercial
        'satellite_artifacts',    -- 03_satellite_artifacts
        'plots',                  -- 08_plots_notebook_satellite
        'notebook_events',        -- 08_plots_notebook_satellite
        'field_logs',
        'seasons',
        'genotypes',
        'crosses',
        'breeding_generations',
        'api_keys'
    ]) AS table_name
),
actual AS (
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
)
SELECT
    et.table_name,
    (et.table_name IN (SELECT table_name FROM actual)) AS exists
FROM expected_tables et
ORDER BY exists, et.table_name;

-- ============================================================
-- Checa constraint correto do satellite_artifacts (migration 09)
-- ============================================================
SELECT
    indexname,
    indexdef,
    (indexdef LIKE '%mode%' AND indexdef LIKE '%bbox_hash%') AS migration_09_applied
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'satellite_artifacts'
  AND indexname LIKE 'ux_satellite_artifacts%';

-- ============================================================
-- Checa RLS habilitado em tabelas críticas
-- ============================================================
SELECT
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('farms', 'fields', 'notebook_events', 'satellite_artifacts',
                    'plots', 'seasons', 'genotypes', 'crosses', 'field_logs',
                    'conversations', 'alerts', 'api_keys', 'subscriptions')
ORDER BY rls_enabled, tablename;

-- ============================================================
-- Checa policies (deve ter pelo menos uma policy por tabela com RLS)
-- ============================================================
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================
-- Bucket de storage 'satellite-cache' deve existir
-- ============================================================
SELECT id, name, public FROM storage.buckets WHERE id = 'satellite-cache';
