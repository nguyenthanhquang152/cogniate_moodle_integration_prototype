import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSqlite } from '@cogniate/shared';
import { expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { createPlatform } from './platforms.ts';
import { ensureAccount } from './accounts.ts';
import { consumeState, saveState } from './states.ts';

it('stores and returns storage metadata, defaults old callers to null and keeps state single use (AC-08)', () => {
  const db = openDb(':memory:');
  try {
    ensureAccount(db, { id: 'unit', name: 'Unit', appUrl: 'https://app.example.edu' });
    const p = createPlatform(db, 'unit', { issuer: 'https://lms.example.edu', clientId: 'client', name: 'Unit', active: true, authEndpoint: 'https://lms.example.edu/auth', tokenEndpoint: 'https://lms.example.edu/token', jwksUrl: 'https://lms.example.edu/jwks', deploymentIds: ['1'] });
    const base = { toolAccountId: 'unit', platformId: p.id, nonce: 'nonce', targetLinkUri: 'https://tool.example.edu/launch', expiresAt: 200, loginDeploymentId: null };
    saveState(db, { ...base, stateHash: 'storage', storageTarget: '_parent', storageOrigin: 'https://auth.example.edu' }, 100);
    saveState(db, { ...base, stateHash: 'cookie' }, 100);
    expect(consumeState(db, 'unit', 'storage', 100)).toMatchObject({ storageTarget: '_parent', storageOrigin: 'https://auth.example.edu' });
    expect(consumeState(db, 'unit', 'storage', 100)).toBeNull();
    expect(consumeState(db, 'unit', 'cookie', 100)).toMatchObject({ storageTarget: null, storageOrigin: null });
  } finally { db.close(); }
});

it('migration 014 gives every copied M1 state null storage columns and preserves old fields (AC-09)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lti-storage-migration-'));
  const migrations = fileURLToPath(new URL('../db/migrations', import.meta.url));
  const old = join(dir, 'm1');
  mkdirSync(old);
  for (const name of readdirSync(migrations).filter((name) => name < '005')) copyFileSync(join(migrations, name), join(old, name));
  const fixture = join(dir, 'm1.db');
  let db = openSqlite(fixture, old);
  try {
    db.exec("INSERT INTO tool_account VALUES ('unit', 'Unit', 'hash', 'launch', 'deep', 'register', 1)");
    db.exec("INSERT INTO platform (id, tool_account_id, issuer, client_id, name, auth_endpoint, token_endpoint, jwks_url, created_at, updated_at) VALUES ('p', 'unit', 'https://lms.test', 'c', 'Unit', 'https://lms.test/a', 'https://lms.test/t', 'https://lms.test/k', 1, 1)");
    for (let i = 0; i < 3; i++) db.prepare('INSERT INTO oidc_state (state_hash, tool_account_id, platform_id, nonce, target_link_uri, expires_at, used_at, login_deployment_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(`s${i}`, 'unit', 'p', `n${i}`, 'https://tool.test/launch', 100 + i, i === 1 ? 2 : null, i === 2 ? 'deployment' : null);
    const before = db.prepare('SELECT * FROM oidc_state ORDER BY state_hash').all();
    db.close();
    const copy = join(dir, 'migrated.db');
    copyFileSync(fixture, copy);
    db = openDb(copy);
    expect(db.prepare('SELECT * FROM oidc_state ORDER BY state_hash').all()).toEqual(before.map((row) => ({ ...row, storage_target: null, storage_origin: null })));
    expect(db.prepare("SELECT name FROM schema_migration WHERE name = '014_platform_storage.sql'").get()).toBeDefined();
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});
