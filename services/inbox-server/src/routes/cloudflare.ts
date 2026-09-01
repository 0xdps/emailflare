import { Hono } from "hono";
import { getCloudflareTokenStatus } from "../services/cloudflare.js";
import { env } from "../env.js";
import type { HonoEnv } from "../env.js";

const app = new Hono<HonoEnv>();

app.get("/status", async (c) => {
	const status = await getCloudflareTokenStatus(env.CF_API_TOKEN, env.CF_ACCOUNT_ID);
	return c.json(status);
});

export default app;
