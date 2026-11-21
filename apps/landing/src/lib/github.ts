let cached: Promise<number | null> | undefined;

/** Star count is fetched once per build so pages need no client request. */
export function getStars(repo = "0xdps/emailflare"): Promise<number | null> {
	cached ??= fetchStars(repo);
	return cached;
}

async function fetchStars(repo: string): Promise<number | null> {
	try {
		const res = await fetch(`https://api.github.com/repos/${repo}`, {
			headers: { Accept: "application/vnd.github+json", "User-Agent": "emailflare-landing" },
		});
		if (!res.ok) return null;
		const data = (await res.json()) as { stargazers_count?: number };
		return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
	} catch {
		return null;
	}
}

export function formatCount(n: number): string {
	return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);
}
