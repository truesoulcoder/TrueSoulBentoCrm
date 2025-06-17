import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { setTimeout } from 'timers/promises';
import sanitize from 'sanitize-filename';

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
  maxRetries: number;
}

const config: ScraperConfig = {
  startUrl: process.env.SCRAPER_START_URL || 'https://www.zillow.com/fort-worth-tx/',
  screenshotDir: path.join(process.cwd(), 'public', 'scraped'),
  cookiesFilePath: path.join(process.cwd(), 'scripts', 'zillow-cookies.json'),
  delayBetweenActions: 2000, // 2 seconds between actions
  delayBetweenPages: 5000, // 5 seconds between pages
  userAgent: process.env.SCRAPER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  maxRetries: 3
};

// Ensure screenshot directory exists
if (!fs.existsSync(config.screenshotDir)) {
  fs.mkdirSync(config.screenshotDir, { recursive: true });
  console.log(`Created screenshot directory: ${config.screenshotDir}`);
}

class ZillowPropertyScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private propertyCounter = 0;
  
  async init() {
    try {
      console.log('Initializing browser...');
      
      // Launch browser with increased timeout
      this.browser = await chromium.launch({ 
        headless: false, // Set to true in production
        slowMo: 50 // Add slowMo to make actions more visible
      });
      
      // Create new browser context with device options
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
      this.context.on('console', message => console.log(`Browser: ${message.text()}`));
      
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
      
      // Wait for search results to load
      await this.page.waitForSelector('[data-testid="search-page-list-container"]', { timeout: 60000 });
      
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
    let totalPropertiesScraped = 0;
    
    while (hasMorePages) {
      try {
        console.log(`Processing page ${currentPage}...`);
        
        // Wait for the property cards to load
        await this.page.waitForSelector('[data-testid="property-card-link"]', { timeout: 30000 });
        
        // Get all property cards on the current page
        const propertyCards = await this.page.$$('[data-testid="property-card-link"]');
        console.log(`Found ${propertyCards.length} property cards on page ${currentPage}`);
        
        // Process each property card
        for (let i = 0; i < propertyCards.length; i++) {
          // We need to re-select the elements as the DOM might have changed
          const currentCards = await this.page.$$('[data-testid="property-card-link"]');
          if (i >= currentCards.length) break;
          
          console.log(`Processing property ${i+1} of ${propertyCards.length} on page ${currentPage}`);
          
          // Store current page URL before clicking
          const searchPageUrl = this.page.url();
          
          // Click the property card to open the detail modal
          try {
            // Scroll the property card into view
            await currentCards[i].scrollIntoViewIfNeeded();
            await this.humanDelay(1000);
            
            // Click the property card
            await currentCards[i].click();
            console.log('Clicked property card');
            
            // Wait for the modal to load
            await this.page.waitForSelector('#search-detail-lightbox', { timeout: 30000 });
            await this.humanDelay(2000); // Give extra time for content to fully load
            
            // Process the property details modal
            const success = await this.processPropertyModal();
            if (success) totalPropertiesScraped++;
            
            // Check if we're still on the modal or if we navigated to a new page
            if (this.page.url() !== searchPageUrl) {
              console.log('Navigated to a new page. Going back to search results...');
              await this.page.goto(searchPageUrl, { timeout: 30000, waitUntil: 'networkidle' });
              await this.humanDelay(2000);
            } else {
              // Try to close the modal if we're still on the search page
              try {
                const closeButton = await this.page.$('button[aria-label="Close"]');
                if (closeButton) {
                  await closeButton.click();
                  console.log('Closed property modal');
                  await this.humanDelay(1000);
                }
              } catch (closeError) {
                console.error('Error closing modal:', closeError);
                // If we can't close the modal, try going back to the search page
                await this.page.goto(searchPageUrl, { timeout: 30000, waitUntil: 'networkidle' });
              }
            }
          } catch (propertyError) {
            console.error('Error processing property:', propertyError);
            // Try to recover by going back to the search page
            await this.page.goto(searchPageUrl, { timeout: 30000, waitUntil: 'networkidle' });
            await this.humanDelay(2000);
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
    
    console.log(`Completed processing all listings. Total properties scraped: ${totalPropertiesScraped}`);
    return true;
  }
  
  async processPropertyModal(): Promise<boolean> {
    if (!this.page) return false;
    
    try {
      // Get property address from the modal
      const addressSelector = '#search-detail-lightbox h1';
      await this.page.waitForSelector(addressSelector, { timeout: 20000 });
      
      const address = await this.page.textContent(addressSelector);
      const propertyAddress = address ? address.trim() : `unknown_property_${Date.now()}`;
      console.log(`Processing property: ${propertyAddress}`);
      
      // Take a full screenshot of the modal
      const screenshotSuccess = await this.takeFullModalScreenshot(propertyAddress);
      
      // Increment property counter if screenshot was successful
      if (screenshotSuccess) {
        this.propertyCounter++;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error processing property modal:', error);
      return false;
    }
  }
  
  async takeFullModalScreenshot(propertyAddress: string): Promise<boolean> {
    if (!this.page) return false;
    
    try {
      // Create a sanitized filename from the address
      const sanitizedAddress = sanitize(propertyAddress).replace(/\s+/g, '_');
      const filename = `${sanitizedAddress}.png`;
      const filepath = path.join(config.screenshotDir, filename);
      
      // Get the modal element
      const modal = await this.page.$('#search-detail-lightbox');
      if (!modal) {
        console.error('Modal element not found');
        return false;
      }
      
      // Take a screenshot of the entire modal content
      const modalContentSelector = '#search-detail-lightbox .xdp-page-lightboxesm__DetailsPageContainer-srp-8-109-3__sc-1r6wiem-2';
      const modalContent = await this.page.$(modalContentSelector);
      
      if (modalContent) {
        // Scroll through the modal content to ensure all content is loaded
        await this.scrollModalToBottom(modalContentSelector);
        
        // Now take the full screenshot
        await this.page.screenshot({
          path: filepath,
          fullPage: true
        });
        
        console.log(`Screenshot saved: ${filepath}`);
        return true;
      } else {
        console.error('Modal content element not found');
        return false;
      }
    } catch (error) {
      console.error('Error taking full modal screenshot:', error);
      return false;
    }
  }
  
  async scrollModalToBottom(modalSelector: string) {
    if (!this.page) return;
    
    try {
      console.log('Scrolling modal to ensure all content loads...');
      
      // Get the height of the modal
      const modalHeight = await this.page.evaluate((selector) => {
        const element = document.querySelector(selector);
        return element ? element.scrollHeight : 0;
      }, modalSelector);
      
      // Scroll down in increments
      const scrollStep = 300;
      let currentPosition = 0;
      
      while (currentPosition < modalHeight) {
        await this.page.evaluate(
          (args: (string | number)[]) => {
            const [selector, position] = args as [string, number];
            const element = document.querySelector<HTMLElement>(selector);
            if (element) element.scrollTo(0, position as number);
          },
          [modalSelector, currentPosition]
        );
        
        currentPosition += scrollStep;
        await this.humanDelay(2000); // Increased delay for content to load
      }
      
      // Scroll back to top
      await this.page.evaluate(
        (args: (string | number)[]) => {
          const [selector] = args as [string];
          const element = document.querySelector<HTMLElement>(selector);
          if (element) element.scrollTo(0, 0);
        },
        [modalSelector]
      );
      await this.page.evaluate(
        (args: (string | number)[]) => {
          const [selector] = args as [string];
          const element = document.querySelector<HTMLElement>(selector);
          if (element) element.scrollTo(0, 0);
        },
        [modalSelector]
      );
      
      console.log('Finished scrolling modal');
    } catch (error) {
      console.error('Error scrolling modal:', error);
    }
  }
  
  async goToNextPage(currentPage: number): Promise<boolean> {
    if (!this.page) return false;
    
    try {
      // Look for the "Next page" button
      const nextButtonSelector = '[aria-label="Next page"]';
      const hasNextButton = await this.page.$(nextButtonSelector);
      
      if (!hasNextButton) {
        console.log('No next page button found, reached the last page');
        return false;
      }
      
      // Check if the next button is disabled
      const isDisabled = await this.page.evaluate((selector) => {
        const button = document.querySelector(selector);
        return button ? button.hasAttribute('disabled') : true;
      }, nextButtonSelector);
      
      if (isDisabled) {
        console.log('Next page button is disabled, reached the last page');
        return false;
      }
      
      // Click next page button
      console.log(`Navigating to page ${currentPage + 1}...`);
      await this.page.click(nextButtonSelector);
      
      // Wait for the new page to load
      await this.page.waitForSelector('[data-testid="search-page-list-container"]', { timeout: 60000 });
      
      // Wait additional time between pages
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
    console.log('Starting Zillow Property Scraper...');
    
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
    
    console.log(`Scraping completed! Total properties processed: ${this.propertyCounter}`);
    await this.close();
  }
  
  async exportCookies() {
    if (!this.context) return;
    
    try {
      // Navigate to Zillow first to get cookies
      if (this.page) {
        await this.page.goto('https://www.zillow.com/', { timeout: 30000 });
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
 * 3. A browser will open, navigate to Zillow
 * 4. Login manually if needed
 * 5. Cookies will be saved to file
 * 6. Future script runs will use these cookies
 */
async function exportCookiesOnly() {
  console.log('Cookie export mode activated');
  const scraper = new ZillowPropertyScraper();
  await scraper.init();
  await scraper.exportCookies();
}

// Run the script
(async () => {
  // First make sure we have sanitize-filename package
  try {
    require.resolve('sanitize-filename');
  } catch (e) {
    console.log('Installing sanitize-filename package...');
    // This is a synchronous operation
    const { execSync } = require('child_process');
    execSync('npm install sanitize-filename', { stdio: 'inherit' });
    console.log('Installed sanitize-filename package');
  }
  
  // Check if we're in cookie export mode
  if (process.env.EXPORT_COOKIES === 'true') {
    await exportCookiesOnly();
    return;
  }
  
  const scraper = new ZillowPropertyScraper();
  
  try {
    await scraper.run();
  } catch (error) {
    console.error('Unhandled error in scraper:', error);
    await scraper.close();
  }
})();
