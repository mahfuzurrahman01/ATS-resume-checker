-- 0004_scan_match_split.sql
-- Split the single `scans` table into resumes + scans + matches, and add an
-- append-only credit_ledger as the source of truth for credit balances.
--
-- The old `scans` table is RENAMED to `scans_legacy_v1` (not dropped). A later
-- migration (0005) drops it once the backfill is verified.
--
-- Verify after applying (must be TRUE for every user):
--   SELECT c.user_id,
--          c.balance,
--          coalesce(sum(l.delta), 0) AS ledger_sum
--   FROM public.credits c
--   LEFT JOIN public.credit_ledger l ON l.user_id = c.user_id
--   GROUP BY c.user_id, c.balance
--   HAVING c.balance <> coalesce(sum(l.delta), 0);
-- (should return zero rows)

begin;

-- ---------------------------------------------------------------------------
-- 1. Preserve the old table
-- ---------------------------------------------------------------------------
alter table public.scans rename to scans_legacy_v1;

-- ---------------------------------------------------------------------------
-- 2. New tables
-- ---------------------------------------------------------------------------
create table public.resumes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  file_hash      text not null,
  file_name      text not null,
  display_name   text,
  storage_path   text not null,
  page_count     integer,
  has_text_layer boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (user_id, file_hash)
);

