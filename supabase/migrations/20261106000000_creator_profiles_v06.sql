-- Creator Profiles v0.6
-- Persistent, owner-scoped creator identity, social accounts, self-reported metrics,
-- optional demographics, and sponsorship preferences. Designed for later API sync
-- (social_metrics.source / audience_demographics.source) without implementing it now.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_child_social_owner()
returns trigger
language plpgsql
as $$
declare
  owner uuid;
begin
  select user_id into owner
  from public.social_accounts
  where id = new.social_account_id;

  if owner is null then
    raise exception 'social account not found';
  end if;

  if tg_op = 'INSERT' then
    new.user_id := owner;
  elsif new.user_id is distinct from owner then
    raise exception 'cannot attach metrics or demographics to another user''s social account';
  end if;

  return new;
end;
$$;

create table if not exists public.creator_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  creator_name text,
  primary_niche text,
  additional_niches text[] not null default '{}',
  primary_audience_region text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_profiles_display_name_len check (display_name is null or char_length(display_name) between 1 and 80),
  constraint creator_profiles_creator_name_len check (creator_name is null or char_length(creator_name) between 1 and 120),
  constraint creator_profiles_niche_len check (primary_niche is null or char_length(primary_niche) between 1 and 80),
  constraint creator_profiles_region_len check (primary_audience_region is null or char_length(primary_audience_region) between 1 and 80),
  constraint creator_profiles_bio_len check (bio is null or char_length(bio) <= 1000)
);

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('Instagram', 'TikTok', 'YouTube', 'Other')),
  handle text not null,
  profile_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_accounts_handle_len check (char_length(handle) between 1 and 80),
  constraint social_accounts_url_len check (profile_url is null or char_length(profile_url) <= 500),
  constraint social_accounts_user_handle unique (user_id, platform, handle)
);

create index if not exists social_accounts_user_id_idx on public.social_accounts (user_id);

create table if not exists public.social_metrics (
  id uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  follower_count bigint,
  median_video_views numeric,
  average_video_views numeric,
  engagement_rate numeric,
  average_watch_time_seconds numeric,
  average_video_duration_seconds numeric,
  metrics_window text,
  collected_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'api')),
  constraint social_metrics_followers_nonneg check (follower_count is null or follower_count >= 0),
  constraint social_metrics_median_nonneg check (median_video_views is null or median_video_views >= 0),
  constraint social_metrics_avg_views_nonneg check (average_video_views is null or average_video_views >= 0),
  constraint social_metrics_engagement_range check (engagement_rate is null or (engagement_rate >= 0 and engagement_rate <= 100)),
  constraint social_metrics_watch_nonneg check (average_watch_time_seconds is null or average_watch_time_seconds >= 0),
  constraint social_metrics_duration_nonneg check (average_video_duration_seconds is null or average_video_duration_seconds >= 0),
  constraint social_metrics_window_len check (metrics_window is null or char_length(metrics_window) <= 80)
);

create index if not exists social_metrics_account_collected_idx
  on public.social_metrics (social_account_id, collected_at desc);
create index if not exists social_metrics_user_id_idx on public.social_metrics (user_id);

create table if not exists public.audience_demographics (
  id uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  country_breakdown jsonb not null default '[]'::jsonb,
  age_breakdown jsonb not null default '[]'::jsonb,
  gender_breakdown jsonb not null default '[]'::jsonb,
  collected_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'api')),
  constraint audience_country_is_array check (jsonb_typeof(country_breakdown) = 'array'),
  constraint audience_age_is_array check (jsonb_typeof(age_breakdown) = 'array'),
  constraint audience_gender_is_array check (jsonb_typeof(gender_breakdown) = 'array')
);

create index if not exists audience_demographics_account_collected_idx
  on public.audience_demographics (social_account_id, collected_at desc);
create index if not exists audience_demographics_user_id_idx on public.audience_demographics (user_id);

create table if not exists public.sponsorship_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  compensation_preference text not null default 'flat_fee'
    check (compensation_preference in ('flat_fee', 'hybrid', 'affiliate_allowed')),
  minimum_guaranteed_fee numeric,
  preferred_currency text not null default 'USD',
  accepts_gifted_only boolean not null default false,
  accepts_affiliate_links boolean not null default false,
  accepts_commission_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sponsorship_min_fee_nonneg check (minimum_guaranteed_fee is null or minimum_guaranteed_fee >= 0),
  constraint sponsorship_currency_len check (char_length(preferred_currency) between 3 and 8)
);

drop trigger if exists creator_profiles_set_updated_at on public.creator_profiles;
create trigger creator_profiles_set_updated_at
before update on public.creator_profiles
for each row execute function public.set_updated_at();

drop trigger if exists social_accounts_set_updated_at on public.social_accounts;
create trigger social_accounts_set_updated_at
before update on public.social_accounts
for each row execute function public.set_updated_at();

drop trigger if exists sponsorship_preferences_set_updated_at on public.sponsorship_preferences;
create trigger sponsorship_preferences_set_updated_at
before update on public.sponsorship_preferences
for each row execute function public.set_updated_at();

