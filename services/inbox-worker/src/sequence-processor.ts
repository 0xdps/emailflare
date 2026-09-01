// Sequence step processor
// Called by the cron trigger (every 5 min) and queue consumer.
//
// Cron: scans active enrollments where the next step is due, enqueues each one.
// Queue: sends the individual step email via CF Email API.

import { sendEmail } from './services/cloudflare.ts';
import { generateId, listUnsubscribeHeaders, applyVariables } from '@emailflare/email-core';
import { createLogger } from '@emailflare/email-core/logger';
import type { Env, SequenceQueueMessage } from './env.ts';

const log = createLogger('sequence-processor');

interface SequenceStep {
  delay_days: number;
  subject: string;
  html?: string;
  text?: string;
}

interface Enrollment {
  id: string;
  sequence_id: string;
  person_id: string;
  from_address: string;
  variables: string;
  current_step: number;
  status: string;
  enrolled_at: string;
}

interface Person {
  id: string;
  email: string;
}

interface Sequence {
  id: string;
  steps: string;
}

/** Cron handler: find due enrollments and enqueue them. */
export async function processDueSequenceSteps(env: Env): Promise<void> {
  const active = await env.DB.prepare(
    `SELECT e.*, s.steps FROM sequence_enrollments e
     JOIN sequences s ON s.id = e.sequence_id
     WHERE e.status = 'active'
     LIMIT 200`,
  ).all<Enrollment & { steps: string }>();

  const now = Date.now();
  const toEnqueue: SequenceQueueMessage[] = [];

  for (const enrollment of active.results ?? []) {
    const steps: SequenceStep[] = JSON.parse(enrollment.steps);
    const step = steps[enrollment.current_step];
    if (!step) {
      // Sequence completed
      await env.DB.prepare(
        `UPDATE sequence_enrollments SET status = 'completed' WHERE id = ?`,
      ).bind(enrollment.id).run();
      continue;
    }

    const dueAt = new Date(enrollment.enrolled_at).getTime() + step.delay_days * 86_400_000;
    if (now >= dueAt) {
      toEnqueue.push({ type: 'sequence_step', enrollmentId: enrollment.id, stepIndex: enrollment.current_step });
    }
  }

  if (toEnqueue.length) {
    await env.EMAIL_QUEUE.sendBatch(toEnqueue.map(msg => ({ body: msg })));
  }
}

/** Queue consumer: send one sequence step email. */
export async function handleSequenceQueueMessage(
  msg: SequenceQueueMessage,
  env: Env,
): Promise<void> {
  if (msg.type !== 'sequence_step') return;

  const enrollment = await env.DB.prepare(
    `SELECT e.*, s.steps FROM sequence_enrollments e
     JOIN sequences s ON s.id = e.sequence_id
     WHERE e.id = ? AND e.status = 'active' LIMIT 1`,
  ).bind(msg.enrollmentId).first<Enrollment & { steps: string }>();

  if (!enrollment) return;

  const steps: SequenceStep[] = JSON.parse(enrollment.steps);
  const step = steps[msg.stepIndex];
  if (!step) return;

  const person = await env.DB.prepare(
    'SELECT id, email FROM people WHERE id = ? LIMIT 1',
  ).bind(enrollment.person_id).first<Person>();
  if (!person) return;

  const vars: Record<string, string> = JSON.parse(enrollment.variables);

  // ── Suppression check: skip unsubscribed/bounced addresses ────────────────
  const suppressed = await env.DB.prepare(
    'SELECT reason FROM suppressions WHERE email = ? LIMIT 1',
  ).bind(person.email.toLowerCase()).first<{ reason: string }>();
  if (suppressed) {
    log.info('skipping suppressed recipient', { email: person.email, reason: suppressed.reason });
    // Advance so the sequence doesn't stall on this step
    await env.DB.prepare(
      `UPDATE sequence_enrollments SET current_step = ? WHERE id = ?`,
    ).bind(msg.stepIndex + 1, enrollment.id).run();
    return;
  }

  // ── Issue one-time unsubscribe token + RFC 8058 headers ──────────────────
  const publicOrigin = (env.PUBLIC_URL ?? '').replace(/\/$/, '');
  const token = generateId();
  await env.DB.prepare(
    'INSERT INTO unsubscribe_tokens (token, email, list_id, created_at) VALUES (?, ?, NULL, ?)',
  ).bind(token, person.email.toLowerCase(), new Date().toISOString()).run();
  const headers = publicOrigin ? listUnsubscribeHeaders(publicOrigin, token, true) : undefined;

  try {
    await sendEmail(
      {
        from: enrollment.from_address,
        to: person.email,
        subject: applyVariables(step.subject, vars),
        html: step.html ? applyVariables(step.html, vars) : undefined,
        text: step.text ? applyVariables(step.text, vars) : undefined,
        ...(headers ? { headers } : {}),
      },
      env.CF_API_TOKEN,
      env.CF_ACCOUNT_ID,
    );

    // Advance to next step
    await env.DB.prepare(
      `UPDATE sequence_enrollments SET current_step = ? WHERE id = ?`,
    ).bind(msg.stepIndex + 1, enrollment.id).run();
  } catch (err) {
    // Log failure but don't crash the worker; message will be retried by queue
    log.error('sequence step send failed', err);
    throw err; // re-throw so queue retries
  }
}
