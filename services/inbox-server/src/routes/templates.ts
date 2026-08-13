import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { customAlphabet } from 'nanoid';
import { generateId } from '@emailflare/email-core';
import { makeDb } from '../db.js';
import type { TemplateRow } from '../db.js';
import { renderLayout, LAYOUTS, THEMES } from '@emailflare/emails';
import type { LayoutName } from '@emailflare/emails';
import type { HonoEnv } from '../env.js';

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 21);

const app = new Hono<HonoEnv>();

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function enrich(row: TemplateRow) {
  const variables: string[] = row.is_system && row.layout
    ? (LAYOUTS[row.layout as LayoutName]?.variables ?? [])
    : [];
  return { ...row, variables };
}

app.get('/', async (c) => {
  const { templates } = makeDb();
  const domainId = c.req.query('domainId');
  const rows = await templates.find({
    where: domainId ? { domain_id: domainId } : undefined,
    orderBy: [
      { column: 'is_system', direction: 'desc' },
      { column: 'updated_at', direction: 'desc' },
    ],
  });
  return c.json(rows.map(enrich));
});

app.get('/themes', (c) => {
  const list = Object.entries(THEMES).map(([id, t]) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    primaryColor: t.primary,
  }));
  return c.json(list);
});

app.get('/:idOrSlug', async (c) => {
  const { templates } = makeDb();
  const key = c.req.param('idOrSlug');
  const row = (await templates.findOne({ where: { id: key } }))
    ?? (await templates.findOne({ where: { slug: key } }));
  if (!row) return c.json({ error: 'Template not found' }, 404);
  return c.json(enrich(row));
});

const templateSchema = z.object({
  name:     z.string().min(1),
  slug:     z.string().regex(/^[a-z0-9-]+$/).optional(),
  subject:  z.string().min(1),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
  domainId: z.string().optional().nullable(),
});

app.post('/', zValidator('json', templateSchema), async (c) => {
  const { templates } = makeDb();
  const body = c.req.valid('json');
  const now  = new Date().toISOString();
  const slug = body.slug ?? toSlug(body.name);

  const existing  = await templates.findOne({ where: { slug } });
  const finalSlug = existing ? `${slug}-${nanoid(4)}` : slug;

  const row = await templates.insert({
    id:         generateId(),
    name:       body.name,
    slug:       finalSlug,
    subject:    body.subject,
    html_body:  body.htmlBody,
    text_body:  body.textBody ?? null,
    layout:     null,
    is_system:  0,
    domain_id:  body.domainId ?? null,
    created_at: now,
    updated_at: now,
  });

  return c.json(enrich(row), 201);
});

app.put('/:id', zValidator('json', templateSchema.partial()), async (c) => {
  const { templates } = makeDb();
  const row = await templates.findOne({ where: { id: c.req.param('id') } });
  if (!row) return c.json({ error: 'Template not found' }, 404);
  if (row.is_system) return c.json({ error: 'System templates cannot be modified' }, 403);

  const body = c.req.valid('json');

  let newSlug: string | undefined;
  if (body.slug !== undefined) {
    const collision = await templates.findOne({ where: { slug: body.slug } });
    if (collision && collision.id !== row.id) return c.json({ error: `Slug "${body.slug}" is already in use` }, 409);
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
  return c.json(enrich(updated!));
});

app.delete('/:id', async (c) => {
  const { templates } = makeDb();
  const row = await templates.findOne({ where: { id: c.req.param('id') } });
  if (!row) return c.json({ error: 'Template not found' }, 404);
  if (row.is_system) return c.json({ error: 'System templates cannot be deleted' }, 403);
  await templates.delete({ where: { id: row.id } });
  return c.json({ deleted: true });
});

app.post('/:id/preview', async (c) => {
  const { templates } = makeDb();
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
