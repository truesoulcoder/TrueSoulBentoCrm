CREATE OR REPLACE FUNCTION public.import_leads_from_staging(p_job_id uuid, p_user_id uuid, p_market_region text)
RETURNS void AS $$
DECLARE
    v_market_region_id UUID;
    v_normalized_name TEXT := LOWER(TRIM(p_market_region));
BEGIN
    -- Step 1: Find or create the market region and get its ID.
    -- Use ON CONFLICT to handle concurrent requests safely.
    INSERT INTO public.market_regions (name, normalized_name, created_by)
    VALUES (p_market_region, v_normalized_name, p_user_id)
    ON CONFLICT (normalized_name) DO UPDATE
    SET name = p_market_region -- Update name in case casing changes
    RETURNING id INTO v_market_region_id;

    -- If the region already existed, the INSERT...ON CONFLICT...DO UPDATE returns the ID.
    -- If it was a new region, it also returns the ID.
    -- If for some reason the ID is still null, we can select it.
    IF v_market_region_id IS NULL THEN
        SELECT id INTO v_market_region_id FROM public.market_regions WHERE normalized_name = v_normalized_name;
    END IF;

    UPDATE public.upload_jobs SET progress = 25, message = 'Market region processed. Importing properties...' WHERE job_id = p_job_id;

    -- Step 2: Insert properties, safely converting types.
    INSERT INTO public.properties (
        user_id, market_region_id, owner_type,
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
        p_user_id, v_market_region_id, s."OwnerType",
        s."PropertyAddress", s."PropertyCity", s."PropertyState", s."PropertyPostalCode",
        s."PropertyType",
        NULLIF(s."YearBuilt", '')::integer,
        NULLIF(s."SquareFootage", '')::numeric,
        NULLIF(s."LotSizeSqFt", '')::numeric,
        NULLIF(s."Baths", '')::numeric,
        NULLIF(s."Beds", '')::numeric,
        NULLIF(s."PricePerSqFt", '')::numeric,
        NULLIF(s."AssessedYear", '')::integer,
        NULLIF(s."AssessedTotal", '')::numeric,
        NULLIF(s."MarketValue", '')::numeric,
        NULLIF(s."WholesaleValue", '')::numeric,
        NULLIF(s."AVM", '')::numeric,
        s."MLS_Curr_ListingID",
        s."MLS_Curr_Status",
        TO_DATE(NULLIF(s."MLS_Curr_ListDate", ''), 'YYYY-MM-DD'),
        TO_DATE(NULLIF(s."MLS_Curr_SoldDate", ''), 'YYYY-MM-DD'),
        NULLIF(s."MLS_Curr_DaysOnMarket", '')::integer,
        NULLIF(s."MLS_Curr_ListPrice", '')::numeric,
        NULLIF(s."MLS_Curr_SalePrice", '')::numeric,
        NULLIF(s."MLS_Curr_PricePerSqft", '')::numeric,
        NULLIF(s."MLS_Curr_Sqft", '')::numeric,
        NULLIF(s."MLS_Curr_Beds", '')::numeric,
        NULLIF(s."MLS_Curr_Baths", '')::numeric,
        s."MLS_Curr_Garage",
        NULLIF(s."MLS_Curr_YearBuilt", '')::integer,
        s."MLS_Curr_Photos",
        'New Lead'::public.lead_status
    FROM public.staging_contacts_csv s
    ON CONFLICT (user_id, property_address, property_postal_code) DO NOTHING;

    UPDATE public.upload_jobs SET progress = 85, message = 'Properties imported. Staging contacts...' WHERE job_id = p_job_id;

    -- Step 3: Unpivot and insert all valid contacts.
    WITH all_contacts AS (
        SELECT "PropertyAddress", "PropertyPostalCode", "Contact1Name" AS name, NULLIF(trim("Contact1Email_1"), '') AS email, "Contact1Phone_1" AS phone, 'owner'::public.contact_role AS role, "RecipientAddress" AS mailing_address, "RecipientCity" AS mailing_city, "RecipientState" AS mailing_state, "RecipientPostalCode" AS mailing_postal_code FROM public.staging_contacts_csv
        UNION ALL
        SELECT "PropertyAddress", "PropertyPostalCode", "Contact2Name", NULLIF(trim("Contact2Email_1"), ''), "Contact2Phone_1", 'alternate_contact', null, null, null, null FROM public.staging_contacts_csv
        UNION ALL
        SELECT "PropertyAddress", "PropertyPostalCode", "Contact3Name", NULLIF(trim("Contact3Email_1"), ''), "Contact3Phone_1", 'alternate_contact', null, null, null, null FROM public.staging_contacts_csv
        UNION ALL
        SELECT "PropertyAddress", "PropertyPostalCode", "MLS_Curr_ListAgentName", NULLIF(trim("MLS_Curr_ListAgentEmail"), ''), "MLS_Curr_ListAgentPhone", 'mls_agent', null, null, null, null FROM public.staging_contacts_csv
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
    JOIN public.properties p ON
        p.user_id = p_user_id AND
        p.property_address = ac."PropertyAddress" AND
        p.property_postal_code = ac."PropertyPostalCode"
    WHERE ac.email IS NOT NULL AND upper(ac.email) NOT IN ('N/A', 'NA')
      AND ac.name IS NOT NULL AND ac.name <> ''
    ON CONFLICT (property_id, email) DO NOTHING;

    -- Step 4: Clean up the staging table.
    TRUNCATE public.staging_contacts_csv;
END;
$$ LANGUAGE plpgsql;