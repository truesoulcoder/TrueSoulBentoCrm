// src/app/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CampaignDashboardWrapper } from '@/components/campaign-dashboard-wrapper';
import type { Database } from '@/types/supabase';

// Define a type for the consolidated dashboard data
export type DashboardPageData = {
  leads: Database['public']['Views']['properties_with_contacts']['Row'][];
  campaigns: Database['public']['Tables']['campaigns']['Row'][];
  marketRegions: Pick<Database['public']['Tables']['market_regions']['Row'], 'id' | 'name'>[];
  engineState: Database['public']['Tables']['engine_state']['Row'] | null;
};

// This server-side function fetches all data in parallel for performance.
async function getDashboardData(supabase: ReturnType<typeof createClient>): Promise<DashboardPageData> {
  // We use the authenticated user's supabase client here because RLS policies
  // on the underlying tables will correctly filter the data.
  const leadsPromise = supabase.rpc('search_properties_with_contacts', { search_term: '' });
  const campaignsPromise = supabase.from('campaigns').select('*').order('created_at', { ascending: false });
  const marketRegionsPromise = supabase.from('market_regions').select('id, name').order('name');
  const engineStatePromise = supabase.from('engine_state').select('*').eq('id', 1).single();

  const [
    { data: leads, error: leadsError },
    { data: campaigns, error: campaignsError },
    { data: marketRegions, error: marketRegionsError },
    { data: engineState, error: engineStateError }
  ] = await Promise.all([leadsPromise, campaignsPromise, marketRegionsPromise, engineStatePromise]);

  if (leadsError) console.error("Error fetching leads:", leadsError.message);
  if (campaignsError) console.error("Error fetching campaigns:", campaignsError.message);
  if (marketRegionsError) console.error("Error fetching market regions:", marketRegionsError.message);
  // A 'PGRST116' error for engineState is not critical if the row doesn't exist yet, so we don't log it as a hard error.
  if (engineStateError && engineStateError.code !== 'PGRST116') {
      console.error("Error fetching engine state:", engineStateError.message);
  }

  return {
    leads: leads || [],
    campaigns: campaigns || [],
    marketRegions: marketRegions || [],
    engineState: engineState || null,
  };
}

export default async function Home() {
  const supabase = await createClient();

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const user = session.user;
  const userRole = user.user_metadata?.user_role || 'guest';
  const userId = user.id;
  
  // Fetch all initial data on the server.
  const initialData = await getDashboardData(supabase);
  
  // Pass both the user's info and the initial data to the client-side wrapper.
  return (
    <CampaignDashboardWrapper
      userRole={userRole}
      userId={userId}
      initialData={initialData}
    />
  );
}