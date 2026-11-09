import Link from "next/link";
import { Globe, Inbox, Key, Users } from "lucide-react";

interface AdminHomeProps {
	domains: number;
	readyDomains: number;
	mailboxes: number;
	users: number;
	keys: number;
}

const cards = [
	{
		href: "/domains",
		title: "Domains",
		icon: Globe,
		detail: (props: AdminHomeProps) =>
			props.domains === 0
				? "Enable a Cloudflare zone"
				: `${props.readyDomains} of ${props.domains} ready to send`,
	},
	{
		href: "/inbox/settings",
		title: "Mailboxes",
		icon: Inbox,
		detail: (props: AdminHomeProps) =>
			props.mailboxes === 0 ? "Create the first mailbox" : `${props.mailboxes} configured`,
	},
	{
		href: "/settings/users",
		title: "Team",
		icon: Users,
		detail: (props: AdminHomeProps) => `${props.users} ${props.users === 1 ? "person" : "people"}`,
	},
	{
		href: "/keys",
		title: "API keys",
		icon: Key,
		detail: (props: AdminHomeProps) => (props.keys === 0 ? "No active keys" : `${props.keys} active`),
	},
] as const;

export default function AdminHome(props: AdminHomeProps) {
	const next = props.domains === 0 ? cards[0] : props.mailboxes === 0 ? cards[1] : null;

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
			<div>
				<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Admin</p>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight">Workspace</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Domains, mailboxes, team, and API keys for this EmailFlare install.
				</p>
			</div>

			{next && (
				<Link
					href={next.href}
					className="block rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950"
				>
					Next: {next.detail(props)}.
				</Link>
			)}

			<div className="grid gap-3 sm:grid-cols-2">
				{cards.map((card) => {
					const Icon = card.icon;
					return (
						<Link
							key={card.href}
							href={card.href}
							className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
						>
							<div className="flex items-center gap-2">
								<Icon size={15} className="text-orange-600" />
								<h2 className="text-sm font-semibold">{card.title}</h2>
							</div>
							<p className="mt-2 text-xs text-muted-foreground">{card.detail(props)}</p>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
