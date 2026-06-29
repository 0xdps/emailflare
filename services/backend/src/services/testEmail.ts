import { db, emailLogs } from '../db.js';
import { customAlphabet } from 'nanoid';
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 21);
import type { CFSendEmailParams, CFSendEmailResult } from './cloudflare.js';

export async function storeTestEmail(params: CFSendEmailParams): Promise<CFSendEmailResult> {
  const id = crypto.randomUUID();

  // Store the test email in the database via the existing email_logs table
  // The caller (send.ts) will handle the actual insert with all metadata
  // We just return a generated ID here so the flow matches sendEmail
  return { id };
}
