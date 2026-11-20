"use client";

import React, { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import api, { getInboxes, type Inbox as InboxType } from "@/lib/api";
import { usePermissions } from "@/lib/UserContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useThreadCounts } from "@/hooks/useThreadCounts";
import { goShortcuts, workspaceForPath, type Workspace } from "@/lib/nav/config";
import AppHeader from "@/components/app/AppHeader";
import AppSidebar from "@/components/app/AppSidebar";
import CommandPalette from "@/components/CommandPalette";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

function ShellSkeleton() {
	return (
		<div className="flex h-svh bg-background">
			<div className="hidden w-64 shrink-0 flex-col gap-3 border-r bg-sidebar p-3 md:flex">
				<Skeleton className="h-11 w-full" />
				{Array.from({ length: 6 }).map((_, i) => (
					<Skeleton key={i} className="h-8 w-full" />
				))}
			</div>
			<div className="flex flex-1 flex-col">
				<Skeleton className="h-12 w-full rounded-none" />
			</div>
		</div>
	);
}

export default function Layout({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const { user, loading, isVerified, isAdmin, canAccessApi, canAccessTester, canAccessInbox } = usePermissions();
	const { connected } = useNotifications();

	const [commandOpen, setCommandOpen] = useState(false);
	const [mailboxes, setMailboxes] = useState<InboxType[]>([]);
	const [tokenActive, setTokenActive] = useState<boolean | null>(null);

	const workspace = workspaceForPath(pathname);
	const counts = useThreadCounts(isVerified && canAccessInbox);

	const available: Workspace[] = [
		...(canAccessInbox || canAccessTester ? (["inbox"] as const) : []),
		...(canAccessApi ? (["api"] as const) : []),
		...(isAdmin ? (["admin"] as const) : []),
	];

	useEffect(() => {
		if (!isAdmin) return;
		api.get<{ active: boolean }>("/api/cloudflare/status")
			.then((res) => setTokenActive(res.data.active))
			.catch(() => setTokenActive(false));
	}, [isAdmin]);

	useEffect(() => {
		if (workspace !== "inbox" || !canAccessInbox) return;
		getInboxes()
			.then(setMailboxes)
			.catch(() => setMailboxes([]));
	}, [workspace, canAccessInbox]);

	// ⌘K toggles the palette; "g" then a key jumps to a page (see lib/nav/config.ts).
	useEffect(() => {
		const destinations = goShortcuts();
		let pendingGo = false;
		let goTimer: ReturnType<typeof setTimeout> | undefined;

		function onKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setCommandOpen((prev) => !prev);
				return;
			}
			const target = e.target as HTMLElement | null;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable))
				return;
			if (e.metaKey || e.ctrlKey || e.altKey) return;

			if (e.key.toLowerCase() === "g" && !pendingGo) {
				pendingGo = true;
				goTimer = setTimeout(() => (pendingGo = false), 800);
				return;
			}
			if (pendingGo) {
				pendingGo = false;
				clearTimeout(goTimer);
				const href = destinations[e.key.toLowerCase()];
				if (href) {
					e.preventDefault();
					router.push(href);
				}
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			clearTimeout(goTimer);
		};
	}, [router]);

	async function handleLogout() {
		await api.post("/api/auth/logout").catch((err) => console.error("[layout] logout failed:", err));
		router.replace("/login");
	}

	if (loading && !user) return <ShellSkeleton />;

	return (
		<SidebarProvider className="h-svh">
			<Suspense fallback={null}>
				<AppSidebar
					workspace={workspace}
					available={available}
					canAccessInbox={canAccessInbox}
					canAccessTester={canAccessTester}
					mailboxes={mailboxes}
					counts={counts}
				/>
			</Suspense>

			<SidebarInset className="h-svh min-w-0 overflow-hidden">
				<AppHeader
					user={user}
					isAdmin={isAdmin}
					connected={connected}
					tokenActive={tokenActive}
					onLogout={handleLogout}
					onOpenCommand={() => setCommandOpen(true)}
				/>
				<div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
			</SidebarInset>

			<CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
		</SidebarProvider>
	);
}
