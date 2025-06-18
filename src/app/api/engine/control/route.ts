// src/app/api/engine/control/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';
import { logSystemEvent } from '@/services/logService';

type EngineStatus = Database['public']['Enums']['engine_status'];

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createAdminServerClient();
  let status: EngineStatus | null = null;
  let campaignId: string | null = null;
  
  try {
    const body = await request.json() as { status: EngineStatus, campaign_id?: string };
    status = body.status;
    campaignId = body.campaign_id || null;

    if (!status || !['running', 'paused', 'stopped'].includes(status)) {
      return NextResponse.json({ error: "Invalid 'status' provided. Must be 'running', 'paused', or 'stopped'." }, { status: 400 });
    }

    const { data: currentState, error: fetchError } = await supabase
      .from('engine_state')
      .select('status, last_paused_at')
      .eq('id', 1)
      .single();

    if (fetchError) throw new Error(`Failed to fetch current engine state: ${fetchError.message}`);

    const updates: { status: EngineStatus; last_paused_at?: string | null } = { status };
    let logMessage = `Request to set engine state to '${status}'.`;

    if (status === 'paused') {
      updates.last_paused_at = new Date().toISOString();
      logMessage = `Engine pause requested.`;
    }

    if (status === 'running' && currentState?.status === 'paused') {
        if (!campaignId) {
            return NextResponse.json({ error: "A 'campaign_id' is required to resume a paused campaign." }, { status: 400 });
        }
        
        logMessage = `Engine resume requested for campaign ${campaignId}. Adjusting schedule.`;
        await logSystemEvent({ event_type: 'ENGINE_RESUME_START', message: logMessage, details: { campaignId }, level: 'INFO' });

        const { error: rpcError } = await supabase.rpc('adjust_schedule_on_resume', {
            campaign_id_to_resume: campaignId
        });
        if (rpcError) throw new Error(`Failed to adjust campaign schedule on resume: ${rpcError.message}`);
        
        updates.last_paused_at = null;
        logMessage = `Engine resumed successfully for campaign ${campaignId}.`;
    }

    await logSystemEvent({ event_type: 'ENGINE_STATE_CHANGE_ATTEMPT', message: logMessage, details: { targetStatus: status, campaignId }, level: 'INFO' });

    const { error: updateError } = await supabase
        .from('engine_state')
        .update(updates)
        .eq('id', 1);

    if (updateError) throw new Error(`Failed to update engine state: ${updateError.message}`);

    const finalMessage = `Engine state successfully set to '${status}'.`;
    await logSystemEvent({ event_type: 'ENGINE_STATE_CHANGE_SUCCESS', message: finalMessage, details: { status, campaignId }, level: 'INFO' });

    return NextResponse.json({ success: true, message: finalMessage });

  } catch (error: any) {
    const errorMessage = `Engine control failed: ${error.message}`;
    console.error('[ENGINE-CONTROL-ERROR]:', errorMessage);
    await logSystemEvent({ event_type: 'ENGINE_STATE_CHANGE_FAILURE', message: errorMessage, details: { targetStatus: status, campaignId, error: error.message, stack: error.stack }, level: 'ERROR'});
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
    const supabase = await createAdminServerClient();
    try {
        const { data, error } = await supabase.from('engine_state').select('*').eq('id', 1).single();
        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[ENGINE-CONTROL-GET-ERROR]:', error.message);
        // Do not log GET errors to the system event log as they can be noisy.
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}