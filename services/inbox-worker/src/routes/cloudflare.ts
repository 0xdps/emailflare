import { Hono } from "hono";
import { getCloudflareTokenStatus } from "../services/cloudflare.ts";
import type { HonoEnv } from "../env.ts";

const app = new Hono<HonoEnv>();

// GET /api/cloudflare/status
app.get("/status", async (c) => {
	const status = await getCloudflareTokenStatus(c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID);
	return c.json(status);
});

export default app;
