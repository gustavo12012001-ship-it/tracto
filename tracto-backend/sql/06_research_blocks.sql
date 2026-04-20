-- Migração 06: Suporte a micro-áreas / blocos de pesquisa dentro de talhões
ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS parent_field_id UUID REFERENCES public.fields(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS field_type       TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS treatment_label  TEXT,
  ADD COLUMN IF NOT EXISTS block_number     INTEGER;

CREATE INDEX IF NOT EXISTS idx_fields_parent_field_id ON public.fields(parent_field_id);
