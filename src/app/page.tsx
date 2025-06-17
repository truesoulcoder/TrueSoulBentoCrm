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

  // Extract user and role. Default to a non-privileged role if not set.
  const user = session.user;
  const userRole = (user.user_metadata?.user_role as string) || 'guest';
  const userId = user.id; // Get the user ID

  // This Server Component's job is now simply to perform authentication
  // and pass the user's role and ID to the client-side dashboard wrapper.
  // The wrapper will be responsible for rendering the DraggableDashboard.
  return (
    <CampaignDashboardWrapper
      userRole={userRole}
      userId={userId} // Pass the userId to the wrapper
    />
  );
}