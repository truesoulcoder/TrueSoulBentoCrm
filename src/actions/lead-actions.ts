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

    // Add specific, known list cache keys
    keysToDel.push('leads:region:all:search:none');

    // Fetch market regions and add their cache keys
    const supabase = await createAdminServerClient();
    const { data: regions, error: regionsError } = await supabase
      .from('market_regions')
      .select('name');

    if (regionsError) {
      console.error('Failed to fetch market regions for cache invalidation:', regionsError);
    } else if (regions) {
      regions.forEach(region => {
        if (region.name) {
          keysToDel.push(`leads:region:${region.name}:search:none`);
        }
      });
    }
    
    // Use a Set to ensure we only delete unique keys
    const uniqueKeys = [...new Set(keysToDel)];

    if (uniqueKeys.length > 0) {
      console.log('[CACHE INVALIDATION] Deleting specific keys:', uniqueKeys);
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

    if (property.property_id) {
      propertyIdForInvalidation = property.property_id;
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

      const { data: newlyCreatedProperty, error } = await supabase
        .from('properties')
        .insert(propertyToInsert)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create property: ${error.message}`);
      }
      // Add this check to ensure newlyCreatedProperty is not null
      if (!newlyCreatedProperty) {
        throw new Error('Property creation reported successful, but no data was returned.');
      }
      savedProperty = newlyCreatedProperty; // Now newlyCreatedProperty is known to be non-null
    }

    if (!savedProperty) {
      throw new Error("Failed to get property ID after save.");
    }

    // Ensure we have a property ID for cache invalidation after the null check
    if (!propertyIdForInvalidation) {
      propertyIdForInvalidation = savedProperty.property_id;
    }
    
    // De-structure after the null check to satisfy TypeScript's control flow analysis
    const { property_id: finalPropertyId, user_id: finalUserId } = savedProperty;

    // --- UPSERT CONTACTS ---
    const contactIdsToKeep: string[] = [];
    const contactsToUpsert = contacts.map(c => {
      if (c.contact_id) contactIdsToKeep.push(c.contact_id);
      return { ...c, property_id: finalPropertyId, user_id: finalUserId };
    });

    if (contactsToUpsert.length > 0) {
        const { error: upsertError } = await supabase
            .from('contacts')
            .upsert(contactsToUpsert);

        if (upsertError) throw new Error(`Failed to upsert contacts: ${upsertError.message}`);
    }
    
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