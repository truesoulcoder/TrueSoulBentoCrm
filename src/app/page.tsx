// src/app/page.tsx
import { CampaignDashboardWrapper } from '@/components/campaign-dashboard-wrapper'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = await createClient();

  // Fetch the current user session
  const { data: { session } } = await supabase.auth.getSession();

  // The middleware handles redirection, but this is a server-side safeguard.
  if (!session) {
    redirect('/login');
  }

  // Extract user and role. Default to a non-privileged role if not set.
  const user = session.user;
  const userRole = user.user_metadata?.user_role || 'guest';

  // Base query to fetch leads with their related properties.
  // This assumes a relationship is defined in Supabase between 'campaign_leads' and 'properties'.
  let query = supabase.from('campaign_leads').select('*, properties(*)');

  // If the user is not a superadmin, filter leads to only show their own.
  if (userRole !== 'superadmin') {
    query = query.eq('user_id', user.id);
  }

  const { data: leads, error: leadsError } = await query.order('created_at', { ascending: false });

  if (leadsError) {
    console.error('Error fetching leads:', leadsError);
    return <div>Error: Could not load initial data for the dashboard.</div>;
  }

  // Pass the filtered leads and the user's role to the client wrapper.
  return (
    <CampaignDashboardWrapper
      leads={leads || []}
      userRole={userRole}
    />
  );
}