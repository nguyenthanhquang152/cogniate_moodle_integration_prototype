// SQLite migration runner for both services (ADR-006 migration rule, ADR-008 `migrations`).
// Plain SQL files in name order, one transaction each. Each applied file is stored with its SHA-256; if an applied
// file changed or is gone, the service stops at start with a clear message (never edit an applied migration).
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

export class MigrationChangedError extends Error {
  constructor(name: string, why: string) {
    super(`Migration ${name} ${why}. Never edit an applied migration: add a new file. For a fresh local database: npm run stack:reset.`);
    this.name = 'MigrationChangedError';
  }
}

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/** Run fn in BEGIN IMMEDIATE ... COMMIT (ROLLBACK on error). */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Apply the migrations of `dir` to `db`. A bookkeeping table from before the checksum rule (no sha256 column)
 * is upgraded once: the applied files get the hash of their current content.
 */
export function applyMigrations(db: Db, dir: string): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migration (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at INTEGER NOT NULL)');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const text = new Map(files.map((f) => [f, readFileSync(join(dir, f), 'utf8')]));
  const columns = db.prepare('PRAGMA table_info(schema_migration)').all().map((c) => String(c.name));
  if (!columns.includes('sha256')) {
    transaction(db, () => {
      db.exec("ALTER TABLE schema_migration ADD COLUMN sha256 TEXT NOT NULL DEFAULT ''");
      for (const r of db.prepare('SELECT name FROM schema_migration').all()) {
        const content = text.get(String(r.name));
        if (content !== undefined) db.prepare('UPDATE schema_migration SET sha256 = ? WHERE name = ?').run(sha256(content), String(r.name));
      }
    });
  }
  const applied = new Map(db.prepare('SELECT name, sha256 FROM schema_migration').all().map((r) => [String(r.name), String(r.sha256)]));
  for (const name of applied.keys()) if (!text.has(name)) throw new MigrationChangedError(name, 'was applied, but the file is gone');
  for (const name of files) {
    const sql = text.get(name)!;
    const hash = sha256(sql);
    const known = applied.get(name);
    if (known !== undefined) {
      if (known !== hash) throw new MigrationChangedError(name, `changed after it was applied (sha256 ${known.slice(0, 12)} -> ${hash.slice(0, 12)})`);
      continue;
    }
    transaction(db, () => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migration (name, sha256, applied_at) VALUES (?, ?, ?)').run(name, hash, Date.now());
    });
  }
}

/**
 * Open a service database (ADR-006): foreign keys on, busy_timeout 5000, WAL for files; then apply the migrations.
 * ":memory:" is for unit tests. On a migration error the database is closed and the error is thrown.
 */
export function openSqlite(file: string, migrationsDir: string): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
    applyMigrations(db, migrationsDir);
  } catch (err) {
    db.close();
    throw err;
  }
  return db;
}
