// src/app/api/engine/schedule/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createAdminServerClient();

  try {
    const { campaign_id } = await request.json();

    if (!campaign_id) {
      return NextResponse.json({ error: "campaign_id is required." }, { status: 400 });
    }
    
    // FIX: The `schedule_campaign_jobs` function now only accepts `p_campaign_id`.
    // The market region is derived from the campaign record within the function itself.
    const { data: jobsCreated, error } = await supabase.rpc('schedule_campaign_jobs', {
      p_campaign_id: campaign_id,
    });

    if (error) {
      console.error(`Error calling schedule_campaign_jobs RPC for campaign ${campaign_id}:`, error);
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