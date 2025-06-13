-- supabase/migrations/20250613023600_fix_rbac_functions.sql

-- Drop the old, flawed helper functions
DROP FUNCTION IF EXISTS public.get_my_claim(TEXT);
DROP FUNCTION IF EXISTS public.is_claims_admin();

-- Create a new, corrected helper function to get the user's role from the JWT.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
DECLARE
  claim_value TEXT;
BEGIN
  -- This securely extracts the 'user_role' claim from the currently authenticated user's JWT.
  -- The claim is stored as a JSON string (e.g., "\"superadmin\""), so we use trim to remove the quotes.
  SELECT trim(BOTH '"' FROM (current_setting('request.jwt.claims', true)::jsonb ->> 'user_role'))
  INTO claim_value;
  
  RETURN claim_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the policies on the 'properties' table using the new, correct function.

-- 1. Drop the old policies first to ensure a clean slate.
DROP POLICY IF EXISTS "Super-admins can do anything" ON public.properties;
DROP POLICY IF EXISTS "Users can only see their own properties" ON public.properties;

-- 2. Create the new policy for Super Admins.
CREATE POLICY "Super-admins can do anything"
ON public.properties
FOR ALL
USING (get_my_role() = 'superadmin');

-- 3. Create the policy for non-admin users.
CREATE POLICY "Users can only see their own properties"
ON public.properties
FOR ALL
USING (auth.uid() = user_id);