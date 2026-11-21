import { site } from "./site";

export interface Release {
	/** "Unreleased" or a version such as "1.0.0" */
	version: string;
	date: string | null;
	anchor: string;
	url: string;
	groups: { title: string; items: string[] }[];
}

// The changelog lives at the repository root, outside this app.
const files = import.meta.glob("../../../../CHANGELOG.md", { query: "?raw", import: "default", eager: true }) as Record<
	string,
	string
>;
const source = Object.values(files)[0] ?? "";

/** Parses Keep a Changelog markdown into releases, newest first. */
export function parseChangelog(md: string = source): Release[] {
	const releases: Release[] = [];
	let release: Release | null = null;
	let group: Release["groups"][number] | null = null;
	let item: string[] | null = null;

	const flushItem = () => {
		if (group && item) group.items.push(item.join(" ").trim());
		item = null;
	};

	for (const raw of md.split("\n")) {
		const line = raw.trimEnd();
		const heading = line.match(/^##\s+\[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?/);
		if (heading) {
			flushItem();
			const version = heading[1];
			const unreleased = version.toLowerCase() === "unreleased";
			release = {
				version: unreleased ? "Unreleased" : version,
				date: heading[2] ?? null,
				anchor: unreleased ? "unreleased" : `v${version}`,
				url: unreleased ? `${site.repo}/commits/trunk` : `${site.repo}/releases/tag/v${version}`,
				groups: [],
			};
			group = null;
			releases.push(release);
			continue;
		}
		if (!release) continue;
		const groupHeading = line.match(/^###\s+(.+)/);
		if (groupHeading) {
			flushItem();
			group = { title: groupHeading[1].trim(), items: [] };
			release.groups.push(group);
			continue;
		}
		if (/^\s*-\s+/.test(line) && group) {
			flushItem();
			item = [line.replace(/^\s*-\s+/, "")];
		} else if (item && /^\s+\S/.test(line)) {
			item.push(line.trim());
		} else if (!line.trim() || line.trim() === "---") {
			flushItem();
		}
	}
	flushItem();
	return releases.filter((r) => r.groups.some((g) => g.items.length));
}
