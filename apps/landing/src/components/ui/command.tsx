import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Minimal command-palette primitives on Base UI Dialog.
 * The caller owns the query, the results and the active index, and wires
 * them to the combobox/listbox roles below.
 */

function CommandDialog({
	title,
	description,
	children,
	className,
	...props
}: DialogPrimitive.Root.Props & {
	title: string;
	description?: string;
	className?: string;
}) {
	return (
		<DialogPrimitive.Root {...props}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Backdrop
					data-slot="command-overlay"
					className="fixed inset-0 z-50 bg-ink/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs"
				/>
				<DialogPrimitive.Popup
					data-slot="command-dialog"
					className={cn(
						"fixed inset-x-4 top-[10vh] z-50 mx-auto flex max-h-[min(34rem,80dvh)] w-auto max-w-xl flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
						className,
					)}
				>
					<DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
					{description && (
						<DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
					)}
					{children}
				</DialogPrimitive.Popup>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

function CommandInput({ className, ...props }: React.ComponentProps<"input">) {
	return (
		<div className="flex items-center gap-3 border-b px-4">
			<SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<input
				data-slot="command-input"
				type="text"
				role="combobox"
				aria-autocomplete="list"
				autoComplete="off"
				autoCorrect="off"
				spellCheck={false}
				className={cn(
					"h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground",
					className,
				)}
				{...props}
			/>
		</div>
	);
}

function CommandList({ className, ...props }: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="command-list"
			role="listbox"
			className={cn("flex-1 overflow-y-auto p-2", className)}
			{...props}
		/>
	);
}

function CommandItem({ className, active, ...props }: React.ComponentProps<"li"> & { active?: boolean }) {
	return (
		<li
			data-slot="command-item"
			role="option"
			aria-selected={active}
			data-active={active ? "" : undefined}
			className={cn(
				"flex cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2 text-sm data-active:bg-accent data-active:text-accent-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function CommandEmpty({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="command-empty"
			className={cn("px-4 py-10 text-center text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}

function CommandFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="command-footer"
			className={cn(
				"flex items-center gap-4 border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export { CommandDialog, CommandInput, CommandList, CommandItem, CommandEmpty, CommandFooter };
