import type { APIRoute } from "astro";
import { render } from "astro:content";
import { docHref, getDocs } from "@/lib/docs";

export interface SearchRecord {
	/** Heading text, or the page title for the page record */
	title: string;
	page: string;
	section: string;
	url: string;
	text: string;
}

const plain = (md: string) =>
	md
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/[`*>#|]/g, " ")
		.replace(/(^|\s)[-:]{3,}(?=\s|$)/g, " ")
		.replace(/(^|\s)[-*]\s+/g, " ")
		.replace(/\s+/g, " ")
		.trim();

export const GET: APIRoute = async () => {
	const records: SearchRecord[] = [];

	for (const entry of await getDocs()) {
		const { headings } = await render(entry);
		const url = docHref(entry.id);
		const base = { page: entry.data.title, section: entry.data.section };

		records.push({ ...base, title: entry.data.title, url, text: entry.data.description });

		// Split the body at h2 to h6 lines outside code fences; they pair 1:1 with render()'s headings.
		let inFence = false;
		let index = -1;
		const chunks: string[] = [];
		for (const line of (entry.body ?? "").split("\n")) {
			if (line.startsWith("```")) inFence = !inFence;
			if (!inFence && /^#{2,6}\s/.test(line)) {
				index++;
				chunks[index] = "";
				continue;
			}
			if (index >= 0) chunks[index] += ` ${line}`;
		}

		const sub = headings.filter((h) => h.depth >= 2);
		sub.forEach((h, i) => {
			records.push({
				...base,
				title: h.text,
				url: `${url}#${h.slug}`,
				text: plain(chunks[i] ?? "").slice(0, 400),
			});
		});
	}

	return new Response(JSON.stringify(records), { headers: { "Content-Type": "application/json" } });
};
