// src/app/api/system-logs/route.ts
import { createAdminServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase'; // Import Database type

export const dynamic = 'force-dynamic'; // Ensure this route is dynamic

type SystemEventLog = Database['public']['Tables']['system_event_logs']['Row'];

export async function GET(request: Request) {
  const supabase = await createAdminServerClient();
  const { searchParams } = new URL(request.url);

  // Optional filters for fetching logs
  const limit = parseInt(searchParams.get('limit') || '100', 10); // Default to 100 logs
  const eventType = searchParams.get('eventType');
  const level = searchParams.get('level');
  const campaignId = searchParams.get('campaignId');
  const userId = searchParams.get('userId');

  try {
    let query = supabase
      .from('system_event_logs')
      .select('*')
      .order('created_at', { ascending: false }) // Get most recent logs first
      .limit(limit);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    if (level) {
      query = query.eq('level', level);
    }
    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching system event logs:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Unexpected error in GET /api/system-logs:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}