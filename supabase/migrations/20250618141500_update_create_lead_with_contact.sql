-- Migration: Update create_lead_with_contact to store full owner details (email, phone, role)
-- Generated 2025-06-18

-- Drop the existing function if it exists so we can recreate it
DROP FUNCTION IF EXISTS public.create_lead_with_contact(
    p_property_address text,
    p_property_city text,
    p_property_state text,
    p_property_postal_code text,
    p_market_region_id uuid,
    p_user_id uuid,
    p_status lead_status,
    c_first_name text,
    c_last_name text,
    c_mailing_address text
);

-- Re-create the function with additional parameters for email, phone and role
CREATE OR REPLACE FUNCTION public.create_lead_with_contact(
    p_property_address        text,
    p_property_city           text,
    p_property_state          text,
    p_property_postal_code    text,
    p_market_region_id        uuid,
    p_user_id                 uuid,
    p_status                  lead_status DEFAULT 'New Lead',
    c_first_name              text DEFAULT NULL,
    c_last_name               text DEFAULT NULL,
    c_mailing_address         text DEFAULT NULL,
    c_email                   text DEFAULT NULL,
    c_phone                   text DEFAULT NULL,
    c_role                    contact_role DEFAULT 'owner'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_property_id uuid;
BEGIN
    /* 1. Insert the property */
    INSERT INTO public.properties (
        property_address,
        property_city,
        property_state,
        property_postal_code,
        market_region_id,
        user_id,
        status
    )
    VALUES (
        p_property_address,
        p_property_city,
        p_property_state,
        p_property_postal_code,
        p_market_region_id,
        p_user_id,
        p_status
    )
    RETURNING property_id INTO new_property_id;

    /* 2. Insert the primary/owner contact */
    INSERT INTO public.contacts (
        property_id,
        user_id,
        name,
        email,
        phone,
        role,
        mailing_address
    ) VALUES (
        new_property_id,
        p_user_id,
        CONCAT_WS(' ', c_first_name, c_last_name),
        c_email,
        c_phone,
        c_role,
        c_mailing_address
    );

    RETURN new_property_id;
END;
$$;

-- Optional: grant execute to authenticated/anon users if required by your RLS setup
-- GRANT EXECUTE ON FUNCTION public.create_lead_with_contact TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.create_lead_with_contact TO anon;
