#!/usr/bin/env node
/**
 * emailflare: local Email Routing setup + diagnostics
 *
 * Sets up Cloudflare Email Routing for a domain so inbound mail is delivered
 * to the inbox Worker's `email()` export. Runs entirely from your machine —
 * no Worker deploy or worker logs required. Prints the exact Cloudflare API
 * response for every step so you can see precisely where a token fails.
 *
 * Usage:
 *   node scripts/setup-email-routing.mjs
 *   node scripts/setup-email-routing.mjs --domain example.com
 *   node scripts/setup-email-routing.mjs --domain example.com --worker emailflare-inbox-worker
 *
 * Reads CF_API_TOKEN / CF_ACCOUNT_ID from:
 *   - scripts/config.toml  ([secrets].cf_api_token / cf_account_id), or
 *   - the environment (CF_API_TOKEN / CF_ACCOUNT_ID).
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { parse as parseToml } from "smol-toml";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CONFIG_FILE = resolve(__dirname, "config.toml");

// ─── parse CLI args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function flag(name, fallback = undefined) {
	const i = args.indexOf(`--${name}`);
	return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const CLI_DOMAIN = flag("domain");
const CLI_WORKER = flag("worker", "emailflare-inbox-worker");

// ─── load config.toml ────────────────────────────────────────────────────────

let cfg = {};
if (existsSync(CONFIG_FILE)) {
	try {
		cfg = parseToml(readFileSync(CONFIG_FILE, "utf8"));
	} catch (e) {
		console.error(`\x1b[31m✗ config.toml parse error: ${e.message}\x1b[0m`);
		process.exit(1);
	}
}

const secrets = cfg.secrets ?? {};
const CF_API_TOKEN = process.env.CF_API_TOKEN ?? secrets.cf_api_token ?? "";
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? secrets.cf_account_id ?? "";
const WORKER_NAME = CLI_WORKER || cfg.inbox?.inbox_worker_name || "emailflare-inbox-worker";

// ─── tiny logging helpers ────────────────────────────────────────────────────

const c = {
	cyan: (s) => `\x1b[36m${s}\x1b[0m`,
	green: (s) => `\x1b[32m${s}\x1b[0m`,
	red: (s) => `\x1b[31m${s}\x1b[0m`,
	yellow: (s) => `\x1b[33m${s}\x1b[0m`,
	dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

const CF_BASE = "https://api.cloudflare.com/client/v4";

// Raw CF API call. Returns { ok, status, body } and NEVER throws — so we can
// print the full body even on auth errors (which is where the truth lives).
async function cf(path, { method = "GET", body } = {}) {
	const res = await fetch(`${CF_BASE}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${CF_API_TOKEN}`,
			"Content-Type": "application/json",
			...(body ? {} : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});
	const text = await res.text();
	let json = null;
	try {
		json = JSON.parse(text);
	} catch {
		/* non-JSON */
	}
	return { ok: res.ok, status: res.status, json, text };
}

function printCf(label, result) {
	const j = result.json;
	if (j && typeof j === "object") {
		const success = j.success;
		const errors = j.errors?.map((e) => `${e.code ?? ""} ${e.message ?? ""}`.trim()).join("; ");
		const tag = success ? c.green("✓") : c.red("✗");
		console.log(`${tag} ${label}  [HTTP ${result.status}]`);
		if (!success) {
			console.log(`   ${c.red("Cloudflare errors:")} ${errors || "(none)"}`);
			if (j.messages?.length)
				console.log(`   ${c.dim("messages:")} ${j.messages.map((m) => m.message ?? m).join("; ")}`);
		}
		// Print result info (zones list, catch-all rule, etc.)
		if (j.result && typeof j.result === "object") {
			if (Array.isArray(j.result)) {
				console.log(
					`   ${c.dim("result:")} ${j.result.map((r) => r.name ?? r.id ?? JSON.stringify(r)).join(", ") || "(empty)"}`,
				);
			} else {
				console.log(`   ${c.dim("result:")} ${JSON.stringify(j.result)}`);
			}
		}
	} else {
		console.log(`${c.red("✗")} ${label}  [HTTP ${result.status}] ${c.dim(result.text.slice(0, 200))}`);
	}
}

