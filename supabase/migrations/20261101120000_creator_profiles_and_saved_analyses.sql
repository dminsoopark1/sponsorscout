-- Creator-owned profiles and saved analyses.
-- Apply this in the Supabase SQL editor, or with the Supabase CLI (`supabase db push`).
-- The Next.js app uses the publishable key plus the signed-in user's JWT.
-- It does not use the service-role key. The service role bypasses these policies.

create table public.creator_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_profiles_display_name_len check (
    display_name is null or char_length(btrim(display_name)) between 1 and 80
  )
);

create table public.saved_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  offer_text text not null,
  analysis jsonb not null,
  created_at timestamptz not null default now(),
  constraint saved_analyses_offer_len check (char_length(offer_text) between 20 and 12000),
  constraint saved_analyses_analysis_object check (jsonb_typeof(analysis) = 'object')
);

create index saved_analyses_user_created_idx
  on public.saved_analyses (user_id, created_at desc);

alter table public.creator_profiles enable row level security;
alter table public.creator_profiles force row level security;
alter table public.saved_analyses enable row level security;
alter table public.saved_analyses force row level security;

revoke all on table public.creator_profiles from public, anon;
revoke all on table public.saved_analyses from public, anon;

grant select, insert on table public.creator_profiles to authenticated;
grant update (display_name, updated_at) on table public.creator_profiles to authenticated;
grant select, insert, delete on table public.saved_analyses to authenticated;

create policy creator_profiles_select_own
  on public.creator_profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy creator_profiles_insert_own
  on public.creator_profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy creator_profiles_update_own
  on public.creator_profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy saved_analyses_select_own
  on public.saved_analyses
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy saved_analyses_insert_own
  on public.saved_analyses
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy saved_analyses_delete_own
  on public.saved_analyses
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.creator_profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(
      btrim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', '')),
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
