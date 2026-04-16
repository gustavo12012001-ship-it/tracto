-- Persistent cache for Sentinel artifacts (metadata in Postgres + binary in Storage bucket)

create table if not exists public.satellite_artifacts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    farm_id uuid null,
    field_id uuid not null references public.fields (id) on delete cascade,
    source text not null check (source in ('s1', 's2')),
    mode text not null,
    scene_id text null,
    scene_date date null,
    cloud_coverage numeric null,
    bbox_hash text not null,
    image_path text not null,
    mime_type text not null default 'image/png',
    width integer null,
    height integer null,
    bytes_size bigint null,
    generated_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_accessed_at timestamptz not null default now(),
    cache_version text not null default 'v1',
    expires_at timestamptz null
);

create unique index if not exists ux_satellite_artifacts_scene_key
on public.satellite_artifacts (field_id, source, scene_id);

create index if not exists ix_satellite_artifacts_lookup
on public.satellite_artifacts (field_id, source, updated_at desc);

alter table public.satellite_artifacts enable row level security;

-- Service role will handle writes/reads; keep user-facing reads closed by default.
drop policy if exists satellite_artifacts_select_owner on public.satellite_artifacts;
create policy satellite_artifacts_select_owner
on public.satellite_artifacts
for select
using (auth.uid() = user_id);

-- ============================================================
-- BUCKET DE STORAGE
-- ============================================================
-- Crie manualmente no painel do Supabase:
--   Storage > Novo Bucket > Nome: satellite-cache > Acesso: Privado (public=false)
-- Nenhuma URL pública deve ser exposta; o backend faz streaming autenticado.
--
-- Inserção via SQL (alternativa ao painel):
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('satellite-cache', 'satellite-cache', false)
-- ON CONFLICT (id) DO NOTHING;
-- ============================================================
