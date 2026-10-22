import { DatabaseSync } from 'node:sqlite';
import { createLogger } from '@cogniate/shared';
import type { OutboundClient } from '@cogniate/shared';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createChannelSql, createPortContext } from './port-context.ts';

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
