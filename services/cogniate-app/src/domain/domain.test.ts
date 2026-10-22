import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MigrationChangedError, openDb } from './db.ts';
import { createSession, ensureLibrary, findSession, findUserByEmail, upsertUser } from './libraries.ts';
import { hashPassword, verifyPassword } from './passwords.ts';
import { prepareStore } from './package-store.ts';

describe('migrations (ADR-006)', () => {
  it('stores the SHA-256; a changed or missing applied file stops the start', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mig-'));
    const file = join(mkdtempSync(join(tmpdir(), 'db-')), 'x.db');
    writeFileSync(join(dir, '001_a.sql'), 'CREATE TABLE a (id TEXT);');
    openDb(file, dir).close();
    openDb(file, dir).close(); // same file: fine
    writeFileSync(join(dir, '001_a.sql'), 'CREATE TABLE a (id TEXT, b TEXT);');
    expect(() => openDb(file, dir)).toThrow(MigrationChangedError);
    expect(() => openDb(file, dir)).toThrow(/changed after it was applied/);
    const other = mkdtempSync(join(tmpdir(), 'mig-'));
    writeFileSync(join(other, '002_b.sql'), 'CREATE TABLE b (id TEXT);');
    expect(() => openDb(file, other)).toThrow(/the file is gone/);
  });

  it('the real migrations apply to an empty database', () => {
    const db = openDb(':memory:');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((r) => r.name);
    expect(tables).toEqual(['app_session', 'app_user', 'approved_deployment', 'attempt', 'binding_attempt', 'binding_grant', 'binding_ref_history', 'connection',
      'connection_deployment', 'course', 'course_version', 'gradebook_read', 'handoff', 'job_instance', 'job_lease', 'learning_record', 'library', 'mbz_build', 'package', 'picker_session', 'placement',
      'play_session', 'publication', 'record_dispatch', 'resource_link', 'schema_migration', 'score_sync', 'sqlite_sequence']);
  });
});

describe('passwords and sessions', () => {
  it('scrypt hash round trip; a wrong password or a bad hash is false', async () => {
    const hash = await hashPassword('correct horse');
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/);
    expect(await verifyPassword('correct horse', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
    expect(await verifyPassword('x', 'plain')).toBe(false);
  });

  it('sessions keep only a hash of the token; a new password ends old sessions', async () => {
    const db = openDb(':memory:');
    const lib = ensureLibrary(db, 'Lib', 1);
    expect(ensureLibrary(db, 'Lib', 2)).toEqual(lib);
    const user = await upsertUser(db, { email: 'A@x.test', name: 'A', role: 'owner', libraryId: lib.id, password: 'pw-123456' }, 1);
    expect(user.email).toBe('a@x.test');
    const { token } = createSession(db, user.id, 1000);
    expect(JSON.stringify(db.prepare('SELECT * FROM app_session').all())).not.toContain(token);
    expect(findSession(db, token, 2000)?.library).toEqual(lib);
    await upsertUser(db, { email: 'a@x.test', name: 'A', role: 'owner', libraryId: lib.id, password: 'pw-new-123' }, 3);
    expect(findSession(db, token, 3000)).toBeUndefined();
    expect(await verifyPassword('pw-new-123', findUserByEmail(db, 'a@x.test')!.passwordHash)).toBe(true);
  });
});

describe('package store', () => {
  it('makes the folders and empties the temp folder', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'store-'));
    const paths = await prepareStore(dataDir);
    writeFileSync(join(paths.tmp, 'old.part'), 'x');
    await prepareStore(dataDir);
    const { readdirSync } = await import('node:fs');
    expect(readdirSync(paths.tmp)).toEqual([]);
    expect(readdirSync(dataDir).sort()).toEqual(['packages', 'uploads']);
  });
});
