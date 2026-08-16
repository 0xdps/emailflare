import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { makeDb } from '../db.ts';
import type { TemplateRow } from '../db.ts';
import { renderLayout, LAYOUTS, THEMES } from '../emails.ts';
import type { LayoutName } from '../emails.ts';
import type { HonoEnv } from '../env.ts';
import { templateSchema, toSlug, enrich, generateId, shortId } from '@emailflare/email-core';

const app = new Hono<HonoEnv>();

// GET /api/templates
app.get('/', async (c) => {
  const { templates } = makeDb(c.env.DB);
  const domainId = c.req.query('domainId');
  const rows = await templates.find({
    where: domainId ? { domain_id: domainId } : undefined,
    orderBy: [
      { column: 'is_system', direction: 'desc' },
      { column: 'updated_at', direction: 'desc' },
    ],
  });
  return c.json(rows.map(r => enrich(r, LAYOUTS)));
});

// GET /api/templates/themes
app.get('/themes', (c) => {
  const list = Object.entries(THEMES).map(([id, t]) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    primaryColor: t.primary,
  }));
  return c.json(list);
});

// GET /api/templates/:idOrSlug
app.get('/:idOrSlug', async (c) => {
  const { templates } = makeDb(c.env.DB);
  const key = c.req.param('idOrSlug');
  const row = (await templates.findOne({ where: { id: key } }))
    ?? (await templates.findOne({ where: { slug: key } }));
  if (!row) return c.json({ error: 'Template not found' }, 404);
  return c.json(enrich(row, LAYOUTS));
});

// POST /api/templates
app.post('/', zValidator('json', templateSchema), async (c) => {
  const { templates } = makeDb(c.env.DB);
  const body = c.req.valid('json');
  const now  = new Date().toISOString();
  const slug = body.slug ?? toSlug(body.name);

  const existing   = await templates.findOne({ where: { slug } });
  const finalSlug  = existing ? `${slug}-${shortId(4)}` : slug;

  const row = await templates.insert({
    id: generateId(),
    name: body.name,
    slug: finalSlug,
    subject: body.subject,
    html_body: body.htmlBody,
    text_body: body.textBody ?? null,
    layout: null,
    is_system: 0,
    domain_id: body.domainId ?? null,
    created_at: now,
    updated_at: now,
  });

  return c.json(enrich(row, LAYOUTS), 201);
});

// PUT /api/templates/:id
app.put('/:id', zValidator('json', templateSchema.partial()), async (c) => {
  const { templates } = makeDb(c.env.DB);
  const row = await templates.findOne({ where: { id: c.req.param('id') } });
  if (!row) return c.json({ error: 'Template not found' }, 404);
  if (row.is_system) return c.json({ error: 'System templates cannot be modified' }, 403);

  const body = c.req.valid('json');

  let newSlug: string | undefined;
  if (body.slug !== undefined) {
    const collision = await templates.findOne({ where: { slug: body.slug } });
    if (collision && collision.id !== row.id) {
      return c.json({ error: `Slug "${body.slug}" is already in use` }, 409);
    }
    newSlug = body.slug;
  } else if (body.name !== undefined && !row.slug) {
    newSlug = toSlug(body.name);
  }

  await templates.update({
    where: { id: row.id },
    set: {
      ...(body.name     !== undefined && { name:      body.name }),
      ...(newSlug       !== undefined && { slug:      newSlug }),
      ...(body.subject  !== undefined && { subject:   body.subject }),
      ...(body.htmlBody !== undefined && { html_body: body.htmlBody }),
      ...(body.textBody !== undefined && { text_body: body.textBody ?? null }),
      ...(body.domainId !== undefined && { domain_id: body.domainId ?? null }),
      updated_at: new Date().toISOString(),
    },
  });

  const updated = await templates.findOne({ where: { id: row.id } });
  return c.json(enrich(updated!, LAYOUTS));
});

// DELETE /api/templates/:id
app.delete('/:id', async (c) => {
  const { templates } = makeDb(c.env.DB);
  const row = await templates.findOne({ where: { id: c.req.param('id') } });
  if (!row) return c.json({ error: 'Template not found' }, 404);
  if (row.is_system) return c.json({ error: 'System templates cannot be deleted' }, 403);

  await templates.delete({ where: { id: row.id } });
  return c.json({ deleted: true });
});

// POST /api/templates/:id/preview
app.post('/:id/preview', async (c) => {
  const { templates } = makeDb(c.env.DB);
  const key = c.req.param('id');
  const row = (await templates.findOne({ where: { id: key } }))
    ?? (await templates.findOne({ where: { slug: key } }));
  if (!row) return c.json({ error: 'Template not found' }, 404);

  const body: { variables?: Record<string, string>; themeId?: string } =
    await c.req.json().catch(() => ({}));
  const variables: Record<string, string> = body.variables ?? {};
  const sub = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => variables[k] ?? `{{${k}}}`);

  let html: string;
  if (row.layout) {
    html = await renderLayout(row.layout as LayoutName, variables, body.themeId);
  } else {
    html = sub(row.html_body);
  }

  return c.json({ html, subject: sub(row.subject) });
});

export default app;
