import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KeyProviderError, bindKeyProvider, blobKeyVersion, createLocalKeyProvider, encrypt, openSqlite } from '@cogniate/shared';
import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { URLS } from '../testkit.ts';
import { ensureAccount } from './accounts.ts';
import type { RegistrationTokenKind } from './registrations.ts';
import { completeRegistrationSession, createRegistrationSession, getRegistrationSession, registrationTokenVersions } from './registrations.ts';

// Fixture keys (test values, not secrets).
const LEGACY = Buffer.alloc(32, 7);
const K2 = Buffer.alloc(32, 2);
const NOW = 1_000_000;

function setup() {
  const db = openDb(':memory:');
  ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
  ensureAccount(db, { id: 'qa-second', name: 'QA second', appUrl: URLS.app });
  const handle = Buffer.alloc(32, 7);
  bindKeyProvider(handle, createLocalKeyProvider({ active: 'k2', keys: new Map([['legacy', LEGACY], ['k2', K2]]) }));
  const create = (accountId: string, registrationToken: string | null, clientKey?: string, tokenKind?: RegistrationTokenKind) => createRegistrationSession(db, handle, {
    toolAccountId: accountId, openidConfigurationUrl: 'https://moodle.test/.well-known/openid-configuration', registrationToken,
    platformConfiguration: {}, operation: 'new', existingPlatformId: null, privacyLevel: 'public', passthrough: {}, expiresAt: NOW + 3600_000,
    ...(clientKey ? { clientKey } : {}), ...(tokenKind ? { tokenKind } : {}),
  }, NOW);
  const tokenBlob = (id: string) => (db.prepare('SELECT registration_token_encrypted AS b FROM registration_session WHERE id = ?').get(id) as { b: Uint8Array | null }).b;
  const setBlob = (id: string, blob: Uint8Array) => db.prepare('UPDATE registration_session SET registration_token_encrypted = ? WHERE id = ?').run(blob, id);
  return { db, handle, create, tokenBlob, setBlob };
}

describe('registration token kind (LA-ADR-02 D5 item 3, LTI migration 021)', () => {
  it('stores the kind that the start page found; no kind is null', () => {
    const s = setup();
    const opaque = s.create('cogniate', 'opaque-token', undefined, 'opaque-bearer');
    expect(getRegistrationSession(s.db, s.handle, 'cogniate', opaque.id, NOW)).toMatchObject({ tokenKind: 'opaque-bearer', registrationToken: 'opaque-token' });
    const jwt = s.create('cogniate', 'jwt-token', undefined, 'scope-jwt');
    expect(getRegistrationSession(s.db, s.handle, 'cogniate', jwt.id, NOW)?.tokenKind).toBe('scope-jwt');
    expect(getRegistrationSession(s.db, s.handle, 'cogniate', s.create('cogniate', null).id, NOW)?.tokenKind).toBeNull();
  });

  it('gives a session row from before migration 021 a NULL kind and keeps its other columns', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lti-token-kind-'));
    const migrations = fileURLToPath(new URL('../db/migrations', import.meta.url));
    const old = join(dir, 'old');
    mkdirSync(old);
    for (const name of readdirSync(migrations).filter((name) => name < '021')) copyFileSync(join(migrations, name), join(old, name));
    const file = join(dir, 'lti.db');
    let db = openSqlite(file, old);
    try {
      ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
      db.prepare(`INSERT INTO registration_session (id, tool_account_id, openid_configuration_url, platform_configuration, operation, privacy_level,
        passthrough_params, expires_at, created_at) VALUES ('reg_old', 'cogniate', 'https://moodle.test/c', '{}', 'update', 'public', '{}', ?, ?)`).run(NOW + 1, NOW);
      const before = db.prepare("SELECT * FROM registration_session WHERE id = 'reg_old'").get();
      db.close();
      db = openDb(file);
      expect(db.prepare("SELECT * FROM registration_session WHERE id = 'reg_old'").get()).toEqual({ ...before, token_kind: null });
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('registration sessions with the key provider (LA-ADR-06 D6)', () => {
  it('keeps the address key only while the registration is open (BD-A2-20)', () => {
    const s = setup();
    const a = s.create('cogniate', 'reg-token', '192.0.2.1');
    expect(getRegistrationSession(s.db, s.handle, 'cogniate', a.id, NOW)?.clientKey).toBe('192.0.2.1');
    expect(s.create('qa-second', null).clientKey).toBeNull();
    completeRegistrationSession(s.db, 'cogniate', a.id, 'plt_completed', NOW);
    expect(getRegistrationSession(s.db, s.handle, 'cogniate', a.id, NOW)).toMatchObject({ status: 'completed', clientKey: null, registrationToken: null });
    s.db.close();
  });

  it('the token is sealed with the active version, bound to its row, and opens', () => {
    const s = setup();
    const a = s.create('cogniate', 'reg-token-a');
    expect(blobKeyVersion(s.tokenBlob(a.id)!)).toBe('k2');
    expect(Buffer.from(s.tokenBlob(a.id)!).toString('latin1')).not.toContain('reg-token-a');
    expect(getRegistrationSession(s.db, s.handle, 'cogniate', a.id, NOW)?.registrationToken).toBe('reg-token-a');
    expect(s.tokenBlob(s.create('cogniate', null).id)).toBeNull();
    expect(registrationTokenVersions(s.db)).toEqual(['k2']);
  });

  it('a token blob copied into the session of another account does not open', () => {
    const s = setup();
    const a = s.create('cogniate', 'reg-token-a');
    const b = s.create('qa-second', 'reg-token-b');
    s.setBlob(b.id, s.tokenBlob(a.id)!);
    expect(() => getRegistrationSession(s.db, s.handle, 'qa-second', b.id, NOW)).toThrow(KeyProviderError);
  });

  it('an existing session (legacy blob, no header) still opens', () => {
    const s = setup();
    const a = s.create('cogniate', 'placeholder');
    s.setBlob(a.id, encrypt(LEGACY, 'reg-token-old'));
    expect(getRegistrationSession(s.db, s.handle, 'cogniate', a.id, NOW)?.registrationToken).toBe('reg-token-old');
    expect(registrationTokenVersions(s.db)).toEqual(['legacy']);
  });
});
