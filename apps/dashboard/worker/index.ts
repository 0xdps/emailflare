// Single EmailFlare Worker.
//
// vinext owns the App Router fetch handler. This entry sits in front of it so
// the same Worker can also receive mail, run the sequence cron, and consume
// the sequence queue. HTTP /api and /v1 stay on Hono so the public send
// contract does not move into Server Actions.

import vinextHandler from "vinext/server/fetch-handler";
import { app as api } from "./inbox/index.ts";
import {
	handleIncomingEmail,
	processDueSequenceSteps,
	handleSequenceQueueMessage,
	deliverScheduledSend,
} from "./inbox/index.ts";
import type { Env, ScheduledSendMessage, SequenceQueueMessage } from "./inbox/env.ts";

export { NotificationsHub } from "./inbox/do/NotificationsHub.ts";

function isApiRequest(request: Request): boolean {
	const { pathname } = new URL(request.url);
	return pathname === "/health" || pathname.startsWith("/api/") || pathname.startsWith("/v1/");
}

async function hasAdmin(env: Env): Promise<boolean> {
	const row = await env.DB.prepare("SELECT id FROM users LIMIT 1").first();
	return !!row;
}

// First-run routing stays here. These pages are client components, and a server
// redirect inside them renders through vinext, which this Worker cannot do.
async function setupRedirect(request: Request, env: Env): Promise<Response | null> {
	const url = new URL(request.url);
	if (url.pathname !== "/" && url.pathname !== "/login" && url.pathname !== "/setup") return null;
	const ready = await hasAdmin(env);
	const target = ready ? "/login" : "/setup";
	if (url.pathname === target) return null;
	if (ready && url.pathname === "/") return null;
	return Response.redirect(new URL(target, url), 302);
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const { pathname } = new URL(request.url);
		if (pathname === "/favicon.ico") {
			return fetch(new URL("/favicon.svg", request.url), request);
		}
		if (isApiRequest(request)) {
			return api.fetch(request, env, ctx);
		}
		const redirect = await setupRedirect(request, env);
		if (redirect) return redirect;
		return vinextHandler.fetch(request, env, ctx);
	},

	async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(handleIncomingEmail(message, env));
	},

	async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(processDueSequenceSteps(env));
	},

	async queue(batch: MessageBatch, env: Env): Promise<void> {
		for (const msg of batch.messages) {
			try {
				const body = msg.body as SequenceQueueMessage | ScheduledSendMessage;
				if (body.type === "scheduled_send") await deliverScheduledSend(body, env);
				else await handleSequenceQueueMessage(body, env);
				msg.ack();
			} catch {
				msg.retry();
			}
		}
	},
} satisfies ExportedHandler<Env>;
