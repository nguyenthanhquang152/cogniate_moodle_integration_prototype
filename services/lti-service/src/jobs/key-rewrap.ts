// LA-ADR-06 D6: committed batches survive a later failure. Outcome priority is failed > partial > complete.
// A partial run stops for lease, stopping, or legacy_remains; only complete can store legacy refusal.
import { setImmediate as yieldToLoop } from 'node:timers/promises';
import type { IntervalJob, JobContext, KeyHandle, LocalKeyProvider } from '@cogniate/shared';
import { blobKeyVersion, keyProviderFor } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';
import { insertAuditEvent } from '../store/audit.ts';
import { refuseLegacyBlobs } from '../store/settings.ts';
import type { SealedColumn } from '../keys/sealed-columns.ts';
import { SEALED_COLUMNS, sealedVersionCounts } from '../keys/sealed-columns.ts';

export const KEY_REWRAP_JOB = 'key-rewrap';
export const KEY_REWRAP_BATCH_SIZE = 100;
interface SealedRow { id: string; accountId: string; blob: Uint8Array }
const aadFor = (spec: SealedColumn, row: SealedRow) => spec.aad(row.accountId, row.id);
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

type StopReason = 'lease' | 'stopping' | 'legacy_remains';
interface RunState {
  rewrapped: number; skippedChanged: number; unreadable: number;
  unreadableVersions: Set<string>; examined: Set<string>;
  stopped?: StopReason; failure?: string;
}
type OpenResult = { opened: ReturnType<LocalKeyProvider['openWithMetadataSync']> } | { unreadableVersion: string };
const selectRows = (spec: SealedColumn) => `SELECT ${spec.key} AS id, tool_account_id AS accountId, ${spec.column} AS blob
  FROM ${spec.table} WHERE ${spec.present}`;

/** Batch and final verification use the same authenticated format check (BD-A2-38). */
function openRow(provider: LocalKeyProvider, spec: SealedColumn, row: SealedRow): OpenResult {
  try { return { opened: provider.openWithMetadataSync({ bytes: row.blob }, aadFor(spec, row)) }; }
  catch { return { unreadableVersion: blobKeyVersion(row.blob) }; }
}

function rewrapBatch(db: Db, provider: LocalKeyProvider, spec: SealedColumn, cursor: string | null, ctx: JobContext) {
  return transaction(db, () => {
    const stopped = stopReason(db, ctx);
    if (stopped) return { stopped };
    const rows = db.prepare(`${selectRows(spec)} AND (? IS NULL OR ${spec.key} > ?) ORDER BY ${spec.key} LIMIT ?`)
      .all(cursor, cursor, KEY_REWRAP_BATCH_SIZE) as unknown as SealedRow[];
    let changed = 0;
    let skipped = 0;
    const badVersions: string[] = [];
    for (const row of rows) {
      const result = openRow(provider, spec, row);
      if ('unreadableVersion' in result) { badVersions.push(result.unreadableVersion); continue; }
      const { opened } = result;
      try {
        if (!opened.legacyFormat && opened.version === provider.activeVersion()) continue;
        const sealed = provider.sealSync(opened.plaintext, aadFor(spec, row));
        const update = db.prepare(`UPDATE ${spec.table} SET ${spec.column} = ?
          WHERE ${spec.key} = ? AND tool_account_id = ? AND ${spec.column} = ?`)
          .run(sealed.bytes, row.id, row.accountId, row.blob);
        if (update.changes) changed += 1;
        else skipped += 1;
      } finally { opened.plaintext.fill(0); }
    }
    return { changed, skipped, rows, badVersions };
  });
}

async function rewrapColumns(db: Db, provider: LocalKeyProvider, ctx: JobContext, state: RunState): Promise<StopReason | undefined> {
  for (const spec of SEALED_COLUMNS) {
    let cursor: string | null = null;
    while (true) {
      const batch = rewrapBatch(db, provider, spec, cursor, ctx);
      if (batch.stopped) return batch.stopped;
      // Count only committed batches; a failed batch must not advance the cursor or the examined set.
      state.rewrapped += batch.changed;
      state.skippedChanged += batch.skipped;
      state.unreadable += batch.badVersions.length;
      for (const version of batch.badVersions) state.unreadableVersions.add(version);
      for (const row of batch.rows) state.examined.add(`${spec.table}:${row.id}`);
      if (batch.rows.length > 0) { cursor = batch.rows.at(-1)!.id; await yieldToLoop(); }
      if (batch.rows.length < KEY_REWRAP_BATCH_SIZE) break;
    }
  }
  return undefined;
}

