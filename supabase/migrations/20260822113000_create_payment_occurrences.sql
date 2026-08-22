-- Non-destructive payment storage for monthly personal expenses.
CREATE TABLE IF NOT EXISTS public.payment_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  billing_month date NOT NULL,
  category text NOT NULL,
  amount numeric(12, 2),
  paid_amount numeric(12, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid',
  due_date date,
  paid_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_occurrences ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS payment_occurrences_user_month_idx
  ON public.payment_occurrences (user_id, billing_month DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payment_occurrences'
      AND policyname = 'payment_occurrences_select_own'
  ) THEN
    CREATE POLICY payment_occurrences_select_own ON public.payment_occurrences
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payment_occurrences'
      AND policyname = 'payment_occurrences_insert_own'
  ) THEN
    CREATE POLICY payment_occurrences_insert_own ON public.payment_occurrences
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payment_occurrences'
      AND policyname = 'payment_occurrences_update_own'
  ) THEN
    CREATE POLICY payment_occurrences_update_own ON public.payment_occurrences
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;
