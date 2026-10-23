// LA-E5-22 (LA-ADR-06 D6 app part, D12; A2 BD-A2-91): the app seals its stored secrets with the shared key provider,
// as the LTI service does. Each sealed value has the associated data `app:<table>:<column>:<library_id>:<row key>`, so
// a value copied to another row does not open. A legacy blob (no header) still opens with the version `legacy`. The
// runtime token is a MAC with the version `legacy`, so its value does not change.
//
// The callers keep the APP_MASTER_KEY Buffer as the key handle. main.ts and the worker read the key settings once
// (readAppStartupKeys, through loadConfig) and bind the key ring to that handle (loadAppKeyProvider); after the
// binding, a handle that is not bound fails closed. Before any binding (unit tests), the handle is the one version
// `legacy`, active: today's behaviour.
import type { KeyRing, LocalKeyProvider, Logger } from '@cogniate/shared';
import {
  KeyProviderError, LEGACY_KEY_VERSION, associatedData, bindKeyProvider, blobKeyVersion, createLocalKeyProvider, keyProviderFor, legacyKeyRing,
  parseKeyRing, readSecretFile, readSecretSetting,
} from '@cogniate/shared';
import { transaction, type Db } from '../domain/db.ts';

type Env = Record<string, string | undefined>;

/** BD-A2-91: not in infra/.secrets/app, which the e2e container can read. */
export const DEFAULT_APP_KEYRING_FILE = '/run/secrets/app-keys/keyring.json';

/**
 * One sealed column of the app: how to list its stored blobs, and the compare-and-set update of one blob. An empty
 * blob is a cleared value (a used picker keeps X''), not a sealed one.
 */
export interface AppSealedColumn {
  readonly table: 'connection' | 'resource_link' | 'picker_session';
  readonly column: string;
  /** Every stored blob with its row key and library id: `SELECT row_key, library_id, blob`. */
  readonly rows: string;
  /** Parameters: the new blob, the row key, the old blob. Changes 0 rows when the row changed in the meantime. */
  readonly update: string;
  /** False for short-lived values that may keep their old form until they expire (LA-E5-22 notes). */
  readonly rewrap: boolean;
}

const viaConnection = (table: 'resource_link' | 'picker_session', column: string, rewrap: boolean): AppSealedColumn => ({
  table, column, rewrap,
  rows: `SELECT t.id AS row_key, c.library_id AS library_id, t.${column} AS blob FROM ${table} t JOIN connection c ON c.id = t.connection_id
    WHERE t.${column} IS NOT NULL AND length(t.${column}) > 0`,
  update: `UPDATE ${table} SET ${column} = ? WHERE id = ? AND ${column} = ?`,
});

/** The Moodle web-services token (row key: the connection id). */
export const WS_TOKEN_COLUMN: AppSealedColumn = {
  table: 'connection', column: 'ws_token_encrypted', rewrap: true,
  rows: 'SELECT id AS row_key, library_id, ws_token_encrypted AS blob FROM connection WHERE ws_token_encrypted IS NOT NULL AND length(ws_token_encrypted) > 0',
  update: 'UPDATE connection SET ws_token_encrypted = ? WHERE id = ? AND ws_token_encrypted = ?',
};
/** The copy of the registration ref. Row key: the ref hash (newRef seals the ref before the connection has an id). */
export const REF_COPY_COLUMN: AppSealedColumn = {
  table: 'connection', column: 'ref_token_encrypted', rewrap: true,
  rows: 'SELECT ref_token_hash AS row_key, library_id, ref_token_encrypted AS blob FROM connection WHERE ref_token_encrypted IS NOT NULL AND length(ref_token_encrypted) > 0 AND ref_token_hash IS NOT NULL',
  update: 'UPDATE connection SET ref_token_encrypted = ? WHERE ref_token_hash = ? AND ref_token_encrypted = ?',
};
/** The LTI service key of a resource link (the score dispatch uses it). */
export const SERVICE_KEY_COLUMN = viaConnection('resource_link', 'service_key_encrypted', true);
/** The ltik of a picker session: it lives for minutes, so the re-wrap leaves it. */
export const PICKER_LTIK_COLUMN = viaConnection('picker_session', 'ltik_encrypted', false);
export const APP_SEALED_COLUMNS: readonly AppSealedColumn[] = [WS_TOKEN_COLUMN, REF_COPY_COLUMN, SERVICE_KEY_COLUMN, PICKER_LTIK_COLUMN];

