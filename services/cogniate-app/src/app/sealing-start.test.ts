// LA-E5-22: the start binding (loadAppKeyProvider) and the re-wrap of app blobs. This file binds a key ring to a
// handle, so the fail-closed rule of keyProviderFor applies to every other handle here (own module state per file).
import { createLogger, createLocalKeyProvider, encrypt, type LocalKeyProvider, type LogLine } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { createConnection } from '../domain/connections.ts';
import { ensureLibrary } from '../domain/libraries.ts';
import type { TestApp } from '../testkit.ts';
import { TEST_CHANNELS, TEST_MASTER_KEY, testApp, testSetupOf } from '../testkit.ts';
import { REF_COPY_COLUMN, WS_TOKEN_COLUMN, appAad, appSealedVersionCounts, loadAppKeyProvider, openText, rewrapAppBlobs, sealText } from './sealing.ts';

const hex = (byte: number) => Buffer.alloc(32, byte);
let t: TestApp | undefined;
afterEach(async () => { await t?.app.close(); t = undefined; });

async function rows() {
  t = await testApp();
  const db = t.db;
  const connection = (name: string) => {
    const library = ensureLibrary(db, name, t!.clock.now);
    return createConnection(db, library.id, { name: 'School', siteUrl: 'https://moodle.test', method: 'manual', channel: 'moodle', profile: 'standard' },
      null, t!.clock.now, TEST_CHANNELS, testSetupOf('moodle')!.sharingOf);
  };
  const setWs = (id: string, blob: Uint8Array) => db.prepare('UPDATE connection SET ws_token_encrypted = ? WHERE id = ?').run(blob, id);
  const ws = (id: string) => db.prepare('SELECT ws_token_encrypted AS blob FROM connection WHERE id = ?').get(id)!.blob as Uint8Array;
  return { db, a: connection('Library A'), b: connection('Library B'), c: connection('Library C'), setWs, ws };
}
const version = (blob: Uint8Array) => Buffer.from(blob.subarray(5, 5 + blob[4]!)).toString('ascii');

describe('loadAppKeyProvider (main.ts, the worker and the operator CLIs call it once at start)', () => {
  it('binds the ring to the handle: new values use the active version; a missing version is logged; an unbound handle fails closed', async () => {
    const { db, a, setWs } = await rows();
    const k9 = createLocalKeyProvider({ active: 'k9', keys: new Map([['k9', hex(9)]]) });
    setWs(a.id, k9.sealSync(Buffer.from('x'), appAad(WS_TOKEN_COLUMN, a.libraryId, a.id)).bytes);
    const lines: LogLine[] = [];
    const handle = Buffer.from(TEST_MASTER_KEY);
    const provider = await loadAppKeyProvider({ db, masterKey: handle, ring: { active: 'k2', keys: new Map([['legacy', handle], ['k2', hex(2)]]) },
      logger: createLogger({ service: 'test', write: (line) => lines.push(JSON.parse(line) as LogLine) }) });
    expect(lines).toContainEqual(expect.objectContaining({ event: 'key_provider_not_ready', version: 'k9' }));
    expect(provider.activeVersion()).toBe('k2');
    const sealed = sealText(handle, 'value', 'app:connection:ws_token_encrypted:lib:row');
    expect(version(sealed)).toBe('k2');
    expect(openText(handle, sealed, 'app:connection:ws_token_encrypted:lib:row')).toBe('value');
    // A legacy blob of the old master key still opens through the bound ring.
    expect(openText(handle, encrypt(TEST_MASTER_KEY, 'old'), 'app:connection:ws_token_encrypted:lib:row')).toBe('old');
    expect(() => sealText(hex(7), 'value', 'app:connection:ws_token_encrypted:lib:row')).toThrow(/not bound/);
  });
});

