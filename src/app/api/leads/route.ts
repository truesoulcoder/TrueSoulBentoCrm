// src/app/api/leads/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("CRITICAL: Supabase URL or Service Key is not defined in your .env.local file.");
    return NextResponse.json({ error: "Server configuration error: Missing Supabase credentials." }, { status: 500 });
  }

  const supabase = createClient<Database>(supabaseUrl, serviceKey);
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';

  try {
    let query;
    if (search) {
      // Use the new RPC call for performing the search
      query = supabase.rpc('search_properties_with_contacts', { search_term: search });
    } else {
      // Original behavior for no search term (initial load)
      query = supabase
        .from('properties_with_contacts')
        .select('*')
        .limit(1000);
    }

    const { data, error, status } = await query;

    if (error) {
      console.error('Supabase client error fetching leads:', { message: error.message, details: error.details, status: status });
      return NextResponse.json(
        { error: `Failed to fetch leads: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Unexpected error in GET /api/leads:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}