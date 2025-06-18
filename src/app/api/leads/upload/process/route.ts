import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = session.user.id;
  let body;
  try {
    body = await req.json(); // Expect JSON body
  } catch (error) {
    console.error('Error parsing JSON body:', error);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { jobId, marketRegion } = body;

  if (!jobId || !marketRegion) {
    return NextResponse.json(
      { error: 'Missing required fields: jobId and marketRegion' },
      { status: 400 }
    );
  }

  try {
    // Step 1: Update job status to 'processing' (assuming file is already uploaded and info in DB)
    // The import_leads_from_staging function will handle fetching file from storage, parsing, and staging.
    await supabase
      .from('upload_jobs')
      .update({ status: 'PROCESSING', message: `Processing started for job ID: ${jobId}` })
      .eq('job_id', jobId);

    // Step 2: Call the database function to process the data associated with jobId
    const { error: rpcError } = await supabase.rpc('import_leads_from_staging', {
      p_job_id: jobId,
      p_user_id: userId,
      p_market_region: marketRegion
    });

    if (rpcError) {
      console.error('Error calling import_leads_from_staging:', rpcError);
      await supabase
        .from('upload_jobs')
        .update({ status: 'FAILED', message: 'Error during final import process.' })
        .eq('job_id', jobId);
      return NextResponse.json({ error: 'Error during final import process', details: rpcError.message }, { status: 500 });
    }
    
    // Final success update (import_leads_from_staging should ideally set to COMPLETE)
    // This is a fallback or can be removed if RPC handles it.
    await supabase
      .from('upload_jobs')
      .update({ status: 'COMPLETE', message: 'Import process completed successfully.' })
      .eq('job_id', jobId);

    return NextResponse.json({ message: 'Processing initiated successfully' });

  } catch (error: any) {
    console.error('Error processing upload:', error);
    // Ensure job status is updated on unexpected errors
    if (jobId) {
      await supabase
        .from('upload_jobs')
        .update({ status: 'FAILED', message: error.message || 'An unexpected error occurred during processing.' })
        .eq('job_id', jobId);
    }
    return NextResponse.json({ error: error.message || 'Failed to process upload' }, { status: 500 });
  }
}