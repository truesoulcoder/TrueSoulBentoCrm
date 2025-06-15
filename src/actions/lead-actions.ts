// src/actions/lead-actions.ts
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
    await supabase.from('contacts').delete().eq('property_id', propertyId);
    await supabase.from('properties').delete().eq('property_id', propertyId);

    revalidatePath('/');
    return { success: true, error: null };
  } catch (e: any) {
    console.error("Error in deleteLead action:", e.message);
    return { success: false, error: e.message };
  }
}