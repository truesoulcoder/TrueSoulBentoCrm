// supabase/functions/campaign-worker/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// FIX: Define CORS headers directly inside the function to avoid module resolution issues.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log(`Campaign worker function initialized.`);

Deno.serve(async (req) => {
  // This function is called by a Supabase cron job, which includes the service role key.
  // We must validate this to ensure the function can't be triggered publicly.
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Check if the engine is running
    const { data: engineState, error: stateError } = await supabase
      .from('engine_state')
      .select('status')
      .eq('id', 1)
      .single();

    if (stateError) throw new Error(`Failed to fetch engine state: ${stateError.message}`);

    if (engineState?.status !== 'running') {
      const message = `Engine not running (status: ${engineState?.status}). Worker exiting.`;
      console.log(message);
      return new Response(JSON.stringify({ message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // 2. Get the next due job from the database.
    const { data: jobId, error: rpcError } = await supabase.rpc('process_next_campaign_job');

    if (rpcError) throw new Error(`Error fetching next campaign job: ${rpcError.message}`);

    if (!jobId) {
      const message = 'No due jobs found at this time.';
      console.log(message);
      return new Response(JSON.stringify({ message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // 3. Trigger the job processing API endpoint
    const processApiUrl = `${Deno.env.get('NEXT_PUBLIC_SITE_URL')}/api/engine/process-job`;
    console.log(`Found job ${jobId}. Triggering API: ${processApiUrl}`);

    const response = await fetch(processApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ job_id: jobId }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to trigger process-job API for job ${jobId}. Status: ${response.status}. Body: ${errorBody}`);
    }
    
    const responseData = await response.json();
    console.log(`Successfully triggered job ${jobId}. API response:`, responseData.message);

    return new Response(JSON.stringify({ success: true, message: `Triggered job: ${jobId}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Campaign worker execution failed:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});