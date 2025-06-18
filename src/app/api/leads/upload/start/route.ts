// src/app/api/leads/upload/start/route.ts
import { createAdminServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { fileName } = await request.json();

  if (!fileName) {
    return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
  }

  const supabase = await createAdminServerClient();

  // Get the authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Create a new job record in the upload_jobs table
    const { data: job, error: insertError } = await supabase
      .from('upload_jobs')
      .insert({
        user_id: user.id,
        file_name: fileName,
        status: 'PENDING',
        progress: 0,
        message: 'Awaiting file upload to storage.',
      })
      .select('job_id')
      .single();

    if (insertError) {
      console.error('Error creating upload job:', insertError);
      throw new Error(insertError.message);
    }

    return NextResponse.json({ jobId: job.job_id });

  } catch (error: any) {
    console.error('[UPLOAD_START_API_ERROR]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
