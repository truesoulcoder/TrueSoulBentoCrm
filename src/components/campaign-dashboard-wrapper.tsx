'use client'

import { Lead } from '@/types'
import { CampaignDashboard } from './campaign-dashboard'

export function CampaignDashboardWrapper({
  leads,
}: {
  leads: Lead[]
}) {
  // Pass only the leads down. CampaignDashboard will fetch its own campaigns.
  return <CampaignDashboard leads={leads} />
}