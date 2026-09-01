// Password hashing using PBKDF2-SHA256 (Web Crypto API — Node.js compatible).
// Format: $pbkdf2-sha256$v=1$<base64salt>$<base64hash>
// Identical to services/inbox-worker/src/lib/password.ts.

const ALGO = "SHA-256";
const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

function encode(buf: ArrayBuffer): string {
	return Buffer.from(buf).toString("base64");
}

function decode(b64: string): Uint8Array {
	return new Uint8Array(Buffer.from(b64, "base64"));
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, [
		"deriveBits",
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", hash: ALGO, iterations: ITERATIONS, salt: salt.buffer as ArrayBuffer },
		key,
		KEY_LENGTH * 8,
	);
	return `$pbkdf2-sha256$v=1$${encode(salt.buffer as ArrayBuffer)}$${encode(bits)}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	const parts = hash.split("$");
	// format: ['', 'pbkdf2-sha256', 'v=1', base64salt, base64hash]
	if (parts.length !== 5 || parts[1] !== "pbkdf2-sha256") return false;

	const salt = decode(parts[3]);
	const expected = decode(parts[4]);

	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, [
		"deriveBits",
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", hash: ALGO, iterations: ITERATIONS, salt: salt.buffer as ArrayBuffer },
		key,
		KEY_LENGTH * 8,
	);
	const actual = new Uint8Array(bits);

	// Constant-time comparison
	if (actual.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
	return diff === 0;
}
