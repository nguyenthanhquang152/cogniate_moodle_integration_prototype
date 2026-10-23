// Connection health view (A2 LA-ADR-08 D5; app API delta §3.7): GET /app-api/connections/:id/health. Read only, library
// scope, ids, codes and public key ids only (no learner data, no token). No platform call: the one LTI read (the public
// tool JWKS, for the active key id) is cached 60 s.
import type { Logger } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import type { LtiClient } from '../clients/lti-client.ts';
import type { Db } from '../domain/db.ts';
import type { Connection, ConnectionStatus } from '../domain/connections.ts';
import { getConnection } from '../domain/connections.ts';
import { checkEventParts, listConnectionEvents } from '../domain/connection-events.ts';
import { TOOL_ACCOUNT } from '../kernel/setup/common.ts';
import { ApiError } from './api-errors.ts';

export const TOOL_KEYS_CACHE_MS = 60_000;
const DAY_MS = 86_400_000;

export interface ConnectionHealth {
  status: ConnectionStatus;
  lastLaunchAt: string | null;
  lastLaunchRefusal: { reason: string | null; at: string } | null;
  dispatch: { pending: number; oldestPendingAt: string | null; lastSentAt: string | null; failedLast24h: number; lastError: { code: string | null; at: string } | null };
  /** nextKid: null, because the public JWKS has no key status (provisional). artifactKeyCurrent: null when unknown. */
  keys: { activeKid: string | null; nextKid: string | null; artifactKeyKid: string | null; artifactKeyCurrent: boolean | null };
  lastCheck: { at: string; jwks: boolean; token: boolean } | null;
  events: { kind: string; code: string | null; at: string }[];
}

export interface ConnectionHealthDeps {
  db: Db;
  lti: Pick<LtiClient, 'getToolKeys'>;
  logger: Logger;
  now: () => number;
}

const iso = (ms: number | null): string | null => ms === null ? null : new Date(ms).toISOString();
const num = (value: unknown): number | null => value === null || value === undefined ? null : Number(value);

/**
 * The code of a dispatch error: the lti-ags reporter stores "<status> <CODE>: <text>" (status "no answer" when there was
 * none). Another text has no code. The view never returns the free text.
 */
export function dispatchErrorCode(text: string): string | null {
  return /^(?:\d+|no answer) ([A-Z][A-Z0-9_]*)\b/.exec(text)?.[1] ?? null;
}

/** The outbox state of the connection's placements (LA-ADR-03), read only. */
function dispatchState(db: Db, connectionId: string, now: number): ConnectionHealth['dispatch'] {
  const totals = db.prepare(`SELECT
      SUM(CASE WHEN d.status = 'pending' THEN 1 ELSE 0 END) AS pending,
      MIN(CASE WHEN d.status = 'pending' THEN d.created_at END) AS oldest_pending,
      MAX(d.sent_at) AS last_sent,
      SUM(CASE WHEN d.status = 'failed' AND d.updated_at >= ? THEN 1 ELSE 0 END) AS failed_24h
    FROM record_dispatch d JOIN placement p ON p.id = d.placement_id WHERE p.connection_id = ?`).get(now - DAY_MS, connectionId) ?? {};
  const error = db.prepare(`SELECT d.last_error, d.updated_at FROM record_dispatch d JOIN placement p ON p.id = d.placement_id
    WHERE p.connection_id = ? AND d.last_error IS NOT NULL ORDER BY d.updated_at DESC, d.seq DESC LIMIT 1`).get(connectionId);
  return {
    pending: num(totals.pending) ?? 0, oldestPendingAt: iso(num(totals.oldest_pending)), lastSentAt: iso(num(totals.last_sent)),
    failedLast24h: num(totals.failed_24h) ?? 0,
    lastError: error ? { code: dispatchErrorCode(String(error.last_error)), at: iso(Number(error.updated_at))! } : null,
  };
}

/** The health of one connection of its library (no outbound call). `activeKid`: the active tool key id, or null. */
export function readConnectionHealth(db: Db, c: Connection, activeKid: string | null, now: number): ConnectionHealth {
  const events = listConnectionEvents(db, c.libraryId, c.id);
  const refusal = events.find((event) => event.kind === 'launch_refused' || event.kind === 'deep_link_refused');
  const check = events.find((event) => event.kind === 'check');
  const artifact = db.prepare('SELECT artifact_key_kid FROM connection WHERE id = ? AND library_id = ?').get(c.id, c.libraryId);
  const artifactKeyKid = artifact?.artifact_key_kid === null || artifact?.artifact_key_kid === undefined ? null : String(artifact.artifact_key_kid);
  return {
    status: c.status,
    lastLaunchAt: iso(c.lastLaunchAt),
    lastLaunchRefusal: refusal ? { reason: refusal.code, at: iso(refusal.at)! } : null,
    dispatch: dispatchState(db, c.id, now),
    keys: {
      activeKid, nextKid: null, artifactKeyKid,
      artifactKeyCurrent: artifactKeyKid === null || activeKid === null ? null : artifactKeyKid === activeKid,
    },
    lastCheck: check ? { at: iso(check.at)!, ...checkEventParts(check.code) } : null,
    events: events.map((event) => ({ kind: event.kind, code: event.code, at: iso(event.at)! })),
  };
}

export function registerConnectionHealthRoutes(api: FastifyInstance, deps: ConnectionHealthDeps): void {
  // The active key id of the public tool JWKS (active first), for 60 s; a failed read gives null for 60 s too.
  let toolKeys: { readAt: number; activeKid: string | null } | null = null;
  async function activeKid(traceId: string): Promise<string | null> {
    const now = deps.now();
    if (toolKeys && now - toolKeys.readAt < TOOL_KEYS_CACHE_MS) return toolKeys.activeKid;
    let kid: string | null = null;
    try {
      kid = (await deps.lti.getToolKeys(TOOL_ACCOUNT, traceId))[0]?.kid ?? null;
    } catch {
      deps.logger.warn('tool_keys_unavailable', { trace_id: traceId });
    }
    toolKeys = { readAt: now, activeKid: kid };
    return kid;
  }

  api.get<{ Params: { id: string } }>('/connections/:id/health', async (req): Promise<ConnectionHealth> => {
    const library = req.auth!.signedIn.library;
    const c = getConnection(deps.db, library.id, req.params.id);
    if (!c) throw new ApiError('NOT_FOUND', 'The connection does not exist in your library.');
    return readConnectionHealth(deps.db, c, await activeKid(req.traceId), deps.now());
  });
}
