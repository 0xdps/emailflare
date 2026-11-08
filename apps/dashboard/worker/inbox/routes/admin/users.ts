// Admin: user management routes
// GET    /api/admin/users
// DELETE /api/admin/users/:id
// PATCH  /api/admin/users/:id/permissions

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireSession, requireAdmin } from "../../middleware/auth.ts";
import type { HonoEnv } from "../../env.ts";

const app = new Hono<HonoEnv>();

// GET /api/admin/users
app.get("/", requireSession, requireAdmin, async (c) => {
	const users = await c.env.DB.prepare(
		"SELECT id, name, email, user_type, access_types, created_at FROM users ORDER BY created_at ASC",
	).all<{
		id: string;
		name: string;
		email: string;
		user_type: "admin" | "member";
		access_types?: string;
		created_at: string;
	}>();

	const normalized = (users.results ?? []).map((u) => {
		const user_type: "admin" | "member" = u.user_type === "admin" ? "admin" : "member";
		let access_types: ("inbox" | "api" | "tester")[] = [];
		if (user_type === "admin") {
			access_types = ["inbox", "api", "tester"];
		} else if (u.access_types) {
			try {
				const parsed = JSON.parse(u.access_types);
				access_types = Array.isArray(parsed) ? parsed : [];
			} catch {
				access_types = [];
			}
		}
		return {
			id: u.id,
			name: u.name,
			email: u.email,
			user_type,
			access_types,
			created_at: u.created_at,
		};
	});

	return c.json(normalized);
});

// DELETE /api/admin/users/:id
app.delete("/:id", requireSession, requireAdmin, async (c) => {
	const id = c.req.param("id");

	if (id === c.get("userId")) return c.json({ error: "Cannot delete own account" }, 400);

	const user = await c.env.DB.prepare("SELECT id, user_type FROM users WHERE id = ? LIMIT 1")
		.bind(id)
		.first<{ id: string; user_type?: string }>();
	if (!user) return c.json({ error: "User not found" }, 404);

	// Count total admins to ensure at least one admin remains
	const adminCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE user_type = 'admin'").first<{
		count: number;
	}>();

	const isAdmin = user.user_type === "admin";
	if (isAdmin && (adminCount?.count ?? 0) <= 1) {
		return c.json({ error: "Cannot delete the sole admin account" }, 403);
	}

	await c.env.DB.batch([
		c.env.DB.prepare("DELETE FROM inbox_members WHERE user_id = ?").bind(id),
		c.env.DB.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").bind(id),
		c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id),
	]);

	return c.json({ deleted: true });
});

// PATCH /api/admin/users/:id/permissions
app.patch(
	"/:id/permissions",
	requireSession,
	requireAdmin,
	zValidator(
		"json",
		z.object({
			user_type: z.enum(["admin", "member"]),
			access_types: z.array(z.enum(["inbox", "api", "tester"])).optional(),
		}),
	),
	async (c) => {
		const id = c.req.param("id");
		const currentUserId = c.get("userId");

		const user = await c.env.DB.prepare("SELECT id, user_type FROM users WHERE id = ? LIMIT 1")
			.bind(id)
			.first<{ id: string; user_type?: string }>();
		if (!user) return c.json({ error: "User not found" }, 404);

		const { user_type, access_types: rawAccessTypes } = c.req.valid("json");
		const isTargetAdmin = user_type === "admin";

		// Cannot demote own account from admin
		if (id === currentUserId && !isTargetAdmin) {
			return c.json({ error: "Cannot demote your own admin account" }, 400);
		}

		if (user.user_type === "admin" && !isTargetAdmin) {
			const adminCount = await c.env.DB.prepare(
				"SELECT COUNT(*) as count FROM users WHERE user_type = 'admin'",
			).first<{ count: number }>();
			if ((adminCount?.count ?? 0) <= 1) {
				return c.json({ error: "Cannot demote the last remaining admin account" }, 403);
			}
		}

		let accessTypes: ("inbox" | "api" | "tester")[];
		if (isTargetAdmin) {
			accessTypes = ["inbox", "api", "tester"];
		} else if (rawAccessTypes !== undefined) {
			accessTypes = rawAccessTypes;
		} else {
			accessTypes = ["inbox"];
		}

		await c.env.DB.prepare("UPDATE users SET user_type = ?, access_types = ? WHERE id = ?")
			.bind(user_type, JSON.stringify(accessTypes), id)
			.run();

		return c.json({ updated: true, user_type, access_types: accessTypes });
	},
);

export default app;
