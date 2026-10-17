// T3a API routes (contract §3.2, §3.5 GET rows, §3.6): POST /api/deeplinking, GET /api/lineitems,
// GET /api/lineitems/:lineItemId, POST and GET /api/lineitems/:lineItemId/scores.
// Auth (contract §1.2): deep linking = LTIK-AUTH-V2 only; line items and scores = LTIK-AUTH-V2 or SERVICE-AUTH-V1.
// NOTE: `:lineItemId` is a URL-encoded URL (about 100+ characters): the Fastify instance needs maxParamLength >= 2048.
import type { PublicUrls } from '@cogniate/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError } from '../../api-errors.ts';
import type { Db } from '../../db/index.ts';
import { CLAIM } from '../../lti/checks.ts';
import { deepLinkingResponse } from '../../lti/deep-linking.ts';
import { signToolJwt } from '../../lti/tool-jwt.ts';
import type { AgsClient, AgsContext } from '../../platform/ags.ts';
import { parseScore } from '../../platform/ags.ts';
import type { ToolAccount } from '../../store/accounts.ts';
import type { LaunchRecord } from '../../store/launches.ts';
import type { Platform } from '../../store/platforms.ts';
import { getPlatform } from '../../store/platforms.ts';
import type { ServiceKeyRecord } from '../../store/service-keys.ts';
import { issueServiceKey } from '../../store/service-keys.ts';

export type CallerScheme = 'ltik' | 'service';

/** The resolved caller of an API request: an ltik launch or a service key, of one tool account. */
export interface ApiCaller {
  account: ToolAccount;
  launch: LaunchRecord | null;
  serviceKey: ServiceKeyRecord | null;
}

export interface ServiceRoutesDeps {
  db: Db;
  urls: PublicUrls;
  masterKey: Buffer;
  ags: AgsClient;
  now: () => number;
  /** Resolve the Authorization header for the accepted schemes; throws the 401 ApiError (auth.ts). */
  authenticate: (req: FastifyRequest, schemes: CallerScheme[]) => ApiCaller;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);

/**
 * GET /api/idtoken helper (contract §3.3): the service key of a launch when AGS or NRPS is available and the launch
 * has a context and a resource link (a deep-linking launch has none: no key). Re-issuing refreshes the stored claims.
 */
export function serviceKeyForLaunch(db: Db, masterKey: Buffer, launch: LaunchRecord, now: number): string | undefined {
  const ags = obj(launch.claims[CLAIM.ags]);
  const nrps = obj(launch.claims[CLAIM.nrps]);
  const contextId = obj(launch.claims[CLAIM.context])?.id;
  const resourceLinkId = obj(launch.claims[CLAIM.resourceLink])?.id;
  if ((!ags && !nrps) || typeof contextId !== 'string' || typeof resourceLinkId !== 'string') return undefined;
  const issued = issueServiceKey(db, masterKey, {
    toolAccountId: launch.toolAccountId, platformId: launch.platformId, deploymentId: launch.deploymentId, contextId, resourceLinkId,
    agsClaim: ags, nrpsClaim: nrps,
  }, now);
  return 'serviceKey' in issued ? issued.serviceKey : undefined;
}

/** The platform of the caller; an inactive or deleted platform stops the call (403 / 401). */
function platformOf(db: Db, caller: ApiCaller): Platform {
  const platformId = caller.launch?.platformId ?? caller.serviceKey?.platformId;
  const platform = platformId ? getPlatform(db, caller.account.id, platformId) : null;
  if (!platform) throw new ApiError(caller.launch ? 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER' : 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');
  if (!platform.active) throw new ApiError('PLATFORM_NOT_ACTIVE');
  return platform;
}

function agsContext(db: Db, caller: ApiCaller, traceId: string): AgsContext {
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

type ItemParams = { Params: { lineItemId: string } };
const traceOf = (req: FastifyRequest): string => (req as FastifyRequest & { traceId?: string }).traceId ?? '';

export function registerServiceRoutes(app: FastifyInstance, deps: ServiceRoutesDeps): void {
  app.post('/api/deeplinking', async (req) => {
    const caller = deps.authenticate(req, ['ltik']);
    const platform = platformOf(deps.db, caller);
    const { claims, target } = deepLinkingResponse(caller.launch!, platform, (obj(req.body) ?? {}) as Obj, deps.urls);
    const message = await signToolJwt(deps.db, deps.masterKey, caller.account.id, claims, deps.now());
    return { message, target };
  });

  app.get('/api/lineitems', async (req) => {
    const caller = deps.authenticate(req, ['ltik', 'service']);
    const q = (obj(req.query) ?? {}) as Obj;
    const query = {
      resourceLinkId: optText(q, 'resourceLinkId'), resourceId: optText(q, 'resourceId'), tag: optText(q, 'tag'), limit: optLimit(q), url: optText(q, 'url'),
    };
    return deps.ags.listLineItems(agsContext(deps.db, caller, traceOf(req)), Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined)));
  });

  app.get<ItemParams>('/api/lineitems/:lineItemId', async (req) => {
    const caller = deps.authenticate(req, ['ltik', 'service']);
    return deps.ags.getLineItem(agsContext(deps.db, caller, traceOf(req)), req.params.lineItemId);
  });

  app.post<ItemParams>('/api/lineitems/:lineItemId/scores', async (req, reply) => {
    const caller = deps.authenticate(req, ['ltik', 'service']);
    const score = parseScore(req.body);
    await deps.ags.postScore(agsContext(deps.db, caller, traceOf(req)), req.params.lineItemId, score);
    return reply.code(204).send();
  });

  app.get<ItemParams>('/api/lineitems/:lineItemId/scores', async (req) => {
    const caller = deps.authenticate(req, ['ltik', 'service']);
    const q = (obj(req.query) ?? {}) as Obj;
    const query = { userId: optText(q, 'userId'), limit: optLimit(q), url: optText(q, 'url') };
    return deps.ags.getScores(agsContext(deps.db, caller, traceOf(req)), req.params.lineItemId, Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined)));
  });
}
