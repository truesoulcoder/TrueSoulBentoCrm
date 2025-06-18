// src/app/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CampaignDashboardWrapper } from '@/components/campaign-dashboard-wrapper';

export default async function Home() {
  const supabase = await createClient();

  // Fetch the current user session
  const { data: { session } } = await supabase.auth.getSession();

  // The middleware we created handles redirection, but this is a final safeguard.
  if (!session) {
    redirect('/login');
  }

  // Extract user, role, and ID from the session.
  const user = session.user;
  const userRole = user.user_metadata?.user_role || 'guest';
  const userId = user.id;
  
  // Pass both the user's role and ID to the client-side wrapper.
  return (
    <CampaignDashboardWrapper
      userRole={userRole}
      userId={userId}
    />
  );
}