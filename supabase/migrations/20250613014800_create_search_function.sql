-- supabase/migrations/20250613014800_create_search_function.sql

-- Drop the old function that was using the slow view.
DROP FUNCTION IF EXISTS search_properties_with_contacts(text);

-- Create the new, optimized function to replace the slow 'properties_with_contacts' view logic.
-- This function queries the base tables directly and performs the search and aggregation in a single, efficient pass.
CREATE OR REPLACE FUNCTION search_properties_with_contacts(search_term text)
RETURNS SETOF properties_with_contacts AS $$
BEGIN
  RETURN QUERY
    -- This CTE aggregates contact information for each property.
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
    -- The main query joins the base properties table with the aggregated contact info.
    SELECT
      p.assessed_total,
      p.assessed_year,
      p.avm,
      p.baths,
      p.beds,
      pc.contact_count,
      pc.contact_emails,
      pc.contact_names,
      pc.contact_phones,
      p.created_at,
      p.lot_size_sqft,
      p.market_region,
      p.market_value,
      p.mls_baths,
      p.mls_beds,
      p.mls_days_on_market,
      p.mls_garage,
      p.mls_list_date,
      p.mls_list_price,
      p.mls_listing_id,
      p.mls_photos,
      p.mls_price_per_sqft,
      p.mls_sale_price,
      p.mls_sold_date,
      p.mls_sqft,
      p.mls_status,
      p.mls_year_built,
      p.notes,
      p.owner_type,
      p.price_per_sqft,
      p.property_address,
      p.property_city,
      p.property_id,
      p.property_postal_code,
      p.property_state,
      p.property_type,
      p.square_footage,
      p.status,
      p.updated_at,
      p.user_id,
      p.wholesale_value,
      p.year_built
    FROM
      public.properties p
    JOIN
      property_contacts pc ON p.property_id = pc.property_id
    -- The WHERE clause now efficiently searches across the aggregated contact names and property details.
    WHERE
      search_term IS NULL OR search_term = '' OR (
        pc.contact_names ILIKE '%' || search_term || '%' OR
        p.property_address ILIKE '%' || search_term || '%' OR
        p.property_city ILIKE '%' || search_term || '%' OR
        p.status::text ILIKE '%' || search_term || '%'
      );
END;
$$ LANGUAGE plpgsql;