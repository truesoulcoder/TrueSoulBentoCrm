import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Papa from 'papaparse';

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = session.user.id;
  let formData;
  try {
    formData = await req.formData();
  } catch (error) {
    console.error('Error parsing form data:', error);
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File;
  const marketRegion = formData.get('marketRegion') as string;
  const jobId = formData.get('jobId') as string;

  if (!file || !marketRegion || !jobId) {
    return NextResponse.json(
      { error: 'Missing required fields: file, marketRegion, and jobId' },
      { status: 400 }
    );
  }

  try {
    const fileContent = await file.text();

    // Step 1: Parse the CSV file
    const { data: records, errors: parseErrors } = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
    });

    if (parseErrors.length > 0) {
      console.error('CSV parsing errors:', parseErrors);
      await supabase
        .from('upload_jobs')
        .update({ status: 'FAILED', message: 'Failed to parse CSV file.' })
        .eq('job_id', jobId);
      return NextResponse.json({ error: 'Failed to parse CSV file', details: parseErrors }, { status: 400 });
    }

    if (!records || records.length === 0) {
        await supabase
        .from('upload_jobs')
        .update({ status: 'FAILED', message: 'CSV file is empty or contains no data.' })
        .eq('job_id', jobId);
      return NextResponse.json({ error: 'CSV file is empty or contains no data.' }, { status: 400 });
    }

    // Step 2: Update job status to 'processing'
    await supabase
      .from('upload_jobs')
      .update({ status: 'PROCESSING', message: `Staging ${records.length} records...` })
      .eq('job_id', jobId);

    // Step 3: Perform a bulk insert into the staging table
    const { error: stageError } = await supabase
      .from('staging_contacts_csv')
      .insert(records as any[]);

    if (stageError) {
      console.error('Error inserting into staging table:', stageError);
      await supabase
        .from('upload_jobs')
        .update({ status: 'FAILED', message: 'Failed to stage data.' })
        .eq('job_id', jobId);
      return NextResponse.json({ error: 'Failed to stage data', details: stageError.message }, { status: 500 });
    }

    // Step 4: Call the database function to process the staged data
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
    
    // Final success update
    await supabase
      .from('upload_jobs')
      .update({ status: 'COMPLETE', progress: 100, message: 'Import completed successfully.' })
      .eq('job_id', jobId);

    return NextResponse.json({
      message: 'File processed successfully.',
      jobId: jobId,
    });
  } catch (error: any) {
    console.error('Unhandled error during file processing:', error);
    await supabase
      .from('upload_jobs')
      .update({ status: 'FAILED', message: 'An unexpected server error occurred.' })
      .eq('job_id', jobId);
    return NextResponse.json({ error: 'An unexpected server error occurred.', details: error.message }, { status: 500 });
  }
}