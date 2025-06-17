/**
 * Local Zillow Scraper Worker
 * 
 * This script runs locally on your machine/server and polls the Supabase database
 * for zillow_scraper_jobs that need processing. Unlike Vercel Functions, this has
 * no size/runtime constraints and can use Playwright.
 * 
 * To run:
 * 1. Make sure you have a .env file with valid Supabase credentials
 * 2. Run: npx ts-node scripts/local-zillow-scraper-worker.ts
 */

import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { writeFile } from 'fs/promises';
import dotenv from 'dotenv';
import { promisify } from 'util';

// Load .env file
dotenv.config();

const execPromise = promisify(exec);

// Initialize Supabase client - this uses direct connection, not auth
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key for admin access

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
 * Main function to check for and process pending jobs
 */
async function processJobs() {
  console.log('Checking for pending scraper jobs...');
  
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
        console.log('No pending jobs found');
        return;
      }
      
      console.error('Error fetching jobs:', error);
      return;
    }
    
    if (!job) {
      console.log('No pending jobs found');
      return;
    }
    
    console.log(`Processing job ${job.id} for URL: ${job.zillow_url}`);
    
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
      // Run the scraper script
      console.log('Starting scraper...');
      const { stdout, stderr } = await execPromise(`npx cross-env-file .env.scraper ts-node ${scriptPath}`);
      
      if (stderr) {
        console.warn('Scraper warnings:', stderr);
      }
      
      console.log('Scraper output:', stdout);
      
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
      
      console.log(`Job ${job.id} completed successfully. Scraped ${propertiesScraped} properties.`);
      
    } catch (error: any) {
      console.error('Error running scraper script:', error);
      
      // Update job to failed status
      await supabase
        .from('zillow_scraper_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message || 'Unknown error occurred'
        })
        .eq('id', job.id);
        
      console.log(`Job ${job.id} failed.`);
    } finally {
      // Clean up the temporary env file
      fs.unlink(envPath, err => {
        if (err) console.error(`Error removing temporary env file: ${err.message}`);
      });
    }
    
  } catch (error) {
    console.error('Error in job processing:', error);
  }
}

/**
 * Start the worker to poll for jobs
 */
async function startWorker() {
  console.log('Starting Zillow Scraper Worker...');
  console.log(`Polling interval: ${POLLING_INTERVAL}ms`);
  console.log(`Default output directory: ${DEFAULT_OUTPUT_DIR}`);
  
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
      console.log(`[${new Date().toISOString()}] Enhancing scraper script with screenshot logging...`);
      
      // Find the screenshot code and enhance it
      // This is a simple search and replace that looks for common screenshot patterns
      // You may need to adjust based on your actual implementation
      let enhancedCode = originalCode.replace(
        /await page\.screenshot\(\s*{\s*[^}]*}\s*\);/g,
        `try {
          console.log('Attempting to capture screenshot...');
          await page.screenshot({
            $&
          console.log('Screenshot captured successfully');
        } catch (screenshotError) {
          console.error('Failed to capture screenshot:', screenshotError.message);
        }`
      );
      
      // If no replacements were made with the above pattern, try a simpler one
      if (enhancedCode === originalCode) {
        enhancedCode = originalCode.replace(
          /await page\.screenshot\(/g,
          `try {
            console.log('Attempting to capture screenshot...');
            await page.screenshot(`
        ).replace(
          /\);(\s*\/\/[\s\S]*?$|\s*$)/gm,
          `);
            console.log('Screenshot captured successfully');
          } catch (screenshotError) {
            console.error('Failed to capture screenshot:', screenshotError.message);
          }$1`
        );
      }
      
      // Create a backup of the original file
      const backupPath = `${originalScraperPath}.backup`;
      await fs.promises.writeFile(backupPath, originalCode);
      console.log(`[${new Date().toISOString()}] Created backup of original scraper script at ${backupPath}`);
      
      // Write the enhanced code back
      await fs.promises.writeFile(originalScraperPath, enhancedCode);
      console.log(`[${new Date().toISOString()}] Updated scraper script with enhanced screenshot logging`);
    } else {
      console.log(`[${new Date().toISOString()}] Scraper script already has enhanced screenshot logging`);
    }
    
  } catch (err) {
    const error = err as Error;
    console.warn(`[${new Date().toISOString()}] Could not enhance scraper script: ${error.message}`);
    console.warn('You will need to manually add screenshot logging to your Zillow scraper script');
  }
}

// Call the enhancement function when the worker starts
enhanceScraperScript().catch(err => {
  console.error('Failed to enhance scraper script:', err);
});

// Start the worker
startWorker().catch(err => {
  const error = err as Error;
  console.error('Fatal worker error:', error);
  process.exit(1);
});