/** The associated data of one stored value. */
export function appAad(column: AppSealedColumn, libraryId: string, rowKey: string): string {
  return associatedData('app', column.table, column.column, libraryId, rowKey);
}

/** Seal a text value of one row with the active key version. */
export function sealText(handle: Buffer, text: string, aad: string): Buffer {
  return Buffer.from(keyProviderFor(handle).sealSync(Buffer.from(text, 'utf8'), aad).bytes);
}

/** Open a sealed text value of one row (also a legacy blob). Throws a KeyProviderError (`key_open_failed`). */
export function openText(handle: Buffer, blob: Uint8Array, aad: string): string {
  return Buffer.from(keyProviderFor(handle).openSync({ bytes: blob }, aad)).toString('utf8');
}

/** The runtime token MAC: the version `legacy` keeps today's value, HMAC-SHA-256(APP_MASTER_KEY, input). */
export function runtimeTokenMac(handle: Buffer, input: string): string {
  return Buffer.from(keyProviderFor(handle).macSync('runtime-token', LEGACY_KEY_VERSION, Buffer.from(input, 'utf8'))).toString('base64url');
}

// ---------------------------------------------------------------- settings and start

export interface AppStartupKeys {
  ring: KeyRing;
  /** The key handle of the callers: the bytes of the version `legacy`. */
  handle: Buffer;
}

