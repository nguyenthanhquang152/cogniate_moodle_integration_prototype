import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bindKeyProvider, blobKeyVersion, createLocalKeyProvider, encrypt, keyProviderFor, legacyKeyRing } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { openDb, transaction } from '../db/index.ts';
import { createPlatform } from '../store/platforms.ts';
import { ensureAccount } from '../store/accounts.ts';
import { createRegistrationSession, getRegistrationSession } from '../store/registrations.ts';
import { issueServiceKey } from '../store/service-keys.ts';
import { legacyBlobsRefused, refuseLegacyBlobs } from '../store/settings.ts';
import { activePrivateJwk, ensureToolKey } from '../store/tool-keys.ts';
import { URLS, capturingLogger } from '../testkit.ts';
import { DEFAULT_KEYRING_FILE, keyVersionsInUse, loadKeyProvider, readKeyRing, readSigningKeyPublishLeadSeconds } from './key-config.ts';

// Fixture keys (test values, not secrets).
const LEGACY = Buffer.alloc(32, 7);
const K1 = Buffer.alloc(32, 1);
const K2 = Buffer.alloc(32, 2);
const hex = (key: Buffer) => key.toString('hex');
const NOW = 1_000_000;

const temps: string[] = [];
afterEach(() => { for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true }); });
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'lti-keyring-'));
  temps.push(dir);
  return dir;
}
function writeSecret(name: string, content: string): string {
  const file = join(tempDir(), name);
  writeFileSync(file, content, { mode: 0o600 });
  return file;
}
const ringFile = (active: string, keys: Record<string, Buffer>) =>
  writeSecret('keyring.json', JSON.stringify({ active, keys: Object.fromEntries(Object.entries(keys).map(([id, k]) => [id, hex(k)])) }));

it('signing-key publish lead time defaults to 86400 s and refuses non-integers or values below 600', () => {
  expect(readSigningKeyPublishLeadSeconds({})).toBe(86_400);
  expect(readSigningKeyPublishLeadSeconds({ SIGNING_KEY_PUBLISH_LEAD_S: '600' })).toBe(600);
  for (const value of ['', ' ', '599', '-1', '600.5', 'NaN', 'Infinity', 'text', '9007199254740992']) {
    expect(() => readSigningKeyPublishLeadSeconds({ SIGNING_KEY_PUBLISH_LEAD_S: value })).toThrow(/SIGNING_KEY_PUBLISH_LEAD_S/);
  }
});

function database() {
  const db = openDb(':memory:');
  ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
  const platform = createPlatform(db, 'cogniate', { issuer: 'https://moodle.test', clientId: 'c', name: 'M', authEndpoint: 'https://moodle.test/a', tokenEndpoint: 'https://moodle.test/t', jwksUrl: 'https://moodle.test/k', deploymentIds: ['1'], active: true });
  return { db, platform };
}

describe('key-ring settings (LTI_KEYRING_FILE, LTI_MASTER_KEY, LTI_MASTER_KEY_FILE)', () => {
  const noFile = () => join(tempDir(), 'keyring.json');

  it('the default file is /run/secrets/lti/keyring.json', () => {
    expect(DEFAULT_KEYRING_FILE).toBe('/run/secrets/lti/keyring.json');
  });

  it('no key-ring file: LTI_MASTER_KEY (or LTI_MASTER_KEY_FILE) is the version legacy, active', () => {
    for (const env of [
      { LTI_KEYRING_FILE: noFile(), LTI_MASTER_KEY: hex(LEGACY) },
      { LTI_KEYRING_FILE: noFile(), LTI_MASTER_KEY_FILE: writeSecret('master', `${hex(LEGACY)}\n`) },
      { LTI_KEYRING_FILE: noFile(), LTI_MASTER_KEY: hex(LEGACY).toUpperCase(), LTI_MASTER_KEY_FILE: writeSecret('master', hex(LEGACY)) },
    ]) {
      const ring = readKeyRing(env);
      expect(ring.active).toBe('legacy');
      expect([...ring.keys].map(([id, key]) => [id, Buffer.from(key)])).toEqual([['legacy', LEGACY]]);
    }
  });

  it('a key-ring file wins over LTI_MASTER_KEY', () => {
    const ring = readKeyRing({ LTI_KEYRING_FILE: ringFile('k2', { legacy: LEGACY, k2: K2 }), LTI_MASTER_KEY: hex(K1) });
    expect([ring.active, [...ring.keys.keys()]]).toEqual(['k2', ['legacy', 'k2']]);
  });

  it('fails closed: no key at all, two different master keys, a bad file, an unreadable file', () => {
    expect(() => readKeyRing({ LTI_KEYRING_FILE: noFile() })).toThrow(/LTI_MASTER_KEY/);
    expect(() => readKeyRing({ LTI_KEYRING_FILE: noFile(), LTI_MASTER_KEY: hex(LEGACY), LTI_MASTER_KEY_FILE: writeSecret('master', hex(K1)) })).toThrow(/different values/);
    expect(() => readKeyRing({ LTI_KEYRING_FILE: noFile(), LTI_MASTER_KEY_FILE: noFile() })).toThrow(/ENOENT/);
    expect(() => readKeyRing({ LTI_KEYRING_FILE: writeSecret('keyring.json', '{"active":"k2"}'), LTI_MASTER_KEY: hex(LEGACY) })).toThrow(/Key ring/);
    if (process.getuid?.() !== 0) {
      const file = ringFile('k2', { k2: K2 });
      chmodSync(file, 0o000);
      expect(() => readKeyRing({ LTI_KEYRING_FILE: file, LTI_MASTER_KEY: hex(LEGACY) })).toThrow(/EACCES/);
    }
  });
});

