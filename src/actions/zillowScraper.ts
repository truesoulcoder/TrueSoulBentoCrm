'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';
import { revalidatePath } from 'next/cache';

export interface ScraperResult {
  success: boolean;
  message?: string;
  error?: string;
  jobId?: string;
}

// Create a Supabase client with the auth token from cookies if available
const createServerClient = async () => {
  const cookieStore = await cookies();
  
  // Get session cookie (set by your middleware)
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

/**
 * Server action to queue a Zillow property scraper job
 * Instead of running directly (which won't work on Vercel),
 * this adds the job to a database table that will be processed
 * by a local script running on your server/computer
 * 
 * @param url The Zillow search URL to scrape
 * @param userAgent The user agent string to use for the scraper
 * @returns Result with job information
 */
export async function runZillowScraper(
  url: string,
  userAgent: string
): Promise<ScraperResult> {
  try {
    if (!url) {
      return { 
        success: false, 
        error: 'URL is required' 
      };
    }

    // Get Supabase client
    const supabase = await createServerClient();
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    // Insert a new job record
    const { data: job, error } = await supabase
      .from('zillow_scraper_jobs')
      .insert({
        zillow_url: url,
        user_agent: userAgent || '',
        created_by: user.id,
        status: 'pending'
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating scraper job:', error);
      return {
        success: false,
        error: `Failed to create scraper job: ${error.message}`
      };
    }

    // Revalidate any pages that might display job status
    revalidatePath('/dashboard');
    
    return {
      success: true,
      jobId: job.id,
      message: 'Zillow property scraper job queued successfully. It will run soon on your local system.'
    };
    
  } catch (error) {
    console.error('Failed to queue zillow scraper job:', error);
    return { 
      success: false, 
      error: 'Failed to queue scraper job' 
    };
  }
}
