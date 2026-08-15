import { env } from '../env.js';

const CF_BASE = 'https://api.cloudflare.com/client/v4';

interface CFResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

export class CloudflareApiError extends Error {
  code: number | null;
  path: string;
  status: number;

  constructor(message: string, opts: { code: number | null; path: string; status: number }) {
    super(message);
    this.name = 'CloudflareApiError';
    this.code = opts.code;
    this.path = opts.path;
    this.status = opts.status;
  }
}

async function cfFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CF_BASE}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const json = (await res.json()) as CFResponse<T>;

  if (!json.success) {
    const first = json.errors?.[0];
    const msg = first?.message ?? 'Cloudflare API error';
    throw new CloudflareApiError(`CF API error: ${msg}`, {
      code: first?.code ?? null,
      path,
      status: res.status,
    });
  }

  return json.result;
}

// ── Zones ────────────────────────────────────────────────────────────────────

export interface CFZone {
  id: string;
  name: string;
  status: string;
}

interface CFZoneListResponse {
  result: CFZone[];
  result_info: { total_pages: number; page: number };
}

/** Fetch every active zone on the account (handles pagination). */
export async function listAllZones(): Promise<CFZone[]> {
  const all: CFZone[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `${CF_BASE}/zones?status=active&per_page=50&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const json = (await res.json()) as CFResponse<CFZone[]> & { result_info: { total_pages: number; page: number } };
    if (!json.success) {
      const first = json.errors?.[0];
      const msg = first?.message ?? 'Cloudflare API error';
      throw new CloudflareApiError(`CF API error: ${msg}`, {
        code: first?.code ?? null,
        path: `/zones?page=${page}`,
        status: res.status,
      });
    }
    all.push(...json.result);
    if (json.result_info.page >= json.result_info.total_pages) break;
    page++;
  }
  return all;
}

/**
 * Find a Cloudflare zone for the given hostname.
 * Tries progressively shorter suffixes (e.g. mail.example.com → example.com).
 */
export async function getZoneByHostname(hostname: string): Promise<CFZone | null> {
  const parts = hostname.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.');
    try {
      const zones = await cfFetch<CFZone[]>(`/zones?name=${encodeURIComponent(candidate)}&status=active`);
      if (zones.length > 0) return zones[0];
    } catch {
      // continue
    }
  }
  return null;
}

// ── Sending Subdomains ────────────────────────────────────────────────────────

export interface CFSubdomain {
  tag: string;
  name: string;
  enabled: boolean;
  dkim_selector: string | null;
  return_path_domain: string | null;
  created: string | null;
  modified: string | null;
}

export async function createSendingSubdomain(zoneId: string, name: string): Promise<CFSubdomain> {
  return cfFetch<CFSubdomain>(`/zones/${zoneId}/email/sending/subdomains`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function getSendingSubdomain(zoneId: string, subdomainId: string): Promise<CFSubdomain> {
  return cfFetch<CFSubdomain>(`/zones/${zoneId}/email/sending/subdomains/${subdomainId}`);
}

export async function listSendingSubdomains(zoneId: string): Promise<CFSubdomain[]> {
  return cfFetch<CFSubdomain[]>(`/zones/${zoneId}/email/sending/subdomains`);
}

// ── DNS Records ────────────────────────────────────────────────────────────────

export interface CFDnsRecord {
  type: string;
  name: string;
  content: string;
  ttl: number | 1;
  priority?: number;
}

export async function getSubdomainDnsRecords(zoneId: string, subdomainId: string): Promise<CFDnsRecord[]> {
  return cfFetch<CFDnsRecord[]>(`/zones/${zoneId}/email/sending/subdomains/${subdomainId}/dns`);
}

// ── Email Sending ─────────────────────────────────────────────────────────────

export interface CFSendEmailParams {
  from: string | { address: string; name: string };
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export interface CFSendEmailResult {
  id: string;
}

export async function sendEmail(params: CFSendEmailParams): Promise<CFSendEmailResult> {
  // The Cloudflare Email Service REST API expects snake_case `reply_to`; our
  // params use camelCase `replyTo`. Map it (and omit when absent) — CF's schema
  // is strict and rejects unknown fields with invalid_request_schema.
  const { replyTo, ...rest } = params;
  const body = { ...rest, ...(replyTo ? { reply_to: replyTo } : {}) };
  return cfFetch<CFSendEmailResult>(`/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface CFTokenStatus {
  configured: boolean;
  active: boolean;
  tokenStatus: string | null;
  tokenId: string | null;
  notBefore: string | null;
  expiresOn: string | null;
  accountId: string | null;
  accountName: string | null;
  message: string;
}

interface CFTokenVerifyResult {
  id: string;
  status: string;
  not_before: string | null;
  expires_on: string | null;
}

interface CFAccountResult {
  id: string;
  name: string;
}

export async function getCloudflareTokenStatus(): Promise<CFTokenStatus> {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return {
      configured: false,
      active: false,
      tokenStatus: null,
      tokenId: null,
      notBefore: null,
      expiresOn: null,
      accountId: env.CF_ACCOUNT_ID || null,
      accountName: null,
      message: 'CF_API_TOKEN or CF_ACCOUNT_ID is not configured.',
    };
  }

  let verify: CFTokenVerifyResult;
  try {
    verify = await cfFetch<CFTokenVerifyResult>('/user/tokens/verify');
  } catch (error) {
    return {
      configured: true,
      active: false,
      tokenStatus: null,
      tokenId: null,
      notBefore: null,
      expiresOn: null,
      accountId: env.CF_ACCOUNT_ID,
      accountName: null,
      message: error instanceof Error ? error.message : 'Unable to verify Cloudflare API token.',
    };
  }

  let accountName: string | null = null;
  let message = verify.status === 'active'
    ? 'Cloudflare token is active.'
    : `Cloudflare token is not active (${verify.status}).`;

  try {
    const account = await cfFetch<CFAccountResult>(`/accounts/${env.CF_ACCOUNT_ID}`);
    accountName = account.name;
  } catch {
    message += ' Account lookup failed (check Account permissions or CF_ACCOUNT_ID).';
  }

  return {
    configured: true,
    active: verify.status === 'active',
    tokenStatus: verify.status,
    tokenId: verify.id,
    notBefore: verify.not_before,
    expiresOn: verify.expires_on,
    accountId: env.CF_ACCOUNT_ID,
    accountName,
    message,
  };
}

// ── Bounce Forwarder Worker ───────────────────────────────────────────────────
//
// A tiny ES-module Worker deployed to the user's CF account.
// CF Email Routing calls its `email` handler when a bounce/complaint arrives
// at the return-path address; it forwards the raw RFC 5322 message to the
// backend's webhook endpoint.

const BOUNCE_FORWARDER_SCRIPT = `
export default {
  async email(message, env) {
    const raw = await new Response(message.raw).arrayBuffer();
    const response = await fetch(env.BACKEND_URL + '/api/webhooks/bounce', {
      method: 'POST',
      headers: {
        'Content-Type': 'message/rfc822',
        'Authorization': 'Bearer ' + env.WEBHOOK_SECRET,
      },
      body: raw,
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('[bounce-forwarder] webhook failed:', response.status, text);
    }
  }
};
`.trim();

export interface BounceWorkerInfo {
  deployed: boolean;
  modifiedOn: string | null;
  workerName: string;
}

/** Check if the bounce forwarder Worker is deployed on this CF account. */
export async function getBounceWorkerInfo(workerName: string): Promise<BounceWorkerInfo> {
  try {
    const result = await cfFetch<{ id: string; modified_on: string }>(
      `/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${workerName}`,
    );
    return { deployed: true, modifiedOn: result.modified_on, workerName };
  } catch (err) {
    if (err instanceof CloudflareApiError && err.status === 404) {
      return { deployed: false, modifiedOn: null, workerName };
    }
    throw err;
  }
}

/**
 * Deploy (or redeploy) the bounce forwarder Worker.
 * Uses multipart/form-data as required by the CF Workers Upload API.
 */
export async function deployBounceForwarder(workerName: string): Promise<void> {
  const metadata = JSON.stringify({
    main_module: 'index.js',
    compatibility_date: '2025-01-01',
    bindings: [],
  });

  const boundary = 'EmailFlareBoundaryCF';
  const CRLF = '\r\n';
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="metadata"',
    'Content-Type: application/json',
    '',
    metadata,
    `--${boundary}`,
    'Content-Disposition: form-data; name="index.js"; filename="index.js"',
    'Content-Type: application/javascript+module',
    '',
    BOUNCE_FORWARDER_SCRIPT,
    `--${boundary}--`,
  ].join(CRLF);

  const res = await fetch(
    `${CF_BASE}/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${workerName}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    },
  );

  const json = (await res.json()) as CFResponse<unknown>;
  if (!json.success) {
    const first = json.errors?.[0];
    throw new CloudflareApiError(`CF API error: ${first?.message ?? 'deploy failed'}`, {
      code: first?.code ?? null,
      path: `/accounts/.../workers/scripts/${workerName}`,
      status: res.status,
    });
  }
}

/** Create or update a secret on a Worker script. */
export async function setWorkerSecret(
  workerName: string,
  name: string,
  value: string,
): Promise<void> {
  await cfFetch(
    `/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${workerName}/secrets`,
    {
      method: 'PUT',
      body: JSON.stringify({ name, text: value, type: 'secret_text' }),
    },
  );
}

// ── Email Routing ─────────────────────────────────────────────────────────────

export interface CFEmailRoutingCatchAll {
  enabled: boolean;
  tag: string | null;
  matchers: Array<{ type: string }>;
  actions: Array<{ type: string; value: string[] }>;
}

/** Enable Email Routing on a zone (idempotent — safe to call if already on). */
export async function enableEmailRouting(zoneId: string): Promise<void> {
  try {
    await cfFetch(`/zones/${zoneId}/email/routing/enable`, { method: 'POST' });
  } catch (err) {
    // Already enabled → CF returns 400 with code 10007; treat as success.
    if (err instanceof CloudflareApiError && (err.status === 400 || err.status === 409)) return;
    throw err;
  }
}

/** Read the current catch-all routing rule for a zone. */
export async function getCatchAllRule(zoneId: string): Promise<CFEmailRoutingCatchAll> {
  return cfFetch<CFEmailRoutingCatchAll>(`/zones/${zoneId}/email/routing/rules/catch_all`);
}

/**
 * Set the catch-all routing rule for a zone to forward all inbound mail to
 * the named Worker.  This is the mechanism used to receive CF bounce DSNs,
 * which arrive at the return-path subdomain and have a random local-part.
 */
export async function setCatchAllToWorker(zoneId: string, workerName: string): Promise<void> {
  await cfFetch(`/zones/${zoneId}/email/routing/rules/catch_all`, {
    method: 'PUT',
    body: JSON.stringify({
      enabled: true,
      name: 'Bounce forwarding (emailflare)',
      matchers: [{ type: 'all' }],
      actions: [{ type: 'worker', value: [workerName] }],
    }),
  });
}
