// src/app/api/worker-logs/route.ts
import { NextResponse } from 'next/server';
import { logSystemEvent } from '@/services/logService'; // Import the logging service

export async function POST(request: Request) {
  // This API route is intended to be called by the local scraper worker.
  // For simplicity, we're trusting the local worker for now and
  // not requiring explicit user authentication for these logs.
  // In a production environment with external workers, you might
  // want to implement an API key or other authentication mechanism here.

  try {
    const { event_type, message, details, level, campaign_id, user_id } = await request.json();

    // Log the event using the centralized log service
    await logSystemEvent({
      event_type: event_type || 'WORKER_LOG', // Default event_type if not provided
      message: message || 'No message provided',
      details: details,
      level: level,
      campaign_id: campaign_id,
      user_id: user_id,
    });

    return NextResponse.json({ success: true, message: 'Log received' });
  } catch (error) {
    console.error('Error receiving worker log:', error);
    // Attempt to log the error itself using the service, but be careful to avoid infinite loops
    logSystemEvent({
      event_type: 'WORKER_LOG_RECEIVE_ERROR',
      message: `Failed to receive worker log: ${error instanceof Error ? error.message : String(error)}`,
      details: { error: error instanceof Error ? error.message : String(error), requestBody: await request.text().catch(() => 'N/A') },
      level: 'ERROR'
    }).catch(err => console.error('Failed to self-log worker log receive error:', err));

    return NextResponse.json({ success: false, error: 'Failed to receive log' }, { status: 500 });
  }
}

// Optional: Add a GET method for basic health check or route testing
export async function GET() {
  return NextResponse.json({ status: 'Worker log endpoint active' });
}