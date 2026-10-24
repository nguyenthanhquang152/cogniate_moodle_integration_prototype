import type { ChannelRegistry } from '@cogniate/channel-kernel';
// Results API (app contract §5): GET results (T5a), POST results/refresh and POST score-syncs/:id/resend (T5b).
// Every id is checked against the session user's library (404 NOT_FOUND). LTI calls use SERVICE-AUTH-V1 with the
// service key of the activity, so they work after the ltik expired.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { LtiClient } from '../clients/lti-client.ts';
import { LtiServiceError } from '../clients/lti-client.ts';
import type { Db } from '../domain/db.ts';
import { getPublication } from '../domain/publications.ts';
import { publicationResults, RESULTS_REPORTER, scoreSyncRow } from '../domain/results.ts';
import { resendDispatch, type ResendResult } from '../kernel/records/dispatch-store.ts';
import { getConnection } from '../domain/connections.ts';
import { readBackTargets, recordReporters } from '../kernel/records/records.ts';
import type { Logger } from '@cogniate/shared';
import { ApiError } from './api-errors.ts';

export interface ResultRouteDeps {
  channels: ChannelRegistry;
  db: Db;
  lti: LtiClient;
  logger: Logger;
  masterKey: Buffer;
  now: () => number;
  /** Ask the score sync worker to run now (a resent row). */
  kickSync?: () => void;
}

type IdParams = { Params: { id: string } };

/** App contract §5 and §4.7.2: the error text of each Resend refusal (M1 texts). */
const RESEND_REFUSED: Record<Exclude<ResendResult, { ok: true }>['reason'], string> = {
  not_found: 'The score sync does not exist in your library.',
  connection_disabled: 'The connection is switched off.',
  status: 'Only a failed or conflict score sync can be sent again.',
  not_best: 'This learner has a better result. Resend the better result instead.',
  already_sent: 'An equal result of this learner is already sent or pending.',
};

export function registerResultRoutes(api: FastifyInstance, deps: ResultRouteDeps): void {
  const { db, logger: log, now } = deps;
  const libraryId = (req: FastifyRequest): string => req.auth!.signedIn.library.id;
  const publicationOf = (req: FastifyRequest<IdParams>) => {
    const p = getPublication(db, libraryId(req), req.params.id);
    if (!p) throw new ApiError('NOT_FOUND', 'The publication does not exist in your library.');
    return p;
  };

  // One row per learner per activity, with best, attempts and every score sync (T5a, H5).
  api.get<IdParams>('/publications/:id/results', async (req) => ({ rows: publicationResults(db, publicationOf(req), deps.channels) }));

  // "Refresh from Moodle": one AGS results read per learner and activity. A read that fails keeps the last value and
  // logs gradebook_refresh_failed with the contract fields (B-T5b-01, A-T5b-04); the other rows go on.
  api.post<IdParams>('/publications/:id/results/refresh', async (req) => {
    const p = publicationOf(req);
    // App contract §4.7.2: no refresh for a disabled Canvas or Blackboard connection.
    const c = getConnection(db, libraryId(req), p.connectionId);
    if (c && c.bindingAuthority === 'operatorGrant' && c.status === 'disabled') throw new ApiError('CONNECTION_NOT_READY', 'The connection is switched off.');
    const caps = deps.channels.capabilities(c?.channel ?? '');
    const reporter = caps['records.readBack']
      ? recordReporters(db).find((r) => caps['records.reporters'].includes(r.id) && r.readBack) : undefined;
    if (!reporter?.readBack) throw new ApiError('CAPABILITY_NOT_SUPPORTED', undefined, { details: { capability: 'records.readBack' } });
    for (const target of readBackTargets(db, p.connectionId, p.courseId)) {
      try {
        await reporter.readBack(target.placement, target.learnerSubject, { traceId: req.traceId, now, logger: log });
      } catch (err) {
        const fields = err instanceof LtiServiceError ? { lti_status: err.status, lti_code: err.code } : { lti_status: 0, lti_code: err instanceof Error ? err.name : 'Error' };
        log.warn('gradebook_refresh_failed', { trace_id: req.traceId, publication_id: p.id, resource_link_id: target.placement.id, ...fields });
      }
    }
    return { rows: publicationResults(db, p, deps.channels) };
  });

  // Resend a failed or conflict row (ADR-010 rule 10). Else 409 SYNC_NOT_RESENDABLE.
  api.post<{ Params: { syncId: string } }>('/score-syncs/:syncId/resend', async (req) => {
    // App contract §4.7.2: no resend for a disabled Canvas or Blackboard connection (the library check comes first).
    const r = resendDispatch(db, RESULTS_REPORTER, libraryId(req), req.params.syncId, now());
    if (!r.ok) {
      const code = r.reason === 'not_found' ? 'NOT_FOUND' : r.reason === 'connection_disabled' ? 'CONNECTION_NOT_READY' : 'SYNC_NOT_RESENDABLE';
      throw new ApiError(code, RESEND_REFUSED[r.reason]);
    }
    deps.kickSync?.();
    return scoreSyncRow(db, req.params.syncId);
  });
}
