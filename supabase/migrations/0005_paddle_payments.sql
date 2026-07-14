-- =============================================================================
-- Repurpose `payments` for Paddle. The table was created for Stripe in 0001
-- and never wired into any code path — safe to redefine columns outright.
--
-- Idempotency: `paddle_event_id` is UNIQUE. The webhook handler inserts a row
-- here (which fails on conflict for a redelivered event) in the same
-- transaction as the grant_credits() call, so a Paddle retry is a no-op
-- instead of a double-grant.
-- =============================================================================

drop table if exists public.payments;

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  paddle_event_id     text not null unique,
  paddle_transaction_id text not null,
  paddle_price_id     text not null,
  amount_cents        integer not null,
  currency_code       text not null,
  credits_granted     integer not null default 0,
  created_at          timestamptz not null default now()
);

create index payments_user_id_idx on public.payments (user_id);

alter table public.payments enable row level security;

create policy "payments: read own" on public.payments for select using (auth.uid() = user_id);

-- Only the service role (webhook handler) ever writes payments.
revoke insert, update, delete on public.payments from authenticated, anon;
