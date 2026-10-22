// Key-ring settings of the LTI service (LA-ADR-06 D6; operability §2, §6.3). Read once at start:
//   LTI_KEYRING_FILE (default /run/secrets/lti/keyring.json; compose mounts infra/.secrets/lti/ read only there):
//     {"active": "k2", "keys": {"legacy": "<64 hex>", "k2": "<64 hex>"}}
//   No file: LTI_MASTER_KEY (or the file LTI_MASTER_KEY_FILE) is the one version "legacy", and it is active. So today's
//   stack starts without a change.
// The store callers still pass the LTI_MASTER_KEY Buffer; loadKeyProvider binds the loaded ring to it. The async store
// port (LA-E5-23) can pass the provider itself.
import { readFileSync } from 'node:fs';
import type { KeyRing, LocalKeyProvider, Logger } from '@cogniate/shared';
import { KeyProviderError, bindKeyProvider, createLocalKeyProvider, legacyKeyRing, parseKeyRing } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { registrationTokenVersions } from '../store/registrations.ts';
import { serviceKeyVersions } from '../store/service-keys.ts';
import { SIGNING_KEY_PUBLISH_LEAD_S, toolKeyVersions, validatePublishLeadSeconds } from '../store/tool-keys.ts';

export const DEFAULT_KEYRING_FILE = '/run/secrets/lti/keyring.json';

type Env = Record<string, string | undefined>;

/** Read once at start. Invalid settings stop the service; unit overrides use the same check. */
export function readSigningKeyPublishLeadSeconds(env: Env = process.env): number {
  const value = env.SIGNING_KEY_PUBLISH_LEAD_S;
  return validatePublishLeadSeconds(value === undefined ? SIGNING_KEY_PUBLISH_LEAD_S : Number(value));
}

/** The file text, or null when the file does not exist. Any other error (for example no read access) stops the start. */
function readIfExists(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

function masterKeyFromEnv(env: Env): Buffer {
  const fromFile = env.LTI_MASTER_KEY_FILE ? readFileSync(env.LTI_MASTER_KEY_FILE, 'utf8').trim() : undefined;
  const fromEnv = env.LTI_MASTER_KEY || undefined;
  if (fromFile !== undefined && fromEnv !== undefined && fromFile.toLowerCase() !== fromEnv.toLowerCase()) {
    throw new KeyProviderError('key_ring_invalid', 'LTI_MASTER_KEY and LTI_MASTER_KEY_FILE have different values.');
  }
  const hex = fromFile ?? fromEnv ?? '';
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new KeyProviderError('key_ring_invalid', 'No key-ring file, and LTI_MASTER_KEY (or LTI_MASTER_KEY_FILE) is not 64 hex characters.');
  }
  return Buffer.from(hex, 'hex');
}

/** The key ring of the settings. A bad file or key stops the start (KeyProviderError `key_ring_invalid`). */
export function readKeyRing(env: Env = process.env): KeyRing {
  const text = readIfExists(env.LTI_KEYRING_FILE || DEFAULT_KEYRING_FILE);
  return text === null ? legacyKeyRing(masterKeyFromEnv(env)) : parseKeyRing(text);
}

/** Every key version that a stored row uses: the sealed blobs and the service-key derivations. */
export function keyVersionsInUse(db: Db): string[] {
  return [...new Set([...toolKeyVersions(db), ...registrationTokenVersions(db), ...serviceKeyVersions(db)])].sort();
}

export interface LoadKeyProviderDeps {
  db: Db;
  /** The LTI_MASTER_KEY Buffer that main.ts gives to the routes and the token client. */
  masterKey: Buffer;
  logger?: Logger;
  env?: Env;
}

/**
 * Load the key ring, bind it to the master-key Buffer of the callers, and check once that the ring has every version
 * in use. A missing version logs `key_provider_not_ready {version}`, and the service still starts (LA-E5-17: `/readyz`
 * then gives 503). A key ring that cannot be read or parsed stops the start.
 */
export async function loadKeyProvider(deps: LoadKeyProviderDeps): Promise<LocalKeyProvider> {
  const provider = createLocalKeyProvider(readKeyRing(deps.env), { referencedVersions: () => keyVersionsInUse(deps.db), logger: deps.logger });
  bindKeyProvider(deps.masterKey, provider);
  try {
    await provider.ready();
  } catch (err) {
    if (!(err instanceof KeyProviderError)) throw err;
  }
  return provider;
}
