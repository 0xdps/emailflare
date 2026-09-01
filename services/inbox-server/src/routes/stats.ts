import { Hono } from "hono";
import { makeDb, rawDb } from "../db.js";
import type { HonoEnv } from "../env.js";

const CF_DAILY_LIMIT = 1000;
const app = new Hono<HonoEnv>();

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

app.get("/", async (c) => {
	const range = (c.req.query("range") ?? "1d") as "1d" | "7d" | "30d";
	const fromIso = rangeStart(range);
	const todayIso = (() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d.toISOString();
	})();

	const { domains, templates, apiKeys, emailLogs } = makeDb();

	const [
		totalDomains,
		verifiedDomains,
		totalTemplates,
		totalKeys,
		totalEmails,
		sentToday,
		failedToday,
		domainBreakdownResult,
		dailyResult,
	] = await Promise.all([
		domains.count(),
		domains.count({ where: { verified: 1 } }),
		templates.count(),
		apiKeys.count({ where: { active: 1 } }),
		emailLogs.count(),
		emailLogs.count({ where: { status: "sent", sent_at: { gte: todayIso } } }),
		emailLogs.count({ where: { status: "failed", sent_at: { gte: todayIso } } }),
		rawDb.query<{ domain_name: string; verified: number; sent: number; failed: number }>(
			`SELECT d.name AS domain_name, d.verified,
         COALESCE(SUM(CASE WHEN el.status = 'sent'   AND el.sent_at >= ? THEN 1 ELSE 0 END), 0) AS sent,
         COALESCE(SUM(CASE WHEN el.status = 'failed' AND el.sent_at >= ? THEN 1 ELSE 0 END), 0) AS failed
       FROM domains d
       LEFT JOIN email_logs el ON el.domain_id = d.id
       GROUP BY d.id, d.name, d.verified
       ORDER BY sent DESC, d.name ASC`,
			[fromIso, fromIso],
		),
		rawDb.query<{ date: string; sent: number; failed: number }>(
			`SELECT strftime('%Y-%m-%d', sent_at) AS date,
         SUM(CASE WHEN status = 'sent'   THEN 1 ELSE 0 END) AS sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM email_logs WHERE sent_at >= ?
       GROUP BY strftime('%Y-%m-%d', sent_at)
       ORDER BY date ASC`,
			[fromIso],
		),
	]);

	return c.json({
		range,
		totalDomains,
		verifiedDomains,
		totalTemplates,
		totalKeys,
		totalEmails,
		sentToday,
		failedToday,
		cfDailyLimit: CF_DAILY_LIMIT,
		domainBreakdown: domainBreakdownResult.rows.map((r) => ({
			name: r.domain_name,
			verified: r.verified === 1,
			sent: r.sent,
			failed: r.failed,
		})),
		daily: dailyResult.rows,
	});
});

export default app;
