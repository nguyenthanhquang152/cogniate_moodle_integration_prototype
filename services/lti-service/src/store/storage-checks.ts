import type { RetentionResult } from '@cogniate/shared';
import { randomToken, sha256Hex } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import type { LaunchRecord } from './launches.ts';

export const STORAGE_CHECK_TTL_MS = 120_000;
const RETENTION_MS = 600_000;

/** Only checked, minimized launch data reaches this store. No id_token or raw state is stored. */
export type PreparedLaunch = Pick<LaunchRecord, 'platformId' | 'deploymentId' | 'messageType' | 'claims' | 'siteOrigin' | 'serviceOrigin' | 'bindingGeneration'> & {
  removedClaims: string[];
};

export interface StorageCheck {
  stateHash: string;
  prepared: PreparedLaunch;
}

export function createStorageCheck(db: Db, accountId: string, record: StorageCheck, now: number): string {
  const check = randomToken();
  db.prepare(`INSERT INTO storage_check (check_hash, tool_account_id, platform_id, state_hash, prepared_launch, expires_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(sha256Hex(check), accountId, record.prepared.platformId, record.stateHash, JSON.stringify(record.prepared), now + STORAGE_CHECK_TTL_MS, now);
  return check;
}

/** Account, time and single use are checked in the same statement that consumes the row. */
export function consumeStorageCheck(db: Db, accountId: string, check: string, now: number): StorageCheck | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(check)) return null;
  const row = db.prepare(`UPDATE storage_check SET used_at = ?
                         WHERE check_hash = ? AND tool_account_id = ? AND used_at IS NULL AND expires_at > ?
                         RETURNING state_hash, prepared_launch`)
    .get(now, sha256Hex(check), accountId, now) as { state_hash: string; prepared_launch: string } | undefined;
  return row ? { stateHash: row.state_hash, prepared: JSON.parse(row.prepared_launch) as PreparedLaunch } : null;
}

/** The retention job owns scheduling; keep rows for ten minutes from creation, including used rows. */
export function cleanupStorageChecks(db: Db, now: number): RetentionResult {
  return { table: 'storage_check', deleted: Number(db.prepare('DELETE FROM storage_check WHERE created_at < ?').run(now - RETENTION_MS).changes) };
}
