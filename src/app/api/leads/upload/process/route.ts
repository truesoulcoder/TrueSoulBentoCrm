// src/app/api/leads/upload/process/route.ts
import { createAdminServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'csv-parse';
import { Readable } from 'stream';

// This function will contain the core CSV processing logic
async function processCsv(jobId: string, fileContent: Buffer, marketRegion: string) {
  const supabase = await createAdminServerClient();

  // Update job status to 'PROCESSING'
  await supabase.from('upload_jobs').update({ status: 'PROCESSING', progress: 10, message: 'Parsing CSV...' }).eq('job_id', jobId);

  const records: any[] = [];
  const parser = Readable.from(fileContent).pipe(parse({ columns: true, trim: true }));

  for await (const record of parser) {
    records.push(record);
  }

  await supabase.from('upload_jobs').update({ progress: 50, message: 'Staging data...' }).eq('job_id', jobId);

  // Here you would insert the records into a staging table or directly into your leads table.
  // For this example, we'll simulate the import process.
  // In a real scenario, you would call your `import_from_staging_csv` RPC function here.

  // Example: Insert into a 'staging_contacts_csv' table
  const { error: stageError } = await supabase.from('staging_contacts_csv').insert(records.map(r => ({ ...r, job_id: jobId, market_region: marketRegion })));

  if (stageError) {
    await supabase.from('upload_jobs').update({ status: 'FAILED', progress: 100, message: `Staging failed: ${stageError.message}` }).eq('job_id', jobId);
    throw new Error(`Staging failed: ${stageError.message}`);
  }

  await supabase.from('upload_jobs').update({ progress: 90, message: 'Importing staged data...' }).eq('job_id', jobId);

  // Finalize the import (e.g., call an RPC to merge data)
  // const { error: importError } = await supabase.rpc('import_from_staging_csv', { p_job_id: jobId });
  // if (importError) { ... }

  await supabase.from('upload_jobs').update({ status: 'COMPLETE', progress: 100, message: 'Import successful!' }).eq('job_id', jobId);
}

export async function POST(request: NextRequest) {
  const { jobId, marketRegion } = await request.json();

  if (!jobId || !marketRegion) {
    return NextResponse.json({ error: 'jobId and marketRegion are required' }, { status: 400 });
  }

  const supabase = await createAdminServerClient();

  try {
    // 1. Fetch job details to get user_id and file_name
    const { data: job, error: jobError } = await supabase
      .from('upload_jobs')
      .select('user_id, file_name')
      .eq('job_id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found for ID: ${jobId}`);
    }

    // 2. Download the file from Supabase Storage using the correct path
    await supabase.from('upload_jobs').update({ status: 'PROCESSING', message: 'Downloading file from storage...' }).eq('job_id', jobId);
    const filePath = `${job.user_id}/${jobId}/${job.file_name}`;
    const { data: fileData, error: downloadError } = await supabase.storage.from('lead-uploads').download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download file from storage: ${downloadError.message}`);
    }

    const fileContent = Buffer.from(await fileData.arrayBuffer());

    // 3. Process the file (this will run in the background)
    // The processCsv function will handle updating the job status from here
    processCsv(jobId, fileContent, marketRegion).catch(async (e) => {
        console.error(`[UPLOAD_PROCESS_BG_ERROR] for job ${jobId}:`, e.message);
        await supabase.from('upload_jobs').update({ status: 'FAILED', progress: 100, message: e.message }).eq('job_id', jobId);
    });

    // 4. Immediately return a response to the client
    return NextResponse.json({ message: 'File processing started.' });

  } catch (error: any) {
    console.error(`[UPLOAD_PROCESS_API_ERROR] for job ${jobId}:`, error.message);
    // Update the job with the error
    await supabase.from('upload_jobs').update({ status: 'FAILED', progress: 100, message: error.message }).eq('job_id', jobId);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
