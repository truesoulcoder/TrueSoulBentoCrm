-- supabase/migrations/20250613023300_create_rbac_helpers.sql

-- Helper function to extract a specific claim from the JWT.
-- This is more secure and performant than checking the profiles table.
create or replace function public.get_my_claim(claim TEXT)
returns jsonb
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> claim, null)::jsonb;
$$;

-- Helper function to check if the current user is a superadmin based on their JWT claim.
create or replace function public.is_claims_admin()
returns boolean
language plpgsql
stable
as $$
  begin
    -- The user_role claim is wrapped in JSON, so we extract it as text.
    return (get_my_claim('user_role') ->> 0) = '"superadmin"';
  end;
$$;

-- 1. Enable RLS for the properties table
alter table public.properties enable row level security;

-- 2. Drop existing policies if they exist, to prevent conflicts during re-runs
drop policy if exists "Super-admins can do anything" on public.properties;
drop policy if exists "Users can only see their own properties" on public.properties;

-- 3. Policy for Super Admins: Can perform any action on any property.
create policy "Super-admins can do anything"
on public.properties
for all
using (is_claims_admin());

-- 4. Policy for regular users: By default, they can see/modify properties they own (based on user_id).
-- This provides a secure default. We will expand on this for lead assignment.
create policy "Users can only see their own properties"
on public.properties
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);