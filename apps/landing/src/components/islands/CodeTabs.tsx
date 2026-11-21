import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import CopyButton from "./CopyButton";

export interface CodeTab {
	id: string;
	label: string;
	/** Pre-highlighted HTML from `highlight()` */
	html: string;
	/** Plain source for the copy button */
	code: string;
}

interface Props {
	tabs: CodeTab[];
	title?: string;
	className?: string;
}

/** Tabbed, copyable code panel on the ink surface. */
export default function CodeTabs({ tabs, title, className }: Props) {
	return (
		<Tabs
			defaultValue={tabs[0].id}
			className={cn(
				"bg-ink text-ink-foreground border-ink-border gap-0 overflow-hidden rounded-xl border",
				className,
			)}
		>
			<div className="border-ink-border flex items-center justify-between gap-3 border-b px-3 py-2">
				<div className="flex items-center gap-3">
					<span className="flex gap-1.5" aria-hidden>
						<span className="bg-ink-border size-2.5 rounded-full" />
						<span className="bg-ink-border size-2.5 rounded-full" />
						<span className="bg-ink-border size-2.5 rounded-full" />
					</span>
					{title && <span className="text-ink-muted font-mono text-xs">{title}</span>}
				</div>
				<TabsList variant="line" className="h-8">
					{tabs.map((t) => (
						<TabsTrigger
							key={t.id}
							value={t.id}
							className="text-ink-muted hover:text-ink-foreground data-active:text-ink-foreground flex-none px-2.5 font-mono text-xs"
						>
							{t.label}
						</TabsTrigger>
					))}
				</TabsList>
			</div>
			{tabs.map((t) => (
				<TabsContent key={t.id} value={t.id} className="group relative">
					<div className="absolute top-2 right-2 z-10">
						<CopyButton text={t.code} />
					</div>
					<div
						className="overflow-x-auto p-4 font-mono text-[0.8125rem] leading-6 [&_pre]:!bg-transparent [&_pre]:m-0"
						dangerouslySetInnerHTML={{ __html: t.html }}
					/>
				</TabsContent>
			))}
		</Tabs>
	);
}
