// src/app/api/market-regions/route.ts
import { createAdminServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import redis from '@/lib/redis';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'market_regions:active_list';
const CACHE_TTL_SECONDS = 600; // Cache for 10 minutes

export async function GET() {
  // Resilient Caching Read
  try {
    const cachedData = await redis.get(CACHE_KEY);
    if (cachedData) {
      console.log(`[CACHE HIT] Serving from cache: ${CACHE_KEY}`);
      return NextResponse.json(JSON.parse(cachedData));
    }
  } catch (cacheError) {
    console.error(`[MARKET_REGIONS CACHE READ ERROR] Could not read from cache. Falling back to DB.`, cacheError);
  }
  
  console.log(`[CACHE MISS] Fetching from database: ${CACHE_KEY}`);

  try {
    const supabase = await createAdminServerClient();
    
    // **THE FIX**: This queries the fast 'market_regions' table directly.
    const { data, error } = await supabase
      .from('market_regions')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }
    
    // Resilient Caching Write
    try {
      if(data) {
        await redis.set(CACHE_KEY, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
      }
    } catch (cacheError) {
        console.error(`[MARKET_REGIONS CACHE WRITE ERROR] Could not write to cache.`, cacheError);
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('[MARKET-REGIONS-API-ERROR]:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}