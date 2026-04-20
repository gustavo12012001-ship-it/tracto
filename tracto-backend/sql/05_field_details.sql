-- Migração 05: Campos agronômicos detalhados no talhão
ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS irrigation_type        TEXT,
  ADD COLUMN IF NOT EXISTS fertilization_type     TEXT,
  ADD COLUMN IF NOT EXISTS last_fertilization_date DATE,
  ADD COLUMN IF NOT EXISTS soil_texture           TEXT,
  ADD COLUMN IF NOT EXISTS previous_crop          TEXT,
  ADD COLUMN IF NOT EXISTS crop_rotation          TEXT;
