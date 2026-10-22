import type { ChannelRegistry } from '@cogniate/channel-kernel';
// Results API (app contract §5): GET results (T5a), POST results/refresh and POST score-syncs/:id/resend (T5b).
// Every id is checked against the session user's library (404 NOT_FOUND). LTI calls use SERVICE-AUTH-V1 with the
// service key of the activity, so they work after the ltik expired.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { LtiClient } from '../clients/lti-client.ts';
import { LtiServiceError } from '../clients/lti-client.ts';
import type { Db } from '../domain/db.ts';
import { getPublication } from '../domain/publications.ts';
import { publicationResults } from '../domain/results.ts';
import { resendSync, syncConnectionDisabled, syncRow, syncRowInLibrary } from '../kernel/records/dispatch-store.ts';
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
    if (syncRowInLibrary(db, libraryId(req), req.params.syncId) && syncConnectionDisabled(db, req.params.syncId)) {
      throw new ApiError('CONNECTION_NOT_READY', 'The connection is switched off.');
    }
    const r = resendSync(db, libraryId(req), req.params.syncId, now());
    if (!r.ok) throw new ApiError(r.reason === 'not_found' ? 'NOT_FOUND' : 'SYNC_NOT_RESENDABLE', r.description);
    deps.kickSync?.();
    return syncRow(db, req.params.syncId);
  });
}
