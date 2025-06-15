// src/app/api/engine/control/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

type EngineStatus = Database['public']['Enums']['engine_status'];

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createAdminServerClient();
  
  try {
    const { status, campaign_id } = await request.json() as { status: EngineStatus, campaign_id?: string };

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

    if (status === 'paused') {
      updates.last_paused_at = new Date().toISOString();
    }

    if (status === 'running' && currentState?.status === 'paused') {
        if (!campaign_id) {
            return NextResponse.json({ error: "A 'campaign_id' is required to resume a paused campaign." }, { status: 400 });
        }
        
        const { error: rpcError } = await supabase.rpc('adjust_schedule_on_resume', {
            campaign_id_to_resume: campaign_id
        });
        if (rpcError) throw new Error(`Failed to adjust campaign schedule on resume: ${rpcError.message}`);
        
        updates.last_paused_at = null;
    }

    const { error: updateError } = await supabase
        .from('engine_state')
        .update(updates)
        .eq('id', 1);

    if (updateError) throw new Error(`Failed to update engine state: ${updateError.message}`);

    return NextResponse.json({ success: true, message: `Engine state successfully set to '${status}'.` });

  } catch (error: any) {
    console.error('[ENGINE-CONTROL-ERROR]:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}