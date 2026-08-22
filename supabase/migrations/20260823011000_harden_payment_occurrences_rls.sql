alter table public.payment_occurrences enable row level security;

drop policy if exists "payment_occurrences_delete_own" on public.payment_occurrences;
create policy "payment_occurrences_delete_own"
  on public.payment_occurrences
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Keep money/status data within valid ranges without changing existing rows.
alter table public.payment_occurrences
  drop constraint if exists payment_occurrences_paid_amount_nonnegative;
alter table public.payment_occurrences
  add constraint payment_occurrences_paid_amount_nonnegative
  check (paid_amount >= 0);

alter table public.payment_occurrences
  drop constraint if exists payment_occurrences_amount_nonnegative;
alter table public.payment_occurrences
  add constraint payment_occurrences_amount_nonnegative
  check (amount is null or amount >= 0);

alter table public.payment_occurrences
  drop constraint if exists payment_occurrences_status_valid;
alter table public.payment_occurrences
  add constraint payment_occurrences_status_valid
  check (status in ('unpaid', 'partial', 'paid'));

create index if not exists payment_occurrences_user_due_date_idx
  on public.payment_occurrences (user_id, due_date);
