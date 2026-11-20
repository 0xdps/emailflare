import Link from "next/link";
import { Globe, Inbox, Key, ScrollText, Shield, Users, Radio } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/app/PageHeader";
import { TONE_STYLES } from "@/components/app/StatCard";
import { cn } from "@/lib/utils";

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
	{ href: "/settings/webhooks", title: "Webhooks", icon: Radio, detail: () => "Delivery event endpoints" },
	{ href: "/settings/audit", title: "Audit log", icon: ScrollText, detail: () => "Admin changes" },
	{ href: "/settings/security", title: "Security", icon: Shield, detail: () => "Authenticator and backup codes" },
] as const;

export default function AdminHome(props: AdminHomeProps) {
	const next = props.domains === 0 ? cards[0] : props.mailboxes === 0 ? cards[1] : null;

	return (
		<PageShell>
			<PageHeader
				eyebrow="Admin"
				title="Workspace"
				description="Domains, mailboxes, team, and API keys for this EmailFlare install."
			/>

			{next && (
				<Link
					href={next.href}
					className="block rounded-xl border border-primary/30 bg-primary-muted px-4 py-3 text-sm text-primary-muted-foreground transition-colors hover:bg-primary-muted/70"
				>
					Next: {next.detail(props)}.
				</Link>
			)}

			<div className="grid gap-3 sm:grid-cols-2">
				{cards.map((card) => {
					const Icon = card.icon;
					return (
						<Link key={card.href} href={card.href} className="group/card-link block">
							<Card className="h-full transition-colors group-hover/card-link:bg-muted/40">
								<CardContent className="space-y-2">
									<div className="flex items-center gap-2">
										<span
											className={cn(
												"flex size-6 items-center justify-center rounded-md",
												TONE_STYLES.brand.chip,
											)}
										>
											<Icon className="size-3.5" />
										</span>
										<h2 className="text-sm font-semibold">{card.title}</h2>
									</div>
									<p className="text-xs text-muted-foreground">{card.detail(props)}</p>
								</CardContent>
							</Card>
						</Link>
					);
				})}
			</div>
		</PageShell>
	);
}
