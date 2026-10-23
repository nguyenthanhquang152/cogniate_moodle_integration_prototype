import type { KeyRing, Logger } from '@cogniate/shared';
import { bindKeyProvider, createLocalKeyProvider } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { sealedVersionCounts } from './sealed-columns.ts';
import { serviceKeyVersions } from './service-keys.ts';
import { legacyBlobsRefused } from './settings.ts';

export function keyVersionsInUse(db: Db): string[] {
  return [...new Set([...sealedVersionCounts(db).keys(), ...serviceKeyVersions(db)])].sort();
}

/** Keep the synchronous legacy-policy check inside the SQLite adapter. It reads the current committed setting. */
export function createKeyProvider(db: Db, masterKey: Buffer, ring: KeyRing, logger?: Logger) {
  const provider = createLocalKeyProvider(ring, { referencedVersions: () => keyVersionsInUse(db),
    legacyBlobsRefused: () => legacyBlobsRefused(db), logger });
  bindKeyProvider(masterKey, provider);
  return provider;
}
