import assert from "node:assert/strict";
import test from "node:test";
import {
	applyVariables,
	executeSend,
	listUnsubscribeHeaders,
	type EmailLogRow,
	type ExecuteSendDeps,
	type SendApiKeyContext,
	type SendWithLogMessage,
} from "../src/index.ts";

interface Memory {
	domains: Array<{ id: string; name: string }>;
	suppressions: Array<{ email: string; reason: string }>;
	tokens: Array<{ token: string; email: string; listId: string | null }>;
	logs: EmailLogRow[];
	delivered: SendWithLogMessage[];
	keyUpdates: unknown[][];
}

function memory(seed?: Partial<Memory>): { mem: Memory; deps: ExecuteSendDeps } {
	const mem: Memory = {
		domains: seed?.domains ?? [],
		suppressions: seed?.suppressions ?? [],
		tokens: [],
		logs: [],
		delivered: [],
		keyUpdates: [],
	};
	const deps: ExecuteSendDeps = {
		db: {
			async query(sql, params = []) {
				if (sql.includes("FROM domains")) {
					const exact = String(params[0]);
					const like = String(params[1] ?? "");
					const suffix = like.startsWith("%.") ? like.slice(1) : "";
					const row = mem.domains.find((d) => d.name === exact || (suffix && d.name.endsWith(suffix)));
					return { rows: row ? [row] : [] };
				}
				if (sql.includes("FROM suppressions")) {
					const email = String(params[0]);
					const row = mem.suppressions.find((s) => s.email === email);
					return { rows: row ? [row] : [] };
				}
				return { rows: [] };
			},
			async run(sql, params = []) {
				if (sql.includes("unsubscribe_tokens")) {
					mem.tokens.push({
						token: String(params[0]),
						email: String(params[1]),
						listId: (params[2] as string | null) ?? null,
					});
				}
				if (sql.includes("UPDATE api_keys")) mem.keyUpdates.push(params);
			},
		},
		findTemplate: async () => null,
		renderLayout: async (layout, vars) => `<layout:${layout}:${JSON.stringify(vars)}>`,
		findIdempotentLog: async () => null,
		deliver: async (msg) => {
			mem.delivered.push(msg);
			return { id: "cf_1" };
		},
		insertLog: async (row) => {
			mem.logs.push(row);
		},
		now: () => "2026-01-01T00:00:00.000Z",
		generateToken: () => "tok_1",
	};
	return { mem, deps };
}

const liveKey: SendApiKeyContext = {
	keyId: "key_1",
	scope: "global",
	allowedDomainIds: [],
	isTest: false,
};

test("applyVariables substitutes nested keys and walks #if", () => {
	assert.equal(applyVariables("Hi {{name}}", { name: "Ada" }), "Hi Ada");
	assert.equal(applyVariables("Hi {{name}}", {}), "Hi ");
	assert.equal(applyVariables("Hi {{user.name}}", { user: { name: "Ada" } }), "Hi Ada");
	assert.equal(applyVariables("{{#if show}}yes{{else}}no{{/if}}", { show: true }), "yes");
	assert.equal(applyVariables("{{#if show}}yes{{else}}no{{/if}}", { show: false }), "no");
});

