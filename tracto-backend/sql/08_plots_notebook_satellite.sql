-- ============================================================
-- Migration 08 — Plots, Notebook Events, Satellite Up42
-- Execute no Supabase SQL Editor
-- ============================================================

-- ── 1. Parcelas / Microtalhões ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plots (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    field_id    UUID NOT NULL REFERENCES public.fields(id)      ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    area_ha     NUMERIC,
    boundaries  JSONB,
    latitude    NUMERIC,
    longitude   NUMERIC,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.plots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plots_owner ON public.plots;
CREATE POLICY plots_owner ON public.plots FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_plots_field_id ON public.plots(field_id);
CREATE INDEX IF NOT EXISTS idx_plots_user_id  ON public.plots(user_id);

-- ── 2. Caderno de Campo — Eventos / Registros ─────────────────────────────────
-- Substitui e expande o field_logs com categorias ricas e estrutura JSONB flexível.
-- O field_logs existente é mantido; este é o modelo expandido para novas telas.

CREATE TABLE IF NOT EXISTS public.notebook_events (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    field_id      UUID NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
    plot_id       UUID          REFERENCES public.plots(id)  ON DELETE SET NULL,
    -- Categorias: identification | planting | soil | pest | disease | weed |
    --             application | fertilization | irrigation | harvest | observation
    category      TEXT NOT NULL,
    occurred_at   TIMESTAMPTZ DEFAULT NOW(),
    title         TEXT,
    data          JSONB  DEFAULT '{}'::JSONB,   -- payload por categoria (veja abaixo)
    photos        TEXT[] DEFAULT ARRAY[]::TEXT[], -- URLs no Supabase Storage
    ai_analysis   TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Payload esperado por categoria (documentação inline):
-- identification: {farm_name, owner, field_code, crop, variety, area_ha, coordinates}
-- planting:       {crop, variety, planting_date, depth_cm, spacing_cm, density_pl_m, direct_seeding}
-- soil:           {pH, P, K, Ca, Mg, Al, B, Cu, Zn, Fe, Mn, MO, CTC, V_pct, texture, lime_applied, gypsum_applied, prep_type}
-- pest:           {pest_name, scientific_name, incidence_pct, infestation_level, location_in_field}
-- disease:        {disease_name, scientific_name, incidence_pct, infestation_level, location_in_field}
-- weed:           {species, dominant_species, infestation_level, location_in_field}
-- application:    {product, commercial_name, active_ingredient, dose_l_ha, volume_L_ha, qty_per_ha, purpose}
-- fertilization:  {product, dose_kg_ha, NPK, method, source}
-- irrigation:     {method, duration_h, volume_mm, system}
-- harvest:        {start_date, end_date, estimated_yield_sc_ha, real_yield_sc_ha, losses_pct}
-- observation:    {text}

ALTER TABLE public.notebook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notebook_events_owner ON public.notebook_events;
CREATE POLICY notebook_events_owner ON public.notebook_events FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_events_field_id   ON public.notebook_events(field_id);
CREATE INDEX IF NOT EXISTS idx_notebook_events_user_id    ON public.notebook_events(user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_events_plot_id    ON public.notebook_events(plot_id) WHERE plot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notebook_events_category   ON public.notebook_events(category);
CREATE INDEX IF NOT EXISTS idx_notebook_events_occurred_at ON public.notebook_events(occurred_at DESC);

-- ── 3. Satellite Artifacts — adicionar suporte ao Up42 ───────────────────────
-- Remover constraint de CHECK antigo e substituir por um que inclui 'up42'
DO $$
BEGIN
    -- Remove old check constraint (nome pode variar)
    ALTER TABLE public.satellite_artifacts DROP CONSTRAINT IF EXISTS satellite_artifacts_source_check;
    ALTER TABLE public.satellite_artifacts DROP CONSTRAINT IF EXISTS satellite_artifacts_source_fkey;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.satellite_artifacts
    ADD CONSTRAINT satellite_artifacts_source_check
    CHECK (source IN ('s1', 's2', 'up42'));

-- Adicionar plot_id para vincular imagem à parcela específica
ALTER TABLE public.satellite_artifacts
    ADD COLUMN IF NOT EXISTS plot_id UUID REFERENCES public.plots(id) ON DELETE SET NULL;

-- Adicionar provider (nome do fornecedor: 'Pléiades', 'SPOT', 'Satellogic', etc.)
ALTER TABLE public.satellite_artifacts
    ADD COLUMN IF NOT EXISTS provider TEXT;

-- Índices extras para consultas históricas
CREATE INDEX IF NOT EXISTS idx_satellite_artifacts_source_date
    ON public.satellite_artifacts(field_id, source, scene_date DESC);
