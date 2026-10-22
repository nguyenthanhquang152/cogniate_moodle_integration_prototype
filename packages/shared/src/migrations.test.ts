import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { MigrationChangedError, openSqlite, transaction } from './migrations.ts';

const tmp = (p: string) => mkdtempSync(join(tmpdir(), p));

describe('migrations (ADR-006)', () => {
  it('applies files in name order, once, and stores their SHA-256', () => {
    const dir = tmp('mig-');
    writeFileSync(join(dir, '002_b.sql'), 'CREATE TABLE b (id TEXT REFERENCES a (id));');
    writeFileSync(join(dir, '001_a.sql'), 'CREATE TABLE a (id TEXT PRIMARY KEY);');
    const file = join(tmp('db-'), 'x.db');
    openSqlite(file, dir).close();
    const db = openSqlite(file, dir);
    const rows = db.prepare('SELECT name, sha256 FROM schema_migration ORDER BY name').all();
    expect(rows.map((r) => r.name)).toEqual(['001_a.sql', '002_b.sql']);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(String(r.sha256)))).toBe(true);
    expect(db.prepare('PRAGMA journal_mode').get()?.journal_mode).toBe('wal');
    db.close();
  });

  it('a changed applied file stops the start with a clear message; a gone file too', () => {
    const dir = tmp('mig-');
    writeFileSync(join(dir, '001_a.sql'), 'CREATE TABLE a (id TEXT);');
    const file = join(tmp('db-'), 'x.db');
    openSqlite(file, dir).close();
    writeFileSync(join(dir, '001_a.sql'), 'CREATE TABLE a (id TEXT, b TEXT);');
    expect(() => openSqlite(file, dir)).toThrow(MigrationChangedError);
    expect(() => openSqlite(file, dir)).toThrow(/001_a\.sql changed after it was applied.*add a new file/);
    rmSync(join(dir, '001_a.sql'));
    writeFileSync(join(dir, '002_b.sql'), 'CREATE TABLE b (id TEXT);');
    expect(() => openSqlite(file, dir)).toThrow(/001_a\.sql was applied, but the file is gone/);
  });

  it('upgrades a bookkeeping table without sha256 (made before the rule), then enforces the rule', () => {
    const dir = tmp('mig-');
    writeFileSync(join(dir, '001_a.sql'), 'CREATE TABLE a (id TEXT);');
    const file = join(tmp('db-'), 'old.db');
    const old = new DatabaseSync(file);
    old.exec("CREATE TABLE schema_migration (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL); CREATE TABLE a (id TEXT); INSERT INTO schema_migration VALUES ('001_a.sql', 1);");
    old.close();
    openSqlite(file, dir).close();
    writeFileSync(join(dir, '001_a.sql'), 'CREATE TABLE a (id TEXT, changed TEXT);');
    expect(() => openSqlite(file, dir)).toThrow(MigrationChangedError);
  });

  it('a failing migration rolls back and is not recorded', () => {
    const dir = tmp('mig-');
    writeFileSync(join(dir, '001_bad.sql'), 'CREATE TABLE a (id TEXT); CREATE TABLE a (id TEXT);');
    const file = join(tmp('db-'), 'x.db');
    expect(() => openSqlite(file, dir)).toThrow();
    const db = new DatabaseSync(file);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name IN ('a')").all()).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM schema_migration').get()?.n).toBe(0);
    db.close();
  });

  it('transaction rolls back on error', () => {
    const db = openSqlite(':memory:', tmp('mig-'));
    db.exec('CREATE TABLE t (v INTEGER)');
    expect(() => transaction(db, () => { db.exec('INSERT INTO t VALUES (1)'); throw new Error('x'); })).toThrow('x');
    expect(db.prepare('SELECT COUNT(*) AS n FROM t').get()?.n).toBe(0);
  });
});

