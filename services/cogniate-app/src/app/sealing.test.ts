// LA-E5-22: the app sealing wrapper over the shared key provider (UNIT ACs 02, 03, 04 and the key settings). No key
// ring is bound in this file, so a handle is the one version `legacy` (today's stack); sealing-start.test.ts binds one.
import { createHmac } from 'node:crypto';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KeyProviderError, createLocalKeyProvider, encrypt } from '@cogniate/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createConnection } from '../domain/connections.ts';
import { ensureLibrary } from '../domain/libraries.ts';
import type { TestApp } from '../testkit.ts';
import { TEST_CHANNELS, TEST_MASTER_KEY, testApp, testSetupOf } from '../testkit.ts';
import {
  APP_SEALED_COLUMNS, DEFAULT_APP_KEYRING_FILE, REF_COPY_COLUMN, WS_TOKEN_COLUMN, appAad, appSealedVersionCounts, missingAppKeyVersions, openText,
  readAppStartupKeys, runtimeTokenMac, sealText,
} from './sealing.ts';

const KEY = 'ab'.repeat(32);
const K2 = 'cd'.repeat(32);
const dir = mkdtempSync(join(tmpdir(), 'app-sealing-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
function file(name: string, text: string): string {
  const path = join(dir, name);
  writeFileSync(path, text, { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
}

let t: TestApp | undefined;
afterEach(async () => { await t?.app.close(); t = undefined; });

/** Two libraries with one Moodle connection each, in a temporary database. */
async function twoLibraries() {
  t = await testApp();
  const db = t.db;
  const connection = (name: string) => {
    const library = ensureLibrary(db, name, t!.clock.now);
    return createConnection(db, library.id, { name: 'School', siteUrl: 'https://moodle.test', method: 'manual', channel: 'moodle', profile: 'standard' },
      null, t!.clock.now, TEST_CHANNELS, testSetupOf('moodle')!.sharingOf);
  };
  return { db, a: connection('Library A'), b: connection('Library B') };
}
const blobOf = (db: TestApp['db'], id: string) => db.prepare('SELECT ws_token_encrypted AS blob FROM connection WHERE id = ?').get(id)!.blob as Uint8Array;

describe('the app sealing wrapper (LA-ADR-06 D6, app part)', () => {
  it('AC-LA-E5-22-02: a new value has the versioned header and opens; a legacy blob also opens (temporary database)', async () => {
    const { db, a, b } = await twoLibraries();
    const aadA = appAad(WS_TOKEN_COLUMN, a.libraryId, a.id);
    expect(aadA).toBe(`app:connection:ws_token_encrypted:${a.libraryId}:${a.id}`);
    db.prepare('UPDATE connection SET ws_token_encrypted = ? WHERE id = ?').run(sealText(TEST_MASTER_KEY, 'moodle-ws-token', aadA), a.id);
    // The legacy form of today: encrypt() with the master key and no associated data.
    db.prepare('UPDATE connection SET ws_token_encrypted = ? WHERE id = ?').run(encrypt(TEST_MASTER_KEY, 'old-ws-token'), b.id);
    const sealed = blobOf(db, a.id);
    expect(Buffer.from(sealed.subarray(0, 4)).toString('ascii')).toBe('cgk1');
    expect(Buffer.from(sealed.subarray(5, 11)).toString('ascii')).toBe('legacy');
    expect(openText(TEST_MASTER_KEY, sealed, aadA)).toBe('moodle-ws-token');
    expect(openText(TEST_MASTER_KEY, blobOf(db, b.id), appAad(WS_TOKEN_COLUMN, b.libraryId, b.id))).toBe('old-ws-token');
    expect(appSealedVersionCounts(db)).toEqual(new Map([['legacy', 2]]));
  });

  it('AC-LA-E5-22-03: a blob copied to the same column of a row of another library does not open', async () => {
    const { db, a, b } = await twoLibraries();
    db.prepare('UPDATE connection SET ws_token_encrypted = ? WHERE id = ?').run(sealText(TEST_MASTER_KEY, 'moodle-ws-token', appAad(WS_TOKEN_COLUMN, a.libraryId, a.id)), a.id);
    db.prepare('UPDATE connection SET ws_token_encrypted = ? WHERE id = ?').run(blobOf(db, a.id), b.id);
    expect(() => openText(TEST_MASTER_KEY, blobOf(db, b.id), appAad(WS_TOKEN_COLUMN, b.libraryId, b.id))).toThrow(KeyProviderError);
    // Nor in another column of the same row.
    expect(() => openText(TEST_MASTER_KEY, blobOf(db, a.id), appAad(REF_COPY_COLUMN, a.libraryId, a.id))).toThrow(/did not open/);
  });

  it('AC-LA-E5-22-04 (MAC part): the runtime-token MAC is HMAC-SHA-256 with the master key, byte for byte (golden)', () => {
    const input = 'runtime-token:ply_golden0000000000000000';
    expect(runtimeTokenMac(TEST_MASTER_KEY, input)).toBe('8EuoxYc7NuEdg5c8LoOwSIMR0KrMD_5FIPW4Jv73PtI');
    expect(runtimeTokenMac(TEST_MASTER_KEY, input)).toBe(createHmac('sha256', TEST_MASTER_KEY).update(input).digest('base64url'));
  });

  it('lists the four sealed columns; readiness names the versions that the key ring does not have', async () => {
    const { db, a } = await twoLibraries();
    expect(APP_SEALED_COLUMNS.map((c) => `${c.table}.${c.column}:${c.rewrap}`)).toEqual([
      'connection.ws_token_encrypted:true', 'connection.ref_token_encrypted:true', 'resource_link.service_key_encrypted:true', 'picker_session.ltik_encrypted:false',
    ]);
    const k1 = createLocalKeyProvider({ active: 'k1', keys: new Map([['legacy', TEST_MASTER_KEY], ['k1', Buffer.from(K2, 'hex')]]) });
    db.prepare('UPDATE connection SET ws_token_encrypted = ? WHERE id = ?').run(k1.sealSync(Buffer.from('x'), appAad(WS_TOKEN_COLUMN, a.libraryId, a.id)).bytes, a.id);
    expect(appSealedVersionCounts(db)).toEqual(new Map([['k1', 1]]));
    expect(missingAppKeyVersions(db, createLocalKeyProvider({ active: 'legacy', keys: new Map([['legacy', TEST_MASTER_KEY]]) }))).toEqual(['k1']);
    expect(missingAppKeyVersions(db, k1)).toEqual([]);
  });
});

describe('readAppStartupKeys: the app key settings (BD-A2-77..80 rules, BD-A2-91 default path)', () => {
  const ring = (keys: Record<string, string>, active: string) => file(`ring-${active}-${Object.keys(keys).join('-')}`, JSON.stringify({ active, keys }));

  it('the default key-ring path is /run/secrets/app-keys/keyring.json; no ring file = the master key as the active legacy version', () => {
    expect(DEFAULT_APP_KEYRING_FILE).toBe('/run/secrets/app-keys/keyring.json');
    const keys = readAppStartupKeys({ APP_KEYRING_FILE: join(dir, 'missing.json'), APP_MASTER_KEY: KEY.toUpperCase() });
    expect([keys.handle.toString('hex'), keys.ring.active, [...keys.ring.keys.keys()]]).toEqual([KEY, 'legacy', ['legacy']]);
  });

  it('a key ring alone is enough when it holds legacy; the handle is the legacy key; a master key next to it must be equal', () => {
    const path = ring({ legacy: KEY, k2: K2 }, 'k2');
    const alone = readAppStartupKeys({ APP_KEYRING_FILE: path });
    expect([alone.handle.toString('hex'), alone.ring.active]).toEqual([KEY, 'k2']);
    expect(readAppStartupKeys({ APP_KEYRING_FILE: path, APP_MASTER_KEY: KEY.toUpperCase() }).handle.toString('hex')).toBe(KEY);
    expect(() => readAppStartupKeys({ APP_KEYRING_FILE: path, APP_MASTER_KEY: K2 })).toThrow(/legacy version differ/);
    expect(() => readAppStartupKeys({ APP_KEYRING_FILE: ring({ k2: K2 }, 'k2') })).toThrow(/no legacy version/);
    expect(() => readAppStartupKeys({ APP_KEYRING_FILE: file('ring-bad', '{"active":"k9","keys":{}}') })).toThrow(KeyProviderError);
  });
});
