// src/app/api/campaigns/route.ts
import { createAdminServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createAdminServerClient();
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns with admin client:', error);
      return NextResponse.json(
        { error: `Failed to fetch campaigns: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createAdminServerClient();
  try {
    const campaignData = await request.json();
    const { name, status, user_id, market_region_id, daily_limit, time_window_hours } = campaignData;

    // Validate required fields
    if (!name || !user_id || !market_region_id) {
      return NextResponse.json(
        { error: 'name, user_id, and market_region_id are required.' },
        { status: 400 }
      );
    }

    const { data, error: dbError } = await supabase
      .from('campaigns')
      .insert([{ 
        name, 
        status: status || 'draft', 
        user_id,
        market_region_id,
        daily_limit: daily_limit || 100,
        time_window_hours: time_window_hours || 8
      }])
      .select()
      .single();

    if (dbError) {
      console.error('Failed to create campaign:', dbError);
      return NextResponse.json(
        { error: `Failed to create campaign: ${dbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/campaigns:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}