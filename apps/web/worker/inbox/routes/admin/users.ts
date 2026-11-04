// Admin: user management routes
// GET    /api/admin/users
// DELETE /api/admin/users/:id
// PATCH  /api/admin/users/:id/role

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireSession, requireSuperAdmin } from "../../middleware/auth.ts";
import type { HonoEnv } from "../../env.ts";

const app = new Hono<HonoEnv>();

// GET /api/admin/users
app.get("/", requireSession, requireSuperAdmin, async (c) => {
	const users = await c.env.DB.prepare(
		"SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC",
	).all();
	return c.json(users.results);
});

// DELETE /api/admin/users/:id
app.delete("/:id", requireSession, requireSuperAdmin, async (c) => {
	const id = c.req.param("id");

	if (id === c.get("userId")) return c.json({ error: "Cannot delete own account" }, 400);

	const user = await c.env.DB.prepare("SELECT id, role FROM users WHERE id = ? LIMIT 1")
		.bind(id)
		.first<{ id: string; role: string }>();
	if (!user) return c.json({ error: "User not found" }, 404);
	if (user.role === "super-admin") return c.json({ error: "Cannot delete the owner account" }, 403);

	await c.env.DB.batch([
		c.env.DB.prepare("DELETE FROM inbox_members WHERE user_id = ?").bind(id),
		c.env.DB.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").bind(id),
		c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id),
	]);

	return c.json({ deleted: true });
});

// PATCH /api/admin/users/:id/role
app.patch(
	"/:id/role",
	requireSession,
	requireSuperAdmin,
	zValidator("json", z.object({ role: z.enum(["admin", "member", "tester"]) })),
	async (c) => {
		const id = c.req.param("id");
		if (id === c.get("userId")) return c.json({ error: "Cannot change own role" }, 400);

		const user = await c.env.DB.prepare("SELECT id, role FROM users WHERE id = ? LIMIT 1")
			.bind(id)
			.first<{ id: string; role: string }>();
		if (!user) return c.json({ error: "User not found" }, 404);
		if (user.role === "super-admin") return c.json({ error: "Cannot change the owner role" }, 403);

		const { role } = c.req.valid("json");
		await c.env.DB.prepare("UPDATE users SET role = ? WHERE id = ?").bind(role, id).run();
		return c.json({ updated: true });
	},
);

export default app;
