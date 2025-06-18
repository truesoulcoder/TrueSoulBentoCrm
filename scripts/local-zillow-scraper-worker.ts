/**
 * Local Zillow Scraper Worker
 * * This script runs locally on your machine/server and polls the Supabase database
 * for zillow_scraper_jobs that need processing. Unlike Vercel Functions, this has
 * no size/runtime constraints and can use Playwright.
 * * To run:
 * 1. Make sure you have a .env file with valid Supabase credentials
 * 2. Run: npx ts-node scripts/local-zillow-scraper-worker.ts
 */

import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { writeFile, unlink } from 'fs/promises'; // Use promises version
import dotenv from 'dotenv';
import { promisify } from 'util';

// Load .env file
dotenv.config();

const execPromise = promisify(exec);

// Initialize Supabase client - this uses direct connection, not auth
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key for admin access
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'; // Base URL for Next.js API

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase credentials in environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Polling interval in ms (default: check every 30 seconds)
const POLLING_INTERVAL = parseInt(process.env.SCRAPER_POLLING_INTERVAL || '30000', 10);

/**
 * Helper function to send logs to the Next.js API route
 */
async function sendWorkerLog(log: {
  event_type: string;
  message: string;
  details?: any;
  level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  jobId?: string;
  userId?: string;
}) {
  try {
    const { event_type, message, details, level, jobId, userId } = log;
    const logDetails = { ...details, worker: 'local-zillow-scraper-worker.ts', pid: process.pid };

    const response = await fetch(`${siteUrl}/api/worker-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type,
        message,
        details: logDetails,
        level,
        campaign_id: undefined,
        user_id: userId,
        job_id: jobId,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Failed to send log to API: ${response.status} - ${errorBody}`);
    }
  } catch (apiError) {
    console.error(`Error sending log to API: ${apiError}`);
  }
}

/**
 * Main function to check for and process pending jobs
 */
async function processJobs() {
  await sendWorkerLog({
    event_type: 'ZILLOW_WORKER_POLL',
    message: 'Checking for pending scraper jobs...',
    level: 'DEBUG'
  });
  
  try {
    // Get the oldest pending job
    const { data: job, error } = await supabase
      .from('zillow_scraper_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') { // Ignore 'No rows found' error
      await sendWorkerLog({
        event_type: 'ZILLOW_WORKER_DB_ERROR',
        message: 'Error fetching jobs from database.',
        details: { dbError: error.message },
        level: 'ERROR'
      });
      return;
    }
    
    if (!job) {
      // This is the normal state when there are no jobs, no need to log every time.
      return;
    }
    
    await sendWorkerLog({
      event_type: 'ZILLOW_WORKER_JOB_START',
      message: `Processing job ${job.id} for URL: ${job.zillow_url}`,
      details: { jobId: job.id, url: job.zillow_url, createdBy: job.created_by },
      level: 'INFO',
      jobId: job.id,
      userId: job.created_by
    });
    
    // Update job to processing status
    await supabase
      .from('zillow_scraper_jobs')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', job.id);
    
    // Create a temporary .env file for the scraper
    const envPath = path.join(process.cwd(), '.env.scraper');
    await writeFile(
      envPath,
      `SCRAPER_START_URL=${job.zillow_url}\n` +
      `SCRAPER_USER_AGENT=${job.user_agent || ''}\n` +
      `NEXT_PUBLIC_SITE_URL=${siteUrl}\n` + // Pass this to the child process
      `JOB_ID=${job.id}\n` + // FIX: Pass the job ID to the scraper script
      `EXPORT_COOKIES=false\n`
    );
    
    // Path to the scraper script
    const scriptPath = path.join(process.cwd(), 'scripts', 'zillowPropertyScraper.ts');
    
    try {
      await sendWorkerLog({
        event_type: 'ZILLOW_WORKER_SCRAPER_RUN',
        message: `Running scraper script for job ${job.id}.`,
        details: { jobId: job.id, scriptPath },
        level: 'INFO',
        jobId: job.id,
        userId: job.created_by
      });

      // Execute the scraper script using the temporary env file
      const { stdout, stderr } = await execPromise(`npx cross-env-file .env.scraper ts-node ${scriptPath}`);
      
      if (stderr) {
        await sendWorkerLog({
          event_type: 'ZILLOW_WORKER_SCRAPER_WARNING',
          message: `Scraper warnings for job ${job.id}.`,
          details: { jobId: job.id, stderr },
          level: 'WARN',
          jobId: job.id,
          userId: job.created_by
        });
      }
      
      await sendWorkerLog({
        event_type: 'ZILLOW_WORKER_SCRAPER_OUTPUT',
        message: `Scraper output for job ${job.id}.`,
        details: { jobId: job.id, stdout },
        level: 'DEBUG',
        jobId: job.id,
        userId: job.created_by
      });
      
      // Update job to completed status
      await supabase
        .from('zillow_scraper_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      
      await sendWorkerLog({
        event_type: 'ZILLOW_WORKER_JOB_COMPLETED',
        message: `Job ${job.id} completed successfully.`,
        details: { jobId: job.id },
        level: 'INFO',
        jobId: job.id,
        userId: job.created_by
      });
      
    } catch (error: any) {
      await sendWorkerLog({
        event_type: 'ZILLOW_WORKER_SCRAPER_FAILED',
        message: `Error running scraper script for job ${job.id}: ${error.message}`,
        details: { jobId: job.id, errorMessage: error.message, stack: error.stack },
        level: 'ERROR',
        jobId: job.id,
        userId: job.created_by
      });
      
      // Update job to failed status
      await supabase
        .from('zillow_scraper_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message || 'Unknown error occurred'
        })
        .eq('id', job.id);
        
    } finally {
      // Clean up the temporary env file
      await unlink(envPath).catch(err => {
        sendWorkerLog({
          event_type: 'ZILLOW_WORKER_CLEANUP_ERROR',
          message: `Error removing temporary env file for job ${job.id}: ${err.message}`,
          details: { jobId: job.id, envPath, errorMessage: err.message },
          level: 'WARN'
        });
      });
    }
    
  } catch (error) {
    await sendWorkerLog({
      event_type: 'ZILLOW_WORKER_UNEXPECTED_ERROR',
      message: `Unexpected error in job processing: ${error instanceof Error ? error.message : String(error)}`,
      details: { error: error instanceof Error ? error.message : String(error) },
      level: 'ERROR'
    });
  }
}

/**
 * Start the worker to poll for jobs
 */
async function startWorker() {
  await sendWorkerLog({
    event_type: 'ZILLOW_WORKER_START',
    message: 'Starting Zillow Scraper Worker...',
    details: { pollingInterval: POLLING_INTERVAL },
    level: 'INFO'
  });
  
  // Initial check
  await processJobs();
  
  // Set up polling
  setInterval(processJobs, POLLING_INTERVAL);
}

// Start the worker
startWorker().catch(err => {
  const error = err as Error;
  console.error('Fatal worker error:', error);
  sendWorkerLog({
    event_type: 'ZILLOW_WORKER_FATAL_ERROR',
    message: `Fatal worker error: ${error.message}`,
    level: 'ERROR',
    details: { errorMessage: error.message, stack: error.stack }
  });
  process.exit(1);
});