import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Create a Supabase client
const createServerClient = async () => {
  const cookieStore = await cookies();
  
  // Get session cookie (this would be set by your middleware)
  const supabaseToken = cookieStore.get('supabase-auth-token')?.value;
  
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        // If we have a session token in cookies, use it
        ...(supabaseToken && {
          autoRefreshToken: false,
          detectSessionInUrl: false,
        })
      },
      global: {
        headers: {
          // If we have a session cookie, use it as Authorization
          ...(supabaseToken && {
            Authorization: `Bearer ${supabaseToken}`,
          }),
        },
      },
    }
  );
};

export async function POST(request: Request) {
  try {
    // Get Supabase client
    const supabase = await createServerClient();
    
    // Get user from the session (middleware would have checked this already, 
    // but we'll double-check to be safe)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }
    
    // Parse request body
    const { url, userAgent, title } = await request.json();
    
    if (!url || !url.includes('zillow.com')) {
      return NextResponse.json({
        success: false,
        error: 'Valid Zillow URL required'
      }, { status: 400 });
    }

    // Insert a new job record
    const { data: job, error } = await supabase
      .from('zillow_scraper_jobs')
      .insert({
        zillow_url: url,
        user_agent: userAgent || navigator.userAgent,
        created_by: user.id,
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
