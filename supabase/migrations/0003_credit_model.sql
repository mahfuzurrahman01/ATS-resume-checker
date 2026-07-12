-- Credit model: 10-credit signup bonus + monthly free top-up (lazy).

-- Track when the user last received a free monthly top-up.
alter table public.credits
  add column if not exists last_free_topup_at timestamptz;

-- New users get 10 free credits (no expiry) and start the monthly clock.
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
  values (new.id, 10, now())
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Start the monthly clock for any existing users so they become eligible.
update public.credits
set last_free_topup_at = coalesce(last_free_topup_at, now());
