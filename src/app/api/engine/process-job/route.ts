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
import { logSystemEvent } from '@/services/logService'; // Import the logging service

type Lead = Database['public']['Tables']['crm_leads']['Row'];
type Sender = Database['public']['Tables']['senders']['Row'];
type CampaignStep = Database['public']['Tables']['campaign_steps']['Row'];

const templateDir = path.join(process.cwd(), 'src', 'app', 'api', 'engine', 'templates');
const nunjucksEnv = configure(templateDir, { autoescape: true, noCache: true });

// FIX: Ensure 'details' is treated as an object for spreading
async function logJobOutcome(supabase: Awaited<ReturnType<typeof createAdminServerClient>>, jobId: string, message: string, details?: Json, level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' = 'INFO') {
  // Ensure details is an object for spreading.
  // Combine jobId, campaignId, and leadId directly into the details object before passing to logSystemEvent.
  const combinedDetails: Json = {
    jobId: jobId,
    ...(typeof details === 'object' && details !== null && !Array.isArray(details) ? details : { value: details }),
  };

  await logSystemEvent({
    event_type: 'CAMPAIGN_JOB_OUTCOME',
    message: message,
    details: combinedDetails,
    // campaign_id and lead_id are now part of combinedDetails, and logSystemEvent extracts them if needed.
    // If not extracted, they will remain part of the generic 'details' JSON.
    campaign_id: (combinedDetails as any)?.campaign_id as string,
    user_id: (combinedDetails as any)?.user_id as string, // Assuming user_id might also be in details
    level: level
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createAdminServerClient();
  let jobId: string | null = null;
  let leadId: string | null = null; // Track lead_id for logging
  let campaignId: string | null = null; // Track campaign_id for logging
  let userId: string | null = null; // Track user_id for logging

  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    await logSystemEvent({
      event_type: 'PROCESS_JOB_AUTH_ERROR',
      message: 'Unauthorized access to process-job API.',
      level: 'ERROR'
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    jobId = body.job_id;

    if (!jobId) {
      await logSystemEvent({
        event_type: 'PROCESS_JOB_VALIDATION_ERROR',
        message: "Request body must include a 'job_id'.",
        details: { requestBody: body },
        level: 'ERROR'
      });
      throw new Error("Request body must include a 'job_id'.");
    }

    await logSystemEvent({
      event_type: 'CAMPAIGN_JOB_START',
      message: `Attempting to process campaign job: ${jobId}`,
      details: { jobId },
      level: 'INFO'
    });

    const { data: jobData, error: jobError } = await supabase
      .from('campaign_jobs')
      .select('*, crm_leads(*), campaigns(*, campaign_steps(*))')
      .eq('id', jobId)
      .single();

    if (jobError) {
      await logSystemEvent({
        event_type: 'CAMPAIGN_JOB_DB_FETCH_ERROR',
        message: `Database error fetching job ${jobId}.`,
        details: { jobId, dbError: jobError.message },
        level: 'ERROR'
      });
      throw new Error(`Database error fetching job: ${jobError.message}`);
    }
    if (!jobData) {
      await logSystemEvent({
        event_type: 'CAMPAIGN_JOB_NOT_FOUND',
        message: `Job with ID ${jobId} not found.`,
        details: { jobId },
        level: 'ERROR'
      });
      throw new Error(`Job with ID ${jobId} not found.`);
    }

    const lead = jobData.crm_leads as unknown as Lead;
    const campaign = jobData.campaigns; // Get the campaign object
    const campaignSteps = campaign?.campaign_steps as unknown as CampaignStep[] | undefined;
    
    leadId = String(lead.id); // FIX: Convert number to string
    campaignId = campaign?.id || null; // Capture campaign_id
    userId = campaign?.user_id || null; // Capture user_id from campaign

    if (!lead) {
      await logSystemEvent({
        event_type: 'CAMPAIGN_JOB_MISSING_LEAD_DATA',
        message: `Lead data is missing for job ${jobId}.`,
        details: { jobId, campaignId, leadId, userId },
        level: 'ERROR'
      });
      throw new Error(`Lead data is missing for job ${jobId}.`);
    }
    if (!campaignSteps || campaignSteps.length === 0) {
      await logSystemEvent({
        event_type: 'CAMPAIGN_JOB_MISSING_STEPS',
        message: `No campaign steps found for job ${jobId}.`,
        details: { jobId, campaignId, leadId, userId },
        level: 'ERROR'
      });
      throw new Error(`No campaign steps found for job ${jobId}.`);
    }
    
    const currentStep = campaignSteps[0]; 
    
    await logSystemEvent({
      event_type: 'CAMPAIGN_JOB_FETCHING_SENDER',
      message: `Fetching available sender for job ${jobId} (lead: ${leadId}).`,
      details: { jobId, campaignId, leadId, userId },
      level: 'DEBUG'
    });

    const { data: senders, error: senderError } = await supabase
      .from('senders')
      .select('*')
      .eq('is_active', true)
      .lt('sent_today', 100)
      .limit(1);

    if (senderError) {
      await logSystemEvent({
        event_type: 'CAMPAIGN_JOB_SENDER_FETCH_ERROR',
        message: `Database error fetching sender for job ${jobId}.`,
        details: { jobId, campaignId, leadId, userId, dbError: senderError.message },
        level: 'ERROR'
      });
      throw new Error(`Database error fetching sender: ${senderError.message}`);
    }
    if (!senders || senders.length === 0) {
      await logSystemEvent({
        event_type: 'CAMPAIGN_JOB_NO_SENDER_AVAILABLE',
        message: `No available email senders found that are under quota for job ${jobId}.`,
        details: { jobId, campaignId, leadId, userId },
        level: 'WARN'
      });
      throw new Error('No available email senders found that are under quota.');
    }
    const sender = senders[0] as Sender;

    await logSystemEvent({
      event_type: 'CAMPAIGN_JOB_SENDER_ASSIGNED',
      message: `Sender ${sender.sender_email} assigned for job ${jobId}.`,
      details: { jobId, campaignId, leadId, userId, senderEmail: sender.sender_email },
      level: 'DEBUG'
    });

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
    
    await logSystemEvent({
      event_type: 'CAMPAIGN_JOB_PDF_GENERATION_START',
      message: `Generating PDF for job ${jobId}.`,
      details: { jobId, campaignId, leadId, userId, propertyAddress: personalizationData.property_address },
      level: 'DEBUG'
    });

    const pdfBuffer = await generateLoiPdf(personalizationData, String(lead.id), lead.contact_email || 'unknown');
    if (!pdfBuffer) {
      await logSystemEvent({
        event_type: 'CAMPAIGN_JOB_PDF_GENERATION_FAILED',
        message: `PDF generation failed for job ${jobId}.`,
        details: { jobId, campaignId, leadId, userId, propertyAddress: personalizationData.property_address },
        level: 'ERROR'
      });
      throw new Error("PDF generation failed and returned no buffer.");
    }

    await logSystemEvent({
      event_type: 'CAMPAIGN_JOB_EMAIL_SEND_START',
      message: `Attempting to send email for job ${jobId} to ${lead.contact_email}.`,
      details: { jobId, campaignId, leadId, userId, recipient: lead.contact_email, subject },
      level: 'INFO'
    });

    const emailResult = await sendEmail(
      sender.sender_email,
      lead.contact_email!,
      subject,
      htmlBody,
      [{ filename: `LOI_${personalizationData.property_address?.replace(/\s/g, '_')}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
    );

    if (!emailResult.success) {
      const errorMessage = String(emailResult.error || "Unknown email sending error.");
      await logSystemEvent({
        event_type: 'CAMPAIGN_JOB_EMAIL_SEND_FAILED',
        message: `Email sending failed for job ${jobId}: ${errorMessage}`,
        details: { jobId, campaignId, leadId, userId, recipient: lead.contact_email, error: errorMessage },
        level: 'ERROR'
      });
      throw new Error(errorMessage);
    }
    
    await supabase.from('campaign_jobs').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', jobId);
    await supabase.rpc('increment_sender_sent_count', { sender_id: sender.id });
    
    await logSystemEvent({
      event_type: 'CAMPAIGN_JOB_COMPLETED',
      message: `Job ${jobId} processed and email sent successfully.`,
      details: { jobId, campaignId, leadId, userId, recipient: lead.contact_email, messageId: emailResult.globalMessageId, senderEmail: sender.sender_email },
      level: 'INFO'
    });

    return NextResponse.json({ success: true, message: `Job ${jobId} processed.` });

  } catch (error: any) {
    console.error(`[PROCESS-JOB-ERROR] Job ID ${jobId || 'N/A'}:`, error.message);
    if (jobId) {
      await supabase.from('campaign_jobs').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', jobId);
      await logSystemEvent({
        event_type: 'CAMPAIGN_JOB_FAILED',
        message: `Job processing failed for job ${jobId}: ${error.message}`,
        details: { jobId, campaignId, leadId, userId, error: error.message },
        level: 'ERROR'
      });
    } else {
        await logSystemEvent({
          event_type: 'PROCESS_JOB_UNKNOWN_FAILURE',
          message: `Unknown job processing failure: ${error.message}`,
          details: { error: error.message },
          level: 'ERROR'
        });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}