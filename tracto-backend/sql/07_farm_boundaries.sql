-- Migração 07: Polígono de área da fazenda
ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS boundaries JSONB,
  ADD COLUMN IF NOT EXISTS city TEXT;
