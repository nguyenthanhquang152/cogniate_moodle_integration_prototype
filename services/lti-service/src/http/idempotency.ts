// LA-E5-16, BD-A2-51: select only the three create routes; authenticate before every cache lookup.
import { sha256Hex } from '@cogniate/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError } from '../api-errors.ts';
import { insertAuditEvent } from '../store/audit.ts';
import type { AuditTarget } from '../store/audit.ts';
import { abandonIdempotency, claimIdempotency, completeIdempotency } from '../store/idempotency.ts';
import type { IdempotencyClaim, StoredAnswer } from '../store/idempotency.ts';
import type { AuthResult, Scheme } from './auth.ts';
import type { RouteContext } from './context.ts';
import { retryAfterSeconds, setRetryAfter } from './retry-after.ts';

interface RouteRule { schemes: Scheme[]; action?: string; targetType?: string; targetField?: string }
const ROUTES: Record<string, RouteRule> = {
  '/api/platforms': { schemes: ['bearer'], action: 'platform.create', targetType: 'platform', targetField: 'id' },
  '/api/platforms/:id/deployments': { schemes: ['bearer'], action: 'deployment.create', targetType: 'deployment', targetField: 'deploymentId' },
  '/api/lineitems': { schemes: ['ltik', 'service'] },
};

/** Parsed JSON only: sort every object's keys, preserve arrays, strings and parsed numeric values. */
export function canonicalJson(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

/** The routes return JSON. Cache the exact serialized body, plus its audit target/code for replay. */
function storedAnswer(rule: RouteRule, status: number, body: string): StoredAnswer {
  const data = body ? JSON.parse(body) as { [key: string]: unknown; details?: { message?: string } } : null;
  const id = rule.targetField ? data?.[rule.targetField] : null;
  return {
    status, body, target: rule.targetType ? { type: rule.targetType, id: typeof id === 'string' ? id : null } : null,
    code: status >= 400 && typeof data?.details?.message === 'string' ? data.details.message : null,
  };
}

export function installIdempotency(app: FastifyInstance, ctx: Pick<RouteContext, 'db' | 'auth' | 'now'>): void {
  const claims = new WeakMap<FastifyRequest, { claim: IdempotencyClaim; rule: RouteRule }>();
  const audit = (req: FastifyRequest, caller: AuthResult, rule: RouteRule, details: Record<string, unknown>,
    result: 'ok' | 'refused', code: string | null, target?: AuditTarget | null): void => {
    if (!rule.action || !rule.targetType) return; // Line item calls are api-class, with no admin audit event.
    insertAuditEvent(ctx.db, {
      actor: caller.actor, toolAccountId: caller.account.id, traceId: req.traceId, clientIp: req.ip,
      action: rule.action, target: target ?? { type: rule.targetType, id: null }, result, code, details,
    }, ctx.now());
  };
  app.addHook('preHandler', async (req, reply) => {
    const route = req.routeOptions.url ?? '';
    const rule = ROUTES[route];
    const key = req.headers['idempotency-key'];
    if (req.method !== 'POST' || !rule || key === undefined) return;
    const caller = ctx.auth(req, rule.schemes);
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(key)) {
      audit(req, caller, rule, { field: 'Idempotency-Key' }, 'refused', 'INVALID_REQUEST');
      throw new ApiError('INVALID_REQUEST', 'Invalid field: Idempotency-Key. Use 1 to 64 letters, digits, underscores or hyphens.');
    }
    const result = claimIdempotency(ctx.db, {
      toolAccountId: caller.account.id, key, method: req.method, route,
      params: canonicalJson(req.params ?? {}), bodyHash: sha256Hex(canonicalJson(req.body)),
    }, ctx.now());
    if (result.kind === 'claimed') { claims.set(req, { claim: result.claim, rule }); return; }
    if (result.kind === 'replay') {
      audit(req, caller, rule, { idempotentReplay: true, idempotencyKey: key },
        result.answer.status < 300 ? 'ok' : 'refused', result.answer.code, result.answer.target);
      if (result.answer.status === 429) {
        const body = JSON.parse(result.answer.body) as { details?: { retryAfter?: unknown } };
        setRetryAfter(reply, retryAfterSeconds(body.details?.retryAfter));
      }
      return reply.code(result.answer.status).type('application/json').send(result.answer.body);
    }
    const code = result.kind === 'reused' ? 'IDEMPOTENCY_KEY_REUSED' : 'IDEMPOTENCY_IN_PROGRESS';
    audit(req, caller, rule, { idempotencyKey: key }, 'refused', code);
    throw new ApiError(code);
  });
  app.addHook('onSend', async (req, reply, payload) => {
    const pending = claims.get(req);
    if (!pending) return payload;
    try {
      if ((reply.statusCode >= 200 && reply.statusCode < 300) || (reply.statusCode >= 400 && reply.statusCode < 500)) {
        if (payload !== null && typeof payload !== 'string' && !Buffer.isBuffer(payload)) throw new TypeError('Idempotent routes must return JSON');
        completeIdempotency(ctx.db, pending.claim, storedAnswer(pending.rule, reply.statusCode, payload === null ? '' : payload.toString()));
      } else abandonIdempotency(ctx.db, pending.claim);
    } catch (error) {
      try { abandonIdempotency(ctx.db, pending.claim); } catch { /* Keep the first error. */ }
      throw error;
    } finally { claims.delete(req); }
    return payload;
  });
}
