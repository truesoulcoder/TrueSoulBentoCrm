// src/app/api/leads/upload/process/route.ts
import { createAdminServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'csv-parse';
import { Readable } from 'stream';

// This function will contain the core CSV processing logic
async function processCsv(
  jobId: string,
  userId: string,
  fileContent: Buffer,
  marketRegionName: string,
  filePath: string // Added for deletion on failure
) {
  const supabase = await createAdminServerClient();

  // Idempotency check: if job status is COMPLETE or FAILED, log and return
  const { data: jobStatus, error: jobStatusError } = await supabase
    .from('upload_jobs')
    .select('status')
    .eq('job_id', jobId)
    .single();

  if (jobStatusError || !jobStatus) {
    console.error(`[PROCESS_CSV_IDEMPOTENCY_ERROR] Job ${jobId}: Unable to fetch job status.`);
    return;
  }

  if (jobStatus.status === 'COMPLETE' || jobStatus.status === 'FAILED') {
    console.log(`[PROCESS_CSV_IDEMPOTENCY_SKIP] Job ${jobId}: Already ${jobStatus.status}, skipping processing.`);
    return;
  }

  try {
    await supabase.from('upload_jobs').update({ status: 'PROCESSING', progress: 5, message: 'Initializing processing...' }).eq('job_id', jobId);

    // 1. Parse CSV
    await supabase.from('upload_jobs').update({ progress: 10, message: 'Parsing CSV...' }).eq('job_id', jobId);
    const parsedCsvRecords: any[] = [];
    const parser = Readable.from(fileContent).pipe(parse({ columns: true, trim: true, skip_empty_lines: true }));
    for await (const record of parser) {
      parsedCsvRecords.push(record);
    }

    if (parsedCsvRecords.length === 0) {
      await supabase.from('upload_jobs').update({ status: 'FAILED', progress: 100, message: 'CSV file is empty or contains no valid records.' }).eq('job_id', jobId);
      return;
    }
    await supabase.from('upload_jobs').update({ progress: 20, message: `Parsed ${parsedCsvRecords.length} records. Processing market region...` }).eq('job_id', jobId);

    // 2. Upsert Market Region
    // The 'normalized_name' column in 'market_regions' handles case-insensitivity and trimming for uniqueness.
    const { data: regionData, error: regionError } = await supabase
      .from('market_regions')
      .upsert(
        { name: marketRegionName, created_by: userId },
        { onConflict: 'normalized_name', ignoreDuplicates: false }
      )
      .select('id')
      .single();

    if (regionError || !regionData) {
      throw new Error(`Failed to upsert market region '${marketRegionName}': ${regionError?.message || 'No data returned'}`);
    }
    const marketRegionId = regionData.id;
    await supabase.from('upload_jobs').update({ progress: 30, message: `Market region '${marketRegionName}' processed. Preparing leads...` }).eq('job_id', jobId);

    // 3. Prepare Leads for Insertion
    // IMPORTANT: Adjust the mapping logic below to match your CSV columns and 'properties' table structure.
    const leadsToInsert = parsedCsvRecords.map(csvRecord => ({
      // Example: map 'Property Address' CSV column to 'property_address' table column
      property_address: csvRecord['PropertyAddress'],
      property_city: csvRecord['PropertyCity'],
      property_postal_code: csvRecord['PropertyPostalCode'],
      property_state: csvRecord['PropertyState'],
      // Add other relevant lead fields from your CSV
      // Assuming your 'properties' table has these columns:
      market_region_id: marketRegionId,
      user_id: userId, // Owner of the lead
      // Add a status for new leads, e.g., 'new'
            status: csvRecord['Status'] || 'New Lead', 
      // Raw CSV data can be stored for auditing/debugging if you have a jsonb column
      // raw_csv_data: csvRecord 
    }));

    await supabase.from('upload_jobs').update({ progress: 40, message: 'Leads prepared. Inserting into database...' }).eq('job_id', jobId);

    // 4. Batch Insert Leads into 'properties' table
    // IMPORTANT: Replace 'properties' with your actual leads table name if different.
    const { error: insertLeadsError } = await supabase.from('properties').insert(leadsToInsert);
    if (insertLeadsError) {
      throw new Error(`Failed to insert leads: ${insertLeadsError.message}`);
    }

    await supabase.from('upload_jobs').update({ progress: 70, message: `${leadsToInsert.length} leads inserted. Updating market region stats...` }).eq('job_id', jobId);

    // 5. Atomically update Lead Count in market_regions table
    const { error: updateCountError } = await supabase.rpc('increment_lead_count', {
      region_id: marketRegionId,
      increment_value: leadsToInsert.length,
    });

    if (updateCountError) {
      // Log this error but don't fail the whole job, as leads are already inserted.
      console.error(`Job ${jobId}: Failed to update lead count for market region ${marketRegionId}: ${updateCountError.message}`);
      await supabase.from('upload_jobs').update({ progress: 90, message: `Processing complete. Warning: Failed to update market region lead count.` }).eq('job_id', jobId);
    } else {
      await supabase.from('upload_jobs').update({ progress: 90, message: 'Market region stats updated.' }).eq('job_id', jobId);
    }

    await supabase.from('upload_jobs').update({ status: 'COMPLETE', progress: 100, message: 'Processing complete.' }).eq('job_id', jobId);

  } catch (error: any) {
    console.error(`[PROCESS_CSV_ERROR] Job ${jobId}:`, error.message);
    await supabase
      .from('upload_jobs')
      .update({ status: 'FAILED', progress: 0, message: `Error: ${error.message}` })
      .eq('job_id', jobId);

    // Attempt to delete the file from storage on failure
    try {
      console.log(`[PROCESS_CSV_CLEANUP] Attempting to delete file ${filePath} for failed job ${jobId}`);
      const { error: deleteError } = await supabase.storage.from('lead-uploads').remove([filePath]);
      if (deleteError) {
        console.error(`[PROCESS_CSV_CLEANUP_ERROR] Failed to delete file ${filePath} for job ${jobId}:`, deleteError.message);
      } else {
        console.log(`[PROCESS_CSV_CLEANUP_SUCCESS] Successfully deleted file ${filePath} for job ${jobId}`);
      }
    } catch (cleanupError: any) {
      console.error(`[PROCESS_CSV_CLEANUP_EXCEPTION] Exception during file deletion for job ${jobId}:`, cleanupError.message);
    }
  }
}

export async function POST(req: NextRequest) {
  const { jobId, marketRegion } = await req.json(); // marketRegion here is marketRegionName

  if (!jobId || !marketRegion) {
    return NextResponse.json({ error: 'Job ID and market region name are required.' }, { status: 400 });
  }

  const supabase = await createAdminServerClient();

  try {
    // 1. Fetch job details to get user_id and file_name
    await supabase.from('upload_jobs').update({ status: 'PROCESSING', message: 'Fetching job details...' }).eq('job_id', jobId);
    const { data: job, error: jobError } = await supabase
      .from('upload_jobs')
      .select('user_id, file_name')
      .eq('job_id', jobId)
      .single();

    if (jobError || !job || !job.user_id) {
      throw new Error(`Job not found or user_id missing for ID: ${jobId}. Error: ${jobError?.message}`);
    }
    const userId = job.user_id; // Extracted userId

    // 2. Download the file from Supabase Storage using the correct path
    await supabase.from('upload_jobs').update({ status: 'PROCESSING', message: 'Downloading file from storage...' }).eq('job_id', jobId);
    const filePath = `${userId}/${jobId}/${job.file_name}`;
    const { data: fileData, error: downloadError } = await supabase.storage.from('lead-uploads').download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download file from storage: ${downloadError.message}`);
    }

    const fileContentBuffer = Buffer.from(await fileData.arrayBuffer());

    // 3. Process the file (this will run in the background)
    // Pass userId to processCsv
    processCsv(jobId, userId, fileContentBuffer, marketRegion, filePath).catch(async (e) => {
        // This catch is for unhandled promise rejections from processCsv itself, though processCsv has its own try/catch.
        console.error(`[UPLOAD_PROCESS_BG_UNHANDLED_ERROR] for job ${jobId}:`, e.message);
        await supabase.from('upload_jobs').update({ status: 'FAILED', progress: 100, message: `Unhandled BG Error: ${e.message}` }).eq('job_id', jobId);
    });

    // 4. Immediately return a response to the client
    return NextResponse.json({ success: true, message: 'File processing started.', jobId });

  } catch (error: any) {
    console.error(`[UPLOAD_PROCESS_API_ERROR] for job ${jobId}:`, error.message);
    // Update the job with the error
    await supabase.from('upload_jobs').update({ status: 'FAILED', progress: 100, message: error.message }).eq('job_id', jobId);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
