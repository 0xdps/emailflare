import { env } from "cloudflare:workers";
export { getServerSession } from "@/app/actions/auth";
import { getServerSession } from "@/app/actions/auth";
import { makeDb, D1Db } from "@/worker/inbox/db";
import { LAYOUTS } from "@/worker/inbox/emails";
import { enrich } from "@/lib/core";
import {
	getCloudflareTokenStatus as fetchCfStatus,
	listAllZones,
	listSendingSubdomains,
	getCatchAllRule,
} from "@/worker/inbox/services/cloudflare";
import { inboxWorkerName, type Env } from "@/worker/inbox/env";

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

export interface DomainCatalogEntry {
	zoneName: string;
	enabled: boolean;
	domainId: string | null;
	sendingName: string | null;
	sending: "ready" | "pending" | "off";
	routing: "ready" | "pending" | "unknown";
	dns: "written" | "manual" | "unknown";
}

export async function getDomainCatalog(): Promise<{
	zones: DomainCatalogEntry[];
	truncated: boolean;
	error: string | null;
}> {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.CF_API_TOKEN || !workerEnv.DB) {
		return { zones: [], truncated: false, error: "CF_API_TOKEN is not configured." };
	}
	try {
		const zones = await listAllZones(workerEnv.CF_API_TOKEN);
		const capped = zones.slice(0, 25);
		const { domains } = makeDb(workerEnv.DB);
		const stored = await domains.find();
		const entries = await Promise.all(
			capped.map(async (zone) => {
				const row = stored.find(
					(domain) =>
						domain.cf_zone_id === zone.id ||
						domain.name === zone.name ||
						domain.name.endsWith(`.${zone.name}`),
				);
				let sending: DomainCatalogEntry["sending"] = row?.verified ? "ready" : "off";
				let sendingName = row?.name ?? null;
				let routing: DomainCatalogEntry["routing"] =
					row?.routing_status === "ready" || row?.routing_status === "pending"
						? row.routing_status
						: "unknown";
				try {
					const subs = await listSendingSubdomains(zone.id, workerEnv.CF_API_TOKEN);
					const match =
						subs.find((sub) => sub.name === row?.name) ?? subs.find((sub) => sub.enabled) ?? subs[0];
					sending = match ? (match.enabled ? "ready" : "pending") : "off";
					sendingName = match?.name ?? sendingName;
				} catch {
					/* keep stored state */
				}
				try {
					const rule = await getCatchAllRule(zone.id, workerEnv.CF_API_TOKEN);
					const worker = rule.actions?.find((action) => action.type === "worker");
					routing = rule.enabled && worker?.value?.includes(inboxWorkerName(workerEnv)) ? "ready" : "pending";
				} catch {
					/* keep stored state */
				}
				return {
					zoneName: zone.name,
					enabled: !!row,
					domainId: row?.id ?? null,
					sendingName,
					sending,
					routing,
					dns: (row?.dns_status === "written" || row?.dns_status === "manual"
						? row.dns_status
						: "unknown") as DomainCatalogEntry["dns"],
				};
			}),
		);
		return { zones: entries, truncated: zones.length > capped.length, error: null };
	} catch (error) {
		return {
			zones: [],
			truncated: false,
			error: error instanceof Error ? error.message : "Could not list Cloudflare zones.",
		};
	}
}

export async function getUsersList() {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.DB) return [];
	const users = await workerEnv.DB.prepare(
		"SELECT id, name, email, user_type, access_types, created_at FROM users ORDER BY created_at ASC",
	).all<{
		id: string;
		name: string;
		email: string;
		user_type?: "admin" | "member";
		access_types?: string;
		created_at: string;
	}>();

	return (users.results ?? []).map((u) => {
		const user_type: "admin" | "member" = u.user_type === "admin" ? "admin" : "member";
		let access_types: ("inbox" | "api" | "tester")[] = [];
		if (user_type === "admin") {
			access_types = ["inbox", "api", "tester"];
		} else if (u.access_types) {
			try {
				const parsed = JSON.parse(u.access_types);
				access_types = Array.isArray(parsed) ? parsed : [];
			} catch {
				access_types = [];
			}
		}
		return {
			id: u.id,
			name: u.name,
			email: u.email,
			user_type,
			access_types,
			created_at: u.created_at,
		};
	});
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

	const session = await getServerSession().catch(() => null);
	if (session && session.userType !== "admin") {
		const rows = await workerEnv.DB.prepare(
			`SELECT i.* FROM inboxes i
			 JOIN inbox_members im ON i.id = im.inbox_id
			 WHERE im.user_id = ?
			 ORDER BY i.created_at DESC`,
		)
			.bind(session.userId)
			.all();
		return (rows.results ?? []).map(toInbox);
	}

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
	latest_subject?: string | null;
	latest_snippet?: string | null;
	latest_inbox?: string | null;
	inbox_address?: string | null;
}

