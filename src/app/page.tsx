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

// FIX: Correct the type annotation for the supabase client parameter.
// It should be the awaited/resolved client, not the promise.
async function getDashboardData(supabase: Awaited<ReturnType<typeof createClient>>): Promise<DashboardPageData> {
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

  // FIX: Switched from getSession() to getUser() to align with best practices and remove build warnings.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const userRole = user.user_metadata?.user_role || 'guest';
  const userId = user.id;
  
  const initialData = await getDashboardData(supabase);
  
  return (
    <CampaignDashboardWrapper
      userRole={userRole}
      userId={userId}
      initialData={initialData}
    />
  );
}