/**
 * Popup script for Zillow Scraper Chrome Extension
 */

// Default configuration
const CONFIG = {
  // Your Next.js app's URL (should match the one in content.js)
  apiUrl: 'http://localhost:3000/api/chrome-extension/trigger-scraper',
  // Your dashboard URL
  dashboardUrl: 'http://localhost:3000/dashboard',
  // Your jobs view URL
  jobsUrl: 'http://localhost:3000/dashboard'
};

// DOM elements
const currentUrlElement = document.getElementById('current-url');
const scrapeButton = document.getElementById('scrape-button');
const optionsButton = document.getElementById('options-button');
const statusElement = document.getElementById('status');
const openDashboardLink = document.getElementById('open-dashboard');
const viewJobsLink = document.getElementById('view-jobs');

// Get the active tab
const getActiveTab = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
};

// Initialize popup
const initializePopup = async () => {
  // Get current tab
  const tab = await getActiveTab();
  
  // Update URL display
  if (tab && tab.url && tab.url.includes('zillow.com')) {
    currentUrlElement.textContent = tab.url;
    scrapeButton.disabled = false;
  } else {
    currentUrlElement.textContent = 'Not a Zillow page. Navigate to a Zillow search results page.';
    scrapeButton.disabled = true;
  }
  
  // Load saved configuration
  chrome.storage.sync.get(['apiUrl', 'dashboardUrl', 'jobsUrl'], (result) => {
    if (result.apiUrl) CONFIG.apiUrl = result.apiUrl;
    if (result.dashboardUrl) CONFIG.dashboardUrl = result.dashboardUrl;
    if (result.jobsUrl) CONFIG.jobsUrl = result.jobsUrl;
  });
};

// Show status message
const showStatus = (message, type = 'info') => {
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
  statusElement.classList.remove('hidden');
  
  // Auto-hide after 5 seconds unless it's an error
  if (type !== 'error') {
    setTimeout(() => {
      statusElement.classList.add('hidden');
    }, 5000);
  }
};

// Handle scrape button click
const handleScrape = async () => {
  try {
    // Get current tab
    const tab = await getActiveTab();
    if (!tab || !tab.url) return;
    
    // Disable button and show loading
    scrapeButton.disabled = true;
    scrapeButton.textContent = 'Sending...';
    showStatus('Sending page to scraper...', 'info');
    
    // Prepare data to send
    const data = {
      url: tab.url,
      userAgent: navigator.userAgent,
      title: tab.title
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
      showStatus('Successfully sent to scraper! Job ID: ' + (result.jobId || 'Unknown'), 'success');
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error triggering scraper:', error);
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    // Reset button
    scrapeButton.disabled = false;
    scrapeButton.textContent = 'Scrape This Page';
  }
};

// Handle options button click
const handleOptions = () => {
  chrome.runtime.openOptionsPage();
};

// Handle dashboard link click
const handleOpenDashboard = () => {
  chrome.tabs.create({ url: CONFIG.dashboardUrl });
};

// Handle jobs link click
const handleViewJobs = () => {
  chrome.tabs.create({ url: CONFIG.jobsUrl });
};

// Add event listeners
scrapeButton.addEventListener('click', handleScrape);
optionsButton.addEventListener('click', handleOptions);
openDashboardLink.addEventListener('click', handleOpenDashboard);
viewJobsLink.addEventListener('click', handleViewJobs);

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup);