/** The caller holds the final write transaction, so verification and refusal cannot race another writer. */
function verifyNoLegacy(db: Db, provider: LocalKeyProvider, ctx: JobContext, state: RunState): StopReason | undefined {
  for (const spec of SEALED_COLUMNS) {
    for (const value of db.prepare(selectRows(spec)).iterate()) {
      const stopped = stopReason(db, ctx);
      if (stopped) return stopped;
      const row = value as unknown as SealedRow;
      state.examined.add(`${spec.table}:${row.id}`);
      const result = openRow(provider, spec, row);
      if ('unreadableVersion' in result) {
        state.unreadable += 1;
        state.unreadableVersions.add(result.unreadableVersion);
        continue;
      }
      try { if (result.opened.legacyFormat) return 'legacy_remains'; }
      finally { result.opened.plaintext.fill(0); }
    }
  }
  return stopReason(db, ctx);
}

function finishRun(db: Db, provider: LocalKeyProvider, ctx: JobContext, state: RunState) {
  // The flag and completion event share a commit. Earlier batches remain resumable if this commit fails.
  return transaction(db, () => {
    state.stopped ??= stopReason(db, ctx);
    // BD-A2-43: verify only a complete candidate. Partial runs do not open unreached rows.
    if (!state.failure && !state.stopped && state.unreadable === 0) state.stopped = verifyNoLegacy(db, provider, ctx, state);
    const { rewrapped, skippedChanged, unreadable, unreadableVersions, failure, stopped } = state;
    const counts = { rewrapped, skippedChanged, notReached: countNotReached(db, state.examined), unreadable };
    const failed = failure !== undefined || unreadable > 0;
    const outcome = failed ? 'failed' : stopped ? 'partial' : 'complete';
    if (outcome === 'complete') refuseLegacyBlobs(db);
    insertAuditEvent(db, { action: 'key_provider.rewrap', actor: { type: 'system', id: KEY_REWRAP_JOB },
      toolAccountId: null, target: { type: 'key_provider', id: null }, traceId: ctx.traceId, clientIp: null, result: 'ok',
      details: { outcome, ...counts, ...(unreadableVersions.size > 0 ? { unreadableVersions: [...unreadableVersions].sort() } : {}),
        ...(failure ? { errorClass: failure } : {}), ...(stopped ? { stopReason: stopped } : {}),
        ...(outcome === 'complete' ? { legacyBlobsRefused: true } : {}) },
    }, ctx.now());
    return { result: failed ? 'failed' as const : 'ok' as const, counts };
  });
}

export function keyRewrapJob(db: Db, keys: KeyHandle): IntervalJob {
  const provider = keyProviderFor(keys);
  return {
    name: KEY_REWRAP_JOB, everyMs: null, runAtStart: false,
    async run(ctx) {
      const state: RunState = { rewrapped: 0, skippedChanged: 0, unreadable: 0, unreadableVersions: new Set(), examined: new Set() };
      try { state.stopped = await rewrapColumns(db, provider, ctx, state); }
      catch (err) { state.failure = errorClass(err); }
      return finishRun(db, provider, ctx, state);
    },
  };
}

/** Counts include expired sessions and removed keys with a remaining blob: their key versions are still in use. */
export function keyProviderStatus(db: Db, keys: KeyHandle) {
  const provider = keyProviderFor(keys);
  const sealed = sealedVersionCounts(db);
  const derived = new Map((db.prepare('SELECT derivation_version AS version, count(*) AS n FROM service_key GROUP BY derivation_version')
    .all() as Array<{ version: string; n: number }>).map((row) => [row.version, row.n]));
  return { kind: provider.kind, activeVersion: provider.activeVersion(), versions: provider.versions().map((version) => ({
    ...version, sealedCount: sealed.get(version.id) ?? 0, derivedCount: derived.get(version.id) ?? 0,
  })) };
}
