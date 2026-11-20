"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Monitor, Moon, PenLine, Sun } from "lucide-react";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@/components/ui/command";
import { usePermissions } from "@/lib/UserContext";
import { WORKSPACES, allNavItems, type Workspace } from "@/lib/nav/config";

interface CommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
	const router = useRouter();
	const { setTheme } = useTheme();
	const { isAdmin, canAccessApi, canAccessTester, canAccessInbox } = usePermissions();

	const allowed: Record<Workspace, boolean> = { inbox: canAccessInbox, api: canAccessApi, admin: isAdmin };

	const groups = useMemo(() => {
		const byWorkspace = new Map<Workspace, ReturnType<typeof allNavItems>>();
		for (const item of allNavItems()) {
			const permitted = item.access === "tester" ? canAccessTester : allowed[item.workspace];
			if (!permitted) continue;
			byWorkspace.set(item.workspace, [...(byWorkspace.get(item.workspace) ?? []), item]);
		}
		return [...byWorkspace.entries()];
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isAdmin, canAccessApi, canAccessTester, canAccessInbox]);

	function run(action: () => void) {
		onOpenChange(false);
		action();
	}

	return (
		<CommandDialog open={open} onOpenChange={onOpenChange} className="sm:max-w-xl">
			<CommandInput placeholder="Search pages and actions…" />
			<CommandList className="max-h-96">
				<CommandEmpty>No results found.</CommandEmpty>

				{canAccessInbox && (
					<>
						<CommandGroup heading="Actions">
							<CommandItem
								value="compose new message"
								onSelect={() => run(() => window.dispatchEvent(new CustomEvent("emailflare:compose")))}
							>
								<PenLine /> Compose message
								<CommandShortcut>C</CommandShortcut>
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
					</>
				)}

				{groups.map(([workspace, items]) => (
					<CommandGroup key={workspace} heading={WORKSPACES[workspace].label}>
						{items.map((item) => (
							<CommandItem
								key={item.href}
								value={[item.title, item.description, item.group, ...(item.keywords ?? [])]
									.filter(Boolean)
									.join(" ")}
								onSelect={() => run(() => router.push(item.href))}
							>
								<item.icon />
								<span>{item.title}</span>
								{item.description && (
									<span className="truncate text-xs text-muted-foreground">{item.description}</span>
								)}
								{item.go && <CommandShortcut>G {item.go.toUpperCase()}</CommandShortcut>}
							</CommandItem>
						))}
					</CommandGroup>
				))}

				<CommandSeparator />
				<CommandGroup heading="Theme">
					<CommandItem value="theme light" onSelect={() => run(() => setTheme("light"))}>
						<Sun /> Light
					</CommandItem>
					<CommandItem value="theme dark" onSelect={() => run(() => setTheme("dark"))}>
						<Moon /> Dark
					</CommandItem>
					<CommandItem value="theme system" onSelect={() => run(() => setTheme("system"))}>
						<Monitor /> System
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
}
