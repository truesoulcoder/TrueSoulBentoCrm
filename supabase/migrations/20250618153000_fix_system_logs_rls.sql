-- supabase/migrations/20250618153000_fix_system_logs_rls.sql

-- First, ensure RLS is enabled on the table.
ALTER TABLE public.system_event_logs ENABLE ROW LEVEL SECURITY;

-- Drop the policy if it already exists to make this script idempotent.
DROP POLICY IF EXISTS "Allow service_role full access to system logs" ON public.system_event_logs;

-- Create a permissive policy specifically for the 'service_role'.
-- The service_role is used by server-side clients (like in our API routes)
-- and should have unrestricted access to write logs.
CREATE POLICY "Allow service_role full access to system logs"
ON public.system_event_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- It can also be beneficial to allow authenticated users to read logs,
-- which is necessary for the Campaign Console to fetch and display them.
DROP POLICY IF EXISTS "Allow authenticated users to read logs" ON public.system_event_logs;
CREATE POLICY "Allow authenticated users to read logs"
ON public.system_event_logs
FOR SELECT
TO authenticated
USING (true);