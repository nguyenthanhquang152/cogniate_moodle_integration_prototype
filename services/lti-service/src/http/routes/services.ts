// T3a API routes (contract §3.2, §3.5 GET rows, §3.6): POST /api/deeplinking, GET /api/lineitems,
// GET /api/lineitems/:lineItemId, POST and GET /api/lineitems/:lineItemId/scores.
// Auth (contract §1.2): deep linking = LTIK-AUTH-V2 only; line items and scores = LTIK-AUTH-V2 or SERVICE-AUTH-V1.
// `:lineItemId` is a URL-encoded URL: buildApp sets maxParamLength 2048.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError } from '../../api-errors.ts';
import type { Db } from '../../db/index.ts';
import { CLAIM } from '../../lti/checks.ts';
import { deepLinkingResponse } from '../../lti/deep-linking.ts';
import { signToolJwt } from '../../lti/tool-jwt.ts';
import type { AgsContext } from '../../platform/ags.ts';
import { parseScore } from '../../platform/ags.ts';
import type { Platform } from '../../store/platforms.ts';
import { getPlatform } from '../../store/platforms.ts';
import type { AuthResult } from '../auth.ts';
import type { RouteContext } from '../context.ts';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);

/** The platform of the caller; an inactive or deleted platform stops the call (403 / 401). */
function platformOf(db: Db, caller: AuthResult): Platform {
  const platformId = caller.launch?.platformId ?? caller.serviceKey?.platformId;
  const platform = platformId ? getPlatform(db, caller.account.id, platformId) : null;
  if (!platform) throw new ApiError(caller.launch ? 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER' : 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');
  if (!platform.active) throw new ApiError('PLATFORM_NOT_ACTIVE');
  return platform;
}

function agsContext(db: Db, caller: AuthResult, traceId: string): AgsContext {
  const platform = platformOf(db, caller);
  const agsClaim = caller.launch ? obj(caller.launch.claims[CLAIM.ags]) : caller.serviceKey?.agsClaim ?? null;
  return { platform, agsClaim, traceId };
}

const optText = (q: Obj, name: string): string | undefined => {
  const v = q[name];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v === '' || v.length > 2048) throw new ApiError('INVALID_REQUEST', `Invalid field: ${name}.`);
  return v;
};
const optLimit = (q: Obj): number | undefined => {
  const v = optText(q, 'limit');
  if (v === undefined) return undefined;
  if (!/^[1-9]\d{0,5}$/.test(v)) throw new ApiError('INVALID_REQUEST', 'Invalid field: limit must be a whole number >= 1.');
  return Number(v);
};
const defined = <T extends Obj>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

type ItemParams = { Params: { lineItemId: string } };
export function registerServiceRoutes(app: FastifyInstance, ctx: RouteContext): void {
  const traceOf = (req: FastifyRequest): string => req.traceId ?? '';
  app.post('/api/deeplinking', async (req) => {
    const caller = ctx.auth(req, ['ltik']);
    const platform = platformOf(ctx.db, caller);
    const { claims, target } = deepLinkingResponse(caller.launch!, platform, (obj(req.body) ?? {}) as Obj, ctx.urls);
    const message = await signToolJwt(ctx.db, ctx.masterKey, caller.account.id, claims, ctx.now());
    return { message, target };
  });

  app.get('/api/lineitems', async (req) => {
    const caller = ctx.auth(req, ['ltik', 'service']);
    const q = (obj(req.query) ?? {}) as Obj;
    const query = {
      resourceLinkId: optText(q, 'resourceLinkId'), resourceId: optText(q, 'resourceId'), tag: optText(q, 'tag'), limit: optLimit(q), url: optText(q, 'url'),
    };
    return ctx.ags.listLineItems(agsContext(ctx.db, caller, traceOf(req)), defined(query));
  });

  app.get<ItemParams>('/api/lineitems/:lineItemId', async (req) => {
    const caller = ctx.auth(req, ['ltik', 'service']);
    return ctx.ags.getLineItem(agsContext(ctx.db, caller, traceOf(req)), req.params.lineItemId);
  });

  app.post<ItemParams>('/api/lineitems/:lineItemId/scores', async (req, reply) => {
    const caller = ctx.auth(req, ['ltik', 'service']);
    const score = parseScore(req.body, ctx.now());
    await ctx.ags.postScore(agsContext(ctx.db, caller, traceOf(req)), req.params.lineItemId, score);
    return reply.code(204).send();
  });

  app.get<ItemParams>('/api/lineitems/:lineItemId/scores', async (req) => {
    const caller = ctx.auth(req, ['ltik', 'service']);
    const q = (obj(req.query) ?? {}) as Obj;
    const query = { userId: optText(q, 'userId'), limit: optLimit(q), url: optText(q, 'url') };
    return ctx.ags.getScores(agsContext(ctx.db, caller, traceOf(req)), req.params.lineItemId, defined(query));
  });
}
