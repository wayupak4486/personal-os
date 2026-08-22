-- Grant only the existing Today modules' read/write privileges to authenticated users.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.sleep_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.sleep_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_occurrences TO authenticated;
