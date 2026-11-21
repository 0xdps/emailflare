import { site } from "@/lib/site";

/** BreadcrumbList for a top-level product page. */
export function breadcrumbJsonLd(name: string, path: string) {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{ "@type": "ListItem", position: 1, name: "EmailFlare", item: site.url },
			{ "@type": "ListItem", position: 2, name, item: new URL(path, site.url).href },
		],
	};
}
