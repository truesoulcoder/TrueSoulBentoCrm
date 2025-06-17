// src/app/api/system-logs/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // Import createClient from supabase-js
import { logSystemEvent } from '@/services/logService'; // Import logSystemEvent
import type { Database } from '@/types/supabase'; // Import Database type

export const dynamic = 'force-dynamic'; // Ensure this route is dynamic

// FIX: Update SystemEventLog type to include potentially joined profile data
// This type definition will be used on the client-side as well.
// Supabase's select with joins often flattens the result or puts related data under a key,
// so we'll expect a `profiles` object nested if it's a many-to-one or one-to-one relationship.
type SystemEventLogWithProfile = Database['public']['Tables']['system_event_logs']['Row'] & {
  profiles?: { // 'profiles' because we are selecting from it with `profiles(...)`
    full_name: string | null;
    email: string;
    // Add other profile fields if needed
  } | null;
};


export async function GET(request: Request) {
  const supabase = createClient<Database>(
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

  const { searchParams } = new URL(request.url);

  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const eventType = searchParams.get('eventType');
  const level = searchParams.get('level'); // Level is stored in JSONB 'details'
  const campaignId = searchParams.get('campaignId');
  const userId = searchParams.get('userId'); // userId is from the client, if passed

  try {
    // FIX: Select all from system_event_logs and join with profiles to get user's full_name and email.
    // This assumes system_event_logs has a 'user_id' column that can be joined with 'profiles.id'.
    // The 'profiles(...)' syntax tells Supabase to join and select specific fields from the related table.
    let query = supabase
      .from('system_event_logs')
      .select('*, profiles(full_name, email)') // Select all log columns, plus full_name and email from linked profile
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters from query params.
    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    // Note: 'level' is in 'details' JSONB field, so filtering for it would be 'details->>level'.
    // Re-add client-side filtering logic for 'level' in CampaignConsole if needed.
    // For direct columns, simple .eq works.
    if (campaignId) {
      query = query.eq('campaign_id', campaignId); 
    }
    if (userId) {
      query = query.eq('user_id', userId); 
    }
    // If you need to filter by level (which is in details.level), it would look like:
    // if (level) {
    //   query = query.eq('details->>level', level); // Server-side JSONB filtering
    // }


    const { data, error } = await query;

    if (error) {
      console.error('Error fetching system event logs with profiles join:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return data, which will now include nested 'profiles' object if a match was found.
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Unexpected error in GET /api/system-logs (with profiles join):', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}