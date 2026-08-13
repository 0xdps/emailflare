import type { CFSendEmailParams, CFSendEmailResult } from './cloudflare.js';

/**
 * storeTestEmail — in-house test mailbox.
 *
 * Test API keys do not send through Cloudflare; instead the email content is
 * captured into email_logs (html_body / text_body) and surfaced in the
 * Test Mailbox admin page. The actual row insert happens in the caller
 * (routes/send.ts), which already has all the recipient/template metadata.
 * We return a synthetic message id so the send flow is unchanged.
 */
export async function storeTestEmail(_params: CFSendEmailParams): Promise<CFSendEmailResult> {
  return { id: crypto.randomUUID() };
}
