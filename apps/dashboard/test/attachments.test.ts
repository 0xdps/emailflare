import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import attachmentsRouter from "../worker/inbox/routes/inbox/attachments.ts";
import { htmlToText, messagePreview, stripQuotedReply, textToHtml } from "../lib/inbox/format.ts";
import type { HonoEnv } from "../worker/inbox/env.ts";

interface Row {
	filename: string;
	content_type: string;
	r2_key: string;
	inbox_address: string;
}

function buildApp(row: Row | null, opts: { member?: boolean; missingObject?: boolean; admin?: boolean } = {}) {
	const db = {
		prepare: (sql: string) => ({
			bind: () => ({
				first: async () => (sql.includes("inbox_members") ? (opts.member ? { 1: 1 } : null) : row),
			}),
		}),
	};
	const bucket = {
		get: async () => (opts.missingObject ? null : { size: 4, body: new Response("data").body, httpEtag: "x" }),
	};
	const app = new Hono<HonoEnv>();
	app.use(
		"/*",
		createMiddleware<HonoEnv>(async (c, next) => {
			c.set("userId", "u1");
			c.set("userType", opts.admin ? "admin" : "member");
			await next();
		}),
	);
	app.route("/", attachmentsRouter);
	return (path: string) => app.request(path, {}, { DB: db, ATTACHMENTS: bucket });
}

const pdf: Row = { filename: "Plan.pdf", content_type: "application/pdf", r2_key: "k", inbox_address: "a@x.test" };

test("safe types are shown inline, downloads can be forced", async () => {
	const get = buildApp(pdf, { admin: true });
	const inline = await get("/abc");
	assert.equal(inline.status, 200);
	assert.match(inline.headers.get("content-disposition")!, /^inline;/);
	assert.equal(inline.headers.get("x-content-type-options"), "nosniff");

	const download = await get("/abc?download=1");
	assert.match(download.headers.get("content-disposition")!, /^attachment;/);
});

test("scriptable types always download and run under a CSP sandbox", async () => {
	for (const type of ["text/html", "image/svg+xml", "application/xhtml+xml"]) {
		const res = await buildApp({ ...pdf, filename: "x", content_type: type }, { admin: true })("/abc");
		assert.match(res.headers.get("content-disposition")!, /^attachment;/, type);
		assert.match(res.headers.get("content-security-policy")!, /sandbox/, type);
	}
});

test("filenames cannot break out of the header", async () => {
	const res = await buildApp({ ...pdf, filename: 'a"\r\nSet-Cookie: x=1.pdf' }, { admin: true })("/abc");
	assert.equal(res.status, 200);
	assert.equal(res.headers.get("set-cookie"), null);
	assert.doesNotMatch(res.headers.get("content-disposition")!, /[\r\n]/);
});

test("members only reach attachments of mailboxes they belong to", async () => {
	assert.equal((await buildApp(pdf, { member: false })("/abc")).status, 404);
	assert.equal((await buildApp(pdf, { member: true })("/abc")).status, 200);
});

test("unknown attachments and missing R2 objects return 404", async () => {
	assert.equal((await buildApp(null, { admin: true })("/nope")).status, 404);
	assert.equal((await buildApp(pdf, { admin: true, missingObject: true })("/abc")).status, 404);
});

test("htmlToText and messagePreview give HTML-only mail a readable preview", () => {
	const html = "<style>p{color:red}</style><p>Hi&nbsp;there &amp; welcome</p><p>Second line</p>";
	assert.equal(htmlToText(html), "Hi there & welcome\nSecond line");
	assert.equal(messagePreview({ body_text: null, body_html: html }), "Hi there & welcome Second line");
	assert.equal(messagePreview({ body_text: "  ", body_html: html }), "Hi there & welcome Second line");
	assert.equal(messagePreview({ body_text: "Plain wins", body_html: html }), "Plain wins");
});

test("textToHtml escapes markup and links URLs without trailing punctuation", () => {
	assert.equal(
		textToHtml("<b>see</b> https://a.test/x?y=1."),
		'&lt;b&gt;see&lt;/b&gt; <a href="https://a.test/x?y=1" rel="noopener noreferrer">https://a.test/x?y=1</a>.',
	);
});

test("stripQuotedReply splits a reply from its history", () => {
	const { content, quote } = stripQuotedReply("Thanks!\n\nOn Mon, Ada wrote:\n> hi");
	assert.equal(content, "Thanks!");
	assert.match(quote!, /^On Mon/);
	assert.equal(stripQuotedReply("no quote").quote, null);
});
