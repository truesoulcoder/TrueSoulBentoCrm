// src/app/api/engine/process-job/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/services/gmailService';
import { generateLoiPdf, type PersonalizationData } from '@/services/pdfService';
import { generateOfferDetails } from '@/actions/offerCalculations';
import { configure } from 'nunjucks';
import path from 'path';
// FIX: Import the Json type
import type { Database, Json } from '@/types/supabase';

type Lead = Database['public']['Tables']['crm_leads']['Row'];
type Sender = Database['public']['Tables']['senders']['Row'];
type CampaignStep = Database['public']['Tables']['campaign_steps']['Row'];

const templateDir = path.join(process.cwd(), 'src', 'app', 'api', 'engine', 'templates');
const nunjucksEnv = configure(templateDir, { autoescape: true, noCache: true });

// FIX: Change the type of the 'details' parameter from 'object' to 'Json'
async function logJobOutcome(supabase: Awaited<ReturnType<typeof createAdminServerClient>>, jobId: string, message: string, details?: Json) {
  const { error } = await supabase.from('job_logs').insert({ job_id: jobId, log_message: message, details: details || {} });
  if (error) {
    console.error(`CRITICAL: Failed to log outcome for job ${jobId}:`, error);
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createAdminServerClient();
  let jobId: string | null = null;

  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    jobId = body.job_id;

    if (!jobId) {
      throw new Error("Request body must include a 'job_id'.");
    }

    const { data: jobData, error: jobError } = await supabase
      .from('campaign_jobs')
      .select('*, crm_leads(*), campaigns(*, campaign_steps(*))')
      .eq('id', jobId)
      .single();

    if (jobError) throw new Error(`Database error fetching job: ${jobError.message}`);
    if (!jobData) throw new Error(`Job with ID ${jobId} not found.`);

    const lead = jobData.crm_leads as unknown as Lead;
    const campaignSteps = jobData.campaigns?.campaign_steps as unknown as CampaignStep[] | undefined;

    if (!lead) throw new Error(`Lead data is missing for job ${jobId}.`);
    if (!campaignSteps || campaignSteps.length === 0) throw new Error(`No campaign steps found for job ${jobId}.`);
    
    const currentStep = campaignSteps[0]; 
    
    const { data: senders, error: senderError } = await supabase
      .from('senders')
      .select('*')
      .eq('is_active', true)
      .lt('sent_today', 100)
      .limit(1);

    if (senderError) throw new Error(`Database error fetching sender: ${senderError.message}`);
    if (!senders || senders.length === 0) throw new Error('No available email senders found that are under quota.');
    const sender = senders[0] as Sender;

    const offerDetails = generateOfferDetails(lead.assessed_total ?? 0, lead.contact_name);
    
    const personalizationData: PersonalizationData = {
        property_address: lead.property_address ?? undefined,
        property_city: lead.property_city ?? undefined,
        property_state: lead.property_state ?? undefined,
        property_postal_code: lead.property_postal_code ?? undefined,
        current_date: offerDetails.currentDateFormatted,
        offer_price: offerDetails.offerPriceFormatted,
        emd_amount: offerDetails.emdAmountFormatted,
        closing_date: offerDetails.closingDateFormatted,
        greeting_name: lead.contact_name?.split(' ')[0] || 'Property Owner',
        sender_name: sender.sender_name,
        sender_title: "Acquisitions Director",
        company_name: "True Soul Partners LLC",
    };

    const subject = nunjucksEnv.renderString(currentStep.subject_template || "Offer for your property at {{property_address}}", personalizationData);
    const htmlBody = nunjucksEnv.render('email_body_with_subject.html', personalizationData);
    
    const pdfBuffer = await generateLoiPdf(personalizationData, String(lead.id), lead.contact_email || 'unknown');
    if (!pdfBuffer) throw new Error("PDF generation failed and returned no buffer.");

    const emailResult = await sendEmail(
      sender.sender_email,
      lead.contact_email!,
      subject,
      htmlBody,
      [{ filename: `LOI_${personalizationData.property_address?.replace(/\s/g, '_')}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
    );

    if (!emailResult.success) {
      const errorMessage = String(emailResult.error || "Unknown email sending error.");
      throw new Error(errorMessage);
    }
    
    await supabase.from('campaign_jobs').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', jobId);
    await supabase.rpc('increment_sender_sent_count', { sender_id: sender.id });
    await logJobOutcome(supabase, jobId, 'Job processed and email sent successfully.', { messageId: emailResult.globalMessageId });

    return NextResponse.json({ success: true, message: `Job ${jobId} processed.` });

  } catch (error: any) {
    console.error(`[PROCESS-JOB-ERROR] Job ID ${jobId || 'N/A'}:`, error.message);
    if (jobId) {
      await supabase.from('campaign_jobs').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', jobId);
      await logJobOutcome(supabase, jobId, 'Job processing failed.', { error: error.message });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}