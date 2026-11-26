import { Hono } from "hono";
import type { HonoEnv } from "../worker/inbox/env.ts";

// Small in-memory stand-ins for D1 and KV, shared by the route tests.
export const SECRET = "test-session-secret-0123456789abcdef";

export function fakeKV() {
	const store = new Map<string, string>();
	return {
		store,
		get: async (key: string, type?: string) => {
			const value = store.get(key) ?? null;
			return value !== null && type === "json" ? JSON.parse(value) : value;
		},
		put: async (key: string, value: string) => void store.set(key, value),
		delete: async (key: string) => void store.delete(key),
	};
}

export type Reply = { first?: unknown; all?: unknown[]; changes?: number };

export function fakeDB(handler: (sql: string, args: unknown[]) => Reply | void) {
	const calls: Array<{ sql: string; args: unknown[] }> = [];
	// A statement counts as executed only when first/all/run is called, as with D1.
	const statement = (sql: string, args: unknown[]) => {
		const run = () => {
			calls.push({ sql, args });
			return handler(sql, args) ?? {};
		};
		return {
			first: async () => run().first ?? null,
			all: async () => ({ results: run().all ?? [] }),
			run: async () => ({ meta: { changes: run().changes ?? 1 } }),
		};
	};
	return {
		calls,
		prepare: (sql: string) => ({ ...statement(sql, []), bind: (...args: unknown[]) => statement(sql, args) }),
	};
}

export function appWith(router: Hono<HonoEnv>, mount: string, env: Record<string, unknown>) {
	const app = new Hono<HonoEnv>();
	app.route(mount, router);
	const waits: Promise<unknown>[] = [];
	const ctx = { waitUntil: (p: Promise<unknown>) => void waits.push(p), passThroughOnException() {} };
	return {
		waits,
		request: (path: string, init?: RequestInit) => app.request(path, init, env, ctx as never),
	};
}
