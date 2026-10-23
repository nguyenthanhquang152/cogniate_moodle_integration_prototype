// Connection check (A2 LA-ADR-08 D4; app API delta §3.7): the LTI service fetches the platform JWKS and requests one
// access token (POST /api/platforms/:id/check). Only for a channel with setup.connectionCheck and an active, bound
// connection: a staged record is never checked, because its token endpoint is not proven yet (A-LAD-01).
import type { ChannelRegistry } from '@cogniate/channel-kernel';
import type { ApiErrorOptions, Logger } from '@cogniate/shared';
import { ApiErrorBase, defineErrorTable } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import type { LtiClient, LtiPlatformCheck } from '../clients/lti-client.ts';
import { LtiServiceError, ltiErrorFields } from '../clients/lti-client.ts';
import type { Db } from '../domain/db.ts';
import { getConnection } from '../domain/connections.ts';
import { checkEventCode, recordConnectionEvent } from '../domain/connection-events.ts';
import { ApiError } from './api-errors.ts';

/** One check per connection per minute (LA-ADR-08 D4). */
export const CONNECTION_CHECK_INTERVAL_MS = 60_000;

// The 429 of this route. The app table has no rate-limit code; the error handler sends every ApiErrorBase.
const CHECK_ERRORS = defineErrorTable({ RATE_LIMITED: { status: 429, description: 'Too many requests.' } });
class CheckRateLimitError extends ApiErrorBase<keyof typeof CHECK_ERRORS> {
  constructor(retryAfter: number, options: ApiErrorOptions = {}) {
    super(CHECK_ERRORS, 'RATE_LIMITED', `One check per connection per minute. Retry after ${retryAfter} s.`, { ...options, details: { retryAfter } });
  }
}

export interface ConnectionCheckAnswer {
  result: 'ok' | 'failed';
  checkedAt: string;
  details: Omit<LtiPlatformCheck, 'checkedAt'>;
}

export interface ConnectionCheckDeps {
  channels: ChannelRegistry;
  db: Db;
  lti: LtiClient;
  logger: Logger;
  now: () => number;
}

export function registerConnectionCheckRoutes(api: FastifyInstance, deps: ConnectionCheckDeps): void {
  // The time of the last check per connection. A check drops the entries older than the interval.
  const lastCheck = new Map<string, number>();
  api.post<{ Params: { id: string } }>('/connections/:id/check', async (req, reply): Promise<ConnectionCheckAnswer> => {
    const library = req.auth!.signedIn.library;
    const c = getConnection(deps.db, library.id, req.params.id);
    if (!c) throw new ApiError('NOT_FOUND', 'The connection does not exist in your library.');
    if (!deps.channels.capabilities(c.channel)['setup.connectionCheck'])
      throw new ApiError('CAPABILITY_NOT_SUPPORTED', 'This connection has no connection check.', { details: { capability: 'setup.connectionCheck' } });
    // An active platform that the binding proved: never a pending (staged) or a disabled connection.
    if ((c.status !== 'registered' && c.status !== 'connected') || !c.ltiPlatformId || !c.platform) throw new ApiError('CONNECTION_NOT_READY');
    const now = deps.now();
    for (const [id, at] of lastCheck) if (now - at >= CONNECTION_CHECK_INTERVAL_MS) lastCheck.delete(id);
    const previous = lastCheck.get(c.id);
    if (previous !== undefined) {
      const retryAfter = Math.ceil((CONNECTION_CHECK_INTERVAL_MS - (now - previous)) / 1000);
      reply.header('retry-after', String(retryAfter));
      throw new CheckRateLimitError(retryAfter);
    }
    lastCheck.set(c.id, now);
    let check: LtiPlatformCheck;
    try {
      check = await deps.lti.checkPlatform(c.ltiPlatformId, { deploymentId: c.platform.deploymentIds[0] }, req.traceId);
    } catch (err) {
      deps.logger.warn('connection_check_failed', { trace_id: req.traceId, connection_id: c.id, platform_id: c.ltiPlatformId, ...ltiErrorFields(err) });
      if (err instanceof LtiServiceError && [403, 404].includes(err.status)) throw new ApiError('CONNECTION_NOT_READY');
      if (err instanceof LtiServiceError && err.status === 429) {
        const retryAfter = err.retryAfter ?? 60;
        reply.header('retry-after', String(retryAfter));
        throw new CheckRateLimitError(retryAfter);
      }
      throw new ApiError('LTI_SERVICE_ERROR');
    }
    const { checkedAt, ...details } = check;
    // LA-E6-02: the health view shows the last check (connection_event kind "check").
    recordConnectionEvent(deps.db, { connectionId: c.id, libraryId: library.id, kind: 'check', code: checkEventCode(details), traceId: req.traceId }, deps.now());
    // The shared redaction hides every field named "token": the token result is logged as token_result.
    deps.logger.info('connection_check', { trace_id: req.traceId, connection_id: c.id, platform_id: c.ltiPlatformId, jwks: details.jwks, token_result: details.token });
    return { result: details.jwks.ok && details.token.ok ? 'ok' : 'failed', checkedAt, details };
  });
}
