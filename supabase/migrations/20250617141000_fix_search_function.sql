DROP FUNCTION IF EXISTS public.search_properties_with_contacts(text);

CREATE OR REPLACE FUNCTION public.search_properties_with_contacts(search_term text)
RETURNS SETOF properties_with_contacts AS $$
BEGIN
  RETURN QUERY
    WITH property_contacts AS (
      SELECT
        p.property_id,
        string_agg(DISTINCT c.name, ', ') AS contact_names,
        string_agg(DISTINCT c.email, ', ') AS contact_emails,
        string_agg(DISTINCT c.phone, ', ') AS contact_phones,
        count(c.contact_id) as contact_count
      FROM
        public.properties p
      LEFT JOIN
        public.contacts c ON p.property_id = c.property_id
      GROUP BY
        p.property_id
    )
    SELECT
      p.*, -- This is the key fix to ensure all columns from properties are included
      pc.contact_count,
      pc.contact_emails,
      pc.contact_names,
      pc.contact_phones
    FROM
      public.properties p
    JOIN
      property_contacts pc ON p.property_id = pc.property_id
    WHERE
      search_term IS NULL OR search_term = '' OR (
        pc.contact_names ILIKE '%' || search_term || '%'
        OR p.property_address ILIKE '%' || search_term || '%'
        OR p.property_city ILIKE '%' || search_term || '%'
        OR p.status::text ILIKE '%' || search_term || '%'
      );
END;
$$ LANGUAGE plpgsql;

-- Note: This migration assumes 'properties_with_contacts' is a VIEW or TYPE that mirrors
-- the 'properties' table structure plus the four contact-related fields.
-- If the view/type itself is incorrect, it will also need to be updated.
-- This change makes the function resilient to new columns being added to 'properties'.
