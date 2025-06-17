/**
 * Background script for Zillow Scraper Chrome Extension
 * Handles notifications and background tasks
 */

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'showNotification') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title: message.title || 'Zillow Scraper',
      message: message.message || 'Notification from Zillow Scraper',
      priority: 1
    });
  }
  
  // Always return true for async response
  return true;
});

// When extension is installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open options page on install
    chrome.runtime.openOptionsPage();
  }
});
