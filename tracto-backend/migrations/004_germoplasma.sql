-- ─────────────────────────────────────────────────────────────────────────────
-- Migração 004: Banco de Germoplasma e Programa de Melhoramento
-- Execute no Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── GENÓTIPOS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.genotypes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    species         TEXT,
    generation      TEXT,          -- F1..F8, BC1..BC3, S1..S5, Linhagem Pura
    status          TEXT DEFAULT 'Em desenvolvimento',
                    -- Em desenvolvimento | Candidata | Descartada | Registrada
    origin          TEXT,
    female_parent   TEXT,
    male_parent     TEXT,
    year_obtained   INTEGER,
    notes           TEXT,
    traits          TEXT[],        -- ex: {"Alta produção","Resistência à seca"}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.genotypes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "genotypes_user_own"
    ON public.genotypes FOR ALL
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_genotypes_user_id ON public.genotypes (user_id);
CREATE INDEX IF NOT EXISTS idx_genotypes_status   ON public.genotypes (status);

-- ── CRUZAMENTOS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crosses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date            DATE,
    female_parent   TEXT NOT NULL,
    male_parent     TEXT NOT NULL,
    f1_name         TEXT,
    purpose         TEXT,
    location        TEXT,
    f1_count        INTEGER,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crosses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crosses_user_own"
    ON public.crosses FOR ALL
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_crosses_user_id ON public.crosses (user_id);

-- ── GERAÇÕES DE MELHORAMENTO ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.breeding_generations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    genotype_id         UUID NOT NULL REFERENCES public.genotypes(id) ON DELETE CASCADE,
    generation_label    TEXT NOT NULL,   -- ex: F2, F3, BC1F2
    year                INTEGER,
    location            TEXT,
    plants_evaluated    INTEGER,
    plants_selected     INTEGER,
    selection_criteria  TEXT,
    mean_yield          FLOAT8,          -- produtividade média (unidade a critério do usuário)
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.breeding_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "breeding_generations_user_own"
    ON public.breeding_generations FOR ALL
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_breeding_gens_user_id     ON public.breeding_generations (user_id);
CREATE INDEX IF NOT EXISTS idx_breeding_gens_genotype_id ON public.breeding_generations (genotype_id);
