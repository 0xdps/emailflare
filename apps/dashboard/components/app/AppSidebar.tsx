"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, ChevronsUpDown, Github, Check, PenLine, Inbox as InboxIcon } from "lucide-react";
import AppLogo from "@/components/AppLogo";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import type { Inbox, ThreadCounts } from "@/lib/api";
import {
	ADMIN_NAV,
	API_NAV,
	INBOX_TEST,
	INBOX_VIEWS,
	INBOX_WORKFLOWS,
	WORKSPACES,
	isNavActive,
	type NavContext,
	type NavGroup,
	type NavItem,
	type Workspace,
} from "@/lib/nav/config";

interface AppSidebarProps {
	workspace: Workspace;
	available: Workspace[];
	canAccessInbox: boolean;
	canAccessTester: boolean;
	mailboxes: Inbox[];
	counts: ThreadCounts;
}

const ACTIVE_ICON = "data-active:[&>svg]:text-primary";

function useNavContext(): NavContext {
	const pathname = usePathname();
	const params = useSearchParams();
	return { pathname, params: new URLSearchParams(params.toString()) };
}

function NavLink({ item, ctx, badge }: { item: NavItem; ctx: NavContext; badge?: number }) {
	const { setOpenMobile } = useSidebar();
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				isActive={isNavActive(item, ctx)}
				tooltip={item.title}
				className={ACTIVE_ICON}
				render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
			>
				<item.icon />
				<span>{item.title}</span>
			</SidebarMenuButton>
			{badge ? <SidebarMenuBadge className="text-primary">{badge > 99 ? "99+" : badge}</SidebarMenuBadge> : null}
		</SidebarMenuItem>
	);
}

