"use client";

import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	LayoutDashboard,
	Globe,
	FileText,
	Key,
	ScrollText,
	LogOut,
	FlaskConical,
	BookOpen,
	Github,
	ExternalLink,
	Inbox,
	Users,
	ListOrdered,
	Mail,
	PenLine,
	ShieldOff,
	Settings,
	Radio,
	Menu,
	Search,
} from "lucide-react";
import api, { getInboxes, type Inbox as InboxType } from "@/lib/api";
import { usePermissions } from "@/lib/UserContext";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import CommandPalette from "@/components/CommandPalette";

// ─── Logo ─────────────────────────────────────────────────────────────────────

function AppLogo({ size = 26 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<linearGradient id="ef-bg" x1="0" y1="1" x2="1" y2="0">
					<stop offset="0%" stopColor="#9a3412" />
					<stop offset="55%" stopColor="#ea580c" />
					<stop offset="100%" stopColor="#fb923c" />
				</linearGradient>
			</defs>
			<rect width="64" height="64" rx="14" fill="url(#ef-bg)" />
			<path d="M53 11 L9 28 L23 38 Z" fill="white" />
			<path d="M53 11 L23 38 L9 53 Z" fill="white" opacity="0.82" />
		</svg>
	);
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem(props: {
	to: string;
	icon: React.ElementType;
	label: string;
	badge?: number | string;
	exact?: boolean;
	onClick?: () => void;
}) {
	return (
		<Suspense fallback={<NavItemView {...props} search="" />}>
			<NavItemWithSearch {...props} />
		</Suspense>
	);
}

function NavItemWithSearch(props: React.ComponentProps<typeof NavItemView>) {
	return <NavItemView {...props} search={useSearchParams().toString()} />;
}

function NavItemView({
	to,
	icon: Icon,
	label,
	badge,
	exact = false,
	onClick,
	search,
}: {
	to: string;
	icon: React.ElementType;
	label: string;
	badge?: number | string;
	exact?: boolean;
	onClick?: () => void;
	search: string;
}) {
	const pathname = usePathname();
	const [path, query] = to.split("?");
	const current = new URLSearchParams(search);
	const expected = new URLSearchParams(query ?? "");
	const active = query
		? pathname === path && [...expected.keys()].every((key) => current.get(key) === expected.get(key))
		: (exact || path === "/" ? pathname === path : pathname === path || pathname.startsWith(path + "/")) &&
			!current.has("mailbox");
	return (
		<Link
			href={to}
			onClick={onClick}
			className={cn(
				"flex shrink-0 items-center gap-2.5 h-8.5 px-2.5 rounded-lg text-[13px] font-medium transition-colors",
				active
					? "text-orange-700 bg-orange-50 font-semibold dark:bg-orange-950/40 dark:text-orange-300"
					: "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/60",
			)}
		>
			<Icon size={15} className="shrink-0" />
			<span className="flex-1 truncate">{label}</span>
			{badge !== undefined && (
				<span className="text-[10px] font-semibold bg-orange-500 text-white rounded-full min-w-[16px] h-[15px] flex items-center justify-center px-1 tabular-nums">
					{badge}
				</span>
			)}
		</Link>
	);
}

function NavDivider() {
	return <div className="h-px bg-border mx-2 my-2" />;
}

function NavSection({ label }: { label: string }) {
	return (
		<p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider select-none">
			{label}
		</p>
	);
}

function DashboardNavLinks({
	activeDashboard,
	canAccessInbox = true,
	canAccessTester,
	isAdmin,
	mailboxes = [],
	onItemClick,
}: {
	activeDashboard: "inbox" | "api" | "admin";
	canAccessInbox?: boolean;
	canAccessTester: boolean;
	isAdmin: boolean;
	mailboxes?: InboxType[];
	onItemClick?: () => void;
}) {
	return (
		<>
			{/* ── CASE 1: INBOX DASHBOARD ── */}
			{activeDashboard === "inbox" && (
				<>
					{canAccessInbox && (
						<div className="flex min-h-0 flex-1 flex-col">
							<NavSection label="Inbox" />
							<button
								type="button"
								onClick={() => {
									onItemClick?.();
									window.dispatchEvent(new CustomEvent("emailflare:compose"));
								}}
								className="flex h-8.5 w-full shrink-0 items-center gap-2.5 rounded-lg bg-orange-600 px-2.5 text-[13px] font-medium text-white hover:bg-orange-700"
							>
								<PenLine size={14} />
								Compose
							</button>
							<NavItem to="/inbox" icon={Mail} label="All mailboxes" exact onClick={onItemClick} />
							<div className="mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain">
								{mailboxes.map((mailbox) => (
									<NavItem
										key={mailbox.id}
										to={`/inbox?mailbox=${mailbox.email}`}
										icon={Inbox}
										label={mailbox.display_name || mailbox.email}
										onClick={onItemClick}
									/>
								))}
							</div>
						</div>
					)}

					{canAccessTester && (
						<>
							<NavSection label="Testing" />
							<NavItem
								to="/inbox?folder=test"
								icon={FlaskConical}
								label="Test Mailbox"
								onClick={onItemClick}
							/>
						</>
					)}

					{canAccessInbox && (
						<>
							<NavSection label="Workflows" />
							<NavItem to="/inbox/sequences" icon={ListOrdered} label="Sequences" onClick={onItemClick} />
							<NavItem to="/inbox/people" icon={Users} label="Contacts" onClick={onItemClick} />
						</>
					)}
				</>
			)}

			{/* ── CASE 2: API DASHBOARD ── */}
			{activeDashboard === "api" && (
				<>
					<NavSection label="Delivery" />
					<NavItem
						to="/developer/overview"
						exact
						icon={LayoutDashboard}
						label="Overview"
						onClick={onItemClick}
					/>
					<NavItem to="/developer/logs" icon={ScrollText} label="Activity Logs" onClick={onItemClick} />
					<NavItem to="/developer/templates" icon={FileText} label="Templates" onClick={onItemClick} />
					<NavItem to="/developer/playground" icon={FlaskConical} label="Playground" onClick={onItemClick} />

					<NavDivider />
					<NavSection label="Audiences & Lists" />
					<NavItem to="/developer/lists" icon={Users} label="Audiences" onClick={onItemClick} />
					<NavItem to="/developer/suppressions" icon={ShieldOff} label="Suppressions" onClick={onItemClick} />
				</>
			)}

			{/* ── CASE 3: ADMIN DASHBOARD ── */}
			{activeDashboard === "admin" && (
				<>
					<NavSection label="Administration" />
					<NavItem to="/settings" icon={Settings} label="Workspace" exact onClick={onItemClick} />
					<NavItem to="/domains" icon={Globe} label="Domains" onClick={onItemClick} />
					<NavItem to="/inbox/settings" icon={Inbox} label="Mailboxes" onClick={onItemClick} />
					<NavItem to="/settings/users" icon={Users} label="Team" onClick={onItemClick} />
					<NavItem to="/keys" icon={Key} label="API keys" onClick={onItemClick} />
				</>
			)}
		</>
	);
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function Layout({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const { user, loading, isVerified, isAdmin, canAccessApi, canAccessTester, canAccessInbox } = usePermissions();
	const { connected } = useNotifications();

	const [commandOpen, setCommandOpen] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [mailboxes, setMailboxes] = useState<InboxType[]>([]);
	const [tokenActive, setTokenActive] = useState<boolean | null>(null);

	useEffect(() => {
		if (!isAdmin) return;
		api.get<{ active: boolean }>("/api/cloudflare/status")
			.then((res) => setTokenActive(res.data.active))
			.catch(() => setTokenActive(false));
	}, [isAdmin]);

	// Determine active dashboard mode
	const isAdminPath =
		pathname.startsWith("/settings") ||
		pathname === "/inbox/settings" ||
		pathname.startsWith("/domains") ||
		pathname.startsWith("/keys");
	const isApiPath = pathname.startsWith("/developer");

	const activeDashboard: "inbox" | "api" | "admin" = isAdminPath ? "admin" : isApiPath ? "api" : "inbox";

	// Global Keyboard Shortcut: ⌘K or Ctrl+K to toggle Command Palette
	useEffect(() => {
		if (activeDashboard !== "inbox" || !canAccessInbox) return;
		getInboxes()
			.then(setMailboxes)
			.catch(() => setMailboxes([]));
	}, [activeDashboard, canAccessInbox]);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setCommandOpen((prev) => !prev);
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	async function handleLogout() {
		await api.post("/api/auth/logout").catch((err) => {
			console.error("[layout] logout failed:", err);
		});
		router.replace("/login");
	}

	const initials = user?.name
		? user.name
				.split(" ")
				.map((s) => s[0])
				.join("")
				.slice(0, 2)
				.toUpperCase()
		: "?";

	if (loading && !user) {
		return (
			<div className="flex flex-col h-screen bg-background overflow-hidden">
				<div className="h-13 border-b border-border bg-background px-4 flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<div className="size-7 rounded-lg bg-orange-100 animate-pulse" />
						<div className="h-4 w-24 bg-zinc-100 rounded animate-pulse" />
					</div>
					<div className="flex gap-2">
						<div className="h-8 w-24 bg-zinc-100 rounded-lg animate-pulse" />
						<div className="h-8 w-24 bg-zinc-100 rounded-lg animate-pulse" />
					</div>
				</div>
				<div className="flex flex-1 overflow-hidden">
					<div className="w-56 border-r border-border bg-sidebar p-3 space-y-2">
						{Array.from({ length: 6 }).map((_, i) => (
							<div key={i} className="h-8 bg-zinc-100 rounded-lg animate-pulse" />
						))}
					</div>
					<div className="flex-1 bg-background" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen bg-background overflow-hidden">
			{/* ── Top Header / Dashboard Switcher ── */}
			<header className="h-13 border-b border-border bg-background/95 backdrop-blur shrink-0 px-3 sm:px-4 flex items-center justify-between z-20">
				{/* Left: Hamburger (Mobile) + Brand + Live WebSocket */}
				<div className="flex items-center gap-2 sm:gap-3">
					{/* Mobile Menu Drawer Button */}
					<button
						type="button"
						onClick={() => setMobileMenuOpen(true)}
						className="md:hidden size-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
						aria-label="Open mobile navigation menu"
					>
						<Menu size={18} />
					</button>

					<Link href="/inbox" className="flex items-center gap-2 sm:gap-2.5 group">
						<AppLogo size={26} />
						<span className="text-[14px] font-bold tracking-tight text-foreground group-hover:text-orange-600 transition-colors hidden xs:inline">
							EmailFlare
						</span>
					</Link>

					{/* ── 3 Dashboards Switcher (Desktop / Tablet) ── */}
					<nav className="hidden md:flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 gap-0.5 min-h-[30px]">
						{!isVerified ? null : (
							<>
								{/* 1. Inbox Dashboard */}
								{(canAccessInbox || canAccessTester) && (
									<Link
										href={canAccessInbox ? "/inbox" : "/inbox?folder=test"}
										className={cn(
											"flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium transition-all select-none",
											activeDashboard === "inbox"
												? "bg-white text-zinc-900 font-semibold shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
												: "text-zinc-500 hover:text-zinc-900 hover:bg-white/50 dark:text-zinc-400 dark:hover:text-zinc-200",
										)}
									>
										<Inbox size={13} className="shrink-0" />
										<span>{canAccessInbox ? "Inbox" : "Test Mailbox"}</span>
									</Link>
								)}

								{/* 2. API Dashboard (Available if canAccessApi) */}
								{canAccessApi && (
									<Link
										href="/developer/overview"
										className={cn(
											"flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium transition-all select-none",
											activeDashboard === "api"
												? "bg-white text-zinc-900 font-semibold shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
												: "text-zinc-500 hover:text-zinc-900 hover:bg-white/50 dark:text-zinc-400 dark:hover:text-zinc-200",
										)}
									>
										<Radio size={13} className="shrink-0 text-orange-500" />
										<span>API</span>
									</Link>
								)}

								{/* 3. Admin Dashboard (Available only to admins) */}
								{isAdmin && (
									<Link
										href="/settings"
										className={cn(
											"flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium transition-all select-none",
											activeDashboard === "admin"
												? "bg-white text-zinc-900 font-semibold shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
												: "text-zinc-500 hover:text-zinc-900 hover:bg-white/50 dark:text-zinc-400 dark:hover:text-zinc-200",
										)}
									>
										<Settings size={13} className="shrink-0" />
										<span>Admin</span>
									</Link>
								)}
							</>
						)}
					</nav>
				</div>

				{/* Center: Command Palette Trigger Pill */}
				<div className="flex items-center">
					<button
						type="button"
						onClick={() => setCommandOpen(true)}
						className="hidden sm:flex items-center gap-2 h-8 px-2.5 rounded-lg border border-border/80 bg-muted/40 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
					>
						<Search size={13} className="shrink-0" />
						<span className="truncate">Search or jump to...</span>
						<kbd className="ml-1 px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px] text-muted-foreground/80">
							⌘K
						</kbd>
					</button>

					<button
						type="button"
						onClick={() => setCommandOpen(true)}
						className="sm:hidden size-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
						title="Search or jump to (⌘K)"
					>
						<Search size={16} />
					</button>
				</div>

				{/* Right: Profile menu */}
				<div className="relative group/profile">
					<button
						type="button"
						className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
						aria-haspopup="menu"
						aria-label="Account menu"
					>
						<span className="relative size-7 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center shrink-0">
							<span className="text-[10px] font-bold text-orange-700 dark:text-orange-300">
								{initials}
							</span>
							<span
								className={cn(
									"absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-background",
									connected ? "bg-emerald-500" : "bg-amber-400",
								)}
							/>
						</span>
						<span className="hidden lg:block text-left leading-none">
							<span className="block text-[12px] font-semibold text-foreground truncate max-w-[130px]">
								{user?.name ?? "User"}
							</span>
							<span className="block text-[10px] text-muted-foreground mt-0.5 truncate max-w-[130px]">
								{user?.email ?? ""}
							</span>
						</span>
					</button>
					<div className="invisible absolute right-0 top-full z-30 w-60 pt-1 opacity-0 transition-opacity group-hover/profile:visible group-hover/profile:opacity-100 group-focus-within/profile:visible group-focus-within/profile:opacity-100">
						<div
							className="rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
							role="menu"
						>
							<div className="px-2 py-1.5">
								<p className="truncate text-[12px] font-semibold">{user?.name ?? "User"}</p>
								<p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
								<span
									className={cn(
										"mt-1.5 inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold",
										isAdmin
											? "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-300"
											: "border-border bg-muted text-muted-foreground",
									)}
								>
									{isAdmin ? "Admin" : "Member"}
								</span>
							</div>
							<div className="mx-2 my-1 h-px bg-border" />
							<div className="px-2 py-1.5">
								<p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
									Status
								</p>
								<p className="flex items-center gap-2 py-1 text-[12px] text-muted-foreground">
									<span
										className={cn(
											"size-1.5 rounded-full",
											connected ? "bg-emerald-500" : "bg-amber-400",
										)}
									/>
									{connected ? "Notifications live" : "Notifications reconnecting"}
								</p>
								{isAdmin && (
									<p className="flex items-center gap-2 py-1 text-[12px] text-muted-foreground">
										<span
											className={cn(
												"size-1.5 rounded-full",
												tokenActive === null
													? "bg-zinc-300"
													: tokenActive
														? "bg-emerald-500"
														: "bg-red-500",
											)}
										/>
										{tokenActive === null
											? "Cloudflare token checking"
											: tokenActive
												? "Cloudflare token active"
												: "Cloudflare token inactive"}
									</p>
								)}
							</div>
							<button
								type="button"
								onClick={handleLogout}
								className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
								role="menuitem"
							>
								<LogOut size={13} />
								Sign out
							</button>
						</div>
					</div>
				</div>
			</header>

			{/* ── Main Application Area ── */}
			<div className="flex flex-1 overflow-hidden">
				{/* ── Contextual Left Sidebar (Desktop Only: md:flex) ── */}
				<aside className="hidden md:flex w-56 shrink-0 h-full flex-col border-r border-border bg-sidebar">
					<nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden px-2 py-3">
						<DashboardNavLinks
							activeDashboard={activeDashboard}
							canAccessInbox={canAccessInbox}
							canAccessTester={canAccessTester}
							isAdmin={isAdmin}
							mailboxes={mailboxes}
						/>
					</nav>

					{/* ── Sidebar Footer (Docs & GitHub) ── */}
					<div className="border-t border-border px-2 py-2 shrink-0">
						<a
							href="https://emailflare.dev/docs"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2.5 h-[32px] px-2.5 rounded-md text-[12px] font-medium text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
						>
							<BookOpen size={13} className="shrink-0" />
							<span className="flex-1">API Docs</span>
							<ExternalLink size={10} className="opacity-50" />
						</a>
						<a
							href="https://github.com/0xdps/emailflare"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2.5 h-[32px] px-2.5 rounded-md text-[12px] font-medium text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
						>
							<Github size={13} className="shrink-0" />
							<span className="flex-1">GitHub</span>
							<ExternalLink size={10} className="opacity-50" />
						</a>
					</div>
				</aside>

				{/* ── Dashboard Content ── */}
				<main className="flex-1 overflow-y-auto min-h-0 bg-background">{children}</main>
			</div>

			{/* ── Mobile Navigation Drawer (Sheet) ── */}
			<Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
				<SheetContent side="left" className="w-[280px] p-0 flex flex-col h-full bg-sidebar">
					<SheetHeader className="px-4 py-3.5 border-b border-border flex flex-row items-center justify-between">
						<div className="flex items-center gap-2.5">
							<AppLogo size={24} />
							<span className="text-sm font-bold tracking-tight text-foreground">EmailFlare</span>
						</div>
					</SheetHeader>

					{/* Mobile Dashboard Switcher */}
					<div className="px-3 pt-3">
						<p className="px-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
							Dashboard
						</p>
						<div className="flex flex-col gap-1 p-1 bg-muted/50 rounded-lg min-h-[36px]">
							{!isVerified ? null : (
								<>
									{(canAccessInbox || canAccessTester) && (
										<Link
											href={canAccessInbox ? "/inbox" : "/inbox?folder=test"}
											onClick={() => setMobileMenuOpen(false)}
											className={cn(
												"flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
												activeDashboard === "inbox"
													? "bg-white text-zinc-900 font-semibold shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
													: "text-zinc-500 hover:text-zinc-900",
											)}
										>
											<Inbox size={14} />
											<span>{canAccessInbox ? "Inbox" : "Test Mailbox"}</span>
										</Link>
									)}

									{canAccessApi && (
										<Link
											href="/developer/overview"
											onClick={() => setMobileMenuOpen(false)}
											className={cn(
												"flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
												activeDashboard === "api"
													? "bg-white text-zinc-900 font-semibold shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
													: "text-zinc-500 hover:text-zinc-900",
											)}
										>
											<Radio size={14} className="text-orange-500" />
											<span>API Dashboard</span>
										</Link>
									)}

									{isAdmin && (
										<Link
											href="/settings"
											onClick={() => setMobileMenuOpen(false)}
											className={cn(
												"flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
												activeDashboard === "admin"
													? "bg-white text-zinc-900 font-semibold shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
													: "text-zinc-500 hover:text-zinc-900",
											)}
										>
											<Settings size={14} />
											<span>Admin</span>
										</Link>
									)}
								</>
							)}
						</div>
					</div>

					{/* Mobile Contextual Nav Links */}
					<nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden px-2 py-3">
						<DashboardNavLinks
							activeDashboard={activeDashboard}
							canAccessInbox={canAccessInbox}
							canAccessTester={canAccessTester}
							isAdmin={isAdmin}
							mailboxes={mailboxes}
							onItemClick={() => setMobileMenuOpen(false)}
						/>
					</nav>

					{/* Mobile Drawer Footer */}
					<div className="border-t border-border p-3 space-y-2 bg-sidebar shrink-0">
						<div className="flex items-center justify-between px-1">
							<div className="flex items-center gap-2 min-w-0">
								<div className="size-6 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center shrink-0">
									<span className="text-[10px] font-bold text-orange-700 dark:text-orange-300">
										{initials}
									</span>
								</div>
								<div className="min-w-0">
									<div className="text-xs font-medium text-foreground truncate">{user?.name}</div>
									<div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
								</div>
							</div>
							<button
								onClick={handleLogout}
								className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1"
							>
								Sign out
							</button>
						</div>

						<div className="flex items-center justify-around pt-2 border-t border-border/50 text-xs text-muted-foreground">
							<a
								href="https://emailflare.dev/docs"
								target="_blank"
								rel="noopener noreferrer"
								className="hover:text-foreground"
							>
								API Docs
							</a>
							<span>·</span>
							<a
								href="https://github.com/0xdps/emailflare"
								target="_blank"
								rel="noopener noreferrer"
								className="hover:text-foreground"
							>
								GitHub
							</a>
						</div>
					</div>
				</SheetContent>
			</Sheet>

			{/* ── Global Command Palette (⌘K) ── */}
			<CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
		</div>
	);
}