test("listUnsubscribeHeaders builds an RFC 8058 pair", () => {
	const headers = listUnsubscribeHeaders("https://app.example.com/", "tok", true);
	assert.equal(headers["List-Unsubscribe"], "<https://app.example.com/v1/unsubscribe?token=tok>");
	assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

test("executeSend returns a cached result and does not deliver", async () => {
	const { mem, deps } = memory();
	deps.findIdempotentLog = async () => ({ to_address: "ada@example.com", cf_message_id: "cf_old" });
	const result = await executeSend(deps, {
		body: { from: "from@example.com", to: "ada@example.com", subject: "Hi", text: "hello" },
		apiKey: liveKey,
		idempotencyKey: "idem_1",
		publicOrigin: "https://app.example.com",
	});
	assert.equal(result.status, 200);
	assert.deepEqual(result.body, { cached: true, results: [{ to: "ada@example.com", cfId: "cf_old" }] });
	assert.equal(mem.delivered.length, 0);
});

test("executeSend 404s when the template is missing", async () => {
	const { deps } = memory();
	const result = await executeSend(deps, {
		body: { from: "from@example.com", to: "ada@example.com", templateSlug: "missing" },
		apiKey: liveKey,
		idempotencyKey: null,
		publicOrigin: "",
	});
	assert.deepEqual(result, { status: 404, body: { error: "Template not found" } });
});

test("executeSend 403s a domain-scoped key for an unknown sender domain", async () => {
	const { deps } = memory();
	const result = await executeSend(deps, {
		body: { from: "from@unknown.com", to: "ada@example.com", subject: "Hi", text: "hello" },
		apiKey: { ...liveKey, scope: "domain", allowedDomainIds: ["dom_1"] },
		idempotencyKey: null,
		publicOrigin: "",
	});
	assert.equal(result.status, 403);
});

test("executeSend skips a suppressed address and still sends the other", async () => {
	const { mem, deps } = memory({ suppressions: [{ email: "ada@example.com", reason: "hard_bounce" }] });
	const result = await executeSend(deps, {
		body: {
			from: "from@example.com",
			to: ["Ada@example.com", "grace@example.com", "grace@example.com"],
			subject: "Hi",
			text: "hello",
		},
		apiKey: liveKey,
		idempotencyKey: null,
		publicOrigin: "",
	});
	assert.equal(result.status, 200);
	if (!("results" in result.body) || "cached" in result.body) assert.fail("expected send results");
	assert.deepEqual(result.body.results, [
		{ to: "Ada@example.com", error: "Suppressed: hard_bounce" },
		{ to: "grace@example.com", cfId: "cf_1" },
	]);
	assert.equal(mem.delivered.length, 1);
	assert.deepEqual(mem.keyUpdates, [["2026-01-01T00:00:00.000Z", 1, "key_1"]]);
});

test("executeSend issues a lowercase unsubscribe token and returns 502 when delivery throws", async () => {
	const { mem, deps } = memory();
	deps.deliver = async () => {
		throw new Error("cf down");
	};
	const result = await executeSend(deps, {
		body: {
			from: "from@example.com",
			to: "Ada@example.com",
			subject: "Hi",
			text: "hello",
			listId: "list_1",
		},
		apiKey: { ...liveKey, isTest: true },
		idempotencyKey: "idem_2",
		publicOrigin: "https://app.example.com/",
	});
	assert.equal(result.status, 502);
	assert.deepEqual(mem.tokens, [{ token: "tok_1", email: "ada@example.com", listId: "list_1" }]);
	assert.equal(mem.logs.length, 1);
	assert.equal(mem.logs[0].status, "failed");
	assert.equal(mem.logs[0].is_test, 1);
	assert.equal(mem.logs[0].text_body, "hello");
	assert.equal(mem.logs[0].idempotency_key, null);
	assert.equal(mem.keyUpdates.length, 0);
});

test("executeSend renders a layout and resolves the sender domain", async () => {
	const { mem, deps } = memory({ domains: [{ id: "dom_9", name: "mail.example.com" }] });
	deps.findTemplate = async () => ({
		id: "tpl_1",
		subject: "Hello {{name}}",
		html_body: "",
		text_body: null,
		layout: "welcome",
		domain_id: null,
	});
	const result = await executeSend(deps, {
		body: {
			from: "news@mail.example.com",
			fromName: "News",
			to: "ada@example.com",
			templateId: "tpl_1",
			variables: { name: "Ada" },
		},
		apiKey: { ...liveKey, scope: "domain", allowedDomainIds: ["dom_9"] },
		idempotencyKey: null,
		publicOrigin: "",
	});
	assert.equal(result.status, 200);
	assert.equal(mem.delivered[0].subject, "Hello Ada");
	assert.equal(mem.delivered[0].html, `<layout:welcome:{"name":"Ada"}>`);
	assert.deepEqual(mem.delivered[0].from, { address: "news@mail.example.com", name: "News" });
	assert.equal(mem.logs[0].domain_id, "dom_9");
	assert.equal(mem.logs[0].template_id, "tpl_1");
});
