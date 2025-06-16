// src/components/campaign-dashboard-wrapper.tsx
'use client'

import type { Database } from '@/types/supabase';
import { CampaignDashboard } from './campaign-dashboard'

// This is the corrected type for a lead with its nested property data.
export type LeadWithProperties = Database['public']['Tables']['campaign_leads']['Row'] & {
  properties?: Database['public']['Tables']['properties']['Row'] | null;
};

// Update the props to include the user's role and use the corrected lead type.
export function CampaignDashboardWrapper({
  leads,
  userRole,
}: {
  leads: LeadWithProperties[];
  userRole: string;
}) {
  // Pass the leads and the userRole down to the main dashboard component.
  return <CampaignDashboard leads={leads} userRole={userRole} />
}