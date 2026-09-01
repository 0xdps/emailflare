#!/usr/bin/env node
/**
 * emailflare inbox-server standalone: first-time deploy helper
 *
 * What this does:
 *   1.  Prompts for / reads config values
 *   2.  Creates R2 bucket (emailflare-inbox-attachments) via Cloudflare API
 *   3.  Creates the inbox-bridge CF Worker (email forwarder)
 *   4.  Sets inbox-bridge secrets (INBOX_SERVER_URL, WEBHOOK_SECRET)
 *   5.  Builds services/inbox-server (tsc)
 *   6.  Builds services/inbox-ui (vite)
 *   7.  Prints Railway / Docker deployment instructions
 *
 * Usage:
 *   cp scripts/config.example.toml scripts/config.toml   # fill in your values
 *   just deploy-inbox-standalone
 *   # — or —
 *   node scripts/deploy-inbox-standalone.mjs
 */

import { execSync, spawnSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { parse as parseToml } from "smol-toml";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const BRIDGE_DIR = resolve(ROOT, "services/inbox-bridge");
const SERVER_DIR = resolve(ROOT, "services/inbox-server");
const DASH_DIR = resolve(ROOT, "services/inbox-ui");
const CONFIG_FILE = resolve(__dirname, "config.toml");

// ─── load config.toml (optional) ────────────────────────────────────────────

function loadConfig(path) {
	if (!existsSync(path)) return {};
	try {
		return parseToml(readFileSync(path, "utf8"));
	} catch (e) {
		die(`config.toml parse error: ${e.message}`);
	}
}

const cfg = loadConfig(CONFIG_FILE);
const serverCfg = cfg["inbox-server"] ?? {};
const secrets = cfg.secrets ?? {};

if (existsSync(CONFIG_FILE)) {
	log("Loaded scripts/config.toml");
} else {
	process.stdout.write("\x1b[33mℹ No scripts/config.toml found — will prompt interactively.\x1b[0m\n");
	process.stdout.write(
		"\x1b[33m  Copy scripts/config.example.toml → scripts/config.toml to skip prompts.\x1b[0m\n\n",
	);
}

if (cfg.deploy?.cloudflare_api_token) {
	process.env.CLOUDFLARE_API_TOKEN = cfg.deploy.cloudflare_api_token;
}

const R2_NAME = "emailflare-inbox-attachments";

// ─── helpers ─────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
	return execSync(cmd, {
		cwd: opts.cwd ?? ROOT,
		encoding: "utf8",
		stdio: opts.silent ? ["inherit", "pipe", "pipe"] : "inherit",
	});
}

function capture(cmd, cwd = ROOT) {
	const result = spawnSync(cmd, {
		cwd,
		encoding: "utf8",
		shell: true,
		stdio: ["inherit", "pipe", "pipe"],
	});
	return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", code: result.status ?? 1 };
}

function log(msg) {
	process.stdout.write(`\n\x1b[36m▶ ${msg}\x1b[0m\n`);
}
function ok(msg) {
	process.stdout.write(`\x1b[32m✓ ${msg}\x1b[0m\n`);
}
function warn(msg) {
	process.stdout.write(`\x1b[33m⚠ ${msg}\x1b[0m\n`);
}
function die(msg) {
	process.stderr.write(`\x1b[31m✗ ${msg}\x1b[0m\n`);
	process.exit(1);
}

async function prompt(label, defaultValue = "") {
	return new Promise((resolve) => {
		const rl = createInterface({ input: process.stdin, output: process.stdout });
		const suffix = defaultValue ? ` [${defaultValue}]` : "";
		rl.question(`  ${label}${suffix}: `, (answer) => {
			rl.close();
			resolve(answer.trim() || defaultValue);
		});
	});
}

