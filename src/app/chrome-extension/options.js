/**
 * Options page script for Zillow Scraper Chrome Extension
 */

// Default configuration
const DEFAULT_CONFIG = {
  apiUrl: 'http://localhost:3000/api/chrome-extension/trigger-scraper',
  dashboardUrl: 'http://localhost:3000/dashboard',
  jobsUrl: 'http://localhost:3000/dashboard'
};

// DOM elements
const apiUrlInput = document.getElementById('api-url');
const dashboardUrlInput = document.getElementById('dashboard-url');
const jobsUrlInput = document.getElementById('jobs-url');
const saveButton = document.getElementById('save-button');
const resetButton = document.getElementById('reset-button');
const statusElement = document.getElementById('status');

/**
 * Save options to storage
 */
function saveOptions() {
  const apiUrl = apiUrlInput.value.trim();
  const dashboardUrl = dashboardUrlInput.value.trim();
  const jobsUrl = jobsUrlInput.value.trim();
  
  // Validate URLs
  if (!isValidUrl(apiUrl)) {
    showStatus('API URL is not valid', 'error');
    return;
  }
  
  if (!isValidUrl(dashboardUrl)) {
    showStatus('Dashboard URL is not valid', 'error');
    return;
  }
  
  if (!isValidUrl(jobsUrl)) {
    showStatus('Jobs URL is not valid', 'error');
    return;
  }
  
  chrome.storage.sync.set({
    apiUrl,
    dashboardUrl,
    jobsUrl
  }, () => {
    showStatus('Options saved successfully', 'success');
  });
}

/**
 * Load saved options
 */
function loadOptions() {
  chrome.storage.sync.get({
    // Default values
    apiUrl: DEFAULT_CONFIG.apiUrl,
    dashboardUrl: DEFAULT_CONFIG.dashboardUrl,
    jobsUrl: DEFAULT_CONFIG.jobsUrl
  }, (items) => {
    apiUrlInput.value = items.apiUrl;
    dashboardUrlInput.value = items.dashboardUrl;
    jobsUrlInput.value = items.jobsUrl;
  });
}

/**
 * Reset options to defaults
 */
function resetOptions() {
  apiUrlInput.value = DEFAULT_CONFIG.apiUrl;
  dashboardUrlInput.value = DEFAULT_CONFIG.dashboardUrl;
  jobsUrlInput.value = DEFAULT_CONFIG.jobsUrl;
  
  showStatus('Options reset to defaults. Click Save to apply.', 'info');
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
  statusElement.classList.remove('hidden');
  
  // Hide after 3 seconds
  setTimeout(() => {
    statusElement.classList.add('hidden');
  }, 3000);
}

/**
 * Validate URL
 */
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Add event listeners
document.addEventListener('DOMContentLoaded', loadOptions);
saveButton.addEventListener('click', saveOptions);
resetButton.addEventListener('click', resetOptions);

// Support Enter key in inputs
const inputs = [apiUrlInput, dashboardUrlInput, jobsUrlInput];
inputs.forEach(input => {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      saveOptions();
    }
  });
});
