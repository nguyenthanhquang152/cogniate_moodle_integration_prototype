// LA-ADR-06 D6: all sealed LTI columns. Empty tool-key blobs were cleared by signing-key removal.
import { setImmediate as yieldToLoop } from 'node:timers/promises';
import type { IntervalJob, JobContext, KeyHandle, LocalKeyProvider } from '@cogniate/shared';
import { associatedData, blobKeyVersion, keyProviderFor } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';
import { insertAuditEvent } from '../store/audit.ts';
import { refuseLegacyBlobs } from '../store/settings.ts';

export const KEY_REWRAP_JOB = 'key-rewrap';
export const KEY_REWRAP_BATCH_SIZE = 100;
const SEALED_COLUMNS = [
  { table: 'tool_key', column: 'private_jwk_encrypted', key: 'kid', present: 'length(private_jwk_encrypted) > 0' },
  { table: 'registration_session', column: 'registration_token_encrypted', key: 'id', present: 'registration_token_encrypted IS NOT NULL' },
] as const;
type SealedColumn = typeof SEALED_COLUMNS[number];
interface SealedRow { id: string; accountId: string; blob: Uint8Array }
const aadFor = (spec: SealedColumn, row: SealedRow) => associatedData('lti', spec.table, spec.column, row.accountId, row.id);
const errorClass = (err: unknown): string => err instanceof Error ? err.name : 'Error';

/** BD-A2-36: leave ten seconds for the next synchronous batch and final audit. */
function stopReason(db: Db, ctx: JobContext): 'lease' | 'stopping' | undefined {
  if (ctx.signal.aborted) return 'stopping';
  const lease = db.prepare('SELECT owner, lease_until FROM job_lease WHERE name = ?').get(KEY_REWRAP_JOB) as
    { owner: string | null; lease_until: number | null } | undefined;
  if (lease?.owner !== ctx.leaseOwner || lease.lease_until === null || lease.lease_until - ctx.now() < 10_000) return 'lease';
  return undefined;
}

function countNotReached(db: Db, examined: ReadonlySet<string>): number {
  let count = 0;
  for (const spec of SEALED_COLUMNS) {
    for (const row of db.prepare(`SELECT ${spec.key} AS id FROM ${spec.table} WHERE ${spec.present}`).iterate()) {
      if (!examined.has(`${spec.table}:${String(row.id)}`)) count += 1;
    }
  }
  return count;
}

