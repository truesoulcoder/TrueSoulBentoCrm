// src/app/api/leads/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';
import redis from '@/lib/redis';

export const dynamic = 'force-dynamic';

const CACHE_TTL_SECONDS = 300; // Cache for 5 minutes

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("CRITICAL: Supabase URL or Service Key is not defined in your .env.local file.");
    return NextResponse.json({ error: "Server configuration error: Missing Supabase credentials." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const region = searchParams.get('region') || 'all';

  // Create a dynamic cache key based on the filter parameters
  const cacheKey = `leads:region:${region}:search:${search || 'none'}`;

  try {
    // 1. Check Redis cache first
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`[CACHE HIT] Serving from cache: ${cacheKey}`);
      return NextResponse.json(JSON.parse(cachedData));
    }

    console.log(`[CACHE MISS] Fetching from database: ${cacheKey}`);

    // 2. If it's a cache miss, query the database
    const supabase = createClient<Database>(supabaseUrl, serviceKey);
    
    let query = supabase
      .from('properties_with_contacts')
      .select('*');

    if (region && region !== 'all') {
      query = query.eq('market_region', region);
    }

    if (search) {
      const searchQuery = `%${search}%`;
      query = query.or(
        `contact_names.ilike.${searchQuery},` +
        `property_address.ilike.${searchQuery},` +
        `property_city.ilike.${searchQuery},` +
        `status.ilike.${searchQuery}`
      );
    }

    query = query.limit(1000).order('created_at', { ascending: false });

    const { data, error, status } = await query;

    if (error) {
      console.error('Supabase client error fetching leads:', { message: error.message, details: error.details, status: status });
      return NextResponse.json(
        { error: `Failed to fetch leads: ${error.message}` },
        { status: 500 }
      );
    }

    // 3. Store the fresh data in Redis
    if (data) {
      await redis.set(cacheKey, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
      console.log(`[CACHE SET] Stored data for key: ${cacheKey}`);
    }

    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Unexpected error in GET /api/leads:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}