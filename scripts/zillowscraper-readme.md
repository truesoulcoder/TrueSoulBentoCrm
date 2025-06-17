// zillowscraper-readme.md

Hola scraperinos and scraperinas!

I've created a complete Chrome extension that will allow you to trigger the Zillow scraper directly from the Zillow website! Here's what the extension includes:

    - Chrome Extension Components
    - Manifest File - Defines the extension permissions and structure
    - Content Script - Injects the "Scrape This Page" button on Zillow search results pages
    - Background Script - Handles extension events and notifications
    - Popup Interface - A UI for triggering scrapes from any tab
    - API Endpoint - Receives requests from the extension and queues scraper jobs

How It Works

    On a Zillow Search Page:
1. The extension automatically adds a "Scrape This Page" button to the page
2. When clicked, it captures the current URL and user agent
3. Sends this data to your Next.js app API endpoint
4. The API queues a job in your Supabase database
5. Your local worker processes the job using Playwright

    From the Extension Popup:
1. Click the extension icon in Chrome
2. If you're on a Zillow page, the "Scrape This Page" button will be enabled
3. Click to trigger the scraper for the current page
4. Links to view your dashboard and jobs are also provided

Usage Instructions
    
    Install the Extension:

    Create a folder called images in the chrome-extension directory

    Add icon files (16x16, 48x48, 128x128) to the images folder

    Open Chrome and go to chrome://extensions/

    Enable "Developer mode" (toggle in top right)

    Click "Load unpacked" and select your chrome-extension folder

    Configure the Extension:

    Update the API URL in content.js and popup.js to match your deployed app

For development, the default http://localhost:3000/api/chrome-extension/trigger-scraper will work (vercel limits us to development only because it limits 100 requests per day and the timeout is too short and chromium is too large to run using vercel free tier)

For production, you will need to deploy your own app and update the API URL in content.js and popup.js to match your deployed app

Use the Extension:
1. Navigate to a Zillow search results page
2. Click the "Scrape This Page" button that appears on the page
3. Or click the extension icon and use the popup interface

Boom Shiggity Shagwagon that's all folks!

