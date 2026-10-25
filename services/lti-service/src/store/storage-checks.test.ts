import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { openSqlite, sha256Hex } from '@cogniate/shared';
import { openDb } from '../db/index.ts';
import { ensureAccount } from './accounts.ts';
import { createPlatform } from './platforms.ts';
import { cleanupStorageChecks, consumeStorageCheck, createStorageCheck, STORAGE_CHECK_TTL_MS } from './storage-checks.ts';
import type { PreparedLaunch } from './storage-checks.ts';

const close: Array<() => void> = [];
afterEach(() => { for (const fn of close.splice(0)) fn(); });
function setup() {
  const db = openDb(':memory:');
  close.push(() => db.close());
  ensureAccount(db, { id: 'unit', name: 'Unit', appUrl: 'https://app.test' });
  const p = createPlatform(db, 'unit', { issuer: 'https://lms.test', clientId: 'client', name: 'Unit', active: true, authEndpoint: 'https://lms.test/auth', tokenEndpoint: 'https://lms.test/token', jwksUrl: 'https://lms.test/jwks', deploymentIds: ['1'] });
  const prepared: PreparedLaunch = { platformId: p.id, deploymentId: '1', messageType: 'LtiResourceLinkRequest', claims: { sub: 'subject' }, siteOrigin: 'https://site.test', serviceOrigin: 'https://service.test', bindingGeneration: 3, removedClaims: ['email'] };
  const record = { stateHash: sha256Hex('state'), prepared };
  return { db, record };
}

it('stores only the check hash and consumes once within the correct account', () => {
  const { db, record } = setup();
  const check = createStorageCheck(db, 'unit', record, 1_000);
  const row = db.prepare('SELECT * FROM storage_check').get();
  expect(row).toMatchObject({ check_hash: sha256Hex(check), state_hash: record.stateHash, used_at: null, expires_at: 1_000 + STORAGE_CHECK_TTL_MS });
  expect(JSON.stringify(row)).not.toContain(check);
  expect(consumeStorageCheck(db, 'other', check, 1_001)).toBeNull();
  expect(consumeStorageCheck(db, 'unit', check, 1_001)).toEqual(record);
  expect(consumeStorageCheck(db, 'unit', check, 1_001)).toBeNull();
});

it('expires at 120 seconds, including the controlled 121-second case (AC-04)', () => {
  const { db, record } = setup();
  const before = createStorageCheck(db, 'unit', record, 1_000);
  const boundary = createStorageCheck(db, 'unit', record, 1_000);
  const after = createStorageCheck(db, 'unit', record, 1_000);
  expect(consumeStorageCheck(db, 'unit', before, 120_999)).toEqual(record);
  expect(consumeStorageCheck(db, 'unit', boundary, 121_000)).toBeNull();
  expect(consumeStorageCheck(db, 'unit', after, 122_000)).toBeNull();
});

it('cleans rows older than ten minutes and keeps the boundary and newer rows, used or unused (AC-04)', () => {
  const { db, record } = setup();
  for (const created of [99, 100, 101]) {
    const used = createStorageCheck(db, 'unit', record, created);
    createStorageCheck(db, 'unit', record, created);
    consumeStorageCheck(db, 'unit', used, created);
  }
  expect(cleanupStorageChecks(db, 600_100)).toEqual({ table: 'storage_check', deleted: 2 });
  expect(db.prepare('SELECT created_at, used_at FROM storage_check ORDER BY created_at, used_at').all()).toEqual([
    { created_at: 100, used_at: null }, { created_at: 100, used_at: 100 }, { created_at: 101, used_at: null }, { created_at: 101, used_at: 101 },
  ]);
});

it('adds an empty storage check table to a copy of an M1 database without changing existing launches', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lti-storage-check-migration-'));
  const migrations = fileURLToPath(new URL('../db/migrations', import.meta.url));
  const old = join(dir, 'm1');
  mkdirSync(old);
  for (const name of readdirSync(migrations).filter((name) => name < '005')) copyFileSync(join(migrations, name), join(old, name));
  const fixture = join(dir, 'm1.db');
  let db = openSqlite(fixture, old);
  try {
    db.exec("INSERT INTO tool_account VALUES ('unit', 'Unit', 'hash', 'launch', 'deep', 'register', 1)");
    db.exec("INSERT INTO platform (id, tool_account_id, issuer, client_id, name, auth_endpoint, token_endpoint, jwks_url, created_at, updated_at) VALUES ('p', 'unit', 'https://lms.test', 'c', 'Unit', 'https://lms.test/a', 'https://lms.test/t', 'https://lms.test/k', 1, 1)");
    db.exec("INSERT INTO launch (id, tool_account_id, platform_id, deployment_id, message_type, claims, ltik_hash, expires_at, created_at) VALUES ('launch', 'unit', 'p', '1', 'LtiResourceLinkRequest', '{}', 'hash', 1000, 1)");
    const before = db.prepare('SELECT * FROM launch').all();
    db.close();
    const copy = join(dir, 'migrated.db');
    copyFileSync(fixture, copy);
    db = openDb(copy);
    expect(db.prepare('SELECT * FROM launch').all()).toEqual(before);
    expect(db.prepare('SELECT * FROM storage_check').all()).toEqual([]);
    expect(db.prepare("SELECT name FROM schema_migration WHERE name = '015_storage_check.sql'").get()).toBeDefined();
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});