export async function getPeopleList(search?: string, unread?: boolean, inbox?: string): Promise<Person[]> {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.DB) return [];

	const conditions: string[] = [];
	const params: unknown[] = [];
	let assignedEmails: string[] = [];

	const session = await getServerSession().catch(() => null);
	const isAdmin = session?.userType === "admin";
	if (session && !isAdmin) {
		const assignedRows = await workerEnv.DB.prepare(
			"SELECT i.email FROM inboxes i JOIN inbox_members im ON i.id = im.inbox_id WHERE im.user_id = ?",
		)
			.bind(session.userId)
			.all<{ email: string }>();
		assignedEmails = (assignedRows.results ?? []).map((r) => r.email);
		if (assignedEmails.length === 0) return [];
		if (inbox && !assignedEmails.includes(inbox)) return [];

		if (inbox) {
			conditions.push("(p.inbox_address = ? OR ie.inbox_address = ?)");
			params.push(inbox, inbox);
		} else {
			const placeholders = assignedEmails.map(() => "?").join(",");
			conditions.push(`(p.inbox_address IN (${placeholders}) OR ie.inbox_address IN (${placeholders}))`);
			params.push(...assignedEmails, ...assignedEmails);
		}
	} else if (inbox) {
		conditions.push("(p.inbox_address = ? OR ie.inbox_address = ?)");
		params.push(inbox, inbox);
	}

	if (search) {
		conditions.push("(p.email LIKE ? OR p.name LIKE ?)");
		params.push(`%${search}%`, `%${search}%`);
	}
	if (unread) conditions.push("ie.is_read = 0");

	let subqueryFilter = "";
	const subqueryParams: unknown[] = [];
	if (!isAdmin) {
		if (inbox) {
			subqueryFilter = "AND inbox_address = ?";
			subqueryParams.push(inbox, inbox, inbox);
		} else {
			const placeholders = assignedEmails.map(() => "?").join(",");
			subqueryFilter = `AND inbox_address IN (${placeholders})`;
			subqueryParams.push(...assignedEmails, ...assignedEmails, ...assignedEmails);
		}
	} else if (inbox) {
		subqueryFilter = "AND inbox_address = ?";
		subqueryParams.push(inbox, inbox, inbox);
	}

	let sql = `
    SELECT p.id, p.email, p.name, p.inbox_address, p.created_at,
           COUNT(DISTINCT ie.id) AS total_count,
           SUM(CASE WHEN ie.is_read = 0 THEN 1 ELSE 0 END) AS unread_count,
           MAX(ie.received_at) AS last_email_at,
           (SELECT subject FROM inbox_emails WHERE person_id = p.id ${subqueryFilter} ORDER BY received_at DESC LIMIT 1) as latest_subject,
           (SELECT body_text FROM inbox_emails WHERE person_id = p.id ${subqueryFilter} ORDER BY received_at DESC LIMIT 1) as latest_snippet,
           (SELECT inbox_address FROM inbox_emails WHERE person_id = p.id ${subqueryFilter} ORDER BY received_at DESC LIMIT 1) as latest_inbox
    FROM people p
    LEFT JOIN inbox_emails ie ON ie.person_id = p.id
  `;

	if (conditions.length) sql += ` WHERE ${conditions.join(" AND ")}`;
	sql += " GROUP BY p.id ORDER BY last_email_at DESC NULLS LAST LIMIT 50";

	const data = await workerEnv.DB.prepare(sql)
		.bind(...subqueryParams, ...params)
		.all<Person>();
	return (data.results ?? []).map((r) => ({
		...r,
		inbox_address:
			!isAdmin && r.inbox_address && !assignedEmails.includes(r.inbox_address) ? null : r.inbox_address,
		latest_inbox: !isAdmin && r.latest_inbox && !assignedEmails.includes(r.latest_inbox) ? null : r.latest_inbox,
		unread_count: Number(r.unread_count ?? 0),
		total_count: Number(r.total_count ?? 0),
	}));
}

