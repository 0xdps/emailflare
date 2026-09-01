#!/usr/bin/env node
/**
 * emailflare · CF Workers bridge setup
 *
 * One-time setup for Docker/VPS users who need Cloudflare Email Routing to
 * deliver inbound emails to their self-hosted servers.
 *
 * Two thin Workers, deploy one or both:
 *
 *   email-bridge — receives bounces/complaints from CF Email Routing,
 *                  forwards raw RFC 5322 bytes to email-server's
 *                  POST /api/webhooks/bounce  (Bearer token auth)
 *
 *   inbox-bridge — receives inbound email from CF Email Routing,
 *                  HMAC-signs the payload and forwards to inbox-server's
 *                  POST /webhook/email
 *
 * Usage:
 *   just cf-workers-setup
 *   # — or —
 *   node scripts/setup-cf-workers.mjs
 */

import { execSync, spawnSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline";
import { randomBytes } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const EMAIL_BRIDGE_DIR = resolve(ROOT, "services/email-bridge");
const INBOX_BRIDGE_DIR = resolve(ROOT, "services/inbox-bridge");

// ─── helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
	process.stdout.write(`\n\x1b[36m▶ ${msg}\x1b[0m\n`);
}
function ok(msg) {
	process.stdout.write(`\x1b[32m✓ ${msg}\x1b[0m\n`);
}
function warn(msg) {
	process.stdout.write(`\x1b[33m⚠ ${msg}\x1b[0m\n`);
}
function info(msg) {
	process.stdout.write(`  ${msg}\n`);
}
function die(msg) {
	process.stderr.write(`\x1b[31m✗ ${msg}\x1b[0m\n`);
	process.exit(1);
}
function hr() {
	process.stdout.write("\x1b[90m" + "─".repeat(60) + "\x1b[0m\n");
}
function bold(msg) {
	return `\x1b[1m${msg}\x1b[0m`;
}

function capture(cmd, cwd) {
	const result = spawnSync(cmd, {
		cwd: cwd ?? ROOT,
		encoding: "utf8",
		shell: true,
		stdio: ["inherit", "pipe", "pipe"],
	});
	return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", code: result.status ?? 1 };
}

function run(cmd, cwd) {
	execSync(cmd, { cwd: cwd ?? ROOT, stdio: "inherit" });
}

function generateSecret() {
	return randomBytes(32).toString("hex");
}

async function prompt(label, defaultVal) {
	return new Promise((resolve) => {
		const rl = createInterface({ input: process.stdin, output: process.stdout });
		const suffix = defaultVal ? ` \x1b[90m[${defaultVal}]\x1b[0m` : "";
		rl.question(`  ${label}${suffix}: `, (answer) => {
			rl.close();
			resolve(answer.trim() || defaultVal || "");
		});
	});
}

async function promptSecret(label, prefilled) {
	if (prefilled) {
		ok(`${label}: (pre-filled)`);
		return prefilled;
	}
	return new Promise((resolve) => {
		process.stdout.write(`  ${label}: `);
		const rl = createInterface({ input: process.stdin, output: null, terminal: false });
		if (process.stdin.isTTY) process.stdin.setRawMode(true);
		let value = "";
		function onData(chunk) {
			for (const c of chunk.toString()) {
				if (c === "\n" || c === "\r" || c === "\u0004") {
					if (process.stdin.isTTY) process.stdin.setRawMode(false);
					process.stdin.removeListener("data", onData);
					rl.close();
					process.stdout.write("\n");
					resolve(value);
					return;
				} else if (c === "\u0003") {
					process.stdout.write("\n");
					process.exit(1);
				} else if (c === "\u007F") {
					if (value.length) {
						value = value.slice(0, -1);
						process.stdout.write("\b \b");
					}
				} else {
					value += c;
					process.stdout.write("*");
				}
			}
		}
		process.stdin.on("data", onData);
		process.stdin.resume();
	});
}

async function promptMenu(label, choices) {
	process.stdout.write(`\n  ${bold(label)}\n`);
	choices.forEach(([key, desc], i) => {
		process.stdout.write(`    [${i + 1}] ${key} — ${desc}\n`);
	});
	while (true) {
		const answer = await prompt(`Select [1-${choices.length}]`);
		const idx = parseInt(answer, 10) - 1;
		if (idx >= 0 && idx < choices.length) return choices[idx][0];
		warn(`Please enter a number between 1 and ${choices.length}`);
	}
}

async function setSecret(name, value, cwd) {
	const proc = spawnSync("npx wrangler secret put " + name, {
		cwd,
		encoding: "utf8",
		shell: true,
		input: value + "\n",
		env: { ...process.env },
		stdio: ["pipe", "inherit", "pipe"],
	});
	if (proc.status !== 0) {
		die(`Failed to set secret ${name}: ${proc.stderr}`);
	}
	ok(`Secret ${name} set`);
}

