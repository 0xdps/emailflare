// Wrangler does not merge install overrides. This writes one config that
// Vite, migrations, and deploy all read.
//
// Local:  wrangler.jsonc + wrangler.local.jsonc
// Remote: wrangler.jsonc + wrangler.production.jsonc

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] === "production" ? "production" : "local";
const outPath = resolve(process.argv[3] ?? "wrangler.deploy.json");
const patchPath = process.argv[4] ? resolve(process.argv[4]) : "";

function stripJsonc(text) {
	let output = "";
	let quote = "";
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		const next = text[i + 1];
		if (quote) {
			output += char;
			if (char === "\\") {
				output += next ?? "";
				i++;
			} else if (char === quote) quote = "";
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			output += char;
			continue;
		}
		if (char === "/" && next === "/") {
			const newline = text.indexOf("\n", i);
			if (newline === -1) break;
			i = newline;
			output += "\n";
			continue;
		}
		if (char === "/" && next === "*") {
			const end = text.indexOf("*/", i + 2);
			if (end === -1) throw new Error("unterminated block comment");
			i = end + 1;
			continue;
		}
		output += char;
	}
	return output.replace(/,\s*([}\]])/g, "$1");
}

function readJsonc(path) {
	try {
		return JSON.parse(stripJsonc(readFileSync(path, "utf8")));
	} catch (error) {
		throw new Error(`${path}: ${error instanceof Error ? error.message : "invalid JSON"}`, { cause: error });
	}
}

function merge(base, override) {
	if (Array.isArray(base) && Array.isArray(override)) {
		const key = override.some((item) => item && typeof item === "object" && "binding" in item)
			? "binding"
			: override.some((item) => item && typeof item === "object" && "queue" in item)
				? "queue"
				: null;
		if (!key) return override;
		const merged = base.map((item) => ({ ...item }));
		for (const item of override) {
			const index = merged.findIndex((candidate) => candidate?.[key] === item?.[key]);
			if (index === -1) merged.push(item);
			else merged[index] = merge(merged[index], item);
		}
		return merged;
	}
	if (base && override && typeof base === "object" && typeof override === "object" && !Array.isArray(base)) {
		const merged = { ...base };
		for (const [key, value] of Object.entries(override)) {
			merged[key] = key in merged ? merge(merged[key], value) : value;
		}
		return merged;
	}
	return override === undefined ? base : override;
}

function isPlaceholder(value) {
	return typeof value === "string" && (/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value) || /^0{32}$/.test(value));
}

const overrideName = target === "production" ? "wrangler.production.jsonc" : "wrangler.local.jsonc";
const overridePath = resolve(root, overrideName);
if (!existsSync(overridePath)) {
	throw new Error(
		`Missing ${overrideName}. Copy ${overrideName.replace(".jsonc", ".example.jsonc")} and set the resource IDs.`,
	);
}

const config = merge(readJsonc(resolve(root, "wrangler.jsonc")), readJsonc(overridePath));
const databaseId = config.d1_databases?.find((database) => database.binding === "DB")?.database_id;
const kvId = config.kv_namespaces?.find((namespace) => namespace.binding === "RATE_LIMIT_KV")?.id;
if (target === "production" && (isPlaceholder(databaseId) || isPlaceholder(kvId))) {
	throw new Error(`${overrideName} still has placeholder D1 or KV IDs`);
}
if (!config.r2_buckets?.find((bucket) => bucket.binding === "ATTACHMENTS")?.bucket_name) {
	throw new Error(`${overrideName} is missing ATTACHMENTS.bucket_name`);
}

writeFileSync(outPath, `${JSON.stringify(config, null, "\t")}\n`);
console.log(`merged ${overrideName} -> ${outPath}`);

if (patchPath) {
	if (!existsSync(patchPath)) throw new Error(`Generated config not found: ${patchPath}`);
	const generated = JSON.parse(readFileSync(patchPath, "utf8"));
	const patched = merge(generated, {
		name: config.name,
		d1_databases: config.d1_databases,
		kv_namespaces: config.kv_namespaces,
		r2_buckets: config.r2_buckets,
		queues: config.queues,
		vars: config.vars,
	});
	writeFileSync(patchPath, `${JSON.stringify(patched, null, "\t")}\n`);
	console.log(`patched generated config -> ${patchPath}`);
}
