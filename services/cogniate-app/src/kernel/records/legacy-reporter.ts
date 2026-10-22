// Temporary port adapter for the existing send code. LA-E4-03 owns its move to drivers/lti-ags.
import { LEGACY_GRADE_CONFLICT } from '@cogniate/channel-kernel';
import { decrypt } from '@cogniate/shared';
import { agsScoreBody } from '@cogniate/tracking';
import { LtiServiceError, type LtiClient } from '../../clients/lti-client.ts';
import type { Db } from '../../domain/db.ts';
import { resolveLineItem } from '../../worker/line-item.ts';
import { NO_GRADEBOOK_COLUMN } from '../../worker/score-sync.ts';
import type { RecordReporter } from './types.ts';

export const legacyAgsPolicy: Pick<RecordReporter, 'id' | 'policy' | 'appliesTo' | 'prepare' | 'partitionKey'> = {
  id: 'lti-ags', policy: 'bestResult', appliesTo: (p) => p.graded,
  prepare: (r) => agsScoreBody(r.learnerSubject, r), partitionKey: (d) => d.partitionKey,
};

export function legacyAgsReporter(deps: { db: Db; lti: LtiClient; masterKey: Buffer }): RecordReporter {
  return { ...legacyAgsPolicy, async deliver(row, ctx) {
    let posted = false;
    try {
      if (row.serviceKeyEncrypted === null) return { kind: 'local_failure', text: NO_GRADEBOOK_COLUMN };
      let serviceKey: string;
      try { serviceKey = decrypt(deps.masterKey, row.serviceKeyEncrypted); }
      catch (err) {
        const name = err instanceof Error ? err.name : 'Error';
        ctx.logger.error('internal_error', { trace_id: ctx.traceId, method: 'WORKER', path: 'score_sync', error: name });
        return { kind: 'local_failure', text: `Internal error (${name}). The service key cannot be used. Give the trace id ${ctx.traceId} to your Cogniate admin.`.slice(0, 300) };
      }
      const lineItemId = await resolveLineItem(deps, row, serviceKey, ctx.traceId);
      if (lineItemId === null) return { kind: 'local_failure', text: NO_GRADEBOOK_COLUMN };
      if (ctx.beginSend() !== 'started') return null;
      posted = true;
      // Do not pass the stop signal: an in-flight POST finishes and records its actual result.
      await deps.lti.postScore(serviceKey, lineItemId, row.payload, ctx.traceId);
      return { kind: 'accepted' };
    } catch (err) {
      if (!(err instanceof LtiServiceError)) throw err;
      const text = `${err.status || 'no answer'} ${err.code}${err.description ? `: ${err.description}` : ''}`.slice(0, 300);
      if (err.status === 409) return { kind: 'conflict', text: `${text} ${LEGACY_GRADE_CONFLICT}`.slice(0, 300) };
      if ([400, 403, 404, 422].includes(err.status)) return { kind: 'rejected', text };
      return { kind: 'retryable', text, uncertain: posted && (err.status === 0 || err.status >= 500) };
    }
  } };
}
