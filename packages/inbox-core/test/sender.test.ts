import assert from "node:assert/strict";
import test from "node:test";
import { verifyInboxSender, type InboxDbHandle } from "../src/index.ts";

function createMockDb(
	inboxes: Array<{ id: string; email: string }>,
	members: Array<{ inbox_id: string; user_id: string }>,
): InboxDbHandle {
	return {
		query: async (sql: string, params: unknown[] = []) => {
			if (sql.includes("FROM inboxes WHERE LOWER(email) = ?")) {
				const email = (params[0] as string).toLowerCase().trim();
				const match = inboxes.find((ib) => ib.email.toLowerCase().trim() === email);
				return { rows: match ? [{ id: match.id }] : [] };
			}
			if (sql.includes("FROM inbox_members WHERE inbox_id = ? AND user_id = ?")) {
				const [inboxId, userId] = params as [string, string];
				const match = members.find((m) => m.inbox_id === inboxId && m.user_id === userId);
				return { rows: match ? [{ 1: 1 }] : [] };
			}
			throw new Error(`Unhandled mock query: ${sql}`);
		},
		run: async () => {},
	};
}

const mockInboxes = [
	{ id: "ib_support", email: "support@example.com" },
	{ id: "ib_sales", email: "sales@example.com" },
];

const mockMembers = [{ inbox_id: "ib_support", user_id: "user_member_1" }];

test("verifyInboxSender rejects unconfigured sender addresses with 400", async () => {
	const db = createMockDb(mockInboxes, mockMembers);
	const res = await verifyInboxSender(db, "ceo@poc.invalid", {
		id: "user_member_1",
		role: "member",
	});

	assert.equal(res.allowed, false);
	assert.equal(res.status, 400);
	assert.match(res.error ?? "", /not a configured inbox/);
});

test("verifyInboxSender rejects member role for configured inbox when not in inbox_members with 403", async () => {
	const db = createMockDb(mockInboxes, mockMembers);
	// user_member_1 is only a member of ib_support, not ib_sales
	const res = await verifyInboxSender(db, "sales@example.com", {
		id: "user_member_1",
		role: "member",
	});

	assert.equal(res.allowed, false);
	assert.equal(res.status, 403);
	assert.match(res.error ?? "", /Forbidden: You are not authorized to send from this inbox/);
});

test("verifyInboxSender allows member role for configured inbox when assigned in inbox_members", async () => {
	const db = createMockDb(mockInboxes, mockMembers);
	const res = await verifyInboxSender(db, "support@example.com", {
		id: "user_member_1",
		role: "member",
	});

	assert.equal(res.allowed, true);
	assert.equal(res.status, 200);
	assert.equal(res.inboxId, "ib_support");
});

test("verifyInboxSender allows admin to send from any configured inbox without inbox_members", async () => {
	const db = createMockDb(mockInboxes, mockMembers);
	const res = await verifyInboxSender(db, "sales@example.com", {
		id: "user_admin",
		role: "admin",
	});

	assert.equal(res.allowed, true);
	assert.equal(res.status, 200);
	assert.equal(res.inboxId, "ib_sales");
});

test("verifyInboxSender allows super-admin to send from any configured inbox without inbox_members", async () => {
	const db = createMockDb(mockInboxes, mockMembers);
	const res = await verifyInboxSender(db, "support@example.com", {
		id: "user_super",
		role: "super-admin",
	});

	assert.equal(res.allowed, true);
	assert.equal(res.status, 200);
	assert.equal(res.inboxId, "ib_support");
});

test("verifyInboxSender parses display names and handles case-insensitivity", async () => {
	const db = createMockDb(mockInboxes, mockMembers);
	const res = await verifyInboxSender(db, "Support Team <SUPPORT@EXAMPLE.COM>", {
		id: "user_member_1",
		role: "member",
	});

	assert.equal(res.allowed, true);
	assert.equal(res.status, 200);
	assert.equal(res.inboxId, "ib_support");
});
