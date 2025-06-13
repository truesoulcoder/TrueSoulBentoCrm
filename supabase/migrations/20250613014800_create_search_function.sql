-- supabase/migrations/20250613014800_create_search_function.sql
CREATE OR REPLACE FUNCTION search_properties_with_contacts(search_term text)
RETURNS SETOF properties_with_contacts AS $$
BEGIN
  RETURN QUERY
    SELECT *
    FROM public.properties_with_contacts
    WHERE
      search_term IS NULL OR search_term = '' OR (
        contact_names ILIKE '%' || search_term || '%' OR
        property_address ILIKE '%' || search_term || '%' OR
        property_city ILIKE '%' || search_term || '%' OR
        status::text ILIKE '%' || search_term || '%'
      );
END;
$$ LANGUAGE plpgsql;