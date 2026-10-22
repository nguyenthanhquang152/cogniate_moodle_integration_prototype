import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createLogger } from '@cogniate/shared';
import type { OutboundClient } from '@cogniate/shared';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBuildQueue, createChannelSql, createPortContext, openExportArtifact } from './port-context.ts';

let db: DatabaseSync;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE item (id TEXT PRIMARY KEY, library_id TEXT, value TEXT);
    INSERT INTO item VALUES ('a', 'library-a', 'one'), ('b', 'library-b', 'two');`);
});
afterEach(() => db.close());

it('AC-03: refuses unscoped reads and writes, including a scope name only in a comment or value', () => {
  const sql = createChannelSql(db, 'library-a', 'a');
  for (const statement of ['SELECT * FROM item', "SELECT ':library_id' FROM item", 'SELECT * FROM item -- :library_id', 'SELECT * FROM item /* :library_id */']) {
    expect(() => sql.get(statement)).toThrow('channel_sql_unscoped');
    expect(() => sql.all(statement)).toThrow('channel_sql_unscoped');
  }
  expect(() => sql.run("UPDATE item SET value = 'changed'")).toThrow('channel_sql_unscoped');
  expect(db.prepare("SELECT value FROM item WHERE id = 'b'").get()?.value).toBe('two');
});

it('AC-03: binds the library and connection on get, all and run, even if parameters try to replace them', () => {
  const sql = createChannelSql(db, 'library-a', 'a');
  const query = 'SELECT value FROM item WHERE library_id = :library_id AND id = :connection_id';
  expect(sql.get(query, { library_id: 'library-b', ':connection_id': 'b' })).toEqual({ value: 'one' });
  expect(sql.get('SELECT * FROM item WHERE library_id = :library_id AND id = :id', { id: 'b' })).toBeUndefined();
  expect(sql.all('SELECT id FROM item WHERE library_id = :library_id')).toEqual([{ id: 'a' }]);
  expect(sql.run('UPDATE item SET value = :value WHERE library_id = :library_id AND id = :connection_id', { value: 'changed' })).toEqual({ changes: 1 });
  expect(db.prepare("SELECT value FROM item WHERE id = 'b'").get()?.value).toBe('two');
  expect(createChannelSql(db, 'library-b', null).all('SELECT value FROM item WHERE library_id = :library_id')).toEqual([{ value: 'two' }]);
});

it('seals and unseals through asynchronous functions without exposing the key or database', async () => {
  const ctx = createPortContext({ db, masterKey: Buffer.alloc(32, 7), now: () => 42,
    logger: createLogger({ service: 'test', write: () => {} }), outbound: {} as OutboundClient,
      urls: { app: 'https://app.test', lti: 'https://lti.test', content: 'https://content.test' }, lti: { getToolKeys: async () => [] },
  }, 'library-a', null, 'trace', 'Library A');
  const promise = ctx.seal('secret-token');
  expect(promise).toBeInstanceOf(Promise);
  const sealed = await promise;
  expect(Buffer.from(sealed).includes('secret-token')).toBe(false);
  expect(await ctx.unseal(sealed)).toBe('secret-token');
  expect(ctx).not.toHaveProperty('db');
  expect(ctx).not.toHaveProperty('masterKey');
  expect(ctx.now()).toBe(42);
});

it('copies only valid public key members for each call and does not cache across libraries', async () => {
  const key = { kty: 'RSA', kid: 'one', alg: 'RS256', use: 'sig', n: 'abc_123', e: 'AQAB' } as const;
  const getToolKeys = vi.fn().mockResolvedValueOnce([{ ...key, d: 'private', p: 'private' }])
    .mockResolvedValueOnce([{ ...key, kid: 'two' }]).mockResolvedValueOnce([{ ...key, n: '../bad' }])
    .mockRejectedValueOnce(new Error('service unavailable'));
  const deps = { db, masterKey: Buffer.alloc(32), now: Date.now, logger: createLogger({ service: 'test', write: () => {} }),
    outbound: {} as OutboundClient, urls: { app: 'https://app.test', lti: 'https://lti.test', content: 'https://content.test' }, lti: { getToolKeys } };
  const a = createPortContext(deps, 'library-a', null, 'trace-a', 'A');
  const b = createPortContext(deps, 'library-b', null, 'trace-b', 'B');
  expect(await a.publicToolKeys()).toEqual({ ok: true, keys: [key] });
  expect(await b.publicToolKeys()).toEqual({ ok: true, keys: [{ ...key, kid: 'two' }] });
  expect(await a.publicToolKeys()).toEqual({ ok: false });
  expect(await a.publicToolKeys()).toEqual({ ok: false });
  expect(getToolKeys.mock.calls.slice(0, 2)).toEqual([['cogniate', 'trace-a'], ['cogniate', 'trace-b']]);
});

it('binds queue reads and downloads to the submitting library and ignores channel build controls', async () => {
  const root = mkdtempSync(join(tmpdir(), 'port-queue-'));
  try {
    for (const folder of ['requests', 'status', 'out']) mkdirSync(join(root, folder), { mode: 0o700 });
    db.exec("CREATE TABLE mbz_build (id TEXT, library_id TEXT); INSERT INTO mbz_build VALUES ('build-a', 'library-a'), ('build-b', 'library-b')");
    const queue = createBuildQueue(db, 'library-a', root, { hold: false, failAt: '' });
    await queue.submit('build-a', { libraryId: 'library-b', buildId: 'build-b', hold: true, failAt: 'backup', title: 'Course' });
    const path = join(root, 'requests/build-a.json');
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ libraryId: 'library-a', buildId: 'build-a', hold: false, failAt: '', title: 'Course' });
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(await queue.pending('build-a')).toBe(true);
    expect(await queue.pending('build-b')).toBe(false);
    for (const id of ['build-b', 'unknown']) {
      await expect(queue.status(id)).rejects.toMatchObject({ status: 404 });
      await expect(openExportArtifact(db, 'library-a', root, id, 'mbz')).rejects.toMatchObject({ status: 404 });
    }
    await expect(queue.submit('../escape', {})).rejects.toThrow('build_artifact_invalid');
    writeFileSync(join(root, 'out/build-a.mbz'), 'backup');
    const file = await openExportArtifact(db, 'library-a', root, 'build-a', 'mbz');
    expect(await file.readFile('utf8')).toBe('backup');
    await file.close();
    await expect(openExportArtifact(db, 'library-a', root, 'build-a', '../../secret')).rejects.toMatchObject({ status: 404 });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses untrusted status fields, oversized status files and symlinked files', async () => {
  const root = mkdtempSync(join(tmpdir(), 'port-status-'));
  try {
    for (const folder of ['requests', 'status', 'out']) mkdirSync(join(root, folder), { mode: 0o700 });
    db.exec("CREATE TABLE mbz_build (id TEXT, library_id TEXT); INSERT INTO mbz_build VALUES ('build-a', 'library-a')");
    const queue = createBuildQueue(db, 'library-a', root, { hold: false, failAt: '' });
    const path = join(root, 'status/build-a.json');
    writeFileSync(path, JSON.stringify({ status: 'ready', step: 'done', bytes: 12 }));
    expect(await queue.status('build-a')).toEqual({ status: 'ready', step: 'done', bytes: 12 });
    for (const data of [{ status: 'ready', command: 'run' }, { status: 'ready', bytes: -1 }, { status: 'unknown' }, { status: 'ready', step: '../outside' }]) {
      writeFileSync(path, JSON.stringify(data));
      expect(await queue.status('build-a')).toBeNull();
    }
    writeFileSync(path, ' '.repeat(65537));
    expect(await queue.status('build-a')).toBeNull();
    rmSync(path);
    const target = join(root, 'secret');
    writeFileSync(target, JSON.stringify({ status: 'ready' }));
    symlinkSync(target, path);
    symlinkSync(target, join(root, 'out/build-a.mbz'));
    symlinkSync(target, join(root, 'requests/build-a.json'));
    expect(await queue.status('build-a')).toBeNull();
    expect(await queue.pending('build-a')).toBe(false);
    await expect(openExportArtifact(db, 'library-a', root, 'build-a', 'mbz')).rejects.toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
