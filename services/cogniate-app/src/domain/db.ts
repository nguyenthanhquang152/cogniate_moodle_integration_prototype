import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export type Db = DatabaseSync;

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/** An applied migration file changed or is gone (ADR-006). The service must not start. */
export class MigrationChangedError extends Error {
  constructor(name: string, why: string) {
    super(`Migration ${name} ${why}. Never edit an applied migration: add a new file. For a fresh local database: npm run stack:reset.`);
    this.name = 'MigrationChangedError';
  }
}

/**
 * Open cogniate.db and apply the plain SQL migrations (ADR-006) in file-name order, each in one transaction.
 * Each applied migration is stored with its SHA-256; a changed or missing applied file stops the start.
 * ":memory:" is for unit tests. Only the repository modules in this folder use SQL.
 */
export function openDb(file: string, migrationsDir = MIGRATIONS_DIR): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
    db.exec('CREATE TABLE IF NOT EXISTS schema_migration (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at INTEGER NOT NULL)');
    const applied = new Map(db.prepare('SELECT name, sha256 FROM schema_migration').all().map((r) => [String(r.name), String(r.sha256)]));
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const name of applied.keys()) if (!files.includes(name)) throw new MigrationChangedError(name, 'was applied, but the file is gone');
    for (const name of files) {
      const sql = readFileSync(join(migrationsDir, name), 'utf8');
      const sha256 = createHash('sha256').update(sql, 'utf8').digest('hex');
      const known = applied.get(name);
      if (known !== undefined) {
        if (known !== sha256) throw new MigrationChangedError(name, `changed after it was applied (sha256 ${known.slice(0, 12)} -> ${sha256.slice(0, 12)})`);
        continue;
      }
      transaction(db, () => {
        db.exec(sql);
        db.prepare('INSERT INTO schema_migration (name, sha256, applied_at) VALUES (?, ?, ?)').run(name, sha256, Date.now());
      });
    }
  } catch (err) {
    db.close();
    throw err;
  }
  return db;
}

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
