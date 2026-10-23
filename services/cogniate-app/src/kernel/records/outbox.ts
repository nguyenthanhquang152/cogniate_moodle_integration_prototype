import { LEGACY_SCORE_INTERRUPTED } from '@cogniate/channel-kernel';
import { afterCommit, type QueueJob, type RecoveryScope } from '@cogniate/shared';
import { dispatchResult, nextRetryAt, type SyncStatus } from '@cogniate/tracking';
import type { Db } from '../../domain/db.ts';
import { transaction } from '../../domain/db.ts';
import { beginSend, failDisabledDispatch, isCurrentDispatch, ownsDispatch, partitionPaused, recordSend } from './dispatch-store.ts';
import type { DeliveryOutcome, DispatchView, RecordReporter } from './types.ts';

export interface DispatchItem { id: string; partitionKey: string }
const WINDOW_MS = 86_400_000;

/** Called once for each delivery outcome that the lease owner records, after that commit (app metrics; LA-E4-07, BD-A2-88). */
export type DispatchSendObserver = (reporter: string, outcome: DeliveryOutcome['kind']) => void;
const sendObservers = new WeakMap<Db, DispatchSendObserver[]>();
export function observeDispatchSends(db: Db, observer: DispatchSendObserver): void {
  sendObservers.set(db, [...sendObservers.get(db) ?? [], observer]);
}

/** Only startup may take back a live lease of this instance's previous boot. */
export function recoverDispatches(db: Db, scope: RecoveryScope): number {
  return transaction(db, () => {
    const own = `${scope.instanceId}/`;
    const eligible = scope.mode === 'start'
      ? '(lease_owner IS NULL OR lease_until IS NULL OR lease_until <= ? OR substr(lease_owner, 1, length(?)) = ?)'
      : '(lease_owner IS NULL OR lease_until IS NULL OR lease_until <= ?) AND (lease_owner IS NULL OR lease_owner <> ?)';
    const args = scope.mode === 'start' ? [scope.now, own, own] : [scope.now, scope.leaseOwner];
    const rows = db.prepare(`SELECT id, status, tries, resent_at, created_at, confirmation_after FROM record_dispatch
      WHERE send_started_at IS NOT NULL AND ${eligible}`).all(...args);
    for (const row of rows) {
      const from = Number(row.resent_at ?? row.created_at);
      const retry = nextRetryAt(from, Math.max(1, Number(row.tries)), scope.now);
      const after = Math.max(retry ?? Infinity, Number(row.confirmation_after ?? 0));
      const next = after <= from + WINDOW_MS ? after : null;
      db.prepare(`UPDATE record_dispatch SET delivery_uncertain = 1, send_started_at = NULL, lease_owner = NULL, lease_until = NULL,
        status = CASE WHEN status = 'pending' AND ? IS NULL THEN 'failed' ELSE status END,
        last_error = CASE WHEN status = 'pending' THEN ? ELSE last_error END,
        next_try_at = CASE WHEN status = 'pending' THEN ? ELSE next_try_at END, updated_at = ? WHERE id = ?`)
        .run(next, LEGACY_SCORE_INTERRUPTED, next, scope.now, String(row.id));
    }
    if (scope.mode === 'start') db.prepare(`UPDATE record_dispatch SET lease_owner = NULL, lease_until = NULL
      WHERE send_started_at IS NULL AND substr(lease_owner, 1, length(?)) = ?`).run(own, own);
    return rows.length;
  });
}

const read = (db: Db, id: string) => db.prepare('SELECT * FROM record_dispatch WHERE id = ?').get(id);

function view(r: Record<string, unknown>): DispatchView {
  return {
    id: String(r.id), reporter: String(r.reporter), partitionKey: String(r.partition_key),
    placementId: String(r.placement_id), learnerSubject: String(r.learner_subject),
    tries: Number(r.tries), createdAt: Number(r.created_at), retryFrom: Number(r.resent_at ?? r.created_at),
    confirmationAfter: r.confirmation_after === null ? null : Number(r.confirmation_after),
    // Decode inside run: a corrupt row must not prevent due from returning its healthy neighbours.
    payload: JSON.parse(String(r.payload)) as Record<string, unknown>,
  };
}

function result(outcome: DeliveryOutcome, tries: number, from: number, now: number) {
  return { ...dispatchResult(outcome, tries, from, now), lastError: outcome.kind === 'accepted' ? null : outcome.text,
    uncertain: outcome.kind === 'retryable' && outcome.uncertain };
}