// ─── step 1: check wrangler auth ─────────────────────────────────────────────

log("Checking wrangler authentication…");
if (process.env.CLOUDFLARE_API_TOKEN) {
	ok("Using CLOUDFLARE_API_TOKEN from environment.");
} else {
	const check = capture("npx wrangler whoami 2>&1");
	if (check.stdout.includes("You are not authenticated") || check.stderr.includes("You are not authenticated")) {
		die(
			"Not authenticated with Cloudflare.\n  Run: npx wrangler login\n  Or set CLOUDFLARE_API_TOKEN in your environment.",
		);
	}
	ok("Authenticated with Cloudflare.");
}

// ─── step 2: resolve account ID ──────────────────────────────────────────────

log("Resolving Cloudflare account…");
let accountId = (process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();

if (!accountId) {
	const whoami = capture("npx wrangler whoami 2>&1");
	const matches = [...whoami.stdout.matchAll(/│\s*([^│]+?)\s*│\s*([0-9a-f]{32})\s*│/g)];
	if (matches.length === 0) die("Could not determine Cloudflare account ID from `wrangler whoami`.");
	if (matches.length === 1) {
		accountId = matches[0][2];
		ok(`Using account: ${matches[0][1]} (${accountId})`);
	} else {
		process.stdout.write("\nMultiple accounts found:\n");
		matches.forEach(([, name, id], i) => process.stdout.write(`  [${i + 1}] ${name}  (${id})\n`));
		const answer = await prompt(`Select account [1-${matches.length}]`);
		const idx = parseInt(answer, 10) - 1;
		if (idx < 0 || idx >= matches.length || isNaN(idx)) die("Invalid selection.");
		accountId = matches[idx][2];
		ok(`Using account: ${matches[idx][1]} (${accountId})`);
	}
}
process.env.CLOUDFLARE_ACCOUNT_ID = accountId;

// ─── step 3: choose which workers to deploy ───────────────────────────────────

hr();
process.stdout.write(`
  ${bold("emailflare · CF Workers Bridge Setup")}

  These thin Workers let Cloudflare Email Routing deliver inbound email
  to your self-hosted Docker/VPS servers.

  ${bold("email-bridge")}  bounces + complaints → email-server  (POST /api/webhooks/bounce)
  ${bold("inbox-bridge")}  inbound email        → inbox-server  (POST /webhook/email)

`);

const choice = await promptMenu("Which Workers do you want to deploy?", [
	["both", "email-bridge (bounces) + inbox-bridge (inbound email)"],
	["email-bridge", "email-bridge only — bounces/complaints to email-server"],
	["inbox-bridge", "inbox-bridge only — inbound email to inbox-server"],
]);

const deployEmailBridge = choice === "both" || choice === "email-bridge";
const deployInboxBridge = choice === "both" || choice === "inbox-bridge";

// ─── email-bridge config ──────────────────────────────────────────────────────

let emailBridgeUrl, emailBridgeSecret;

if (deployEmailBridge) {
	hr();
	log("email-bridge configuration");
	info("Receives bounces/complaints from CF Email Routing → forwards to email-server.");
	info("");

	emailBridgeUrl = await prompt("email-server base URL (e.g. https://api.example.com)");
	if (!emailBridgeUrl.startsWith("http")) die("URL must start with http:// or https://");

	const genSecret = generateSecret();
	process.stdout.write(`\n  WEBHOOK_SECRET — must match the WEBHOOK_SECRET in your email-server env.\n`);
	process.stdout.write(`  Leave blank to generate a new one (${genSecret.slice(0, 8)}…).\n`);
	const rawSecret = await promptSecret("WEBHOOK_SECRET (blank = generate)");
	emailBridgeSecret = rawSecret || genSecret;
	if (!rawSecret) {
		process.stdout.write(`\n  \x1b[33mGenerated WEBHOOK_SECRET: ${emailBridgeSecret}\x1b[0m\n`);
		process.stdout.write(`  \x1b[33mAdd this to your email-server environment:\x1b[0m\n`);
		process.stdout.write(`  \x1b[33m  WEBHOOK_SECRET=${emailBridgeSecret}\x1b[0m\n\n`);
	}
}

// ─── inbox-bridge config ──────────────────────────────────────────────────────

let inboxBridgeUrl, inboxBridgeSecret;

if (deployInboxBridge) {
	hr();
	log("inbox-bridge configuration");
	info("Receives inbound email from CF Email Routing → forwards to inbox-server.");
	info("");

	inboxBridgeUrl = await prompt("inbox-server base URL (e.g. https://inbox.example.com)");
	if (!inboxBridgeUrl.startsWith("http")) die("URL must start with http:// or https://");

	const genSecret = generateSecret();
	process.stdout.write(`\n  INBOX_WEBHOOK_SECRET — must match WEBHOOK_SECRET in your inbox-server env.\n`);
	process.stdout.write(`  Leave blank to generate a new one (${genSecret.slice(0, 8)}…).\n`);
	const rawSecret = await promptSecret("INBOX_WEBHOOK_SECRET (blank = generate)");
	inboxBridgeSecret = rawSecret || genSecret;
	if (!rawSecret) {
		process.stdout.write(`\n  \x1b[33mGenerated INBOX_WEBHOOK_SECRET: ${inboxBridgeSecret}\x1b[0m\n`);
		process.stdout.write(`  \x1b[33mAdd this to your inbox-server environment:\x1b[0m\n`);
		process.stdout.write(`  \x1b[33m  WEBHOOK_SECRET=${inboxBridgeSecret}\x1b[0m\n\n`);
	}
}

// ─── install deps ─────────────────────────────────────────────────────────────

if (deployEmailBridge) {
	log("Installing email-bridge dependencies…");
	run("npm install --prefer-offline", EMAIL_BRIDGE_DIR);
	ok("email-bridge deps installed");
}

if (deployInboxBridge) {
	log("Installing inbox-bridge dependencies…");
	run("npm install --prefer-offline", INBOX_BRIDGE_DIR);
	ok("inbox-bridge deps installed");
}

// ─── deploy email-bridge ──────────────────────────────────────────────────────

if (deployEmailBridge) {
	hr();
	log("Deploying email-bridge Worker…");
	run("npx wrangler deploy", EMAIL_BRIDGE_DIR);
	ok("email-bridge deployed");

	log("Setting email-bridge secrets…");
	await setSecret("EMAIL_SERVER_URL", emailBridgeUrl, EMAIL_BRIDGE_DIR);
	await setSecret("WEBHOOK_SECRET", emailBridgeSecret, EMAIL_BRIDGE_DIR);
	ok("email-bridge secrets set");
}

// ─── deploy inbox-bridge ──────────────────────────────────────────────────────

if (deployInboxBridge) {
	hr();
	log("Deploying inbox-bridge Worker…");
	run("npx wrangler deploy", INBOX_BRIDGE_DIR);
	ok("inbox-bridge deployed");

	log("Setting inbox-bridge secrets…");
	await setSecret("INBOX_SERVER_URL", inboxBridgeUrl, INBOX_BRIDGE_DIR);
	await setSecret("INBOX_WEBHOOK_SECRET", inboxBridgeSecret, INBOX_BRIDGE_DIR);
	ok("inbox-bridge secrets set");
}

// ─── print CF Email Routing instructions ─────────────────────────────────────

hr();
process.stdout.write(`
\x1b[32m✓ All Workers deployed!\x1b[0m

${bold("Next: configure Cloudflare Email Routing")}

  1. Go to ${bold("Cloudflare Dashboard")} → select your domain →
     ${bold("Email")} → ${bold("Email Routing")} → ${bold("Routes")}

`);

if (deployEmailBridge) {
	process.stdout.write(`  ${bold("For bounce/complaint handling")} (email-bridge):
     Add a routing rule for your return-path address:
       Match:   Specific address — e.g. bounces@mail.yourdomain.com
       Action:  Send to Worker  — emailflare-api-bridge

     Then set the return-path domain in your email-server:
       RETURN_PATH_DOMAIN=mail.yourdomain.com

`);
}

if (deployInboxBridge) {
	process.stdout.write(`  ${bold("For inbound email")} (inbox-bridge):
     Add a routing rule for your inbox catch-all or specific addresses:
       Match:   Catch-all  (or specific address — e.g. *@inbox.yourdomain.com)
       Action:  Send to Worker  — emailflare-inbox-bridge

`);
}

process.stdout.write(`  2. Enable Email Routing on the domain if not already active.
     ${bold("Email")} → ${bold("Email Routing")} → ${bold("Enable Email Routing")}

  3. For custom domains, add the MX and SPF records Cloudflare suggests.

  ${bold("Docs:")} https://developers.cloudflare.com/email-routing/

`);

if (deployEmailBridge && emailBridgeSecret) {
	process.stdout.write(`\x1b[33m  Reminder: add to email-server env if not already done:\x1b[0m
    WEBHOOK_SECRET=${emailBridgeSecret}

`);
}

if (deployInboxBridge && inboxBridgeSecret) {
	process.stdout.write(`\x1b[33m  Reminder: add to inbox-server env if not already done:\x1b[0m
    WEBHOOK_SECRET=${inboxBridgeSecret}

`);
}
