// src/services/logService.ts
import { createAdminServerClient } from '@/lib/supabase/server'; // Ensure this import is correct and awaited
import { Json } from '@/types/supabase';

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

    // FIX: Embed 'level', 'campaign_id', and 'user_id' directly into the 'details' JSONB column,
    // as the `system_event_logs` table schema does not have dedicated columns for them.
    const combinedDetails: Json = {
      level: level, // Embed level inside details
      message_details: details, // Original details payload
      // Include campaign_id and user_id in details as well, if they are not top-level columns
      // This ensures all relevant context is preserved in the JSON
      campaign_id_context: campaign_id,
      user_id_context: user_id
    };

    const { error } = await supabase.from('system_event_logs').insert({
      event_type,
      message,
      details: JSON.stringify(combinedDetails), // Stringify the combined JSON object
      // Do NOT include campaign_id or user_id directly here if they are not actual columns
      // If your DB has these columns, they should be passed directly here from the parameters
      // For now, based on init.sql, they are not, so we rely on 'details'
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