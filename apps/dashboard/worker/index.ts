// Single EmailFlare Worker.
//
// vinext owns the App Router fetch handler. This entry sits in front of it so
// the same Worker can also receive mail, run the sequence cron, and consume
// the sequence queue. HTTP /api and /v1 stay on Hono so the public send
// contract does not move into Server Actions.

import vinextHandler from "vinext/server/fetch-handler";
import { app as api } from "./inbox/index.ts";
import { handleIncomingEmail, processDueSequenceSteps, handleSequenceQueueMessage } from "./inbox/index.ts";
import type { Env, SequenceQueueMessage } from "./inbox/env.ts";

export { NotificationsHub } from "./inbox/do/NotificationsHub.ts";

function isApiRequest(request: Request): boolean {
	const { pathname } = new URL(request.url);
	return pathname === "/health" || pathname.startsWith("/api/") || pathname.startsWith("/v1/");
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (isApiRequest(request)) {
			return api.fetch(request, env, ctx);
		}
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
				await handleSequenceQueueMessage(msg.body as SequenceQueueMessage, env);
				msg.ack();
			} catch {
				msg.retry();
			}
		}
	},
} satisfies ExportedHandler<Env>;
