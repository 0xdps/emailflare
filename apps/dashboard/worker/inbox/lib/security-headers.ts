// Response hardening applied to everything the Worker serves.
//
// The CSP is limited to directives that don't restrict resource loading. A script or
// image policy would need per-request nonces for the Next.js runtime, and the inbox
// renders email inside srcdoc iframes, which inherit this document's policy.

const CSP_FRAMING = "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";

export function withSecurityHeaders(request: Request, response: Response): Response {
	// Upgrade responses carry a socket that cannot be re-wrapped.
	if (response.status === 101 || (response as Response & { webSocket?: unknown }).webSocket) return response;

	const headers = new Headers(response.headers);
	const setDefault = (name: string, value: string) => {
		if (!headers.has(name)) headers.set(name, value);
	};

	setDefault("X-Content-Type-Options", "nosniff");
	setDefault("X-Frame-Options", "DENY");
	setDefault("Referrer-Policy", "strict-origin-when-cross-origin");
	setDefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
	if (new URL(request.url).protocol === "https:") setDefault("Strict-Transport-Security", "max-age=31536000");
	if ((headers.get("Content-Type") ?? "").toLowerCase().startsWith("text/html")) {
		setDefault("Content-Security-Policy", CSP_FRAMING);
	}

	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
