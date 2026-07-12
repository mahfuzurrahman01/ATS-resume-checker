-- ATS Resume Checker — initial schema
-- Run in the Supabase SQL editor (or via the Supabase CLI).

-- =========================================================================
-- profiles: 1:1 with auth.users, holds public profile info
-- =========================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- =========================================================================
-- credits: paid balance + lifetime flag, 1:1 with a user
-- =========================================================================
create table if not exists public.credits (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  balance      integer not null default 0 check (balance >= 0),
  is_lifetime  boolean not null default false,
  updated_at   timestamptz not null default now()
);

-- =========================================================================
-- scans: analysis history (both free basic + paid detailed)
-- =========================================================================
create table if not exists public.scans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  score        integer,
  is_detailed  boolean not null default false,
  jd_provided  boolean not null default false,
  file_hash    text,
  result       jsonb
);
create index if not exists scans_user_created_idx
  on public.scans (user_id, created_at desc);

-- =========================================================================
-- payments: Stripe one-time purchases (credit packs / lifetime)
-- =========================================================================
create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  stripe_session_id  text unique,
  amount_cents       integer,
  credits_granted    integer not null default 0,
  is_lifetime        boolean not null default false,
  created_at         timestamptz not null default now()
);

-- =========================================================================
-- Auto-provision profile + credits row when a new auth user signs up.
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.credits (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- Row Level Security — users can only read/write their own rows.
-- Privileged writes (granting credits) use the service-role key, which
-- bypasses RLS.
-- =========================================================================
alter table public.profiles enable row level security;
alter table public.credits  enable row level security;
alter table public.scans    enable row level security;
alter table public.payments enable row level security;

create policy "profiles: read own"  on public.profiles for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id);

create policy "credits: read own"   on public.credits  for select using (auth.uid() = user_id);

create policy "scans: read own"     on public.scans    for select using (auth.uid() = user_id);
create policy "scans: insert own"   on public.scans    for insert with check (auth.uid() = user_id);

create policy "payments: read own"  on public.payments for select using (auth.uid() = user_id);
