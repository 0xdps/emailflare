import {
	Activity,
	Archive,
	FileText,
	FlaskConical,
	Globe,
	Inbox,
	Key,
	LayoutDashboard,
	ListOrdered,
	Mail,
	Radio,
	ScrollText,
	Settings,
	ShieldCheck,
	ShieldOff,
	Star,
	Users,
	type LucideIcon,
} from "lucide-react";

/**
 * Navigation is declared once here. The sidebar, breadcrumb, ⌘K palette and
 * "g then <key>" shortcuts all read from this file — add a page here and it
 * shows up everywhere.
 */

export type Workspace = "inbox" | "api" | "admin";

export interface NavContext {
	pathname: string;
	params: URLSearchParams;
}

export interface NavItem {
	title: string;
	description?: string;
	href: string;
	icon: LucideIcon;
	exact?: boolean;
	/** Second key of the "g then <key>" shortcut. */
	go?: string;
	keywords?: string[];
	/** Permission needed when it differs from the workspace default (inbox items default to inbox access). */
	access?: "tester";
	/** Overrides the default href matching (needed for query-string views). */
	isActive?: (ctx: NavContext) => boolean;
}

export interface NavGroup {
	label?: string;
	items: NavItem[];
}

export interface WorkspaceMeta {
	id: Workspace;
	label: string;
	description: string;
	home: string;
	icon: LucideIcon;
}

export const WORKSPACES: Record<Workspace, WorkspaceMeta> = {
	inbox: { id: "inbox", label: "Inbox", description: "Team mail & workflows", home: "/inbox", icon: Inbox },
	api: { id: "api", label: "API", description: "Transactional sending", home: "/developer/overview", icon: Radio },
	admin: { id: "admin", label: "Admin", description: "Workspace settings", home: "/settings", icon: Settings },
};

const inboxView = (view: string | null) => (ctx: NavContext) => {
	// The mailbox is a filter on top of a view, so it doesn't affect which view is active.
	if (ctx.pathname !== "/inbox" || ctx.params.has("folder")) return false;
	const current = ctx.params.get("view");
	if (view === null) return current === null || current === "inbox" || current === "unread";
	return current === view;
};

/** Static inbox links; mailboxes and counters are dynamic and added by the sidebar. */
export const INBOX_VIEWS: NavItem[] = [
	{
		title: "Inbox",
		href: "/inbox",
		icon: Inbox,
		go: "i",
		keywords: ["messages", "threads", "conversations", "email"],
		isActive: inboxView(null),
	},
	{ title: "Starred", href: "/inbox?view=starred", icon: Star, isActive: inboxView("starred") },
	{ title: "Archived", href: "/inbox?view=archived", icon: Archive, isActive: inboxView("archived") },
];

export const INBOX_TEST: NavItem = {
	title: "Test mailbox",
	description: "Inspect captured sandbox emails",
	href: "/inbox?folder=test",
	icon: FlaskConical,
	go: "t",
	access: "tester",
	keywords: ["sandbox", "testing", "preview", "qa"],
	isActive: ({ pathname, params }) => pathname === "/inbox" && params.get("folder") === "test",
};

export const INBOX_WORKFLOWS: NavItem[] = [
	{
		title: "Contacts",
		description: "People you have emailed with",
		href: "/inbox/people",
		icon: Users,
		keywords: ["people", "customers", "crm"],
	},
	{
		title: "Sequences",
		description: "Follow-ups sent on a schedule",
		href: "/inbox/sequences",
		icon: ListOrdered,
		keywords: ["campaigns", "outreach", "drip", "automation"],
	},
];

