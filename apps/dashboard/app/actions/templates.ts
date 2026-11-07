"use server";

import { env } from "cloudflare:workers";
import { templateSchema, toSlug, enrich, generateId, shortId } from "@/lib/core";
import { makeDb } from "@/worker/inbox/db";
import { LAYOUTS } from "@/worker/inbox/emails";
import { requireApi } from "./auth";
import type { Env } from "@/worker/inbox/env";

export async function createTemplateAction(input: {
	name: string;
	slug?: string;
	subject: string;
	htmlBody: string;
	textBody?: string;
	domainId?: string;
}) {
	await requireApi();
	const body = templateSchema.parse(input);
	const workerEnv = env as unknown as Env;
	const { templates } = makeDb(workerEnv.DB);
	const now = new Date().toISOString();

	const existing = await templates.findOne({ where: { slug: body.slug } });
	const finalSlug = existing ? `${body.slug}-${shortId(4)}` : body.slug;

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

	return enrich(row, LAYOUTS);
}

export async function updateTemplateAction(
	id: string,
	input: {
		name?: string;
		slug?: string;
		subject?: string;
		htmlBody?: string;
		textBody?: string;
		domainId?: string;
	},
) {
	await requireApi();
	const body = templateSchema.partial().parse(input);
	const workerEnv = env as unknown as Env;
	const { templates } = makeDb(workerEnv.DB);

	const row = await templates.findOne({ where: { id } });
	if (!row) throw new Error("Template not found");
	if (row.is_system) throw new Error("System templates cannot be modified");

	let newSlug: string | undefined;
	if (body.slug !== undefined) {
		const collision = await templates.findOne({ where: { slug: body.slug } });
		if (collision && collision.id !== row.id) {
			throw new Error(`Slug "${body.slug}" is already in use`);
		}
		newSlug = body.slug;
	} else if (body.name !== undefined && !row.slug) {
		newSlug = toSlug(body.name);
	}

	await templates.update({
		where: { id: row.id },
		set: {
			...(body.name !== undefined && { name: body.name }),
			...(newSlug !== undefined && { slug: newSlug }),
			...(body.subject !== undefined && { subject: body.subject }),
			...(body.htmlBody !== undefined && { html_body: body.htmlBody }),
			...(body.textBody !== undefined && { text_body: body.textBody ?? null }),
			...(body.domainId !== undefined && { domain_id: body.domainId ?? null }),
			updated_at: new Date().toISOString(),
		},
	});

	const updated = await templates.findOne({ where: { id: row.id } });
	return enrich(updated!, LAYOUTS);
}

export async function deleteTemplateAction(id: string): Promise<{ deleted: boolean }> {
	await requireApi();
	const workerEnv = env as unknown as Env;
	const { templates } = makeDb(workerEnv.DB);

	const row = await templates.findOne({ where: { id } });
	if (!row) throw new Error("Template not found");
	if (row.is_system) throw new Error("System templates cannot be deleted");

	await templates.delete({ where: { id: row.id } });
	return { deleted: true };
}
