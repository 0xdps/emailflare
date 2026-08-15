// Cloudflare API service — shared between email-worker and inbox-worker.
// Credentials are passed per-call (no module-level globals) so this module
// is safe to use in both Workers and Node.js environments.

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
    this.code  = opts.code;
    this.path  = opts.path;
    this.status = opts.status;
  }
}

async function cfFetch<T>(
  path: string,
  cfApiToken: string,
  init?: RequestInit,
): Promise<T> {
  const res  = await fetch(`${CF_BASE}${path}`, {
    ...init,
    headers: {
      Authorization:  `Bearer ${cfApiToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const json = (await res.json()) as CFResponse<T>;

  if (!json.success) {
    const first = json.errors?.[0];
    const msg   = first?.message ?? 'Cloudflare API error';
    throw new CloudflareApiError(`CF API error: ${msg}`, {
      code:   first?.code ?? null,
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

/** Fetch every active zone on the account (handles pagination). */
export async function listAllZones(cfApiToken: string): Promise<CFZone[]> {
  const all: CFZone[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `${CF_BASE}/zones?status=active&per_page=50&page=${page}`,
      { headers: { Authorization: `Bearer ${cfApiToken}`, 'Content-Type': 'application/json' } },
    );
    const json = (await res.json()) as CFResponse<CFZone[]> & {
      result_info: { total_pages: number; page: number };
    };
    if (!json.success) {
      const first = json.errors?.[0];
      throw new CloudflareApiError(`CF API error: ${first?.message ?? 'error'}`, {
        code:   first?.code ?? null,
        path:   `/zones?page=${page}`,
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
export async function getZoneByHostname(
  hostname: string,
  cfApiToken: string,
): Promise<CFZone | null> {
  const parts = hostname.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.');
    try {
      const zones = await cfFetch<CFZone[]>(
        `/zones?name=${encodeURIComponent(candidate)}&status=active`,
        cfApiToken,
      );
      if (zones.length > 0) return zones[0];
    } catch {
      // try next suffix
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

export async function createSendingSubdomain(
  zoneId: string,
  name: string,
  cfApiToken: string,
): Promise<CFSubdomain> {
  return cfFetch<CFSubdomain>(
    `/zones/${zoneId}/email/sending/subdomains`,
    cfApiToken,
    { method: 'POST', body: JSON.stringify({ name }) },
  );
}

export async function getSendingSubdomain(
  zoneId: string,
  subdomainId: string,
  cfApiToken: string,
): Promise<CFSubdomain> {
  return cfFetch<CFSubdomain>(
    `/zones/${zoneId}/email/sending/subdomains/${subdomainId}`,
    cfApiToken,
  );
}

export async function listSendingSubdomains(
  zoneId: string,
  cfApiToken: string,
): Promise<CFSubdomain[]> {
  return cfFetch<CFSubdomain[]>(
    `/zones/${zoneId}/email/sending/subdomains`,
    cfApiToken,
  );
}

// ── DNS Records ───────────────────────────────────────────────────────────────

export interface CFDnsRecord {
  type: string;
  name: string;
  content: string;
  ttl: number | 1;
  priority?: number;
}

export async function getSubdomainDnsRecords(
  zoneId: string,
  subdomainId: string,
  cfApiToken: string,
): Promise<CFDnsRecord[]> {
  return cfFetch<CFDnsRecord[]>(
    `/zones/${zoneId}/email/sending/subdomains/${subdomainId}/dns`,
    cfApiToken,
  );
}

// ── Email Routing (inbound) ──────────────────────────────────────────────────

export interface CFEmailRoutingCatchAll {
  enabled: boolean;
  name: string | null;
  tag: string | null;
  matchers: Array<{ type: string }>;
  actions: Array<{ type: string; value: string[] }>;
}

/** Enable Email Routing on a zone (idempotent — safe to call if already on). */
export async function enableEmailRouting(zoneId: string, cfApiToken: string): Promise<void> {
  try {
    await cfFetch(`/zones/${zoneId}/email/routing/enable`, cfApiToken, { method: 'POST' });
  } catch (err) {
    // Already enabled → CF returns 4xx; treat as success.
    if (err instanceof CloudflareApiError && (err.status === 400 || err.status === 409)) return;
    throw err;
  }
}

/** Read the current catch-all routing rule for a zone. */
export async function getCatchAllRule(zoneId: string, cfApiToken: string): Promise<CFEmailRoutingCatchAll> {
  return cfFetch<CFEmailRoutingCatchAll>(`/zones/${zoneId}/email/routing/rules/catch_all`, cfApiToken);
}

/**
 * Set the catch-all routing rule for a zone to forward all inbound mail to the
 * named Worker. This is how the inbox receives email: Cloudflare delivers the
 * message to the Worker's `email()` export.
 */
export async function setCatchAllToWorker(zoneId: string, workerName: string, cfApiToken: string): Promise<void> {
  await cfFetch(`/zones/${zoneId}/email/routing/rules/catch_all`, cfApiToken, {
    method: 'PUT',
    body: JSON.stringify({
      enabled: true,
      name: 'EmailFlare inbox catch-all',
      matchers: [{ type: 'all' }],
      actions: [{ type: 'worker', value: [workerName] }],
    }),
  });
}

// ── Email Sending ─────────────────────────────────────────────────────────────

export interface CFSendEmailParams {
  from: string | { address: string; name: string };
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface CFSendEmailResult {
  id: string;
}

export async function sendEmail(
  params: CFSendEmailParams,
  cfApiToken: string,
  cfAccountId: string,
): Promise<CFSendEmailResult> {
  // The Cloudflare Email Service REST API expects snake_case `reply_to`; our
  // params use camelCase `replyTo`. Map it (and omit when absent) — CF's schema
  // is strict and rejects unknown fields with invalid_request_schema.
  const { replyTo, headers, ...rest } = params;
  const body = {
    ...rest,
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(headers && Object.keys(headers).length ? { headers } : {}),
  };
  return cfFetch<CFSendEmailResult>(
    `/accounts/${cfAccountId}/email/sending/send`,
    cfApiToken,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

// ── Token + Account Status ────────────────────────────────────────────────────

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

export async function getCloudflareTokenStatus(
  cfApiToken: string,
  cfAccountId: string,
): Promise<CFTokenStatus> {
  if (!cfApiToken || !cfAccountId) {
    return {
      configured: false,
      active: false,
      tokenStatus: null,
      tokenId: null,
      notBefore: null,
      expiresOn: null,
      accountId: cfAccountId || null,
      accountName: null,
      message: 'CF_API_TOKEN or CF_ACCOUNT_ID is not configured.',
    };
  }

  let verify: CFTokenVerifyResult;
  try {
    verify = await cfFetch<CFTokenVerifyResult>('/user/tokens/verify', cfApiToken);
  } catch (error) {
    return {
      configured: true,
      active: false,
      tokenStatus: null,
      tokenId: null,
      notBefore: null,
      expiresOn: null,
      accountId: cfAccountId,
      accountName: null,
      message: error instanceof Error ? error.message : 'Unable to verify Cloudflare API token.',
    };
  }

  let accountName: string | null = null;
  let message = verify.status === 'active'
    ? 'Cloudflare token is active.'
    : `Cloudflare token is not active (${verify.status}).`;

  try {
    const account = await cfFetch<CFAccountResult>(`/accounts/${cfAccountId}`, cfApiToken);
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
    accountId: cfAccountId,
    accountName,
    message,
  };
}