export interface ThreadHeader {
	id: string; // thread_id
	thread_id: string;
	subject: string;
	latest_subject: string;
	email: string;
	counterparty_email: string;
	name: string | null;
	counterparty_name: string | null;
	person_id?: string | null;
	inbox_address: string;
	last_message_at: string;
	last_email_at: string;
	unread_count: number;
	total_count: number;
	latest_snippet?: string | null;
}

export async function getThreadsList(search?: string, unread?: boolean, inbox?: string): Promise<ThreadHeader[]> {
	const workerEnv = env as unknown as Env;
	if (!workerEnv?.DB) return [];

	const conditions: string[] = [];
	const params: unknown[] = [];
	let assignedEmails: string[] = [];

	const session = await getServerSession().catch(() => null);
	const isAdmin = session?.userType === "admin";
	if (session && !isAdmin) {
		const assignedRows = await workerEnv.DB.prepare(
			"SELECT i.email FROM inboxes i JOIN inbox_members im ON i.id = im.inbox_id WHERE im.user_id = ?",
		)
			.bind(session.userId)
			.all<{ email: string }>();
		assignedEmails = (assignedRows.results ?? []).map((r) => r.email);
		if (assignedEmails.length === 0) return [];
		if (inbox && !assignedEmails.includes(inbox)) return [];

		if (inbox) {
			conditions.push("m.inbox_address = ?");
			params.push(inbox);
		} else {
			const placeholders = assignedEmails.map(() => "?").join(",");
			conditions.push(`m.inbox_address IN (${placeholders})`);
			params.push(...assignedEmails);
		}
	} else if (inbox) {
		conditions.push("m.inbox_address = ?");
		params.push(inbox);
	}

	if (search) {
		conditions.push(
			"(m.subject LIKE ? OR m.counterparty_email LIKE ? OR m.counterparty_name LIKE ? OR m.body_text LIKE ?)",
		);
		params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
	}

	const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
	const havingClause = unread ? "HAVING unread_count > 0" : "";

	const sql = `
		WITH all_messages AS (
			SELECT
				ie.id,
				ie.thread_id,
				ie.inbox_address,
				COALESCE(p.email, ie.inbox_address) AS counterparty_email,
				p.name AS counterparty_name,
				p.id AS person_id,
				ie.subject,
				ie.body_text,
				ie.received_at AS timestamp,
				CASE WHEN ie.is_read = 0 THEN 1 ELSE 0 END AS is_unread
			FROM inbox_emails ie
			LEFT JOIN people p ON p.id = ie.person_id

			UNION ALL

			SELECT
				se.id,
				se.thread_id,
				se.from_address AS inbox_address,
				se.to_address AS counterparty_email,
				p.name AS counterparty_name,
				p.id AS person_id,
				se.subject,
				se.body_text,
				se.sent_at AS timestamp,
				0 AS is_unread
			FROM sent_inbox_emails se
			LEFT JOIN people p ON p.id = se.person_id
		)
		SELECT
			m.thread_id AS id,
			m.inbox_address,
			m.counterparty_email,
			m.counterparty_name,
			m.person_id,
			COALESCE(
				(SELECT subject FROM all_messages m2 WHERE m2.thread_id = m.thread_id AND m2.subject IS NOT NULL AND m2.subject != '' ORDER BY timestamp DESC LIMIT 1),
				'(No subject)'
			) AS subject,
			(SELECT body_text FROM all_messages m2 WHERE m2.thread_id = m.thread_id AND m2.body_text IS NOT NULL ORDER BY timestamp DESC LIMIT 1) AS latest_snippet,
			MAX(m.timestamp) AS last_message_at,
			SUM(m.is_unread) AS unread_count,
			COUNT(m.id) AS total_count
		FROM all_messages m
		${whereClause}
		GROUP BY m.thread_id, m.inbox_address, m.counterparty_email
		${havingClause}
		ORDER BY last_message_at DESC
		LIMIT 50
	`;

	const rows = await workerEnv.DB.prepare(sql)
		.bind(...params)
		.all();

	return (rows.results ?? []).map((r: any) => ({
		id: r.id,
		thread_id: r.id,
		subject: r.subject || "(No subject)",
		latest_subject: r.subject || "(No subject)",
		email: r.counterparty_email,
		counterparty_email: r.counterparty_email,
		name: r.counterparty_name,
		counterparty_name: r.counterparty_name,
		person_id: r.person_id,
		inbox_address: r.inbox_address,
		last_message_at: r.last_message_at,
		last_email_at: r.last_message_at,
		unread_count: Number(r.unread_count || 0),
		total_count: Number(r.total_count || 0),
		latest_snippet: r.latest_snippet || null,
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
