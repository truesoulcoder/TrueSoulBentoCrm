// src/app/api/engine/process-job/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/services/gmailService';
import { generateLoiPdf, type PersonalizationData } from '@/services/pdfService';
import { generateOfferDetails } from '@/actions/offerCalculations';
import { configure } from 'nunjucks';
import path from 'path';
import type { Database } from '@/types/supabase';

// Define clear types for our data records
type Lead = Database['public']['Tables']['crm_leads']['Row'];
type Sender = Database['public']['Tables']['senders']['Row'];
type CampaignStep = Database['public']['Tables']['campaign_steps']['Row'];

// Configure Nunjucks for template rendering, pointing to the correct central template directory
const templateDir = path.join(process.cwd(), 'src', 'app', 'api', 'engine', 'templates');
const nunjucksEnv = configure(templateDir, { autoescape: true, noCache: true });

/**
 * A standardized helper for logging job outcomes to the database.
 * @param supabase - An active Supabase admin client.
 * @param jobId - The ID of the job to log against.
 * @param message - A descriptive message of the outcome.
 * @param details - An optional object for additional context or error information.
 */
async function logJobOutcome(supabase: ReturnType<typeof createAdminServerClient>, jobId: string, message: string, details?: object) {
  const { error } = await supabase.from('job_logs').insert({ job_id: jobId, log_message: message, details: details || {} });
  if (error) {
    console.error(`CRITICAL: Failed to log outcome for job ${jobId}:`, error);
  }
}

/**
 * This API route processes a single campaign job. It is designed to be called by a secure
 * internal process, such as a scheduled Supabase Edge Function.
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminServerClient();
  let jobId: string | null = null; // Initialize jobId to null for broader scope in error handling

  // 1. Authorization: Ensure this endpoint is called by a trusted service.
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

    // 2. Fetch all necessary data for the job in a single, efficient query.
    // This query retrieves the job, its related lead, and its campaign (including all steps).
    const { data: jobData, error: jobError } = await supabase
      .from('campaign_jobs')
      .select('*, crm_leads(*), campaigns(*, campaign_steps(*))')
      .eq('id', jobId)
      .single();

    if (jobError) throw new Error(`Database error fetching job: ${jobError.message}`);
    if (!jobData) throw new Error(`Job with ID ${jobId} not found.`);

    const lead = jobData.crm_leads as Lead;
    const campaignSteps = jobData.campaigns?.campaign_steps as CampaignStep[] | undefined;

    if (!lead) throw new Error(`Lead data is missing for job ${jobId}.`);
    if (!campaignSteps || campaignSteps.length === 0) throw new Error(`No campaign steps found for job ${jobId}.`);

    // NOTE: This logic assumes we always process the first step.
    // In the future, the 'campaign_jobs' table could have a 'current_step_number' to make this dynamic.
    const currentStep = campaignSteps[0];
    
    // Find an available sender who has not exceeded their daily quota.
    const { data: senders, error: senderError } = await supabase
      .from('senders')
      .select('*')
      .eq('is_active', true)
      .lt('sent_today', 100) // Assuming a hardcoded quota of 100 for now
      .limit(1);

    if (senderError) throw new Error(`Database error fetching sender: ${senderError.message}`);
    if (!senders || senders.length === 0) throw new Error('No available email senders found that are under quota.');
    const sender = senders[0] as Sender;

    // 3. Prepare Email Content and PDF
    const offerDetails = generateOfferDetails(lead.assessed_total ?? 0, lead.contact_name);
    const personalizationData: PersonalizationData = {
      ...lead,
      ...offerDetails,
      greeting_name: lead.contact_name?.split(' ')[0] || 'Property Owner',
      sender_name: sender.sender_name,
      sender_title: "Acquisitions Director",
      company_name: "True Soul Partners LLC",
    };

    const subject = nunjucksEnv.renderString(currentStep.subject_template || "Offer for your property at {{property_address}}", personalizationData);
    const htmlBody = nunjucksEnv.render('email_body_with_subject.html', personalizationData);
    
    const pdfBuffer = await generateLoiPdf(personalizationData, String(lead.id), lead.contact_email || 'unknown');
    if (!pdfBuffer) throw new Error("PDF generation failed and returned no buffer.");

    // 4. Send the Email via the Gmail Service
    const emailResult = await sendEmail(
      sender.sender_email,
      lead.contact_email!,
      subject,
      htmlBody,
      [{ filename: `LOI_${personalizationData.property_address?.replace(/\s/g, '_')}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
    );

    if (!emailResult.success) {
      throw new Error(emailResult.error || "Unknown email sending error.");
    }
    
    // 5. Finalize: Update job status and sender quota, then log success.
    await supabase.from('campaign_jobs').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', jobId);
    await supabase.rpc('increment_sender_sent_count', { sender_id: sender.id });
    await logJobOutcome(supabase, jobId, 'Job processed and email sent successfully.', { messageId: emailResult.messageId });

    return NextResponse.json({ success: true, message: `Job ${jobId} processed.` });

  } catch (error: any) {
    console.error(`[PROCESS-JOB-ERROR] Job ID ${jobId || 'N/A'}:`, error.message);
    if (jobId) {
      // If an error occurs at any point, mark the job as 'failed' so it isn't retried.
      await supabase.from('campaign_jobs').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', jobId);
      await logJobOutcome(supabase, jobId, 'Job processing failed.', { error: error.message });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}