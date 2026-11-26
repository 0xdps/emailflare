// Attachment download/preview
// GET /api/inbox/attachments/:id            — view in browser when the type is safe, else download
// GET /api/inbox/attachments/:id?download=1 — always download

import { Hono } from "hono";
import type { HonoEnv } from "../../env.ts";

const app = new Hono<HonoEnv>();

// Senders control content type and bytes, and this is served from the app origin.
// Only types that cannot run script in the browser are shown inline. HTML and SVG
// are always forced to download.
const INLINE_TYPE = /^(image\/(png|jpe?g|gif|webp|avif|bmp)|application\/pdf|text\/plain)$/i;
const MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

function contentDisposition(kind: "inline" | "attachment", filename: string): string {
	const clean = filename.replace(/[\r\n"\\/]/g, "_").trim() || "attachment";
	const ascii = clean.replace(/[^\x20-\x7e]/g, "_");
	return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}

app.get("/:id", async (c) => {
	const row = await c.env.DB.prepare(
		`SELECT a.filename, a.content_type, a.r2_key, ie.inbox_address
		 FROM attachments a JOIN inbox_emails ie ON ie.id = a.email_id
		 WHERE a.id = ? LIMIT 1`,
	)
		.bind(c.req.param("id"))
		.first<{ filename: string; content_type: string; r2_key: string; inbox_address: string }>();
	if (!row) return c.json({ error: "Attachment not found" }, 404);

	if (c.get("userType") !== "admin") {
		const member = await c.env.DB.prepare(
			`SELECT 1 FROM inboxes i JOIN inbox_members im ON im.inbox_id = i.id
			 WHERE im.user_id = ? AND i.email = ? LIMIT 1`,
		)
			.bind(c.get("userId"), row.inbox_address)
			.first();
		if (!member) return c.json({ error: "Attachment not found" }, 404);
	}

	const object = await c.env.ATTACHMENTS.get(row.r2_key);
	if (!object) return c.json({ error: "Attachment file is missing" }, 404);

	const type = row.content_type.split(";")[0].trim().toLowerCase();
	const inline = c.req.query("download") !== "1" && INLINE_TYPE.test(type);
	const headers = new Headers({
		"Content-Type": !MIME.test(type)
			? "application/octet-stream"
			: type === "text/plain"
				? "text/plain; charset=utf-8"
				: type,
		"Content-Disposition": contentDisposition(inline ? "inline" : "attachment", row.filename),
		"Content-Length": String(object.size),
		"X-Content-Type-Options": "nosniff",
		// Chrome's PDF viewer does not run inside a CSP sandbox.
		"Content-Security-Policy": type === "application/pdf" ? "default-src 'none'" : "default-src 'none'; sandbox",
		"Cache-Control": "private, max-age=3600",
	});
	return new Response(object.body, { headers });
});

export default app;
