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
