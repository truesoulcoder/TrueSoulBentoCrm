import { NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';

// Create a Supabase client


export async function POST(request: Request) {
  try {
    const supabase = await createAdminServerClient();
    const { url, userAgent, title } = await request.json();
    if (!url || !url.includes('zillow.com')) {
      return NextResponse.json({ success: false, error: 'Valid Zillow URL required' }, { status: 400 });
    }
    
    if (!url || !url.includes('zillow.com')) {
      return NextResponse.json({
        success: false,
        error: 'Valid Zillow URL required'
      }, { status: 400 });
    }

    const { data: job, error } = await supabase
      .from('zillow_scraper_jobs')
      .insert({
        zillow_url: url,
        user_agent: userAgent || '',
        status: 'pending'
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating scraper job from extension:', error);
      return NextResponse.json({
        success: false,
        error: `Failed to create scraper job: ${error.message}`
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Zillow property scraper job queued successfully. It will run soon on your local system.'
    });
    
  } catch (error: any) {
    console.error('Failed to queue scraper job from extension:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'An unexpected error occurred'
    }, { status: 500 });
  }
}
