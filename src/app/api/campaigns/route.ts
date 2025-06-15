// src/app/api/campaigns/route.ts
import { createAdminServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';
import redis from '@/lib/redis';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'campaigns:all';
const CACHE_TTL_SECONDS = 600; // Cache for 10 minutes

export async function GET() {
  // Resilient Caching Block
  try {
    const cachedData = await redis.get(CACHE_KEY);
    if (cachedData) {
      console.log(`[CACHE HIT] Serving from cache: ${CACHE_KEY}`);
      return NextResponse.json(JSON.parse(cachedData));
    }
  } catch (cacheError) {
      console.error(`[CAMPAIGNS CACHE READ ERROR] Could not read from cache. Falling back to DB.`, cacheError);
  }

  // --- Database as the Source of Truth ---
  console.log(`[CACHE MISS] Fetching from database: ${CACHE_KEY}`);
  try {
    const supabase = await createAdminServerClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns with admin client:', error);
      return NextResponse.json(
        { error: `Failed to fetch campaigns: ${error.message}` },
        { status: 500 }
      );
    }
    
    // Attempt to set cache, but don't let it fail the request
    try {
        if (data) {
            await redis.set(CACHE_KEY, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
            console.log(`[CACHE SET] Stored data for key: ${CACHE_KEY}`);
        }
    } catch (cacheError) {
        console.error(`[CAMPAIGNS CACHE WRITE ERROR] Could not write to cache.`, cacheError);
    }

    return NextResponse.json(data);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createAdminServerClient();
  try {
    const campaignData = await request.json();
    const { name, status, user_id, market_region_id, daily_limit, time_window_hours } = campaignData;

    if (!name || !user_id || !market_region_id) {
      return NextResponse.json(
        { error: 'name, user_id, and market_region_id are required.' },
        { status: 400 }
      );
    }

    const { data, error: dbError } = await supabase
      .from('campaigns')
      .insert([{ 
        name, 
        status: status || 'draft', 
        user_id,
        market_region_id,
        daily_limit: daily_limit || 100,
        time_window_hours: time_window_hours || 8
      }])
      .select()
      .single();

    if (dbError) {
      console.error('Failed to create campaign:', dbError);
      return NextResponse.json(
        { error: `Failed to create campaign: ${dbError.message}` },
        { status: 500 }
      );
    }

    // Invalidate cache, but don't let it fail the request
    try {
        console.log(`[CACHE INVALIDATION] Deleting key: ${CACHE_KEY}`);
        await redis.del(CACHE_KEY);
    } catch (cacheError) {
        console.error(`[CAMPAIGNS CACHE INVALIDATION ERROR] Could not delete cache key.`, cacheError);
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/campaigns:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}