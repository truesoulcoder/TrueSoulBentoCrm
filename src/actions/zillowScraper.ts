// src/actions/zillowScraper.ts
'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';
import { revalidatePath } from 'next/cache';
import { logSystemEvent } from '@/services/logService';

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
        }),
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
 * @param url The Zillow search URL to scrape
 * @param userAgent The user agent string to use for the scraper
 */
export async function runZillowScraper(
  url: string,
  userAgent: string
): Promise<ScraperResult> {
  try {
    if (!url) {
      await logSystemEvent({
        event_type: 'ZILLOW_SCRAPER_QUEUE_ERROR',
        message: 'Attempted to queue Zillow scraper job without a URL.',
        level: 'ERROR',
        details: { url, userAgent },
      });
      return {
        success: false,
        error: 'URL is required',
      };
    }

    const supabase = await createServerClient();

    // Verify user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      await logSystemEvent({
        event_type: 'ZILLOW_SCRAPER_QUEUE_AUTH_ERROR',
        message: 'Authentication required to queue Zillow scraper job.',
        level: 'ERROR',
        details: { url, userAgent },
      });
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    // Insert a new job record
    const { data: job, error } = await supabase
      .from('zillow_scraper_jobs')
      .insert({
        zillow_url: url,
        user_agent: userAgent || '',
        created_by: user.id,
        status: 'pending',
      } as Database['public']['Tables']['zillow_scraper_jobs']['Insert'])
      .select('id')
      .single();

    if (error) {
      console.error('Error creating scraper job:', error);
      await logSystemEvent({
        event_type: 'ZILLOW_SCRAPER_QUEUE_DB_ERROR',
        message: `Failed to create Zillow scraper job in database: ${error.message}`,
        level: 'ERROR',
        details: { url, userAgent, dbError: error.message },
      });
      return {
        success: false,
        error: `Failed to create scraper job: ${error.message}`,
      };
    }

    // Revalidate any pages that might display job status
    revalidatePath('/dashboard');

    await logSystemEvent({
      event_type: 'ZILLOW_SCRAPER_JOB_QUEUED',
      message: `Zillow property scraper job ${job.id} queued successfully for URL: ${url}.`,
      level: 'INFO',
      details: { jobId: job.id, url, userAgent },
    });

    return {
      success: true,
      jobId: job.id,
      message:
        'Zillow property scraper job queued successfully. It will run soon on your local system.',
    };
  } catch (error: any) {
    console.error('Failed to queue zillow scraper job:', error);
    await logSystemEvent({
      event_type: 'ZILLOW_SCRAPER_QUEUE_UNEXPECTED_ERROR',
      message: `An unexpected error occurred while queuing Zillow scraper job: ${error.message}`,
      level: 'ERROR',
      details: { error: error.message },
    });
    return {
      success: false,
      error: 'Failed to queue scraper job',
    };
  }
}