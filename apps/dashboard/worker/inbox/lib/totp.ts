const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(bytes: Uint8Array): string {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
	let bits = 0;
	let value = 0;
	let output = "";
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			output += alphabet[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
	return output;
}

function base32Decode(input: string): Uint8Array {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
	const clean = input.replace(/=+$/g, "").toUpperCase();
	let bits = 0;
	let value = 0;
	const out: number[] = [];
	for (const char of clean) {
		const idx = alphabet.indexOf(char);
		if (idx < 0) continue;
		value = (value << 5) | idx;
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return new Uint8Array(out);
}

async function hotp(secret: Uint8Array, counter: number): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		secret.buffer.slice(secret.byteOffset, secret.byteOffset + secret.byteLength) as ArrayBuffer,
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"],
	);
	const msg = new Uint8Array(8);
	let remaining = counter;
	for (let i = 7; i >= 0; i--) {
		msg[i] = remaining & 255;
		remaining = Math.floor(remaining / 256);
	}
	const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
	const offset = digest[digest.length - 1] & 0x0f;
	const code =
		((digest[offset] & 0x7f) << 24) |
		((digest[offset + 1] & 0xff) << 16) |
		((digest[offset + 2] & 0xff) << 8) |
		(digest[offset + 3] & 0xff);
	return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function generateTotpSecret(): string {
	return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

export async function totpCode(secret: string, at = Date.now()): Promise<string> {
	return hotp(base32Decode(secret), Math.floor(at / 1000 / STEP_SECONDS));
}

/** Returns the time step whose code matches, or null. The step lets callers reject a replayed code. */
export async function matchTotpStep(secret: string, code: string, at = Date.now()): Promise<number | null> {
	const normalized = code.replace(/\s/g, "");
	if (!/^\d{6}$/.test(normalized)) return null;
	for (const delta of [-STEP_SECONDS, 0, STEP_SECONDS]) {
		const when = at + delta * 1000;
		if ((await totpCode(secret, when)) === normalized) return Math.floor(when / 1000 / STEP_SECONDS);
	}
	return null;
}

export async function verifyTotp(secret: string, code: string, at = Date.now()): Promise<boolean> {
	return (await matchTotpStep(secret, code, at)) !== null;
}

export function totpUri(secret: string, email: string): string {
	const label = encodeURIComponent(`EmailFlare:${email}`);
	return `otpauth://totp/${label}?secret=${secret}&issuer=EmailFlare&algorithm=SHA1&digits=6&period=30`;
}

// 12 hex characters (48 bits). The old 8-character codes are still accepted until they are used.
export function generateBackupCodes(): string[] {
	return Array.from({ length: 8 }, () => {
		const bytes = crypto.getRandomValues(new Uint8Array(6));
		return Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("")
			.toUpperCase();
	});
}

function normalizeBackupCode(code: string): string {
	return code.replace(/[\s-]/g, "").toUpperCase();
}

async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/** Storage form `v2$<salt>$<sha256(salt + code)>`. The salt lives in the value, so no schema change. */
export async function protectBackupCode(code: string): Promise<string> {
	const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `v2$${salt}$${await sha256Hex(salt + normalizeBackupCode(code))}`;
}

function constantTimeEqual(a: string, b: string): boolean {
	let diff = a.length ^ b.length;
	for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
	return diff === 0;
}

/** Finds the unused code row the typed code belongs to, whichever format it was stored in. */
export async function matchBackupCode(
	code: string,
	rows: Array<{ id: string; code_hash: string }>,
): Promise<string | null> {
	const normalized = normalizeBackupCode(code);
	if (!normalized) return null;
	const legacy = await sha256Hex(normalized);
	let found: string | null = null;
	for (const row of rows) {
		const parts = row.code_hash.split("$");
		const expected = parts[0] === "v2" && parts.length === 3 ? await sha256Hex(parts[1] + normalized) : legacy;
		const stored = parts[0] === "v2" && parts.length === 3 ? parts[2] : row.code_hash;
		if (constantTimeEqual(expected, stored) && found === null) found = row.id;
	}
	return found;
}
