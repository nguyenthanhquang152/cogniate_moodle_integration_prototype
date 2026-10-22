import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { openSqlite } from '@cogniate/shared';
import { openDb } from '../db/index.ts';
import type { Db } from '../db/index.ts';
import { URLS } from '../testkit.ts';
import { ensureAccount } from './accounts.ts';
import { abandonIdempotency, claimIdempotency, completeIdempotency, IDEMPOTENCY_RUNNING_MS, IDEMPOTENCY_TTL_MS } from './idempotency.ts';
import type { IdempotencyClaim, RequestFingerprint, StoredAnswer } from './idempotency.ts';

const dirs: string[] = [];
const databases: Db[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const temp = () => { const dir = mkdtempSync(join(tmpdir(), 'idempotency-')); dirs.push(dir); return dir; };
function fixture(file = ':memory:') {
  const db = openDb(file); databases.push(db);
  for (const id of ['cogniate', 'qa-second']) ensureAccount(db, { id, appUrl: URLS.app });
  return db;
}
const input: RequestFingerprint = { toolAccountId: 'cogniate', key: 'request-1', method: 'POST', route: '/api/platforms', params: '{}', bodyHash: 'hash-1' };
const answer: StoredAnswer = { status: 201, body: '{"id":"plt_1"}', target: { type: 'platform', id: 'plt_1' }, code: null };
function claim(db: Db, now = 1000, request = input): IdempotencyClaim {
  const result = claimIdempotency(db, request, now);
  expect(result.kind).toBe('claimed');
  if (result.kind !== 'claimed') throw new Error('Expected claim');
  return result.claim;
}

it('migration 017 preserves existing accounts and adds an empty table', () => {
  const dir = temp(); const old = join(dir, 'old'); mkdirSync(old);
  const migrations = fileURLToPath(new URL('../db/migrations', import.meta.url));
  for (const file of readdirSync(migrations).filter((name) => name < '017')) copyFileSync(join(migrations, file), join(old, file));
  const path = join(dir, 'lti.db');
  const before = openSqlite(path, old);
  expect(before.prepare("SELECT name FROM sqlite_master WHERE name = 'idempotency_record'").get()).toBeUndefined();
  ensureAccount(before, { id: 'cogniate', appUrl: URLS.app });
  const rows = before.prepare('SELECT * FROM tool_account').all(); before.close();
  const db = openDb(path); databases.push(db);
  expect(db.prepare('SELECT * FROM tool_account').all()).toEqual(rows);
  expect(db.prepare('SELECT * FROM idempotency_record').all()).toEqual([]);
  expect(db.prepare("SELECT name FROM schema_migration WHERE name = '017_idempotency_record.sql'").get()).toBeDefined();
});

it('AC-04: arbitrates claims across independent SQLite connections, then replays the stored answer', () => {
  const file = join(temp(), 'lti.db'); const first = fixture(file);
  const second = openDb(file); databases.push(second);
  const owner = claim(first);
  expect(claimIdempotency(second, input, 1001)).toEqual({ kind: 'running', endsAt: 1000 + IDEMPOTENCY_RUNNING_MS });
  expect(completeIdempotency(first, owner, answer)).toBe(true);
  expect(claimIdempotency(second, input, 1002)).toEqual({ kind: 'replay', answer });
  expect(second.prepare('SELECT COUNT(*) AS n FROM idempotency_record').get()!.n).toBe(1);
});

it.each([
  { method: 'PUT' }, { route: '/api/lineitems' }, { params: '{"id":"another"}' }, { bodyHash: 'different-body' },
])('a key belongs to one whole fingerprint: %j', (change) => {
  const db = fixture(); const owner = claim(db);
  expect(claimIdempotency(db, { ...input, ...change }, 1001)).toEqual({ kind: 'reused' });
  completeIdempotency(db, owner, answer);
  expect(claimIdempotency(db, { ...input, ...change }, 1002)).toEqual({ kind: 'reused' });
});

it('isolates account keys and keeps 4xx status, body and audit code', () => {
  const db = fixture(); const owner = claim(db);
  const refused = { status: 422, body: '{"details":{"message":"INVALID_REQUEST"}}', code: 'INVALID_REQUEST', target: { type: 'platform', id: null } };
  completeIdempotency(db, owner, refused);
  expect(claimIdempotency(db, input, 1001)).toEqual({ kind: 'replay', answer: refused });
  claim(db, 1001, { ...input, toolAccountId: 'qa-second' });
  expect(db.prepare('SELECT COUNT(*) AS n FROM idempotency_record').get()!.n).toBe(2);
});

it('AC-06: expires completed answers at 24 hours without deleting unrelated old rows', () => {
  const db = fixture(); const owner = claim(db);
  completeIdempotency(db, owner, answer);
  const other = claim(db, 1000, { ...input, key: 'untouched' }); completeIdempotency(db, other, answer);
  expect(claimIdempotency(db, input, 1000 + IDEMPOTENCY_TTL_MS - 1).kind).toBe('replay');
  const next = claim(db, 1000 + IDEMPOTENCY_TTL_MS);
  expect(next.owner).not.toBe(owner.owner);
  expect(db.prepare("SELECT created_at FROM idempotency_record WHERE key = 'untouched'").get()!.created_at).toBe(1000);
});

it('abandons running claims older than 60 seconds and fences a late old owner', () => {
  const db = fixture(); const old = claim(db);
  expect(claimIdempotency(db, input, 1000 + IDEMPOTENCY_RUNNING_MS).kind).toBe('running');
  const next = claim(db, 1001 + IDEMPOTENCY_RUNNING_MS);
  expect(completeIdempotency(db, old, answer)).toBe(false);
  abandonIdempotency(db, old);
  expect(claimIdempotency(db, input, 1002 + IDEMPOTENCY_RUNNING_MS).kind).toBe('running');
  expect(completeIdempotency(db, next, answer)).toBe(true);
  expect(claimIdempotency(db, input, 1003 + IDEMPOTENCY_RUNNING_MS)).toEqual({ kind: 'replay', answer });
});

it('frees failed claims and never stores a 5xx, a 429 or a redirect (BD-A2-57)', () => {
  const db = fixture(); const owner = claim(db);
  for (const status of [302, 429, 500, 502]) expect(() => completeIdempotency(db, owner, { ...answer, status })).toThrow(RangeError);
  abandonIdempotency(db, owner);
  expect(db.prepare('SELECT * FROM idempotency_record').all()).toEqual([]);
  expect(claim(db, 1001).owner).not.toBe(owner.owner);
});
