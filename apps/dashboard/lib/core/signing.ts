// HMAC helpers shared by the Worker and tests. Web Crypto only.

const encoder = new TextEncoder();

export async function hmacHex(secret: string, data: string): Promise<string> {
	const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
		"sign",
	]);
	const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
	return Array.from(new Uint8Array(mac))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/** Compares two strings without bailing out at the first difference. */
export function timingSafeEqual(a: string, b: string): boolean {
	const left = encoder.encode(a);
	const right = encoder.encode(b);
	let diff = left.length ^ right.length;
	for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
	return diff === 0;
}

/** Signature that binds a tracking token to the exact URL it may redirect to. */
export function trackingSignature(secret: string, token: string, url: string): Promise<string> {
	return hmacHex(`tracking:${secret}`, `${token}\n${url}`);
}
