#!/usr/bin/env node
/**
 * emailflare: first-time Cloudflare setup
 *
 * What this does:
 *   1. Checks wrangler is authenticated
 *   2. Creates D1 database (emailflare)
 *   3. Creates KV namespace (emailflare-api-rate-limit)
 *   4. Generates wrangler.jsonc from the tracked wrangler.example.jsonc template
 *   5. Applies D1 migrations (schema + system template seed)
 *   6. Prompts for secrets and sets them via `wrangler secret put`
 *   7. Builds admin panel
 *   8. Deploys the Worker + Admin
 *
 * Usage:
 *   cp scripts/config.example.toml scripts/config.toml   # fill in your values
 *   just setup
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseToml } from 'smol-toml';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT        = resolve(__dirname, '..');
const WORKER_DIR  = resolve(ROOT, 'services/email-worker');
const ADMIN_DIR   = resolve(ROOT, 'services/email-ui');
const WRANGLER_JSONC    = resolve(WORKER_DIR, 'wrangler.jsonc');
const WRANGLER_TEMPLATE = resolve(WORKER_DIR, 'wrangler.example.jsonc');
const CONFIG_FILE    = resolve(__dirname, 'config.toml');

// ─── load config.toml (if present) ──────────────────────────────────────────

function loadConfig(path) {
  if (!existsSync(path)) return {};
  try {
    return parseToml(readFileSync(path, 'utf8'));
  } catch (e) {
    die(`config.toml parse error: ${e.message}`);
  }
}

const cfg = loadConfig(CONFIG_FILE);
if (existsSync(CONFIG_FILE)) {
  process.stdout.write(`\x1b[36m▶ Loaded scripts/config.toml\x1b[0m\n`);
} else {
  process.stdout.write(`\x1b[33mℹ No scripts/config.toml found — will prompt for values interactively.\x1b[0m\n`);
  process.stdout.write(`\x1b[33m  Copy scripts/config.example.toml → scripts/config.toml to skip prompts.\x1b[0m\n\n`);
}

const DB_NAME = cfg.deploy?.database_name || process.env.EMAILFLARE_DB_NAME || 'emailflare';
const KV_NAME = 'emailflare-api-rate-limit';

// Inject deploy credentials so wrangler picks them up automatically
if (cfg.deploy?.cloudflare_api_token) {
  process.env.CLOUDFLARE_API_TOKEN = cfg.deploy.cloudflare_api_token;
}
if (cfg.deploy?.account_id ?? cfg.secrets?.cf_account_id) {
  process.env.CLOUDFLARE_ACCOUNT_ID = cfg.deploy?.account_id ?? cfg.secrets?.cf_account_id;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function run(cmd, options = {}) {
  return execSync(cmd, {
    cwd: options?.cwd ?? WORKER_DIR,
    encoding: 'utf8',
    stdio: options?.silent ? ['inherit', 'pipe', 'pipe'] : 'inherit',
  });
}

function capture(cmd) {
  const result = spawnSync(cmd, {
    cwd: WORKER_DIR,
    encoding: 'utf8',
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', code: result.status ?? 1 };
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

async function promptSecret(label) {
  return new Promise(resolve => {
    process.stdout.write(`  ${label}: `);
    const rl = createInterface({ input: process.stdin, output: null, terminal: false });

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    let value = '';

    function onData(chunk) {
      const chars = chunk.toString();
      for (const c of chars) {
        if (c === '\n' || c === '\r' || c === '\u0004') {
          if (process.stdin.isTTY) process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          resolve(value);
          return;
        } else if (c === '\u0003') {
          process.stdout.write('\n');
          process.exit(1);
        } else if (c === '\u007F') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          value += c;
          process.stdout.write('*');
        }
      }
    }

    process.stdin.on('data', onData);
    process.stdin.resume();
  });
}

// ─── step 1: check wrangler auth ────────────────────────────────────────────

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
const whoami = capture('npx wrangler whoami 2>&1');

// ─── step 1b: resolve account (handles multi-account setups) ────────────────

let accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';

if (!accountId) {
  // Parse table rows: │ Account Name │ Account ID │
  const accountMatches = [...whoami.stdout.matchAll(/│\s*([^│]+?)\s*│\s*([0-9a-f]{32})\s*│/g)];
  if (accountMatches.length === 0) {
    die('Could not determine Cloudflare account ID from `wrangler whoami`.');
  } else if (accountMatches.length === 1) {
    accountId = accountMatches[0][2];
    ok(`Using account: ${accountMatches[0][1]} (${accountId})`);
  } else {
    process.stdout.write('\nMultiple Cloudflare accounts found:\n');
    accountMatches.forEach(([, name, id], i) => {
      process.stdout.write(`  [${i + 1}] ${name}  (${id})\n`);
    });
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve =>
      rl.question(`\n  Select account [1-${accountMatches.length}]: `, resolve)
    );
    rl.close();
    const idx = parseInt(answer.trim(), 10) - 1;
    if (idx < 0 || idx >= accountMatches.length || isNaN(idx)) {
      die('Invalid selection.');
    }
    accountId = accountMatches[idx][2];
    ok(`Using account: ${accountMatches[idx][1]} (${accountId})`);
  }
}

// Inject into environment so all subsequent wrangler calls use this account.
// wrangler.jsonc intentionally omits `account_id` so the project is portable —
// wrangler picks up the account from CLOUDFLARE_ACCOUNT_ID, the OAuth session,
// or a scoped API token. See docs/CLOUDFLARE.md.
process.env.CLOUDFLARE_ACCOUNT_ID = accountId;

// ─── step 2: create D1 database ─────────────────────────────────────────────

log(`Creating D1 database "${DB_NAME}" (skips if already exists)…`);
let d1Id;

const d1Create = spawnSync(`npx wrangler d1 create ${DB_NAME}`, {
  cwd: WORKER_DIR,
  encoding: 'utf8',
  shell: true,
  input: 'n\n',
  env: { ...process.env },
  stdio: ['pipe', 'pipe', 'pipe'],
});
const d1Out = (d1Create.stdout ?? '') + (d1Create.stderr ?? '');

const d1IdMatch = d1Out.match(/database_id["']?\s*[:=]\s*["']([0-9a-f-]{36})["']/i);
if (d1IdMatch) {
  d1Id = d1IdMatch[1];
  ok(`D1 created: ${d1Id}`);
} else if (d1Out.includes('already exists')) {
  const d1List = capture(`npx wrangler d1 list 2>&1`);
  const listMatch = new RegExp(`([0-9a-f-]{36})\\s*│\\s*${DB_NAME}`, 'i').exec(d1List.stdout);
  if (!listMatch) die(`D1 database "${DB_NAME}" exists but could not read its ID.\nwrangler d1 list output:\n${d1List.stdout}`);
  d1Id = listMatch[1];
  warn(`D1 database already exists, reusing id: ${d1Id}`);
} else {
  die(`Unexpected wrangler d1 create output:\n${d1Out}`);
}

// ─── step 3: create KV namespace ────────────────────────────────────────────

log(`Creating KV namespace "${KV_NAME}" (skips if already exists)…`);
let kvId;

const kvCreate = spawnSync(`npx wrangler kv namespace create "${KV_NAME}"`, {
  cwd: WORKER_DIR,
  encoding: 'utf8',
  shell: true,
  input: 'n\n',
  env: { ...process.env },
  stdio: ['pipe', 'pipe', 'pipe'],
});
const kvOut = (kvCreate.stdout ?? '') + (kvCreate.stderr ?? '');

const kvIdMatch = kvOut.match(/"id":\s*"([0-9a-f]{32})"/i) ?? kvOut.match(/\bid\s*=\s*["']([0-9a-f]{32})["']/i);
if (kvIdMatch) {
  kvId = kvIdMatch[1];
  ok(`KV created: ${kvId}`);
} else if (kvOut.includes('already exists')) {
  const kvList = capture(`npx wrangler kv namespace list 2>&1`);
  const jsonMatch = kvList.stdout.match(/^(\[[\s\S]*\])/m);
  if (!jsonMatch) die(`Could not find JSON in wrangler kv namespace list output:\n${kvList.stdout}`);
  try {
    const namespaces = JSON.parse(jsonMatch[1]);
    const ns = namespaces.find(n => n.title === KV_NAME);
    if (!ns) die(`KV namespace "${KV_NAME}" exists but could not find it in list.`);
    kvId = ns.id;
  } catch (e) {
    die(`Could not parse wrangler kv namespace list JSON:\n${kvList.stdout}\n${e.message}`);
  }
  warn(`KV namespace already exists, reusing id: ${kvId}`);
} else {
  die(`Unexpected wrangler kv namespace create output:\n${kvOut}`);
}

// ─── step 4: generate wrangler.jsonc from the tracked template ───────────────

log('Generating wrangler.jsonc from wrangler.example.jsonc…');
if (!existsSync(WRANGLER_TEMPLATE)) {
  die(`Missing template: ${WRANGLER_TEMPLATE}`);
}
const template = readFileSync(WRANGLER_TEMPLATE, 'utf8');
const jsonc = template
  .replace(/REPLACE_WITH_D1_DATABASE_ID/g, d1Id)
  .replace(/REPLACE_WITH_KV_NAMESPACE_ID/g, kvId);

// Never write back to the tracked template — write the generated, gitignored file.
writeFileSync(WRANGLER_JSONC, jsonc, 'utf8');
ok('wrangler.jsonc generated (gitignored).');

// ─── step 5: apply D1 migrations ────────────────────────────────────────────

log('Applying D1 migrations (schema + seed data)…');
try {
  run(`npx wrangler d1 migrations apply ${DB_NAME} --remote`);
  ok('Migrations applied.');
} catch (err) {
  die(`Migration failed: ${err.message}`);
}

// ─── step 6: collect & set secrets ──────────────────────────────────────────

log('Setting Worker secrets…');
process.stdout.write(`
The following secrets are required. Press Enter to skip any that are already set.

  ADMIN_TOKEN      — Password for the admin dashboard
  SESSION_SECRET   — 32+ character random string (for JWT signing)
  CF_API_TOKEN     — Cloudflare API token with Email Routing + DNS permissions
  CF_ACCOUNT_ID    — Your Cloudflare account ID
  ADMIN_ORIGIN     — The Worker URL (admin UI is served from the same origin)
                     e.g. https://emailflare-api-worker.ACCOUNT.workers.dev
  PUBLIC_URL       — Public Worker URL used for unsubscribe links
                     (usually the same as ADMIN_ORIGIN)

`);

const rl = createInterface({ input: process.stdin, output: process.stdout });

const SECRETS = [
  { name: 'ADMIN_TOKEN',    label: 'ADMIN_TOKEN (admin password)',       cfgVal: cfg.secrets?.admin_token },
  { name: 'SESSION_SECRET', label: 'SESSION_SECRET (32+ random chars)',  cfgVal: cfg.secrets?.session_secret },
  { name: 'CF_API_TOKEN',   label: 'CF_API_TOKEN',                       cfgVal: cfg.secrets?.cf_api_token },
  { name: 'CF_ACCOUNT_ID',  label: 'CF_ACCOUNT_ID',                      cfgVal: cfg.secrets?.cf_account_id },
  { name: 'ADMIN_ORIGIN',   label: 'ADMIN_ORIGIN (worker URL, e.g. https://emailflare-api-worker.ACCOUNT.workers.dev)', cfgVal: cfg.secrets?.admin_origin },
  { name: 'PUBLIC_URL',     label: 'PUBLIC_URL (worker URL for unsubscribe links)', cfgVal: cfg.secrets?.public_url },
];

rl.close();

for (const { name, label, cfgVal } of SECRETS) {
  const value = (cfgVal ?? '').trim() || await promptSecret(label);
  if (!value.trim()) {
    warn(`${name} skipped (leaving blank).`);
    continue;
  }

  if ((cfgVal ?? '').trim()) ok(`${name} read from config.toml.`);

  const result = spawnSync('npx', ['wrangler', 'secret', 'put', name], {
    cwd: WORKER_DIR,
    input: value + '\n',
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  if (result.status !== 0) {
    warn(`Failed to set secret ${name}. Set it manually:\n  cd services/email-worker && echo "value" | npx wrangler secret put ${name}`);
  } else {
    ok(`Secret ${name} set.`);
  }
}

// ─── step 7: build admin ─────────────────────────────────────────────────────

log('Building email-ui panel…');
try {
  run('pnpm install --frozen-lockfile', { cwd: ADMIN_DIR });
  run('pnpm build', { cwd: ADMIN_DIR });
  ok('Email UI panel built.');
} catch (err) {
  die(`Email UI build failed: ${err.message}`);
}

// ─── step 8: deploy ──────────────────────────────────────────────────────────

log('Deploying Worker + Admin…');
try {
  run('npx wrangler deploy');
  ok('Worker deployed!');
} catch (err) {
  die(`Deploy failed: ${err.message}`);
}

process.stdout.write(`
\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 emailflare is live!

 Next steps:
   • Add a sending domain via the API or admin panel
   • Use POST /v1/send to send emails
   • Run  just worker-update  to deploy future changes

 To update secrets later:
   cd services/email-worker && echo "new-value" | npx wrangler secret put SECRET_NAME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m
`);
