#!/usr/bin/env node
// Design-system ratchet.
//
// Flags hard-coded palette colours (bg-orange-500, text-zinc-400 …) and raw form
// controls (<button>, <input> …) in app code. Components must use theme tokens
// (app/theme.css) and shadcn primitives (components/ui) instead.
//
// Legacy files are grandfathered in ui-baseline.json: their count may go down but
// never up, and any file not in the baseline must be clean.
//
//   node scripts/check-ui-tokens.mjs            # check
//   node scripts/check-ui-tokens.mjs --update   # rewrite the baseline after a cleanup

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(root, "scripts", "ui-baseline.json");
const SCAN = ["app", "components"];
const SKIP = ["components/ui/"];

const PALETTE =
	/\b(?:bg|text|border|ring|from|via|to|fill|stroke|divide|outline|decoration|shadow)-(?:orange|zinc|slate|gray|neutral|stone|red|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
// File pickers have no shadcn equivalent, so <input type="file"> is allowed.
// Arbitrary pixel font sizes bypass the type scale (use text-2xs … text-xl).
const PX_TEXT = /\btext-\[\d+px\]/g;
const RAW_CONTROLS = /<(?:button|select|textarea|table|input(?![^>]*type="file"))\b/g;

function walk(dir) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : path.endsWith(".tsx") ? [path] : [];
	});
}

const counts = {};
for (const dir of SCAN) {
	for (const file of walk(join(root, dir))) {
		const rel = relative(root, file);
		if (SKIP.some((s) => rel.startsWith(s))) continue;
		const src = readFileSync(file, "utf8");
		const n =
			(src.match(PALETTE)?.length ?? 0) +
			(src.match(RAW_CONTROLS)?.length ?? 0) +
			(src.match(PX_TEXT)?.length ?? 0);
		if (n > 0) counts[rel] = n;
	}
}

if (process.argv.includes("--update")) {
	const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
	writeFileSync(baselinePath, JSON.stringify(sorted, null, "\t") + "\n");
	console.log(`ui-baseline.json updated (${Object.keys(sorted).length} legacy files).`);
	process.exit(0);
}

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
const failures = [];
for (const [file, n] of Object.entries(counts)) {
	const allowed = baseline[file] ?? 0;
	if (n > allowed) failures.push(`${file}: ${n} hard-coded colours/px font sizes/raw controls (allowed ${allowed})`);
}

if (failures.length) {
	console.error("Design-system check failed:\n" + failures.map((f) => `  - ${f}`).join("\n"));
	console.error(
		"\nUse theme tokens (bg-primary, text-muted-foreground, bg-success-muted …) and components from @/components/ui.",
	);
	process.exit(1);
}

const stale = Object.keys(baseline).filter((f) => !(f in counts));
if (stale.length) console.log(`Tip: run with --update — ${stale.length} baseline file(s) are now clean.`);
console.log("Design-system check passed.");
