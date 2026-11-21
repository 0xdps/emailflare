import { getCollection, type CollectionEntry } from "astro:content";

export type DocEntry = CollectionEntry<"docs">;
export type DocSection = DocEntry["data"]["section"];

export const docsRepoEdit = "https://github.com/0xdps/emailflare/edit/trunk/apps/landing/src/content/docs";

/** Section order, icon and one-line summary for the sidebar and the docs landing page. */
export const docSections: { id: DocSection; icon: string; description: string }[] = [
	{ id: "Start", icon: "lucide:rocket", description: "What EmailFlare is and how to send your first email." },
	{
		id: "Send API",
		icon: "lucide:send",
		description: "Keys, the send endpoint, testing, suppressions and webhooks.",
	},
	{
		id: "Templates",
		icon: "lucide:layout-template",
		description: "Variables, conditionals and the built-in layouts.",
	},
	{ id: "Inbox", icon: "lucide:inbox", description: "Mailboxes, threads and scheduled sequences." },
	{ id: "Operate", icon: "lucide:server-cog", description: "Domains, roles, updates and fixes for common problems." },
];

export interface NavItem {
	title: string;
	href: string;
}
export interface NavGroup {
	id: DocSection;
	icon: string;
	description: string;
	items: NavItem[];
}

export const docHref = (id: string) => `/docs/${id}`;

export async function getDocs(): Promise<DocEntry[]> {
	const all = await getCollection("docs");
	return all.sort((a, b) => a.data.order - b.data.order);
}

export function groupDocs(entries: DocEntry[]): NavGroup[] {
	return docSections
		.map((s) => ({
			...s,
			items: entries
				.filter((e) => e.data.section === s.id)
				.map((e) => ({ title: e.data.title, href: docHref(e.id) })),
		}))
		.filter((g) => g.items.length > 0);
}
