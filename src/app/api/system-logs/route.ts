// src/app/api/system-logs/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // Import createClient from supabase-js
import { logSystemEvent } from '@/services/logService'; // Import logSystemEvent
import type { Database } from '@/types/supabase'; // Import Database type

export const dynamic = 'force-dynamic'; // Ensure this route is dynamic

type SystemEventLog = Database['public']['Tables']['system_event_logs']['Row'];

export async function GET(request: Request) {
  let supabase: ReturnType<typeof createClient<Database>>;

  try {
    // Attempt to create Supabase client within a try-catch block
    supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );
  } catch (clientCreationError: any) {
    // If client creation fails, log it and return a JSON error immediately
    console.error('CRITICAL: Supabase client creation failed in /api/system-logs:', clientCreationError);
    try {
      // Attempt to log this critical error, but wrap it in a try-catch
      await logSystemEvent({
        event_type: 'SYSTEM_LOGS_API_CLIENT_ERROR',
        message: `Failed to create Supabase client: ${clientCreationError.message}`,
        level: 'ERROR',
        details: { error: clientCreationError.message, stack: clientCreationError.stack },
      });
    } catch (logError) {
      console.error('Failed to self-log client creation error:', logError);
    }
    return NextResponse.json({ error: 'Failed to initialize Supabase client' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  try {
    // Query logs
    let query = supabase
      .from('system_event_logs')
      .select('id, created_at, event_type, message, details') // Selecting basic columns
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('Supabase query error in /api/system-logs:', error);
      try {
        // Attempt to log the database query error
        await logSystemEvent({
          event_type: 'SYSTEM_LOGS_API_DB_QUERY_ERROR',
          message: `Database query failed: ${error.message}`,
          level: 'ERROR',
          details: { dbError: error.message, code: error.code, hint: error.hint },
        });
      } catch (logError) {
        console.error('Failed to self-log DB query error:', logError);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (runtimeError: any) {
    // Catch any other unexpected runtime errors during the query processing
    console.error('Unexpected runtime error in GET /api/system-logs:', runtimeError);
    try {
      // Attempt to log the unexpected runtime error
      await logSystemEvent({
        event_type: 'SYSTEM_LOGS_API_RUNTIME_ERROR',
        message: `Unexpected runtime error: ${runtimeError.message}`,
        level: 'ERROR',
        details: { error: runtimeError.message, stack: runtimeError.stack },
      });
    } catch (logError) {
      console.error('Failed to self-log runtime error:', logError);
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}