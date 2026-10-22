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

let savepoints = 0;

/**
 * Commit buffers of the open transaction() scopes of each connection: [outermost, ...savepoints] (BD-A2-60). A
 * connection with no open scope has no entry.
 */
const commitScopes = new WeakMap<Db, Array<Array<() => void>>>();

/** Each callback runs once. A failing callback never changes the transaction result or stops the next callback. */
function runCallbacks(callbacks: Array<() => void>): void {
  for (const callback of callbacks) {
    try { callback(); } catch { /* The callback owner reports its own failure (for example metrics_observer_failed). */ }
  }
}

/**
 * Run fn once after the outermost COMMIT of the current transaction() scope (BD-A2-60; LA-ADR-06 D4 T0). In a
 * SAVEPOINT scope, fn waits in the buffer of that scope: RELEASE moves it to the parent scope, ROLLBACK TO drops it.
 * ROLLBACK drops every buffer. With no open scope, fn runs at once (autocommit, or a transaction that this helper
 * did not open). fn must be synchronous; an error in fn is caught.
 */
export function afterCommit(db: Db, fn: () => void): void {
  const scopes = commitScopes.get(db);
  if (scopes && scopes.length > 0) scopes[scopes.length - 1]!.push(fn);
  else runCallbacks([fn]);
}

function openScope(db: Db): Array<() => void> {
  const buffer: Array<() => void> = [];
  const scopes = commitScopes.get(db);
  if (scopes) scopes.push(buffer);
  else commitScopes.set(db, [buffer]);
  return buffer;
}

/** Remove the innermost scope. Gives the parent buffer, or null when it was the last scope. */
function closeScope(db: Db): Array<() => void> | null {
  const scopes = commitScopes.get(db) ?? [];
  scopes.pop();
  if (scopes.length === 0) {
    commitScopes.delete(db);
    return null;
  }
  return scopes[scopes.length - 1]!;
}

function assertSynchronous(result: unknown): void {
  if (result !== null && (typeof result === 'object' || typeof result === 'function') &&
    'then' in result && typeof result.then === 'function') {
    throw new TypeError('transaction() callback must be synchronous; it returned a thenable');
  }
}

/**
 * Run fn in BEGIN IMMEDIATE ... COMMIT (ROLLBACK on error). Inside an open transaction (a store function called in the
 * transaction of an audited change, LA-ADR-06 D4), fn runs in a SAVEPOINT instead: RELEASE on success; on error,
 * ROLLBACK TO and RELEASE, then the error goes to the outer transaction. A thenable result is an error (D4 T2).
 * Do async work before this call: the guard cannot stop work that the callback already started.
 * afterCommit() callbacks of a scope follow the scope: they run after the outermost COMMIT, or are dropped on rollback.
 */
export function transaction<T>(db: Db, fn: () => T): T {
  if (db.isTransaction) {
    const name = `nested_${++savepoints}`;
    db.exec(`SAVEPOINT ${name}`);
    const buffer = openScope(db);
    let released = false;
    try {
      const result = fn();
      assertSynchronous(result);
      db.exec(`RELEASE ${name}`);
      released = true;
      return result;
    } catch (err) {
      try {
        if (db.isTransaction) {
          db.exec(`ROLLBACK TO ${name}`);
          db.exec(`RELEASE ${name}`);
        }
      } catch { /* Keep the first error if rollback or release fails (D4 T5). */ }
      throw err;
    } finally {
      const parent = closeScope(db);
      // A released savepoint commits nothing yet: its callbacks wait for the parent. With no parent scope (an outer
      // transaction that this helper did not open), they run now, as afterCommit() does.
      if (released) {
        if (parent) parent.push(...buffer);
        else runCallbacks(buffer);
      }
    }
  }
  db.exec('BEGIN IMMEDIATE');
  const buffer = openScope(db);
  let committed = false;
  try {
    const result = fn();
    assertSynchronous(result);
    db.exec('COMMIT');
    committed = true;
    return result;
  } catch (err) {
    try {
      if (db.isTransaction) db.exec('ROLLBACK');
    } catch { /* Keep the first error if rollback fails (D4 T5). */ }
    throw err;
  } finally {
    closeScope(db);
    if (committed) runCallbacks(buffer);
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
