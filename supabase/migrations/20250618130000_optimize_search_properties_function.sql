-- supabase/migrations/20250618130000_optimize_search_properties_function.sql

-- Drop the old, inefficient function.
DROP FUNCTION IF EXISTS public.search_properties_with_contacts(text);

-- Create the new, optimized function.
-- This version uses a more efficient subquery for contact aggregation,
-- avoiding a costly double-join on the properties table.
CREATE OR REPLACE FUNCTION public.search_properties_with_contacts(search_term text)
RETURNS SETOF properties_with_contacts AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.*,  -- Selects all columns from the properties table
    pc.contact_count,
    pc.contact_emails,
    pc.contact_names,
    pc.contact_phones
  FROM
    public.properties AS p
  LEFT JOIN (
    -- This subquery aggregates contact info per property.
    SELECT
      c.property_id,
      count(c.contact_id) as contact_count,
      string_agg(DISTINCT c.name, ', ') AS contact_names,
      string_agg(DISTINCT c.email, ', ') AS contact_emails,
      string_agg(DISTINCT c.phone, ', ') AS contact_phones
    FROM
      public.contacts AS c
    GROUP BY
      c.property_id
  ) AS pc ON p.property_id = pc.property_id
  WHERE
    -- The search logic remains the same.
    search_term IS NULL OR search_term = '' OR (
      pc.contact_names ILIKE '%' || search_term || '%'
      OR p.property_address ILIKE '%' || search_term || '%'
      OR p.property_city ILIKE '%' || search_term || '%'
      OR p.status::text ILIKE '%' || search_term || '%'
    );
END;
$$ LANGUAGE plpgsql;