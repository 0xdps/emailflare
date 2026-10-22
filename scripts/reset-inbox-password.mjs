#!/usr/bin/env node
/**
 * Operator recovery for a forgotten inbox login password.
 *
 * Passwords are stored as PBKDF2-SHA256 hashes (see packages/inbox-core).
 * They cannot be read back. This script hashes a new password and writes it
 * to the `users` row for the given email.
 *
 * Usage (via just):
 *   just emailflare-inbox-reset-password you@example.com
 *   just emailflare-inbox-reset-password you@example.com --local
 *
 * Requires `wrangler login` (or CLOUDFLARE_API_TOKEN) for --remote, which is
 * the default. The new password is read from a hidden prompt and is never
 * written to disk or printed.
 */

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerDir = resolve(root, "services/inbox-worker");

function usage() {
	console.error(`Usage: just emailflare-inbox-reset-password <email> [--local]

Resets the inbox login password for an existing user.
Default target is the remote Cloudflare D1 database. Pass --local for wrangler dev.`);
	process.exit(1);
}

function toBase64(buf) {
	return Buffer.from(buf).toString("base64");
}

async function hashPassword(password) {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
		"deriveBits",
	]);
	const bits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt,
			iterations: ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		KEY_LENGTH * 8,
	);
	return `$pbkdf2-sha256$v=1$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}

function sqlString(value) {
	return `'${value.replaceAll("'", "''")}'`;
}

function runWrangler(args) {
	const result = spawnSync("npx", ["wrangler", ...args], {
		cwd: workerDir,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.status !== 0) {
		const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
		console.error(combined || "wrangler command failed");
		process.exit(result.status ?? 1);
	}
	return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

// wrangler prints experimental-config warnings around the JSON payload.
// The D1 --json result is a pretty-printed array whose brackets are on their own lines.
function parseExecuteJson(stdout) {
	const lines = stdout.split("\n");
	const start = lines.findIndex((line) => line.trim() === "[");
	const end = lines.findLastIndex((line) => line.trim() === "]");
	if (start === -1 || end < start) return null;
	try {
		return JSON.parse(lines.slice(start, end + 1).join("\n"));
	} catch {
		return null;
	}
}

async function promptPassword() {
	const rl = createInterface({ input, output });
	try {
		const password = await rl.question("New password (min 8 characters): ");
		const confirm = await rl.question("Confirm password: ");
		return { password, confirm };
	} finally {
		rl.close();
	}
}

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const local = args.includes("--local");
const email = args
	.find((arg) => !arg.startsWith("--"))
	?.trim()
	.toLowerCase();

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) usage();

const { password, confirm } = await promptPassword();
if (password.length < 8) {
	console.error("Password must be at least 8 characters.");
	process.exit(1);
}
if (password !== confirm) {
	console.error("Passwords do not match.");
	process.exit(1);
}

const target = local ? "--local" : "--remote";
const lookupSql = `SELECT id, email, role FROM users WHERE email = ${sqlString(email)} LIMIT 1;`;
const lookup = runWrangler(["d1", "execute", "emailflare", target, "--json", "--command", lookupSql]);
const lookupJson = parseExecuteJson(lookup.stdout);
const user = lookupJson?.[0]?.results?.[0];

if (!user) {
	console.error(`No inbox user found for ${email}.`);
	if (lookup.stderr.trim()) console.error(lookup.stderr.trim());
	console.error("List accounts with: just emailflare-inbox-users");
	process.exit(1);
}

const passwordHash = await hashPassword(password);
const updateSql = `UPDATE users SET password_hash = ${sqlString(passwordHash)} WHERE email = ${sqlString(email)};`;
runWrangler(["d1", "execute", "emailflare", target, "--command", updateSql]);

console.log(`Password reset for ${user.email} (${user.role}).`);
console.log("Existing sessions stay valid until they expire. Log in with the new password.");
