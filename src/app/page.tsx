// src/app/page.tsx
import { CampaignDashboardWrapper, type LeadWithProperties } from '@/components/campaign-dashboard-wrapper'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation';
import type { Tables } from '@/types/supabase';

export default async function Home() {
  const supabase = await createClient();

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const user = session.user;
  const userRole = user.user_metadata?.user_role || 'guest';

  // --- NEW DATA FETCHING STRATEGY ---

  // 1. Fetch base properties/leads using the view that includes contact emails.
  let propertiesQuery = supabase.from('properties_with_contacts').select('*');
  if (userRole !== 'superadmin') {
    propertiesQuery = propertiesQuery.eq('user_id', user.id);
  }
  const { data: properties, error: propertiesError } = await propertiesQuery;

  if (propertiesError) {
    console.error('Error fetching properties:', propertiesError);
    return <div>Error: Could not load property data.</div>;
  }

  // 2. Fetch all campaign-specific lead data.
  let campaignLeadsQuery = supabase.from('campaign_leads').select('*');
  if (userRole !== 'superadmin') {
    campaignLeadsQuery = campaignLeadsQuery.eq('user_id', user.id);
  }
  const { data: campaignLeads, error: campaignLeadsError } = await campaignLeadsQuery;

  if (campaignLeadsError) {
    console.error('Error fetching campaign leads:', campaignLeadsError);
    return <div>Error: Could not load campaign data.</div>;
  }

  // 3. Create a lookup map for efficient joining.
  const campaignLeadsMap = new Map<string, Tables<'campaign_leads'>>();
  if (campaignLeads) {
    for (const cl of campaignLeads) {
      if (cl.contact_email) {
        // Use lowercase email as the key for case-insensitive matching.
        campaignLeadsMap.set(cl.contact_email.toLowerCase(), cl);
      }
    }
  }

  // 4. Manually join properties with their campaign data.
  const leads: LeadWithProperties[] = (properties || []).map(property => {
    const contactEmails = property.contact_emails?.toLowerCase().split(',').map(e => e.trim()) || [];
    let matchingCampaignLead: Tables<'campaign_leads'> | undefined;

    for (const email of contactEmails) {
      if (campaignLeadsMap.has(email)) {
        matchingCampaignLead = campaignLeadsMap.get(email);
        break; // Stop after finding the first match
      }
    }
    
    // Construct the final object, merging data from both sources.
    const mergedLead: LeadWithProperties = {
      ...(matchingCampaignLead || {
        // Provide default values if no campaign data is found for this property.
        id: property.property_id || '',
        campaign_id: '',
        user_id: user.id,
        contact_name: property.contact_names?.split(',')[0] || null,
        contact_email: contactEmails.length > 0 ? contactEmails[0] : null,
        status: property.status,
        added_at: property.created_at || new Date().toISOString(),
        contact_type: null,
        conversion_type: null,
        converted_at: null,
        current_action_id: null,
        email_clicked_at: null,
        email_delivered_at: null,
        email_message_id: null,
        email_opened_at: null,
        email_sent: null,
        email_sent_at: null,
        email_thread_id: null,
        error_message: null,
        is_converted: null,
        last_processed_at: null,
        last_response_received_at: null,
        last_response_subject: null,
        last_response_text: null,
        notes: property.notes,
        response_count: null,
      }),
      // Nest the full property object, which is required by the UI.
      // The view has a slightly different shape, so we assert the type.
      properties: property as Tables<'properties'>,
    };
    
    return mergedLead;
  });

  // Sort the final merged list by creation date
  leads.sort((a, b) => new Date(b.properties?.created_at || 0).getTime() - new Date(a.properties?.created_at || 0).getTime());
  
  return (
    <CampaignDashboardWrapper
      leads={leads}
      userRole={userRole}
    />
  );
}