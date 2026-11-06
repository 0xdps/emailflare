import { env } from "cloudflare:workers";
import { makeDb, D1Db } from "@/worker/inbox/db";
import { LAYOUTS } from "@/worker/inbox/emails";
import { enrich } from "@emailflare/email-core";
import { getCloudflareTokenStatus as fetchCfStatus } from "@/worker/inbox/services/cloudflare";
import type { Env } from "@/worker/inbox/env";

const CF_DAILY_LIMIT = 1000;

function rangeStart(range: string): string {
	const now = new Date();
	switch (range) {
		case "7d":
			now.setDate(now.getDate() - 6);
			now.setHours(0, 0, 0, 0);
			break;
		case "30d":
			now.setDate(now.getDate() - 29);
			now.setHours(0, 0, 0, 0);
			break;
		default:
			now.setHours(0, 0, 0, 0);
	}
	return now.toISOString();
}

export interface DomainBreakdown {
	name: string;
	verified: boolean;
	sent: number;
	failed: number;
	bounces: number;
	complaints: number;
}

export interface DailyBucket {
	date: string;
	sent: number;
	failed: number;
}

export interface DashboardStats {
	totalDomains: number;
	verifiedDomains: number;
	totalTemplates: number;
	totalKeys: number;
	totalEmails: number;
	sentToday: number;
	failedToday: number;
	cfDailyLimit: number;
	domainBreakdown: DomainBreakdown[];
	daily: DailyBucket[];
}

export interface DashboardLogRow {
	id: string;
	to_address: string;
	from_address: string;
	subject: string;
	status: "sent" | "failed";
	error: string | null;
	sent_at: string;
}

export interface CFTokenStatus {
	configured: boolean;
	active: boolean;
	tokenStatus: string | null;
	tokenId: string | null;
	notBefore: string | null;
	expiresOn: string | null;
	accountId: string | null;
	accountName: string | null;
	message: string;
}

export async function getDashboardStats(range: "1d" | "7d" | "30d" = "7d"): Promise<DashboardStats> {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.DB) {
		return {
			totalDomains: 0,
			verifiedDomains: 0,
			totalTemplates: 0,
			totalKeys: 0,
			totalEmails: 0,
			sentToday: 0,
			failedToday: 0,
			cfDailyLimit: CF_DAILY_LIMIT,
			domainBreakdown: [],
			daily: [],
		};
	}

	const fromIso = rangeStart(range);
	const todayIso = (() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d.toISOString();
	})();

	const { templates, apiKeys } = makeDb(workerEnv.DB);
	const db = new D1Db(workerEnv.DB);

	const [domainCounts, emailCounts, totalTemplates, totalKeys, domainBreakdownResult, dailyResult] =
		await Promise.all([
			workerEnv.DB.prepare(
				`SELECT
           COUNT(*) AS total,
           COALESCE(SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END), 0) AS verified
         FROM domains`,
			).first<{ total: number; verified: number }>(),
			workerEnv.DB.prepare(
				`SELECT
           COUNT(*) AS total,
           COALESCE(SUM(CASE WHEN status = 'sent'   AND sent_at >= ? THEN 1 ELSE 0 END), 0) AS sent_today,
           COALESCE(SUM(CASE WHEN status = 'failed' AND sent_at >= ? THEN 1 ELSE 0 END), 0) AS failed_today
         FROM email_logs`,
			)
				.bind(todayIso, todayIso)
				.first<{ total: number; sent_today: number; failed_today: number }>(),
			templates.count().catch(() => 0),
			apiKeys.count({ where: { active: 1 } }).catch(() => 0),
			db
				.query<{ domain_name: string; verified: number; sent: number; failed: number }>(
					`SELECT
           d.name AS domain_name,
           d.verified,
           COALESCE(SUM(CASE WHEN el.status = 'sent'   AND el.sent_at >= ? THEN 1 ELSE 0 END), 0) AS sent,
           COALESCE(SUM(CASE WHEN el.status = 'failed' AND el.sent_at >= ? THEN 1 ELSE 0 END), 0) AS failed
         FROM domains d
         LEFT JOIN email_logs el ON el.domain_id = d.id
         GROUP BY d.id, d.name, d.verified
         ORDER BY sent DESC, d.name ASC`,
					[fromIso, fromIso],
				)
				.catch(() => ({ rows: [] })),
			db
				.query<{ date: string; sent: number; failed: number }>(
					`SELECT
           strftime('%Y-%m-%d', sent_at) AS date,
           SUM(CASE WHEN status = 'sent'   THEN 1 ELSE 0 END) AS sent,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
         FROM email_logs
         WHERE sent_at >= ?
         GROUP BY strftime('%Y-%m-%d', sent_at)
         ORDER BY date ASC`,
					[fromIso],
				)
				.catch(() => ({ rows: [] })),
		]);

	return {
		totalDomains: domainCounts?.total ?? 0,
		verifiedDomains: domainCounts?.verified ?? 0,
		totalTemplates,
		totalKeys,
		totalEmails: emailCounts?.total ?? 0,
		sentToday: emailCounts?.sent_today ?? 0,
		failedToday: emailCounts?.failed_today ?? 0,
		cfDailyLimit: CF_DAILY_LIMIT,
		domainBreakdown: domainBreakdownResult.rows.map((r) => ({
			name: r.domain_name,
			verified: r.verified === 1,
			sent: r.sent,
			failed: r.failed,
			bounces: 0,
			complaints: 0,
		})),
		daily: dailyResult.rows,
	};
}