create table public.scans (
  id             uuid primary key default gen_random_uuid(),
  resume_id      uuid not null references public.resumes (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  score          integer not null,
  subscores      jsonb not null,
  result         jsonb not null,
  model_version  text not null,
  prompt_version text not null,
  created_at     timestamptz not null default now()
);

create table public.matches (
  id             uuid primary key default gen_random_uuid(),
  resume_id      uuid not null references public.resumes (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  jd_text        text not null,
  jd_hash        text not null,
  job_title      text,
  company        text,
  match_score    integer not null,
  result         jsonb not null,
  model_version  text not null,
  prompt_version text not null,
  created_at     timestamptz not null default now()
);

create table public.credit_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  delta         integer not null,             -- negative = spend, positive = grant/refund
  reason        text not null,                -- signup_bonus|monthly_topup|scan|match|refund|purchase|migration_opening_balance
  ref_type      text,                         -- scan|match|payment|null
  ref_id        uuid,
  balance_after integer not null,             -- snapshot for fast reads + audit
  created_at    timestamptz not null default now()
);

-- Indexes
create index resumes_user_created_idx on public.resumes (user_id, created_at desc);
create index scans_resume_idx on public.scans (resume_id);
create index matches_resume_idx on public.matches (resume_id);
create index credit_ledger_user_created_idx
  on public.credit_ledger (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security — users may only SELECT their own rows.
--    All writes go through the service role (bypasses RLS) or the SECURITY
--    DEFINER credit functions below. No user-facing INSERT/UPDATE/DELETE.
-- ---------------------------------------------------------------------------
alter table public.resumes       enable row level security;
alter table public.scans         enable row level security;
alter table public.matches       enable row level security;
alter table public.credit_ledger enable row level security;

create policy "resumes: read own"       on public.resumes       for select using (auth.uid() = user_id);
create policy "scans: read own"          on public.scans         for select using (auth.uid() = user_id);
create policy "matches: read own"        on public.matches       for select using (auth.uid() = user_id);
create policy "credit_ledger: read own"  on public.credit_ledger for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Credit functions — the ONLY way credits.balance is ever written.
--    Balance is updated in the same transaction as the ledger insert.
-- ---------------------------------------------------------------------------
create or replace function public.spend_credits(
  p_user_id  uuid,
  p_amount   integer,
  p_reason   text,
  p_ref_type text,
  p_ref_id   uuid
) returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance  integer;
  v_lifetime boolean;
  v_new      integer;
begin
  select balance, is_lifetime
    into v_balance, v_lifetime
    from public.credits
    where user_id = p_user_id
    for update;

  if not found then
    raise exception 'no_credits_row for user %', p_user_id;
  end if;

  -- Lifetime = unlimited: no deduction and no ledger row, which keeps the
  -- invariant balance = sum(delta) intact for these accounts.
  if v_lifetime then
    return v_balance;
  end if;

  if v_balance < p_amount then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  v_new := v_balance - p_amount;

  update public.credits
    set balance = v_new, updated_at = now()
    where user_id = p_user_id;

  insert into public.credit_ledger
    (user_id, delta, reason, ref_type, ref_id, balance_after)
  values
    (p_user_id, -p_amount, p_reason, p_ref_type, p_ref_id, v_new);

  return v_new;
end;
$$;

create or replace function public.grant_credits(
  p_user_id  uuid,
  p_amount   integer,
  p_reason   text,
  p_ref_type text,
  p_ref_id   uuid
) returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance integer;
  v_new     integer;
begin
  select balance
    into v_balance
    from public.credits
    where user_id = p_user_id
    for update;

  if not found then
    raise exception 'no_credits_row for user %', p_user_id;
  end if;

  v_new := v_balance + p_amount;

  update public.credits
    set balance = v_new, updated_at = now()
    where user_id = p_user_id;

  insert into public.credit_ledger
    (user_id, delta, reason, ref_type, ref_id, balance_after)
  values
    (p_user_id, p_amount, p_reason, p_ref_type, p_ref_id, v_new);

  return v_new;
end;
$$;

-- Lock the functions down: only the service role may call them.
revoke execute on function public.spend_credits(uuid, integer, text, text, uuid) from public;
revoke execute on function public.grant_credits(uuid, integer, text, text, uuid) from public;
grant execute on function public.spend_credits(uuid, integer, text, text, uuid) to service_role;
grant execute on function public.grant_credits(uuid, integer, text, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Route the signup bonus through the ledger so new users also satisfy
--    balance = sum(delta). (Replaces the direct balance=10 insert from 0003.)
-- ---------------------------------------------------------------------------
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

  insert into public.credits (user_id, balance, last_free_topup_at)
  values (new.id, 0, now())
  on conflict (user_id) do nothing;

  perform public.grant_credits(new.id, 10, 'signup_bonus', null, null);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Data backfill from scans_legacy_v1
-- ---------------------------------------------------------------------------

-- 6a. One resume per (user_id, file_hash). Synthesize a hash for legacy rows
--     that never captured one, and a conventional storage path when missing.
insert into public.resumes (user_id, file_hash, file_name, storage_path, created_at)
select distinct on (l.user_id, l.fh)
  l.user_id,
  l.fh,
  coalesce(l.file_name, 'resume.pdf'),
  coalesce(l.storage_path, l.user_id::text || '/' || l.fh || '.pdf'),
  l.created_at
from (
  select *, coalesce(file_hash, 'legacy-' || id::text) as fh
  from public.scans_legacy_v1
) l
order by l.user_id, l.fh, l.created_at asc
on conflict (user_id, file_hash) do nothing;

-- 6b. Legacy rows without a JD become scans.
insert into public.scans
  (resume_id, user_id, score, subscores, result, model_version, prompt_version, created_at)
select
  r.id,
  l.user_id,
  coalesce(l.score, 0),
  '{}'::jsonb,
  coalesce(l.result, '{}'::jsonb),
  'gemini-2.5-flash',
  'legacy',
  l.created_at
from (
  select *, coalesce(file_hash, 'legacy-' || id::text) as fh
  from public.scans_legacy_v1
  where coalesce(jd_provided, false) = false
) l
join public.resumes r
  on r.user_id = l.user_id and r.file_hash = l.fh;

-- 6c. Legacy rows with a JD become matches (we never stored the JD text).
insert into public.matches
  (resume_id, user_id, jd_text, jd_hash, job_title, company, match_score, result, model_version, prompt_version, created_at)
select
  r.id,
  l.user_id,
  '',
  'legacy',
  l.result -> 'jd_match' ->> 'job_title',
  null,
  coalesce(nullif(l.result -> 'jd_match' ->> 'match_score', '')::int, 0),
  coalesce(l.result, '{}'::jsonb),
  'gemini-2.5-flash',
  'legacy',
  l.created_at
from (
  select *, coalesce(file_hash, 'legacy-' || id::text) as fh
  from public.scans_legacy_v1
  where coalesce(jd_provided, false) = true
) l
join public.resumes r
  on r.user_id = l.user_id and r.file_hash = l.fh;

-- 6d. Seed the ledger with each existing user's opening balance so that
--     sum(delta) equals credits.balance from day one.
insert into public.credit_ledger
  (user_id, delta, reason, ref_type, ref_id, balance_after)
select user_id, balance, 'migration_opening_balance', null, null, balance
from public.credits;

commit;
