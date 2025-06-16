import { CampaignDashboardWrapper } from '@/components/campaign-dashboard-wrapper'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()

  // Campaigns are no longer fetched on the server.
  // The client-side CampaignDashboard will handle fetching campaigns.

  // The leads table is still fetched here. If it also grows large,
  // it should be paginated in a similar fashion.
  // const { data: leads, error: leadsError } = await supabase.from('properties_with_contacts').select('*') // Old query
  const { data: leads, error: leadsError } = await supabase.from('crm_leads').select('*') // New query

  if (leadsError) {
    console.error('Error fetching leads:', leadsError)
    return <div>Error: Could not load initial data for the dashboard.</div>
  }

  return (
    <CampaignDashboardWrapper
      leads={leads || []}
    />
  )
}