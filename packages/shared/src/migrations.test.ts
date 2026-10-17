import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
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
