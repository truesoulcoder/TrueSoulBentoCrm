// src/app/api/engine/schedule/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Authorization can be improved here by checking for superadmin role
  const supabase = createAdminServerClient();

  try {
    const { campaign_id, market_region_id } = await request.json();

    if (!campaign_id) {
      return NextResponse.json({ error: "campaign_id is required." }, { status: 400 });
    }
    if (!market_region_id) {
      return NextResponse.json({ error: "market_region_id is required." }, { status: 400 });
    }
    
    // Call the database function to schedule the jobs
    const { data: jobsCreated, error } = await supabase.rpc('schedule_campaign_jobs', {
      p_campaign_id: campaign_id,
      p_market_region_id: market_region_id,
    });

    if (error) {
      throw new Error(`Failed to schedule campaign jobs: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `${jobsCreated} jobs have been successfully scheduled for the campaign.`,
      jobs_created: jobsCreated,
    });

  } catch (error: any) {
    console.error('[SCHEDULE-API-ERROR]:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}