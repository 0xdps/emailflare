import assert from "node:assert/strict";
import test from "node:test";
import { classifyBounce, extractReason, extractRecipient, isBounce, isComplaint } from "../src/index.ts";

test("isBounce matches mailer-daemon and delivery subjects", () => {
	assert.equal(isBounce({ subject: "Mail delivery failed", from: { address: "ops@example.com" } }), true);
	assert.equal(isBounce({ subject: "hello", from: { address: "MAILER-DAEMON@example.com" } }), true);
	assert.equal(isBounce({ subject: "hello", from: { address: "ada@example.com" } }), false);
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
