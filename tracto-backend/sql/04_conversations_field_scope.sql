-- Scope chat conversations by field_id to prevent cross-field context leakage

alter table if exists public.conversations
    add column if not exists field_id uuid null;

-- Optional FK: if field is deleted, conversation keeps history but field_id becomes null.
alter table if exists public.conversations
    drop constraint if exists conversations_field_id_fkey;

alter table if exists public.conversations
    add constraint conversations_field_id_fkey
    foreign key (field_id) references public.fields(id) on delete set null;

create index if not exists idx_conversations_user_field_updated
    on public.conversations (user_id, field_id, updated_at desc);

create index if not exists idx_conversations_user_updated
    on public.conversations (user_id, updated_at desc);