// ─── step helpers ────────────────────────────────────────────────────────────

async function verifyToken() {
	console.log(`\n${c.cyan("▶ Step 1:")} Verify token`);
	const r = await cf("/user/tokens/verify");
	printCf("token verify", r);
	if (r.json?.success && r.json?.result?.status === "active") {
		console.log(`   ${c.green("✓")} token is ACTIVE (id ${r.json.result.id})`);
		return true;
	}
	if (r.json?.success && r.json?.result?.status !== "active") {
		console.log(`   ${c.red("✗")} token status is "${r.json?.result?.status}" — regenerate it.`);
	}
	return false;
}

async function verifyAccount() {
	console.log(`\n${c.cyan("▶ Step 2:")} Verify account access`);
	if (!CF_ACCOUNT_ID) {
		console.log(`   ${c.yellow("⚠")} No CF_ACCOUNT_ID — listing accounts the token can see:`);
		const r = await cf("/accounts");
		printCf("list accounts", r);
		if (r.json?.success && r.json?.result?.length) {
			console.log(
				`   ${c.green("✓")} Use one of these as cf_account_id: ${r.json.result.map((a) => `${a.name} (${a.id})`).join(", ")}`,
			);
		}
		return;
	}
	const r = await cf(`/accounts/${CF_ACCOUNT_ID}`);
	printCf(`account ${CF_ACCOUNT_ID}`, r);
	return r.json?.success === true;
}

async function findZone(domain) {
	console.log(`\n${c.cyan("▶ Step 3:")} Find zone for "${domain}"`);
	const r = await cf(`/zones?name=${encodeURIComponent(domain)}&status=active`);
	printCf(`zones?name=${domain}`, r);
	if (!r.json?.success) return null;
	const zones = r.json.result ?? [];
	if (zones.length === 0) {
		console.log(`   ${c.red("✗")} No active zone found for "${domain}". Is the domain on this account?`);
		return null;
	}
	const zone = zones[0];
	console.log(`   ${c.green("✓")} zone: ${zone.name} (${zone.id})`);

	// Print the token's *effective* permissions on this zone. Two things gate
	// the Email Routing endpoints and neither shows up as an obvious
	// "email routing" string in `zone.permissions`:
	//   • POST /email/routing/enable        → requires Zone Settings: Edit (#zone_settings:edit)
	//   • PUT  /email/routing/rules/catch_all → requires Email Routing Rules: Edit (account-level)
	const perms = zone.permissions ?? [];
	console.log(`   ${c.dim("effective zone permissions:")}`);
	if (perms.length === 0) {
		console.log(`      ${c.yellow("(none returned — token may be scoped to specific zones, or value is stale)")}`);
	} else {
		for (const p of perms) {
			console.log(`      ${c.dim("• " + p)}`);
		}
		const missing = [];
		if (!perms.includes("#zone_settings:edit")) missing.push("Zone Settings: Edit");
		console.log("");
		if (missing.length) {
			console.log(
				`   ${c.yellow("⚠")} Missing permission(s) likely needed for Email Routing: ${missing.join(", ")}`,
			);
			console.log(
				`      ${c.yellow("  → POST /email/routing/enable needs Zone Settings: Edit (#zone_settings:edit).")}`,
			);
			console.log(
				`      ${c.yellow("  → PUT /email/routing/rules/catch_all needs Email Routing Rules: Edit (account-level).")}`,
			);
			console.log(
				`      ${c.yellow("  → Add them to the token, then copy the NEW token value into scripts/config.toml (cf_api_token).")}`,
			);
		} else {
			console.log(`   ${c.green("✓")} Zone Settings: Edit is present — the enable step should succeed.`);
		}
	}
	return zone;
}

async function enableRouting(zoneId) {
	console.log(`\n${c.cyan("▶ Step 4:")} Enable Email Routing on zone ${zoneId}`);
	const r = await cf(`/zones/${zoneId}/email/routing/enable`, { method: "POST" });
	printCf("email/routing/enable", r);
	// Already enabled often returns 400/409 with a specific error — treat as OK.
	if (r.json?.success) return true;
	const code = r.json?.errors?.[0]?.code;
	if (code === 1024 || /already|enabled|exist/i.test(r.json?.errors?.[0]?.message ?? "")) {
		console.log(`   ${c.yellow("⚠")} Email Routing appears already enabled (${code}) — continuing.`);
		return true;
	}
	return false;
}