/** The outbox queue job. Refuses a reporter policy other than bestResult (AC-LA-E4-03-08). Services use registerRecordReporters. */
export function createDispatchQueue(db: Db, reporters: readonly RecordReporter[]): QueueJob<DispatchItem> {
  for (const reporter of reporters) {
    if (reporter.policy !== 'bestResult') throw new Error(`Unsupported record reporter policy: ${reporter.id}/${reporter.policy}`);
  }
  const registry = new Map(reporters.map((r) => [r.id, r]));
  /** The send result log line: the reporter's own names, else the neutral `record_dispatch` names. */
  const resultLog = (reporter: string, id: string) => {
    const names = registry.get(reporter)?.logNames;
    return { event: names?.event ?? 'record_dispatch', idFields: names ? { [names.idField]: id } : { dispatch_id: id, reporter } };
  };
  return {
    name: 'record-dispatch', id: (r) => r.id, partition: (r) => r.partitionKey,
    due(now, limit) {
      return db.prepare(`SELECT id, partition_key FROM (
        SELECT id, partition_key, next_try_at, created_at, seq, ROW_NUMBER() OVER
          (PARTITION BY partition_key ORDER BY next_try_at, created_at, seq) AS turn FROM record_dispatch dispatch
        WHERE status = 'pending' AND next_try_at <= ? AND (not_before IS NULL OR not_before <= ?)
          AND send_started_at IS NULL AND (lease_until IS NULL OR lease_until <= ?)
          AND NOT ${partitionPaused('dispatch')}
          AND NOT EXISTS (SELECT 1 FROM attempt a WHERE a.resource_link_id = dispatch.placement_id AND a.user_sub = dispatch.learner_subject
            AND a.preview = 0 AND a.outcome IN ('completed', 'passed', 'failed')
            AND CAST(a.score_given AS REAL) / a.score_maximum > dispatch.score_given / dispatch.score_maximum))
        ORDER BY turn, next_try_at, created_at, seq LIMIT ?`).all(now, now, now, now, limit)
        .map((r) => ({ id: String(r.id), partitionKey: String(r.partition_key) }));
    },
    lease(item, owner, until, now) {
      return db.prepare(`UPDATE record_dispatch SET lease_owner = ?, lease_until = ? WHERE id = ? AND status = 'pending'
        AND next_try_at <= ? AND (not_before IS NULL OR not_before <= ?) AND send_started_at IS NULL
        AND (lease_until IS NULL OR lease_until <= ?)
        AND NOT ${partitionPaused('record_dispatch')}
        AND NOT EXISTS (SELECT 1 FROM record_dispatch other
          WHERE other.id <> record_dispatch.id AND other.placement_id = record_dispatch.placement_id
          AND other.learner_subject = record_dispatch.learner_subject AND other.reporter = record_dispatch.reporter
          AND (other.lease_until > ? OR other.send_started_at IS NOT NULL))`).run(owner, until, item.id, now, now, now, now, now).changes > 0;
    },
    release(item, owner) {
      db.prepare('UPDATE record_dispatch SET lease_owner = NULL, lease_until = NULL WHERE id = ? AND lease_owner = ?').run(item.id, owner);
    },
    recover: (scope) => recoverDispatches(db, scope),
    async run(item, ctx) {
      let posted = false;
      try {
        if (!ownsDispatch(db, item.id, ctx.leaseOwner) || ctx.signal.aborted) return;
        if (!isCurrentDispatch(db, item.id)) {
          // Supersede only for a higher dispatch. An attempt without a dispatch leaves the lower row unchanged.
          db.prepare(`UPDATE record_dispatch SET status = 'superseded', next_try_at = NULL, updated_at = ?
            WHERE id = ? AND status = 'pending' AND lease_owner = ? AND EXISTS (SELECT 1 FROM record_dispatch other
              WHERE other.placement_id = record_dispatch.placement_id AND other.learner_subject = record_dispatch.learner_subject
              AND other.reporter = record_dispatch.reporter AND other.status <> 'superseded'
              AND other.score_given / other.score_maximum > record_dispatch.score_given / record_dispatch.score_maximum)`)
            .run(ctx.now(), item.id, ctx.leaseOwner);
          return;
        }
        const raw = read(db, item.id)!;
        const names = resultLog(String(raw.reporter), item.id);
        const log = (status: SyncStatus, tries: number, sendResult?: SyncStatus) => ctx.logger.info(names.event, {
          trace_id: ctx.traceId, ...names.idFields, status, tries, phase: raw.confirmation_after === null ? 'send' : 'confirmation',
          ...(sendResult && sendResult !== status ? { send_result: sendResult } : {}),
        });
        if (failDisabledDispatch(db, item.id, ctx.now(), ctx.leaseOwner)) { log('failed', Number(raw.tries)); return; }
        const row = view(raw);
        if (ctx.now() > row.retryFrom + WINDOW_MS) {
          recordSend(db, row, { status: 'failed', nextTryAt: null, uncertain: false, lastError: 'The score retry window has ended.' }, ctx.now(), ctx.leaseOwner);
          return;
        }
        const reporter = registry.get(row.reporter);
        if (!reporter) {
          ctx.logger.error('record_reporter_unknown', { dispatch_id: row.id, reporter: row.reporter });
          throw new Error('Unknown record reporter');
        }
        const outcome = await reporter.deliver(row, { ...ctx, beginSend() {
          if (ctx.signal.aborted) return 'skipped';
          const started = beginSend(db, item.id, ctx.now(), ctx.leaseOwner);
          posted = started === 'started';
          if (started === 'connection_disabled') log('failed', row.tries);
          return started;
        } });
        // Every later write checks the lease owner itself (a lost lease changes nothing).
        if (!outcome) return;
        if (!posted && failDisabledDispatch(db, item.id, ctx.now(), ctx.leaseOwner)) { log('failed', row.tries); return; }
        // A completed POST still records its result after stop. Only an unstarted next step is stopped.
        if (!posted && ctx.signal.aborted) return;
        const throttled = outcome.kind === 'throttled';
        const tries = row.tries + (posted && !throttled ? 1 : 0);
        const r = result(outcome, tries, row.retryFrom, ctx.now());
        const status = transaction(db, (): SyncStatus | null => {
          // Only the lease owner records a result, also the throttle steps (another instance may own the row now).
          if (!ownsDispatch(db, row.id, ctx.leaseOwner)) return null;
          if (outcome.kind === 'throttled') {
            // Undo only this attempt. Earlier uncertainty and the confirmation phase stay intact.
            if (posted) db.prepare('UPDATE record_dispatch SET tries = tries - 1 WHERE id = ?').run(row.id);
            // Pause this row and every pending row of the partition. This row keeps the pause whatever its status
            // becomes (failed at its window end, or superseded during the POST): partitionPaused reads every row.
            db.prepare(`UPDATE record_dispatch SET not_before = MAX(COALESCE(not_before, 0), ?)
              WHERE id = ? OR (status = 'pending' AND partition_key = ?)`).run(outcome.retryAt, row.id, row.partitionKey);
          }
          const recorded = recordSend(db, row, r, ctx.now(), ctx.leaseOwner);
          afterCommit(db, () => { for (const observe of sendObservers.get(db) ?? []) observe(row.reporter, outcome.kind); });
          return recorded;
        });
        if (status === null) return;
        if (outcome.kind === 'throttled') ctx.logger.warn('dispatch_throttled', {
          dispatch_id: row.id, partition: row.partitionKey, retry_at: outcome.retryAt,
        });
        if (posted) log(status, tries, r.status);
      } catch (err) {
        // BD-A1-10: also covers decoding and reporter bugs. Only a failed result write reaches runner cooling.
        transaction(db, () => {
          if (!ownsDispatch(db, item.id, ctx.leaseOwner)) return;
          const raw = read(db, item.id)!;
          if (!posted) db.prepare('UPDATE record_dispatch SET tries = tries + 1 WHERE id = ?').run(item.id);
          const tries = Number(raw.tries) + (posted ? 0 : 1);
          const name = err instanceof Error ? err.name : 'Error';
          const row = view({ ...raw, payload: '{}' });
          const r = result({ kind: 'retryable', text: `Internal error (${name}).`, uncertain: posted }, tries, row.retryFrom, ctx.now());
          recordSend(db, row, r, ctx.now(), ctx.leaseOwner);
          ctx.logger.error('internal_error', { trace_id: ctx.traceId, method: 'WORKER', path: resultLog(row.reporter, row.id).event, error: name });
        });
      }
    },
  };
}
