// D1-backed database helpers.
// Provides a lightweight typed wrapper over Cloudflare D1Database that
// mirrors the MesaHub client API used by the Node.js backend.

// ── Row type definitions ──────────────────────────────────────────────────────

export interface DomainRow {
  [key: string]: unknown;
  id: string;
  name: string;
  cf_zone_id: string;
  cf_subdomain_id: string | null;
  dkim_selector: string | null;
  return_path_domain: string | null;
  verified: number; // 0 | 1
  created_at: string;
}

export interface TemplateRow {
  [key: string]: unknown;
  id: string;
  name: string;
  slug: string | null;
  subject: string;
  html_body: string;
  text_body: string | null;
  layout: string | null;
  is_system: number; // 0 | 1
  domain_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyRow {
  [key: string]: unknown;
  id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  scope: 'global' | 'domain' | 'multi';
  key_type: 'test' | 'live';
  active: number; // 0 | 1
  last_used_at: string | null;
  send_count: number;
  created_at: string;
}

export interface ApiKeyDomainRow {
  [key: string]: unknown;
  api_key_id: string;
  domain_id: string;
}

export interface EmailLogRow {
  [key: string]: unknown;
  id: string;
  to_address: string;
  from_address: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed';
  cf_message_id: string | null;
  domain_id: string | null;
  template_id: string | null;
  api_key_id: string | null;
  idempotency_key: string | null;
  error: string | null;
  is_test: number; // 0 | 1
  html_body: string | null;
  text_body: string | null;
  sent_at: string;
}

// ── D1Table — typed query wrapper ────────────────────────────────────────────

type OrderBy = { column: string; direction: 'asc' | 'desc' };
type Comparison = { gte?: unknown; lte?: unknown; gt?: unknown; lt?: unknown };
type WhereValue = unknown | Comparison;

function isComparison(v: unknown): v is Comparison {
  if (typeof v !== 'object' || v === null) return false;
  return 'gte' in v || 'lte' in v || 'gt' in v || 'lt' in v;
}

function buildWhere<T extends Record<string, unknown>>(
  where?: Partial<Record<keyof T, WhereValue>>,
): { sql: string; params: unknown[] } {
  if (!where || Object.keys(where).length === 0) return { sql: '', params: [] };

  const clauses: string[] = [];
  const params: unknown[] = [];

  for (const [col, val] of Object.entries(where)) {
    if (isComparison(val)) {
      if (val.gte !== undefined) { clauses.push(`${col} >= ?`); params.push(val.gte); }
      if (val.lte !== undefined) { clauses.push(`${col} <= ?`); params.push(val.lte); }
      if (val.gt  !== undefined) { clauses.push(`${col} > ?`);  params.push(val.gt);  }
      if (val.lt  !== undefined) { clauses.push(`${col} < ?`);  params.push(val.lt);  }
    } else {
      clauses.push(`${col} = ?`);
      params.push(val);
    }
  }

  return { sql: ' WHERE ' + clauses.join(' AND '), params };
}

export class D1Table<T extends Record<string, unknown>> {
  constructor(private d1: D1Database, private tableName: string) {}

  async findOne(opts: { where: Partial<Record<keyof T, WhereValue>> }): Promise<T | null> {
    const { sql, params } = buildWhere<T>(opts.where);
    const row = await this.d1
      .prepare(`SELECT * FROM ${this.tableName}${sql} LIMIT 1`)
      .bind(...params)
      .first<T>();
    return row ?? null;
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
      sql += ' ORDER BY ' + opts.orderBy
        .map(o => `${o.column} ${o.direction.toUpperCase()}`)
        .join(', ');
    }
    if (opts?.limit  !== undefined) sql += ` LIMIT ${opts.limit}`;
    if (opts?.offset !== undefined) sql += ` OFFSET ${opts.offset}`;

    const result = await this.d1.prepare(sql).bind(...params).all<T>();
    return result.results;
  }

