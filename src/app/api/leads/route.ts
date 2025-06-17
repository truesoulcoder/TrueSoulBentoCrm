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

  const cacheKey = `leads:v2:region:${region}:search:${search || 'none'}`;

  // Resilient Caching: Tries to get from cache but continues if Redis fails.
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`[CACHE HIT] Serving from cache: ${cacheKey}`);
      return NextResponse.json(JSON.parse(cachedData));
    }
  } catch (cacheError) {
    console.error(`[LEADS CACHE READ ERROR] for key ${cacheKey}. Falling back to DB.`, cacheError);
  }

  console.log(`[CACHE MISS] Fetching from database: ${cacheKey}`);

  try {
    const supabase = await createClient();

    // Call the optimized SQL function search_properties_with_contacts
    const { data: rpcData, error: rpcError } = await supabase.rpc('search_properties_with_contacts', {
      search_term: search // Pass the search term from the request
    });

    if (rpcError) {
      console.error('Supabase RPC error fetching leads:', { message: rpcError.message });
      throw new Error(`Failed to fetch leads via RPC: ${rpcError.message}`);
    }

    let processedData = rpcData;

    // If a specific region is requested (and not 'all'), filter the results from the RPC call
    // The search_properties_with_contacts function returns market_region, so we can filter on it.
    if (region && region !== 'all' && Array.isArray(rpcData)) {
      processedData = rpcData.filter((lead: any) => lead.market_region === region);
    }

    // Use processedData for caching and response
    const data = processedData;
    // The rpcError is handled above. If we reach here, it means the RPC call was successful or did not throw an error that wasn't caught.
    // The 'error' variable is no longer needed here as its role is replaced by rpcError handling.

    // Resilient Caching: Tries to write to cache but doesn't fail the request if it can't.
    try {
      if (data) {
        await redis.set(cacheKey, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
      }
    } catch (cacheError) {
      console.error(`[LEADS CACHE WRITE ERROR] for key ${cacheKey}.`, cacheError);
    }

    return NextResponse.json(data || []);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error in GET /api/leads:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}