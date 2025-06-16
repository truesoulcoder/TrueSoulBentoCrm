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
    
    // **THE FIX**: This query is much more efficient.
    // It builds the query dynamically and filters in the database, not in the code.
    let query = supabase.from('properties_with_contacts').select('*');

    if (region && region !== 'all') {
      query = query.eq('market_region', region);
    }
    
    if (search) {
      query = query.or(
        `contact_names.ilike.%${search}%,property_address.ilike.%${search}%,contact_emails.ilike.%${search}%,property_city.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase query error fetching leads:', { message: error.message });
      throw new Error(`Failed to fetch leads: ${error.message}`);
    }

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