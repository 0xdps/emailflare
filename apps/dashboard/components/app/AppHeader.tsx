"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, Monitor, Moon, Search, Sun } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import NotificationBell from "@/components/NotificationBell";
import type { User } from "@/lib/api";
import { WORKSPACES, currentNavItem, workspaceForPath } from "@/lib/nav/config";
import { cn } from "@/lib/utils";

function initialsOf(name?: string | null) {
	if (!name) return "?";
	return name
		.split(" ")
		.map((s) => s[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

function StatusRow({ tone, children }: { tone: "success" | "warning" | "danger" | "idle"; children: React.ReactNode }) {
	const dot = {
		success: "bg-success",
		warning: "bg-warning",
		danger: "bg-destructive",
		idle: "bg-muted-foreground/40",
	}[tone];
	return (
		<div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
			<span className={cn("size-1.5 rounded-full", dot)} />
			{children}
		</div>
	);
}

interface AccountMenuProps {
	user: User | null;
	isAdmin: boolean;
	connected: boolean;
	tokenActive: boolean | null;
	onLogout: () => void;
}

function AccountMenu({ user, isAdmin, connected, tokenActive, onLogout }: AccountMenuProps) {
	const { theme = "system", setTheme } = useTheme();
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Account menu" />
				}
			>
				<Avatar size="sm">
					<AvatarFallback className="bg-primary-muted text-2xs font-semibold text-primary-muted-foreground">
						{initialsOf(user?.name)}
					</AvatarFallback>
				</Avatar>
				<span
					className={cn(
						"absolute right-0.5 bottom-0.5 size-2 rounded-full ring-2 ring-background",
						connected ? "bg-success" : "bg-warning",
					)}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="space-y-0.5 py-2">
						<p className="truncate text-sm font-medium text-foreground">{user?.name ?? "User"}</p>
						<p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
						<Badge variant={isAdmin ? "default" : "secondary"} className="mt-1.5">
							{isAdmin ? "Admin" : "Member"}
						</Badge>
					</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuLabel>Theme</DropdownMenuLabel>
					<DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
						<DropdownMenuRadioItem value="light">
							<Sun /> Light
						</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="dark">
							<Moon /> Dark
						</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="system">
							<Monitor /> System
						</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuLabel>Status</DropdownMenuLabel>
					<StatusRow tone={connected ? "success" : "warning"}>
						{connected ? "Notifications live" : "Notifications reconnecting"}
					</StatusRow>
					{isAdmin && (
						<StatusRow tone={tokenActive === null ? "idle" : tokenActive ? "success" : "danger"}>
							{tokenActive === null
								? "Checking Cloudflare token"
								: tokenActive
									? "Cloudflare token active"
									: "Cloudflare token inactive"}
						</StatusRow>
					)}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="destructive" onClick={onLogout}>
					<LogOut /> Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function AppBreadcrumb() {
	const pathname = usePathname();
	const workspace = WORKSPACES[workspaceForPath(pathname)];
	const page = currentNavItem(pathname);
	const showPage = page && page.href !== workspace.home;

	return (
		<Breadcrumb className="min-w-0">
			<BreadcrumbList className="flex-nowrap">
				<BreadcrumbItem>
					{showPage ? (
						<BreadcrumbLink render={<Link href={workspace.home} />}>{workspace.label}</BreadcrumbLink>
					) : (
						<BreadcrumbPage>{page?.title ?? workspace.label}</BreadcrumbPage>
					)}
				</BreadcrumbItem>
				{showPage && (
					<>
						<BreadcrumbSeparator />
						<BreadcrumbItem className="min-w-0">
							<BreadcrumbPage className="truncate">{page.title}</BreadcrumbPage>
						</BreadcrumbItem>
					</>
				)}
			</BreadcrumbList>
		</Breadcrumb>
	);
}

export default function AppHeader(props: AccountMenuProps & { onOpenCommand: () => void }) {
	const { onOpenCommand, ...account } = props;
	return (
		<header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur">
			<SidebarTrigger className="-ml-1" />
			<Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
			<AppBreadcrumb />

			<div className="ml-auto flex items-center gap-1.5">
				<Button
					variant="outline"
					size="sm"
					onClick={onOpenCommand}
					className="hidden w-56 justify-start gap-2 font-normal text-muted-foreground sm:flex"
				>
					<Search />
					<span className="flex-1 text-left">Search or jump to…</span>
					<Kbd>⌘K</Kbd>
				</Button>
				<Button
					variant="ghost"
					size="icon"
					onClick={onOpenCommand}
					className="sm:hidden"
					aria-label="Search or jump to"
				>
					<Search />
				</Button>
				<NotificationBell />
				<AccountMenu {...account} />
			</div>
		</header>
	);
}