describe('transaction (nested calls use a SAVEPOINT)', () => {
  const values = (db: DatabaseSync) => db.prepare('SELECT v FROM t ORDER BY v').all().map((r) => r.v);
  const table = () => {
    const db = openSqlite(':memory:', tmp('mig-'));
    db.exec('CREATE TABLE t (v INTEGER)');
    return db;
  };

  const thenables = [
    ['async result', async () => 'later'],
    ['object thenable', () => ({ then() { throw new Error('must not call then'); } })],
    ['function thenable', () => Object.assign(() => 'value', { then() { throw new Error('must not call then'); } })],
  ] as const;

  it.each(thenables)('rolls back an outer transaction that returns an %s', (_name, result) => {
    const db = table();
    try {
      expect(() => transaction(db, () => {
        db.exec('INSERT INTO t VALUES (1)');
        return result();
      })).toThrow(new TypeError('transaction() callback must be synchronous; it returned a thenable'));
      expect(db.isTransaction).toBe(false);
      expect(values(db)).toEqual([]);
    } finally { db.close(); }
  });

  it.each(thenables)('rolls back a nested %s but lets the outer transaction continue', (_name, result) => {
    const db = table();
    try {
      transaction(db, () => {
        db.exec('INSERT INTO t VALUES (1)');
        expect(() => transaction(db, () => {
          db.exec('INSERT INTO t VALUES (2)');
          return result();
        })).toThrow(new TypeError('transaction() callback must be synchronous; it returned a thenable'));
        expect(db.isTransaction).toBe(true);
        db.exec('INSERT INTO t VALUES (3)');
      });
      expect(values(db)).toEqual([1, 3]);
      expect(db.isTransaction).toBe(false);
    } finally { db.close(); }
  });

  it.each([false, true])('keeps the constraint error when SQLite ends the transaction (nested: %s)', (nested) => {
    const db = table();
    db.exec('CREATE UNIQUE INDEX t_unique ON t (v); INSERT INTO t VALUES (1)');
    const conflict = () => db.exec('INSERT OR ROLLBACK INTO t VALUES (1)');
    try {
      expect(() => transaction(db, () => {
        db.exec('INSERT INTO t VALUES (2)');
        return nested ? transaction(db, conflict) : conflict();
      })).toThrow('UNIQUE constraint failed: t.v');
      expect(values(db)).toEqual([1]);
      expect(db.isTransaction).toBe(false);
    } finally { db.close(); }
  });

  it.each(['ROLLBACK', 'ROLLBACK TO', 'RELEASE'])('keeps the exact first error when cleanup fails at %s', (step) => {
    const db = table();
    const first = new Error('change failed first');
    const exec = db.exec.bind(db);
    let cleanupFailed = false;
    const spy = vi.spyOn(db, 'exec').mockImplementation((sql) => {
      if (sql === step || sql.startsWith(`${step} nested_`)) {
        cleanupFailed = true;
        throw new Error('cleanup failed later');
      }
      exec(sql);
    });
    try {
      let caught: unknown;
      try {
        transaction(db, () => {
          const fail = () => { db.exec('INSERT INTO t VALUES (1)'); throw first; };
          return step === 'ROLLBACK' ? fail() : transaction(db, fail);
        });
      } catch (err) { caught = err; }
      expect(caught).toBe(first);
      expect(cleanupFailed).toBe(true);
    } finally {
      spy.mockRestore();
      if (db.isTransaction) db.exec('ROLLBACK');
      expect(values(db)).toEqual([]);
      db.close();
    }
  });

  it('a call outside a transaction is unchanged: BEGIN IMMEDIATE (the write lock at once), COMMIT, no open transaction after', () => {
    const file = join(tmp('db-'), 'x.db');
    const db = openSqlite(file, tmp('mig-'));
    db.exec('CREATE TABLE t (v INTEGER)');
    const other = new DatabaseSync(file);
    transaction(db, () => {
      expect(db.isTransaction).toBe(true);
      // IMMEDIATE: the lock is taken before any write, so another writer is busy at once.
      expect(() => other.exec('BEGIN IMMEDIATE')).toThrow(/locked|busy/i);
      db.exec('INSERT INTO t VALUES (1)');
    });
    expect(db.isTransaction).toBe(false);
    expect(other.prepare('SELECT v FROM t').all().map((r) => r.v)).toEqual([1]);
    other.close();
    db.close();
  });

  it('a nested call that throws rolls back only its own part; the outer transaction goes on', () => {
    const db = table();
    transaction(db, () => {
      db.exec('INSERT INTO t VALUES (1)');
      expect(() => transaction(db, () => { db.exec('INSERT INTO t VALUES (2)'); throw new Error('inner'); })).toThrow('inner');
      expect(db.isTransaction).toBe(true);
      db.exec('INSERT INTO t VALUES (3)');
    });
    expect(values(db)).toEqual([1, 3]);
  });

  it('an outer throw rolls back all, also a nested part that succeeded', () => {
    const db = table();
    expect(() => transaction(db, () => {
      db.exec('INSERT INTO t VALUES (1)');
      expect(transaction(db, () => { db.exec('INSERT INTO t VALUES (2)'); return 'ok'; })).toBe('ok');
      throw new Error('outer');
    })).toThrow('outer');
    expect(values(db)).toEqual([]);
    expect(db.isTransaction).toBe(false);
  });
});