  async insert(row: T): Promise<T> {
    const cols = Object.keys(row).join(', ');
    const placeholders = Object.keys(row).map(() => '?').join(', ');
    await this.d1
      .prepare(`INSERT INTO ${this.tableName} (${cols}) VALUES (${placeholders})`)
      .bind(...Object.values(row))
      .run();
    return row;
  }

  async insertMany(rows: T[], opts?: { onConflict?: 'ignore' | 'replace' }): Promise<void> {
    if (rows.length === 0) return;
    const clause = opts?.onConflict === 'ignore' ? ' OR IGNORE' : '';
    const stmts = rows.map(row => {
      const cols = Object.keys(row).join(', ');
      const placeholders = Object.keys(row).map(() => '?').join(', ');
      return this.d1
        .prepare(`INSERT${clause} INTO ${this.tableName} (${cols}) VALUES (${placeholders})`)
        .bind(...Object.values(row));
    });
    await this.d1.batch(stmts);
  }

  async update(opts: {
    where: Partial<Record<keyof T, WhereValue>>;
    set: Partial<T>;
  }): Promise<void> {
    const setCols = Object.keys(opts.set);
    if (setCols.length === 0) return;
    const setSql    = setCols.map(k => `${k} = ?`).join(', ');
    const setVals   = setCols.map(k => (opts.set as Record<string, unknown>)[k]);
    const { sql: whereSql, params: whereVals } = buildWhere<T>(opts.where);
    await this.d1
      .prepare(`UPDATE ${this.tableName} SET ${setSql}${whereSql}`)
      .bind(...setVals, ...whereVals)
      .run();
  }

  async delete(opts: { where: Partial<Record<keyof T, WhereValue>> }): Promise<void> {
    const { sql, params } = buildWhere<T>(opts.where);
    await this.d1.prepare(`DELETE FROM ${this.tableName}${sql}`).bind(...params).run();
  }

  async count(opts?: { where?: Partial<Record<keyof T, WhereValue>> }): Promise<number> {
    const { sql, params } = buildWhere<T>(opts?.where);
    const row = await this.d1
      .prepare(`SELECT COUNT(*) as n FROM ${this.tableName}${sql}`)
      .bind(...params)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }
}

// ── D1Db — raw query helpers ──────────────────────────────────────────────────

export class D1Db {
  constructor(private d1: D1Database) {}

  table<T extends Record<string, unknown>>(name: string): D1Table<T> {
    return new D1Table<T>(this.d1, name);
  }

  /** Parameterized SELECT — returns rows. */
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
    const stmt = params?.length
      ? this.d1.prepare(sql).bind(...params)
      : this.d1.prepare(sql);
    const result = await stmt.all<T>();
    return { rows: result.results };
  }

  /** Parameterized mutation (INSERT/UPDATE/DELETE). */
  async run(sql: string, params?: unknown[]): Promise<void> {
    const stmt = params?.length
      ? this.d1.prepare(sql).bind(...params)
      : this.d1.prepare(sql);
    await stmt.run();
  }
}

// ── Named table factories ─────────────────────────────────────────────────────

export function makeDb(d1: D1Database) {
  const db = new D1Db(d1);
  return {
    db,
    domains:       db.table<DomainRow>('domains'),
    templates:     db.table<TemplateRow>('templates'),
    apiKeys:       db.table<ApiKeyRow>('api_keys'),
    apiKeyDomains: db.table<ApiKeyDomainRow>('api_key_domains'),
    emailLogs:     db.table<EmailLogRow>('email_logs'),
  };
}

export type DbHandle = ReturnType<typeof makeDb>;

/** Cascade-delete a domain and its api_key_domains associations. */
export async function deleteDomainCascade(d1: D1Database, domainId: string): Promise<void> {
  const { apiKeyDomains, domains } = makeDb(d1);
  await apiKeyDomains.delete({ where: { domain_id: domainId } });
  await domains.delete({ where: { id: domainId } });
}
