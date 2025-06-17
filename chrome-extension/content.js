/**
 * Content script for Zillow Scraper Chrome Extension
 * This script injects a "Scrape This Page" button onto Zillow search result pages
 */

// Configuration - update this with your app's URL
const CONFIG = {
  // Your Next.js app's URL where the scraper API is hosted
  apiUrl: 'http://localhost:3000/api/chrome-extension/trigger-scraper',
  // Selector for where to inject the button on search results pages
  injectionSelectors: [
    // Primary target: Filter bar
    '.filter-bar',
    // Backup targets if primary isn't found
    '.search-page-container',
    '.search-header',
    '.filter-button'
  ],
  // CSS class to identify pages with search results
  searchResultsIdentifiers: [
    '.search-page-list-container',
    '.search-results-container',
    '.result-list-container'
  ]
};

/**
 * Check if the current page is a Zillow search results page
 */
function isSearchResultsPage() {
  return CONFIG.searchResultsIdentifiers.some(selector => 
    document.querySelector(selector) !== null
  );
}

/**
 * Create the scraper button element
 */
function createScraperButton() {
  const button = document.createElement('button');
  button.id = 'zillow-scraper-button';
  button.className = 'zillow-scraper-trigger-button';
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
      <line x1="7" y1="2" x2="7" y2="22"></line>
      <line x1="17" y1="2" x2="17" y2="22"></line>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <line x1="2" y1="7" x2="7" y2="7"></line>
      <line x1="2" y1="17" x2="7" y2="17"></line>
      <line x1="17" y1="17" x2="22" y2="17"></line>
      <line x1="17" y1="7" x2="22" y2="7"></line>
    </svg>
    Scrape This Page
  `;
  
  // Add event listener
  button.addEventListener('click', handleScraperButtonClick);
  
  return button;
}

/**
 * Handle button click event
 */
async function handleScraperButtonClick() {
  try {
    // Show loading state
    const button = document.getElementById('zillow-scraper-button');
    const originalText = button.innerHTML;
    button.innerHTML = 'Sending to scraper...';
    button.disabled = true;
    
    // Get the data to send
    const data = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      title: document.title
    };
    
    // Send to your app's API
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
      credentials: 'include' // This will send cookies if same domain
    });
    
    const result = await response.json();
    
    if (result.success) {
      button.innerHTML = 'Success! ✓';
      button.classList.add('success');
      
      // Show notification
      chrome.runtime.sendMessage({
        type: 'showNotification',
        title: 'Zillow Scraper',
        message: 'Successfully sent page to scraper!'
      });
      
      // Reset after 3 seconds
      setTimeout(() => {
        button.innerHTML = originalText;
        button.disabled = false;
        button.classList.remove('success');
      }, 3000);
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error triggering scraper:', error);
    
    // Show error state
    const button = document.getElementById('zillow-scraper-button');
    button.innerHTML = 'Error! Try again';
    button.classList.add('error');
    
    // Reset after 3 seconds
    setTimeout(() => {
      button.innerHTML = 'Scrape This Page';
      button.disabled = false;
      button.classList.remove('error');
    }, 3000);
    
    // Show notification
    chrome.runtime.sendMessage({
      type: 'showNotification',
      title: 'Zillow Scraper Error',
      message: `Failed to trigger scraper: ${error.message}`
    });
  }
}

/**
 * Inject the button into the page
 */
function injectButton() {
  if (!isSearchResultsPage()) return;
  
  // Check if button already exists
  if (document.getElementById('zillow-scraper-button')) return;
  
  // Find a suitable injection point
  let injectionPoint = null;
  
  for (const selector of CONFIG.injectionSelectors) {
    injectionPoint = document.querySelector(selector);
    if (injectionPoint) break;
  }
  
  if (!injectionPoint) {
    console.warn('Zillow Scraper: Could not find injection point');
    return;
  }
  
  // Create button container
  const container = document.createElement('div');
  container.className = 'zillow-scraper-button-container';
  container.appendChild(createScraperButton());
  
  // Inject the button
  injectionPoint.appendChild(container);
  console.log('Zillow Scraper: Button injected');
}

/**
 * Initialize the content script
 */
function initialize() {
  // Try injecting immediately for fast page loads
  injectButton();
  
  // Also use mutation observer for dynamic content
  const observer = new MutationObserver((mutations) => {
    // Only inject if we detect changes to the DOM
    if (mutations.some(m => m.addedNodes.length > 0)) {
      injectButton();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Get extension options
  chrome.storage.sync.get(['apiUrl'], (result) => {
    if (result.apiUrl) {
      CONFIG.apiUrl = result.apiUrl;
    }
  });
}

// Start the script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
