// src/app/api/leads/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';
import redis from '@/lib/redis';

export const dynamic = 'force-dynamic';

const CACHE_TTL_SECONDS = 300; // Cache for 5 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const region = searchParams.get('region') || 'all';

  const cacheKey = `leads:region:${region}:search:${search || 'none'}`;

  // Resilient Caching Block
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
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("CRITICAL: Supabase URL or Service Key is not defined in your .env.local file.");
    return NextResponse.json({ error: "Server configuration error: Missing Supabase credentials." }, { status: 500 });
  }

  try {
    const supabase = createClient<Database>(supabaseUrl, serviceKey);
    
    // FIX: Switched from the slow view query to the optimized RPC function
    // to prevent the 504 Gateway Timeout. We now use the RPC for all queries.
    const { data, error } = await supabase.rpc('search_properties_with_contacts', { 
      search_term: search 
    });

    if (error) {
      console.error('Supabase RPC error fetching leads:', { message: error.message, details: error.details });
      throw new Error(`Failed to fetch leads via RPC: ${error.message}`);
    }

    let finalData = data || [];

    // Since RPC calls cannot be chained, we filter by region here in the code.
    if (region && region !== 'all') {
      finalData = finalData.filter((lead: any) => lead.market_region === region);
    }
    
    // Note: Server-side sorting is omitted as the client-side component handles it.

    // Attempt to set cache, but don't let it fail the request
    try {
      if (finalData) {
        await redis.set(cacheKey, JSON.stringify(finalData), 'EX', CACHE_TTL_SECONDS);
        console.log(`[CACHE SET] Stored data for key: ${cacheKey}`);
      }
    } catch (cacheError) {
      console.error(`[LEADS CACHE WRITE ERROR] Could not write to cache for key ${cacheKey}.`, cacheError);
    }

    return NextResponse.json(finalData);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Unexpected error in GET /api/leads:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}