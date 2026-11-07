"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
	ShieldOff,
	Settings,
	Radio,
	Menu,
	Search,
} from "lucide-react";
import api from "@/lib/api";
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

function NavItem({
	to,
	icon: Icon,
	label,
	badge,
	exact = false,
	onClick,
}: {
	to: string;
	icon: React.ElementType;
	label: string;
	badge?: number | string;
	exact?: boolean;
	onClick?: () => void;
}) {
	const pathname = usePathname();
	const active = exact || to === "/" ? pathname === to : pathname === to || pathname.startsWith(to + "/");
	return (
		<Link
			href={to}
			onClick={onClick}
			className={cn(
				"flex items-center gap-2.5 h-[34px] px-2.5 rounded-lg text-[13px] font-medium transition-colors",
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
	canAccessTester,
	isAdmin,
	onItemClick,
}: {
	activeDashboard: "inbox" | "api" | "admin";
	canAccessTester: boolean;
	isAdmin: boolean;
	onItemClick?: () => void;
}) {
	return (
		<>
			{/* ── CASE 1: INBOX DASHBOARD ── */}
			{activeDashboard === "inbox" && (
				<>
					<NavSection label="Mailboxes" />
					<NavItem to="/inbox" icon={Mail} label="All Inboxes" exact onClick={onItemClick} />

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

					<NavSection label="Workflows" />
					<NavItem to="/inbox/sequences" icon={ListOrdered} label="Sequences" onClick={onItemClick} />
					<NavItem to="/inbox/people" icon={Users} label="Contacts" onClick={onItemClick} />
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
					<NavItem to="/settings/users" icon={Users} label="Team Users" onClick={onItemClick} />
					<NavItem to="/inbox/settings" icon={Inbox} label="Mailboxes & Routing" onClick={onItemClick} />
					<NavItem to="/domains" icon={Globe} label="Domains & DNS" onClick={onItemClick} />
					<NavItem to="/keys" icon={Key} label="API Keys" onClick={onItemClick} />
				</>
			)}
		</>
	);
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function Layout({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const { user, loading, isAdmin, canAccessApi, canAccessTester } = usePermissions();
	const { connected } = useNotifications();

	const [commandOpen, setCommandOpen] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	// Determine active dashboard mode
	const isAdminPath =
		pathname.startsWith("/settings") ||
		pathname === "/inbox/settings" ||
		pathname.startsWith("/domains") ||
		pathname.startsWith("/keys");
	const isApiPath =
		pathname.startsWith("/developer") ||
		pathname.startsWith("/overview") ||
		pathname.startsWith("/logs") ||
		pathname.startsWith("/templates") ||
		pathname.startsWith("/playground") ||
		pathname.startsWith("/lists") ||
		pathname.startsWith("/suppressions");

	const activeDashboard: "inbox" | "api" | "admin" = isAdminPath ? "admin" : isApiPath ? "api" : "inbox";

	// Global Keyboard Shortcut: ⌘K or Ctrl+K to toggle Command Palette
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

					<div
						className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] text-zinc-500 font-medium"
						title={connected ? "Live notifications active" : "Reconnecting to live feed"}
					>
						<span
							className={cn(
								"size-1.5 rounded-full",
								connected ? "bg-emerald-500 animate-pulse" : "bg-amber-400",
							)}
						/>
						<span>{connected ? "Live" : "Connecting"}</span>
					</div>

					<div className="hidden md:block h-4 w-px bg-border mx-1" />

					{/* ── 3 Dashboards Switcher (Desktop / Tablet) ── */}
					<nav className="hidden md:flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 gap-0.5">
						{/* 1. Inbox Dashboard (Always available) */}
						<Link
							href="/inbox"
							className={cn(
								"flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium transition-all select-none",
								activeDashboard === "inbox"
									? "bg-white text-zinc-900 font-semibold shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
									: "text-zinc-500 hover:text-zinc-900 hover:bg-white/50 dark:text-zinc-400 dark:hover:text-zinc-200",
							)}
						>
							<Inbox size={13} className="shrink-0" />
							<span>Inbox</span>
						</Link>

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
								href="/settings/users"
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

				{/* Right: User Profile & Logout */}
				<div className="flex items-center gap-2 sm:gap-3">
					<div className="flex items-center gap-2 px-1.5 sm:px-2 py-1 rounded-lg">
						<div className="size-6 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center shrink-0">
							<span className="text-[10px] font-bold text-orange-700 dark:text-orange-300">
								{initials}
							</span>
						</div>
						<div className="hidden lg:flex flex-col text-left leading-none">
							<span className="text-[12px] font-semibold text-foreground truncate max-w-[130px]">
								{user?.name ?? "User"}
							</span>
							<span className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[130px]">
								{user?.email ?? ""}
							</span>
						</div>
						{isAdmin ? (
							<span className="text-[9px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 dark:bg-orange-950/60 dark:border-orange-800">
								admin
							</span>
						) : (
							<span className="text-[9px] font-medium text-zinc-600 bg-zinc-100 rounded px-1.5 py-0.5 dark:bg-zinc-800 dark:text-zinc-300">
								member
							</span>
						)}
					</div>

					<button
						onClick={handleLogout}
						title="Sign out"
						className="size-7 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
					>
						<LogOut size={14} />
					</button>
				</div>
			</header>

			{/* ── Main Application Area ── */}
			<div className="flex flex-1 overflow-hidden">
				{/* ── Contextual Left Sidebar (Desktop Only: md:flex) ── */}
				<aside className="hidden md:flex w-56 shrink-0 h-full flex-col border-r border-border bg-sidebar">
					<nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
						<DashboardNavLinks
							activeDashboard={activeDashboard}
							canAccessTester={canAccessTester}
							isAdmin={isAdmin}
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
						<div className="flex flex-col gap-1 p-1 bg-muted/50 rounded-lg">
							<Link
								href="/inbox"
								onClick={() => setMobileMenuOpen(false)}
								className={cn(
									"flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
									activeDashboard === "inbox"
										? "bg-white text-zinc-900 font-semibold shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
										: "text-zinc-500 hover:text-zinc-900",
								)}
							>
								<Inbox size={14} />
								<span>Inbox</span>
							</Link>

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
									href="/settings/users"
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
						</div>
					</div>

					{/* Mobile Contextual Nav Links */}
					<nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
						<DashboardNavLinks
							activeDashboard={activeDashboard}
							canAccessTester={canAccessTester}
							isAdmin={isAdmin}
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
