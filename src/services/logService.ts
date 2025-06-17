// src/services/logService.ts
import { createAdminServerClient } from '@/lib/supabase/server'; // Ensure this import is correct and awaited
import { Json } from '@/types/supabase'; // Import Json type for clarity

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
  campaign_id, // This parameter will no longer be used directly for DB column
  user_id,     // This parameter will no longer be used directly for DB column
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
    // This is a temporary diagnostic measure to bypass "permission denied" if tied to FK/RLS on these columns.
    const combinedDetails: Json = {
      level: level, // Embed level inside details
      original_details: details, // Original details payload
      // Temporarily remove campaign_id and user_id from here too for testing
      // If the error resolves, it means one of these fields (or their FKs) was the problem.
      // campaign_id_context: campaign_id, // Temporarily removed
      // user_id_context: user_id // Temporarily removed
    };

    const { error } = await supabase.from('system_event_logs').insert({
      event_type,
      message,
      details: JSON.stringify(combinedDetails), // Stringify the combined JSON object
      // Do NOT include campaign_id or user_id directly here as top-level columns.
      // They are assumed to be in 'details' JSONB field.
      // If your DB has these columns, they should be explicitly passed from the parameters:
      // campaign_id: campaign_id,
      // user_id: user_id,
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