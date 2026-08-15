#!/usr/bin/env node
/**
 * emailflare-inbox-worker: first-time Cloudflare setup & deploy
 *
 * What this does:
 *   1.  Checks wrangler is authenticated
 *   2.  Resolves the Cloudflare account ID
 *   3.  Creates D1 database (emailflare)
 *   4.  Creates KV namespace (emailflare-inbox-rate-limit)
 *   5.  Creates R2 bucket (emailflare-inbox-attachments)
 *   5b. Creates Queue (emailflare-inbox-sequences)
 *   6.  Generates wrangler.jsonc from the tracked wrangler.example.jsonc template
 *   7.  Applies D1 migrations (schema + inbox tables)
 *   8.  Prompts for secrets and sets them via `wrangler secret put`
 *   9.  Builds the inbox UI SPA (services/inbox-ui)
 *   10. Deploys the inbox Worker
 *
 * Usage:
 *   cp scripts/config.example.toml scripts/config.toml   # fill in your values
 *   just deploy-inbox
 *   # — or —
 *   node scripts/deploy-inbox.mjs
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseToml } from 'smol-toml';

const __dirname   = fileURLToPath(new URL('.', import.meta.url));
const ROOT        = resolve(__dirname, '..');
const INBOX_DIR   = resolve(ROOT, 'services/inbox-worker');
const DASH_DIR    = resolve(ROOT, 'services/inbox-ui');
const WRANGLER    = resolve(INBOX_DIR, 'wrangler.jsonc');
const WRANGLER_TEMPLATE = resolve(INBOX_DIR, 'wrangler.example.jsonc');
const CONFIG_FILE = resolve(__dirname, 'config.toml');

// ─── load config.toml (optional) ────────────────────────────────────────────

function loadConfig(path) {
  if (!existsSync(path)) return {};
  try {
    return parseToml(readFileSync(path, 'utf8'));
  } catch (e) {
    die(`config.toml parse error: ${e.message}`);
  }
}

const cfg = loadConfig(CONFIG_FILE);
const inboxCfg = cfg.inbox ?? {};
const secrets  = cfg.secrets ?? {};

if (existsSync(CONFIG_FILE)) {
  log('Loaded scripts/config.toml');
} else {
  process.stdout.write('\x1b[33mℹ No scripts/config.toml found — will prompt interactively.\x1b[0m\n');
  process.stdout.write('\x1b[33m  Copy scripts/config.example.toml → scripts/config.toml to skip prompts.\x1b[0m\n\n');
}

if (cfg.deploy?.cloudflare_api_token) {
  process.env.CLOUDFLARE_API_TOKEN = cfg.deploy.cloudflare_api_token;
}

// Inbox shares the same D1 database as the main worker
const DB_NAME = cfg.deploy?.database_name || 'emailflare';
const KV_NAME = 'emailflare-inbox-rate-limit';
const R2_NAME = 'emailflare-inbox-attachments';

// ─── helpers ─────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: opts.cwd ?? INBOX_DIR,
    encoding: 'utf8',
    stdio: opts.silent ? ['inherit', 'pipe', 'pipe'] : 'inherit',
  });
}

function capture(cmd, cwd = INBOX_DIR) {
  const result = spawnSync(cmd, {
    cwd,
    encoding: 'utf8',
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', code: result.status ?? 1 };
}

function log(msg)  { process.stdout.write(`\n\x1b[36m▶ ${msg}\x1b[0m\n`); }
function ok(msg)   { process.stdout.write(`\x1b[32m✓ ${msg}\x1b[0m\n`); }
function warn(msg) { process.stdout.write(`\x1b[33m⚠ ${msg}\x1b[0m\n`); }
function die(msg)  { process.stderr.write(`\x1b[31m✗ ${msg}\x1b[0m\n`); process.exit(1); }

async function prompt(label) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`  ${label}: `, answer => { rl.close(); resolve(answer.trim()); });
  });
}

async function promptSecret(label) {
  return new Promise(resolve => {
    process.stdout.write(`  ${label}: `);
    const rl = createInterface({ input: process.stdin, output: null, terminal: false });

    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    let value = '';
    function onData(chunk) {
      for (const c of chunk.toString()) {
        if (c === '\n' || c === '\r' || c === '\u0004') {
          if (process.stdin.isTTY) process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          resolve(value);
          return;
        } else if (c === '\u0003') { process.stdout.write('\n'); process.exit(1); }
        else if (c === '\u007F')   { if (value.length) { value = value.slice(0, -1); process.stdout.write('\b \b'); } }
        else                       { value += c; process.stdout.write('*'); }
      }
    }
    process.stdin.on('data', onData);
    process.stdin.resume();
  });
}

// ─── step 1: check wrangler auth ─────────────────────────────────────────────

log('Checking wrangler authentication…');
if (process.env.CLOUDFLARE_API_TOKEN) {
  ok('Using CLOUDFLARE_API_TOKEN from environment.');
} else {
  const check = capture('npx wrangler whoami 2>&1');
  if (check.stdout.includes('You are not authenticated')) {
    die('Not authenticated with Cloudflare.\n  Run: npx wrangler login\n  Or set CLOUDFLARE_API_TOKEN in scripts/config.toml');
  }
  ok('Authenticated with Cloudflare.');
}

// ─── step 2: resolve account ID ──────────────────────────────────────────────

log('Resolving Cloudflare account…');
let accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? (cfg.deploy?.account_id ?? '').trim();

if (!accountId) {
  const whoami = capture('npx wrangler whoami 2>&1');
  const matches = [...whoami.stdout.matchAll(/│\s*([^│]+?)\s*│\s*([0-9a-f]{32})\s*│/g)];
  if (matches.length === 0) die('Could not determine Cloudflare account ID from `wrangler whoami`.');
  if (matches.length === 1) {
    accountId = matches[0][2];
    ok(`Using account: ${matches[0][1]} (${accountId})`);
  } else {
    process.stdout.write('\nMultiple Cloudflare accounts found:\n');
    matches.forEach(([, name, id], i) => process.stdout.write(`  [${i + 1}] ${name}  (${id})\n`));
    const answer = await prompt(`Select account [1-${matches.length}]`);
    const idx = parseInt(answer, 10) - 1;
    if (idx < 0 || idx >= matches.length || isNaN(idx)) die('Invalid selection.');
    accountId = matches[idx][2];
    ok(`Using account: ${matches[idx][1]} (${accountId})`);
  }
}

process.env.CLOUDFLARE_ACCOUNT_ID = accountId;

// ─── step 3: create D1 database ──────────────────────────────────────────────

log(`Creating D1 database "${DB_NAME}" (skips if already exists)…`);
let d1Id;

const d1Create = spawnSync(`npx wrangler d1 create ${DB_NAME}`, {
  cwd: INBOX_DIR, encoding: 'utf8', shell: true,
  input: 'n\n', env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'],
});
const d1Out = (d1Create.stdout ?? '') + (d1Create.stderr ?? '');
const d1Match = d1Out.match(/database_id["']?\s*[:=]\s*["']([0-9a-f-]{36})["']/i);

if (d1Match) {
  d1Id = d1Match[1];
  ok(`D1 created: ${d1Id}`);
} else if (d1Out.includes('already exists')) {
  const d1List = capture('npx wrangler d1 list 2>&1');
  const row = new RegExp(`([0-9a-f-]{36})\\s*│\\s*${DB_NAME}`, 'i').exec(d1List.stdout)
           ?? new RegExp(`${DB_NAME}\\s*│\\s*([0-9a-f-]{36})`, 'i').exec(d1List.stdout);
  if (!row) die(`D1 "${DB_NAME}" exists but could not find its ID.\n${d1List.stdout}`);
  d1Id = row[1];
  warn(`D1 already exists, reusing: ${d1Id}`);
} else {
  die(`Unexpected wrangler d1 create output:\n${d1Out}`);
}

// ─── step 4: create KV namespace ─────────────────────────────────────────────

log(`Creating KV namespace "${KV_NAME}" (skips if already exists)…`);
let kvId;

const kvCreate = spawnSync(`npx wrangler kv namespace create "${KV_NAME}"`, {
  cwd: INBOX_DIR, encoding: 'utf8', shell: true,
  input: 'n\n', env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'],
});
const kvOut = (kvCreate.stdout ?? '') + (kvCreate.stderr ?? '');
const kvMatch = kvOut.match(/"id":\s*"([0-9a-f]{32})"/i) ?? kvOut.match(/\bid\s*=\s*["']([0-9a-f]{32})["']/i);

if (kvMatch) {
  kvId = kvMatch[1];
  ok(`KV created: ${kvId}`);
} else if (kvOut.includes('already exists')) {
  const kvList = capture('npx wrangler kv namespace list 2>&1');
  const jsonStr = kvList.stdout.match(/^(\[[\s\S]*\])/m)?.[1];
  if (!jsonStr) die(`Could not parse wrangler kv namespace list:\n${kvList.stdout}`);
  const ns = JSON.parse(jsonStr).find(n => n.title === KV_NAME || n.title === `emailflare_${KV_NAME}`);
  if (!ns) die(`KV "${KV_NAME}" exists but not found in list.`);
  kvId = ns.id;
  warn(`KV already exists, reusing: ${kvId}`);
} else {
  die(`Unexpected wrangler kv namespace create output:\n${kvOut}`);
}

// ─── step 5: create R2 bucket ────────────────────────────────────────────────

log(`Creating R2 bucket "${R2_NAME}" (skips if already exists)…`);
const r2Create = spawnSync(`npx wrangler r2 bucket create ${R2_NAME}`, {
  cwd: INBOX_DIR, encoding: 'utf8', shell: true,
  env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'],
});
const r2Out = (r2Create.stdout ?? '') + (r2Create.stderr ?? '');

if (r2Out.includes('Created bucket') || r2Create.status === 0) {
  ok(`R2 bucket "${R2_NAME}" created.`);
} else if (r2Out.toLowerCase().includes('already exists') || r2Out.includes('409')) {
  warn(`R2 bucket "${R2_NAME}" already exists — skipping.`);
} else {
  warn(`R2 bucket creation returned unexpected output (may still be OK):\n${r2Out.trim()}`);
}

// ─── step 5b: create Queue ───────────────────────────────────────────────────

const QUEUE_NAME = 'emailflare-inbox-sequences';
log(`Creating Queue "${QUEUE_NAME}" (skips if already exists)…`);

const qCreate = spawnSync(`npx wrangler queues create ${QUEUE_NAME}`, {
  cwd: INBOX_DIR, encoding: 'utf8', shell: true,
  env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'],
});
const qOut = (qCreate.stdout ?? '') + (qCreate.stderr ?? '');

if (qCreate.status === 0 || qOut.toLowerCase().includes('created queue')) {
  ok(`Queue "${QUEUE_NAME}" created.`);
} else if (qOut.toLowerCase().includes('already exists') || qOut.includes('409')) {
  warn(`Queue "${QUEUE_NAME}" already exists — skipping.`);
} else {
  // Queues errors are non-fatal — the Worker can still deploy if queue exists from a prior run
  warn(`Queue creation returned unexpected output:\n${qOut.trim()}`);
}

// ─── step 6: generate wrangler.jsonc from the tracked template ──────────────

log('Generating wrangler.jsonc from wrangler.example.jsonc…');
if (!existsSync(WRANGLER_TEMPLATE)) {
  die(`Missing template: ${WRANGLER_TEMPLATE}`);
}
const jsonc = readFileSync(WRANGLER_TEMPLATE, 'utf8')
  .replace(/REPLACE_WITH_D1_DATABASE_ID/g, d1Id)
  .replace(/REPLACE_WITH_KV_NAMESPACE_ID/g, kvId);

// Never write back to the tracked template — write the generated, gitignored file.
writeFileSync(WRANGLER, jsonc, 'utf8');
ok('wrangler.jsonc generated (gitignored).');

// ─── step 7: apply D1 migrations ─────────────────────────────────────────────

log('Applying D1 migrations…');
try {
  run(`npx wrangler d1 migrations apply ${DB_NAME} --remote`);
  ok('Migrations applied.');
} catch (err) {
  die(`Migration failed: ${err.message}`);
}

// ─── step 8: collect & set secrets ───────────────────────────────────────────

log('Setting Worker secrets…');
process.stdout.write(`
The following secrets are required. Press Enter to skip any already set.

  SESSION_SECRET     — 32+ char random string for JWT signing
                       Generate: openssl rand -hex 32
  CF_API_TOKEN       — Cloudflare API token
                       Permissions: Email Routing (Edit), Zone (Read), DNS (Edit)
  CF_ACCOUNT_ID      — Your Cloudflare account ID  (auto-filled below)
  VAPID_PUBLIC_KEY   — VAPID key for web push (public)
  VAPID_PRIVATE_KEY  — VAPID key for web push (private)
                       Generate: npx web-push generate-vapid-keys

`);

const SECRETS = [
  { name: 'SESSION_SECRET',    label: 'SESSION_SECRET',    cfgVal: secrets.session_secret },
  { name: 'CF_API_TOKEN',      label: 'CF_API_TOKEN',      cfgVal: secrets.cf_api_token },
  { name: 'CF_ACCOUNT_ID',     label: 'CF_ACCOUNT_ID',     cfgVal: secrets.cf_account_id || accountId },
  { name: 'VAPID_PUBLIC_KEY',  label: 'VAPID_PUBLIC_KEY',  cfgVal: inboxCfg.vapid_public_key },
  { name: 'VAPID_PRIVATE_KEY', label: 'VAPID_PRIVATE_KEY', cfgVal: inboxCfg.vapid_private_key, sensitive: true },
  { name: 'PUBLIC_URL',        label: 'PUBLIC_URL (worker URL for unsubscribe links)', cfgVal: inboxCfg.public_url },
  { name: 'INBOX_WORKER_NAME', label: 'INBOX_WORKER_NAME (Email Routing catch-all destination)', cfgVal: inboxCfg.inbox_worker_name || 'emailflare-inbox-worker' },
];

for (const { name, label, cfgVal, sensitive } of SECRETS) {
  const fromCfg = (cfgVal ?? '').trim();
  const value = fromCfg || (sensitive ? await promptSecret(label) : await prompt(label));

  if (!value.trim()) {
    warn(`${name} skipped — set it later with: echo "value" | npx wrangler secret put ${name}`);
    continue;
  }

  if (fromCfg) ok(`${name} read from config.toml.`);

  const result = spawnSync('npx', ['wrangler', 'secret', 'put', name], {
    cwd: INBOX_DIR,
    input: value + '\n',
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  if (result.status !== 0) {
    warn(`Failed to set ${name}. Set it manually:\n  cd services/inbox-worker && echo "value" | npx wrangler secret put ${name}`);
  } else {
    ok(`Secret ${name} set.`);
  }
}

// ─── step 9: build dashboard ──────────────────────────────────────────────────

log('Installing & building services/inbox-ui…');
try {
  run('pnpm install --frozen-lockfile', { cwd: DASH_DIR });
  run('pnpm build', { cwd: DASH_DIR });
  ok('Dashboard built.');
} catch (err) {
  die(`Dashboard build failed: ${err.message}`);
}

// ─── step 10: deploy ──────────────────────────────────────────────────────────

log('Deploying emailflare-inbox-worker…');
try {
  run('npx wrangler deploy');
  ok('Inbox Worker deployed!');
} catch (err) {
  die(`Deploy failed: ${err.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────

process.stdout.write(`
\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 emailflare-inbox-worker is live!

 Next steps:
   1. Open the dashboard → /setup to create your admin account
   2. Add inboxes and invite team members from the dashboard
   3. Point Cloudflare Email Routing rules at your Worker

 To redeploy after code changes:
   cd services/inbox-ui && pnpm build
   cd services/inbox-worker && npx wrangler deploy

 To update a secret:
   cd services/inbox-worker && echo "new-value" | npx wrangler secret put SECRET_NAME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m
`);
