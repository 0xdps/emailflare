import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	CommandDialog,
	CommandEmpty,
	CommandFooter,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";

interface SearchRecord {
	title: string;
	page: string;
	section: string;
	url: string;
	text: string;
}

const MAX_RESULTS = 8;

function search(records: SearchRecord[], query: string): SearchRecord[] {
	const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return records.filter((r) => !r.url.includes("#")).slice(0, MAX_RESULTS);

	const scored: { record: SearchRecord; score: number }[] = [];
	for (const record of records) {
		const title = record.title.toLowerCase();
		const rest = `${record.page} ${record.section} ${record.text}`.toLowerCase();
		let score = 0;
		let matched = true;
		for (const token of tokens) {
			if (title.includes(token)) score += title.startsWith(token) ? 14 : 10;
			else if (record.page.toLowerCase().includes(token)) score += 4;
			else if (rest.includes(token)) score += 1;
			else {
				matched = false;
				break;
			}
		}
		if (matched) scored.push({ record, score: score + (record.url.includes("#") ? 0 : 3) });
	}
	return scored
		.sort((a, b) => b.score - a.score)
		.slice(0, MAX_RESULTS)
		.map((s) => s.record);
}

export default function DocsSearch() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [records, setRecords] = useState<SearchRecord[] | null>(null);
	const [failed, setFailed] = useState(false);
	const [active, setActive] = useState(0);
	const listRef = useRef<HTMLUListElement>(null);

	const results = useMemo(() => (records ? search(records, query) : []), [records, query]);

	const load = useCallback(() => {
		if (records || failed) return;
		fetch("/docs/search.json")
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
			.then(setRecords)
			.catch(() => setFailed(true));
	}, [records, failed]);

	useEffect(() => {
		const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
		document.querySelectorAll("[data-docs-search-key]").forEach((el) => {
			el.textContent = isMac ? "⌘K" : "Ctrl K";
		});

		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const typing = target?.closest("input, textarea, select, [contenteditable]");
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setOpen((o) => !o);
			} else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
				e.preventDefault();
				setOpen(true);
			}
		};
		const onClick = (e: MouseEvent) => {
			if ((e.target as HTMLElement).closest("[data-docs-search]")) setOpen(true);
		};
		document.addEventListener("keydown", onKey);
		document.addEventListener("click", onClick);
		return () => {
			document.removeEventListener("keydown", onKey);
			document.removeEventListener("click", onClick);
		};
	}, []);

	useEffect(() => {
		if (open) load();
		else setQuery("");
	}, [open, load]);

	useEffect(() => setActive(0), [query]);

	useEffect(() => {
		listRef.current?.querySelector("[data-active]")?.scrollIntoView({ block: "nearest" });
	}, [active, results]);

	const go = (record: SearchRecord | undefined) => {
		if (!record) return;
		setOpen(false);
		window.location.href = record.url;
	};

	const onInputKey = (e: React.KeyboardEvent) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActive((i) => Math.min(i + 1, results.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActive((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			go(results[active]);
		}
	};

	return (
		<CommandDialog
			open={open}
			onOpenChange={setOpen}
			title="Search the docs"
			description="Type to search pages and headings."
		>
			<CommandInput
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				onKeyDown={onInputKey}
				placeholder="Search the docs"
				aria-label="Search the docs"
				aria-expanded="true"
				aria-controls="docs-search-results"
				aria-activedescendant={results[active] ? `docs-search-${active}` : undefined}
			/>
			<CommandList ref={listRef} id="docs-search-results" aria-label="Results">
				{results.map((r, i) => {
					const isPage = !r.url.includes("#");
					return (
						<CommandItem
							key={r.url}
							id={`docs-search-${i}`}
							active={i === active}
							onMouseMove={() => setActive(i)}
							onClick={() => go(r)}
						>
							<span className="font-medium">{r.title}</span>
							<span className="text-muted-foreground line-clamp-1 text-xs">
								{isPage ? `${r.section} · ${r.text}` : `${r.section} · ${r.page}`}
							</span>
						</CommandItem>
					);
				})}
			</CommandList>
			{records && results.length === 0 && <CommandEmpty>No results for “{query}”.</CommandEmpty>}
			{failed && <CommandEmpty>Search could not load. Try reloading the page.</CommandEmpty>}
			{!records && !failed && <CommandEmpty>Loading…</CommandEmpty>}
			<CommandFooter>
				<span className="flex items-center gap-1">
					<Kbd>↑</Kbd>
					<Kbd>↓</Kbd> to move
				</span>
				<span className="flex items-center gap-1">
					<Kbd>↵</Kbd> to open
				</span>
				<span className="flex items-center gap-1">
					<Kbd>Esc</Kbd> to close
				</span>
			</CommandFooter>
		</CommandDialog>
	);
}
