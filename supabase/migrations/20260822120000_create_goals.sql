-- Non-destructive Goals storage with authenticated owner isolation.
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'ทั่วไป',
  status text NOT NULL DEFAULT 'not_started',
  progress integer NOT NULL DEFAULT 0,
  priority text NOT NULL DEFAULT 'medium',
  start_date date,
  deadline date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS goals_user_status_idx ON public.goals (user_id, status);
CREATE INDEX IF NOT EXISTS goals_user_deadline_idx ON public.goals (user_id, deadline);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'goals' AND policyname = 'goals_select_own') THEN
    CREATE POLICY goals_select_own ON public.goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'goals' AND policyname = 'goals_insert_own') THEN
    CREATE POLICY goals_insert_own ON public.goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'goals' AND policyname = 'goals_update_own') THEN
    CREATE POLICY goals_update_own ON public.goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'goals' AND policyname = 'goals_delete_own') THEN
    CREATE POLICY goals_delete_own ON public.goals FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END
$$;
