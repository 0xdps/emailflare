import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { domains, deleteDomainCascade } from '../db.js';
import { CloudflareApiError } from '../services/cloudflare.js';
import { createSendingSubdomain, listSendingSubdomains, getSubdomainDnsRecords, getSendingSubdomain, getZoneByHostname } from '../services/cloudflare.js';
import { getBounceWorkerInfo, enableEmailRouting, setCatchAllToWorker } from '../services/cloudflare.js';
import { env } from '../env.js';
import { domainCreateSchema, generateId } from '@emailflare/email-core';

const app = new Hono();

// GET /api/domains
app.get('/', async (c) => {
  const rows = await domains.find({ orderBy: [{ column: 'created_at', direction: 'desc' }] });
  return c.json(rows);
});

// GET /api/domains/:id
app.get('/:id', async (c) => {
  const domain = await domains.findOne({ where: { id: c.req.param('id') } });
  if (!domain) return c.json({ error: 'Domain not found' }, 404);
  return c.json(domain);
});

// POST /api/domains
app.post('/', zValidator('json', domainCreateSchema), async (c) => {
  const { name, cfZoneId } = c.req.valid('json');

  // Check if this subdomain is already in our DB
  const existing = await domains.findOne({ where: { name } });
  if (existing) return c.json({ error: `Domain "${name}" is already registered` }, 409);

  // Resolve zone: use provided ID or look it up from Cloudflare
  let zoneId = cfZoneId;
  if (!zoneId) {
    const zone = await getZoneByHostname(name, env.CF_API_TOKEN);
    if (!zone) {
      return c.json({ error: `No active Cloudflare zone found for "${name}". Make sure the root domain is added to your Cloudflare account.` }, 422);
    }
    zoneId = zone.id;
  }

  // Check CF first — reuse existing subdomain if found, otherwise create it.
  let cfResult;
  try {
    const allSubdomains = await listSendingSubdomains(zoneId, env.CF_API_TOKEN);
    cfResult = allSubdomains.find(s => s.name === name) ?? await createSendingSubdomain(zoneId, name, env.CF_API_TOKEN);
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      if (error.code === 10000 || error.code === 9109 || error.status === 401 || error.status === 403) {
        return c.json({
          error: 'Cloudflare token is missing permission for Email Sending Subdomains. Required: Account: Email Security Edit; Zone: Email Routing Rules Edit; Zone: Zone Read; Zone: DNS Read/Write.',
          cfCode: error.code,
          cfPath: error.path,
        }, 422);
      }
      return c.json({ error: error.message, cfCode: error.code, cfPath: error.path }, 502);
    }
    throw error;
  }

  const row = await domains.insert({
    id: generateId(),
    name,
    cf_zone_id: zoneId,
    cf_subdomain_id: cfResult.tag,
    dkim_selector: cfResult.dkim_selector ?? null,
    return_path_domain: cfResult.return_path_domain ?? null,
    verified: cfResult.enabled ? 1 : 0,
    created_at: new Date().toISOString(),
  });

  // Auto-configure bounce routing if the forwarder Worker is already deployed.
  // Runs fire-and-forget so it never blocks the response.
  if (zoneId) {
    getBounceWorkerInfo(env.BOUNCE_WORKER_NAME, env.CF_API_TOKEN, env.CF_ACCOUNT_ID).then(async (info) => {
      if (!info.deployed) return;
      await enableEmailRouting(zoneId, env.CF_API_TOKEN);
      await setCatchAllToWorker(zoneId, env.BOUNCE_WORKER_NAME, env.CF_API_TOKEN, 'Bounce forwarding (emailflare)');
    }).catch((err) => {
      console.warn(`[bounce] auto-setup failed for ${name}:`, err instanceof Error ? err.message : err);
    });
  }

  return c.json(row, 201);
});

// GET /api/domains/:id/dns — fetch DNS records from Cloudflare
app.get('/:id/dns', async (c) => {
  const domain = await domains.findOne({ where: { id: c.req.param('id') } });
  if (!domain) return c.json({ error: 'Domain not found' }, 404);
  if (!domain.cf_subdomain_id) return c.json({ error: 'Cloudflare subdomain not yet provisioned' }, 400);

  const records = await getSubdomainDnsRecords(domain.cf_zone_id, domain.cf_subdomain_id, env.CF_API_TOKEN);
  return c.json(records);
});

// POST /api/domains/:id/verify — re-check CF status and update
app.post('/:id/verify', async (c) => {
  const domain = await domains.findOne({ where: { id: c.req.param('id') } });
  if (!domain) return c.json({ error: 'Domain not found' }, 404);
  if (!domain.cf_subdomain_id) return c.json({ error: 'Cloudflare subdomain not provisioned' }, 400);

  const cfData = await getSendingSubdomain(domain.cf_zone_id, domain.cf_subdomain_id, env.CF_API_TOKEN);

  await domains.update({
    where: { id: domain.id },
    set: {
      verified: cfData.enabled ? 1 : 0,
      dkim_selector: cfData.dkim_selector ?? null,
      return_path_domain: cfData.return_path_domain ?? null,
    },
  });

  return c.json({ verified: cfData.enabled, domain: cfData });
});

// DELETE /api/domains/:id
app.delete('/:id', async (c) => {
  const domain = await domains.findOne({ where: { id: c.req.param('id') } });
  if (!domain) return c.json({ error: 'Domain not found' }, 404);

  await deleteDomainCascade(domain.id);
  return c.json({ deleted: true });
});

export default app;
