import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { setTimeout } from 'timers/promises';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
interface ScraperConfig {
  startUrl: string;
  screenshotDir: string;
  cookiesFilePath: string;
  delayBetweenActions: number; // milliseconds
  delayBetweenPages: number; // milliseconds
  userAgent: string;
}

const config: ScraperConfig = {
  startUrl: process.env.SCRAPER_START_URL || '',
  screenshotDir: path.join(process.cwd(), 'public', 'property-screenshots'),
  cookiesFilePath: path.join(process.cwd(), 'scripts', 'cookies.json'),
  delayBetweenActions: 2000, // 2 seconds between actions to avoid detection
  delayBetweenPages: 5000, // 5 seconds between pages
  userAgent: process.env.SCRAPER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

// Validate required configuration
if (!config.startUrl) {
  console.error('Missing startUrl. Please set SCRAPER_START_URL in .env.local file.');
  process.exit(1);
}

// Ensure screenshot directory exists
if (!fs.existsSync(config.screenshotDir)) {
  fs.mkdirSync(config.screenshotDir, { recursive: true });
}

class SessionPropertyScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private screenshotCounter = 0;
  
  async init() {
    try {
      // Launch browser with increased timeout
      this.browser = await chromium.launch({ 
        headless: false, // Set to true in production
        slowMo: 50 // Add slowMo to make actions more visible and reduce detection
      });
      
      // Create new browser context with device mimicking options
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: config.userAgent,
        deviceScaleFactor: 1,
        locale: 'en-US',
        timezoneId: 'America/Chicago'
      });
      
      // Load cookies if they exist
      await this.loadCookiesIfExists();
      
      // Enable console logging from the browser
      this.context.on('console', message => console.log(`Browser console: ${message.text()}`));
      
      // Create new page
      this.page = await this.context.newPage();
      console.log('Browser initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      return false;
    }
  }
  
  async loadCookiesIfExists() {
    if (!this.context) return;
    
    try {
      // Check if cookies file exists
      if (fs.existsSync(config.cookiesFilePath)) {
        // Read cookies from file
        const cookiesString = fs.readFileSync(config.cookiesFilePath, 'utf8');
        const cookies = JSON.parse(cookiesString);
        
        // Set cookies in browser context
        await this.context.addCookies(cookies);
        console.log('Cookies loaded successfully');
      } else {
        console.log('No cookies file found. Will proceed without cookies.');
      }
    } catch (error) {
      console.error('Error loading cookies:', error);
    }
  }
  
  async saveCookies() {
    if (!this.context) return;
    
    try {
      // Get cookies from browser context
      const cookies = await this.context.cookies();
      
      // Save cookies to file
      fs.writeFileSync(config.cookiesFilePath, JSON.stringify(cookies, null, 2));
      console.log('Cookies saved successfully');
    } catch (error) {
      console.error('Error saving cookies:', error);
    }
  }
  
  async navigateToStartUrl() {
    if (!this.page) return false;
    
    try {
      console.log(`Navigating to ${config.startUrl}`);
      await this.page.goto(config.startUrl, { timeout: 60000, waitUntil: 'networkidle' });
      
      // Save cookies after navigating to start URL
      await this.saveCookies();
      
      console.log('Navigation successful');
      return true;
    } catch (error) {
      console.error('Error navigating to start URL:', error);
      return false;
    }
  }
  
  async processListings() {
    if (!this.page) return false;
    
    let hasMorePages = true;
    let currentPage = 1;
    
    while (hasMorePages) {
      try {
        console.log(`Processing page ${currentPage}...`);
        
        // Get all property listings on current page
        // Note: You'll need to update these selectors to match your specific site
        const listings = await this.page.$$('.property-card, .listing-item, .search-result-item, .property-listing');
        console.log(`Found ${listings.length} listings on page ${currentPage}`);
        
        // Process each listing
        for (let i = 0; i < listings.length; i++) {
          console.log(`Processing listing ${i + 1} of ${listings.length}`);
          
          // Reload the listings if we're not on the first one (they might have been detached)
          const currentListing = i === 0 ? 
              listings[0] : 
              (await this.page.$$('.property-card, .listing-item, .search-result-item, .property-listing'))[i];
          
          // Store the current URL so we can go back to it after viewing the listing
          const currentUrl = this.page.url();
          
          // Click on listing to open the detail page or modal
          await currentListing.click();
          await this.humanDelay();
          
          // Wait for the property details to load - either in a modal or new page
          // Adjust these selectors based on your specific site
          try {
            // First try waiting for a modal
            await this.page.waitForSelector('.property-modal, .listing-detail-modal, .property-details', {
              state: 'visible',
              timeout: 10000
            });
            
            // Take screenshot of the modal
            await this.takeModalScreenshot();
            
            // Close modal if it's a modal view
            await this.page.click('.close-button, .modal-close, button[aria-label="Close"]');
            await this.humanDelay();
          } catch (error) {
            console.log('No modal detected, assuming page navigation to details page');
            
            // If no modal appears, assume we navigated to a new page
            // Wait for the details content to load
            await this.page.waitForSelector('.property-details, .listing-details, .property-content', {
              timeout: 20000
            });
            
            // Take screenshot of the details page
            await this.takeFullPageScreenshot();
            
            // Go back to the listings page
            console.log('Navigating back to listings page');
            await this.page.goto(currentUrl, { waitUntil: 'networkidle' });
            await this.humanDelay();
          }
        }
        
        // Check if there's a next page and navigate to it
        hasMorePages = await this.goToNextPage(currentPage);
        if (hasMorePages) currentPage++;
        
      } catch (error) {
        console.error(`Error processing listings on page ${currentPage}:`, error);
        return false;
      }
    }
    
    console.log('Completed processing all listings');
    return true;
  }
  
  async takeModalScreenshot() {
    if (!this.page) return false;
    
    try {
      this.screenshotCounter++;
      const filename = `property_${String(this.screenshotCounter).padStart(3, '0')}.png`;
      const filepath = path.join(config.screenshotDir, filename);
      
      // Locate the modal element
      const modal = await this.page.$('.property-modal, .listing-detail-modal, .property-details');
      
      if (modal) {
        // Take screenshot of just the modal
        await modal.screenshot({ path: filepath });
        console.log(`Modal screenshot saved: ${filepath}`);
      } else {
        // Fallback: take screenshot of entire page
        await this.page.screenshot({ path: filepath, fullPage: true });
        console.log(`Modal not found, full page screenshot saved: ${filepath}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error taking modal screenshot:', error);
      return false;
    }
  }
  
  async takeFullPageScreenshot() {
    if (!this.page) return false;
    
    try {
      this.screenshotCounter++;
      const filename = `property_${String(this.screenshotCounter).padStart(3, '0')}.png`;
      const filepath = path.join(config.screenshotDir, filename);
      
      // Take screenshot of the entire page
      await this.page.screenshot({ path: filepath, fullPage: true });
      console.log(`Full page screenshot saved: ${filepath}`);
      
      return true;
    } catch (error) {
      console.error('Error taking full page screenshot:', error);
      return false;
    }
  }
  
  async goToNextPage(currentPage: number): Promise<boolean> {
    if (!this.page) return false;
    
    try {
      // Look for next page button
      // Update these selectors to match your specific site's pagination elements
      const nextButton = await this.page.$('a.next-page, button.next-page, .pagination-next, a[aria-label="Next page"], [data-testid="pagination-next"]');
      
      if (!nextButton) {
        console.log('No next page button found, reached the last page');
        return false;
      }
      
      // Check if the next button is disabled
      const isDisabled = await nextButton.isDisabled();
      if (isDisabled) {
        console.log('Next page button is disabled, reached the last page');
        return false;
      }
      
      // Click next page and wait for navigation
      console.log(`Navigating to page ${currentPage + 1}...`);
      await nextButton.click();
      
      // Wait for the page to load
      await this.page.waitForSelector('.property-card, .listing-item, .search-result-item, .property-listing', { 
        timeout: 60000 
      });
      
      // Wait additional time between pages to avoid detection
      await this.humanDelay(config.delayBetweenPages);
      
      console.log(`Successfully navigated to page ${currentPage + 1}`);
      return true;
    } catch (error) {
      console.error('Error navigating to next page:', error);
      return false;
    }
  }
  
  async humanDelay(customDelay?: number) {
    // Add random variation to delay to mimic human behavior
    const baseDelay = customDelay || config.delayBetweenActions;
    const randomFactor = Math.random() * 0.3 + 0.85; // 0.85-1.15
    const delay = Math.floor(baseDelay * randomFactor);
    
    await setTimeout(delay);
  }
  
  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed');
    }
  }
  
  async run() {
    let success = await this.init();
    if (!success) {
      console.error('Failed to initialize browser, aborting');
      return;
    }
    
    success = await this.navigateToStartUrl();
    if (!success) {
      console.error('Failed to navigate to start URL, aborting');
      await this.close();
      return;
    }
    
    success = await this.processListings();
    if (!success) {
      console.error('Error processing listings');
    }
    
    await this.close();
    console.log('Scraping completed');
  }
  
  async exportCookies() {
    if (!this.context) return;
    
    try {
      // Navigate to the site first to get cookies
      if (this.page) {
        await this.page.goto(new URL(config.startUrl).origin);
      }
      
      // Get cookies from browser context
      const cookies = await this.context.cookies();
      
      // Save cookies to file
      fs.writeFileSync(config.cookiesFilePath, JSON.stringify(cookies, null, 2));
      console.log(`Cookies exported to ${config.cookiesFilePath}`);
    } catch (error) {
      console.error('Error exporting cookies:', error);
    }
    
    await this.close();
  }
}

/**
 * Cookie Exporter Utility
 * 
 * To use this:
 * 1. Set EXPORT_COOKIES=true in your .env.local
 * 2. Run the script
 * 3. A browser will open, navigate to the site
 * 4. Login manually
 * 5. After login, cookies will be saved to file
 * 6. Future script runs will use these cookies
 */
async function exportCookiesOnly() {
  console.log('Cookie export mode activated');
  const scraper = new SessionPropertyScraper();
  await scraper.init();
  await scraper.exportCookies();
}

// Run the script
(async () => {
  // Check if we're in cookie export mode
  if (process.env.EXPORT_COOKIES === 'true') {
    await exportCookiesOnly();
    return;
  }
  
  const scraper = new SessionPropertyScraper();
  
  try {
    await scraper.run();
  } catch (error) {
    console.error('Unhandled error in scraper:', error);
    await scraper.close();
  }
})();
