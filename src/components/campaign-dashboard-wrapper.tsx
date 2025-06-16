'use client'

import type { Database } from '@/types/supabase'; // Import Database type
import { CampaignDashboard } from './campaign-dashboard'

// Define Lead type based on Supabase view
// type Lead = Database['public']['Views']['properties_with_contacts']['Row']; // Old type
type Lead = Database['public']['Tables']['crm_leads']['Row']; // New type

export function CampaignDashboardWrapper({
  leads,
}: {
  leads: Lead[]
}) {
  // Pass only the leads down. CampaignDashboard will fetch its own campaigns.
  return <CampaignDashboard leads={leads} />
}