function readIfExists(path: string, env: Env, logger?: Pick<Logger, 'warn'>): string | null {
  try {
    return readSecretFile(path, 'APP_KEYRING_FILE', env.STACK_PROFILE || 'default', logger);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * The one reader of the app key settings (the rules of the LTI service, BD-A2-77..80):
 *  - a key-ring file (APP_KEYRING_FILE): it must hold the version `legacy` (the runtime token derives with it); the
 *    handle is its bytes. APP_MASTER_KEY or APP_MASTER_KEY_FILE next to it must be the same key (hex without case);
 *  - no key-ring file: APP_MASTER_KEY or APP_MASTER_KEY_FILE is the version `legacy`, active, and the handle.
 * A file with group or world access is refused in `production` (secret_file_mode); else one warning is logged.
 */
export function readAppStartupKeys(env: Env = process.env, logger?: Pick<Logger, 'warn'>): AppStartupKeys {
  const text = readIfExists(env.APP_KEYRING_FILE || DEFAULT_APP_KEYRING_FILE, env, logger);
  const master = readSecretSetting(env, 'APP_MASTER_KEY', { hexKey: true, ...(logger ? { logger } : {}) });
  if (text === null) {
    if (master === undefined) throw new Error('APP_MASTER_KEY must be 64 hex characters (npm run gen-env), or APP_MASTER_KEY_FILE or the app key-ring file must hold the key.');
    const handle = Buffer.from(master, 'hex');
    return { ring: legacyKeyRing(handle), handle };
  }
  const ring = parseKeyRing(text);
  const legacy = ring.keys.get(LEGACY_KEY_VERSION);
  if (!legacy) throw new KeyProviderError('key_ring_invalid', 'The app key ring has no legacy version.');
  if (master !== undefined && master !== Buffer.from(legacy).toString('hex')) {
    throw new KeyProviderError('key_ring_invalid', 'The app master key and the app key-ring legacy version differ.');
  }
  return { ring, handle: Buffer.from(legacy) };
}

/** The key version of every stored blob (structural header parse), with its count. */
export function appSealedVersionCounts(db: Db, columns: readonly AppSealedColumn[] = APP_SEALED_COLUMNS): Map<string, number> {
  const counts = new Map<string, number>();
  for (const column of columns) {
    for (const row of db.prepare(column.rows).iterate()) {
      const version = blobKeyVersion(row.blob as Uint8Array);
      counts.set(version, (counts.get(version) ?? 0) + 1);
    }
  }
  return counts;
}

/** The key versions that stored app values use and the provider does not have (readiness: key_version_missing). */
export function missingAppKeyVersions(db: Db, provider: Pick<LocalKeyProvider, 'versions'>): string[] {
  const known = new Set(provider.versions().map((v) => v.id));
  return [...appSealedVersionCounts(db).keys()].filter((version) => !known.has(version)).sort();
}

/**
 * Bind the key ring to the handle of the callers, then check once that the ring has every version in use. A missing
 * version logs `key_provider_not_ready {version}` and the app still starts; the operator /readyz then gives 503.
 */
export async function loadAppKeyProvider(deps: { db: Db; masterKey: Buffer; ring: KeyRing; logger?: Logger }): Promise<LocalKeyProvider> {
  const provider = createLocalKeyProvider(deps.ring, { referencedVersions: () => appSealedVersionCounts(deps.db).keys(), ...(deps.logger ? { logger: deps.logger } : {}) });
  bindKeyProvider(deps.masterKey, provider);
  try {
    await provider.ready();
  } catch (err) {
    if (!(err instanceof KeyProviderError)) throw err;
  }
  return provider;
}

// ---------------------------------------------------------------- re-wrap (app:keys rewrap)

export interface RewrapResult {
  examined: number;
  rewrapped: number;
  /** The compare-and-set found another value: the row changed in the meantime. */
  skippedChanged: number;
  unreadable: number;
  /** The header versions of the unreadable rows, so an operator sees which ring version is missing. */
  unreadableVersions: string[];
}

export const REWRAP_BATCH_ROWS = 100;

/**
 * Re-seal every long-lived blob that is not in the active version (also legacy blobs), in batches of 100 rows per
 * transaction with a compare-and-set update (LA-ADR-06 D6 "Re-wrap"). The authenticated metadata decides (BD-A2-38):
 * a legacy blob whose bytes look like a header is re-sealed too. Idempotent; a second run finds nothing to do.
 */
export function rewrapAppBlobs(db: Db, provider: LocalKeyProvider): RewrapResult {
  const result: RewrapResult = { examined: 0, rewrapped: 0, skippedChanged: 0, unreadable: 0, unreadableVersions: [] };
  const unreadable = new Set<string>();
  const active = provider.activeVersion();
  for (const column of APP_SEALED_COLUMNS.filter((c) => c.rewrap)) {
    const rows = db.prepare(column.rows).all().map((r) => ({ rowKey: String(r.row_key), libraryId: String(r.library_id), blob: r.blob as Uint8Array }));
    const update = db.prepare(column.update);
    for (let i = 0; i < rows.length; i += REWRAP_BATCH_ROWS) {
      transaction(db, () => {
        for (const row of rows.slice(i, i + REWRAP_BATCH_ROWS)) {
          result.examined += 1;
          const aad = appAad(column, row.libraryId, row.rowKey);
          let opened;
          try {
            opened = provider.openWithMetadataSync({ bytes: row.blob }, aad);
          } catch {
            result.unreadable += 1;
            unreadable.add(blobKeyVersion(row.blob));
            continue;
          }
          if (opened.version === active && !opened.legacyFormat) continue;
          const sealed = provider.sealSync(opened.plaintext, aad).bytes;
          if (Number(update.run(sealed, row.rowKey, row.blob).changes) === 1) result.rewrapped += 1;
          else result.skippedChanged += 1;
        }
      });
    }
  }
  result.unreadableVersions = [...unreadable].sort();
  return result;
}
