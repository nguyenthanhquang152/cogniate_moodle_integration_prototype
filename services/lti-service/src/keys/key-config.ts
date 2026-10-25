// Key-ring settings of the LTI service (LA-ADR-06 D6, D12; operability §2, §6.3). Read once at start:
//   LTI_KEYRING_FILE (default /run/secrets/lti/keyring.json; compose mounts infra/.secrets/lti/ read only there):
//     {"active": "k2", "keys": {"legacy": "<64 hex>", "k2": "<64 hex>"}}; the ring must hold "legacy" (BD-A2-77).
//   No file: LTI_MASTER_KEY (or the file LTI_MASTER_KEY_FILE) is the one version "legacy", and it is active. So today's
//   stack starts without a change.
// The store callers pass one key handle (the legacy key bytes); loadKeyProvider binds the loaded ring to it. The async
// store port (LA-E5-23) can pass the provider itself.
import type { KeyRing, LocalKeyProvider, Logger } from '@cogniate/shared';
import {
  KeyProviderError, LEGACY_KEY_VERSION, legacyKeyRing, parseKeyRing, readSecretFile, readSecretSetting,
} from '@cogniate/shared';
import type { StoreSource as Db } from '../store/index.ts';
import { storeFor } from '../store/index.ts';
import { SIGNING_KEY_PUBLISH_LEAD_S, validatePublishLeadSeconds } from '../store/tool-keys.ts';

export const DEFAULT_KEYRING_FILE = '/run/secrets/lti/keyring.json';

type Env = Record<string, string | undefined>;

/** Read once at start. Invalid settings stop the service; unit overrides use the same check. */
export function readSigningKeyPublishLeadSeconds(env: Env = process.env): number {
  const value = env.SIGNING_KEY_PUBLISH_LEAD_S;
  return validatePublishLeadSeconds(value === undefined ? SIGNING_KEY_PUBLISH_LEAD_S : Number(value));
}

/**
 * The file text, or null when the file does not exist. The secret-file rule applies to an existing file (BD-A2-78:
 * production refuses group or world access). Any other error (for example no read access) stops the start.
 */
function readIfExists(path: string, env: Env, logger?: Pick<Logger, 'warn'>): string | null {
  try {
    return readSecretFile(path, 'LTI_KEYRING_FILE', env.STACK_PROFILE || 'default', logger);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export interface StartupKeys {
  ring: KeyRing;
  /** The key handle of the store callers: the bytes of the version "legacy". */
  handle: Buffer;
}

/**
 * BD-A2-77: the one reader of the key settings at start; it gives the ring and the key handle.
 *  - A key-ring file: the ring must hold the version "legacy" (every service key derives with it, D6); the handle is
 *    its bytes. A master key that is also set must be the same key (hex compare without letter case, BD-A2-80), so a
 *    stale second secret never wins in silence.
 *  - No key-ring file: LTI_MASTER_KEY or LTI_MASTER_KEY_FILE is the version "legacy", active, and the handle.
 * A bad file or key stops the start (KeyProviderError `key_ring_invalid`, or the secret-file refusal).
 */
export function readStartupKeys(env: Env = process.env, logger?: Pick<Logger, 'warn'>): StartupKeys {
  const text = readIfExists(env.LTI_KEYRING_FILE || DEFAULT_KEYRING_FILE, env, logger);
  const master = readSecretSetting(env, 'LTI_MASTER_KEY', { hexKey: true, logger });
  if (text === null) {
    if (master === undefined) {
      throw new KeyProviderError('key_ring_invalid', 'No key-ring file, and LTI_MASTER_KEY (or LTI_MASTER_KEY_FILE) is not 64 hex characters.');
    }
    const handle = Buffer.from(master, 'hex');
    return { ring: legacyKeyRing(handle), handle };
  }
  const ring = parseKeyRing(text);
  const legacy = ring.keys.get(LEGACY_KEY_VERSION);
  if (!legacy) throw new KeyProviderError('key_ring_invalid', 'The key ring has no legacy version.');
  if (master !== undefined && master !== Buffer.from(legacy).toString('hex')) {
    throw new KeyProviderError('key_ring_invalid', 'The master key and the key-ring legacy version differ.');
  }
  return { ring, handle: Buffer.from(legacy) };
}

/** The key ring of the settings (readStartupKeys). */
export function readKeyRing(env: Env = process.env): KeyRing {
  return readStartupKeys(env).ring;
}

/** Every key version that a stored row uses: the sealed blobs and the service-key derivations. */
export async function keyVersionsInUse(db: Db): Promise<string[]> {
  return storeFor(db).keyProvider.versionsInUse();
}

export interface LoadKeyProviderDeps {
  db: Db;
  /** The key handle that main.ts gives to the routes and the token client (readStartupKeys). */
  masterKey: Buffer;
  logger?: Logger;
  env?: Env;
  /** The ring that main.ts already read with readStartupKeys; when given, the settings are not read again. */
  ring?: KeyRing;
}

/**
 * Load the key ring, bind it to the master-key Buffer of the callers, and check once that the ring has every version
 * in use. A missing version logs `key_provider_not_ready {version}`, and the service still starts (LA-E5-17: `/readyz`
 * then gives 503). A key ring or persisted key-provider setting that cannot be read or parsed stops the start.
 */
export async function loadKeyProvider(deps: LoadKeyProviderDeps): Promise<LocalKeyProvider> {
  // Detect a damaged policy once at start, before binding a provider. Keep the row value out of the error.
  try { await storeFor(deps.db).settings.legacyBlobsRefused(); }
  catch { throw new Error('key_provider_setting_invalid: cannot read the key_provider service setting.'); }
  const provider = await storeFor(deps.db).keyProvider.create(deps.masterKey, deps.ring ?? readKeyRing(deps.env), deps.logger);
  try {
    await provider.ready();
  } catch (err) {
    if (!(err instanceof KeyProviderError)) throw err;
  }
  return provider;
}