export function keyRewrapJob(db: Db, keys: KeyHandle): IntervalJob {
  const provider = keyProviderFor(keys);
  return {
    name: KEY_REWRAP_JOB, everyMs: null, runAtStart: false,
    async run(ctx) {
      let rewrapped = 0;
      let skippedChanged = 0;
      let unreadable = 0;
      const unreadableVersions = new Set<string>();
      const examined = new Set<string>();
      let stopped: 'lease' | 'stopping' | 'legacy_remains' | undefined;
      let failure: string | undefined;
      try {
        columns: for (const spec of SEALED_COLUMNS) {
          let cursor: string | null = null;
          while (true) {
            const batch = transaction(db, () => {
              stopped = stopReason(db, ctx);
              if (stopped) return null;
              const rows = db.prepare(`SELECT ${spec.key} AS id, tool_account_id AS accountId, ${spec.column} AS blob
                FROM ${spec.table} WHERE ${spec.present} AND (? IS NULL OR ${spec.key} > ?)
                ORDER BY ${spec.key} LIMIT ?`).all(cursor, cursor, KEY_REWRAP_BATCH_SIZE) as unknown as SealedRow[];
              let changed = 0;
              let skipped = 0;
              const badVersions: string[] = [];
              for (const row of rows) {
                const aad = aadFor(spec, row);
                let opened: ReturnType<LocalKeyProvider['openWithMetadataSync']>;
                try { opened = provider.openWithMetadataSync({ bytes: row.blob }, aad); }
                catch {
                  badVersions.push(blobKeyVersion(row.blob));
                  continue;
                }
                try {
                  if (!opened.legacyFormat && opened.version === provider.activeVersion()) continue;
                  const sealed = provider.sealSync(opened.plaintext, aad);
                  const update = db.prepare(`UPDATE ${spec.table} SET ${spec.column} = ?
                    WHERE ${spec.key} = ? AND tool_account_id = ? AND ${spec.column} = ?`)
                    .run(sealed.bytes, row.id, row.accountId, row.blob);
                  if (update.changes) changed += 1;
                  else skipped += 1;
                } finally { opened.plaintext.fill(0); }
              }
              return { changed, skipped, rows, badVersions };
            });
            if (batch === null) break columns;
            rewrapped += batch.changed;
            skippedChanged += batch.skipped;
            unreadable += batch.badVersions.length;
            for (const version of batch.badVersions) unreadableVersions.add(version);
            for (const row of batch.rows) examined.add(`${spec.table}:${row.id}`);
            if (batch.rows.length > 0) {
              cursor = batch.rows.at(-1)!.id;
              await yieldToLoop();
            }
            if (batch.rows.length < KEY_REWRAP_BATCH_SIZE) break;
          }
        }
      } catch (err) { failure = errorClass(err); }

      // The flag and completion event share a commit. Earlier batches remain resumable if this commit fails.
      return transaction(db, () => {
        stopped ??= stopReason(db, ctx);
        // BD-A2-43: verify only a complete candidate, under the write lock. Partial runs do not open unreached rows.
        if (!failure && !stopped && unreadable === 0) {
          verify: for (const spec of SEALED_COLUMNS) {
            for (const value of db.prepare(`SELECT ${spec.key} AS id, tool_account_id AS accountId, ${spec.column} AS blob
              FROM ${spec.table} WHERE ${spec.present}`).iterate()) {
              stopped = stopReason(db, ctx);
              if (stopped) break verify;
              const row = value as unknown as SealedRow;
              examined.add(`${spec.table}:${row.id}`);
              let opened: ReturnType<LocalKeyProvider['openWithMetadataSync']>;
              try { opened = provider.openWithMetadataSync({ bytes: row.blob }, aadFor(spec, row)); }
              catch {
                unreadable += 1;
                unreadableVersions.add(blobKeyVersion(row.blob));
                continue;
              }
              try {
                if (opened.legacyFormat) { stopped = 'legacy_remains'; break verify; }
              } finally { opened.plaintext.fill(0); }
            }
          }
          stopped ??= stopReason(db, ctx);
        }
        const notReached = countNotReached(db, examined);
        const failed = failure !== undefined || unreadable > 0;
        const outcome = failed ? 'failed' : stopped ? 'partial' : 'complete';
        if (outcome === 'complete') refuseLegacyBlobs(db);
        insertAuditEvent(db, { action: 'key_provider.rewrap', actor: { type: 'system', id: KEY_REWRAP_JOB },
          toolAccountId: null, target: { type: 'key_provider', id: null }, traceId: ctx.traceId, clientIp: null,
          result: 'ok',
          details: { outcome, rewrapped, skippedChanged, notReached, unreadable,
            ...(unreadableVersions.size > 0 ? { unreadableVersions: [...unreadableVersions].sort() } : {}),
            ...(failure ? { errorClass: failure } : {}),
            ...(stopped ? { stopReason: stopped } : {}), ...(outcome === 'complete' ? { legacyBlobsRefused: true } : {}) },
        }, ctx.now());
        return { result: failed ? 'failed' : 'ok', counts: { rewrapped, skippedChanged, notReached, unreadable } };
      });
    },
  };
}

/** Counts include expired sessions and removed keys with a remaining blob: their key versions are still in use. */
export function keyProviderStatus(db: Db, keys: KeyHandle) {
  const provider = keyProviderFor(keys);
  const sealed = new Map<string, number>();
  for (const spec of SEALED_COLUMNS) {
    for (const row of db.prepare(`SELECT ${spec.column} AS blob FROM ${spec.table} WHERE ${spec.present}`).iterate()) {
      const version = blobKeyVersion(row.blob as Uint8Array);
      sealed.set(version, (sealed.get(version) ?? 0) + 1);
    }
  }
  const derived = new Map((db.prepare('SELECT derivation_version AS version, count(*) AS n FROM service_key GROUP BY derivation_version')
    .all() as Array<{ version: string; n: number }>).map((row) => [row.version, row.n]));
  return { kind: provider.kind, activeVersion: provider.activeVersion(), versions: provider.versions().map((version) => ({
    ...version, sealedCount: sealed.get(version.id) ?? 0, derivedCount: derived.get(version.id) ?? 0,
  })) };
}
