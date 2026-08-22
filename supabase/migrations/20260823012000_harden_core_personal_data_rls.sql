-- Final owner-isolation pass for core personal data tables already used by the app.
-- All policies are intentionally based on auth.uid() = user_id.

alter table public.tasks enable row level security;
drop policy if exists tasks_select_own on public.tasks;
drop policy if exists tasks_insert_own on public.tasks;
drop policy if exists tasks_update_own on public.tasks;
drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_select_own on public.tasks for select to authenticated using (auth.uid() = user_id);
create policy tasks_insert_own on public.tasks for insert to authenticated with check (auth.uid() = user_id);
create policy tasks_update_own on public.tasks for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tasks_delete_own on public.tasks for delete to authenticated using (auth.uid() = user_id);
create index if not exists tasks_user_due_date_idx on public.tasks (user_id, due_date);

alter table public.workout_sessions enable row level security;
drop policy if exists workout_sessions_select_own on public.workout_sessions;
drop policy if exists workout_sessions_insert_own on public.workout_sessions;
drop policy if exists workout_sessions_update_own on public.workout_sessions;
drop policy if exists workout_sessions_delete_own on public.workout_sessions;
create policy workout_sessions_select_own on public.workout_sessions for select to authenticated using (auth.uid() = user_id);
create policy workout_sessions_insert_own on public.workout_sessions for insert to authenticated with check (auth.uid() = user_id);
create policy workout_sessions_update_own on public.workout_sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy workout_sessions_delete_own on public.workout_sessions for delete to authenticated using (auth.uid() = user_id);
create index if not exists workout_sessions_user_date_idx on public.workout_sessions (user_id, workout_date desc);

alter table public.sleep_logs enable row level security;
drop policy if exists sleep_logs_select_own on public.sleep_logs;
drop policy if exists sleep_logs_insert_own on public.sleep_logs;
drop policy if exists sleep_logs_update_own on public.sleep_logs;
drop policy if exists sleep_logs_delete_own on public.sleep_logs;
create policy sleep_logs_select_own on public.sleep_logs for select to authenticated using (auth.uid() = user_id);
create policy sleep_logs_insert_own on public.sleep_logs for insert to authenticated with check (auth.uid() = user_id);
create policy sleep_logs_update_own on public.sleep_logs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sleep_logs_delete_own on public.sleep_logs for delete to authenticated using (auth.uid() = user_id);
create index if not exists sleep_logs_user_created_at_idx on public.sleep_logs (user_id, created_at desc);

alter table public.sleep_settings enable row level security;
drop policy if exists sleep_settings_select_own on public.sleep_settings;
drop policy if exists sleep_settings_insert_own on public.sleep_settings;
drop policy if exists sleep_settings_update_own on public.sleep_settings;
drop policy if exists sleep_settings_delete_own on public.sleep_settings;
create policy sleep_settings_select_own on public.sleep_settings for select to authenticated using (auth.uid() = user_id);
create policy sleep_settings_insert_own on public.sleep_settings for insert to authenticated with check (auth.uid() = user_id);
create policy sleep_settings_update_own on public.sleep_settings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sleep_settings_delete_own on public.sleep_settings for delete to authenticated using (auth.uid() = user_id);
