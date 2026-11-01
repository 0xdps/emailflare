import assert from "node:assert/strict";
import test from "node:test";
import { keyCreateSchema } from "../src/index.ts";

test("keyCreateSchema defaults scope to 'domain' and type to 'live' to fail closed", () => {
	const parsed = keyCreateSchema.parse({ name: "my-key" });
	assert.equal(parsed.name, "my-key");
	assert.equal(parsed.type, "live");
	assert.equal(parsed.scope, "domain");
	assert.equal(parsed.domainIds, undefined);
});

test("keyCreateSchema accepts explicit global, multi, and domain scopes", () => {
	const globalKey = keyCreateSchema.parse({ name: "global-key", scope: "global" });
	assert.equal(globalKey.scope, "global");

	const domainKey = keyCreateSchema.parse({
		name: "domain-key",
		scope: "domain",
		domainIds: ["dom_123"],
	});
	assert.equal(domainKey.scope, "domain");
	assert.deepEqual(domainKey.domainIds, ["dom_123"]);

	const multiKey = keyCreateSchema.parse({
		name: "multi-key",
		scope: "multi",
		domainIds: ["dom_123", "dom_456"],
	});
	assert.equal(multiKey.scope, "multi");
});

test("keyCreateSchema rejects empty name or invalid scope", () => {
	assert.throws(() => keyCreateSchema.parse({ name: "" }));
	assert.throws(() => keyCreateSchema.parse({ name: "k", scope: "invalid" as any }));
});
