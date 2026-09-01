// Database migrations runner.
// Reads SQL files from MIGRATIONS_DIR and applies any that haven't run yet.
// Tracks applied migrations in a `schema_migrations` table inside MesaHub.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@emailflare/email-core/logger';
import { mesaDb } from './db.js';
import { env } from './env.js';

const log = createLogger('migrations');

// Split a SQL file into individual statements.
// Strips -- line comments and /* */ block comments, then splits on semicolons.
// MesaHub's REST API only accepts one statement per request.
function splitStatements(sql: string): string[] {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '') // strip /* */ block comments
    .replace(/--[^\n]*/g, '')          // strip -- line comments
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

async function ensureMigrationsTable(): Promise<void> {
  log.info('Ensuring schema_migrations table exists...');
  await mesaDb.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name       TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`,
    [],
  );
}

async function appliedMigrations(): Promise<Set<string>> {
  const result = await mesaDb.query(
    'SELECT name FROM schema_migrations ORDER BY name ASC',
    [],
  );
  const names = result.rows.map(r => (r as { name: string }).name);
  if (names.length > 0) {
    log.info('Already applied: ' + names.join(', '));
  } else {
    log.info('No migrations applied yet.');
  }
  return new Set(names);
}

export async function runMigrations(): Promise<void> {
  const dir = env.MIGRATIONS_DIR;
  log.info('Using directory: ' + dir);

  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter(f => f.endsWith('.sql')).sort();
    log.info('Found ' + String(files.length) + ' file(s): ' + files.join(', '));
  } catch (err) {
    log.warn('Directory not found: ' + dir + ' — skipping migrations');
    log.warn('Error:', err);
    return;
  }

  await ensureMigrationsTable();
  const applied = await appliedMigrations();

  let appliedCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      log.info('Skipping ' + file + ' (already applied)');
      continue;
    }

    const filePath = join(dir, file);
    log.info('── Applying ' + file + ' ──────────────────────');

    let sql: string;
    try {
      sql = await readFile(filePath, 'utf-8');
    } catch (err) {
      log.error('Failed to read ' + file + ':', err);
      throw err;
    }

    const statements = splitStatements(sql);
    log.info('  ' + String(statements.length) + ' statement(s) to execute');

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
      log.info('  [' + String(i + 1) + '/' + String(statements.length) + '] ' + preview + (stmt.length > 80 ? '…' : ''));
      try {
        await mesaDb.exec(stmt, []);
      } catch (err) {
        log.error('  FAILED statement [' + String(i + 1) + ']: ' + stmt);
        log.error('  Error:', err);
        throw new Error(`Migration ${file} failed at statement ${i + 1}: ${err}`);
      }
    }

    try {
      await mesaDb.exec(
        'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)',
        [file, new Date().toISOString()],
      );
    } catch (err) {
      log.error('  Failed to record migration ' + file + ' as applied:', err);
      throw err;
    }

    log.info('✓ Applied ' + file + ' (' + String(statements.length) + ' statements)');
    appliedCount++;
  }

  if (appliedCount === 0) {
    log.info('All migrations already applied — nothing to do.');
  } else {
    log.info('Done — applied ' + String(appliedCount) + ' migration file(s).');
  }
}

// Allow running as a standalone script: `node dist/migrate.js`
if (process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then(() => { log.info('All done.'); process.exit(0); })
    .catch(err => { log.error('Failed:', err); process.exit(1); });
}
