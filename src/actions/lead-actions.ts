// src/actions/lead-actions.ts
'use server';

import { createAdminServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { revalidatePath } from 'next/cache';

// Define types for convenience
export type Property = Tables<'properties'>;
export type Contact = Tables<'contacts'>;
export type LeadDetails = {
  property: Property;
  contacts: Contact[];
};

/**
 * Fetches the full details for a single lead, including its property and associated contacts.
 * @param propertyId The UUID of the property to fetch.
 * @returns An object containing the property and an array of contacts.
 */
export async function getLeadDetails(propertyId: string): Promise<LeadDetails | null> {
  const supabase = await createAdminServerClient();
  
  // Explicitly select columns to avoid ambiguity with 'id' vs 'property_id'
  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('property_id, status, property_address, property_city, property_state, property_postal_code, market_region, market_value, assessed_total, year_built, beds, baths, square_footage, lot_size_sqft, mls_list_price, mls_days_on_market, property_type, notes, user_id, owner_type, assessed_year, avm, mls_baths, mls_beds, mls_garage, mls_list_date, mls_listing_id, mls_photos, mls_price_per_sqft, mls_sale_price, mls_sold_date, mls_sqft, mls_status, mls_year_built, price_per_sqft, wholesale_value, created_at, updated_at')
    .eq('property_id', propertyId)
    .single();

  if (propertyError) {
    console.error(`Error fetching property ${propertyId}:`, propertyError);
    return null;
  }

  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at');

  if (contactsError) {
    console.error(`Error fetching contacts for property ${propertyId}:`, contactsError);
    // Return property data even if contacts fail to load
    return { property, contacts: [] };
  }

  return { property, contacts: contacts || [] };
}

/**
 * Creates or updates a lead, handling both the property and its contacts.
 * @param leadData The data for the property and its contacts.
 * @returns The updated or created property data.
 */
export async function saveLead(leadData: {
  property: TablesInsert<'properties'> | TablesUpdate<'properties'>;
  contacts: (TablesInsert<'contacts'> | TablesUpdate<'contacts'>)[];
}): Promise<{ data: Property | null, error: string | null }> {
  const supabase = await createAdminServerClient();
  const { property, contacts } = leadData;

  try {
    let savedProperty: Property | null = null;
    
    // Check if we are updating or creating
    if (property.property_id) {
      // --- UPDATE ---
      const { data, error } = await supabase
        .from('properties')
        .update(property)
        .eq('property_id', property.property_id)
        .select()
        .single();
        
      if (error) throw new Error(`Failed to update property: ${error.message}`);
      savedProperty = data;

    } else {
      // --- CREATE ---
      const userSupabase = createClient();
      const { data: { user } } = await userSupabase.auth.getUser();
      if (!user) throw new Error('User not authenticated.');

      const propertyToInsert: TablesInsert<'pro// src/actions/lead-actions.ts
'use server';

import { createAdminServerClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { revalidatePath } from 'next/cache';

// Define types for convenience
export type Property = Tables<'properties'>;
export type Contact = Tables<'contacts'>;
export type LeadDetails = {
  property: Property;
  contacts: Contact[];
};

/**
 * Fetches the full details for a single lead, including its property and associated contacts.
 * @param propertyId The UUID of the property to fetch.
 * @returns An object containing the property and an array of contacts.
 */
export async function getLeadDetails(propertyId: string): Promise<LeadDetails | null> {
  const supabase = await createAdminServerClient();
  
  // Update select statement to select all columns, ensuring new fields are included.
  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('*')
    .eq('property_id', propertyId)
    .single();

  if (propertyError) {
    console.error(`Error fetching property ${propertyId}:`, propertyError);
    return null;
  }

  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at');

  if (contactsError) {
    console.error(`Error fetching contacts for property ${propertyId}:`, contactsError);
    // Return property data even if contacts fail to load
    return { property, contacts: [] };
  }

  return { property, contacts: contacts || [] };
}

/**
 * Creates or updates a lead, handling both the property and its contacts.
 * @param leadData The data for the property and its contacts.
 * @returns The updated or created property data.
 */
export async function saveLead(leadData: {
  property: TablesInsert<'properties'> | TablesUpdate<'properties'>;
  contacts: (TablesInsert<'contacts'> | TablesUpdate<'contacts'>)[];
}): Promise<{ data: Property | null, error: string | null }> {
  const supabase = await createAdminServerClient();
  const { property, contacts } = leadData;

  try {
    let savedProperty: Property | null = null;
    
    // This logic is already generic and will handle the new fields
    // as long as they are passed in the `property` object from the client.
    if (property.property_id) {
      // --- UPDATE ---
      const { data, error } = await supabase
        .from('properties')
        .update(property)
        .eq('property_id', property.property_id)
        .select()
        .single();
        
      if (error) throw new Error(`Failed to update property: ${error.message}`);
      savedProperty = data;

    } else {
      // --- CREATE ---
      const userSupabase = createClient();
      const { data: { user } } = await userSupabase.auth.getUser();
      if (!user) throw new Error('User not authenticated.');

      const propertyToInsert: TablesInsert<'properties'> = {
        ...property,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('properties')
        .insert(propertyToInsert)
        .select()
        .single();

      if (error) throw new Error(`Failed to create property: ${error.message}`);
      savedProperty = data;
    }

    if (!savedProperty) throw new Error("Failed to get property ID after save.");
    
    // --- UPSERT CONTACTS ---
    const contactIdsToKeep: string[] = [];
    const contactsToUpsert = contacts.map(c => {
      if (c.contact_id) contactIdsToKeep.push(c.contact_id);
      return { ...c, property_id: savedProperty!.property_id, user_id: savedProperty!.user_id };
    });

    if (contactsToUpsert.length > 0) {
        const { error: upsertError } = await supabase
            .from('contacts')
            .upsert(contactsToUpsert);

        if (upsertError) throw new Error(`Failed to upsert contacts: ${upsertError.message}`);
    }
    
    // --- DELETE REMOVED CONTACTS ---
    const { error: deleteError } = await supabase
    .from('contacts')
    .delete()
    .eq('property_id', savedProperty.property_id)
    .not('contact_id', 'in', `(${contactIdsToKeep.join(',')})`);
  
    if (deleteError && contactIdsToKeep.length > 0) {
        console.warn(`Could not delete removed contacts for property ${savedProperty.property_id}: ${deleteError.message}`);
    }

    revalidatePath('/');
    return { data: savedProperty, error: null };

  } catch (e: any) {
    console.error("Error in saveLead action:", e.message);
    return { data: null, error: e.message };
  }
}

/**
 * Deletes a lead, including its property record and all associated contacts.
 * @param propertyId The UUID of the property to delete.
 * @returns An object indicating success or failure.
 */
export async function deleteLead(propertyId: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createAdminServerClient();
  
  try {
    // Delete associated contacts first to satisfy foreign key constraints
    await supabase.from('contacts').delete().eq('property_id', propertyId);

    // Delete the property
    await supabase.from('properties').delete().eq('property_id', propertyId);
      
    revalidatePath('/');
    return { success: true, error: null };
  } catch (e: any) {
    console.error("Error in deleteLead action:", e.message);
    return { success: false, error: e.message };
  }
}perties'> = {
        ...property,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('properties')
        .insert(propertyToInsert)
        .select()
        .single();

      if (error) throw new Error(`Failed to create property: ${error.message}`);
      savedProperty = data;
    }

    if (!savedProperty) throw new Error("Failed to get property ID after save.");
    
    // --- UPSERT CONTACTS ---
    const contactIdsToKeep: string[] = [];
    const contactsToUpsert = contacts.map(c => {
      if (c.contact_id) contactIdsToKeep.push(c.contact_id);
      return { ...c, property_id: savedProperty!.property_id, user_id: savedProperty!.user_id };
    });

    const { error: upsertError } = await supabase
        .from('contacts')
        .upsert(contactsToUpsert);

    if (upsertError) throw new Error(`Failed to upsert contacts: ${upsertError.message}`);
    
    // --- DELETE REMOVED CONTACTS ---
    if (contactIdsToKeep.length > 0) {
        const { error: deleteError } = await supabase
        .from('contacts')
        .delete()
        .eq('property_id', savedProperty.property_id)
        .not('contact_id', 'in', `(${contactIdsToKeep.join(',')})`);
      
        if (deleteError) {
            console.warn(`Could not delete removed contacts for property ${savedProperty.property_id}: ${deleteError.message}`);
        }
    }

    // Revalidate the path to update the UI
    revalidatePath('/');
    return { data: savedProperty, error: null };

  } catch (e: any) {
    console.error("Error in saveLead action:", e.message);
    return { data: null, error: e.message };
  }
}

/**
 * Deletes a lead, including its property record and all associated contacts.
 * @param propertyId The UUID of the property to delete.
 * @returns An object indicating success or failure.
 */
export async function deleteLead(propertyId: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createAdminServerClient();
  
  try {
    // Delete associated contacts first to satisfy foreign key constraints
    const { error: contactsError } = await supabase
      .from('contacts')
      .delete()
      .eq('property_id', propertyId);

    if (contactsError) throw new Error(`Failed to delete contacts: ${contactsError.message}`);

    // Delete the property
    const { error: propertyError } = await supabase
      .from('properties')
      .delete()
      .eq('property_id', propertyId);
      
    if (propertyError) throw new Error(`Failed to delete property: ${propertyError.message}`);

    revalidatePath('/');
    return { success: true, error: null };
  } catch (e: any) {
    console.error("Error in deleteLead action:", e.message);
    return { success: false, error: e.message };
  }
}