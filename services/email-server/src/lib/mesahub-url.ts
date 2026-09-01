/**
 * Parse a `mh://` connection string into its component parts.
 *
 * Format: `mh://apikey@host[:port]/dbname`
 *
 * Examples:
 *   mh://shs_abc@mycore.railway.app/mydb   → HTTPS, external
 *   mh://secret@localhost:3000/mydb        → HTTP, local
 *
 * The form `mh://local/dbname` (embedded placeholder) is not valid here —
 * start.sh rewrites it to a concrete URL before the Node process starts.
 */
export interface ParsedMesahubUrl {
	apiUrl: string;
	apiKey: string;
	dbName: string;
}

export function parseMesahubUrl(raw: string): ParsedMesahubUrl {
	if (!raw.startsWith("mh://")) {
		throw new Error(`Invalid MESAHUB_URL: must start with mh:// (got: ${JSON.stringify(raw.slice(0, 30))})`);
	}

	const parsed = new URL(raw.replace(/^mh:\/\//, "http://"));
	const host = parsed.hostname;

	if (host === "local") {
		throw new Error(
			"mh://local/... is the embedded mode placeholder — start.sh must rewrite " +
				"MESAHUB_URL to mh://token@localhost:PORT/db before the application starts.",
		);
	}

	const isLocalhost = host === "localhost" || host === "127.0.0.1";
	// Hostnames with no dots are Docker/internal service names (e.g. "myservice").
	// Hostnames ending in .internal are private network domains (e.g. *.railway.internal).
	// Both must use plain HTTP — TLS is not available on these networks.
	const isPrivate = isLocalhost || !host.includes(".") || host.endsWith(".internal");
	const scheme = isPrivate ? "http" : "https";
	const portPart = parsed.port ? `:${parsed.port}` : "";
	const apiUrl = `${scheme}://${host}${portPart}`;

	const apiKey = decodeURIComponent(parsed.username);
	if (!apiKey) {
		throw new Error("MESAHUB_URL must include an API key: mh://apikey@host/dbname");
	}

	const dbName = parsed.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
	if (!dbName) {
		throw new Error("MESAHUB_URL must include a database name: mh://apikey@host/dbname");
	}

	return { apiUrl, apiKey, dbName };
}