async function setCatchAll(zoneId, workerName) {
	console.log(`\n${c.cyan("▶ Step 5:")} Point catch-all at Worker "${workerName}"`);
	const r = await cf(`/zones/${zoneId}/email/routing/rules/catch_all`, {
		method: "PUT",
		body: {
			enabled: true,
			name: "EmailFlare inbox catch-all",
			matchers: [{ type: "all" }],
			actions: [{ type: "worker", value: [workerName] }],
		},
	});
	printCf("email/routing/rules/catch_all (PUT)", r);
	return r.json?.success === true;
}

async function showCatchAll(zoneId) {
	console.log(`\n${c.cyan("▶ Step 6:")} Confirm current catch-all rule`);
	const r = await cf(`/zones/${zoneId}/email/routing/rules/catch_all`);
	printCf("email/routing/rules/catch_all (GET)", r);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
	console.log(c.cyan("═".repeat(64)));
	console.log(c.cyan("  EmailFlare · Email Routing setup + diagnostics"));
	console.log(c.cyan("═".repeat(64)));

	if (!CF_API_TOKEN) {
		console.error(c.red("\n✗ No CF_API_TOKEN found."));
		console.error("  Set it in scripts/config.toml ([secrets].cf_api_token) or export CF_API_TOKEN.\n");
		process.exit(1);
	}

	console.log(
		`\n${c.dim("token:")}   ${CF_API_TOKEN.slice(0, 8)}…${CF_API_TOKEN.slice(-4)} (len ${CF_API_TOKEN.length})`,
	);
	console.log(`${c.dim("account:")}  ${CF_ACCOUNT_ID || "(not set — will list)"}`);
	console.log(`${c.dim("worker:")}   ${WORKER_NAME}`);

	// Verify token first — this is the single most useful diagnostic.
	const tokenOk = await verifyToken();
	await verifyAccount();

	const domain = CLI_DOMAIN || (await prompt("Domain to configure (e.g. example.com): "));
	if (!domain) {
		console.error(c.red("\n✗ No domain provided. Pass --domain example.com\n"));
		process.exit(1);
	}

	const zone = await findZone(domain);
	if (!zone) {
		console.error(c.red("\n✗ Zone lookup failed. See the Cloudflare error above."));
		console.error(c.dim("  Common causes: wrong account, token lacks Zone:Read, or domain not on this account.\n"));
		process.exit(1);
	}

	const enabled = await enableRouting(zone.id);
	if (!enabled) {
		console.error(c.red("\n✗ Could not enable Email Routing. See the Cloudflare error above."));
		console.error(c.dim("  Required permission: Zone → Zone Settings → Edit (#zone_settings:edit)\n"));
		process.exit(1);
	}

	const set = await setCatchAll(zone.id, WORKER_NAME);
	if (!set) {
		console.error(c.red("\n✗ Could not set the catch-all rule. See the Cloudflare error above."));
		console.error(c.dim("  Required permission: Account → Email Routing Rules → Edit\n"));
		process.exit(1);
	}

	await showCatchAll(zone.id);

	console.log(c.green("\n════════════════════════════════════════════════════════════"));
	console.log(c.green("  ✓ Email Routing is configured for " + domain));
	console.log(c.green("════════════════════════════════════════════════════════════"));
	console.log(c.dim("\n  Next: send a test email to any address @" + domain + "."));
	if (!tokenOk) {
		console.log(c.yellow("\n  ⚠ Note: token verification reported a problem above —"));
		console.log(c.yellow("    fix that first, then re-run this script."));
	}
}

// Tiny stdin prompt helper
function prompt(q) {
	return new Promise((resolvePromise) => {
		process.stdout.write(`${c.cyan("?")} ${q}`);
		process.stdin.once("data", (d) => resolvePromise(d.toString().trim()));
		process.stdin.resume();
	});
}

main().catch((err) => {
	console.error(c.red("\n✗ Unexpected error:"), err);
	process.exit(1);
});
