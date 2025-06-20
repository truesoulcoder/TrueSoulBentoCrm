CREATE OR REPLACE FUNCTION public.import_leads_from_staging(p_job_id uuid, p_user_id uuid, p_market_region text)
RETURNS void AS $$
DECLARE
    v_market_region_id UUID;
BEGIN
    -- Step 1: Find or create the market region and get its ID.
    INSERT INTO public.market_regions (name, created_by)
    VALUES (p_market_region, p_user_id)
    ON CONFLICT (normalized_name) DO UPDATE SET name = p_market_region
    RETURNING id INTO v_market_region_id;

    IF v_market_region_id IS NULL THEN
        SELECT id INTO v_market_region_id FROM public.market_regions WHERE normalized_name = LOWER(TRIM(p_market_region));
    END IF;

    UPDATE public.upload_jobs
    SET progress = 25, message = 'Market region processed. Importing properties...'
    WHERE job_id = p_job_id;

    -- Step 2: Insert properties.
    INSERT INTO public.properties (
        user_id, market_region_id, market_region, owner_type,
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
        p_user_id,
        v_market_region_id,
        p_market_region,
        s.owner_type,
        s.property_address, s.property_city, s.property_state, s.property_postal_code,
        s.property_type,
        NULLIF(s.year_built::text, '')::integer,
        NULLIF(s.square_footage::text, '')::integer,
        NULLIF(s.lot_size_sqft::text, '')::integer,
        NULLIF(s.baths::text, '')::numeric,
        NULLIF(s.beds::text, '')::numeric,
        NULLIF(s.price_per_sqft::text, '')::numeric,
        NULLIF(s.assessed_year::text, '')::integer,
        NULLIF(s.assessed_total::text, '')::numeric,
        NULLIF(s.market_value::text, '')::numeric,
        NULLIF(s.wholesale_value::text, '')::numeric,
        NULLIF(s.avm::text, '')::numeric,
        s.mls_curr_listingid,
        s.mls_curr_status,
        s.mls_curr_listdate,
        s.mls_curr_solddate,
        NULLIF(s.mls_curr_daysonmarket::text, '')::integer,
        NULLIF(s.mls_curr_listprice::text, '')::numeric,
        NULLIF(s.mls_curr_saleprice::text, '')::numeric,
        NULLIF(s.mls_curr_pricepersqft::text, '')::numeric,
        NULLIF(s.mls_curr_sqft::text, '')::integer,
        s.mls_curr_beds,
        NULLIF(s.mls_curr_baths::text, '')::numeric,
        s.mls_curr_garage,
        NULLIF(s.mls_curr_yearbuilt::text, '')::integer,
        s.mls_curr_photos,
        'New Lead'::public.lead_status
    FROM public.staging_contacts_csv s
    ON CONFLICT (user_id, property_address, property_postal_code) DO NOTHING;

    UPDATE public.upload_jobs
    SET progress = 85, message = 'Properties imported. Staging contacts...'
    WHERE job_id = p_job_id;

    -- Step 3: Unpivot and insert contacts.
    WITH all_contacts AS (
        SELECT property_address, property_postal_code, contact1_name AS name, NULLIF(trim(contact1_email_1), '') AS email, contact1_phone_1 AS phone, 'owner'::public.contact_role AS role, recipient_address, recipient_city, recipient_state, recipient_postal_code FROM public.staging_contacts_csv
        UNION ALL
        SELECT property_address, property_postal_code, contact2_name, NULLIF(trim(contact2_email_1), ''), contact2_phone_1, 'alternate_contact', NULL, NULL, NULL, NULL FROM public.staging_contacts_csv
        UNION ALL
        SELECT property_address, property_postal_code, contact3_name, NULLIF(trim(contact3_email_1), ''), contact3_phone_1, 'alternate_contact', NULL, NULL, NULL, NULL FROM public.staging_contacts_csv
        UNION ALL
        SELECT property_address, property_postal_code, mls_curr_listagentname, NULLIF(trim(mls_curr_listagentemail), ''), mls_curr_listagentphone, 'mls_agent', NULL, NULL, NULL, NULL FROM public.staging_contacts_csv
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
        ac.recipient_address,
        ac.recipient_city,
        ac.recipient_state,
        ac.recipient_postal_code
    FROM all_contacts ac
    JOIN public.properties p
      ON p.user_id = p_user_id
      AND p.property_address = ac.property_address
      AND p.property_postal_code = ac.property_postal_code
    WHERE ac.email IS NOT NULL
      AND upper(ac.email) NOT IN ('N/A', 'NA')
      AND ac.name IS NOT NULL
      AND ac.name <> ''
    ON CONFLICT (property_id, email) DO NOTHING;

    -- Step 4: Clean up staging.
    TRUNCATE public.staging_contacts_csv;
END;
$$ LANGUAGE plpgsql;