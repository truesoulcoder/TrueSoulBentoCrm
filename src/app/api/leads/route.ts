// src/app/api/leads/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import redis from '@/lib/redis';

export const dynamic = 'force-dynamic';

const CACHE_TTL_SECONDS = 300; // Cache for 5 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const region = searchParams.get('region') || 'all';

  // Use a versioned cache key to easily invalidate old caches
  const cacheKey = `leads:v2:region:${region}:search:${search || 'none'}`;

  // --- Resilient Caching Read Block ---
  // Tries to get data from cache, but falls back to DB if Redis fails
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`[CACHE HIT] Serving from cache: ${cacheKey}`);
      return NextResponse.json(JSON.parse(cachedData));
    }
  } catch (cacheError) {
    console.error(`[LEADS CACHE READ ERROR] Could not read from cache for key ${cacheKey}. Falling back to DB.`, cacheError);
  }

  // --- Database as the Source of Truth ---
  console.log(`[CACHE MISS] Fetching from database: ${cacheKey}`);
  
  try {
    const supabase = await createClient();
    
    // FIX: Build the query dynamically for efficiency instead of using an RPC call.
    // This allows the database to do the filtering, which is much faster.
    let query = supabase.from('properties_with_contacts').select('*');

    // 1. Filter by region at the database level
    if (region && region !== 'all') {
      query = query.eq('market_region', region);
    }
    
    // 2. Add text search at the database level
    if (search) {
      // Use .or() to search across multiple relevant columns
      query = query.or(
        `contact_names.ilike.%${search}%,property_address.ilike.%${search}%,contact_emails.ilike.%${search}%,property_city.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase query error fetching leads:', { message: error.message, details: error.details });
      throw new Error(`Failed to fetch leads: ${error.message}`);
    }

    // Attempt to set cache, but don't fail the request if Redis is down.
    try {
      if (data) {
        await redis.set(cacheKey, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
        console.log(`[CACHE SET] Stored data for key: ${cacheKey}`);
      }
    } catch (cacheError) {
      console.error(`[LEADS CACHE WRITE ERROR] Could not write to cache for key ${cacheKey}.`, cacheError);
    }

    return NextResponse.json(data || []);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Unexpected error in GET /api/leads:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}