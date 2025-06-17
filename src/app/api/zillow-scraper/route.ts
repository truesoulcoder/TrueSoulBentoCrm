// This file is now redundant and can be safely removed.
// The zillow scraper functionality has been moved to:
// src/actions/zillowScraper.ts

// If you want to keep an API route for external access,
// you can replace this with code that calls the server action:

import { NextResponse } from 'next/server';
import { runZillowScraper } from '@/actions/zillowScraper';

export async function POST(request: Request) {
  try {
    const { url, userAgent } = await request.json();
    const result = await runZillowScraper(url, userAgent);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in zillow-scraper API route:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process request' 
    }, { status: 500 });
  }
}
