import { chromium, Browser, Page, BrowserContext, devices } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { setTimeout } from 'timers/promises';
import sanitize from 'sanitize-filename';

// Configuration is now read directly from environment variables set by the worker
const config = {
  startUrl: process.env.SCRAPER_START_URL!,
  cookiesFilePath: path.join(process.cwd(), 'scripts', 'zillow-cookies.json'),
  delayBetweenActions: 2000,
  delayBetweenPages: 5000,
  userAgent: process.env.SCRAPER_USER_AGENT || devices['Desktop Chrome'].userAgent,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  jobId: process.env.JOB_ID!,
};

// Validate required config from worker
if (!config.startUrl || !config.jobId || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const errorMessage = "Scraper script is missing required environment variables (URL, JobID, or Supabase credentials).";
  console.error(errorMessage);
  // Attempt to log error before exiting
  sendScraperLog('ERROR', 'SCRAPER_MISSING_ENV', errorMessage, { receivedEnv: process.env });
  process.exit(1);
}

// Initialize Supabase client for storage uploads
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Centralized logging helper for the scraper script
async function sendScraperLog(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', event_type: string, message: string, details?: object) {
  if (!config.siteUrl) {
    console.log(`[${level}] ${message}`, details || '');
    return;
  }
  try {
    await fetch(`${config.siteUrl}/api/worker-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, event_type, message, details: { ...details, jobId: config.jobId, script: 'zillowPropertyScraper.ts' } }),
    });
  } catch (e) {
    console.error(`[Log Send Error] ${message}`, e);
  }
}


class ZillowPropertyScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private propertyCounter = 0;
  
  async init() {
    try {
      await sendScraperLog('DEBUG', 'SCRAPER_INIT_START', 'Initializing browser...');
      this.browser = await chromium.launch({ headless: false, slowMo: 50 });
      this.context = await this.browser.newContext({
        ...devices['Desktop Chrome'],
        userAgent: config.userAgent,
        locale: 'en-US',
        timezoneId: 'America/Chicago'
      });
      await this.loadCookiesIfExists();
      this.page = await this.context.newPage();
      await sendScraperLog('INFO', 'SCRAPER_INIT_SUCCESS', 'Browser initialized successfully');
      return true;
    } catch (error) {
      await sendScraperLog('ERROR', 'SCRAPER_INIT_FAILURE', `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`, { error });
      return false;
    }
  }
  
  async loadCookiesIfExists() {
    if (!this.context) return;
    try {
      if (fs.existsSync(config.cookiesFilePath)) {
        const cookiesString = fs.readFileSync(config.cookiesFilePath, 'utf8');
        const cookies = JSON.parse(cookiesString);
        await this.context.addCookies(cookies);
        await sendScraperLog('DEBUG', 'SCRAPER_COOKIES_LOADED', 'Cookies loaded successfully');
      }
    } catch (error) {
      await sendScraperLog('ERROR', 'SCRAPER_COOKIE_LOAD_ERROR', `Error loading cookies: ${error instanceof Error ? error.message : String(error)}`, { error });
    }
  }
  
  async navigateToStartUrl() {
    if (!this.page) return false;
    try {
      await sendScraperLog('INFO', 'SCRAPER_NAVIGATING', `Navigating to ${config.startUrl}`);
      await this.page.goto(config.startUrl, { timeout: 60000, waitUntil: 'networkidle' });
      await this.page.waitForSelector('[data-testid="search-page-list-container"]', { timeout: 60000 });
      await sendScraperLog('INFO', 'SCRAPER_NAV_SUCCESS', 'Navigation successful');
      return true;
    } catch (error) {
      await sendScraperLog('ERROR', 'SCRAPER_NAV_FAILURE', `Error navigating to start URL: ${error instanceof Error ? error.message : String(error)}`, { error });
      return false;
    }
  }
  
  async processListings() {
    // ... (This function remains largely the same, but now calls the logging function)
    if (!this.page) return false;
    let hasMorePages = true;
    let currentPage = 1;
    
    while (hasMorePages) {
      try {
        await sendScraperLog('INFO', 'SCRAPER_PAGE_PROCESSING', `Processing page ${currentPage}...`);
        await this.page.waitForSelector('[data-testid="property-card-link"]', { timeout: 30000 });
        const propertyCards = await this.page.$$('[data-testid="property-card-link"]');
        await sendScraperLog('INFO', 'SCRAPER_CARDS_FOUND', `Found ${propertyCards.length} property cards on page ${currentPage}`);
        
        for (let i = 0; i < propertyCards.length; i++) {
          const currentCards = await this.page.$$('[data-testid="property-card-link"]');
          if (i >= currentCards.length) break;
          const searchPageUrl = this.page.url();
          
          try {
            await currentCards[i].scrollIntoViewIfNeeded();
            await this.humanDelay(1000);
            await currentCards[i].click();
            await this.page.waitForSelector('#search-detail-lightbox', { timeout: 30000 });
            await this.humanDelay(2000);
            
            if (await this.processPropertyModal()) {
              this.propertyCounter++;
            }
            
            const closeButton = await this.page.$('button[aria-label="Close"]');
            if (closeButton) {
                await closeButton.click();
                await this.humanDelay(1000);
            }
          } catch (propertyError) {
             await sendScraperLog('ERROR', 'SCRAPER_PROPERTY_ERROR', `Error processing property card #${i + 1}: ${propertyError instanceof Error ? propertyError.message : String(propertyError)}`, { propertyError });
             if (this.page.url() !== searchPageUrl) {
                await this.page.goto(searchPageUrl, { timeout: 30000, waitUntil: 'networkidle' });
             }
          }
        }
        
        hasMorePages = await this.goToNextPage(currentPage);
        if (hasMorePages) currentPage++;
        
      } catch (error) {
        await sendScraperLog('ERROR', 'SCRAPER_PAGE_ERROR', `Error processing listings on page ${currentPage}: ${error instanceof Error ? error.message : String(error)}`, { error });
        return false;
      }
    }
    
    // This log is now sent by the worker script upon successful completion.
    return true;
  }
  
  async processPropertyModal(): Promise<boolean> {
    if (!this.page) return false;
    try {
      const addressSelector = '#search-detail-lightbox h1';
      await this.page.waitForSelector(addressSelector, { timeout: 20000 });
      const address = await this.page.textContent(addressSelector);
      const propertyAddress = address ? address.trim() : `unknown_property_${Date.now()}`;
      return await this.takeFullModalScreenshot(propertyAddress);
    } catch (error) {
       await sendScraperLog('ERROR', 'SCRAPER_MODAL_ERROR', `Error processing property modal: ${error instanceof Error ? error.message : String(error)}`, { error });
      return false;
    }
  }
  
  async takeFullModalScreenshot(propertyAddress: string): Promise<boolean> {
    if (!this.page) return false;
    try {
      const sanitizedAddress = sanitize(propertyAddress).replace(/\s+/g, '_');
      const filename = `${sanitizedAddress}.png`;
      
      // FIX: Define storage path instead of local path
      const storagePath = `screenshots/${config.jobId}/${filename}`;
      
      const screenshotBuffer = await this.page.screenshot({ fullPage: true });

      await sendScraperLog('DEBUG', 'SCRAPER_UPLOAD_ATTEMPT', `Uploading screenshot to ${storagePath}`);

      const { data, error } = await supabase.storage
        .from('media') // User-specified bucket
        .upload(storagePath, screenshotBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (error) {
        throw new Error(`Supabase upload failed: ${error.message}`);
      }

      await sendScraperLog('INFO', 'SCRAPER_SCREENSHOT_SUCCESS', `Screenshot uploaded successfully to bucket path: ${data.path}`);
      
      // Update the job record with the count
      const { error: updateError } = await supabase.rpc('increment', { table_name: 'zillow_scraper_jobs', row_id: config.jobId, x: 1, field_name: 'screenshots_count' });
      if (updateError) {
          await sendScraperLog('WARN', 'SCRAPER_COUNT_UPDATE_FAILED', `Failed to increment screenshot count for job.`, { dbError: updateError.message });
      }

      return true;
    } catch (error) {
      await sendScraperLog('ERROR', 'SCRAPER_SCREENSHOT_ERROR', `Error capturing or uploading screenshot: ${error instanceof Error ? error.message : String(error)}`, { error });
      return false;
    }
  }
  
  async goToNextPage(currentPage: number): Promise<boolean> {
     // ... (This function remains largely the same, but now calls the logging function)
    if (!this.page) return false;
    try {
      const nextButtonSelector = '[aria-label="Next page"]';
      const hasNextButton = await this.page.$(nextButtonSelector);
      if (!hasNextButton || await this.page.evaluate((s) => document.querySelector(s)?.hasAttribute('disabled'), nextButtonSelector)) {
        await sendScraperLog('INFO', 'SCRAPER_LAST_PAGE', 'No next page button found or it is disabled. Reached the last page.');
        return false;
      }
      await sendScraperLog('DEBUG', 'SCRAPER_NEXT_PAGE_CLICK', `Navigating to page ${currentPage + 1}...`);
      await this.page.click(nextButtonSelector);
      await this.page.waitForSelector('[data-testid="search-page-list-container"]', { timeout: 60000 });
      await this.humanDelay(config.delayBetweenPages);
      return true;
    } catch (error) {
      await sendScraperLog('ERROR', 'SCRAPER_NEXT_PAGE_ERROR', `Error navigating to next page: ${error instanceof Error ? error.message : String(error)}`, { error });
      return false;
    }
  }

  // Helper functions like humanDelay and close remain the same...
  async humanDelay(customDelay?: number) {
    const baseDelay = customDelay || config.delayBetweenActions;
    const randomFactor = Math.random() * 0.3 + 0.85;
    await setTimeout(Math.floor(baseDelay * randomFactor));
  }
  
  async close() {
    if (this.browser) {
      await this.browser.close();
      await sendScraperLog('INFO', 'SCRAPER_BROWSER_CLOSED', 'Browser closed.');
    }
  }

  async run() {
    await sendScraperLog('INFO', 'SCRAPER_RUN_START', 'Zillow Property Scraper script starting execution.');
    if (!await this.init()) return;
    if (!await this.navigateToStartUrl()) {
      await this.close();
      return;
    }
    await this.processListings();
    await this.close();
  }
}

(async () => {
  const scraper = new ZillowPropertyScraper();
  try {
    await scraper.run();
  } catch (error) {
    await sendScraperLog('ERROR', 'SCRAPER_FATAL_ERROR', `Unhandled fatal error in scraper: ${error instanceof Error ? error.message : String(error)}`, { error });
    await scraper.close();
    process.exit(1);
  }
})();