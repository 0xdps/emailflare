import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { generateId } from '@emailflare/email-core';
import { env } from '../env.js';
import { domains } from '../db.js';
import {
  getCloudflareTokenStatus,
  getBounceWorkerInfo,
  deployBounceForwarder,
  setWorkerSecret,
  enableEmailRouting,
  getCatchAllRule,
  setCatchAllToWorker,
  listAllZones,
  listSendingSubdomains,
} from '../services/cloudflare.js';

const app = new Hono();

// GET /api/cloudflare/status
app.get('/status', async (c) => {
  const status = await getCloudflareTokenStatus(env.CF_API_TOKEN, env.CF_ACCOUNT_ID);
  return c.json(status);
});

// ── Bounce forwarding ─────────────────────────────────────────────────────────

// GET /api/cloudflare/bounce-status
// Returns worker deployment state + per-domain routing rule status.
app.get('/bounce-status', async (c) => {
  const workerName = env.BOUNCE_WORKER_NAME;
  const [workerInfo, allDomains] = await Promise.all([
    getBounceWorkerInfo(workerName, env.CF_API_TOKEN, env.CF_ACCOUNT_ID),
    domains.find({ orderBy: [{ column: 'created_at', direction: 'desc' }] }),
  ]);

  const domainStatus = await Promise.all(
    allDomains.map(async (d) => {
      const base = { id: d.id, name: d.name, return_path_domain: d.return_path_domain };
      if (!d.cf_zone_id) return { ...base, routingEnabled: false, routingConfigured: false };
      try {
        const rule = await getCatchAllRule(d.cf_zone_id, env.CF_API_TOKEN);
        const routingConfigured =
          rule.enabled &&
          rule.actions.some(a => a.type === 'worker' && a.value.includes(workerName));
        return { ...base, routingEnabled: true, routingConfigured };
      } catch {
        return { ...base, routingEnabled: false, routingConfigured: false };
      }
    }),
  );

  return c.json({ ...workerInfo, publicUrl: env.PUBLIC_URL, domains: domainStatus });
});

// POST /api/cloudflare/bounce-setup
// One-click: deploy worker + set secrets + configure routing for all domains.
const setupSchema = z.object({
  backendUrl:    z.string().url(),
  webhookSecret: z.string().min(16),
  workerName:    z.string().min(1).optional(),
});

app.post('/bounce-setup', zValidator('json', setupSchema), async (c) => {
  const { backendUrl, webhookSecret, workerName: customName } = c.req.valid('json');
  const workerName = customName ?? env.BOUNCE_WORKER_NAME;

  // 1. Deploy / redeploy the Worker
  await deployBounceForwarder(workerName, env.CF_API_TOKEN, env.CF_ACCOUNT_ID);

  // 2. Set secrets on the Worker
  await Promise.all([
    setWorkerSecret(workerName, 'BACKEND_URL', backendUrl, env.CF_API_TOKEN, env.CF_ACCOUNT_ID),
    setWorkerSecret(workerName, 'WEBHOOK_SECRET', webhookSecret, env.CF_API_TOKEN, env.CF_ACCOUNT_ID),
  ]);

  // 3. Enable Email Routing + set catch-all for every domain
  const allDomains = await domains.find({});
  const results = await Promise.all(
    allDomains.map(async (d) => {
      if (!d.cf_zone_id) return { id: d.id, name: d.name, ok: false, error: 'No zone ID' };
      try {
        await enableEmailRouting(d.cf_zone_id, env.CF_API_TOKEN);
        await setCatchAllToWorker(d.cf_zone_id, workerName, env.CF_API_TOKEN, 'Bounce forwarding (emailflare)');
        return { id: d.id, name: d.name, ok: true };
      } catch (err) {
        return { id: d.id, name: d.name, ok: false, error: err instanceof Error ? err.message : 'Unknown' };
      }
    }),
  );

  return c.json({ ok: true, workerName, domains: results });
});

// POST /api/cloudflare/bounce-setup-domain/:domainId
// Lazily wire up a single domain that was added after the initial setup.
app.post('/bounce-setup-domain/:domainId', async (c) => {
  const domain = await domains.findOne({ where: { id: c.req.param('domainId') } });
  if (!domain) return c.json({ error: 'Domain not found' }, 404);
  if (!domain.cf_zone_id) return c.json({ error: 'Domain has no Cloudflare zone ID' }, 422);

  const workerName = env.BOUNCE_WORKER_NAME;
  const info = await getBounceWorkerInfo(workerName, env.CF_API_TOKEN, env.CF_ACCOUNT_ID);
  if (!info.deployed) {
    return c.json({ error: `Worker "${workerName}" is not yet deployed — run the full Bounce Setup first.` }, 422);
  }

  await enableEmailRouting(domain.cf_zone_id, env.CF_API_TOKEN);
  await setCatchAllToWorker(domain.cf_zone_id, workerName, env.CF_API_TOKEN, 'Bounce forwarding (emailflare)');
  return c.json({ ok: true, domain: domain.name });
});

// POST /api/cloudflare/backfill-domains
// Scans every active CF zone for Email Sending Subdomains and imports any that
// are not yet registered in emailflare. Email delivery history cannot be
// recovered because Cloudflare does not expose outbound email logs via API.
app.post('/backfill-domains', async (c) => {
  const zones = await listAllZones(env.CF_API_TOKEN);

  const results: Array<{ name: string; status: 'imported' | 'existing' | 'skipped'; error?: string }> = [];

  for (const zone of zones) {
    let subdomains;
    try {
      subdomains = await listSendingSubdomains(zone.id, env.CF_API_TOKEN);
    } catch {
      // Zone has no email sending configured — skip silently.
      continue;
    }

    for (const sub of subdomains) {
      const existing = await domains.findOne({ where: { name: sub.name } });
      if (existing) {
        results.push({ name: sub.name, status: 'existing' });
        continue;
      }

      await domains.insert({
        id:                 generateId(),
        name:               sub.name,
        cf_zone_id:         zone.id,
        cf_subdomain_id:    sub.tag,
        dkim_selector:      sub.dkim_selector ?? null,
        return_path_domain: sub.return_path_domain ?? null,
        verified:           sub.enabled ? 1 : 0,
        created_at:         new Date().toISOString(),
      });

      results.push({ name: sub.name, status: 'imported' });
    }
  }

  const imported = results.filter(r => r.status === 'imported').length;
  const existing = results.filter(r => r.status === 'existing').length;
  return c.json({ ok: true, imported, existing, domains: results });
});

export default app;

