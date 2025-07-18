export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      application_settings: {
        Row: {
          created_at: string
          description: string | null
          group_name: string | null
          id: number
          is_sensitive: boolean | null
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_name?: string | null
          id?: number
          is_sensitive?: boolean | null
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          group_name?: string | null
          id?: number
          is_sensitive?: boolean | null
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      campaign_engine_state: {
        Row: {
          campaign_id: string
          id: number
          paused_at: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          id?: never
          paused_at?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          id?: never
          paused_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_engine_state_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_jobs: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          lead_id: string
          next_processing_time: string
          retries: number
          status: Database["public"]["Enums"]["campaign_job_status"]
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          lead_id: string
          next_processing_time: string
          retries?: number
          status?: Database["public"]["Enums"]["campaign_job_status"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          next_processing_time?: string
          retries?: number
          status?: Database["public"]["Enums"]["campaign_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_leads: {
        Row: {
          added_at: string
          campaign_id: string
          contact_email: string | null
          contact_name: string | null
          contact_type: string | null
          conversion_type: string | null
          converted_at: string | null
          current_action_id: string | null
          email_clicked_at: string | null
          email_delivered_at: string | null
          email_message_id: string | null
          email_opened_at: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          email_thread_id: string | null
          error_message: string | null
          id: string
          is_converted: boolean | null
          last_processed_at: string | null
          last_response_received_at: string | null
          last_response_subject: string | null
          last_response_text: string | null
          notes: string | null
          response_count: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          added_at?: string
          campaign_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_type?: string | null
          conversion_type?: string | null
          converted_at?: string | null
          current_action_id?: string | null
          email_clicked_at?: string | null
          email_delivered_at?: string | null
          email_message_id?: string | null
          email_opened_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          email_thread_id?: string | null
          error_message?: string | null
          id?: string
          is_converted?: boolean | null
          last_processed_at?: string | null
          last_response_received_at?: string | null
          last_response_subject?: string | null
          last_response_text?: string | null
          notes?: string | null
          response_count?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          added_at?: string
          campaign_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_type?: string | null
          conversion_type?: string | null
          converted_at?: string | null
          current_action_id?: string | null
          email_clicked_at?: string | null
          email_delivered_at?: string | null
          email_message_id?: string | null
          email_opened_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          email_thread_id?: string | null
          error_message?: string | null
          id?: string
          is_converted?: boolean | null
          last_processed_at?: string | null
          last_response_received_at?: string | null
          last_response_subject?: string | null
          last_response_text?: string | null
          notes?: string | null
          response_count?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      campaign_runs: {
        Row: {
          campaign_id: string
          completed_at: string | null
          created_at: string | null
          failed_emails: number | null
          id: string
          sent_emails: number | null
          started_at: string | null
          total_emails: number | null
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          created_at?: string | null
          failed_emails?: number | null
          id?: string
          sent_emails?: number | null
          started_at?: string | null
          total_emails?: number | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          created_at?: string | null
          failed_emails?: number | null
          id?: string
          sent_emails?: number | null
          started_at?: string | null
          total_emails?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      campaign_steps: {
        Row: {
          action_type: string
          campaign_id: string
          created_at: string | null
          delay_days: number | null
          delay_hours: number | null
          id: string
          step_number: number
          subject_template: string | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          action_type: string
          campaign_id: string
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          id?: string
          step_number: number
          subject_template?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          action_type?: string
          campaign_id?: string
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          id?: string
          step_number?: number
          subject_template?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          created_at: string
          daily_limit: number
          id: string
          market_region_id: string | null
          name: string
          status: Database["public"]["Enums"]["campaign_status"]
          time_window_hours: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_limit?: number
          id?: string
          market_region_id?: string | null
          name: string
          status?: Database["public"]["Enums"]["campaign_status"]
          time_window_hours?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_limit?: number
          id?: string
          market_region_id?: string | null
          name?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          time_window_hours?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_market_region_id_fkey"
            columns: ["market_region_id"]
            isOneToOne: false
            referencedRelation: "active_market_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_market_region_id_fkey"
            columns: ["market_region_id"]
            isOneToOne: false
            referencedRelation: "market_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_id: string
          created_at: string
          email: string | null
          email_message_id: string | null
          mailing_address: string | null
          mailing_city: string | null
          mailing_postal_code: string | null
          mailing_state: string | null
          name: string | null
          phone: string | null
          property_id: string
          role: Database["public"]["Enums"]["contact_role"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id?: string
          created_at?: string
          email?: string | null
          email_message_id?: string | null
          mailing_address?: string | null
          mailing_city?: string | null
          mailing_postal_code?: string | null
          mailing_state?: string | null
          name?: string | null
          phone?: string | null
          property_id: string
          role?: Database["public"]["Enums"]["contact_role"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          email?: string | null
          email_message_id?: string | null
          mailing_address?: string | null
          mailing_city?: string | null
          mailing_postal_code?: string | null
          mailing_state?: string | null
          name?: string | null
          phone?: string | null
          property_id?: string
          role?: Database["public"]["Enums"]["contact_role"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "contacts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_with_contacts"
            referencedColumns: ["property_id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          assessed_total: number | null
          baths: string | null
          beds: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_type: string
          converted: boolean
          created_at: string
          email_sent: boolean | null
          id: number
          lot_size_sqft: string | null
          market_region: string | null
          mls_curr_days_on_market: string | null
          mls_curr_status: string | null
          notes: string | null
          phone: string | null
          phone_number: number | null
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          square_footage: string | null
          status: string | null
          updated_at: string
          year_built: string | null
        }
        Insert: {
          assessed_total?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_type: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          phone?: string | null
          phone_number?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          year_built?: string | null
        }
        Update: {
          assessed_total?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_type?: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          phone?: string | null
          phone_number?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          year_built?: string | null
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          available_placeholders: string[] | null
          content: string | null
          created_at: string | null
          created_by: string
          deleted_at: string | null
          file_path: string | null
          file_type: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string | null
          type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          available_placeholders?: string[] | null
          content?: string | null
          created_at?: string | null
          created_by: string
          deleted_at?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject?: string | null
          type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          available_placeholders?: string[] | null
          content?: string | null
          created_at?: string | null
          created_by?: string
          deleted_at?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_engagement_events: {
        Row: {
          bounce_reason: string | null
          campaign_id: string | null
          campaign_job_id: number | null
          contact_email: string
          created_at: string
          email_message_id: string
          event_timestamp: string
          event_type: string
          id: number
          ip_address: string | null
          lead_id: string | null
          raw_event_data: Json | null
          reply_body_preview: string | null
          reply_subject: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          bounce_reason?: string | null
          campaign_id?: string | null
          campaign_job_id?: number | null
          contact_email: string
          created_at?: string
          email_message_id: string
          event_timestamp?: string
          event_type: string
          id?: number
          ip_address?: string | null
          lead_id?: string | null
          raw_event_data?: Json | null
          reply_body_preview?: string | null
          reply_subject?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          bounce_reason?: string | null
          campaign_id?: string | null
          campaign_job_id?: number | null
          contact_email?: string
          created_at?: string
          email_message_id?: string
          event_timestamp?: string
          event_type?: string
          id?: number
          ip_address?: string | null
          lead_id?: string | null
          raw_event_data?: Json | null
          reply_body_preview?: string | null
          reply_subject?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string | null
          created_by: string
          deleted_at: string | null
          id: string
          is_active: boolean | null
          name: string
          placeholders: string[] | null
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_at?: string | null
          created_by: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          placeholders?: string[] | null
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string | null
          created_by?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          placeholders?: string[] | null
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      engine_log: {
        Row: {
          assessed_total: number | null
          baths: string | null
          beds: string | null
          campaign_id: string | null
          campaign_jobs_id: string | null
          contact_email: string
          contact_name: string | null
          converted: boolean
          email_body_preview_sent: string | null
          email_error_message: string | null
          email_message_id: string | null
          email_sent_at: string | null
          email_status: string
          email_subject_sent: string | null
          id: number
          market_region: string | null
          mls_curr_days_on_market: string | null
          mls_curr_status: string | null
          normalized_lead_converted_status: boolean | null
          processed_at: string
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          sender_email_used: string | null
          sender_name: string | null
          square_footage: string | null
          year_built: string | null
        }
        Insert: {
          assessed_total?: number | null
          baths?: string | null
          beds?: string | null
          campaign_id?: string | null
          campaign_jobs_id?: string | null
          contact_email: string
          contact_name?: string | null
          converted?: boolean
          email_body_preview_sent?: string | null
          email_error_message?: string | null
          email_message_id?: string | null
          email_sent_at?: string | null
          email_status: string
          email_subject_sent?: string | null
          id?: number
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          normalized_lead_converted_status?: boolean | null
          processed_at?: string
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          sender_email_used?: string | null
          sender_name?: string | null
          square_footage?: string | null
          year_built?: string | null
        }
        Update: {
          assessed_total?: number | null
          baths?: string | null
          beds?: string | null
          campaign_id?: string | null
          campaign_jobs_id?: string | null
          contact_email?: string
          contact_name?: string | null
          converted?: boolean
          email_body_preview_sent?: string | null
          email_error_message?: string | null
          email_message_id?: string | null
          email_sent_at?: string | null
          email_status?: string
          email_subject_sent?: string | null
          id?: number
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          normalized_lead_converted_status?: boolean | null
          processed_at?: string
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          sender_email_used?: string | null
          sender_name?: string | null
          square_footage?: string | null
          year_built?: string | null
        }
        Relationships: []
      }
      engine_state: {
        Row: {
          id: number
          last_paused_at: string | null
          status: Database["public"]["Enums"]["engine_status"]
          updated_at: string
        }
        Insert: {
          id?: number
          last_paused_at?: string | null
          status?: Database["public"]["Enums"]["engine_status"]
          updated_at?: string
        }
        Update: {
          id?: number
          last_paused_at?: string | null
          status?: Database["public"]["Enums"]["engine_status"]
          updated_at?: string
        }
        Relationships: []
      }
      file_imports: {
        Row: {
          checksum: string | null
          file_key: string
          imported_at: string
          job_id: string | null
          row_count: number | null
          user_id: string | null
        }
        Insert: {
          checksum?: string | null
          file_key: string
          imported_at?: string
          job_id?: string | null
          row_count?: number | null
          user_id?: string | null
        }
        Update: {
          checksum?: string | null
          file_key?: string
          imported_at?: string
          job_id?: string | null
          row_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_imports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "upload_jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_logs: {
        Row: {
          created_at: string
          details: Json | null
          id: number
          job_id: string
          log_message: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: never
          job_id: string
          log_message?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: never
          job_id?: string
          log_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "campaign_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      market_regions: {
        Row: {
          associated_leads_table: string | null
          created_at: string | null
          created_by: string | null
          id: string
          last_processed_at: string | null
          lead_count: number | null
          name: string
          normalized_name: string | null
          updated_at: string | null
        }
        Insert: {
          associated_leads_table?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_processed_at?: string | null
          lead_count?: number | null
          name: string
          normalized_name?: string | null
          updated_at?: string | null
        }
        Update: {
          associated_leads_table?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_processed_at?: string | null
          lead_count?: number | null
          name?: string
          normalized_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
          user_role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
          user_role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      properties: {
        Row: {
          assessed_total: number | null
          assessed_year: number | null
          avm: number | null
          baths: number | null
          beds: number | null
          created_at: string
          lot_size_sqft: number | null
          market_region: string | null
          market_region_id: string | null
          market_value: number | null
          mls_baths: number | null
          mls_beds: number | null
          mls_days_on_market: number | null
          mls_garage: string | null
          mls_list_date: string | null
          mls_list_price: number | null
          mls_listing_id: string | null
          mls_photos: string | null
          mls_price_per_sqft: number | null
          mls_sale_price: number | null
          mls_sold_date: string | null
          mls_sqft: number | null
          mls_status: string | null
          mls_year_built: number | null
          notes: string | null
          owner_type: string | null
          price_per_sqft: number | null
          property_address: string | null
          property_city: string | null
          property_id: string
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          square_footage: number | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          user_id: string
          wholesale_value: number | null
          year_built: number | null
        }
        Insert: {
          assessed_total?: number | null
          assessed_year?: number | null
          avm?: number | null
          baths?: number | null
          beds?: number | null
          created_at?: string
          lot_size_sqft?: number | null
          market_region?: string | null
          market_region_id?: string | null
          market_value?: number | null
          mls_baths?: number | null
          mls_beds?: number | null
          mls_days_on_market?: number | null
          mls_garage?: string | null
          mls_list_date?: string | null
          mls_list_price?: number | null
          mls_listing_id?: string | null
          mls_photos?: string | null
          mls_price_per_sqft?: number | null
          mls_sale_price?: number | null
          mls_sold_date?: string | null
          mls_sqft?: number | null
          mls_status?: string | null
          mls_year_built?: number | null
          notes?: string | null
          owner_type?: string | null
          price_per_sqft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_id?: string
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          square_footage?: number | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          user_id: string
          wholesale_value?: number | null
          year_built?: number | null
        }
        Update: {
          assessed_total?: number | null
          assessed_year?: number | null
          avm?: number | null
          baths?: number | null
          beds?: number | null
          created_at?: string
          lot_size_sqft?: number | null
          market_region?: string | null
          market_region_id?: string | null
          market_value?: number | null
          mls_baths?: number | null
          mls_beds?: number | null
          mls_days_on_market?: number | null
          mls_garage?: string | null
          mls_list_date?: string | null
          mls_list_price?: number | null
          mls_listing_id?: string | null
          mls_photos?: string | null
          mls_price_per_sqft?: number | null
          mls_sale_price?: number | null
          mls_sold_date?: string | null
          mls_sqft?: number | null
          mls_status?: string | null
          mls_year_built?: number | null
          notes?: string | null
          owner_type?: string | null
          price_per_sqft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_id?: string
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          square_footage?: number | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          user_id?: string
          wholesale_value?: number | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_market_region"
            columns: ["market_region_id"]
            isOneToOne: false
            referencedRelation: "active_market_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_market_region"
            columns: ["market_region_id"]
            isOneToOne: false
            referencedRelation: "market_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      senders: {
        Row: {
          created_at: string | null
          credentials_json: Json | null
          daily_limit: number | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          last_authorized_at: string | null
          last_checked_history_id: string | null
          last_reset_date: string | null
          sender_email: string
          sender_name: string
          sent_today: number | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credentials_json?: Json | null
          daily_limit?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_authorized_at?: string | null
          last_checked_history_id?: string | null
          last_reset_date?: string | null
          sender_email: string
          sender_name: string
          sent_today?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          credentials_json?: Json | null
          daily_limit?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_authorized_at?: string | null
          last_checked_history_id?: string | null
          last_reset_date?: string | null
          sender_email?: string
          sender_name?: string
          sent_today?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      staging_contacts_csv: {
        Row: {
          assessed_total: number | null
          assessed_year: number | null
          avm: number | null
          baths: number | null
          beds: number | null
          contact1_email_1: string | null
          contact1_email_2: string | null
          contact1_email_3: string | null
          contact1_name: string | null
          contact1_phone_1: string | null
          contact2_email_1: string | null
          contact2_email_2: string | null
          contact2_email_3: string | null
          contact2_name: string | null
          contact2_phone_1: string | null
          contact3_email_1: string | null
          contact3_email_2: string | null
          contact3_email_3: string | null
          contact3_name: string | null
          contact3_phone_1: string | null
          first_name: string | null
          last_name: string | null
          lot_size_sqft: number | null
          market_value: number | null
          mls_curr_baths: number | null
          mls_curr_beds: number | null
          mls_curr_daysonmarket: number | null
          mls_curr_garage: string | null
          mls_curr_listagentemail: string | null
          mls_curr_listagentname: string | null
          mls_curr_listagentphone: string | null
          mls_curr_listdate: string | null
          mls_curr_listingid: string | null
          mls_curr_listprice: number | null
          mls_curr_photos: string | null
          mls_curr_pricepersqft: number | null
          mls_curr_saleprice: number | null
          mls_curr_solddate: string | null
          mls_curr_sqft: number | null
          mls_curr_status: string | null
          mls_curr_yearbuilt: number | null
          owner_type: string | null
          price_per_sqft: number | null
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          recipient_address: string | null
          recipient_city: string | null
          recipient_postal_code: string | null
          recipient_state: string | null
          square_footage: number | null
          wholesale_value: number | null
          year_built: number | null
        }
        Insert: {
          assessed_total?: number | null
          assessed_year?: number | null
          avm?: number | null
          baths?: number | null
          beds?: number | null
          contact1_email_1?: string | null
          contact1_email_2?: string | null
          contact1_email_3?: string | null
          contact1_name?: string | null
          contact1_phone_1?: string | null
          contact2_email_1?: string | null
          contact2_email_2?: string | null
          contact2_email_3?: string | null
          contact2_name?: string | null
          contact2_phone_1?: string | null
          contact3_email_1?: string | null
          contact3_email_2?: string | null
          contact3_email_3?: string | null
          contact3_name?: string | null
          contact3_phone_1?: string | null
          first_name?: string | null
          last_name?: string | null
          lot_size_sqft?: number | null
          market_value?: number | null
          mls_curr_baths?: number | null
          mls_curr_beds?: number | null
          mls_curr_daysonmarket?: number | null
          mls_curr_garage?: string | null
          mls_curr_listagentemail?: string | null
          mls_curr_listagentname?: string | null
          mls_curr_listagentphone?: string | null
          mls_curr_listdate?: string | null
          mls_curr_listingid?: string | null
          mls_curr_listprice?: number | null
          mls_curr_photos?: string | null
          mls_curr_pricepersqft?: number | null
          mls_curr_saleprice?: number | null
          mls_curr_solddate?: string | null
          mls_curr_sqft?: number | null
          mls_curr_status?: string | null
          mls_curr_yearbuilt?: number | null
          owner_type?: string | null
          price_per_sqft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          recipient_address?: string | null
          recipient_city?: string | null
          recipient_postal_code?: string | null
          recipient_state?: string | null
          square_footage?: number | null
          wholesale_value?: number | null
          year_built?: number | null
        }
        Update: {
          assessed_total?: number | null
          assessed_year?: number | null
          avm?: number | null
          baths?: number | null
          beds?: number | null
          contact1_email_1?: string | null
          contact1_email_2?: string | null
          contact1_email_3?: string | null
          contact1_name?: string | null
          contact1_phone_1?: string | null
          contact2_email_1?: string | null
          contact2_email_2?: string | null
          contact2_email_3?: string | null
          contact2_name?: string | null
          contact2_phone_1?: string | null
          contact3_email_1?: string | null
          contact3_email_2?: string | null
          contact3_email_3?: string | null
          contact3_name?: string | null
          contact3_phone_1?: string | null
          first_name?: string | null
          last_name?: string | null
          lot_size_sqft?: number | null
          market_value?: number | null
          mls_curr_baths?: number | null
          mls_curr_beds?: number | null
          mls_curr_daysonmarket?: number | null
          mls_curr_garage?: string | null
          mls_curr_listagentemail?: string | null
          mls_curr_listagentname?: string | null
          mls_curr_listagentphone?: string | null
          mls_curr_listdate?: string | null
          mls_curr_listingid?: string | null
          mls_curr_listprice?: number | null
          mls_curr_photos?: string | null
          mls_curr_pricepersqft?: number | null
          mls_curr_saleprice?: number | null
          mls_curr_solddate?: string | null
          mls_curr_sqft?: number | null
          mls_curr_status?: string | null
          mls_curr_yearbuilt?: number | null
          owner_type?: string | null
          price_per_sqft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          recipient_address?: string | null
          recipient_city?: string | null
          recipient_postal_code?: string | null
          recipient_state?: string | null
          square_footage?: number | null
          wholesale_value?: number | null
          year_built?: number | null
        }
        Relationships: []
      }
      system_event_logs: {
        Row: {
          campaign_id: string | null
          created_at: string
          details: Json | null
          event_type: string
          id: number
          message: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          details?: Json | null
          event_type: string
          id?: number
          message?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: number
          message?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      system_script_logs: {
        Row: {
          created_at: string
          details: Json | null
          id: number
          log_level: string | null
          message: string | null
          script_name: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: number
          log_level?: string | null
          message?: string | null
          script_name?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: number
          log_level?: string | null
          message?: string | null
          script_name?: string | null
        }
        Relationships: []
      }
      upload_jobs: {
        Row: {
          created_at: string
          file_name: string
          job_id: string
          message: string | null
          progress: number
          status: Database["public"]["Enums"]["upload_job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          job_id?: string
          message?: string | null
          progress?: number
          status?: Database["public"]["Enums"]["upload_job_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          job_id?: string
          message?: string | null
          progress?: number
          status?: Database["public"]["Enums"]["upload_job_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zillow_scraper_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          output_directory: string | null
          properties_scraped: number | null
          started_at: string | null
          status: string
          updated_at: string
          user_agent: string | null
          zillow_url: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          output_directory?: string | null
          properties_scraped?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          zillow_url: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          output_directory?: string | null
          properties_scraped?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          zillow_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      active_market_regions: {
        Row: {
          created_at: string | null
          id: string | null
          lead_count: number | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          lead_count?: number | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          lead_count?: number | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_email_metrics: {
        Row: {
          bounce_rate: number | null
          bounced: number | null
          click_rate: number | null
          clicked: number | null
          date: string | null
          delivered: number | null
          delivery_rate: number | null
          open_rate: number | null
          opened: number | null
          replied: number | null
          reply_rate: number | null
          sent: number | null
          total_sent: number | null
        }
        Relationships: []
      }
      email_metrics_by_sender: {
        Row: {
          bounce_rate: number | null
          bounced: number | null
          click_rate: number | null
          clicked: number | null
          delivered: number | null
          delivery_rate: number | null
          email: string | null
          name: string | null
          open_rate: number | null
          opened: number | null
          replied: number | null
          reply_rate: number | null
          sent: number | null
          total_sent: number | null
        }
        Relationships: []
      }
      properties_with_contacts: {
        Row: {
          assessed_total: number | null
          assessed_year: number | null
          avm: number | null
          baths: number | null
          beds: number | null
          contact_count: number | null
          contact_emails: string | null
          contact_names: string | null
          contact_phones: string | null
          created_at: string | null
          lot_size_sqft: number | null
          market_region: string | null
          market_region_id: string | null
          market_value: number | null
          mls_baths: number | null
          mls_beds: number | null
          mls_days_on_market: number | null
          mls_garage: string | null
          mls_list_date: string | null
          mls_list_price: number | null
          mls_listing_id: string | null
          mls_photos: string | null
          mls_price_per_sqft: number | null
          mls_sale_price: number | null
          mls_sold_date: string | null
          mls_sqft: number | null
          mls_status: string | null
          mls_year_built: number | null
          notes: string | null
          owner_type: string | null
          price_per_sqft: number | null
          property_address: string | null
          property_city: string | null
          property_id: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          square_footage: number | null
          status: Database["public"]["Enums"]["lead_status"] | null
          updated_at: string | null
          user_id: string | null
          wholesale_value: number | null
          year_built: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_market_region"
            columns: ["market_region_id"]
            isOneToOne: false
            referencedRelation: "active_market_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_market_region"
            columns: ["market_region_id"]
            isOneToOne: false
            referencedRelation: "market_regions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adjust_schedule_on_resume: {
        Args: { campaign_id_to_resume: string }
        Returns: string
      }
      generate_complete_schema_dump: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_campaigns_to_process: {
        Args: Record<PropertyKey, never>
        Returns: {
          campaign_id: string
          campaign_name: string
          pending_jobs: number
        }[]
      }
      get_email_metrics_time_series: {
        Args: { start_date: string; end_date: string; interval_days?: number }
        Returns: {
          date_group: string
          sent: number
          delivered: number
          bounced: number
          opened: number
          clicked: number
          replied: number
        }[]
      }
      get_my_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      import_from_staging_csv: {
        Args: { p_user_id: string; p_job_id: string; p_market_region: string }
        Returns: undefined
      }
      import_leads_from_staging: {
        Args: { p_job_id: string; p_user_id: string; p_market_region: string }
        Returns: undefined
      }
      increment_lead_count: {
        Args: { region_id: string; increment_value: number }
        Returns: undefined
      }
      increment_sender_sent_count: {
        Args: { sender_id: string }
        Returns: undefined
      }
      normalize_market_name: {
        Args: { p_name: string }
        Returns: string
      }
      normalize_staged_leads: {
        Args:
          | { p_market_region: string }
          | { p_market_region: string; p_user_id: string }
        Returns: undefined
      }
      process_next_campaign_job: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      process_raw_lead_batch: {
        Args: { raw_leads: Json[]; p_user_id: string }
        Returns: string
      }
      reorder_campaign_steps: {
        Args: { p_campaign_id: string; p_step_ids: string[] }
        Returns: {
          action_type: string
          campaign_id: string
          created_at: string | null
          delay_days: number | null
          delay_hours: number | null
          id: string
          step_number: number
          subject_template: string | null
          template_id: string | null
          updated_at: string | null
        }[]
      }
      reset_all_sender_daily_counts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reset_sender_daily_count: {
        Args: { sender_id: string }
        Returns: undefined
      }
      schedule_campaign_jobs: {
        Args:
          | { p_campaign_id: string }
          | {
              p_campaign_id: string
              p_market_region: string
              p_spread_days?: number
            }
        Returns: number
      }
      search_properties_with_contacts: {
        Args: { search_term: string }
        Returns: {
          assessed_total: number | null
          assessed_year: number | null
          avm: number | null
          baths: number | null
          beds: number | null
          contact_count: number | null
          contact_emails: string | null
          contact_names: string | null
          contact_phones: string | null
          created_at: string | null
          lot_size_sqft: number | null
          market_region: string | null
          market_region_id: string | null
          market_value: number | null
          mls_baths: number | null
          mls_beds: number | null
          mls_days_on_market: number | null
          mls_garage: string | null
          mls_list_date: string | null
          mls_list_price: number | null
          mls_listing_id: string | null
          mls_photos: string | null
          mls_price_per_sqft: number | null
          mls_sale_price: number | null
          mls_sold_date: string | null
          mls_sqft: number | null
          mls_status: string | null
          mls_year_built: number | null
          notes: string | null
          owner_type: string | null
          price_per_sqft: number | null
          property_address: string | null
          property_city: string | null
          property_id: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          square_footage: number | null
          status: Database["public"]["Enums"]["lead_status"] | null
          updated_at: string | null
          user_id: string | null
          wholesale_value: number | null
          year_built: number | null
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
    }
    Enums: {
      campaign_job_status: "scheduled" | "processing" | "completed" | "failed"
      campaign_status: "draft" | "active" | "paused" | "completed" | "archived"
      contact_role: "owner" | "alternate_contact" | "mls_agent"
      engine_status: "stopped" | "running" | "paused"
      lead_status:
        | "New Lead"
        | "Attempted to Contact"
        | "Contacted"
        | "Working/In Progress"
        | "Contract Sent"
        | "Qualified"
        | "Unqualified/Disqualified"
        | "Nurture"
        | "Meeting Set"
        | "Closed - Converted/Customer"
        | "Closed - Not Converted/Opportunity Lost"
      upload_job_status: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED"
      user_role: "superadmin" | "guest"
    }
    CompositeTypes: {
      fine_cut_lead_type: {
        id: number | null
        original_lead_id: string | null
        market_region_id: string | null
        market_region_name: string | null
        contact_name: string | null
        contact_email: string | null
        contact_phone: string | null
        contact_type: string | null
        property_address: string | null
        property_city: string | null
        property_state: string | null
        property_postal_code: string | null
        source: string | null
        notes: string | null
        created_at: string | null
        updated_at: string | null
      }
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      campaign_job_status: ["scheduled", "processing", "completed", "failed"],
      campaign_status: ["draft", "active", "paused", "completed", "archived"],
      contact_role: ["owner", "alternate_contact", "mls_agent"],
      engine_status: ["stopped", "running", "paused"],
      lead_status: [
        "New Lead",
        "Attempted to Contact",
        "Contacted",
        "Working/In Progress",
        "Contract Sent",
        "Qualified",
        "Unqualified/Disqualified",
        "Nurture",
        "Meeting Set",
        "Closed - Converted/Customer",
        "Closed - Not Converted/Opportunity Lost",
      ],
      upload_job_status: ["PENDING", "PROCESSING", "COMPLETE", "FAILED"],
      user_role: ["superadmin", "guest"],
    },
  },
} as const