export const API_NAV: NavGroup[] = [
	{
		label: "Delivery",
		items: [
			{
				title: "Overview",
				description: "Health, metrics and traffic",
				href: "/developer/overview",
				icon: LayoutDashboard,
				exact: true,
				go: "d",
				keywords: ["dashboard", "metrics", "analytics", "stats"],
			},
			{
				title: "Activity logs",
				description: "Every sent and received email",
				href: "/developer/logs",
				icon: ScrollText,
				go: "l",
				keywords: ["events", "history", "trace"],
			},
			{
				title: "Templates",
				description: "Transactional email templates",
				href: "/developer/templates",
				icon: FileText,
				keywords: ["html", "layouts"],
			},
			{
				title: "Playground",
				description: "Send test emails with live snippets",
				href: "/developer/playground",
				icon: FlaskConical,
				go: "p",
				keywords: ["send", "curl", "snippet"],
			},
		],
	},
	{
		label: "Audiences",
		items: [
			{
				title: "Audiences",
				description: "Unsubscribe lists",
				href: "/developer/lists",
				icon: Users,
				keywords: ["subscribers", "opt-out", "unsubscribe"],
			},
			{
				title: "Suppressions",
				description: "Bounces, complaints and blocked recipients",
				href: "/developer/suppressions",
				icon: ShieldOff,
				keywords: ["blacklist", "bounced", "spam"],
			},
			{
				title: "Deliverability",
				description: "Sender reputation checks",
				href: "/developer/deliverability",
				icon: Activity,
			},
		],
	},
];

export const ADMIN_NAV: NavGroup[] = [
	{
		label: "Workspace",
		items: [
			{ title: "Overview", href: "/settings", icon: Settings, exact: true, keywords: ["admin", "home", "setup"] },
			{ title: "Domains", href: "/domains", icon: Globe, keywords: ["dns", "sending"] },
			{ title: "Mailboxes", href: "/inbox/settings", icon: Mail, keywords: ["inboxes", "routing"] },
			{ title: "Team", href: "/settings/users", icon: Users, go: "u", keywords: ["members", "invite", "roles"] },
		],
	},
	{
		label: "Developers",
		items: [
			{ title: "API keys", href: "/keys", icon: Key, go: "k", keywords: ["token", "secret"] },
			{ title: "Webhooks", href: "/settings/webhooks", icon: Radio },
		],
	},
	{
		label: "Compliance",
		items: [
			{ title: "Audit log", href: "/settings/audit", icon: ScrollText },
			{ title: "Security", href: "/settings/security", icon: ShieldCheck, keywords: ["2fa", "totp", "password"] },
		],
	},
];

export function workspaceForPath(pathname: string): Workspace {
	if (
		pathname.startsWith("/settings") ||
		pathname === "/inbox/settings" ||
		pathname.startsWith("/domains") ||
		pathname.startsWith("/keys")
	) {
		return "admin";
	}
	if (pathname.startsWith("/developer")) return "api";
	return "inbox";
}

export function isNavActive(item: NavItem, ctx: NavContext): boolean {
	if (item.isActive) return item.isActive(ctx);
	const [path, query] = item.href.split("?");
	if (query) {
		const expected = new URLSearchParams(query);
		return ctx.pathname === path && [...expected.keys()].every((k) => ctx.params.get(k) === expected.get(k));
	}
	return item.exact || path === "/"
		? ctx.pathname === path
		: ctx.pathname === path || ctx.pathname.startsWith(path + "/");
}

export function allNavItems(): Array<NavItem & { workspace: Workspace; group?: string }> {
	return [
		...[...INBOX_VIEWS, INBOX_TEST, ...INBOX_WORKFLOWS].map((i) => ({ ...i, workspace: "inbox" as const })),
		...API_NAV.flatMap((g) => g.items.map((i) => ({ ...i, workspace: "api" as const, group: g.label }))),
		...ADMIN_NAV.flatMap((g) => g.items.map((i) => ({ ...i, workspace: "admin" as const, group: g.label }))),
	];
}

/** Longest-prefix match so /settings/users resolves to "Team", not "Overview". */
export function currentNavItem(pathname: string): (NavItem & { workspace: Workspace }) | null {
	const matches = allNavItems()
		.filter(
			(i) =>
				!i.href.includes("?") &&
				(i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + "/")),
		)
		.sort((a, b) => b.href.length - a.href.length);
	return matches[0] ?? null;
}

export function goShortcuts(): Record<string, string> {
	const map: Record<string, string> = {};
	for (const item of allNavItems()) if (item.go) map[item.go] = item.href;
	return map;
}
