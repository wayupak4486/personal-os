-- Keep sleep_logs private to the authenticated owner of each row.
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sleep_logs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sleep_logs', policy_record.policyname);
  END LOOP;
END
$$;

CREATE POLICY sleep_logs_select_own
  ON public.sleep_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY sleep_logs_insert_own
  ON public.sleep_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY sleep_logs_update_own
  ON public.sleep_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);