import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Papa from 'papaparse';

// Helper: split an array into chunks of n
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // 1. Auth
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const userId = session.user.id;

  // 2. Validate body
  let body: { jobId?: string; marketRegion?: string };
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { jobId, marketRegion } = body;
  if (!jobId || !marketRegion) {
    return NextResponse.json({ error: 'Missing jobId or marketRegion' }, { status: 400 });
  }

  // 3. Fetch job row to get storage info
  const {
    data: job,
    error: jobErr,
  } = await supabase
    .from('upload_jobs')
    .select('file_name')
    .eq('job_id', jobId)
    .single();
  if (jobErr || !job) {
    return NextResponse.json({ error: 'Upload job not found' }, { status: 400 });
  }

  // assume all CSV uploads go to the fixed bucket 'lead-uploads'
  const bucket = 'lead-uploads';
  const objectPath = job.file_name; // file_name stores the full path/key

  // 4. Update status → PROCESSING
  await supabase
    .from('upload_jobs')
    .update({ status: 'PROCESSING', progress: 10, message: 'Downloading CSV' })
    .eq('job_id', jobId);

  // 5. Download CSV
  const { data: fileData, error: dlError } = await supabase.storage.from(bucket).download(objectPath);
  if (dlError || !fileData) {
    await supabase
      .from('upload_jobs')
      .update({ status: 'FAILED', message: `Download error: ${dlError?.message}` })
      .eq('job_id', jobId);
    return NextResponse.json({ error: 'Failed to download CSV' }, { status: 500 });
  }
  const csvText = await fileData.text();

  // 6. Parse csv
  const { data: parsedRows, errors: parseErrors } = Papa.parse<any>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  if (parseErrors.length) {
    await supabase
      .from('upload_jobs')
      .update({ status: 'FAILED', message: `CSV parse errors: ${parseErrors[0].message}` })
      .eq('job_id', jobId);
    return NextResponse.json({ error: 'CSV parse error', details: parseErrors }, { status: 500 });
  }

  // 7. Stage rows in chunks
  await supabase
    .from('upload_jobs')
    .update({ status: 'PROCESSING', progress: 30, message: 'Inserting into staging table' })
    .eq('job_id', jobId);

  const chunks = chunkArray(parsedRows as Record<string, any>[], 1000);
  for (let i = 0; i < chunks.length; i++) {
    const { error: insErr } = await supabase
      .from('staging_contacts_csv')
      .insert(chunks[i]);
    if (insErr) {
      await supabase
        .from('upload_jobs')
        .update({ status: 'FAILED', message: `Staging insert error: ${insErr.message}` })
        .eq('job_id', jobId);
      return NextResponse.json({ error: 'Staging insert error', details: insErr.message }, { status: 500 });
    }
    const progress = 30 + Math.round(((i + 1) / chunks.length) * 40); // up to 70
    await supabase
      .from('upload_jobs')
      .update({ progress })
      .eq('job_id', jobId);
  }

  // 8. Call RPC to import
  await supabase
    .from('upload_jobs')
    .update({ status: 'PROCESSING', progress: 75, message: 'Running final import' })
    .eq('job_id', jobId);

  const { error: rpcErr } = await supabase.rpc('import_leads_from_staging', {
    p_job_id: jobId,
    p_user_id: userId,
    p_market_region: marketRegion,
  });
  if (rpcErr) {
    await supabase
      .from('upload_jobs')
      .update({ status: 'FAILED', message: `Import error: ${rpcErr.message}` })
      .eq('job_id', jobId);
    return NextResponse.json({ error: 'Import failed', details: rpcErr.message }, { status: 500 });
  }

  // 9. Success
  await supabase
    .from('upload_jobs')
    .update({ status: 'COMPLETE', progress: 100, message: 'Import completed successfully' })
    .eq('job_id', jobId);

  return NextResponse.json({ message: 'Import completed successfully' });
}