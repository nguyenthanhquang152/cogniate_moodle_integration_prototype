import { createCipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { encrypt } from './crypto.ts';
import type { KeyRing, LocalKeyProvider } from './key-provider.ts';
import {
  KeyProviderError, associatedData, bindKeyProvider, blobKeyVersion, createLocalKeyProvider, keyProviderFor, legacyKeyRing, parseKeyRing,
} from './key-provider.ts';

// Fixture keys (test values, not secrets).
const MASTER = Buffer.alloc(32, 7);
const K2 = Buffer.alloc(32, 2);
const ringOf = (active: string, keys: Record<string, Buffer>): KeyRing => ({ active, keys: new Map(Object.entries(keys)) });
const AAD = associatedData('lti', 'tool_key', 'private_jwk_encrypted', 'cogniate', 'kid-1');
const bytes = (text: string) => Buffer.from(text, 'utf8');
const text = (value: Uint8Array) => Buffer.from(value).toString('utf8');

function capture(): { logger: { error: (event: string, fields?: Record<string, unknown>) => void }; lines: Array<{ event: string; fields?: Record<string, unknown> }> } {
  const lines: Array<{ event: string; fields?: Record<string, unknown> }> = [];
  return { lines, logger: { error: (event, fields) => lines.push({ event, ...(fields ? { fields } : {}) }) } };
}

function openError(provider: LocalKeyProvider, blob: Uint8Array, aad: string): KeyProviderError {
  try {
    provider.openSync({ bytes: blob }, aad);
  } catch (err) {
    return err as KeyProviderError;
  }
  throw new Error('the blob opened');
}

describe('mac (LA-ADR-06 D6 purpose subkeys)', () => {
  // The service-key input of scope {cogniate, plt_fixture, 1, 2, 3}, generation 0 (store/service-keys.ts).
  const input = bytes('8:cogniate|11:plt_fixture|1:1|1:2|1:3');

  it("AC-LA-E5-08-03: mac('service-key', 'legacy', input) equals today's derivation (fixture master key and input)", () => {
    const provider = createLocalKeyProvider(legacyKeyRing(MASTER));
    // Today's code: subkey = HMAC(master key, 'cogniate-lti/service-key/v1'); key = HMAC(subkey, input), base64url.
    const todaySubkey = createHmac('sha256', MASTER).update('cogniate-lti/service-key/v1').digest();
    const today = createHmac('sha256', todaySubkey).update(input).digest('base64url');
    expect(today).toBe('V3E5DSnWMnzgVWKdms3-tBr1bKoNQxY2xGFqn4xN2ag'); // golden, captured before LA-E5-08
    expect(Buffer.from(provider.macSync('service-key', 'legacy', input)).toString('base64url')).toBe(today);
    // The same value when "legacy" is only decrypt-only in a ring with another active version.
    const ring = createLocalKeyProvider(ringOf('k2', { legacy: MASTER, k2: K2 }));
    expect(Buffer.from(ring.macSync('service-key', 'legacy', input)).toString('base64url')).toBe(today);
  });

  it("the runtime token keeps today's app value with 'legacy' (HMAC with the master key itself)", async () => {
    const provider = createLocalKeyProvider(legacyKeyRing(MASTER));
    const mac = await provider.mac('runtime-token', 'legacy', bytes('runtime-token:play_fixture'));
    expect(Buffer.from(mac).toString('base64url')).toBe('crXGrdmI4pePvzuaS6kwY3cGb1CBWNk4DgOiStYZWJ8');
  });

  it('another version uses HKDF-SHA-256 with info cogniate-lti/<purpose>/<version>; a missing version throws', () => {
    const provider = createLocalKeyProvider(ringOf('k2', { legacy: MASTER, k2: K2 }));
    const subkey = Buffer.from(hkdfSync('sha256', K2, Buffer.alloc(0), 'cogniate-lti/service-key/k2', 32));
    expect(Buffer.from(provider.macSync('service-key', 'k2', input))).toEqual(createHmac('sha256', subkey).update(input).digest());
    expect(provider.macSync('runtime-token', 'k2', input)).not.toEqual(provider.macSync('service-key', 'k2', input));
    const err = (() => { try { provider.macSync('service-key', 'k9', input); } catch (e) { return e; } })();
    expect(err).toBeInstanceOf(KeyProviderError);
    expect(err).toMatchObject({ code: 'key_version_missing', versions: ['k9'] });
  });
});

describe('seal and open (LA-ADR-06 D6 blob format and associated data)', () => {
  it('AC-LA-E5-08-04: a value sealed with k2 and associated data A opens with A, and with no other associated data', async () => {
    const { logger, lines } = capture();
    const provider = createLocalKeyProvider(ringOf('k2', { legacy: MASTER, k2: K2 }), { logger });
    const blob = await provider.seal(bytes('private jwk'), AAD);
    expect(text(await provider.open(blob, AAD))).toBe('private jwk');
    for (const other of [
      associatedData('lti', 'tool_key', 'private_jwk_encrypted', 'qa-second', 'kid-1'),
      associatedData('lti', 'tool_key', 'private_jwk_encrypted', 'cogniate', 'kid-2'),
      associatedData('lti', 'registration_session', 'registration_token_encrypted', 'cogniate', 'kid-1'),
      associatedData('app', 'tool_key', 'private_jwk_encrypted', 'cogniate', 'kid-1'),
      `${AAD} `,
      '',
    ]) {
      await expect(provider.open(blob, other)).rejects.toMatchObject({ name: 'KeyProviderError', code: 'key_open_failed' });
    }
    expect(lines[0]).toEqual({ event: 'key_open_failed', fields: { table: 'tool_key', reason: 'auth_failed' } });
    expect(lines.map((l) => l.fields?.table)).toEqual(['tool_key', 'tool_key', 'registration_session', 'tool_key', 'tool_key', 'unknown']);
  });

  it('AC-LA-E5-08-07: with the ring {active: "k2", keys: {legacy, k2}}, seal writes a "cgk1" blob with version k2', () => {
    const provider = createLocalKeyProvider(ringOf('k2', { legacy: MASTER, k2: K2 }));
    expect(provider.activeVersion()).toBe('k2');
    expect(provider.versions()).toEqual([{ id: 'k2', state: 'active' }, { id: 'legacy', state: 'decrypt-only' }]);
    const blob = Buffer.from(provider.sealSync(bytes('value'), AAD).bytes);
    // "cgk1" | 2 | "k2" | 60 (2 bytes) | wrapped data key (iv | tag | 32) | iv | tag | ciphertext
    expect(blob.subarray(0, 4).toString('ascii')).toBe('cgk1');
    expect([blob[4], blob.subarray(5, 7).toString('ascii'), blob.readUInt16BE(7)]).toEqual([2, 'k2', 60]);
    expect(blob.length).toBe(9 + 60 + 12 + 16 + 'value'.length);
    expect(blobKeyVersion(blob)).toBe('k2');
    // Each blob has its own data key and ivs.
    expect(Buffer.from(provider.sealSync(bytes('value'), AAD).bytes).equals(blob)).toBe(false);
    // A ring where k2 is decrypt-only still opens it; a ring without k2 does not.
    expect(text(createLocalKeyProvider(ringOf('legacy', { legacy: MASTER, k2: K2 })).openSync({ bytes: blob }, AAD))).toBe('value');
    const { logger, lines } = capture();
    expect(openError(createLocalKeyProvider(legacyKeyRing(MASTER), { logger }), blob, AAD).code).toBe('key_open_failed');
    expect(lines).toEqual([{ event: 'key_open_failed', fields: { table: 'tool_key', reason: 'version_missing' } }]);
  });

  it('AC-LA-E5-08-06: a legacy blob (iv | tag | ciphertext, no header) opens with the version legacy', () => {
    const legacyBlob = encrypt(MASTER, 'legacy private jwk'); // crypto.ts, today's format
    expect(blobKeyVersion(legacyBlob)).toBe('legacy');
    expect(text(createLocalKeyProvider(legacyKeyRing(MASTER)).openSync({ bytes: legacyBlob }, AAD))).toBe('legacy private jwk');
    expect(text(createLocalKeyProvider(ringOf('k2', { legacy: MASTER, k2: K2 })).openSync({ bytes: legacyBlob }, 'any row'))).toBe('legacy private jwk');
    // No "legacy" version in the ring, or another key under that id: the blob does not open.
    expect(openError(createLocalKeyProvider(ringOf('k2', { k2: K2 })), legacyBlob, AAD).message).toContain('version_missing');
    expect(openError(createLocalKeyProvider(legacyKeyRing(K2)), legacyBlob, AAD).message).toContain('auth_failed');
  });

  it('a legacy blob that starts with a valid-looking "cgk1" header still opens (the GCM tag proves the result)', () => {
    // iv = "cgk1" | 2 | "k2" | 0x003c | 3 bytes: the header parse succeeds, the k2 unwrap fails, the legacy form opens.
    const iv = Buffer.concat([Buffer.from('cgk1'), Buffer.from([2]), Buffer.from('k2'), Buffer.from([0, 60]), randomBytes(3)]);
    const cipher = createCipheriv('aes-256-gcm', MASTER, iv);
    const plain = 'x'.repeat(80);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const blob = Buffer.concat([iv, cipher.getAuthTag(), data]);
    expect(blobKeyVersion(blob)).toBe('k2');
    expect(text(createLocalKeyProvider(ringOf('k2', { legacy: MASTER, k2: K2 })).openSync({ bytes: blob }, AAD))).toBe(plain);
  });

  it('the wrap binds the header: a changed version id or a changed byte does not open', () => {
    // k3 has the same key bytes as k2, so only the header binding can stop the changed blob.
    const provider = createLocalKeyProvider(ringOf('k2', { k2: K2, k3: K2 }));
    const blob = Buffer.from(provider.sealSync(bytes('value'), AAD).bytes);
    const renamed = Buffer.from(blob);
    renamed.write('k3', 5, 'ascii');
    expect(blobKeyVersion(renamed)).toBe('k3');
    expect(openError(provider, renamed, AAD).code).toBe('key_open_failed');
    for (const at of [9, 9 + 60, blob.length - 1]) {
      const changed = Buffer.from(blob);
      changed[at]! ^= 1;
      expect(openError(provider, changed, AAD).code).toBe('key_open_failed');
    }
    expect(openError(provider, blob.subarray(0, 20), AAD).code).toBe('key_open_failed');
  });
});

describe('ready (fail closed on a missing version)', () => {
  it('fails, and logs key_provider_not_ready {version} per missing version, when a version in use is not in the ring', async () => {
    const { logger, lines } = capture();
    let used = ['legacy', 'k1', 'k2', 'k1'];
    const provider = createLocalKeyProvider(ringOf('k2', { legacy: MASTER, k2: K2 }), { logger, referencedVersions: () => used });
    await expect(provider.ready()).rejects.toMatchObject({ name: 'KeyProviderError', code: 'key_version_missing', versions: ['k1'] });
    expect(lines).toEqual([{ event: 'key_provider_not_ready', fields: { version: 'k1' } }]);
    used = ['legacy', 'k2'];
    await expect(provider.ready()).resolves.toBeUndefined();
    await expect(createLocalKeyProvider(legacyKeyRing(MASTER)).ready()).resolves.toBeUndefined();
  });
});

describe('key ring file', () => {
  const hex = (b: Buffer) => b.toString('hex');

  it('parses {active, keys}; the active version must be in keys', () => {
    const ring = parseKeyRing(JSON.stringify({ active: 'k2', keys: { legacy: hex(MASTER), k2: hex(K2).toUpperCase() } }));
    expect(ring.active).toBe('k2');
    expect([...ring.keys.keys()]).toEqual(['legacy', 'k2']);
    expect(Buffer.from(ring.keys.get('k2')!)).toEqual(K2);
  });

  it('refuses a bad file without key material in the message', () => {
    const secret = hex(K2);
    for (const bad of [
      'not json', 'null', '[]', JSON.stringify({ keys: { k2: secret } }), JSON.stringify({ active: 'k2' }),
      JSON.stringify({ active: 'k3', keys: { k2: secret } }), JSON.stringify({ active: 'k2', keys: { k2: secret.slice(1) } }),
      JSON.stringify({ active: 'k2', keys: { k2: 42 } }), JSON.stringify({ active: 'k:2', keys: { 'k:2': secret } }),
      JSON.stringify({ active: 'k2', keys: { k2: secret, [`${secret}x`]: secret } }),
    ]) {
      let err: unknown;
      try { parseKeyRing(bad); } catch (e) { err = e; }
      expect(err, bad).toMatchObject({ name: 'KeyProviderError', code: 'key_ring_invalid' });
      expect((err as Error).message).not.toContain(secret.slice(0, 16));
    }
  });

  it('a key that is not 32 bytes is refused', () => {
    expect(() => createLocalKeyProvider(legacyKeyRing(Buffer.alloc(16)))).toThrow(KeyProviderError);
  });
});

describe('handles and associated data', () => {
  it('an unbound master key is the ring {active: legacy}; bindKeyProvider replaces it; a provider is its own handle', () => {
    const handle = Buffer.alloc(32, 7);
    const fallback = keyProviderFor(handle);
    expect([fallback.kind, fallback.activeVersion(), fallback.versions()]).toEqual(['local-keyring', 'legacy', [{ id: 'legacy', state: 'active' }]]);
    expect(keyProviderFor(handle)).toBe(fallback);
    expect(text(fallback.openSync({ bytes: encrypt(MASTER, 'v') }, AAD))).toBe('v');
    const ring = createLocalKeyProvider(ringOf('k2', { legacy: MASTER, k2: K2 }));
    bindKeyProvider(handle, ring);
    expect(keyProviderFor(handle)).toBe(ring);
    expect(keyProviderFor(Buffer.alloc(32, 7))).not.toBe(ring);
    expect(keyProviderFor(ring)).toBe(ring);
  });

  it('associated data is lti|app:<table>:<column>:<owner>:<row key>; only the row key may contain ":"', () => {
    expect(associatedData('lti', 'tool_key', 'private_jwk_encrypted', 'cogniate', 'a:b')).toBe('lti:tool_key:private_jwk_encrypted:cogniate:a:b');
    expect(() => associatedData('lti', 'tool_key', 'private_jwk_encrypted', 'cog:niate', 'kid')).toThrow();
    expect(() => associatedData('lti', 'tool_key', '', 'cogniate', 'kid')).toThrow();
  });
});