export async function getDashboardLogs(limit = 10): Promise<DashboardLogRow[]> {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.DB) return [];

	const rows = await workerEnv.DB.prepare(
		`SELECT id, to_address, from_address, subject, status, error, sent_at
     FROM email_logs
     ORDER BY sent_at DESC
     LIMIT ?`,
	)
		.bind(limit)
		.all<DashboardLogRow>();

	return rows.results ?? [];
}

export interface LogRow {
	id: string;
	to_address: string;
	from_address: string;
	subject: string;
	status: "sent" | "failed";
	cf_message_id: string | null;
	domain_id: string | null;
	template_id: string | null;
	error: string | null;
	is_test: number;
	sent_at: string;
}

export interface PagedLogs {
	data: LogRow[];
	total: number;
	page: number;
	limit: number;
	pages: number;
}

export async function getLogsList(
	page = 1,
	limit = 50,
	status?: string,
	search?: string,
	from?: string,
	to?: string,
): Promise<PagedLogs> {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.DB) {
		return { data: [], total: 0, page: 1, limit, pages: 0 };
	}

	const offset = (page - 1) * limit;
	const conditions: string[] = [];
	const params: unknown[] = [];

	if (status) {
		conditions.push("status = ?");
		params.push(status);
	}
	if (from) {
		conditions.push("sent_at >= ?");
		params.push(from);
	}
	if (to) {
		conditions.push("sent_at <= ?");
		params.push(to);
	}
	if (search) {
		conditions.push("(to_address LIKE ? OR from_address LIKE ? OR subject LIKE ?)");
		const like = `%${search}%`;
		params.push(like, like, like);
	}

	const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
	const db = new D1Db(workerEnv.DB);

	const [dataResult, countResult] = await Promise.all([
		db.query<LogRow>(
			`SELECT id, to_address, from_address, subject, status, cf_message_id, domain_id, template_id, error, is_test, sent_at
       FROM email_logs ${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?`,
			[...params, limit, offset],
		),
		db.query<{ total: number }>(`SELECT COUNT(*) as total FROM email_logs ${where}`, params),
	]);

	const total = countResult.rows[0]?.total ?? 0;

	return {
		data: dataResult.rows,
		total,
		page,
		limit,
		pages: Math.ceil(total / limit),
	};
}

export async function getCloudflareStatus(): Promise<CFTokenStatus | null> {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.CF_API_TOKEN) return null;
	try {
		return (await fetchCfStatus(workerEnv.CF_API_TOKEN, workerEnv.CF_ACCOUNT_ID)) as CFTokenStatus;
	} catch {
		return null;
	}
}

export async function getApiKeysList() {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.DB) return [];
	const { apiKeys } = makeDb(workerEnv.DB);
	const rows = await apiKeys.find({ orderBy: [{ column: "created_at", direction: "desc" }] });
	return rows.map(({ key_hash: _, ...r }) => r);
}

export async function getDomainsList() {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.DB) return [];
	const { domains } = makeDb(workerEnv.DB);
	return await domains.find({ orderBy: [{ column: "created_at", direction: "desc" }] });
}

