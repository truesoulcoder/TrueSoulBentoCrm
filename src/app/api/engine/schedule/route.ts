// src/app/api/engine/schedule/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { logSystemEvent } from '@/services/logService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createAdminServerClient();
  let campaignId: string | null = null;

  try {
    const body = await request.json();
    campaignId = body.campaign_id;

    if (!campaignId) {
      // No need to log here, this is a basic validation error caught by the client.
      return NextResponse.json({ error: "campaign_id is required." }, { status: 400 });
    }

    await logSystemEvent({
        event_type: 'CAMPAIGN_SCHEDULING_START',
        message: `Attempting to schedule jobs for campaign: ${campaignId}`,
        details: { campaignId },
        level: 'INFO'
    });
    
    const { data: jobsCreated, error } = await supabase.rpc('schedule_campaign_jobs', {
      p_campaign_id: campaignId,
    });

    if (error) {
      throw new Error(`RPC Error: ${error.message}`);
    }

    const successMessage = `${jobsCreated} jobs have been successfully scheduled for the campaign.`;
    
    await logSystemEvent({
        event_type: 'CAMPAIGN_SCHEDULING_SUCCESS',
        message: successMessage,
        details: { campaignId, jobsCreated },
        level: 'INFO'
    });

    return NextResponse.json({
      success: true,
      message: successMessage,
      jobs_created: jobsCreated,
    });

  } catch (error: any) {
    const errorMessage = `Failed to schedule campaign jobs: ${error.message}`;
    console.error(`[SCHEDULE-API-ERROR] Campaign ID ${campaignId || 'N/A'}:`, errorMessage);

    await logSystemEvent({
        event_type: 'CAMPAIGN_SCHEDULING_FAILURE',
        message: errorMessage,
        details: { campaignId, error: error.message, stack: error.stack },
        level: 'ERROR'
    });

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}