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

// Output directory for scraped data
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'data', 'zillow-properties');

// Ensure output directory exists
if (!fs.existsSync(DEFAULT_OUTPUT_DIR)) {
  fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });
  console.log(`Created output directory: ${DEFAULT_OUTPUT_DIR}`);
}

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
    const logDetails = { ...details, worker: true, pid: process.pid };

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
        campaign_id: undefined, // Not directly campaign related here
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
    
    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        await sendWorkerLog({
          event_type: 'ZILLOW_WORKER_NO_JOBS',
          message: 'No pending jobs found.',
          level: 'DEBUG'
        });
        return;
      }
      
      await sendWorkerLog({
        event_type: 'ZILLOW_WORKER_DB_ERROR',
        message: 'Error fetching jobs from database.',
        details: { dbError: error.message },
        level: 'ERROR'
      });
      return;
    }
    
    if (!job) {
      await sendWorkerLog({
        event_type: 'ZILLOW_WORKER_NO_JOBS',
        message: 'No pending jobs found.',
        level: 'DEBUG'
      });
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
    
    // Create a unique output directory for this job
    const timestamp = new Date().toISOString().replace(/[:T.]/g, '-').replace('Z', '');
    const jobOutputDir = path.join(DEFAULT_OUTPUT_DIR, `job-${timestamp}`);
    
    if (!fs.existsSync(jobOutputDir)) {
      fs.mkdirSync(jobOutputDir, { recursive: true });
    }
    
    // Update job with output directory
    await supabase
      .from('zillow_scraper_jobs')
      .update({ output_directory: jobOutputDir })
      .eq('id', job.id);
    
    // Create a temporary .env file for the scraper
    const envPath = path.join(process.cwd(), '.env.scraper');
    await writeFile(
      envPath,
      `SCRAPER_START_URL=${job.zillow_url}\n` +
      `SCRAPER_USER_AGENT=${job.user_agent || ''}\n` +
      `SCRAPER_OUTPUT_DIR=${jobOutputDir}\n` +
      `EXPORT_COOKIES=false\n`
    );
    
    // Path to the scraper script
    const scriptPath = path.join(process.cwd(), 'scripts', 'zillowPropertyScraper.ts');
    
    try {
      await sendWorkerLog({
        event_type: 'ZILLOW_WORKER_SCRAPER_RUN',
        message: `Running scraper script for job ${job.id}.`,
        details: { jobId: job.id, scriptPath, outputDir: jobOutputDir },
        level: 'INFO',
        jobId: job.id,
        userId: job.created_by
      });
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
      
      // Try to determine how many properties were scraped
      let propertiesScraped = 0;
      
      // Look for JSON files in the output directory to count properties
      const files = fs.readdirSync(jobOutputDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      propertiesScraped = jsonFiles.length;
      
      // Update job to completed status
      await supabase
        .from('zillow_scraper_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          properties_scraped: propertiesScraped
        })
        .eq('id', job.id);
      
      await sendWorkerLog({
        event_type: 'ZILLOW_WORKER_JOB_COMPLETED',
        message: `Job ${job.id} completed successfully. Scraped ${propertiesScraped} properties.`,
        details: { jobId: job.id, propertiesScraped },
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
        
      await sendWorkerLog({
        event_type: 'ZILLOW_WORKER_JOB_FAILED',
        message: `Job ${job.id} failed.`,
        details: { jobId: job.id, error: error.message },
        level: 'ERROR',
        jobId: job.id,
        userId: job.created_by
      });
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
    details: { pollingInterval: POLLING_INTERVAL, outputDir: DEFAULT_OUTPUT_DIR },
    level: 'INFO'
  });
  
  // Initial check
  await processJobs();
  
  // Set up polling
  setInterval(processJobs, POLLING_INTERVAL);
}

// Enhance the worker script to add explicit console logging for screenshot operations
async function enhanceScraperScript(): Promise<void> {
  // Path to the original scraper script
  const originalScraperPath = path.join(process.cwd(), 'scripts', 'zillowPropertyScraper.ts');
  
  // Check if the file exists
  try {
    await fs.promises.access(originalScraperPath);
    
    // Read the original file
    const originalCode = await fs.promises.readFile(originalScraperPath, 'utf-8');
    
    // Only update if it doesn't already have our enhanced logging
    if (!originalCode.includes('Screenshot captured successfully')) {
      await sendWorkerLog({
        event_type: 'ZILLOW_WORKER_SCRIPT_ENHANCEMENT',
        message: 'Enhancing scraper script with screenshot logging...',
        level: 'INFO'
      });
      
      // Find the screenshot code and enhance it
      // This is a simple search and replace that looks for common screenshot patterns
      // You may need to adjust based on your actual implementation
      let enhancedCode = originalCode.replace(
        /await page\.screenshot\(\s*{\s*([^}]*)}\s*\);/g,
        `try {
          // Log attempt to capture screenshot
          const eventDetails = { jobId: job?.id, userId: job?.created_by, action: 'attempt_screenshot' };
          fetch('${siteUrl}/api/worker-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_type: 'ZILLOW_SCRAPER_SCREENSHOT_ATTEMPT', message: 'Attempting to capture screenshot...', details: eventDetails, level: 'DEBUG' }),
          }).catch(err => console.warn('Failed to log screenshot attempt to API:', err.message));
          
          await page.screenshot({$1});
          
          // Log screenshot success
          fetch('${siteUrl}/api/worker-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_type: 'ZILLOW_SCRAPER_SCREENSHOT_SUCCESS', message: 'Screenshot captured successfully', details: eventDetails, level: 'DEBUG' }),
          }).catch(err => console.warn('Failed to log screenshot success to API:', err.message));
        } catch (screenshotError: any) {
          // Log screenshot failure
          const eventDetails = { jobId: job?.id, userId: job?.created_by, action: 'screenshot_failed', errorMessage: screenshotError.message };
          fetch('${siteUrl}/api/worker-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_type: 'ZILLOW_SCRAPER_SCREENSHOT_FAILED', message: 'Failed to capture screenshot', details: eventDetails, level: 'ERROR' }),
          }).catch(err => console.warn('Failed to log screenshot error to API:', err.message));
        }`
      );
      
      // If no replacements were made with the above pattern, try a simpler one
      if (enhancedCode === originalCode) {
        enhancedCode = originalCode.replace(
          /await page\.screenshot\(/g,
          `try {
            const eventDetails = { jobId: job?.id, userId: job?.created_by, action: 'attempt_screenshot' };
            fetch('${siteUrl}/api/worker-logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event_type: 'ZILLOW_SCRAPER_SCREENSHOT_ATTEMPT', message: 'Attempting to capture screenshot...', details: eventDetails, level: 'DEBUG' }),
            }).catch(err => console.warn('Failed to log screenshot attempt to API:', err.message));
            
            await page.screenshot(`
        ).replace(
          /\);(\s*\/\/[\s\S]*?$|\s*$)/gm,
          `);
            fetch('${siteUrl}/api/worker-logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event_type: 'ZILLOW_SCRAPER_SCREENSHOT_SUCCESS', message: 'Screenshot captured successfully', details: { jobId: job?.id, userId: job?.created_by, action: 'screenshot_success' }, level: 'DEBUG' }),
            }).catch(err => console.warn('Failed to log screenshot success to API:', err.message));
          } catch (screenshotError: any) {
            fetch('${siteUrl}/api/worker-logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event_type: 'ZILLOW_SCRAPER_SCREENSHOT_FAILED', message: 'Failed to capture screenshot', details: { jobId: job?.id, userId: job?.created_by, action: 'screenshot_failed', errorMessage: screenshotError.message }, level: 'ERROR' }),
            }).catch(err => console.warn('Failed to log screenshot error to API:', err.message));
          }$1`
        );
      }
      
      // Create a backup of the original file
      const backupPath = `${originalScraperPath}.backup`;
      await fs.promises.writeFile(backupPath, originalCode);
      await sendWorkerLog({
        event_type: 'ZILLOW_WORKER_SCRIPT_BACKUP',
        message: `Created backup of original scraper script at ${backupPath}.`,
        level: 'INFO',
        details: { backupPath }
      });
      
      // Write the enhanced code back
      await fs.promises.writeFile(originalScraperPath, enhancedCode);
      await sendWorkerLog({
        event_type: 'ZILLOW_WORKER_SCRIPT_ENHANCED',
        message: 'Updated scraper script with enhanced screenshot logging.',
        level: 'INFO',
        details: { scriptPath: originalScraperPath }
      });
    } else {
      await sendWorkerLog({
        event_type: 'ZILLOW_WORKER_SCRIPT_ALREADY_ENHANCED',
        message: 'Scraper script already has enhanced screenshot logging.',
        level: 'DEBUG'
      });
    }
    
  } catch (err) {
    const error = err as Error;
    await sendWorkerLog({
      event_type: 'ZILLOW_WORKER_SCRIPT_ENHANCEMENT_FAILED',
      message: `Could not enhance scraper script: ${error.message}`,
      level: 'WARN',
      details: { errorMessage: error.message, stack: error.stack }
    });
    console.warn('You will need to manually add screenshot logging to your Zillow scraper script');
  }
}

// Call the enhancement function when the worker starts
enhanceScraperScript().catch(err => {
  console.error('Failed to enhance scraper script:', err);
  sendWorkerLog({
    event_type: 'ZILLOW_WORKER_ENHANCEMENT_CRITICAL_FAILURE',
    message: `Critical failure during scraper script enhancement: ${err instanceof Error ? err.message : String(err)}`,
    level: 'ERROR',
    details: { error: err instanceof Error ? err.message : String(err) }
  });
});

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