describe('rewrapAppBlobs (app:keys rewrap; LA-ADR-06 D6 "Re-wrap")', () => {
  const ring = (active: string, ...versions: string[]) => createLocalKeyProvider({ active, keys: new Map(versions.map((v, i) => [v, v === 'legacy' ? TEST_MASTER_KEY : hex(i + 1)])) });

  it('re-seals every old blob with the active version (legacy form too), keeps the values, and a second run does nothing', async () => {
    const { db, a, b, setWs, ws } = await rows();
    const old = ring('k1', 'legacy', 'k1', 'k2');
    setWs(a.id, encrypt(TEST_MASTER_KEY, 'token-a'));
    setWs(b.id, old.sealSync(Buffer.from('token-b'), appAad(WS_TOKEN_COLUMN, b.libraryId, b.id)).bytes);
    db.prepare('UPDATE connection SET ref_token_hash = ?, ref_token_encrypted = ? WHERE id = ?')
      .run('hash-a', old.sealSync(Buffer.from('ref-a'), appAad(REF_COPY_COLUMN, a.libraryId, 'hash-a')).bytes, a.id);
    const now = ring('k2', 'legacy', 'k1', 'k2');
    expect(rewrapAppBlobs(db, now)).toEqual({ examined: 3, rewrapped: 3, skippedChanged: 0, unreadable: 0, unreadableVersions: [] });
    expect(appSealedVersionCounts(db)).toEqual(new Map([['k2', 3]]));
    expect([version(ws(a.id)), version(ws(b.id))]).toEqual(['k2', 'k2']);
    expect(Buffer.from(now.openSync({ bytes: ws(a.id) }, appAad(WS_TOKEN_COLUMN, a.libraryId, a.id))).toString()).toBe('token-a');
    expect(Buffer.from(now.openSync({ bytes: ws(b.id) }, appAad(WS_TOKEN_COLUMN, b.libraryId, b.id))).toString()).toBe('token-b');
    const ref = db.prepare('SELECT ref_token_encrypted AS blob FROM connection WHERE id = ?').get(a.id)!.blob as Uint8Array;
    expect(Buffer.from(now.openSync({ bytes: ref }, appAad(REF_COPY_COLUMN, a.libraryId, 'hash-a'))).toString()).toBe('ref-a');
    expect(rewrapAppBlobs(db, now)).toEqual({ examined: 3, rewrapped: 0, skippedChanged: 0, unreadable: 0, unreadableVersions: [] });
  });

  it('a row that changed in the meantime is skipped (compare-and-set); an unreadable row is counted with its header version', async () => {
    const { db, a, b, c, setWs, ws } = await rows();
    const k9 = createLocalKeyProvider({ active: 'k9', keys: new Map([['k9', hex(9)]]) });
    setWs(a.id, encrypt(TEST_MASTER_KEY, 'token-a'));
    setWs(b.id, encrypt(TEST_MASTER_KEY, 'token-b'));
    setWs(c.id, k9.sealSync(Buffer.from('token-c'), appAad(WS_TOKEN_COLUMN, c.libraryId, c.id)).bytes);
    const now = ring('k2', 'legacy', 'k1', 'k2');
    // Another writer stores a new token for b between the read and the compare-and-set.
    const racing: LocalKeyProvider = { ...now, openWithMetadataSync: (blob, aad) => {
      if (aad === appAad(WS_TOKEN_COLUMN, b.libraryId, b.id)) setWs(b.id, now.sealSync(Buffer.from('token-b2'), aad).bytes);
      return now.openWithMetadataSync(blob, aad);
    } };
    expect(rewrapAppBlobs(db, racing)).toEqual({ examined: 3, rewrapped: 1, skippedChanged: 1, unreadable: 1, unreadableVersions: ['k9'] });
    expect(Buffer.from(now.openSync({ bytes: ws(b.id) }, appAad(WS_TOKEN_COLUMN, b.libraryId, b.id))).toString()).toBe('token-b2');
    expect(version(ws(c.id))).toBe('k9');
  });
});
