-- ============================================================
-- Migration 04 — satellite_artifacts + conversations.field_id
-- Execute no Supabase SQL Editor
-- ============================================================

-- ── 1. Tabela satellite_artifacts ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.satellite_artifacts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    farm_id          UUID REFERENCES public.farms(id) ON DELETE SET NULL,
    field_id         UUID NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
    source           TEXT NOT NULL,                          -- 's1' ou 's2'
    mode             TEXT NOT NULL DEFAULT 'truecolor',
    scene_id         TEXT,
    scene_date       TEXT,
    cloud_coverage   NUMERIC,
    bbox_hash        TEXT NOT NULL,
    image_path       TEXT NOT NULL,
    mime_type        TEXT DEFAULT 'image/png',
    width            INT,
    height           INT,
    bytes_size       INT,
    generated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at       TIMESTAMP WITH TIME ZONE,
    cache_version    TEXT DEFAULT 'v1',
    UNIQUE (field_id, source, scene_id, mode, bbox_hash)
);

ALTER TABLE public.satellite_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own satellite_artifacts"
    ON public.satellite_artifacts FOR ALL
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_satellite_artifacts_field_id
    ON public.satellite_artifacts (field_id);

CREATE INDEX IF NOT EXISTS idx_satellite_artifacts_user_id
    ON public.satellite_artifacts (user_id);

CREATE INDEX IF NOT EXISTS idx_satellite_artifacts_expires_at
    ON public.satellite_artifacts (expires_at)
    WHERE expires_at IS NOT NULL;


-- ── 2. Coluna field_id na tabela conversations ────────────────────────────────
ALTER TABLE public.conversations
    ADD COLUMN IF NOT EXISTS field_id UUID REFERENCES public.fields(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_field_id
    ON public.conversations (field_id)
    WHERE field_id IS NOT NULL;
