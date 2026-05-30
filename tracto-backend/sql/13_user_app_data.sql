-- ============================================================
-- Migration 13 — user_app_data (A-01)
-- ============================================================
-- Persistência server-side, por usuário e por "namespace", de dados que hoje
-- vivem só no localStorage do navegador (germoplasma, experimentos, avaliações
-- fenotípicas, solo, blocos de pesquisa). Resolve o risco de PERDA DE DADOS:
-- o backend passa a ser a fonte de verdade; o localStorage vira cache.
--
-- Modelo genérico (JSONB) de propósito: evita travar o schema enquanto o
-- domínio ainda evolui no frontend. Cada (user_id, namespace) guarda um
-- documento JSON arbitrário (array ou objeto).
--
-- Idempotente. RLS por dono.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_app_data (
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    namespace  TEXT NOT NULL,
    data       JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, namespace)
);

ALTER TABLE public.user_app_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own app data" ON public.user_app_data;
CREATE POLICY "Users manage own app data"
    ON public.user_app_data FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_app_data_user
    ON public.user_app_data (user_id);

-- ROLLBACK (manual):
-- DROP TABLE IF EXISTS public.user_app_data CASCADE;
