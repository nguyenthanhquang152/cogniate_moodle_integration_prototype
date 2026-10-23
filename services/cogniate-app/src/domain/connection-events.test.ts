import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { seedBase } from '../kernel/records/records.testkit.ts';
import {
  CONNECTION_EVENT_LIMIT, CONNECTION_EVENT_TTL_MS, checkEventCode, checkEventParts, deleteExpiredConnectionEvents, listConnectionEvents,
  recordConnectionEvent,
} from './connection-events.ts';
import { getConnection } from './connections.ts';
import type { Db } from './db.ts';
import { openDb } from './db.ts';
import { retentionJob } from './retention.ts';

const dirs: string[] = [];
const dbs: Db[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
/** A temporary database with library "lib", connection "con", and a second library with connection "con_b". */
function database(): Db {
  const dir = mkdtempSync(join(tmpdir(), 'connection-events-'));
  dirs.push(dir);
  const db = openDb(join(dir, 'app.db'));
  dbs.push(db);
  seedBase(db);
  db.exec(`INSERT INTO library (id, name, created_at) VALUES ('lib_b', 'Library B', 0);
    INSERT INTO connection (id, library_id, name, site_url, method, status, channel, binding_authority, created_at, updated_at)
      VALUES ('con_b', 'lib_b', 'Other', 'https://other.test', 'manual', 'connected', 'canvas', 'operatorGrant', 0, 0);`);
  return db;
}
const event = (code: string, connectionId = 'con', libraryId = 'lib') => ({ connectionId, libraryId, kind: 'launch_refused' as const, code, traceId: `trace-${code}` });

describe('connection events (LA-ADR-08 D5)', () => {
  it('AC-LA-E6-02-06: keeps the newest 100 rows per connection; another connection keeps its own rows', () => {
    const db = database();
    // A-LA-E6-02-02: the 100 of LA-ADR-08 D5 is written here, not read from the code.
    expect(CONNECTION_EVENT_LIMIT).toBe(100);
    recordConnectionEvent(db, event('other', 'con_b', 'lib_b'), 1);
    for (let i = 0; i < 105; i++) recordConnectionEvent(db, event(`code_${i}`), 1000 + i);
    const kept = listConnectionEvents(db, 'lib', 'con');
    expect(kept).toHaveLength(100);
    expect(kept[0]).toEqual({ kind: 'launch_refused', code: 'code_104', traceId: 'trace-code_104', at: 1104 });
    expect(kept.at(-1)!.code).toBe('code_5');
    expect(Number(db.prepare("SELECT COUNT(*) AS n FROM connection_event WHERE connection_id = 'con'").get()!.n)).toBe(100);
    expect(listConnectionEvents(db, 'lib_b', 'con_b').map((row) => row.code)).toEqual(['other']);
  });

  it('reads only the rows of the given library', () => {
    const db = database();
    recordConnectionEvent(db, event('site_mismatch'), 10);
    expect(listConnectionEvents(db, 'lib_b', 'con')).toEqual([]);
  });

  it('AC-LA-E6-02-06: the retention removes rows older than 30 days, also through the app retention job', async () => {
    const db = database();
    // A-LA-E6-02-02: the 30 days of LA-ADR-08 D5 (LA-H4) are written here, not read from the code.
    const thirtyDays = 30 * 86_400_000;
    expect(CONNECTION_EVENT_TTL_MS).toBe(thirtyDays);
    const now = 100 * 86_400_000;
    recordConnectionEvent(db, event('old'), now - thirtyDays - 1);
    recordConnectionEvent(db, event('edge'), now - thirtyDays);
    recordConnectionEvent(db, event('new'), now - 1000);
    expect(deleteExpiredConnectionEvents(db, now)).toEqual({ table: 'connection_event', deleted: 1 });
    expect(listConnectionEvents(db, 'lib', 'con').map((row) => row.code)).toEqual(['new', 'edge']);
    recordConnectionEvent(db, event('older'), now - thirtyDays - 5);
    const logger = createLogger({ service: 'test', write: () => {} });
    const result = await retentionJob(db).run({ instanceId: 'i', bootId: 'b', leaseOwner: 'i/b', traceId: 't', now: () => now, logger, signal: new AbortController().signal });
    expect(result.counts).toMatchObject({ connection_event: 1 });
    expect(listConnectionEvents(db, 'lib', 'con').map((row) => row.code)).toEqual(['new', 'edge']);
  });

  it('AC-LA-E6-02-07: migration 016 keeps an old connection working, with artifact_key_kid NULL', () => {
    const migrations = fileURLToPath(new URL('./migrations/', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'connection-health-migration-'));
    dirs.push(dir);
    // A database with every other migration applied (017 and 018 landed first), then 016 arrives.
    for (const file of readdirSync(migrations).filter((f) => f.endsWith('.sql') && f !== '016_connection_health.sql')) copyFileSync(join(migrations, file), join(dir, file));
    let db = openDb(join(dir, 'app.db'), dir);
    seedBase(db);
    const before = db.prepare("SELECT * FROM connection WHERE id = 'con'").get();
    expect(before).not.toHaveProperty('artifact_key_kid');
    db.close();
    copyFileSync(join(migrations, '016_connection_health.sql'), join(dir, '016_connection_health.sql'));
    db = openDb(join(dir, 'app.db'), dir);
    dbs.push(db);
    expect(db.prepare("SELECT * FROM connection WHERE id = 'con'").get()).toEqual({ ...before, artifact_key_kid: null });
    expect(getConnection(db, 'lib', 'con')).toMatchObject({ id: 'con', status: 'connected', channel: 'moodle' });
    recordConnectionEvent(db, event('site_mismatch'), 5);
    expect(listConnectionEvents(db, 'lib', 'con').map((row) => row.code)).toEqual(['site_mismatch']);
  });

  it('codes a check result and reads its parts back', () => {
    const ok = { jwks: { ok: true }, token: { ok: true } };
    expect(checkEventCode(ok)).toBe('ok');
    expect(checkEventCode({ jwks: { ok: true }, token: { ok: false, detail: 'invalid_client' } })).toBe('token:invalid_client');
    expect(checkEventCode({ jwks: { ok: false, detail: 'http_404' }, token: { ok: false, detail: 'timeout' } })).toBe('jwks:http_404 token:timeout');
    expect(checkEventParts('ok')).toEqual({ jwks: true, token: true });
    expect(checkEventParts('token:invalid_client')).toEqual({ jwks: true, token: false });
    expect(checkEventParts('jwks:http_404 token:timeout')).toEqual({ jwks: false, token: false });
  });
});