async function promptSecret(label) {
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

// ─── step 1: check wrangler auth ─────────────────────────────────────────────
log("Step 1: Checking wrangler authentication…");
const whoami = capture("npx wrangler whoami", BRIDGE_DIR);
if (whoami.code !== 0 || !whoami.stdout.includes("@")) {
	die("Not authenticated with wrangler. Run: npx wrangler login");
}
const emailMatch = whoami.stdout.match(/\S+@\S+\.\S+/);
ok(`Authenticated as ${emailMatch ? emailMatch[0] : "unknown"}`);

// ─── step 2: resolve account ID ──────────────────────────────────────────────
log("Step 2: Resolving Cloudflare account ID…");
let cfAccountId = secrets.cf_account_id || serverCfg.cf_account_id || "";
if (!cfAccountId) {
	const accountsOut = capture("npx wrangler whoami --json", BRIDGE_DIR);
	try {
		const parsed = JSON.parse(accountsOut.stdout);
		cfAccountId = parsed.accounts?.[0]?.id ?? "";
	} catch {
		/* ignore */
	}
}
if (!cfAccountId) {
	cfAccountId = await prompt("Cloudflare Account ID");
	if (!cfAccountId) die("Account ID is required");
}
ok(`Account ID: ${cfAccountId}`);

// ─── step 3: collect secrets / config ────────────────────────────────────────
log("Step 3: Collecting configuration…");

const cfApiToken = secrets.cf_api_token || (await promptSecret("Cloudflare API token (Email Routing + Zone + DNS)"));
if (!cfApiToken) die("CF_API_TOKEN is required");

const webhookSecret =
	serverCfg.webhook_secret ||
	(await prompt("Webhook secret (WEBHOOK_SECRET — shared between bridge and server)", await randomHex(32)));

const inboxServerUrl =
	serverCfg.inbox_server_url || (await prompt("Inbox server URL (public base URL, e.g. https://inbox.example.com)"));
if (!inboxServerUrl) die("INBOX_SERVER_URL is required");

const r2AccessKeyId = serverCfg.r2_access_key_id || (await prompt("R2 Access Key ID"));
const r2SecretAccessKey = serverCfg.r2_secret_access_key || (await promptSecret("R2 Secret Access Key"));
const r2BucketName = serverCfg.r2_bucket_name || R2_NAME;
const r2AccountId = serverCfg.r2_account_id || cfAccountId;

const mesahubUrl =
	serverCfg.mesahub_url ||
	(await prompt("MesaHub URL (mh://local/inbox for embedded, or mh://apikey@host/inbox)", "mh://local/inbox"));

const redisUrl =
	serverCfg.redis_url || (await prompt("Redis URL (redis://localhost:6379 for local)", "redis://localhost:6379"));

const sessionSecret = secrets.session_secret || (await promptSecret("Session secret (SESSION_SECRET, 32+ chars)"));
if (!sessionSecret || sessionSecret.length < 32) die("SESSION_SECRET must be at least 32 characters");

ok("Configuration collected");

// ─── step 4: create R2 bucket ─────────────────────────────────────────────────
log(`Step 4: Creating R2 bucket "${r2BucketName}"…`);
const r2Check = capture(`npx wrangler r2 bucket list`, BRIDGE_DIR);
if (r2Check.stdout.includes(r2BucketName)) {
	ok(`R2 bucket "${r2BucketName}" already exists — skipping`);
} else {
	const r2Create = capture(`npx wrangler r2 bucket create ${r2BucketName}`, BRIDGE_DIR);
	if (r2Create.code !== 0) {
		warn(`Could not create R2 bucket automatically: ${r2Create.stderr.trim()}`);
		warn("Create it manually in the Cloudflare dashboard, then re-run.");
	} else {
		ok(`R2 bucket "${r2BucketName}" created`);
	}
}

// ─── step 5: deploy inbox-bridge ─────────────────────────────────────────────
log("Step 5: Deploying inbox-bridge CF Worker…");
try {
	run("pnpm install --frozen-lockfile", { cwd: BRIDGE_DIR });
	run("npx wrangler deploy", { cwd: BRIDGE_DIR });
	ok("inbox-bridge deployed");
} catch (e) {
	die(`Failed to deploy inbox-bridge: ${e.message}`);
}

// Set bridge secrets
log("Step 5b: Setting inbox-bridge secrets…");
function setSecret(name, value, cwd) {
	const result = spawnSync(`echo "${value}" | npx wrangler secret put ${name}`, {
		cwd,
		shell: true,
		stdio: "inherit",
		encoding: "utf8",
	});
	if (result.status !== 0) warn(`Could not set secret ${name} — set it manually`);
	else ok(`Secret ${name} set`);
}
setSecret("INBOX_SERVER_URL", inboxServerUrl, BRIDGE_DIR);
setSecret("WEBHOOK_SECRET", webhookSecret, BRIDGE_DIR);

// ─── step 6: build inbox-server ──────────────────────────────────────────────
log("Step 6: Building inbox-server (TypeScript)…");
try {
	run("pnpm install --frozen-lockfile", { cwd: SERVER_DIR });
	run("pnpm run build", { cwd: SERVER_DIR });
	ok("inbox-server built");
} catch (e) {
	die(`Failed to build inbox-server: ${e.message}`);
}

// ─── step 7: build dashboard ─────────────────────────────────────────────────
log("Step 7: Building dashboard SPA…");
try {
	run("pnpm install --frozen-lockfile", { cwd: DASH_DIR });
	run("pnpm run build", { cwd: DASH_DIR });
	ok("Inbox UI built → services/inbox-ui/dist/");
} catch (e) {
	die(`Failed to build dashboard: ${e.message}`);
}

// ─── step 8: print deployment instructions ───────────────────────────────────
log("Step 8: Deployment ready!");

process.stdout.write(`
\x1b[32m╔══════════════════════════════════════════════════════════════╗
║           EmailFlare Inbox Server — Deploy complete          ║
╚══════════════════════════════════════════════════════════════╝\x1b[0m

\x1b[36mDocker (compose.inbox.yaml):\x1b[0m
  docker compose -f compose.inbox.yaml up -d --build

\x1b[36mRequired environment variables on your server / Railway:\x1b[0m
  MESAHUB_URL=${mesahubUrl}
  REDIS_URL=${redisUrl}
  SESSION_SECRET=<your-secret>
  WEBHOOK_SECRET=${webhookSecret}
  CF_API_TOKEN=<your-token>
  CF_ACCOUNT_ID=${cfAccountId}
  R2_ACCOUNT_ID=${r2AccountId}
  R2_ACCESS_KEY_ID=${r2AccessKeyId}
  R2_SECRET_ACCESS_KEY=<your-key>
  R2_BUCKET_NAME=${r2BucketName}

\x1b[36mEmail routing:\x1b[0m
  Point your Cloudflare Email Routing to the inbox-bridge Worker.
  The bridge will POST inbound emails to:
    ${inboxServerUrl}/webhook/email

\x1b[36mNext steps:\x1b[0m
  1. Copy the env vars above to your server or Railway environment
  2. docker compose -f compose.inbox.yaml up -d  (or just deploy-inbox-standalone)
  3. Open https://your-domain/  — the setup wizard will guide you

`);

// ─── helpers ─────────────────────────────────────────────────────────────────
async function randomHex(bytes) {
	const arr = new Uint8Array(bytes);
	if (typeof crypto !== "undefined" && crypto.getRandomValues) {
		crypto.getRandomValues(arr);
	} else {
		const { randomFillSync } = await import("crypto");
		randomFillSync(arr);
	}
	return Array.from(arr)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
