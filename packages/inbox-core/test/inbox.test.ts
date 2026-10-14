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
} from "../src/index.ts";

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
