// Key provider (LA-ADR-06 D6): the only code that holds key material. One port, `KeyProvider`. LA has one adapter, the
// local key ring (`kind: local-keyring`); a cloud KMS adapter comes in LG.
//
// Blob format "cgk1" (AES-256-GCM everywhere; each sealed part is `iv(12) | tag(16) | ciphertext`):
//   "cgk1" | version length (1 byte) | version id | wrapped key length (2 bytes, big endian) | wrapped data key | value
// Each blob has its own random data key. The key of the version wraps it, with the header bytes before it as associated
// data. The data key seals the value, with the associated data of the row, so a blob moved to another row does not open
// (R4 M-2). A blob without the magic is a legacy blob (`encrypt` of crypto.ts: master key, no associated data); it opens
// with the version `legacy`.
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import type { Logger } from './logger.ts';

export type MacPurpose = 'service-key' | 'runtime-token';
export interface SealedBlob { bytes: Uint8Array }
export interface KeyVersion { id: string; state: 'active' | 'decrypt-only' }

/** LA-ADR-06 D6. Every method fails closed: a missing version or a failed tag throws a KeyProviderError. */
export interface KeyProvider {
  readonly kind: string;
  /** Fails when a version that a stored row uses is not in the provider. */
  ready(): Promise<void>;
  activeVersion(): string;
  /** A new data key, wrapped by the active version. */
  seal(plaintext: Uint8Array, aad: string): Promise<SealedBlob>;
  /** Also opens legacy blobs (no header) with the version `legacy`. */
  open(blob: SealedBlob, aad: string): Promise<Uint8Array>;
  mac(purpose: MacPurpose, version: string, input: Uint8Array): Promise<Uint8Array>;
  versions(): ReadonlyArray<KeyVersion>;
}

/** The local key ring also works synchronously: the LTI store functions stay sync until the async store port (LA-E5-23). */
export interface LocalKeyProvider extends KeyProvider {
  readonly kind: 'local-keyring';
  sealSync(plaintext: Uint8Array, aad: string): SealedBlob;
  openSync(blob: SealedBlob, aad: string): Uint8Array;
  macSync(purpose: MacPurpose, version: string, input: Uint8Array): Uint8Array;
}

/** Key versions: 32-byte keys by version id, and the active version that seals new blobs. */
export interface KeyRing {
  active: string;
  keys: ReadonlyMap<string, Uint8Array>;
}

export interface LocalKeyProviderOptions {
  /** Key versions that stored rows use (sealed blobs and derived values). `ready()` fails when one is not in the ring. */
  referencedVersions?: () => Iterable<string> | Promise<Iterable<string>>;
  /** Gets `key_provider_not_ready {version}` and `key_open_failed {table, reason}`. */
  logger?: Pick<Logger, 'error'>;
}

export type KeyProviderErrorCode = 'key_ring_invalid' | 'key_version_missing' | 'key_open_failed';

/** The message names versions and tables only, never key material. */
export class KeyProviderError extends Error {
  readonly code: KeyProviderErrorCode;
  /** The missing versions (code `key_version_missing`). */
  readonly versions: readonly string[];
  constructor(code: KeyProviderErrorCode, message: string, versions: readonly string[] = []) {
    super(message);
    this.name = 'KeyProviderError';
    this.code = code;
    this.versions = versions;
  }
}

/** The version of today's master key: legacy blobs and today's derived values (service key, runtime token). */
export const LEGACY_KEY_VERSION = 'legacy';

const MAGIC = Buffer.from('cgk1', 'ascii');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const WRAPPED_KEY_BYTES = IV_BYTES + TAG_BYTES + KEY_BYTES;
const VERSION_ID = /^[A-Za-z0-9._-]{1,64}$/;
const KEY_HEX = /^[0-9a-f]{64}$/i;

// The version `legacy` keeps today's values byte for byte (M1 rule): the LTI service key used the subkey
// HMAC(master key, "cogniate-lti/service-key/v1"); the app runtime token used the master key itself (`runtimeTokenFor`).
const LEGACY_SUBKEY: Record<MacPurpose, (key: Uint8Array) => Uint8Array> = {
  'service-key': (key) => createHmac('sha256', key).update('cogniate-lti/service-key/v1').digest(),
  'runtime-token': (key) => key,
};

const invalidRing = (why: string) => new KeyProviderError('key_ring_invalid', `Key ring: ${why}.`);
const asBuffer = (bytes: Uint8Array) => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);

function gcmSeal(key: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad);
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}

