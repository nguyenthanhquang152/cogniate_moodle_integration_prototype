// Score sync worker (app contract §10, ADR-010). Sends each due `pending` row with POST /api/lineitems/:id/scores
// (SERVICE-AUTH-V1: works after the ltik expired). One trace id per row and try. Answers:
// The answer -> status mapping and the retry times are the grade policy in packages/tracking (syncResult).
import { randomBytes } from 'node:crypto';
import type { Logger } from '@cogniate/shared';
import { decrypt } from '@cogniate/shared';
import type { SendAnswer } from '@cogniate/tracking';
import { syncResult } from '@cogniate/tracking';
import type { LtiClient } from '../clients/lti-client.ts';
import { LtiServiceError } from '../clients/lti-client.ts';
import type { Db } from '../domain/db.ts';
import type { DueSync } from '../domain/score-syncs.ts';
import { dueSyncs, recordSend } from '../domain/score-syncs.ts';
import { resolveLineItem } from './line-item.ts';

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

/** The activity has no AGS line item (ADR-010 rule 1): nothing can be sent. */
class NoGradebookColumn extends Error {}

/** A safe, short lastError from an LTI service error (codes and the service's short description only). */
const errorText = (err: LtiServiceError): string => `${err.status || 'no answer'} ${err.code}${err.description ? `: ${err.description}` : ''}`.slice(0, 300);

export function createScoreSyncWorker(deps: ScoreSyncWorkerDeps) {
  const { db, lti, logger: log, masterKey, now } = deps;
  let running: Promise<void> | null = null;
  let again = false;
  let timer: NodeJS.Timeout | null = null;

  async function send(row: DueSync): Promise<void> {
    const traceId = randomBytes(16).toString('hex');
    const tries = row.tries + 1;
    let answer: SendAnswer;
    let lastError: string | null = null;
    try {
      if (row.serviceKeyEncrypted === null) throw new NoGradebookColumn();
      const serviceKey = decrypt(masterKey, row.serviceKeyEncrypted);
      const lineItemId = await resolveLineItem({ db, lti }, row, serviceKey, traceId);
      if (lineItemId === null) throw new NoGradebookColumn();
      await lti.postScore(serviceKey, lineItemId, row.payload, traceId);
      answer = { http: 204 };
    } catch (err) {
      if (err instanceof LtiServiceError) {
        answer = { http: err.status };
        lastError = err.status === 409 ? `${errorText(err)} (Moodle has a grade with a newer time)`.slice(0, 300) : errorText(err);
      } else if (err instanceof NoGradebookColumn) {
        answer = { local: 'no_gradebook_column' };
        lastError = NO_GRADEBOOK_COLUMN;
      } else {
        // A-T5a-06 / B-T5a-03: any other error (for example a service key that cannot be decrypted after an
        // APP_MASTER_KEY change) does not get better by itself: failed at once (a human can Resend).
        const name = err instanceof Error ? err.name : 'Error';
        answer = { local: 'internal_error' };
        lastError = `Internal error (${name}). The service key cannot be used. Give the trace id ${traceId} to your Cogniate admin.`.slice(0, 300);
        log.error('internal_error', { trace_id: traceId, method: 'WORKER', path: 'score_sync', error: name });
      }
    }
    // The grade policy decides the row status and the next try (packages/tracking, ADR-010 rules 8 and 9).
    const result = syncResult(answer, tries, row.retryFrom, now());
    if (recordSend(db, row.id, { status: result.status, tries, nextTryAt: result.nextTryAt, lastError: result.status === 'sent' ? null : lastError }, now())) {
      log.info('score_sync', { trace_id: traceId, sync_id: row.id, status: result.status, tries });
    } else {
      log.info('score_sync', { trace_id: traceId, sync_id: row.id, status: 'superseded', send_result: result.status, tries });
    }
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
