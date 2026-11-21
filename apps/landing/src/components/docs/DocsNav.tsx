import { cn } from "@/lib/utils";

export interface DocsNavGroup {
	id: string;
	items: { title: string; href: string }[];
}

interface Props {
	groups: DocsNavGroup[];
	current: string;
	onNavigate?: () => void;
	className?: string;
}

/** Grouped docs navigation. Static markup on desktop, reused inside the mobile sheet. */
export default function DocsNav({ groups, current, onNavigate, className }: Props) {
	return (
		<nav aria-label="Docs" className={cn("flex flex-col gap-6", className)}>
			{groups.map((group) => (
				<div key={group.id}>
					<p className="text-muted-foreground text-2xs mb-2 px-3 font-mono font-medium tracking-wide uppercase">
						{group.id}
					</p>
					<ul className="flex flex-col gap-0.5">
						{group.items.map((item) => {
							const active = item.href === current;
							return (
								<li key={item.href}>
									<a
										href={item.href}
										onClick={onNavigate}
										aria-current={active ? "page" : undefined}
										className={cn(
											"block rounded-lg border-l-2 px-3 py-1.5 text-sm transition-colors",
											active
												? "bg-primary-muted text-primary-muted-foreground border-primary font-medium"
												: "text-muted-foreground hover:bg-muted hover:text-foreground border-transparent",
										)}
									>
										{item.title}
									</a>
								</li>
							);
						})}
					</ul>
				</div>
			))}
		</nav>
	);
}
