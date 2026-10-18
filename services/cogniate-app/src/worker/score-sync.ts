// Score sync worker (app contract §10, ADR-010). Sends each due `pending` row with POST /api/lineitems/:id/scores
// (SERVICE-AUTH-V1: works after the ltik expired). One trace id per row and try. Answers:
//   204 -> sent; 409 PLATFORM_CONFLICT -> conflict (no retry); 400/403/404 -> failed at once (lastError);
//   401, 5xx, timeout, no answer -> retry at 5 s, 30 s, 2 min, 10 min, 30 min, then hourly until 24 h, then failed.
import { randomBytes } from 'node:crypto';
import type { Logger } from '@cogniate/shared';
import { decrypt } from '@cogniate/shared';
import type { SyncStatus } from '@cogniate/tracking';
import { nextRetryAt } from '@cogniate/tracking';
import type { LtiClient } from '../clients/lti-client.ts';
import { LtiServiceError } from '../clients/lti-client.ts';
import type { Db } from '../domain/db.ts';
import type { DueSync } from '../domain/score-syncs.ts';
import { dueSyncs, recordSend, setLineItem } from '../domain/score-syncs.ts';

export interface ScoreSyncWorkerDeps {
  db: Db;
  lti: LtiClient;
  logger: Logger;
  masterKey: Buffer;
  now: () => number;
  /** Poll interval (default 2 s). kick() sends at once. */
  intervalMs?: number;
}

export const NO_GRADEBOOK_COLUMN = 'No gradebook column: the activity has no AGS line item.';

/** A safe, short lastError from an LTI service error (codes and the service's short description only). */
const errorText = (err: LtiServiceError): string => `${err.status || 'no answer'} ${err.code}${err.description ? `: ${err.description}` : ''}`.slice(0, 300);

export function createScoreSyncWorker(deps: ScoreSyncWorkerDeps) {
  const { db, lti, logger: log, masterKey, now } = deps;
  let running: Promise<void> | null = null;
  let again = false;
  let timer: NodeJS.Timeout | null = null;

  async function lineItemOf(row: DueSync, serviceKey: string, traceId: string): Promise<string | null> {
    if (row.lineItemId !== null) return row.lineItemId;
    const items = await lti.findLineItems(serviceKey, row.platformResourceLinkId, traceId);
    const found = items[0]?.id ?? null;
    if (found !== null) setLineItem(db, row.resourceLinkId, found);
    return found;
  }

  async function send(row: DueSync): Promise<void> {
    const traceId = randomBytes(16).toString('hex');
    const tries = row.tries + 1;
    let result: { status: SyncStatus; lastError: string | null; nextTryAt: number | null };
    try {
      if (row.serviceKeyEncrypted === null) throw new Error(NO_GRADEBOOK_COLUMN);
      const serviceKey = decrypt(masterKey, row.serviceKeyEncrypted);
      const lineItemId = await lineItemOf(row, serviceKey, traceId);
      if (lineItemId === null) throw new Error(NO_GRADEBOOK_COLUMN);
      await lti.postScore(serviceKey, lineItemId, row.payload, traceId);
      result = { status: 'sent', lastError: null, nextTryAt: null };
    } catch (err) {
      if (err instanceof LtiServiceError) {
        if (err.status === 409) result = { status: 'conflict', lastError: 'Moodle has a grade with a newer time.', nextTryAt: null };
        else if (err.status === 400 || err.status === 403 || err.status === 404) result = { status: 'failed', lastError: errorText(err), nextTryAt: null };
        else {
          const next = nextRetryAt(row.createdAt, tries, now());
          result = next === null ? { status: 'failed', lastError: errorText(err), nextTryAt: null } : { status: 'pending', lastError: errorText(err), nextTryAt: next };
        }
      } else if (err instanceof Error && err.message === NO_GRADEBOOK_COLUMN) {
        result = { status: 'failed', lastError: NO_GRADEBOOK_COLUMN, nextTryAt: null };
      } else {
        throw err;
      }
    }
    recordSend(db, row.id, { status: result.status, tries, nextTryAt: result.nextTryAt, lastError: result.lastError }, now());
    log.info('score_sync', { trace_id: traceId, sync_id: row.id, status: result.status, tries });
  }

  async function drain(): Promise<void> {
    do {
      again = false;
      for (const row of dueSyncs(db, now(), 20)) {
        try {
          await send(row);
        } catch (err) {
          log.error('internal_error', { trace_id: 'score-sync', method: 'WORKER', path: 'score_sync', error: (err as Error).name });
        }
      }
    } while (again);
  }

  /** Run now (a new row was made); a run in progress runs once more after it ends. */
  function kick(): Promise<void> {
    if (running) {
      again = true;
      return running;
    }
    running = drain().finally(() => { running = null; });
    return running;
  }

  return {
    kick,
    start(): void {
      if (timer) return;
      timer = setInterval(() => void kick(), deps.intervalMs ?? 2000);
      timer.unref();
    },
    stop(): void {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

export type ScoreSyncWorker = ReturnType<typeof createScoreSyncWorker>;
