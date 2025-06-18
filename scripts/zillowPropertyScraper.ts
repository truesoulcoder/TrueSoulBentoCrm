import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
// DOTENV is removed to prevent conflicts with the worker script's environment
import { setTimeout } from 'timers/promises';
import sanitize from 'sanitize-filename';

// Configuration is now read directly from environment variables set by the worker
const config = {
  startUrl: process.env.SCRAPER_START_URL || 'https://www.zillow.com/',
  screenshotDir: process.env.SCRAPER_OUTPUT_DIR || path.join(process.cwd(), 'public', 'scraped'),
  cookiesFilePath: path.join(process.cwd(), 'scripts', 'zillow-cookies.json'),
  delayBetweenActions: 2000,
  delayBetweenPages: 5000,
  userAgent: process.env.SCRAPER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  maxRetries: 3,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
};

// Centralized logging helper for the scraper script
async function sendScraperLog(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', event_type: string, message: string, details?: object) {
  // Fallback to console if siteUrl is not configured
  if (!config.siteUrl) {
    console.log(`[${level}] ${message}`, details || '');
    return;
  }
  try {
    await fetch(`${config.siteUrl}/api/worker-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, event_type, message, details: { ...details, script: 'zillowPropertyScraper.ts' } }),
    });
  } catch (e) {
    console.error(`[Log Send Error] ${message}`, e);
  }
}

// Ensure screenshot directory exists
if (!fs.existsSync(config.screenshotDir)) {
  fs.mkdirSync(config.screenshotDir, { recursive: true });
  sendScraperLog('INFO', 'SCRAPER_DIR_CREATED', `Created screenshot directory: ${config.screenshotDir}`);
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
        viewport: { width: 1280, height: 800 },
        userAgent: config.userAgent,
        deviceScaleFactor: 1,
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
      } else {
        await sendScraperLog('WARN', 'SCRAPER_NO_COOKIES', 'No cookies file found. Proceeding without cookies.');
      }
    } catch (error) {
      await sendScraperLog('ERROR', 'SCRAPER_COOKIE_LOAD_ERROR', `Error loading cookies: ${error instanceof Error ? error.message : String(error)}`, { error });
    }
  }
  
  async saveCookies() {
    if (!this.context) return;
    try {
      const cookies = await this.context.cookies();
      fs.writeFileSync(config.cookiesFilePath, JSON.stringify(cookies, null, 2));
      await sendScraperLog('DEBUG', 'SCRAPER_COOKIES_SAVED', 'Cookies saved successfully');
    } catch (error) {
      await sendScraperLog('ERROR', 'SCRAPER_COOKIE_SAVE_ERROR', `Error saving cookies: ${error instanceof Error ? error.message : String(error)}`, { error });
    }
  }
  
  async navigateToStartUrl() {
    if (!this.page) return false;
    try {
      await sendScraperLog('INFO', 'SCRAPER_NAVIGATING', `Navigating to ${config.startUrl}`);
      await this.page.goto(config.startUrl, { timeout: 60000, waitUntil: 'networkidle' });
      await this.saveCookies();
      await this.page.waitForSelector('[data-testid="search-page-list-container"]', { timeout: 60000 });
      await sendScraperLog('INFO', 'SCRAPER_NAV_SUCCESS', 'Navigation successful');
      return true;
    } catch (error) {
      await sendScraperLog('ERROR', 'SCRAPER_NAV_FAILURE', `Error navigating to start URL: ${error instanceof Error ? error.message : String(error)}`, { error });
      return false;
    }
  }
  
  async processListings() {
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
            
            if (this.page.url() !== searchPageUrl) {
                await this.page.goto(searchPageUrl, { timeout: 30000, waitUntil: 'networkidle' });
            } else {
                const closeButton = await this.page.$('button[aria-label="Close"]');
                if (closeButton) await closeButton.click();
            }
            await this.humanDelay(1000);
          } catch (propertyError) {
             await sendScraperLog('ERROR', 'SCRAPER_PROPERTY_ERROR', `Error processing property card #${i + 1}: ${propertyError instanceof Error ? propertyError.message : String(propertyError)}`, { propertyError });
            await this.page.goto(searchPageUrl, { timeout: 30000, waitUntil: 'networkidle' });
          }
        }
        
        hasMorePages = await this.goToNextPage(currentPage);
        if (hasMorePages) currentPage++;
        
      } catch (error) {
        await sendScraperLog('ERROR', 'SCRAPER_PAGE_ERROR', `Error processing listings on page ${currentPage}: ${error instanceof Error ? error.message : String(error)}`, { error });
        return false;
      }
    }
    
    await sendScraperLog('INFO', 'SCRAPER_ALL_LISTINGS_COMPLETE', `Completed processing all listings. Total properties scraped: ${this.propertyCounter}`);
    return true;
  }
  
  async processPropertyModal(): Promise<boolean> {
    if (!this.page) return false;
    try {
      const addressSelector = '#search-detail-lightbox h1';
      await this.page.waitForSelector(addressSelector, { timeout: 20000 });
      const address = await this.page.textContent(addressSelector);
      const propertyAddress = address ? address.trim() : `unknown_property_${Date.now()}`;
      await sendScraperLog('DEBUG', 'SCRAPER_MODAL_PROCESS', `Processing property modal: ${propertyAddress}`);
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
      const filepath = path.join(config.screenshotDir, filename);
      const modalContentSelector = '#search-detail-lightbox .xdp-page-lightboxesm__DetailsPageContainer-srp-8-109-3__sc-1r6wiem-2';
      
      const modalContent = await this.page.$(modalContentSelector);
      if (modalContent) {
        await this.scrollModalToBottom(modalContentSelector);
        await this.page.screenshot({ path: filepath, fullPage: true });
        await sendScraperLog('INFO', 'SCRAPER_SCREENSHOT_SUCCESS', `Screenshot saved: ${filepath}`);
        return true;
      }
      await sendScraperLog('WARN', 'SCRAPER_SCREENSHOT_FAILURE', `Modal content element not found for screenshot.`);
      return false;
    } catch (error) {
      await sendScraperLog('ERROR', 'SCRAPER_SCREENSHOT_ERROR', `Error taking full modal screenshot: ${error instanceof Error ? error.message : String(error)}`, { error });
      return false;
    }
  }
  
  async scrollModalToBottom(modalSelector: string) {
    if (!this.page) return;
    try {
      const modalHeight = await this.page.evaluate((selector) => document.querySelector(selector)?.scrollHeight || 0, modalSelector);
      for (let currentPosition = 0; currentPosition < modalHeight; currentPosition += 300) {
        await this.page.evaluate((args) => {
          const [selector, position] = args as [string, number];
          document.querySelector(selector)?.scrollTo(0, position);
        }, [modalSelector, currentPosition]);
        await this.humanDelay(500);
      }
      await this.page.evaluate((selector) => document.querySelector(selector)?.scrollTo(0, 0), modalSelector);
    } catch (error) {
      await sendScraperLog('WARN', 'SCRAPER_MODAL_SCROLL_ERROR', `Could not fully scroll modal: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  async goToNextPage(currentPage: number): Promise<boolean> {
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
    await sendScraperLog('INFO', 'SCRAPER_RUN_START', 'Starting Zillow Property Scraper script...');
    if (!await this.init()) return;
    if (!await this.navigateToStartUrl()) {
      await this.close();
      return;
    }
    await this.processListings();
    await sendScraperLog('INFO', 'SCRAPER_RUN_COMPLETE', `Scraping run finished. Total properties processed: ${this.propertyCounter}`);
    await this.close();
  }
}

(async () => {
  if (process.env.EXPORT_COOKIES === 'true') {
    // Cookie export logic can be added here if needed, but is omitted for this refactor.
    return;
  }
  
  const scraper = new ZillowPropertyScraper();
  try {
    await scraper.run();
  } catch (error) {
    await sendScraperLog('ERROR', 'SCRAPER_FATAL_ERROR', `Unhandled fatal error in scraper: ${error instanceof Error ? error.message : String(error)}`, { error });
    await scraper.close();
    process.exit(1);
  }
})();