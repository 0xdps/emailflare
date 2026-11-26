import assert from "node:assert/strict";
import test from "node:test";
import { parseAuthenticationResults, senderAuthentication } from "../lib/core/index.ts";

// ── Authentication-Results ────────────────────────────────────────────────────

test("only Cloudflare's Authentication-Results header is believed", () => {
	const forged = "mx.attacker.example; spf=pass; dkim=pass; dmarc=pass";
	assert.equal(parseAuthenticationResults([forged]), null);

	const real =
		"mx.cloudflare.net; dkim=pass header.d=sender.example (ok); spf=fail smtp.mailfrom=x; dmarc=pass action=none";
	assert.deepEqual(parseAuthenticationResults([real, forged]), {
		authserv: "mx.cloudflare.net",
		spf: "fail",
		dkim: "pass",
		dmarc: "pass",
	});
	assert.equal(parseAuthenticationResults([forged, real])?.authserv, "mx.cloudflare.net");
});

test("senderAuthentication separates pass, fail and unknown", () => {
	assert.equal(senderAuthentication(null), "unknown");
	assert.equal(
		senderAuthentication({ authserv: "mx.cloudflare.net", spf: "pass", dkim: "none", dmarc: "fail" }),
		"fail",
	);
	assert.equal(senderAuthentication({ authserv: "mx.cloudflare.net", spf: null, dkim: "pass", dmarc: null }), "pass");
});
