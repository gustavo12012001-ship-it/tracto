-- ============================================================
-- Migration 12 — PostGIS para fields/farms (NÃO-DESTRUTIVA)
-- ============================================================
-- Objetivo (A-07): migrar 'boundaries' (JSONB) para geometria PostGIS real,
-- habilitando consultas espaciais (área, interseção, distância) e índice GiST.
--
-- Garantias:
--   • NÃO altera nem remove a coluna 'boundaries' (JSONB) existente — ela
--     permanece como fonte para o frontend (Leaflet usa [lat,lng]).
--   • Idempotente: pode rodar várias vezes (IF NOT EXISTS / backfill condicional).
--   • Só preenche 'geom'/'area_ha' onde ainda estão nulos.
--
-- Formato de 'boundaries': array de pares [lat, lng] (ordem do Leaflet).
-- PostGIS usa (lng lat) → a conversão inverte a ordem.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ── Helper: converte boundaries JSONB ([[lat,lng],...]) em Polygon 4326 ──────
CREATE OR REPLACE FUNCTION public.tracto_boundaries_to_polygon(b jsonb)
RETURNS geometry(Polygon, 4326)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    pts geometry[];
    ring geometry;
BEGIN
    IF b IS NULL
       OR jsonb_typeof(b) <> 'array'
       OR jsonb_array_length(b) < 3 THEN
        RETURN NULL;
    END IF;

    -- boundaries = [[lat, lng], ...]  →  ST_MakePoint(lng, lat)
    SELECT array_agg(
               ST_SetSRID(ST_MakePoint((pt->>1)::float8, (pt->>0)::float8), 4326)
               ORDER BY ord
           )
      INTO pts
      FROM jsonb_array_elements(b) WITH ORDINALITY AS arr(pt, ord);

    -- Fecha o anel se o primeiro e o último ponto não coincidem.
    IF NOT ST_Equals(pts[1], pts[array_length(pts, 1)]) THEN
        pts := pts || pts[1];
    END IF;

    ring := ST_MakeLine(pts);
    IF ring IS NULL OR ST_NPoints(ring) < 4 THEN
        RETURN NULL;
    END IF;

    -- ST_MakeValid corrige auto-interseções/orientação sem falhar a migração.
    RETURN ST_MakeValid(ST_MakePolygon(ring));
EXCEPTION WHEN OTHERS THEN
    -- Geometria inválida não derruba a migração; fica NULL e segue via JSONB.
    RETURN NULL;
END;
$$;

-- ── fields ───────────────────────────────────────────────────────────────────
ALTER TABLE public.fields
    ADD COLUMN IF NOT EXISTS geom geometry(Polygon, 4326);

UPDATE public.fields
   SET geom = public.tracto_boundaries_to_polygon(boundaries)
 WHERE geom IS NULL
   AND boundaries IS NOT NULL
   AND jsonb_typeof(boundaries) = 'array'
   AND jsonb_array_length(boundaries) >= 3;

-- Área em hectares a partir da geometria (geography → metros²).
UPDATE public.fields
   SET area_ha = ROUND((ST_Area(geom::geography) / 10000.0)::numeric, 4)
 WHERE geom IS NOT NULL
   AND (area_ha IS NULL OR area_ha = 0);

CREATE INDEX IF NOT EXISTS idx_fields_geom
    ON public.fields USING GIST (geom);

-- ── farms (mesmo padrão; boundaries adicionada na migração 07) ───────────────
ALTER TABLE public.farms
    ADD COLUMN IF NOT EXISTS geom geometry(Polygon, 4326);

UPDATE public.farms
   SET geom = public.tracto_boundaries_to_polygon(boundaries)
 WHERE geom IS NULL
   AND boundaries IS NOT NULL
   AND jsonb_typeof(boundaries) = 'array'
   AND jsonb_array_length(boundaries) >= 3;

CREATE INDEX IF NOT EXISTS idx_farms_geom
    ON public.farms USING GIST (geom);

-- ============================================================
-- OPCIONAL (não habilitado por padrão): manter geom em sincronia com boundaries
-- automaticamente via trigger. Descomente se quiser que toda escrita em
-- 'boundaries' atualize 'geom' (e area_ha em fields) no próprio banco.
-- ============================================================
-- CREATE OR REPLACE FUNCTION public.tracto_sync_geom() RETURNS trigger
-- LANGUAGE plpgsql AS $$
-- BEGIN
--     NEW.geom := public.tracto_boundaries_to_polygon(NEW.boundaries);
--     IF TG_TABLE_NAME = 'fields' AND NEW.geom IS NOT NULL THEN
--         NEW.area_ha := ROUND((ST_Area(NEW.geom::geography) / 10000.0)::numeric, 4);
--     END IF;
--     RETURN NEW;
-- END;
-- $$;
--
-- DROP TRIGGER IF EXISTS trg_fields_sync_geom ON public.fields;
-- CREATE TRIGGER trg_fields_sync_geom
--     BEFORE INSERT OR UPDATE OF boundaries ON public.fields
--     FOR EACH ROW EXECUTE FUNCTION public.tracto_sync_geom();
--
-- DROP TRIGGER IF EXISTS trg_farms_sync_geom ON public.farms;
-- CREATE TRIGGER trg_farms_sync_geom
--     BEFORE INSERT OR UPDATE OF boundaries ON public.farms
--     FOR EACH ROW EXECUTE FUNCTION public.tracto_sync_geom();
