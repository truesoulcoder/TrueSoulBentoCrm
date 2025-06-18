// src/app/api/leads/route.ts
import { createClient, createAdminServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import redis from '@/lib/redis';
import { logSystemEvent } from '@/services/logService';

export const dynamic = 'force-dynamic';

const CACHE_TTL_SECONDS = 300; // Cache for 5 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const region = searchParams.get('region') || 'all';
  const requestedUserId = searchParams.get('userId'); // Get the userId requested from the client
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = (page - 1) * limit;

  const supabase = await createClient(); // Use regular client for auth check

  // Authenticate user and get their role
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    await logSystemEvent({
      event_type: 'LEADS_API_AUTH_ERROR',
      message: 'Unauthorized access to leads API.',
      level: 'ERROR',
      details: { authError: authError?.message }
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isSuperAdmin = (user.user_metadata?.user_role as string) === 'superadmin';
  const effectiveUserId = isSuperAdmin ? null : user.id; // If not superadmin, only allow filtering by their own ID

  // Construct cache key based on all relevant filters and user role
  const cacheKey = `leads:v3:region:${region}:search:${search || 'none'}:user:${effectiveUserId || 'all'}:page:${page}:limit:${limit}`;

  // Resilient Caching: Tries to get from cache but continues if Redis fails.
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      await logSystemEvent({
        event_type: 'LEADS_API_CACHE_HIT',
        message: `Serving leads from cache for key: ${cacheKey}`,
        level: 'DEBUG',
        details: { cacheKey, userId: user.id }
      });
      return NextResponse.json(JSON.parse(cachedData));
    }
  } catch (cacheError) {
    console.error(`[LEADS CACHE READ ERROR] for key ${cacheKey}. Falling back to DB.`, cacheError);
    await logSystemEvent({
      event_type: 'LEADS_API_CACHE_READ_ERROR',
      message: `Failed to read leads from cache for key: ${cacheKey}`,
      level: 'WARN',
      details: { cacheKey, cacheError: cacheError instanceof Error ? cacheError.message : String(cacheError) }
    });
  }

  await logSystemEvent({
    event_type: 'LEADS_API_CACHE_MISS',
    message: `Fetching leads from database for key: ${cacheKey}`,
    level: 'DEBUG',
    details: { cacheKey, userId: user.id }
  });

  try {
    // We use the authenticated user's supabase client here because RLS policies
    // will automatically filter by `user_id` if they are not a superadmin.
    // The `search_properties_with_contacts` function itself doesn't need a user ID
    // as it operates on the underlying `properties` table which has RLS.
    const { data: rpcData, error: rpcError } = await supabase.rpc('search_properties_with_contacts', {
      search_term: search
    });

    if (rpcError) {
      console.error('Supabase RPC error fetching leads:', { message: rpcError.message });
      await logSystemEvent({
        event_type: 'LEADS_API_RPC_ERROR',
        message: `Supabase RPC error fetching leads: ${rpcError.message}`,
        level: 'ERROR',
        details: { rpcError: rpcError.message, search_term: search, region, userId: user.id }
      });
      throw new Error(`Failed to fetch leads via RPC: ${rpcError.message}`);
    }

    let leads = rpcData || [];

    // If a specific region is requested (and not 'all'), filter the results.
    if (region && region !== 'all') {
      leads = leads.filter((lead: any) => lead.market_region_id === region);
    }

    // For non-superadmins, RLS should handle filtering. This is an extra safeguard.
    if (!isSuperAdmin && effectiveUserId) {
      leads = leads.filter((lead: any) => lead.user_id === effectiveUserId);
    }

    const data = leads;

    // Resilient Caching: Tries to write to cache but doesn't fail the request if it can't.
    try {
      if (data) {
        await redis.set(cacheKey, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
        await logSystemEvent({
          event_type: 'LEADS_API_CACHE_SET',
          message: `Set leads cache for key: ${cacheKey}`,
          level: 'DEBUG',
          details: { cacheKey, numResults: data.length, userId: user.id }
        });
      }
    } catch (cacheError) {
      console.error(`[LEADS CACHE WRITE ERROR] for key ${cacheKey}.`, cacheError);
      await logSystemEvent({
        event_type: 'LEADS_API_CACHE_WRITE_ERROR',
        message: `Failed to write leads to cache for key: ${cacheKey}`,
        level: 'WARN',
        details: { cacheKey, cacheError: cacheError instanceof Error ? cacheError.message : String(cacheError) }
      });
    }

    return NextResponse.json(data || []);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error in GET /api/leads:', errorMessage);
    await logSystemEvent({
      event_type: 'LEADS_API_UNEXPECTED_ERROR',
      message: `Unexpected error in GET /api/leads: ${errorMessage}`,
      level: 'ERROR',
      details: { error: errorMessage, search_term: search, region, userId: user.id }
    });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}