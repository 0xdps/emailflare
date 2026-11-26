import assert from "node:assert/strict";
import test from "node:test";
import type { Hono } from "hono";
import { SignJWT } from "jose";
import { hashPassword } from "../lib/core/index.ts";
import authRouter from "../worker/inbox/routes/auth.ts";
import { revokeSessions, verifySession } from "../worker/inbox/lib/session.ts";
import { matchBackupCode, matchTotpStep, protectBackupCode, totpCode } from "../worker/inbox/lib/totp.ts";
import type { HonoEnv } from "../worker/inbox/env.ts";
import { SECRET, appWith, fakeDB, fakeKV } from "./helpers.ts";

// ── Sessions ──────────────────────────────────────────────────────────────────

async function token(iat: number) {
	return new SignJWT({ userId: "u1" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt(iat)
		.setExpirationTime("7d")
		.sign(new TextEncoder().encode(SECRET));
}

test("revoking sessions ends older tokens but not ones issued afterwards", async () => {
	const kv = fakeKV();
	const user = { id: "u1", name: "Ada", email: "ada@example.com", user_type: "member", access_types: '["inbox"]' };
	const env = { SESSION_SECRET: SECRET, RATE_LIMIT_KV: kv, DB: fakeDB(() => ({ first: user })) };
	const now = Math.floor(Date.now() / 1000);

	const before = await token(now - 100);
	assert.equal((await verifySession(before, env as never))?.userId, "u1");

	await revokeSessions(kv as never, "u1");
	assert.equal(await verifySession(before, env as never), null);
	assert.equal((await verifySession(await token(now + 5), env as never))?.userId, "u1");
});

// ── 2FA primitives ────────────────────────────────────────────────────────────

test("matchTotpStep reports the step so a code can be rejected on replay", async () => {
	const secret = "JBSWY3DPEHPK3PXP";
	const at = 1_700_000_000_000;
	const code = await totpCode(secret, at);
	const step = await matchTotpStep(secret, code, at);
	assert.equal(step, Math.floor(at / 1000 / 30));
	assert.equal(await matchTotpStep(secret, "000000", at), null);
	assert.equal(await matchTotpStep(secret, "12345", at), null);
});

test("backup codes are salted, accept the old format, and match case-insensitively", async () => {
	const a = await protectBackupCode("ab12cd34ef56");
	const b = await protectBackupCode("ab12cd34ef56");
	assert.notEqual(a, b);
	assert.match(a, /^v2\$[0-9a-f]{32}\$[0-9a-f]{64}$/);

	const legacyDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("1A2B3C4D"));
	const legacy = Array.from(new Uint8Array(legacyDigest))
		.map((x) => x.toString(16).padStart(2, "0"))
		.join("");
	const rows = [
		{ id: "new", code_hash: a },
		{ id: "old", code_hash: legacy },
	];
	assert.equal(await matchBackupCode("AB12-CD34-EF56", rows), "new");
	assert.equal(await matchBackupCode("1a2b3c4d", rows), "old");
	assert.equal(await matchBackupCode("ffffffffffff", rows), null);
});

// ── Login ─────────────────────────────────────────────────────────────────────

async function loginApp(opts: {
	failures?: number;
	user?: Record<string, unknown> | null;
	backupRows?: unknown[];
	burnChanges?: number;
}) {
	const kv = fakeKV();
	const db = fakeDB((sql) => {
		if (sql.includes("FROM audit_log")) return { first: { n: opts.failures ?? 0 } };
		if (sql.includes("FROM users")) return { first: opts.user ?? null };
		if (sql.includes("FROM user_backup_codes")) return { all: opts.backupRows ?? [] };
		if (sql.startsWith("UPDATE user_backup_codes")) return { changes: opts.burnChanges ?? 1 };
	});
	const app = appWith(authRouter as unknown as Hono<HonoEnv>, "/api/auth", {
		DB: db,
		RATE_LIMIT_KV: kv,
		SESSION_SECRET: SECRET,
	});
	const login = (password: string, otp?: string) =>
		app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...(otp ? { "X-EmailFlare-OTP": otp } : {}) },
			body: JSON.stringify({ email: "ada@example.com", password }),
		});
	return { db, kv, login };
}

const audited = (db: ReturnType<typeof fakeDB>) =>
	db.calls.filter((c) => c.sql.startsWith("INSERT INTO audit_log")).map((c) => c.args[2]);

test("an account locks after repeated failures, whatever the IP, without checking the password", async () => {
	const { db, login } = await loginApp({ failures: 5 });
	const res = await login("anything");
	assert.equal(res.status, 429);
	assert.ok(!db.calls.some((c) => c.sql.includes("FROM users")));
});

test("failed logins are recorded, including for emails that do not exist", async () => {
	const unknown = await loginApp({ user: null });
	assert.equal((await unknown.login("pw")).status, 401);
	assert.deepEqual(audited(unknown.db), ["auth.login_failed"]);

	const user = {
		id: "u1",
		name: "Ada",
		email: "ada@example.com",
		password_hash: await hashPassword("right"),
		user_type: "member",
		access_types: '["inbox"]',
		totp_enabled: 0,
		totp_secret: null,
	};
	const wrong = await loginApp({ user });
	assert.equal((await wrong.login("wrong")).status, 401);
	assert.deepEqual(audited(wrong.db), ["auth.login_failed"]);

	const ok = await loginApp({ user });
	const res = await ok.login("right");
	assert.equal(res.status, 200);
	assert.ok(res.headers.get("set-cookie")?.includes("ef_inbox_session="));
	assert.deepEqual(audited(ok.db), ["auth.login"]);
});

test("a TOTP code works once; replaying it within its window is refused", async () => {
	const secret = "JBSWY3DPEHPK3PXP";
	const user = {
		id: "u1",
		name: "Ada",
		email: "ada@example.com",
		password_hash: await hashPassword("right"),
		user_type: "member",
		access_types: '["inbox"]',
		totp_enabled: 1,
		totp_secret: secret,
	};
	const { login } = await loginApp({ user });

	assert.equal((await login("right")).status, 401); // password ok, code still needed
	const code = await totpCode(secret);
	assert.equal((await login("right", code)).status, 200);
	const replay = await login("right", code);
	assert.equal(replay.status, 401);
	assert.equal(((await replay.json()) as { error: string }).error, "totp_required");
});

test("a backup code signs in only if this request is the one that burns it", async () => {
	const secret = "JBSWY3DPEHPK3PXP";
	const user = {
		id: "u1",
		name: "Ada",
		email: "ada@example.com",
		password_hash: await hashPassword("right"),
		user_type: "member",
		access_types: '["inbox"]',
		totp_enabled: 1,
		totp_secret: secret,
	};
	const backupRows = [{ id: "b1", code_hash: await protectBackupCode("aaaabbbbcccc") }];

	assert.equal((await (await loginApp({ user, backupRows })).login("right", "aaaa-bbbb-cccc")).status, 200);
	assert.equal(
		(await (await loginApp({ user, backupRows, burnChanges: 0 })).login("right", "aaaabbbbcccc")).status,
		401,
	);
	assert.equal((await (await loginApp({ user, backupRows })).login("right", "000000000000")).status, 401);
});
