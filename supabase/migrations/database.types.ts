// src/database.types.ts
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      application_settings: {
        Row: {
          id: number
          key: string
          value: string | null
          is_sensitive: boolean | null
          group_name: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: { /* ... */ }
        Update: { /* ... */ }
      }
      campaign_engine_state: {
        Row: {
          campaign_id: string
          status: "running" | "paused" | "stopped"
          paused_at: string | null
          updated_at: string
        }
        // ... Insert/Update types
      }
      file_imports: {
        Row: {
          file_key: string
          created_at: string
          checksum: string | null
          row_count: number | null
          user_id: string | null
          job_id: string | null
        }
        // ... Insert/Update types
      }
      // All other tables...
    }
    Views: {
      // View definitions if any
    }
    Functions: {
      update_timestamp: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_short_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      engine_status: "running" | "paused" | "stopped"
      lead_status: "New Lead" | "Attempted to Contact" | /* ... */ 
    }
  }
}

// Recommended usage:
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
