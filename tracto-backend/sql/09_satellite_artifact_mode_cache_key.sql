-- Permite armazenar NDVI, RGB, SAR e outros modos da mesma cena sem sobrescrever.

drop index if exists public.ux_satellite_artifacts_scene_key;

create unique index if not exists ux_satellite_artifacts_scene_mode_bbox_key
on public.satellite_artifacts (field_id, source, scene_id, mode, bbox_hash);

create index if not exists idx_satellite_artifacts_field_mode_date
on public.satellite_artifacts (field_id, mode, scene_date desc, generated_at desc);
