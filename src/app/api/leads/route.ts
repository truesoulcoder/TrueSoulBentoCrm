// src/app/api/leads/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("CRITICAL: Supabase URL or Service Key is not defined in your .env.local file.");
    return NextResponse.json({ error: "Server configuration error: Missing Supabase credentials." }, { status: 500 });
  }

  // --- DIAGNOSTIC STEP: Test basic network connectivity ---
  try {
    console.log(`[DIAGNOSTIC] Attempting direct fetch to: ${supabaseUrl}`);
    const diagnosticUrl = `${supabaseUrl}/rest/v1/properties_with_contacts?select=property_id&limit=1`;
    
    const res = await fetch(diagnosticUrl, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      cache: 'no-store',
    });

    console.log(`[DIAGNOSTIC] Direct fetch responded with status: ${res.status}`);
    
    if (!res.ok) {
      const errorBody = await res.text();
      // This is not a network failure, but a Supabase API error (e.g., wrong key, RLS). This is still a "successful" connection.
      console.error(`[DIAGNOSTIC] Direct fetch failed with status ${res.status}. Response: ${errorBody}`);
    } else {
      console.log(`[DIAGNOSTIC] Direct network connection to Supabase is OK.`);
    }
  } catch (e: any) {
    console.error('[DIAGNOSTIC] The direct fetch failed entirely. This confirms a network, DNS, or firewall issue.', e);
    return NextResponse.json(
      { 
        error: 'Failed to connect to the database service. This is likely a network or environment variable issue.',
        details: e.message
      }, 
      { status: 500 }
    );
  }
  // --- END DIAGNOSTIC STEP ---

  // If diagnostics passed, attempt the call with the Supabase client
  const supabase = createClient<Database>(supabaseUrl, serviceKey);

  try {
    const { data, error, status } = await supabase
      .from('properties_with_contacts')
      .select('*');

    if (error) {
      console.error('Supabase client error fetching leads:', { message: error.message, details: error.details, status: status });
      return NextResponse.json(
        { error: `Failed to fetch leads: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred inside the Supabase client block.';
    console.error('Unexpected error in GET /api/leads:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}