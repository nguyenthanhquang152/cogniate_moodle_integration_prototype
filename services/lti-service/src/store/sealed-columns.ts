// One inventory for readiness, operator status and re-wrap (LA-ADR-06 D6). Store writers use the same AAD builders.
import { associatedData, blobKeyVersion } from '@cogniate/shared';
import type { Db } from '../db/index.ts';

export interface SealedColumn {
  readonly table: string;
  readonly column: string;
  readonly key: string;
  readonly present: string;
  readonly aad: (accountId: string, rowId: string) => string;
}

function sealedColumn(table: string, column: string, key: string, present: string): SealedColumn {
  return { table, column, key, present, aad: (accountId, rowId) => associatedData('lti', table, column, accountId, rowId) };
}

// Removed signing keys can keep an empty blob. Registration tokens count until their blob is NULL, even if expired.
export const TOOL_KEY_COLUMN = sealedColumn('tool_key', 'private_jwk_encrypted', 'kid', 'length(private_jwk_encrypted) > 0');
export const REGISTRATION_TOKEN_COLUMN = sealedColumn('registration_session', 'registration_token_encrypted', 'id', 'registration_token_encrypted IS NOT NULL');
export const SEALED_COLUMNS: readonly SealedColumn[] = [TOOL_KEY_COLUMN, REGISTRATION_TOKEN_COLUMN];

/** Includes every stored blob that still needs a key version, regardless of the row's lifecycle state. */
export function sealedVersionCounts(db: Db, columns: readonly SealedColumn[] = SEALED_COLUMNS): Map<string, number> {
  const counts = new Map<string, number>();
  for (const spec of columns) {
    for (const row of db.prepare(`SELECT ${spec.column} AS blob FROM ${spec.table} WHERE ${spec.present}`).iterate()) {
      const version = blobKeyVersion(row.blob as Uint8Array);
      counts.set(version, (counts.get(version) ?? 0) + 1);
    }
  }
  return counts;
}
