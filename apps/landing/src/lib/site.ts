export const site = {
	name: "EmailFlare",
	url: "https://emailflare.dev",
	tagline: "The email API and team inbox that runs in your Cloudflare account.",
	description:
		"EmailFlare is source-available email infrastructure for Cloudflare: a send API, a shared team inbox and a workspace for domains, templates and sequences. One Worker, your account, your data. Free to use and self-host under the Elastic License 2.0.",
	repo: "https://github.com/0xdps/emailflare",
	deploy: "https://deploy.workers.cloudflare.com/?url=https://github.com/0xdps/emailflare",
	sponsors: "https://github.com/sponsors/0xdps",
	coffee: "https://buymeacoffee.com/0xdps",
	author: { name: "Devendra Pratap Singh", handle: "0xdps", url: "https://dps.codes" },
	parent: { name: "0xlabs", url: "https://0xlabs.space" },
	license: { name: "Elastic License 2.0", short: "ELv2", url: "https://www.elastic.co/licensing/elastic-license" },
	demoApi: "https://your-emailflare.workers.dev",
} as const;

export interface NavLink {
	label: string;
	href: string;
	description?: string;
	icon?: string;
}

export const productLinks: NavLink[] = [
	{
		label: "Team inbox",
		href: "/inbox",
		description: "Shared mailboxes with threads, stars and live updates.",
		icon: "lucide:inbox",
	},
	{
		label: "Email API",
		href: "/email-api",
		description: "Send with one POST. Scoped keys, logs, suppressions.",
		icon: "lucide:send",
	},
	{
		label: "Templates",
		href: "/templates",
		description: "50 layouts. Variables. Live preview.",
		icon: "lucide:layout-template",
	},
];

export const mainNav: NavLink[] = [
	...productLinks,
	{ label: "Docs", href: "/docs" },
	{ label: "Compare", href: "/compare" },
	{ label: "Sponsor", href: "/sponsor" },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
	{ title: "Product", links: [...productLinks, { label: "Compare", href: "/compare" }] },
	{
		title: "Learn",
		links: [
			{ label: "Docs", href: "/docs" },
			{ label: "API reference", href: "/api-reference" },
			{ label: "Deploy to Cloudflare", href: "/cloudflare" },
			{ label: "Create an API token", href: "/cloudflare-token" },
			{ label: "Changelog", href: "/changelog" },
		],
	},
	{
		title: "Project",
		links: [
			{ label: "GitHub", href: site.repo },
			{ label: "Security", href: "/security" },
			{ label: "Sponsor", href: "/sponsor" },
			{ label: "License (ELv2)", href: "/license" },
			{ label: "OpenAPI spec", href: "/api-reference" },
			{ label: "Sitemap", href: "/sitemap" },
		],
	},
];
