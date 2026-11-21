import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import CopyButton from "@/components/islands/CopyButton";

export interface GalleryLayout {
	slug: string;
	label: string;
	category: string;
	description: string;
	variables: string[];
}
export interface GalleryTheme {
	id: string;
	label: string;
	primary: string;
}
interface Props {
	layouts: GalleryLayout[];
	categories: string[];
	themes: GalleryTheme[];
	apiHost: string;
}

const previewUrl = (theme: string, slug: string) => `/templates/previews/${theme}/${slug}.html`;
const ALL = "All";

function sendSnippet(l: GalleryLayout, theme: string, host: string) {
	const vars = l.variables
		.map((v) => `      "${v}": "${v === "name" ? "Alex" : v === "appName" ? "Acme" : "value"}"`)
		.join(",\n");
	return `curl -X POST ${host}/v1/send \\
  -H "Authorization: Bearer eflive_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "hello@yourdomain.com",
    "to": "alex@example.com",
    "templateSlug": "${l.slug}",
    "themeId": "${theme}",
    "variables": {
${vars}
    }
  }'`;
}

/** Filterable gallery of the built-in layouts. Thumbnails are the real renderer's output, served as static pages. */
export default function TemplateGallery({ layouts, categories, themes, apiHost }: Props) {
	const [category, setCategory] = useState(ALL);
	const [theme, setTheme] = useState(themes[0].id);
	const [query, setQuery] = useState("");
	const [active, setActive] = useState<GalleryLayout | null>(null);

	const counts = useMemo(() => {
		const c: Record<string, number> = { [ALL]: layouts.length };
		for (const l of layouts) c[l.category] = (c[l.category] ?? 0) + 1;
		return c;
	}, [layouts]);

	const shown = useMemo(() => {
		const q = query.trim().toLowerCase();
		return layouts.filter(
			(l) =>
				(category === ALL || l.category === category) &&
				(!q || [l.label, l.slug, l.description, ...l.variables].some((s) => s.toLowerCase().includes(q))),
		);
	}, [layouts, category, query]);

	return (
		<div>
			<div className="flex flex-col gap-4">
				<Tabs value={category} onValueChange={(v) => setCategory(String(v))} className="min-w-0">
					<TabsList
						className="group-data-horizontal/tabs:h-auto h-auto max-w-full flex-wrap justify-start gap-1"
						aria-label="Category"
					>
						{[ALL, ...categories].map((c) => (
							<TabsTrigger key={c} value={c} className="h-8 flex-none px-3">
								{c}
								<span className="text-muted-foreground font-mono text-2xs">{counts[c] ?? 0}</span>
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<label className="relative block min-w-0 flex-1">
						<span className="sr-only">Search layouts</span>
						<SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
						<input
							type="search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search by name, variable or purpose"
							className="border-input bg-card placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-xl border pr-4 pl-10 text-sm outline-none focus-visible:ring-3"
						/>
					</label>
					<div className="flex shrink-0 items-center gap-3">
						<span className="text-muted-foreground text-sm">Theme</span>
						<Tabs value={theme} onValueChange={(v) => setTheme(String(v))}>
							<TabsList aria-label="Theme" className="h-10">
								{themes.map((t) => (
									<TabsTrigger
										key={t.id}
										value={t.id}
										className="flex-none gap-2 px-2.5"
										aria-label={t.label}
									>
										<span
											className="size-3 rounded-full border"
											style={{ background: t.primary }}
											aria-hidden
										/>
										<span className="hidden md:inline">{t.label}</span>
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					</div>
				</div>
				<p className="text-muted-foreground text-sm" aria-live="polite">
					Showing {shown.length} of {layouts.length} layouts
				</p>
			</div>

			{shown.length === 0 ? (
				<p className="text-muted-foreground border-border mt-6 rounded-2xl border border-dashed p-10 text-center">
					No layout matches that search.
				</p>
			) : (
				<ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{shown.map((l) => (
						<li key={l.slug}>
							<button
								type="button"
								onClick={() => setActive(l)}
								className="group border-border bg-card focus-visible:ring-ring/50 hover:border-primary/50 flex h-full w-full flex-col overflow-hidden rounded-2xl border text-left transition-colors outline-none focus-visible:ring-3"
							>
								<span
									className="bg-muted relative block aspect-[4/3] overflow-hidden border-b"
									aria-hidden
								>
									<iframe
										src={previewUrl(theme, l.slug)}
										title={`${l.label} preview`}
										loading="lazy"
										tabIndex={-1}
										sandbox="allow-same-origin"
										className="pointer-events-none absolute top-0 left-0 h-[143%] w-[143%] origin-top-left scale-[0.7] border-0"
									/>
								</span>
								<span className="flex flex-1 flex-col gap-2 p-5">
									<span className="flex items-start justify-between gap-3">
										<span className="font-display text-lg leading-snug font-semibold">
											{l.label}
										</span>
										<Badge variant="secondary" className="mt-0.5 shrink-0">
											{l.variables.length} fields
										</Badge>
									</span>
									<span className="text-muted-foreground text-sm leading-6">{l.description}</span>
									<span className="text-muted-foreground mt-auto pt-2 font-mono text-xs">
										{l.slug}
									</span>
								</span>
							</button>
						</li>
					))}
				</ul>
			)}

			<Sheet open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
				<SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-2xl">
					{active && (
						<>
							<SheetHeader className="border-b p-6 pr-14">
								<Badge variant="outline" className="mb-2 w-fit">
									{active.category}
								</Badge>
								<SheetTitle className="font-display text-2xl font-semibold">{active.label}</SheetTitle>
								<SheetDescription>{active.description}</SheetDescription>
							</SheetHeader>
							<div className="space-y-6 p-6">
								<iframe
									src={previewUrl(theme, active.slug)}
									title={`${active.label} preview`}
									tabIndex={-1}
									sandbox="allow-same-origin"
									className="border-border block h-[28rem] w-full rounded-xl border"
								/>
								<div>
									<p className="text-muted-foreground mb-2 font-mono text-xs tracking-wide uppercase">
										Variables
									</p>
									<ul className="flex flex-wrap gap-2">
										{active.variables.map((v) => (
											<li
												key={v}
												className="bg-muted rounded-md border px-2 py-1 font-mono text-xs"
											>
												{v}
											</li>
										))}
									</ul>
								</div>
								<div className="bg-ink text-ink-foreground border-ink-border relative overflow-hidden rounded-xl border">
									<div className="border-ink-border text-ink-muted flex items-center justify-between border-b py-1.5 pr-2 pl-4 font-mono text-xs">
										<span>Send it</span>
										<CopyButton text={sendSnippet(active, theme, apiHost)} />
									</div>
									<pre className={cn("overflow-x-auto p-4 font-mono text-[0.8125rem] leading-6")}>
										<code>{sendSnippet(active, theme, apiHost)}</code>
									</pre>
								</div>
							</div>
						</>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}
