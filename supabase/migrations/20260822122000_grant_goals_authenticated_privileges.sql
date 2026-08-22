-- Grant only the table privileges required by the authenticated Goals client.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.goals TO authenticated;
