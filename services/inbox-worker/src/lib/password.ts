// PBKDF2-based password hashing using Web Crypto API.
// No Node.js crypto — works natively in Cloudflare Workers.
//
// Format: $pbkdf2-sha256$v=1$<base64-salt>$<base64-hash>

const ITERATIONS = 100_000;
const KEY_LENGTH = 32; // bytes
const SALT_LENGTH = 16; // bytes

async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
	const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
		"deriveBits",
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
		keyMaterial,
		KEY_LENGTH * 8,
	);
	return new Uint8Array(bits);
}

function toBase64(buf: Uint8Array): string {
	return btoa(String.fromCharCode(...buf));
}

function fromBase64(str: string): Uint8Array {
	return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const hash = await deriveKey(password, salt);
	return `$pbkdf2-sha256$v=1$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parts = stored.split("$");
	// Format: ['', 'pbkdf2-sha256', 'v=1', b64salt, b64hash]
	if (parts.length !== 5 || parts[1] !== "pbkdf2-sha256") return false;
	try {
		const salt = fromBase64(parts[3]);
		const expectedHash = fromBase64(parts[4]);
		const actualHash = await deriveKey(password, salt);
		// Constant-time comparison
		if (actualHash.length !== expectedHash.length) return false;
		let diff = 0;
		for (let i = 0; i < actualHash.length; i++) diff |= actualHash[i] ^ expectedHash[i];
		return diff === 0;
	} catch {
		return false;
	}
}