describe('loadKeyProvider', () => {
  it.each(['{broken-fixture-secret', '{"legacyBlobs":"allowed"}', 'null', '[]'])('fails once at start for a malformed persisted key-provider setting: %s', async (value) => {
    const { db } = database();
    try {
      db.prepare("INSERT INTO service_setting (key, value) VALUES ('key_provider', ?)").run(value);
      const { logger, lines } = capturingLogger();
      await expect(loadKeyProvider({ db, logger, masterKey: Buffer.from(LEGACY), env: { LTI_KEYRING_FILE: ringFile('legacy', { legacy: LEGACY }) } }))
        .rejects.toThrow('key_provider_setting_invalid: cannot read the key_provider service setting.');
      expect(lines).toEqual([]);
    } finally { db.close(); }
  });

  it('all loaded providers observe committed legacy refusal, keep other settings, and restore refusal after restart', async () => {
    const { db } = database();
    try {
      const env = { LTI_KEYRING_FILE: ringFile('k2', { legacy: LEGACY, k2: K2 }) };
      const { logger, lines } = capturingLogger();
      const load = () => loadKeyProvider({ db, logger, masterKey: Buffer.from(LEGACY), env });
      const first = await load();
      const second = await load();
      const old = { bytes: encrypt(LEGACY, 'fixture token') };
      const aad = 'lti:registration_session:registration_token_encrypted:cogniate:unit';
      expect(Buffer.from(await first.open(old, aad)).toString()).toBe('fixture token');
      db.prepare("INSERT INTO service_setting (key, value) VALUES ('key_provider', ?)").run(JSON.stringify({ otherSetting: 'kept' }));
      expect(() => transaction(db, () => { refuseLegacyBlobs(db); throw new Error('rollback'); })).toThrow('rollback');
      expect(legacyBlobsRefused(db)).toBe(false);
      transaction(db, () => refuseLegacyBlobs(db));
      expect(legacyBlobsRefused(db)).toBe(true);
      expect(JSON.parse(String(db.prepare("SELECT value FROM service_setting WHERE key = 'key_provider'").get()!.value)))
        .toEqual({ otherSetting: 'kept', legacyBlobs: 'refused' });
      const restarted = await load();
      for (const provider of [first, second, restarted]) await expect(provider.open(old, aad)).rejects.toThrow('legacy_refused');
      expect(lines.filter((line) => line.event === 'key_open_failed')).toEqual(Array.from({ length: 3 }, () =>
        expect.objectContaining({ table: 'registration_session', reason: 'legacy_refused' })));
    } finally { db.close(); }
  });

  it('AC-LA-E5-08-01 (unit part): with only LTI_MASTER_KEY, existing tool keys and registration sessions open; new blobs use "legacy"', async () => {
    const { db } = database();
    // Rows as the code before LA-E5-08 wrote them: crypto.ts encrypt with the master key (no header, no associated data).
    const before = Buffer.alloc(32, 7);
    bindKeyProvider(before, createLocalKeyProvider(legacyKeyRing(LEGACY)));
    await ensureToolKey(db, before, 'cogniate');
    const jwk = activePrivateJwk(db, before, 'cogniate')!;
    db.prepare("UPDATE tool_key SET private_jwk_encrypted = ? WHERE tool_account_id = 'cogniate'").run(encrypt(LEGACY, JSON.stringify(jwk)));
    const session = createRegistrationSession(db, before, {
      toolAccountId: 'cogniate', openidConfigurationUrl: 'https://moodle.test/oidc', registrationToken: 'placeholder', platformConfiguration: {},
      operation: 'new', existingPlatformId: null, privacyLevel: 'public', passthrough: {}, expiresAt: NOW + 3600_000,
    }, NOW);
    db.prepare('UPDATE registration_session SET registration_token_encrypted = ? WHERE id = ?').run(encrypt(LEGACY, 'reg-token'), session.id);
    expect(keyVersionsInUse(db)).toEqual(['legacy']);

    const masterKey = Buffer.alloc(32, 7);
    const { logger, lines } = capturingLogger();
    const provider = await loadKeyProvider({ db, masterKey, logger, env: { LTI_KEYRING_FILE: join(tempDir(), 'none.json'), LTI_MASTER_KEY: hex(LEGACY) } });
    expect(keyProviderFor(masterKey)).toBe(provider);
    expect([provider.kind, provider.activeVersion()]).toEqual(['local-keyring', 'legacy']);
    await expect(provider.ready()).resolves.toBeUndefined();
    expect(activePrivateJwk(db, masterKey, 'cogniate', NOW)).toEqual(jwk);
    expect(getRegistrationSession(db, masterKey, 'cogniate', session.id, NOW)?.registrationToken).toBe('reg-token');
    expect(lines.filter((l) => String(l.event).startsWith('key_'))).toEqual([]);
    await ensureToolKey(db, masterKey, 'cogniate', true);
    const blob = (db.prepare("SELECT private_jwk_encrypted AS b FROM tool_key WHERE status = 'active'").get() as { b: Uint8Array }).b;
    expect([Buffer.from(blob).subarray(0, 4).toString(), blobKeyVersion(blob)]).toEqual(['cgk1', 'legacy']);
  });

  it('AC-LA-E5-08-08: a key ring without a version that a row still uses makes ready() fail and logs key_provider_not_ready {version}', async () => {
    const { db, platform } = database();
    // Rows of an earlier ring {active: k1}: a k1 private key, and a service key derived with "legacy".
    const earlier = Buffer.alloc(32, 7);
    bindKeyProvider(earlier, createLocalKeyProvider({ active: 'k1', keys: new Map([['legacy', LEGACY], ['k1', K1]]) }));
    await ensureToolKey(db, earlier, 'cogniate');
    issueServiceKey(db, earlier, { toolAccountId: 'cogniate', platformId: platform.id, deploymentId: '1', contextId: '2', resourceLinkId: '3', agsClaim: null, nrpsClaim: null }, NOW);
    expect(keyVersionsInUse(db)).toEqual(['k1', 'legacy']);

    // The new ring dropped k1: the service starts, but it is not ready.
    const { logger, lines } = capturingLogger();
    const provider = await loadKeyProvider({ db, masterKey: Buffer.alloc(32, 7), logger, env: { LTI_KEYRING_FILE: ringFile('k2', { legacy: LEGACY, k2: K2 }) } });
    expect(lines.filter((l) => l.event === 'key_provider_not_ready')).toEqual([expect.objectContaining({ level: 'error', version: 'k1' })]);
    await expect(provider.ready()).rejects.toMatchObject({ name: 'KeyProviderError', code: 'key_version_missing', versions: ['k1'] });

    // A ring without "legacy" also fails: the existing service keys are derived with it.
    const second = capturingLogger();
    const noLegacy = await loadKeyProvider({ db, masterKey: Buffer.alloc(32, 7), logger: second.logger, env: { LTI_KEYRING_FILE: ringFile('k1', { k1: K1 }) } });
    expect(second.lines.filter((l) => l.event === 'key_provider_not_ready').map((l) => l.version)).toEqual(['legacy']);
    await expect(noLegacy.ready()).rejects.toMatchObject({ versions: ['legacy'] });

    // A ring with every version in use is ready.
    const full = await loadKeyProvider({ db, masterKey: Buffer.alloc(32, 7), env: { LTI_KEYRING_FILE: ringFile('k2', { legacy: LEGACY, k1: K1, k2: K2 }) } });
    await expect(full.ready()).resolves.toBeUndefined();
  });
});
