// src/app/api/system-logs/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // Import createClient from supabase-js
import { logSystemEvent } from '@/services/logService'; // Import logSystemEvent
import type { Database } from '@/types/supabase'; // Import Database type

export const dynamic = 'force-dynamic'; // Ensure this route is dynamic

type SystemEventLog = Database['public']['Tables']['system_event_logs']['Row'];

export async function GET(request: Request) {
  let supabase: ReturnType<typeof createClient<Database>>; // Declare supabase client outside try block

  try {
    supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use the service role key
      {
        auth: {
          persistSession: false, // Ensure no session persistence
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );
  } catch (clientError: any) {
    // Catch errors during Supabase client creation
    console.error('Error creating Supabase client in /api/system-logs:', clientError);
    // Log this critical error. Note: logSystemEvent itself might fail if client creation fails.
    logSystemEvent({
      event_type: 'SYSTEM_LOGS_API_CLIENT_ERROR',
      message: `Failed to create Supabase client: ${clientError.message}`,
      level: 'ERROR',
      details: { clientError: clientError.message, stack: clientError.stack }
    }).catch(console.error); // Catch potential error from logSystemEvent itself

    return NextResponse.json({ error: 'Failed to initialize Supabase client' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);

  const limit = parseInt(searchParams.get('limit') || '100', 10);
  // Filtering by eventType, level, campaignId, userId is commented out for now
  // to simplify the initial query and diagnose the permission error.

  try {
    // Current approach, simplified select:
    let query = supabase
      .from('system_event_logs')
      .select('id, created_at, event_type, message, details')
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching system event logs from Supabase (basic select):', error);
      logSystemEvent({
        event_type: 'SYSTEM_LOGS_API_DB_QUERY_ERROR',
        message: `Database query failed: ${error.message}`,
        level: 'ERROR',
        details: { dbError: error.message, code: error.code, hint: error.hint }
      }).catch(console.error);

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (runtimeError: any) {
    // Catch any other unexpected runtime errors during the query processing
    console.error('Unexpected runtime error in GET /api/system-logs:', runtimeError.message);
    logSystemEvent({
      event_type: 'SYSTEM_LOGS_API_RUNTIME_ERROR',
      message: `Unexpected runtime error: ${runtimeError.message}`,
      level: 'ERROR',
      details: { errorMessage: runtimeError.message, stack: runtimeError.stack }
    }).catch(console.error);

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}