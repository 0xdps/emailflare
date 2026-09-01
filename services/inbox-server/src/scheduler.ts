// BullMQ-based sequence scheduler + worker.
// Replaces the CF cron trigger (processDueSequenceSteps) and Queue consumer
// (handleSequenceQueueMessage) from services/inbox-worker/src/sequence-processor.ts.
//
// node-cron fires every 5 minutes → enqueues BullMQ jobs.
// BullMQ Worker processes jobs → sends email via CF Email API.

import cron from "node-cron";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { createLogger } from "@emailflare/email-core/logger";
import { rawDb } from "./db.js";
import { sendEmail } from "./services/cloudflare.js";
import { generateId, listUnsubscribeHeaders, applyVariables } from "@emailflare/email-core";
import { env, type SequenceJobData } from "./env.js";

const log = createLogger("scheduler");

const QUEUE_NAME = "sequence-steps";

// ── Redis + BullMQ setup ──────────────────────────────────────────────────────

const redisConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const sequenceQueue = new Queue<SequenceJobData>(QUEUE_NAME, { connection: redisConnection });

// ── Types (mirrors sequence-processor.ts) ─────────────────────────────────────

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
	steps: string;
}
interface Person {
	id: string;
	email: string;
}

// ── Cron tick: find due enrollments, enqueue BullMQ jobs ─────────────────────

export async function processDueSequenceSteps(): Promise<void> {
	const { rows: enrollments } = await rawDb.query<Enrollment>(
		`SELECT e.*, s.steps FROM sequence_enrollments e
     JOIN sequences s ON s.id = e.sequence_id
     WHERE e.status = 'active'
     LIMIT 200`,
	);

	const now = Date.now();

	for (const enrollment of enrollments) {
		const steps: SequenceStep[] = JSON.parse(enrollment.steps);
		const step = steps[enrollment.current_step];
		if (!step) {
			await rawDb.run(`UPDATE sequence_enrollments SET status = 'completed' WHERE id = ?`, [enrollment.id]);
			continue;
		}

		const dueAt = new Date(enrollment.enrolled_at).getTime() + step.delay_days * 86_400_000;
		if (now >= dueAt) {
			await sequenceQueue.add(
				"sequence_step",
				{ type: "sequence_step", enrollmentId: enrollment.id, stepIndex: enrollment.current_step },
				{ attempts: 3, backoff: { type: "exponential", delay: 30_000 } },
			);
		}
	}
}

// ── BullMQ Worker: consume jobs + send emails ─────────────────────────────────

function startSequenceWorker(): Worker<SequenceJobData> {
	return new Worker<SequenceJobData>(
		QUEUE_NAME,
		async (job) => {
			const { enrollmentId, stepIndex } = job.data;

			const enrollment = await rawDb.first<Enrollment>(
				`SELECT e.*, s.steps FROM sequence_enrollments e
         JOIN sequences s ON s.id = e.sequence_id
         WHERE e.id = ? AND e.status = 'active' LIMIT 1`,
				[enrollmentId],
			);
			if (!enrollment) return;

			const steps: SequenceStep[] = JSON.parse(enrollment.steps);
			const step = steps[stepIndex];
			if (!step) return;

			const person = await rawDb.first<Person>("SELECT id, email FROM people WHERE id = ? LIMIT 1", [
				enrollment.person_id,
			]);
			if (!person) return;

			const vars: Record<string, string> = JSON.parse(enrollment.variables);

			// ── Suppression check: skip unsubscribed/bounced addresses ────────────
			const suppressed = await rawDb.first<{ reason: string }>(
				"SELECT reason FROM suppressions WHERE email = ? LIMIT 1",
				[person.email.toLowerCase()],
			);
			if (suppressed) {
				log.info("Skipping suppressed recipient " + person.email + " (" + suppressed.reason + ")");
				await rawDb.run(`UPDATE sequence_enrollments SET current_step = ? WHERE id = ?`, [
					stepIndex + 1,
					enrollmentId,
				]);
				return;
			}

			// ── Issue one-time unsubscribe token + RFC 8058 headers ──────────────
			const publicOrigin = env.PUBLIC_URL.replace(/\/$/, "");
			const token = generateId();
			await rawDb.run(
				"INSERT INTO unsubscribe_tokens (token, email, list_id, created_at) VALUES (?, ?, NULL, ?)",
				[token, person.email.toLowerCase(), new Date().toISOString()],
			);
			const headers = publicOrigin ? listUnsubscribeHeaders(publicOrigin, token, true) : undefined;

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

			await rawDb.run(`UPDATE sequence_enrollments SET current_step = ? WHERE id = ?`, [
				stepIndex + 1,
				enrollmentId,
			]);
		},
		{ connection: redisConnection, concurrency: 5 },
	);
}

// ── Public init ───────────────────────────────────────────────────────────────

let worker: Worker<SequenceJobData> | null = null;

export function startScheduler(): void {
	worker = startSequenceWorker();

	// Every 5 minutes — identical schedule to the CF cron trigger
	cron.schedule("*/5 * * * *", () => {
		processDueSequenceSteps().catch((err) => log.error("processDueSequenceSteps failed:", err));
	});

	log.info("Sequence scheduler and BullMQ worker started");
}

export async function stopScheduler(): Promise<void> {
	if (worker) {
		await worker.close();
		worker = null;
	}
	await sequenceQueue.close();
	await redisConnection.quit();
}
