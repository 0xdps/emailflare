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

export async function verifyTotp(secret: string, code: string, at = Date.now()): Promise<boolean> {
	const normalized = code.replace(/\s/g, "");
	if (!/^\d{6}$/.test(normalized)) return false;
	for (const delta of [-STEP_SECONDS, 0, STEP_SECONDS]) {
		const expected = await totpCode(secret, at + delta * 1000);
		if (expected === normalized) return true;
	}
	return false;
}

export function totpUri(secret: string, email: string): string {
	const label = encodeURIComponent(`EmailFlare:${email}`);
	return `otpauth://totp/${label}?secret=${secret}&issuer=EmailFlare&algorithm=SHA1&digits=6&period=30`;
}

export function generateBackupCodes(): string[] {
	return Array.from({ length: 8 }, () => {
		const bytes = crypto.getRandomValues(new Uint8Array(4));
		return Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("")
			.toUpperCase();
	});
}

export async function hashBackupCode(code: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(code.replace(/\s/g, "").toUpperCase()),
	);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
