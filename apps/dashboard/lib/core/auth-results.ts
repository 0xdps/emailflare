/**
 * Reads the Authentication-Results header that the receiving MTA (Cloudflare) adds to inbound mail.
 *
 * Anyone can put an Authentication-Results header in a message they send, so only a header whose
 * authserv-id belongs to Cloudflare is believed. When none is found the verdicts are null, which
 * callers must treat as "unknown", never as a pass.
 */

export interface AuthVerdicts {
	authserv: string;
	spf: string | null;
	dkim: string | null;
	dmarc: string | null;
}

const TRUSTED_AUTHSERV = /(^|\.)cloudflare\.(net|com)$/i;

function stripComments(value: string): string {
	return value.replace(/\([^)]*\)/g, " ");
}

/** `values` are the Authentication-Results headers in message order, top-most (latest added) first. */
export function parseAuthenticationResults(values: string[]): AuthVerdicts | null {
	for (const raw of values) {
		const [serv, ...results] = stripComments(raw).split(";");
		const authserv = serv.trim().split(/\s+/)[0] ?? "";
		if (!TRUSTED_AUTHSERV.test(authserv)) continue;

		const verdicts: AuthVerdicts = { authserv, spf: null, dkim: null, dmarc: null };
		for (const part of results) {
			const match = part.trim().match(/^(spf|dkim|dmarc)\s*=\s*([a-z]+)/i);
			if (!match) continue;
			const method = match[1].toLowerCase() as "spf" | "dkim" | "dmarc";
			const result = match[2].toLowerCase();
			// A message can carry several DKIM signatures; one valid signature is enough.
			if (method === "dkim" && verdicts.dkim === "pass") continue;
			verdicts[method] = result;
		}
		return verdicts;
	}
	return null;
}

/** pass: a sender-domain-aligned check succeeded. fail: the header was readable and none did. unknown: no trusted header. */
export function senderAuthentication(verdicts: AuthVerdicts | null): "pass" | "fail" | "unknown" {
	if (!verdicts) return "unknown";
	return verdicts.dmarc === "pass" || verdicts.dkim === "pass" ? "pass" : "fail";
}