/** Throws when the tag does not match. `aad` null = no associated data (the legacy form). */
function gcmOpen(key: Uint8Array, sealed: Buffer, aad: Uint8Array | null): Buffer {
  if (sealed.length < IV_BYTES + TAG_BYTES) throw new Error('sealed part too short');
  const decipher = createDecipheriv('aes-256-gcm', key, sealed.subarray(0, IV_BYTES), { authTagLength: TAG_BYTES });
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(sealed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(sealed.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
}

interface Header { version: string; head: Buffer; wrapped: Buffer; value: Buffer }

/** The "cgk1" header, or null for a blob that does not have one (a legacy blob). */
function parseHeader(bytes: Uint8Array): Header | null {
  const buf = asBuffer(bytes);
  if (buf.length < MAGIC.length + 1 || !buf.subarray(0, MAGIC.length).equals(MAGIC)) return null;
  const versionEnd = MAGIC.length + 1 + buf[MAGIC.length]!;
  if (buf.length < versionEnd + 2) return null;
  const version = buf.subarray(MAGIC.length + 1, versionEnd).toString('latin1');
  const wrappedEnd = versionEnd + 2 + buf.readUInt16BE(versionEnd);
  if (!VERSION_ID.test(version) || wrappedEnd - versionEnd - 2 !== WRAPPED_KEY_BYTES || buf.length < wrappedEnd + IV_BYTES + TAG_BYTES) return null;
  return { version, head: buf.subarray(0, versionEnd), wrapped: buf.subarray(versionEnd + 2, wrappedEnd), value: buf.subarray(wrappedEnd) };
}

/** The key version of a stored blob: the header version, or `legacy` for a blob without the header. */
export function blobKeyVersion(bytes: Uint8Array): string {
  return parseHeader(bytes)?.version ?? LEGACY_KEY_VERSION;
}

/**
 * Associated data of one sealed column value (LA-ADR-06 D6): `<service>:<table>:<column>:<owner id>:<row key>`, for
 * example `lti:tool_key:private_jwk_encrypted:cogniate:<kid>`. Only the row key may contain ":", so two rows never get
 * the same value.
 */
export function associatedData(service: 'lti' | 'app', table: string, column: string, ownerId: string, rowKey: string): string {
  if ([table, column, ownerId].some((part) => part === '' || part.includes(':'))) throw new Error('associated data: table, column and owner id must be non-empty and have no ":"');
  return `${service}:${table}:${column}:${ownerId}:${rowKey}`;
}

/** Parse the key-ring file: `{"active": "k2", "keys": {"legacy": "<64 hex>", "k2": "<64 hex>"}}`. */
export function parseKeyRing(text: string): KeyRing {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw invalidRing('the file is not JSON');
  }
  const ring = data as { active?: unknown; keys?: unknown } | null;
  if (ring === null || typeof ring !== 'object' || typeof ring.active !== 'string' || ring.keys === null || typeof ring.keys !== 'object') {
    throw invalidRing('it needs "active" (a version id) and "keys" (an object)');
  }
  const keys = new Map<string, Uint8Array>();
  for (const [id, hex] of Object.entries(ring.keys)) {
    if (!VERSION_ID.test(id)) throw invalidRing('a version id must be 1-64 characters of A-Z, a-z, 0-9, ".", "_" or "-"');
    if (typeof hex !== 'string' || !KEY_HEX.test(hex)) throw invalidRing(`the key of version "${id}" must be 64 hex characters`);
    keys.set(id, Buffer.from(hex, 'hex'));
  }
  if (!keys.has(ring.active)) throw invalidRing(`the active version "${VERSION_ID.test(ring.active) ? ring.active : '?'}" is not in "keys"`);
  return { active: ring.active, keys };
}

/** Today's stack: the master key is the one version `legacy`, and it is active. */
export function legacyKeyRing(masterKey: Uint8Array): KeyRing {
  return { active: LEGACY_KEY_VERSION, keys: new Map([[LEGACY_KEY_VERSION, masterKey]]) };
}

export function createLocalKeyProvider(ring: KeyRing, options: LocalKeyProviderOptions = {}): LocalKeyProvider {
  const keys = new Map<string, Buffer>();
  for (const [id, key] of ring.keys) {
    if (!VERSION_ID.test(id) || key.length !== KEY_BYTES) throw invalidRing(`version "${VERSION_ID.test(id) ? id : '?'}" needs a 32-byte key`);
    keys.set(id, Buffer.from(key));
  }
  const active = ring.active;
  if (!keys.has(active)) throw invalidRing('the active version is not in the ring');
  const log = options.logger;

  function openFailed(aad: string, reason: 'version_missing' | 'auth_failed'): KeyProviderError {
    const table = aad.split(':')[1] || 'unknown';
    log?.error('key_open_failed', { table, reason });
    return new KeyProviderError('key_open_failed', `A sealed value of table ${table} did not open (${reason}).`);
  }

  function sealSync(plaintext: Uint8Array, aad: string): SealedBlob {
    const version = Buffer.from(active, 'ascii');
    const head = Buffer.concat([MAGIC, Buffer.from([version.length]), version]);
    const dataKey = randomBytes(KEY_BYTES);
    try {
      const wrapped = gcmSeal(keys.get(active)!, dataKey, head);
      const length = Buffer.alloc(2);
      length.writeUInt16BE(wrapped.length);
      return { bytes: Buffer.concat([head, length, wrapped, gcmSeal(dataKey, plaintext, Buffer.from(aad, 'utf8'))]) };
    } finally {
      dataKey.fill(0);
    }
  }

  function openSync(blob: SealedBlob, aad: string): Uint8Array {
    const header = parseHeader(blob.bytes);
    let reason: 'version_missing' | 'auth_failed' = 'auth_failed';
    if (header) {
      const versionKey = keys.get(header.version);
      if (versionKey) {
        try {
          const dataKey = gcmOpen(versionKey, header.wrapped, header.head);
          try {
            return gcmOpen(dataKey, header.value, Buffer.from(aad, 'utf8'));
          } finally {
            dataKey.fill(0);
          }
        } catch {
          // Try the legacy form below: a legacy blob may start with the magic by chance (2^-32).
        }
      } else {
        reason = 'version_missing';
      }
    }
    // The GCM tag proves the result of the legacy form too.
    const legacy = keys.get(LEGACY_KEY_VERSION);
    if (!legacy) throw openFailed(aad, header ? reason : 'version_missing');
    try {
      return gcmOpen(legacy, asBuffer(blob.bytes), null);
    } catch {
      throw openFailed(aad, reason);
    }
  }

  function macSync(purpose: MacPurpose, version: string, input: Uint8Array): Uint8Array {
    const key = keys.get(version);
    if (!key) throw new KeyProviderError('key_version_missing', `Key version ${version} is not in the key ring.`, [version]);
    const subkey = version === LEGACY_KEY_VERSION
      ? LEGACY_SUBKEY[purpose](key)
      : Buffer.from(hkdfSync('sha256', key, Buffer.alloc(0), `cogniate-lti/${purpose}/${version}`, KEY_BYTES));
    return createHmac('sha256', subkey).update(input).digest();
  }

  return {
    kind: 'local-keyring',
    async ready() {
      const used = options.referencedVersions ? await options.referencedVersions() : [];
      const missing = [...new Set(used)].filter((version) => !keys.has(version)).sort();
      for (const version of missing) log?.error('key_provider_not_ready', { version });
      if (missing.length > 0) throw new KeyProviderError('key_version_missing', `Key versions in use are not in the key ring: ${missing.join(', ')}.`, missing);
    },
    activeVersion: () => active,
    seal: async (plaintext, aad) => sealSync(plaintext, aad),
    open: async (blob, aad) => openSync(blob, aad),
    mac: async (purpose, version, input) => macSync(purpose, version, input),
    versions: () => [active, ...[...keys.keys()].filter((id) => id !== active)].map((id) => ({ id, state: id === active ? 'active' : 'decrypt-only' })),
    sealSync,
    openSync,
    macSync,
  };
}

/** A key provider, or the LTI_MASTER_KEY Buffer that the store callers still pass until the async store port (LA-E5-23). */
export type KeyHandle = Uint8Array | LocalKeyProvider;

const providers = new WeakMap<Uint8Array, LocalKeyProvider>();

/** Make `keyProviderFor(masterKey)` give the loaded key ring (the service calls it once at start). */
export function bindKeyProvider(masterKey: Uint8Array, provider: LocalKeyProvider): void {
  providers.set(masterKey, provider);
}

/** The provider of a handle. A master key that is not bound is a ring with the one version `legacy` (today's stack). */
export function keyProviderFor(handle: KeyHandle): LocalKeyProvider {
  if (!(handle instanceof Uint8Array)) return handle;
  let provider = providers.get(handle);
  if (!provider) {
    provider = createLocalKeyProvider(legacyKeyRing(handle));
    providers.set(handle, provider);
  }
  return provider;
}