function NavGroups({ groups, ctx }: { groups: NavGroup[]; ctx: NavContext }) {
	return (
		<>
			{groups.map((group) => (
				<SidebarGroup key={group.label}>
					{group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
					<SidebarGroupContent>
						<SidebarMenu>
							{group.items.map((item) => (
								<NavLink key={item.href} item={item} ctx={ctx} />
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			))}
		</>
	);
}

function withMailbox(href: string, mailbox: string | null) {
	if (!mailbox) return href;
	const [path, query = ""] = href.split("?");
	const params = new URLSearchParams(query);
	params.set("mailbox", mailbox);
	return `${path}?${params.toString()}`;
}

/** Choose which mailbox the inbox views are filtered to; the active view is preserved. */
function MailboxPicker({
	mailboxes,
	counts,
	ctx,
}: Pick<AppSidebarProps, "mailboxes" | "counts"> & { ctx: NavContext }) {
	const router = useRouter();
	const { setOpenMobile } = useSidebar();
	const selected = ctx.params.get("mailbox") ?? "";
	const current = mailboxes.find((m) => m.email === selected);
	const label = current ? current.display_name || current.email : "All mailboxes";

	function pick(email: string) {
		const params = new URLSearchParams(ctx.params.toString());
		params.delete("folder");
		if (email) params.set("mailbox", email);
		else params.delete("mailbox");
		const query = params.toString();
		setOpenMobile(false);
		router.push(query ? `/inbox?${query}` : "/inbox");
	}

	if (mailboxes.length === 0) return null;

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								tooltip={label}
								className="border border-sidebar-border bg-background/60 shadow-xs data-open:bg-sidebar-accent"
							/>
						}
					>
						<InboxIcon />
						<span className="flex-1 truncate">{label}</span>
						<ChevronsUpDown className="ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-60">
						<DropdownMenuGroup>
							<DropdownMenuLabel>Mailbox</DropdownMenuLabel>
							<DropdownMenuRadioGroup value={selected} onValueChange={(v) => pick(String(v))}>
								<DropdownMenuRadioItem value="">
									<span className="flex-1">All mailboxes</span>
									{counts.unread > 0 && (
										<span className="text-xs text-primary tabular-nums">{counts.unread}</span>
									)}
								</DropdownMenuRadioItem>
								{mailboxes.map((mailbox) => (
									<DropdownMenuRadioItem key={mailbox.id} value={mailbox.email}>
										<span className="grid flex-1 leading-tight">
											<span className="truncate">{mailbox.display_name || mailbox.email}</span>
											{mailbox.display_name && (
												<span className="truncate text-2xs text-muted-foreground">
													{mailbox.email}
												</span>
											)}
										</span>
										{(counts.perInbox[mailbox.email] ?? 0) > 0 && (
											<span className="text-xs text-primary tabular-nums">
												{counts.perInbox[mailbox.email]}
											</span>
										)}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

function InboxNav({
	ctx,
	mailboxes,
	counts,
	canAccessInbox,
	canAccessTester,
}: Pick<AppSidebarProps, "mailboxes" | "counts" | "canAccessInbox" | "canAccessTester"> & { ctx: NavContext }) {
	const { setOpenMobile } = useSidebar();
	const mailbox = ctx.params.get("mailbox");
	const viewBadge: Record<string, number> = { Inbox: counts.unread, Starred: counts.starred };

	return (
		<>
			{canAccessInbox && (
				<>
					<SidebarGroup className="pb-0">
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip="Compose"
									className="h-9 justify-center group-data-[collapsible=icon]:size-8! bg-primary font-medium text-primary-foreground shadow-xs hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground group-data-[collapsible=icon]:justify-center"
									onClick={() => {
										setOpenMobile(false);
										window.dispatchEvent(new CustomEvent("emailflare:compose"));
									}}
								>
									<PenLine />
									<span className="group-data-[collapsible=icon]:hidden">Compose</span>
									<Kbd className="ml-auto bg-primary-foreground/15 text-primary-foreground group-data-[collapsible=icon]:hidden">
										C
									</Kbd>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroup>

					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								{INBOX_VIEWS.map((item) => (
									<NavLink
										key={item.href}
										item={{ ...item, href: withMailbox(item.href, mailbox) }}
										ctx={ctx}
										badge={viewBadge[item.title]}
									/>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>

					<SidebarGroup className="py-0">
						<MailboxPicker mailboxes={mailboxes} counts={counts} ctx={ctx} />
					</SidebarGroup>

					<NavGroups groups={[{ label: "Workflows", items: INBOX_WORKFLOWS }]} ctx={ctx} />
				</>
			)}
			{canAccessTester && <NavGroups groups={[{ label: "Testing", items: [INBOX_TEST] }]} ctx={ctx} />}
		</>
	);
}

function WorkspaceSwitcher({ workspace, available }: Pick<AppSidebarProps, "workspace" | "available">) {
	const current = WORKSPACES[workspace];
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								size="lg"
								className="data-open:bg-sidebar-accent group-data-[collapsible=icon]:justify-center"
								tooltip="Switch workspace"
							/>
						}
					>
						<AppLogo size={28} />
						<div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
							<span className="truncate text-sm font-semibold tracking-tight">EmailFlare</span>
							<span className="truncate text-2xs text-muted-foreground">{current.label}</span>
						</div>
						<ChevronsUpDown className="ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-60">
						<DropdownMenuGroup>
							<DropdownMenuLabel>Workspaces</DropdownMenuLabel>
							{available.map((id) => {
								const ws = WORKSPACES[id];
								return (
									<DropdownMenuItem key={id} render={<Link href={ws.home} />} className="gap-3 py-2">
										<span className="flex size-7 items-center justify-center rounded-md border bg-background">
											<ws.icon className="size-4" />
										</span>
										<span className="grid flex-1 leading-tight">
											<span className="text-sm font-medium">{ws.label}</span>
											<span className="text-2xs text-muted-foreground">{ws.description}</span>
										</span>
										{id === workspace && <Check className="size-4 text-primary" />}
									</DropdownMenuItem>
								);
							})}
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

export default function AppSidebar(props: AppSidebarProps) {
	const ctx = useNavContext();
	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<WorkspaceSwitcher workspace={props.workspace} available={props.available} />
			</SidebarHeader>

			<SidebarContent>
				{props.workspace === "inbox" && (
					<InboxNav
						ctx={ctx}
						mailboxes={props.mailboxes}
						counts={props.counts}
						canAccessInbox={props.canAccessInbox}
						canAccessTester={props.canAccessTester}
					/>
				)}
				{props.workspace === "api" && <NavGroups groups={API_NAV} ctx={ctx} />}
				{props.workspace === "admin" && <NavGroups groups={ADMIN_NAV} ctx={ctx} />}
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="sm"
							tooltip="API docs"
							render={<a href="https://emailflare.dev/docs" target="_blank" rel="noopener noreferrer" />}
						>
							<BookOpen />
							<span>API docs</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="sm"
							tooltip="GitHub"
							render={
								<a
									href="https://github.com/0xdps/emailflare"
									target="_blank"
									rel="noopener noreferrer"
								/>
							}
						>
							<Github />
							<span>GitHub</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
