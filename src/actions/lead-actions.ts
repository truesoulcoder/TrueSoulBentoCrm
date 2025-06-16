// src/actions/lead-actions.ts
'use server';

import { createAdminServerClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { revalidatePath } from 'next/cache';
import redis from '@/lib/redis';

// Define types for convenience
export type Property = Tables<'properties'>;
export type Contact = Tables<'contacts'>;
export type LeadDetails = {
  property: Property;
  contacts: Contact[];
};

/**
 * Helper function to clear relevant caches from Redis.
 * It clears the general leads and regions lists, and optionally a specific lead's detail cache.
 * @param propertyId - Optional ID of a specific lead to invalidate.
 */
async function invalidateLeadCaches(propertyId?: string) {
  try {
    const keysToDel: string[] = [];

    // Invalidate a specific lead's detail cache if an ID is provided
    if (propertyId) {
      keysToDel.push(`lead:details:${propertyId}`);
    }

    // Find and add all list-based cache keys to the deletion list
    const leadListKeys = await redis.keys('leads:*');
    const regionListKeys = await redis.keys('market_regions:*');

    const allKeys = [...keysToDel, ...leadListKeys, ...regionListKeys];
    
    // Use a Set to ensure we only delete unique keys
    const uniqueKeys = [...new Set(allKeys)];

    if (uniqueKeys.length > 0) {
      console.log('[CACHE INVALIDATION] Deleting keys:', uniqueKeys);
      await redis.del(uniqueKeys);
    }
  } catch (error) {
    console.error('Failed to invalidate Redis cache:', error);
  }
}

/**
 * Fetches the full details for a single lead, including its property and associated contacts.
 * Uses Redis for caching.
 * @param propertyId The UUID of the property to fetch.
 * @returns An object containing the property and an array of contacts.
 */
export async function getLeadDetails(propertyId: string): Promise<LeadDetails | null> {
  const cacheKey = `lead:details:${propertyId}`;
  const CACHE_TTL_SECONDS = 3600; // Cache individual leads for 1 hour

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`[CACHE HIT] Serving from cache: ${cacheKey}`);
      return JSON.parse(cachedData);
    }

    console.log(`[CACHE MISS] Fetching from database: ${cacheKey}`);
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
      // Return property even if contacts fail, but don't cache
      return { property, contacts: [] };
    }
    
    const leadDetails = { property, contacts: contacts || [] };

    // Store the fresh data in Redis
    await redis.set(cacheKey, JSON.stringify(leadDetails), 'EX', CACHE_TTL_SECONDS);
    console.log(`[CACHE SET] Stored data for key: ${cacheKey}`);
    
    return leadDetails;

  } catch (error) {
    console.error(`Error in getLeadDetails for ID ${propertyId}:`, error);
    return null;
  }
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
  let propertyIdForInvalidation: string | undefined;

  try {
    let savedProperty: Property | null = null;
    let finalUserId: string | undefined;

    if (property.property_id) {
      propertyIdForInvalidation = property.property_id;
      finalUserId = property.user_id;
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
      finalUserId = user.id;

      const propertyToInsert: TablesInsert<'properties'> = {
        ...property,
        user_id: finalUserId,
      };

      const { data: newlyCreatedProperty, error } = await supabase
        .from('properties')
        .insert(propertyToInsert)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create property: ${error.message}`);
      }
      if (!newlyCreatedProperty) {
        throw new Error('Property creation reported successful, but no data was returned.');
      }
      savedProperty = newlyCreatedProperty;
    }

    if (!savedProperty || !finalUserId) {
      throw new Error("Failed to get property or user ID after save operation.");
    }
    
    propertyIdForInvalidation = savedProperty.property_id;
    const finalPropertyId = savedProperty.property_id;

    // --- UPSERT CONTACTS ---
    const contactIdsToKeep: string[] = [];
    const contactsToUpsert = contacts.map(c => {
      if (c.contact_id) contactIdsToKeep.push(c.contact_id);
      return { ...c, property_id: finalPropertyId, user_id: finalUserId };
    });

    if (contactsToUpsert.length > 0) {
        const { error: upsertError } = await supabase
            .from('contacts')
            .upsert(contactsToUpsert, { onConflict: 'contact_id' }); // Specify onConflict strategy

        if (upsertError) throw new Error(`Failed to upsert contacts: ${upsertError.message}`);
    }
    
    // Delete contacts that were removed in the UI
    const { error: deleteError } = await supabase
      .from('contacts')
      .delete()
      .eq('property_id', finalPropertyId)
      .not('contact_id', 'in', `(${contactIdsToKeep.join(',')})`);
  
    if (deleteError && contactIdsToKeep.length > 0) {
        console.warn(`Could not delete removed contacts for property ${finalPropertyId}: ${deleteError.message}`);
    }


    await invalidateLeadCaches(propertyIdForInvalidation);
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

    await invalidateLeadCaches(propertyId);
    revalidatePath('/');
    return { success: true, error: null };
  } catch (e: any) {
    console.error("Error in deleteLead action:", e.message);
    return { success: false, error: e.message };
  }
}