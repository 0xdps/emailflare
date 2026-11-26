import assert from "node:assert/strict";
import test from "node:test";
import { classifyBounce, extractReason, extractRecipient, isBounce, isComplaint } from "../lib/core/index.ts";

test("isBounce matches DSN senders and delivery-status reports", () => {
	assert.equal(isBounce({ subject: "hello", from: { address: "MAILER-DAEMON@example.com" } }), true);
	assert.equal(isBounce({ subject: "hello", from: { address: "postmaster@example.com" } }), true);
	assert.equal(
		isBounce({
			subject: "x",
			from: { address: "ops@example.com" },
			headers: [{ key: "Content-Type", value: "multipart/report; report-type=delivery-status" }],
		}),
		true,
	);
	assert.equal(isBounce({ subject: "hello", from: { address: "ada@example.com" } }), false);
});

test("isBounce leaves ordinary mail alone even when it sounds like a bounce", () => {
	assert.equal(
		isBounce({ subject: "Delivery notification: your parcel", from: { address: "ops@shop.example" } }),
		false,
	);
	assert.equal(isBounce({ subject: "Mail delivery failed", from: { address: "ops@example.com" } }), false);
	assert.equal(isBounce({ subject: "news", from: { address: "bounces@newsletter.example" } }), false);
	assert.equal(isBounce({ subject: "hi", from: { address: "no-reply-postmaster-fan@example.com" } }), false);
});

test("extractRecipient can be limited to structured DSN fields", () => {
	assert.equal(extractRecipient("Final-Recipient: rfc822; a@b.example", { structuredOnly: true }), "a@b.example");
	assert.equal(extractRecipient("could not deliver to <victim@b.example>", { structuredOnly: true }), null);
	assert.equal(extractRecipient("could not deliver to <victim@b.example>"), "victim@b.example");
});

test("isComplaint matches an ARF content type", () => {
	assert.equal(
		isComplaint({
			subject: "note",
			from: { address: "ada@example.com" },
			headers: [{ key: "Content-Type", value: "multipart/report; report-type=feedback-report" }],
		}),
		true,
	);
	assert.equal(isComplaint({ subject: "note", from: { address: "ada@example.com" }, headers: [] }), false);
});

test("extractRecipient prefers Final-Recipient and lowercases it", () => {
	const body = "Final-Recipient: rfc822; Ada@Example.com\nStatus: 5.1.1";
	assert.equal(extractRecipient(body), "ada@example.com");
	assert.equal(extractRecipient("nothing here"), null);
});

test("classifyBounce reads the Status field before phrases", () => {
	assert.equal(classifyBounce("Status: 5.1.1\nuser unknown"), "hard");
	assert.equal(classifyBounce("Status: 4.2.2"), "soft");
	assert.equal(classifyBounce("Status: 5.7.1"), "spam_rejection");
	assert.equal(classifyBounce("mailbox unavailable"), "hard");
	assert.equal(classifyBounce("please retry later"), "soft");
});

test("extractReason keeps the diagnostic line", () => {
	assert.equal(extractReason("Diagnostic-Code: smtp; 550 user unknown\nmore"), "550 user unknown");
	assert.equal(extractReason("no fields"), "Bounce notification received");
});
