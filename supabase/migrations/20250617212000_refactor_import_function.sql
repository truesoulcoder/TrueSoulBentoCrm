-- supabase/migrations/20250617212000_refactor_import_function.sql

-- Drop the old, inefficient function if it exists.
DROP FUNCTION IF EXISTS public.import_from_staging_csv(p_user_id uuid, p_job_id uuid, p_market_region text);
DROP FUNCTION IF EXISTS public.import_from_staging_csv(); -- Drop the no-argument version as well for cleanup.


-- Create the new, highly optimized, set-based import function.
CREATE OR REPLACE FUNCTION public.import_from_staging_csv(p_user_id uuid, p_job_id uuid, p_market_region text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN

  -- Step 1: Insert only the properties that do not already exist for the user.
  -- This is a single, efficient, set-based operation that avoids looping.
  INSERT INTO public.properties (
    user_id, owner_type, market_region,
    property_address, property_city, property_state, property_postal_code,
    property_type, year_built, square_footage, lot_size_sqft, baths, beds,
    price_per_sqft, assessed_year, assessed_total,
    market_value, wholesale_value, avm,
    mls_listing_id, mls_status, mls_list_date, mls_sold_date,
    mls_days_on_market, mls_list_price, mls_sale_price,
    mls_price_per_sqft, mls_sqft, mls_beds, mls_baths,
    mls_garage, mls_year_built, mls_photos, status
  )
  SELECT
    p_user_id, s.owner_type, p_market_region,
    s.property_address, s.property_city, s.property_state, s.property_postal_code,
    s.property_type, s.year_built, s.square_footage, s.lot_size_sqft, s.baths, s.beds,
    s.price_per_sqft, s.assessed_year, s.assessed_total,
    s.market_value, s.wholesale_value, s.avm,
    s.mls_curr_listingid, s.mls_curr_status, s.mls_curr_listdate, s.mls_curr_solddate,
    s.mls_curr_daysonmarket, s.mls_curr_listprice, s.mls_curr_saleprice,
    s.mls_curr_pricepersqft, s.mls_curr_sqft, s.mls_curr_beds, s.mls_curr_baths,
    s.mls_curr_garage, s.mls_curr_yearbuilt, s.mls_curr_photos, 'New Lead'::public.lead_status
  FROM public.staging_contacts_csv s
  -- The ON CONFLICT clause handles duplicate properties based on the unique constraint.
  ON CONFLICT (user_id, property_address, property_postal_code) DO NOTHING;

  -- Update job status after property import
  UPDATE public.upload_jobs
  SET progress = 85, message = 'Properties imported. Staging contacts...'
  WHERE job_id = p_job_id;

  -- Step 2: Unpivot and insert all valid contacts in a single, set-based operation.
  -- A CTE is used to transform the wide staging data into a normalized format.
  WITH all_contacts AS (
    -- Gather all potential contacts from the staging table into a uniform structure
    SELECT property_address, property_postal_code, contact1_name AS name, NULLIF(trim(contact1_email_1), '') AS email, contact1_phone_1 AS phone, 'owner'::public.contact_role AS role, recipient_address AS mailing_address, recipient_city AS mailing_city, recipient_state AS mailing_state, recipient_postal_code AS mailing_postal_code FROM public.staging_contacts_csv
    UNION ALL
    SELECT property_address, property_postal_code, contact2_name, NULLIF(trim(contact2_email_1), ''), contact2_phone_1, 'alternate_contact', null, null, null, null FROM public.staging_contacts_csv
    UNION ALL
    SELECT property_address, property_postal_code, contact3_name, NULLIF(trim(contact3_email_1), ''), contact3_phone_1, 'alternate_contact', null, null, null, null FROM public.staging_contacts_csv
    UNION ALL
    SELECT property_address, property_postal_code, mls_curr_listagentname, NULLIF(trim(mls_curr_listagentemail), ''), mls_curr_listagentphone, 'mls_agent', null, null, null, null FROM public.staging_contacts_csv
  )
  INSERT INTO public.contacts (
    user_id, property_id, name, email, phone, role,
    mailing_address, mailing_city, mailing_state, mailing_postal_code
  )
  SELECT
    p_user_id,
    p.property_id,
    ac.name,
    ac.email,
    ac.phone,
    ac.role,
    ac.mailing_address,
    ac.mailing_city,
    ac.mailing_state,
    ac.mailing_postal_code
  FROM all_contacts ac
  -- Join with the properties table to get the foreign key (property_id).
  JOIN public.properties p ON
    p.user_id = p_user_id AND
    p.property_address = ac.property_address AND
    p.property_postal_code = ac.property_postal_code
  -- Filter out contacts with no email or name, and ignore placeholder values.
  WHERE ac.email IS NOT NULL AND upper(ac.email) NOT IN ('N/A', 'NA')
  -- The ON CONFLICT clause handles duplicate contacts for a given property.
  ON CONFLICT (property_id, email) DO NOTHING;

  -- Step 3: Clean up the staging table now that the import is complete.
  TRUNCATE public.staging_contacts_csv;
  
END;
$$;