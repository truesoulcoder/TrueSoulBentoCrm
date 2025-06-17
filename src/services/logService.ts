// src/services/logService.ts
import { createAdminServerClient } from '@/lib/supabase/server'; // Ensure this import is correct and awaited

/**
 * Inserts a system event log entry into the system_event_logs table.
 * @param event_type - e.g., 'ERROR', 'INFO', 'CAMPAIGN_STATUS', etc.
 * @param message - Short description of the event.
 * @param details - Optional details (object or stringified JSON).
 * @param campaign_id - Optional campaign id for scoping.
 * @param user_id - Optional user id for scoping.
 * @param level - Optional log level (e.g., 'INFO', 'WARN', 'ERROR').
 */
export async function logSystemEvent({
  event_type,
  message,
  details,
  campaign_id,
  user_id,
  level = 'INFO', // Default level to INFO if not provided
}: {
  event_type: string;
  message: string;
  details?: any; // Can be any type, will be JSON.stringify if not string
  campaign_id?: string;
  user_id?: string;
  level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'; // Enforce specific levels
}) {
  try {
    const supabase = await createAdminServerClient(); // Await the client creation
    const { error } = await supabase.from('system_event_logs').insert({
      event_type,
      message,
      details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
      campaign_id,
      user_id,
      level,
      // created_at is automatically handled by default value in DB now
      // updated_at trigger is also in the DB
    });

    if (error) {
      console.error('Failed to insert system log event into DB:', error);
      // Fallback: log to console if DB insertion fails
      console.error('Original log event details:', { event_type, message, details, campaign_id, user_id, level });
    }
  } catch (err) {
    console.error('Critical error creating Supabase admin client for logging or inserting log:', err);
    // Fallback: log to console if client creation or insertion fails
    console.error('Original log event details (failed to log to DB):', { event_type, message, details, campaign_id, user_id, level });
  }
}