// src/services/gmailService.ts
import { google } from 'googleapis';
import { Impersonated, GoogleAuth } from 'google-auth-library';
import type { gmail_v1 } from 'googleapis';

// Define a more descriptive return type
export interface GmailSendResult {
  success: boolean;
  internalId?: string;       // The short ID, e.g., '1973e2ad2ea3f111'
  globalMessageId?: string;  // The correct, long ID, e.g., '<...-GMR@mx.google.com>'
  threadId?: string;
  error?: unknown;
}

/**
 * Initializes and returns an authenticated Gmail client for a specific user.
 * This function uses a service account with domain-wide delegation to impersonate the user.
 * @param impersonatedUserEmail - The email address of the user to impersonate.
 * @returns An initialized and authenticated Gmail client instance.
 * @throws Will throw an error if environment variables are not set.
 */
export async function getGmailService(impersonatedUserEmail: string): Promise<gmail_v1.Gmail> {
  const serviceAccountKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKeyJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }

  const credentials = JSON.parse(serviceAccountKeyJson);
  const auth = new GoogleAuth();
  const sourceClient = await auth.getClient();
  const impersonatedClient = new Impersonated({
    sourceClient,
    targetPrincipal: impersonatedUserEmail,
    lifetime: 3600, // Lifetime in seconds, e.g., 1 hour; adjust as needed
    delegates: [],
    targetScopes: ['https://www.googleapis.com/auth/gmail.send'],
  });
  return google.gmail({ version: 'v1', auth: impersonatedClient as any }); // Temporary any cast if needed, but should resolve with proper types
}


/**
 * Send an email using Gmail API and retrieves the globally unique Message-ID.
 * @param impersonatedUserEmail - Email address to send as
 * @param recipientEmail - Email address of the recipient
 * @param subject - Email subject
 * @param htmlBody - HTML content of the email
 * @param attachments - Optional array of file attachments
 * @returns Object containing success status and the correct globalMessageId
 */
export async function sendEmail(
  impersonatedUserEmail: string,
  recipientEmail: string,
  subject: string,
  htmlBody: string,
  attachments?: { filename: string; content: Buffer; contentType?: string; contentId?: string }[]
): Promise<GmailSendResult> {
  try {
    const gmail = await getGmailService(impersonatedUserEmail);

    const boundary = `----=_Part_Boundary_${Math.random().toString(36).substring(2)}`;
    const messageParts = [
      `From: <${impersonatedUserEmail}>`,
      `To: <${recipientEmail}>`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/related; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset="utf-8"`,
      `Content-Transfer-Encoding: 7bit`,
      '',
      htmlBody,
      '',
    ];

    if (attachments && attachments.length > 0) {
      for (const file of attachments) {
        messageParts.push(`--${boundary}`);
        messageParts.push(`Content-Type: ${file.contentType || 'application/octet-stream'}`);
        messageParts.push(`Content-Transfer-Encoding: base64`);
        if (file.contentId) {
          messageParts.push(`Content-ID: <${file.contentId}>`);
          messageParts.push(`Content-Disposition: inline; filename="${file.filename}"`);
        } else {
          messageParts.push(`Content-Disposition: attachment; filename="${file.filename}"`);
        }
        messageParts.push('');
        messageParts.push(file.content.toString('base64'));
      }
    }
    messageParts.push(`--${boundary}--`);

    const rawMessage = Buffer.from(messageParts.join('\r\n')).toString('base64url');

    // --- STEP 1: Send the email ---
    const sendResponse = await gmail.users.messages.send({
      userId: 'me', // 'me' refers to the impersonated user
      requestBody: { raw: rawMessage },
    });

    const internalId = sendResponse.data.id;
    const threadId = sendResponse.data.threadId;

    if (!internalId) {
      throw new Error('Gmail send API call succeeded but returned no message ID.');
    }

    // --- STEP 2: CRITICAL - GET THE MESSAGE METADATA ---
    const getResponse = await gmail.users.messages.get({
      userId: 'me',
      id: internalId,
      format: 'metadata',
      metadataHeaders: ['Message-ID'], // Efficiently fetch only the header we need
    });

    const messageIdHeader = getResponse.data.payload?.headers?.find(
      (h: any) => h.name?.toLowerCase() === 'message-id'
    );

    if (!messageIdHeader?.value) {
      throw new Error(`Could not find Message-ID header for sent email. Internal ID: ${internalId}`);
    }

    const globalMessageId = messageIdHeader.value;

    console.log(`Successfully sent email. Internal ID: ${internalId}, Global Message-ID: ${globalMessageId}`);

    return {
      success: true,
      internalId,
      threadId: threadId || undefined,
      globalMessageId,
    };

  } catch (error) {
    console.error('sendEmail service critical error:', error);
    return { success: false, error };
  }
}