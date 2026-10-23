// AGS transport and read-back (LA-ADR-03 D5). The outbox owns delivery state.
import type { ChannelRegistry } from '@cogniate/channel-kernel';
import { agsScoreBody } from '@cogniate/tracking';
import { SERVICE_KEY_COLUMN, appAad, openText } from '../../app/sealing.ts';
import { LtiServiceError, normalizeRetryAfter, type LtiClient } from '../../clients/lti-client.ts';
import type { Db } from '../../domain/db.ts';
import { resolveLineItem } from './line-item.ts';
import { platformPartition } from './partition.ts';
import type { RecordReporter } from '../../kernel/records/types.ts';

export const NO_GRADEBOOK_COLUMN = 'No gradebook column: the activity has no AGS line item.';

/** A stored `lastError` text has at most 300 characters (M1). */
const lastErrorText = (text: string): string => text.slice(0, 300);

/** The parts of the reporter that need no database or network. */
export const ltiAgsPolicy: Pick<RecordReporter, 'id' | 'policy' | 'appliesTo' | 'prepare' | 'logNames'> = {
  id: 'lti-ags', policy: 'bestResult', appliesTo: (p) => p.graded,
  prepare: (r) => agsScoreBody(r.learnerSubject, r),
  // M1 contract value (AGS): the score_sync log event with its sync_id field.
  logNames: { event: 'score_sync', idField: 'sync_id' },
};

export function ltiAgsReporter(deps: { db: Db; lti: LtiClient; masterKey: Buffer; channels: ChannelRegistry }): RecordReporter {
  return { ...ltiAgsPolicy,
    partitionKey: (placement) => platformPartition(deps.db, placement.id),
    async readBack(placement, learnerSubject, ctx) {
      const target = deps.db.prepare(`SELECT rl.resource_link_id, rl.line_item_id, rl.service_key_encrypted, c.library_id
        FROM resource_link rl JOIN connection c ON c.id = rl.connection_id WHERE rl.id = ?`).get(placement.id);
      if (!target || target.service_key_encrypted === null) return null;
      // LA-E5-22: the service key is bound to its resource link row (a legacy blob also opens).
      const key = openText(deps.masterKey, target.service_key_encrypted as Uint8Array, appAad(SERVICE_KEY_COLUMN, String(target.library_id), placement.id));
      const lineItem = await resolveLineItem(deps, {
        resourceLinkId: placement.id, platformResourceLinkId: String(target.resource_link_id),
        lineItemId: target.line_item_id === null ? null : String(target.line_item_id),
      }, key, ctx.traceId);
      if (lineItem === null) return null;
      const scores = await deps.lti.getResults(key, lineItem, learnerSubject, ctx.traceId);
      const mine = scores.find((s) => s.userId === learnerSubject);
      const result = { resultScore: mine?.resultScore ?? null, resultMaximum: mine?.resultMaximum ?? null };
      deps.db.prepare(`INSERT INTO gradebook_read (resource_link_id, user_sub, result_score, result_maximum, read_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (resource_link_id, user_sub) DO UPDATE SET result_score = excluded.result_score, result_maximum = excluded.result_maximum, read_at = excluded.read_at`)
        .run(placement.id, learnerSubject, result.resultScore, result.resultMaximum, ctx.now());
      return result;
    },
    async deliver(dispatch, ctx) {
      const target = deps.db.prepare(`SELECT rl.resource_link_id, rl.line_item_id, rl.service_key_encrypted, c.channel, c.library_id
        FROM resource_link rl JOIN connection c ON c.id = rl.connection_id WHERE rl.id = ?`).get(dispatch.placementId);
      if (!target || target.service_key_encrypted === null) return { kind: 'local_failure', text: NO_GRADEBOOK_COLUMN };
      const row = { resourceLinkId: dispatch.placementId, platformResourceLinkId: String(target.resource_link_id),
        lineItemId: target.line_item_id === null ? null : String(target.line_item_id), channel: String(target.channel) };
      let posted = false;
      try {
        let serviceKey: string;
        // LA-E5-22: the service key is bound to its resource link row (a legacy blob also opens).
        try { serviceKey = openText(deps.masterKey, target.service_key_encrypted as Uint8Array, appAad(SERVICE_KEY_COLUMN, String(target.library_id), dispatch.placementId)); }
        catch (err) {
          const name = err instanceof Error ? err.name : 'Error';
          // M1 contract value (AGS): the internal_error line of a score send has path score_sync.
          ctx.logger.error('internal_error', { trace_id: ctx.traceId, method: 'WORKER', path: 'score_sync', error: name });
          return { kind: 'local_failure', text: lastErrorText(`Internal error (${name}). The service key cannot be used. Give the trace id ${ctx.traceId} to your Cogniate admin.`) };
        }
        const lineItemId = await resolveLineItem(deps, row, serviceKey, ctx.traceId);
        if (lineItemId === null) return { kind: 'local_failure', text: NO_GRADEBOOK_COLUMN };
        if (ctx.beginSend() !== 'started') return null;
        posted = true;
        // Do not pass the stop signal: an in-flight POST finishes and records its actual result.
        await deps.lti.postScore(serviceKey, lineItemId, dispatch.payload, ctx.traceId);
        return { kind: 'accepted' };
      } catch (err) {
        if (!(err instanceof LtiServiceError)) throw err;
        const text = lastErrorText(`${err.status || 'no answer'} ${err.code}${err.description ? `: ${err.description}` : ''}`);
        if (err.status === 409) return { kind: 'conflict', text: lastErrorText(`${text} (${deps.channels.textName(row.channel)} has a grade with a newer time)`) };
        if (err.status === 429 && ['PLATFORM_RATE_LIMITED', 'RATE_LIMITED'].includes(err.code)) {
          return { kind: 'throttled', text, retryAt: ctx.now() + normalizeRetryAfter(err.retryAfter) * 1000 };
        }
        if ([400, 403, 404, 422].includes(err.status)) return { kind: 'rejected', text };
        return { kind: 'retryable', text, uncertain: posted && (err.status === 0 || err.status >= 500) };
      }
    },
  };
}
