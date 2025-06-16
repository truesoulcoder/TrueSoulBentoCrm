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

  // --- Resilient Caching Block ---
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
    
    let query;
    if (search) {
      query = supabase.rpc('search_properties_with_contacts', { search_term: search });
    } else {
      query = supabase.from('properties_with_contacts').select('*');
    }

    if (region && region !== 'all') {
      query = query.eq('market_region', region);
    }
    
    query = query.order('created_at', { ascending: false }).limit(1000);

    const { data, error } = await query;

    if (error) {
      console.error('Supabase client error fetching leads:', { message: error.message, details: error.details });
      throw new Error(`Failed to fetch leads: ${error.message}`);
    }

    // --- Resilient Cache Write ---
    try {
      if (data) {
        await redis.set(cacheKey, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
        console.log(`[CACHE SET] Stored data for key: ${cacheKey}`);
      }
    } catch (cacheError) {
      console.error(`[LEADS CACHE WRITE ERROR] Could not write to cache for key ${cacheKey}.`, cacheError);
    }

    return NextResponse.json(data);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Unexpected error in GET /api/leads:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}