// MesaHub-backed database helpers for inbox-server.
//
// Mirrors the D1Table / D1Db API from services/inbox-worker/src/db.ts so that
// ported route files need minimal changes. The key differences:
//   • makeDb() takes no arguments — uses the module-level mesaDb singleton
//   • rawDb.first / rawDb.all / rawDb.run / rawDb.batch replace D1 prepare/bind calls
//   • db.query() for SELECTs, db.exec() for INSERT / UPDATE / DELETE

import { MesahubClient } from "@mesahub/client";
import { parseMesahubUrl } from "./lib/mesahub-url.js";
import { env } from "./env.js";

const { apiUrl, apiKey, dbName } = parseMesahubUrl(env.MESAHUB_URL);
const client = new MesahubClient({ apiKey, apiUrl, routePrefix: "api" });
export const mesaDb = client.db(dbName);

// ── Row types (email-api subset) — re-exported from @emailflare/email-core ────

export type {
	DomainRow,
	TemplateRow,
	ApiKeyRow,
	ApiKeyDomainRow,
	EmailLogRow,
	SuppressionRow,
	ListRow,
	UnsubscribeTokenRow,
} from "@emailflare/email-core";
import type {
	DomainRow,
	TemplateRow,
	ApiKeyRow,
	ApiKeyDomainRow,
	EmailLogRow,
	SuppressionRow,
	ListRow,
	UnsubscribeTokenRow,
} from "@emailflare/email-core";

// ── Where clause builder (same as D1 version) ─────────────────────────────────

type OrderBy = { column: string; direction: "asc" | "desc" };
type Comparison = { gte?: unknown; lte?: unknown; gt?: unknown; lt?: unknown };
type WhereValue = unknown | Comparison;

function isComparison(v: unknown): v is Comparison {
	if (typeof v !== "object" || v === null) return false;
	return "gte" in v || "lte" in v || "gt" in v || "lt" in v;
}

function buildWhere<T extends Record<string, unknown>>(
	where?: Partial<Record<keyof T, WhereValue>>,
): { sql: string; params: unknown[] } {
	if (!where || Object.keys(where).length === 0) return { sql: "", params: [] };
	const clauses: string[] = [];
	const params: unknown[] = [];
	for (const [col, val] of Object.entries(where)) {
		if (isComparison(val)) {
			if (val.gte !== undefined) {
				clauses.push(`${col} >= ?`);
				params.push(val.gte);
			}
			if (val.lte !== undefined) {
				clauses.push(`${col} <= ?`);
				params.push(val.lte);
			}
			if (val.gt !== undefined) {
				clauses.push(`${col} > ?`);
				params.push(val.gt);
			}
			if (val.lt !== undefined) {
				clauses.push(`${col} < ?`);
				params.push(val.lt);
			}
		} else {
			clauses.push(`${col} = ?`);
			params.push(val);
		}
	}
	return { sql: " WHERE " + clauses.join(" AND "), params };
}

// ── MesaTable<T> — typed query wrapper backed by MesaHub ─────────────────────

export class MesaTable<T extends Record<string, unknown>> {
	constructor(private tableName: string) {}

	async findOne(opts: { where: Partial<Record<keyof T, WhereValue>> }): Promise<T | null> {
		const { sql, params } = buildWhere<T>(opts.where);
		const result = await mesaDb.query(`SELECT * FROM ${this.tableName}${sql} LIMIT 1`, params);
		return (result.rows[0] as T) ?? null;
	}

	async find(opts?: {
		where?: Partial<Record<keyof T, WhereValue>>;
		orderBy?: OrderBy[];
		limit?: number;
		offset?: number;
	}): Promise<T[]> {
		const { sql: whereSql, params } = buildWhere<T>(opts?.where);
		let sql = `SELECT * FROM ${this.tableName}${whereSql}`;
		if (opts?.orderBy?.length) {
			sql += " ORDER BY " + opts.orderBy.map((o) => `${o.column} ${o.direction.toUpperCase()}`).join(", ");
		}
		if (opts?.limit !== undefined) sql += ` LIMIT ${opts.limit}`;
		if (opts?.offset !== undefined) sql += ` OFFSET ${opts.offset}`;
		const result = await mesaDb.query(sql, params);
		return result.rows as T[];
	}

