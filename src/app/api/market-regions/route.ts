// src/app/api/market-regions/route.ts
import { createAdminServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import redis from '@/lib/redis';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'market_regions:active';
const CACHE_TTL_SECONDS = 600; // Cache for 10 minutes

export async function GET() {
  try {
    // 1. Check Redis cache first
    const cachedData = await redis.get(CACHE_KEY);
    if (cachedData) {
      console.log(`[CACHE HIT] Serving from cache: ${CACHE_KEY}`);
      // The data in Redis is a string, so we need to parse it back to JSON
      return NextResponse.json(JSON.parse(cachedData));
    }

    console.log(`[CACHE MISS] Fetching from database: ${CACHE_KEY}`);
    
    // 2. If it's a cache miss, query the database
    const supabase = await createAdminServerClient();
    const { data, error } = await supabase
      .from('active_market_regions')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    // 3. Store the fresh data in Redis with a Time-To-Live (TTL)
    // The 'EX' option sets the expiration in seconds.
    await redis.set(CACHE_KEY, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
    console.log(`[CACHE SET] Stored data for key: ${CACHE_KEY}`);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('[MARKET-REGIONS-API-ERROR]:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}