// src/app/api/engine/send-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/services/gmailService';
import { generateLoiPdf, PersonalizationData } from '@/services/pdfService';
import { generateOfferDetails } from '@/actions/offerCalculations';
import path from 'path';
import { configure, Environment as NunjucksEnvironment } from 'nunjucks';
import type { Database } from '@/types/supabase';

// Define shorter types for convenience
type Job = Database['public']['Tables']['campaign_jobs']['Row'];

type Lead = Database['public']['Tables']['leads']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];
type Sender = Database['public']['Tables']['senders']['Row'];

// Helper to log job outcomes
async function logJobOutcome(
  supabase: Awaited<ReturnType<typeof createAdminServerClient>>,
  jobId: string,
  message: string,
  details?: object
) {
  const { error } = await supabase.from('job_logs').insert({
    job_id: jobId,
    log_message: message,
    details: details || {},
  });
  if (error) {
    console.error(`Failed to log outcome for job ${jobId}:`, error);
  }
}

// Main API handler triggered by the database worker
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAdminServerClient();
    
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { campaign_id } = requestBody;
    if (!campaign_id) {
      return NextResponse.json({ success: false, error: 'Missing campaign_id' }, { status: 400 });
    }

    // Get job details with proper type casting
    const { data: job, error: jobError } = await supabase
      .from('campaign_jobs')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ success: false, error: jobError?.message || 'Job not found' }, { status: 400 });
    }

    // Ensure all required data exists with proper null checks
    const lead = job.lead;
    const campaign = job.campaign;
    const sender = job.sender;
    
    if (!lead || !campaign || !sender) {
      return NextResponse.json({ success: false, error: 'Missing required job data' }, { status: 400 });
    }

    // 2. Prepare Email Content & PDF
    const offerDetails = generateOfferDetails(lead.assessed_total || 0, `${lead.first_name} ${lead.last_name}`);
    const personalizationData: PersonalizationData = {
      ...lead,
      ...offerDetails,
      greeting_name: lead.first_name || 'Property Owner',
      sender_name: sender.sender_name,
      sender_title: "Acquisitions Director", // TODO: Move to a setting
      company_name: "True Soul Partners LLC", // TODO: Move to a setting
    };

    // Fetch the template directory path from the database first
    const { data: setting, error: settingError } = await supabase
      .from('application_settings')
      .select('value')
      .eq('key', 'template_directory')
      .single();

    if (settingError || !setting?.value) {
      throw new Error(`Configuration error: 'template_directory' setting not found in database. ${settingError?.message || ''}`);
    }

    // Configure Nunjucks with the path from the database
    const templateDir = path.join(process.cwd(), setting.value);
    const nunjucksEnv: NunjucksEnvironment = configure(templateDir, { autoescape: true });

    const subjectTemplate = nunjucksEnv.renderString(
        job.campaign?.subject_template || "Offer for your property at {{property_address}}",
        personalizationData
    );
    const htmlBody = nunjucksEnv.render('email_body_with_subject.html', personalizationData);

    const pdfBuffer = await generateLoiPdf(personalizationData, String(lead.id), lead.email || '');
    if (!pdfBuffer) {
      throw new Error("PDF generation failed.");
    }

    // 3. Send Email
    const emailResult = await sendEmail(
      sender.sender_email,
      lead.email,
      subjectTemplate,
      htmlBody,
      [{
        filename: `LOI_${lead.property_address?.replace(/\s/g, '_')}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }]
    );

    // 4. Update Job Status and Log Outcome
    if (emailResult.success && emailResult.globalMessageId) {
      const { error: updateError } = await supabase
        .from('campaign_jobs')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      if (updateError) {
        throw new Error(`Failed to update job status: ${updateError.message}`);
      }

      await logJobOutcome(supabase, job.id, 'Email sent successfully.', { messageId: emailResult.globalMessageId });

      return NextResponse.json({ success: true, message: `Job ${job.id} processed successfully.` });
    } else {
      throw new Error(String(emailResult.error) || 'Unknown email sending error.');
    }

  } catch (error: any) {
    const errorMessage = error.message || 'An unexpected error occurred.';
    console.error('Error in send-email route:', errorMessage);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}