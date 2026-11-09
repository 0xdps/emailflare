"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
	Search,
	Mail,
	Inbox,
	FlaskConical,
	Users,
	ListOrdered,
	LayoutDashboard,
	ScrollText,
	FileText,
	Globe,
	Key,
	ShieldOff,
	Settings,
	BookOpen,
	Github,
	CornerDownLeft,
	ArrowRight,
	ExternalLink,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { usePermissions } from "@/lib/UserContext";
import { cn } from "@/lib/utils";

interface CommandItem {
	id: string;
	title: string;
	subtitle?: string;
	category: string;
	icon: React.ElementType;
	href?: string;
	shortcut?: string;
	external?: boolean;
	keywords?: string[];
	action?: () => void;
}

interface CommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
	const router = useRouter();
	const { isAdmin, canAccessApi, canAccessTester, canAccessInbox } = usePermissions();
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const listRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Reset state when opening/closing
	useEffect(() => {
		if (open) {
			setQuery("");
			setSelectedIndex(0);
			setTimeout(() => inputRef.current?.focus(), 50);
		}
	}, [open]);

	// Build available commands list based on RBAC permissions
	const commands = useMemo<CommandItem[]>(() => {
		const items: CommandItem[] = [];

		// ── Inbox Dashboard ──
		if (canAccessInbox) {
			items.push(
				{
					id: "inbox-all",
					title: "Inbox",
					subtitle: "Conversations across your mailboxes",
					category: "Inbox",
					icon: Mail,
					href: "/inbox",
					shortcut: "G I",
					keywords: ["messages", "threads", "conversations", "email"],
				},
				{
					id: "inbox-contacts",
					title: "Contacts",
					subtitle: "People you have emailed with",
					category: "Inbox",
					icon: Users,
					href: "/inbox/people",
					keywords: ["people", "customers", "crm", "contacts"],
				},
				{
					id: "inbox-sequences",
					title: "Sequences",
					subtitle: "Follow-up emails sent on a schedule",
					category: "Inbox",
					icon: ListOrdered,
					href: "/inbox/sequences",
					keywords: ["campaigns", "outreach", "drip", "automation"],
				},
			);
		}

		// Sandbox Test Mailbox (tester additive permission)
		if (canAccessTester) {
			items.push({
				id: "inbox-test",
				title: "Test Mailbox (Sandbox)",
				subtitle: "Inspect captured sandbox test emails",
				category: "Inbox",
				icon: FlaskConical,
				href: "/inbox?folder=test",
				shortcut: "G T",
				keywords: ["sandbox", "testing", "preview", "virtual", "qa"],
			});
		}

		// API Dashboard (api additive permission)
		if (canAccessApi) {
			items.push(
				{
					id: "api-overview",
					title: "API Overview & Telemetry",
					subtitle: "Deliverability health, metrics, and traffic overview",
					category: "API Dashboard",
					icon: LayoutDashboard,
					href: "/developer/overview",
					shortcut: "G D",
					keywords: ["dashboard", "metrics", "analytics", "stats", "graph"],
				},
				{
					id: "api-logs",
					title: "Activity Logs",
					subtitle: "Audit log of all sent & received emails with inspector",
					category: "API Dashboard",
					icon: ScrollText,
					href: "/developer/logs",
					shortcut: "G L",
					keywords: ["events", "deliverability", "history", "audit", "trace"],
				},
				{
					id: "api-playground",
					title: "Interactive Playground",
					subtitle: "Test transactional sending with live code snippets",
					category: "API Dashboard",
					icon: FlaskConical,
					href: "/developer/playground",
					shortcut: "G P",
					keywords: ["send", "test", "curl", "snippet", "developer"],
				},
				{
					id: "api-templates",
					title: "Email Templates",
					subtitle: "Manage transactional and markdown email templates",
					category: "API Dashboard",
					icon: FileText,
					href: "/developer/templates",
					keywords: ["html", "designs", "transactional", "layouts"],
				},
				{
					id: "api-lists",
					title: "Audiences & Unsubscribe Lists",
					subtitle: "RFC 8058 one-click unsubscribe headers & lists",
					category: "API Dashboard",
					icon: Users,
					href: "/developer/lists",
					keywords: ["subscribers", "opt-out", "unsubscribe", "audience"],
				},
				{
					id: "api-suppressions",
					title: "Suppressions & Bounces",
					subtitle: "Blocked recipients, bounces, and complaint suppressions",
					category: "API Dashboard",
					icon: ShieldOff,
					href: "/developer/suppressions",
					keywords: ["blacklist", "bounced", "spam", "blocked"],
				},
			);
		}

		// Admin Dashboard (admin user type only)
		if (isAdmin) {
			items.push(
				{
					id: "admin-home",
					title: "Workspace",
					subtitle: "Domains, mailboxes, team, and API keys",
					category: "Administration",
					icon: Settings,
					href: "/settings",
					keywords: ["admin", "home", "setup", "workspace"],
				},
				{
					id: "admin-users",
					title: "Team",
					subtitle: "Invite people and set what they can open",
					category: "Administration",
					icon: Users,
					href: "/settings/users",
					shortcut: "G U",
					keywords: ["team", "roles", "members", "invite", "permissions", "rbac"],
				},
				{
					id: "admin-inboxes",
					title: "Mailboxes",
					subtitle: "Addresses that receive mail, and who can open them",
					category: "Administration",
					icon: Inbox,
					href: "/inbox/settings",
					keywords: ["routing", "inboxes", "assign", "workers", "cloudflare"],
				},
				{
					id: "admin-domains",
					title: "Domains",
					subtitle: "Enable a Cloudflare zone for sending and receiving",
					category: "Administration",
					icon: Globe,
					href: "/domains",
					keywords: ["dns", "dkim", "spf", "dmarc", "cloudflare", "routing"],
				},
				{
					id: "admin-keys",
					title: "API keys",
					subtitle: "Manage live and test API secret credentials",
					category: "Administration",
					icon: Key,
					href: "/keys",
					shortcut: "G K",
					keywords: ["tokens", "secrets", "auth", "credentials", "bearer"],
				},
			);
		}

		// Documentation & External
		items.push(
			{
				id: "docs-api",
				title: "API Documentation",
				subtitle: "Browse endpoints, SDKs, and webhook guides",
				category: "Help & Resources",
				icon: BookOpen,
				href: "https://emailflare.dev/docs",
				external: true,
				keywords: ["docs", "guide", "sdk", "help", "reference"],
			},
			{
				id: "docs-github",
				title: "EmailFlare GitHub Repository",
				subtitle: "Source code, releases, and discussions",
				category: "Help & Resources",
				icon: Github,
				href: "https://github.com/0xdps/emailflare",
				external: true,
				keywords: ["git", "repo", "source", "issues", "releases"],
			},
		);

		return items;
	}, [isAdmin, canAccessApi, canAccessTester]);

	// Filter commands based on query string
	const filteredCommands = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return commands;
		return commands.filter((cmd) => {
			if (cmd.title.toLowerCase().includes(q)) return true;
			if (cmd.subtitle?.toLowerCase().includes(q)) return true;
			if (cmd.category.toLowerCase().includes(q)) return true;
			if (cmd.keywords?.some((kw) => kw.toLowerCase().includes(q))) return true;
			return false;
		});
	}, [commands, query]);

	// Keep selectedIndex within bounds
	useEffect(() => {
		setSelectedIndex(0);
	}, [query]);

	// Execute an item action
	function execute(item: CommandItem) {
		onOpenChange(false);
		if (item.action) {
			item.action();
		} else if (item.href) {
			if (item.external) {
				window.open(item.href, "_blank", "noopener,noreferrer");
			} else {
				router.push(item.href);
			}
		}
	}

	// Keyboard controls: ArrowUp, ArrowDown, Enter
	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setSelectedIndex((prev) => (filteredCommands.length > 0 ? (prev + 1) % filteredCommands.length : 0));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setSelectedIndex((prev) =>
				filteredCommands.length > 0 ? (prev - 1 + filteredCommands.length) % filteredCommands.length : 0,
			);
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (filteredCommands[selectedIndex]) {
				execute(filteredCommands[selectedIndex]);
			}
		}
	}

	// Group filtered commands for display
	const grouped = useMemo(() => {
		const groups: { [key: string]: CommandItem[] } = {};
		filteredCommands.forEach((cmd) => {
			if (!groups[cmd.category]) groups[cmd.category] = [];
			groups[cmd.category].push(cmd);
		});
		return groups;
	}, [filteredCommands]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="sm:max-w-xl p-0 overflow-hidden border border-border shadow-2xl rounded-2xl bg-popover"
			>
				{/* Search Input Bar */}
				<div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-muted/20">
					<Search size={16} className="text-muted-foreground shrink-0" />
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Search or jump to a page, action, or document..."
						className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden"
					/>
					<kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[10px] font-mono text-muted-foreground">
						ESC
					</kbd>
				</div>

				{/* Results List */}
				<div ref={listRef} className="max-h-[360px] overflow-y-auto p-2">
					{filteredCommands.length === 0 ? (
						<div className="py-12 text-center select-none">
							<p className="text-sm font-medium text-foreground">No matching commands found</p>
							<p className="text-xs text-muted-foreground mt-1">
								Try searching for &quot;inbox&quot;, &quot;logs&quot;, &quot;keys&quot;,
								&quot;users&quot;, or &quot;playground&quot;.
							</p>
						</div>
					) : (
						<div className="space-y-4">
							{Object.entries(grouped).map(([category, items]) => (
								<div key={category} className="space-y-1">
									<div className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
										{category}
									</div>
									<div className="space-y-0.5">
										{items.map((item) => {
											const currentIndex = filteredCommands.indexOf(item);
											const isSelected = currentIndex === selectedIndex;
											const Icon = item.icon;

											return (
												<div
													key={item.id}
													onClick={() => execute(item)}
													onMouseEnter={() => setSelectedIndex(currentIndex)}
													className={cn(
														"flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors select-none",
														isSelected
															? "bg-orange-500/10 text-orange-950 font-medium dark:text-orange-200 dark:bg-orange-950/40"
															: "text-foreground hover:bg-muted/60",
													)}
												>
													<div className="flex items-center gap-2.5 min-w-0">
														<div
															className={cn(
																"size-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
																isSelected
																	? "bg-orange-500 text-white"
																	: "bg-muted text-muted-foreground",
															)}
														>
															<Icon size={14} />
														</div>
														<div className="min-w-0">
															<div className="font-medium text-sm flex items-center gap-1.5">
																<span className="truncate">{item.title}</span>
																{item.external && (
																	<ExternalLink
																		size={11}
																		className="opacity-60 shrink-0"
																	/>
																)}
															</div>
															{item.subtitle && (
																<div className="text-[11px] text-muted-foreground truncate">
																	{item.subtitle}
																</div>
															)}
														</div>
													</div>

													<div className="flex items-center gap-1.5 shrink-0">
														{item.shortcut && (
															<kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[10px] font-mono text-muted-foreground">
																{item.shortcut}
															</kbd>
														)}
														{isSelected && (
															<CornerDownLeft size={13} className="text-orange-500" />
														)}
													</div>
												</div>
											);
										})}
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Footer with Hints */}
				<div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground select-none">
					<div className="flex items-center gap-3">
						<span className="flex items-center gap-1">
							<kbd className="px-1 rounded border border-border bg-background font-mono text-[9px]">
								↑
							</kbd>
							<kbd className="px-1 rounded border border-border bg-background font-mono text-[9px]">
								↓
							</kbd>
							<span>to navigate</span>
						</span>
						<span className="flex items-center gap-1">
							<kbd className="px-1.5 rounded border border-border bg-background font-mono text-[9px]">
								↵
							</kbd>
							<span>to select</span>
						</span>
					</div>
					<div>
						<span className="text-[10px] text-muted-foreground/80">EmailFlare Fast Jump</span>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
