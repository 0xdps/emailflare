import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { generateId } from "@/lib/core";
import { writeAudit } from "../lib/audit.ts";
import type { HonoEnv } from "../env.ts";

const EVENTS = ["email.sent", "email.failed", "email.opened", "email.clicked", "email.bounced"] as const;

const app = new Hono<HonoEnv>();

app.get("/", async (c) => {
	const rows = await c.env.DB.prepare(
		"SELECT id, url, events, active, created_at FROM webhooks ORDER BY created_at DESC",
	).all();
	return c.json(rows.results ?? []);
});

app.post(
	"/",
	zValidator(
		"json",
		z.object({
			url: z.string().url(),
			events: z.array(z.enum(EVENTS)).min(1),
		}),
	),
	async (c) => {
		const { url, events } = c.req.valid("json");
		const id = generateId();
		const secret = generateId() + generateId();
		await c.env.DB.prepare(
			"INSERT INTO webhooks (id, url, secret, events, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
		)
			.bind(id, url, secret, JSON.stringify(events), new Date().toISOString())
			.run();
		await writeAudit(c.env.DB, {
			actorId: c.get("userId"),
			action: "webhook.create",
			targetType: "webhook",
			targetId: id,
			detail: url,
		});
		return c.json({ id, url, events, secret }, 201);
	},
);

app.delete("/:id", async (c) => {
	const id = c.req.param("id");
	await c.env.DB.prepare("UPDATE webhooks SET active = 0 WHERE id = ?").bind(id).run();
	await writeAudit(c.env.DB, {
		actorId: c.get("userId"),
		action: "webhook.disable",
		targetType: "webhook",
		targetId: id,
	});
	return c.json({ ok: true });
});

export default app;
