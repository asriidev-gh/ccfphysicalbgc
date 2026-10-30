-- Supabase exposes the public schema through its PostgREST/GraphQL API using the anon/authenticated roles.
-- This app never uses that API: it reaches Postgres only through Prisma as a privileged role (which bypasses RLS).
-- Enabling RLS with NO policies makes every table invisible to anon/authenticated clients.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
