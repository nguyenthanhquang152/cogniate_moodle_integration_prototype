import { storeFor } from '../store/index.ts';
// LA-E5-16 (BD-A2-51, BD-A2-56, BD-A2-57): select only the three create routes. Order: authentication and rate limits,
// then the resolved target with its read-only checks, then the lookup, then run or replay.
import { sha256Hex } from '@cogniate/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError } from '../api-errors.ts';
import { CLAIM } from '../lti/checks.ts';
import { preflightCreateLineItem } from '../platform/ags.ts';
import type { AuditTarget } from '../store/audit.ts';
import { isFinalStatus } from '../store/idempotency.ts';
import type { IdempotencyClaim, StoredAnswer } from '../store/idempotency.ts';
import type { AuthResult, Scheme } from './auth.ts';
import type { RouteContext } from './context.ts';
import { agsContext, claimObject } from './service-context.ts';

type Ctx = Pick<RouteContext, 'db' | 'auth' | 'now' | 'profiles'>;
/**
 * The resolved target of the fingerprint (BD-A2-56), after the same read-only checks that the route makes. A failed
 * check throws the route's normal refusal, or gives null when the route must refuse the request itself (with its own
 * audit event). In both cases nothing is claimed, stored or replayed.
 */
type TargetOf = (ctx: Ctx, req: FastifyRequest, caller: AuthResult) => unknown;
interface RouteRule { schemes: Scheme[]; target: TargetOf; action?: string; targetType?: string; targetField?: string }

/** LTIK-AUTH-V2 and SERVICE-AUTH-V1: the platform, deployment, context and AGS line items URL of the credential. */
const lineItemTarget: TargetOf = async (ctx, req, caller) => {
  // agsContext runs the binding checks of platformOf (account, platform active, deployment active, generation).
  const ags = (await agsContext(ctx, caller, req.traceId));
  // BD-A2-71: the read-only create preflight of the route (line items URL, URL rule, lineitem scope), before the claim.
  const { url } = preflightCreateLineItem(ags);
  // LA-E3-03: no context is context id "", for a launch and for its service key alike.
  const contextId = caller.launch ? claimObject(caller.launch.claims[CLAIM.context])?.id : caller.serviceKey?.contextId;
  return {
    platformId: ags.platform.id, deploymentId: caller.launch?.deploymentId ?? caller.serviceKey?.deploymentId ?? null,
    contextId: typeof contextId === 'string' ? contextId : '', lineItemsUrl: url,
  };
};

const ROUTES: Record<string, RouteRule> = {
  '/api/platforms': { schemes: ['bearer'], target: (_ctx, req) => req.params ?? {}, action: 'platform.create', targetType: 'platform', targetField: 'id' },
  '/api/platforms/:id/deployments': {
    schemes: ['bearer'], action: 'deployment.create', targetType: 'deployment', targetField: 'deploymentId',
    // Bearer: the decoded path parameters. A deleted platform gets the route's 404, never a stored deployment.
    target: async (ctx, req, caller) => (await storeFor(ctx.db).platforms.getPlatform(caller.account.id, (req.params as { id: string }).id)) ? req.params : null,
  },
  '/api/lineitems': { schemes: ['ltik', 'service'], target: lineItemTarget },
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

export function installIdempotency(app: FastifyInstance, ctx: Ctx): void {
  const claims = new WeakMap<FastifyRequest, { claim: IdempotencyClaim; rule: RouteRule }>();
  const audit = async (req: FastifyRequest, caller: AuthResult, rule: RouteRule, details: Record<string, unknown>,
    result: 'ok' | 'refused', code: string | null, target?: AuditTarget | null): Promise<void> => {
    if (!rule.action || !rule.targetType) return; // Line item calls are api-class, with no admin audit event.
    (await storeFor(ctx.db).audit.insertAuditEvent({
      actor: caller.actor, toolAccountId: caller.account.id, traceId: req.traceId, clientIp: req.ip,
      action: rule.action, target: target ?? { type: rule.targetType, id: null }, result, code, details,
    }, ctx.now()));
  };
  // The plugin selects routes by their exact template. A renamed route, also a renamed path parameter, must stop the
  // start, not switch the plugin off. Install the plugin before the routes, so that onRoute sees them.
  const templates = new Set<string>();
  app.addHook('onRoute', (route) => {
    if ([route.method].flat().includes('POST')) templates.add(route.url);
  });
  app.addHook('onReady', async () => {
    const missing = Object.keys(ROUTES).filter((url) => !templates.has(url));
    if (missing.length > 0) {
      throw new Error(`Idempotency-Key: no POST route ${missing.join(', ')}. Update ROUTES in http/idempotency.ts to the new route template.`);
    }
  });
  app.addHook('preHandler', async (req, reply) => {
    const route = req.routeOptions.url ?? '';
    const rule = ROUTES[route];
    const key = req.headers['idempotency-key'];
    if (req.method !== 'POST' || !rule || key === undefined) return;
    const caller = (await ctx.auth(req, rule.schemes));
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(key)) {
      (await audit(req, caller, rule, { field: 'Idempotency-Key' }, 'refused', 'INVALID_REQUEST'));
      throw new ApiError('INVALID_REQUEST', 'Invalid field: Idempotency-Key. Use 1 to 64 letters, digits, underscores or hyphens.');
    }
    const target = (await rule.target(ctx, req, caller));
    if (target === null) return;
    const result = (await storeFor(ctx.db).idempotency.claimIdempotency({
      toolAccountId: caller.account.id, key, method: req.method, route,
      params: canonicalJson(target), bodyHash: sha256Hex(canonicalJson(req.body)),
    }, ctx.now()));
    if (result.kind === 'claimed') { claims.set(req, { claim: result.claim, rule }); return; }
    if (result.kind === 'replay') {
      (await audit(req, caller, rule, { idempotentReplay: true, idempotencyKey: key },
        result.answer.status < 300 ? 'ok' : 'refused', result.answer.code, result.answer.target));
      return reply.code(result.answer.status).type('application/json').send(result.answer.body);
    }
    const code = result.kind === 'reused' ? 'IDEMPOTENCY_KEY_REUSED' : 'IDEMPOTENCY_IN_PROGRESS';
    (await audit(req, caller, rule, { idempotencyKey: key }, 'refused', code));
    // BD-A2-58: a 409 gives the wait until the running claim ends; the error handler also sends it as Retry-After.
    // The hook never stores its own 409 or 422.
    const details = result.kind === 'running' ? { retryAfter: Math.max(1, Math.ceil((result.endsAt - ctx.now()) / 1000)) } : {};
    throw new ApiError(code, undefined, { details });
  });
  app.addHook('onSend', async (req, reply, payload) => {
    const pending = claims.get(req);
    if (!pending) return payload;
    try {
      // BD-A2-57: an answer that asks for a retry (5xx, 429 or Retry-After) frees the key, so the retry runs again.
      if (isFinalStatus(reply.statusCode) && !reply.hasHeader('retry-after')) {
        if (payload !== null && typeof payload !== 'string' && !Buffer.isBuffer(payload)) throw new TypeError('Idempotent routes must return JSON');
        (await storeFor(ctx.db).idempotency.completeIdempotency(pending.claim, storedAnswer(pending.rule, reply.statusCode, payload === null ? '' : payload.toString())));
      } else (await storeFor(ctx.db).idempotency.abandonIdempotency(pending.claim));
    } catch (error) {
      try { (await storeFor(ctx.db).idempotency.abandonIdempotency(pending.claim)); } catch { /* Keep the first error. */ }
      throw error;
    } finally { claims.delete(req); }
    return payload;
  });
}
