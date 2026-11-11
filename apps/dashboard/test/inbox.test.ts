import assert from "node:assert/strict";
import test from "node:test";
import {
	buildReplyToAddress,
	extractPlainText,
	hashPassword,
	parseEmailAddress,
	parseThreadToken,
	stripThreadToken,
	threadMessageId,
	verifyPassword,
	resolveThreadId,
	type InboxDbHandle,
} from "../lib/core/index.ts";
import { replyReferences } from "../lib/threading.ts";

test("thread tokens round-trip through a Reply-To address", () => {
	const replyTo = buildReplyToAddress("hello@dps.codes", "abc_12");
	assert.equal(replyTo, "hello+ef_abc_12@dps.codes");
	assert.equal(parseThreadToken(replyTo), "abc_12");
	assert.equal(stripThreadToken(replyTo), "hello@dps.codes");
	assert.equal(parseThreadToken("hello@dps.codes"), null);
	assert.equal(threadMessageId("abc_12"), "<ef_abc_12@emailflare.inbox>");
});

test("parseEmailAddress splits a display name and lowercases the address", () => {
	assert.deepEqual(parseEmailAddress("Ada Lovelace <Ada@Example.com>"), {
		name: "Ada Lovelace",
		email: "ada@example.com",
	});
	assert.deepEqual(parseEmailAddress("Bob@Example.com"), { name: null, email: "bob@example.com" });
});

test("extractPlainText drops tags and decodes entities", () => {
	assert.equal(extractPlainText("<style>x</style><p>Hi&nbsp;Ada &amp; co</p>"), "Hi Ada & co");
});

test("verifyPassword accepts the hash it just created and rejects a wrong password", async () => {
	const stored = await hashPassword("correct horse");
	assert.match(stored, /^\$pbkdf2-sha256\$v=1\$/);
	assert.equal(await verifyPassword("correct horse", stored), true);
	assert.equal(await verifyPassword("wrong", stored), false);
	assert.equal(await verifyPassword("correct horse", "not-a-hash"), false);
});

test("resolveThreadId generates a new thread for a brand-new message", async () => {
	const mockDb: InboxDbHandle = {
		query: async () => ({ rows: [] }),
		run: async () => ({}),
	};

	let generatedCount = 0;
	const generateId = () => `thread_${++generatedCount}`;

	const threadId = await resolveThreadId(mockDb, null, {
		generateId,
		subject: "New Project Kickoff",
		personId: "person_1",
	});

	assert.equal(threadId, "thread_1");
});

test("resolveThreadId links a reply to an existing thread via In-Reply-To", async () => {
	const mockDb: InboxDbHandle = {
		query: async (sql, params) => {
			if (sql.includes("inbox_emails") && params?.includes("<msg123@domain.com>")) {
				return { rows: [{ thread_id: "thread_existing_abc" }] };
			}
			return { rows: [] };
		},
		run: async () => ({}),
	};

	const generateId = () => "thread_should_not_be_called";

	// Exact match
	const threadId1 = await resolveThreadId(mockDb, "<msg123@domain.com>", { generateId });
	assert.equal(threadId1, "thread_existing_abc");

	// Unbracketed match
	const threadId2 = await resolveThreadId(mockDb, "msg123@domain.com", { generateId });
	assert.equal(threadId2, "thread_existing_abc");
});

test("resolveThreadId links a reply to an existing thread via References header chain", async () => {
	const mockDb: InboxDbHandle = {
		query: async (sql, params) => {
			if (sql.includes("sent_inbox_emails") && params?.includes("<msg_initial@domain.com>")) {
				return { rows: [{ thread_id: "thread_sent_ref" }] };
			}
			return { rows: [] };
		},
		run: async () => ({}),
	};

	const generateId = () => "thread_new";

	const threadId = await resolveThreadId(mockDb, null, {
		generateId,
		references: "<root@domain.com> <msg_initial@domain.com>",
	});
	assert.equal(threadId, "thread_sent_ref");
});

test("resolveThreadId links replies via Re: subject fallback for same contact", async () => {
	const mockDb: InboxDbHandle = {
		query: async (sql, params) => {
			if (sql.includes("inbox_emails WHERE person_id = ?")) {
				return {
					rows: [{ thread_id: "thread_invoice_99", subject: "Invoice #1042 details" }],
				};
			}
			return { rows: [] };
		},
		run: async () => ({}),
	};

	const generateId = () => "thread_fresh";

	// Reply with Re: subject matches
	const matchedThread = await resolveThreadId(mockDb, null, {
		generateId,
		subject: "Re: Invoice #1042 details",
		personId: "person_client_1",
	});
	assert.equal(matchedThread, "thread_invoice_99");

	// Brand-new message with different subject creates new thread
	const newThread = await resolveThreadId(mockDb, null, {
		generateId,
		subject: "Separate query about contracts",
		personId: "person_client_1",
	});
	assert.equal(newThread, "thread_fresh");
});

test("replyReferences accumulates the message_id chain properly", () => {
	const parentItem: any = {
		message_id: "<msg2@domain.com>",
		references: "<msg1@domain.com>",
	};
	assert.equal(replyReferences(parentItem), "<msg1@domain.com> <msg2@domain.com>");

	const rootItem: any = {
		message_id: "<msg1@domain.com>",
		references: null,
	};
	assert.equal(replyReferences(rootItem), "<msg1@domain.com>");
});