	async insert(row: T): Promise<T> {
		const cols = Object.keys(row).join(", ");
		const placeholders = Object.keys(row)
			.map(() => "?")
			.join(", ");
		await mesaDb.exec(`INSERT INTO ${this.tableName} (${cols}) VALUES (${placeholders})`, Object.values(row));
		return row;
	}

	async insertMany(rows: T[], opts?: { onConflict?: "ignore" | "replace" }): Promise<void> {
		if (rows.length === 0) return;
		const clause = opts?.onConflict === "ignore" ? " OR IGNORE" : "";
		for (const row of rows) {
			const cols = Object.keys(row).join(", ");
			const placeholders = Object.keys(row)
				.map(() => "?")
				.join(", ");
			await mesaDb.exec(
				`INSERT${clause} INTO ${this.tableName} (${cols}) VALUES (${placeholders})`,
				Object.values(row),
			);
		}
	}

	async update(opts: { where: Partial<Record<keyof T, WhereValue>>; set: Partial<T> }): Promise<void> {
		const setCols = Object.keys(opts.set);
		if (setCols.length === 0) return;
		const setSql = setCols.map((k) => `${k} = ?`).join(", ");
		const setVals = setCols.map((k) => (opts.set as Record<string, unknown>)[k]);
		const { sql: whereSql, params: whereVals } = buildWhere<T>(opts.where);
		await mesaDb.exec(`UPDATE ${this.tableName} SET ${setSql}${whereSql}`, [...setVals, ...whereVals]);
	}

	async delete(opts: { where: Partial<Record<keyof T, WhereValue>> }): Promise<void> {
		const { sql, params } = buildWhere<T>(opts.where);
		await mesaDb.exec(`DELETE FROM ${this.tableName}${sql}`, params);
	}

	async count(opts?: { where?: Partial<Record<keyof T, WhereValue>> }): Promise<number> {
		const { sql, params } = buildWhere<T>(opts?.where);
		const result = await mesaDb.query(`SELECT COUNT(*) as n FROM ${this.tableName}${sql}`, params);
		return (result.rows[0] as { n: number } | undefined)?.n ?? 0;
	}
}

// ── RawDb — raw SQL helpers (replaces D1Db + c.env.DB.prepare()...bind()) ─────

export const rawDb = {
	/** SELECT — returns typed rows. */
	async query<T = unknown>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
		const result = await mesaDb.query(sql, params);
		return { rows: result.rows as T[] };
	},

	/** INSERT / UPDATE / DELETE. */
	async run(sql: string, params: unknown[] = []): Promise<void> {
		await mesaDb.exec(sql, params);
	},

	/** SELECT returning first row or null. */
	async first<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
		const result = await mesaDb.query(sql, params);
		return (result.rows[0] as T | undefined) ?? null;
	},

	/** SELECT returning { results: T[] } to match D1 .all() shape. */
	async all<T = unknown>(sql: string, params: unknown[] = []): Promise<{ results: T[] }> {
		const result = await mesaDb.query(sql, params);
		return { results: result.rows as T[] };
	},

	/** Execute multiple write statements sequentially (replaces D1.batch). */
	async batch(ops: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
		for (const op of ops) {
			await mesaDb.exec(op.sql, op.params ?? []);
		}
	},
};

// ── Named table factories ─────────────────────────────────────────────────────

export function makeDb() {
	return {
		domains: new MesaTable<DomainRow>("domains"),
		templates: new MesaTable<TemplateRow>("templates"),
		apiKeys: new MesaTable<ApiKeyRow>("api_keys"),
		apiKeyDomains: new MesaTable<ApiKeyDomainRow>("api_key_domains"),
		emailLogs: new MesaTable<EmailLogRow>("email_logs"),
		suppressions: new MesaTable<SuppressionRow>("suppressions"),
		lists: new MesaTable<ListRow>("lists"),
		unsubscribeTokens: new MesaTable<UnsubscribeTokenRow>("unsubscribe_tokens"),
	};
}

export type DbHandle = ReturnType<typeof makeDb>;

/** Cascade-delete a domain and its api_key_domains associations. */
export async function deleteDomainCascade(domainId: string): Promise<void> {
	await rawDb.run("DELETE FROM api_key_domains WHERE domain_id = ?", [domainId]);
	await rawDb.run("DELETE FROM domains WHERE id = ?", [domainId]);
}