export async function getUsersList() {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.DB) return [];
	const users = await workerEnv.DB.prepare(
		"SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC",
	).all();
	return users.results ?? [];
}

export async function getTemplatesList() {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.DB) return [];
	const { templates } = makeDb(workerEnv.DB);
	const rows = await templates.find({
		orderBy: [
			{ column: "is_system", direction: "desc" },
			{ column: "updated_at", direction: "desc" },
		],
	});
	return rows.map((r) => enrich(r, LAYOUTS));
}

function toInbox(row: any) {
	const { routing_configured, routing_error, ...rest } = row;
	return {
		...rest,
		routing: {
			configured: !!routing_configured,
			...(routing_error ? { error: routing_error } : {}),
		},
	};
}

export async function getInboxesList() {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.DB) return [];
	const rows = await workerEnv.DB.prepare("SELECT * FROM inboxes ORDER BY created_at DESC").all();
	return (rows.results ?? []).map(toInbox);
}

export async function getSequencesList() {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.DB) return [];
	const rows = await workerEnv.DB.prepare("SELECT * FROM sequences ORDER BY created_at DESC").all();
	return (rows.results ?? []).map((r: any) => ({
		...r,
		steps: typeof r.steps === "string" ? JSON.parse(r.steps) : (r.steps ?? []),
	}));
}

export interface Person {
	id: string;
	email: string;
	name: string | null;
	unread_count: number;
	total_count: number;
	last_email_at: string | null;
}

export async function getPeopleList(search?: string, unread?: boolean): Promise<Person[]> {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.DB) return [];

	let sql = `
    SELECT p.id, p.email, p.name, p.created_at,
           COUNT(DISTINCT ie.id) AS total_count,
           SUM(CASE WHEN ie.is_read = 0 THEN 1 ELSE 0 END) AS unread_count,
           MAX(ie.received_at) AS last_email_at
    FROM people p
    LEFT JOIN inbox_emails ie ON ie.person_id = p.id
  `;
	const params: unknown[] = [];
	const conditions: string[] = [];

	if (search) {
		conditions.push("(p.email LIKE ? OR p.name LIKE ?)");
		params.push(`%${search}%`, `%${search}%`);
	}
	if (unread) conditions.push("ie.is_read = 0");

	if (conditions.length) sql += ` WHERE ${conditions.join(" AND ")}`;
	sql += " GROUP BY p.id ORDER BY last_email_at DESC NULLS LAST LIMIT 50";

	const data = await workerEnv.DB.prepare(sql)
		.bind(...params)
		.all<Person>();
	return (data.results ?? []).map((r) => ({
		...r,
		unread_count: Number(r.unread_count ?? 0),
		total_count: Number(r.total_count ?? 0),
	}));
}

export async function getListsList() {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.DB) return [];
	const { lists } = makeDb(workerEnv.DB);
	return await lists.find({ orderBy: [{ column: "created_at", direction: "asc" }] });
}

export interface PagedSuppressions {
	data: Array<{
		id: string;
		email: string;
		reason: "hard_bounce" | "soft_bounce" | "complaint" | "manual" | "unsubscribed";
		domain_id: string | null;
		email_log_id: string | null;
		list_id: string | null;
		created_at: string;
	}>;
	total: number;
	page: number;
	limit: number;
	pages: number;
}

export async function getSuppressionsList(
	page = 1,
	limit = 50,
	reason?: string,
	search?: string,
): Promise<PagedSuppressions> {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.DB) {
		return { data: [], total: 0, page: 1, limit, pages: 0 };
	}

	const offset = (page - 1) * limit;
	const conditions: string[] = [];
	const params: unknown[] = [];

	if (reason) {
		conditions.push("reason = ?");
		params.push(reason);
	}
	if (search) {
		conditions.push("email LIKE ?");
		params.push(`%${search}%`);
	}

	const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
	const { db } = makeDb(workerEnv.DB);

	const [dataResult, countResult] = await Promise.all([
		db.query(`SELECT * FROM suppressions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [
			...params,
			limit,
			offset,
		]),
		db.query<{ total: number }>(`SELECT COUNT(*) as total FROM suppressions ${where}`, params),
	]);

	const total = countResult.rows[0]?.total ?? 0;

	return {
		data: dataResult.rows as any,
		total,
		page,
		limit,
		pages: Math.ceil(total / limit),
	};
}