drop trigger if exists social_metrics_sync_owner on public.social_metrics;
create trigger social_metrics_sync_owner
before insert or update on public.social_metrics
for each row execute function public.sync_child_social_owner();

drop trigger if exists audience_demographics_sync_owner on public.audience_demographics;
create trigger audience_demographics_sync_owner
before insert or update on public.audience_demographics
for each row execute function public.sync_child_social_owner();

alter table public.creator_profiles enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_metrics enable row level security;
alter table public.audience_demographics enable row level security;
alter table public.sponsorship_preferences enable row level security;

drop policy if exists creator_profiles_select on public.creator_profiles;
drop policy if exists creator_profiles_insert on public.creator_profiles;
drop policy if exists creator_profiles_update on public.creator_profiles;
drop policy if exists creator_profiles_delete on public.creator_profiles;
create policy creator_profiles_select on public.creator_profiles for select to authenticated using (auth.uid() = user_id);
create policy creator_profiles_insert on public.creator_profiles for insert to authenticated with check (auth.uid() = user_id);
create policy creator_profiles_update on public.creator_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy creator_profiles_delete on public.creator_profiles for delete to authenticated using (auth.uid() = user_id);

drop policy if exists social_accounts_select on public.social_accounts;
drop policy if exists social_accounts_insert on public.social_accounts;
drop policy if exists social_accounts_update on public.social_accounts;
drop policy if exists social_accounts_delete on public.social_accounts;
create policy social_accounts_select on public.social_accounts for select to authenticated using (auth.uid() = user_id);
create policy social_accounts_insert on public.social_accounts for insert to authenticated with check (auth.uid() = user_id);
create policy social_accounts_update on public.social_accounts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy social_accounts_delete on public.social_accounts for delete to authenticated using (auth.uid() = user_id);

drop policy if exists social_metrics_select on public.social_metrics;
drop policy if exists social_metrics_insert on public.social_metrics;
drop policy if exists social_metrics_update on public.social_metrics;
drop policy if exists social_metrics_delete on public.social_metrics;
create policy social_metrics_select on public.social_metrics
  for select to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.social_accounts accounts
      where accounts.id = social_account_id and accounts.user_id = auth.uid()
    )
  );
create policy social_metrics_insert on public.social_metrics
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.social_accounts accounts
      where accounts.id = social_account_id and accounts.user_id = auth.uid()
    )
  );
create policy social_metrics_update on public.social_metrics
  for update to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.social_accounts accounts
      where accounts.id = social_account_id and accounts.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.social_accounts accounts
      where accounts.id = social_account_id and accounts.user_id = auth.uid()
    )
  );
create policy social_metrics_delete on public.social_metrics
  for delete to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.social_accounts accounts
      where accounts.id = social_account_id and accounts.user_id = auth.uid()
    )
  );

drop policy if exists audience_demographics_select on public.audience_demographics;
drop policy if exists audience_demographics_insert on public.audience_demographics;
drop policy if exists audience_demographics_update on public.audience_demographics;
drop policy if exists audience_demographics_delete on public.audience_demographics;
create policy audience_demographics_select on public.audience_demographics
  for select to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.social_accounts accounts
      where accounts.id = social_account_id and accounts.user_id = auth.uid()
    )
  );
create policy audience_demographics_insert on public.audience_demographics
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.social_accounts accounts
      where accounts.id = social_account_id and accounts.user_id = auth.uid()
    )
  );
create policy audience_demographics_update on public.audience_demographics
  for update to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.social_accounts accounts
      where accounts.id = social_account_id and accounts.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.social_accounts accounts
      where accounts.id = social_account_id and accounts.user_id = auth.uid()
    )
  );
create policy audience_demographics_delete on public.audience_demographics
  for delete to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.social_accounts accounts
      where accounts.id = social_account_id and accounts.user_id = auth.uid()
    )
  );

drop policy if exists sponsorship_preferences_select on public.sponsorship_preferences;
drop policy if exists sponsorship_preferences_insert on public.sponsorship_preferences;
drop policy if exists sponsorship_preferences_update on public.sponsorship_preferences;
drop policy if exists sponsorship_preferences_delete on public.sponsorship_preferences;
create policy sponsorship_preferences_select on public.sponsorship_preferences for select to authenticated using (auth.uid() = user_id);
create policy sponsorship_preferences_insert on public.sponsorship_preferences for insert to authenticated with check (auth.uid() = user_id);
create policy sponsorship_preferences_update on public.sponsorship_preferences for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sponsorship_preferences_delete on public.sponsorship_preferences for delete to authenticated using (auth.uid() = user_id);

revoke all on public.creator_profiles from anon;
revoke all on public.social_accounts from anon;
revoke all on public.social_metrics from anon;
revoke all on public.audience_demographics from anon;
revoke all on public.sponsorship_preferences from anon;

grant select, insert, update, delete on public.creator_profiles to authenticated;
grant select, insert, update, delete on public.social_accounts to authenticated;
grant select, insert, update, delete on public.social_metrics to authenticated;
grant select, insert, update, delete on public.audience_demographics to authenticated;
grant select, insert, update, delete on public.sponsorship_preferences to authenticated;
