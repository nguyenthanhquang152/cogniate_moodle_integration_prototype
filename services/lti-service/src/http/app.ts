import { randomBytes } from 'node:crypto';
import formbody from '@fastify/formbody';
import type { Knob, Logger, PublicUrls } from '@cogniate/shared';
import { ApiError, apiErrorBody, redactPath } from '@cogniate/shared';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/index.ts';
import { activePublicKeyPem, getAccount, publicJwks } from '../store/accounts.ts';
import type { Platform } from '../store/platforms.ts';
import { PlatformExistsError, createPlatform, getPlatform, listPlatforms, updatePlatform } from '../store/platforms.ts';
import { PROTOCOL_ERRORS } from '../lti/codes.ts';
import type { ProtocolErrorCode } from '../lti/codes.ts';
import { toIdToken } from '../lti/idtoken.ts';
import type { PlatformKeys } from '../lti/jwks.ts';
import { handleLaunch } from '../lti/launch.ts';
import { initiateLogin } from '../lti/login.ts';
import { authenticate } from './auth.ts';
import { ERROR_PAGE_HEADERS, renderErrorPage } from './errors.ts';

declare module 'fastify' {
  interface FastifyRequest {
    traceId: string;
  }
}

export interface AppDeps {
  db: Db;
  urls: PublicUrls;
  logger: Logger;
  keys: PlatformKeys;
  ltikTtlSeconds: number;
  profile: string;
  knobs: Knob[];
  /** Active outbound allowlist, shown in /healthz (T2b). */
  outboundAllowlist?: readonly string[];
  now?: () => number;
}

const TRACE_ID = /^[A-Za-z0-9-]{16,64}$/; // contract §1.4

const isHttpsUrl = (v: string): boolean => {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.username === '' && u.password === '' && u.hash === '';
  } catch {
    return false;
  }
};

const PlatformCreate = z.object({
  url: z.string().min(1).max(2048),
  clientId: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  authenticationEndpoint: z.string().min(1).max(2048),
  accesstokenEndpoint: z.string().min(1).max(2048),
  authConfig: z.object({ method: z.string(), key: z.string().min(1).max(2048) }),
  deploymentIds: z.array(z.string().min(1).max(255)).min(1).max(100),
  active: z.boolean().optional(),
  productFamilyCode: z.string().max(64).optional(),
});

const PlatformPatch = z.object({
  name: z.string().min(1).max(255).optional(),
  active: z.boolean().optional(),
  deploymentIds: z.array(z.string().min(1).max(255)).min(1).max(100).optional(),
});

const PlatformQuery = z.object({ id: z.string().optional(), url: z.string().optional(), clientId: z.string().optional() });

function invalid(error: z.ZodError): ApiError {
  const issue = error.issues[0];
  const field = issue && issue.path.length ? issue.path.join('.') : 'body';
  return new ApiError('INVALID_REQUEST', `Invalid field: ${field}.`);
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const now = deps.now ?? Date.now;
  const log = deps.logger;
  const app = Fastify({ logger: false, bodyLimit: 256 * 1024, return503OnClosing: false });
  await app.register(formbody, { bodyLimit: 256 * 1024 });

  app.decorateRequest('traceId', '');
  app.addHook('onRequest', async (req, reply) => {
    const given = req.headers['x-trace-id'];
    req.traceId = typeof given === 'string' && TRACE_ID.test(given) ? given : randomBytes(16).toString('hex');
    reply.header('x-trace-id', req.traceId);
  });
  app.addHook('onResponse', async (req, reply) => {
    const path = req.url.split('?')[0] ?? '/';
    log.log(path === '/healthz' ? 'debug' : 'info', 'http_request', {
      trace_id: req.traceId, method: req.method, path: redactPath(path), status: reply.statusCode, ms: Math.round(reply.elapsedTime),
    });
  });

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, req, reply) => {
    if (err instanceof ApiError) return reply.code(err.status).send(err.body());
    // 413 keeps the INVALID_REQUEST code (contract §1.4: max 256 KB).
    if (err.code === 'FST_ERR_CTP_BODY_TOO_LARGE') return reply.code(413).send(apiErrorBody(413, 'INVALID_REQUEST', 'Body is larger than 256 KB.'));
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.code(400).send(new ApiError('INVALID_REQUEST', 'The request could not be read.').body());
    }
    log.error('internal_error', { trace_id: req.traceId, error: err.name });
    return reply.code(500).send(new ApiError('INTERNAL_ERROR', `Internal error. Trace id: ${req.traceId}`).body());
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send(new ApiError('NOT_FOUND', 'Unknown route.').body()));

  const errorPage = (reply: FastifyReply, req: FastifyRequest, code: ProtocolErrorCode, opts: { help?: string; detail?: string; status?: number } = {}) =>
    reply.code(opts.status ?? PROTOCOL_ERRORS[code].status).headers(ERROR_PAGE_HEADERS)
      .send(renderErrorPage(code, req.traceId, opts.help ?? PROTOCOL_ERRORS[code].action, opts.detail));

  const auth = (req: FastifyRequest, schemes: Array<'ltik' | 'service' | 'bearer'>) =>
    authenticate(deps.db, req.headers.authorization, schemes, now(), (scheme, code) => log.warn('api_auth_failed', { trace_id: req.traceId, scheme, code }));

  // ---------------------------------------------------------------- health (contract §2.5)
  app.get('/healthz', async () => ({
    status: 'ok', service: 'lti-service', profile: deps.profile, knobs: deps.knobs, outbound_allowlist: deps.outboundAllowlist ?? [],
  }));

  // ---------------------------------------------------------------- tool JWKS (contract §2.3)
  app.get<{ Params: { account: string } }>('/lti/keys/:account', async (req, reply) => {
    if (!getAccount(deps.db, req.params.account)) throw new ApiError('NOT_FOUND', 'Unknown tool account.');
    return reply.header('cache-control', 'public, max-age=300').send({ keys: publicJwks(deps.db, req.params.account, now()) });
  });

  // ---------------------------------------------------------------- OIDC login initiation (contract §2.1)
  const login = async (req: FastifyRequest<{ Params: { account: string } }>, reply: FastifyReply) => {
    const params = (req.method === 'GET' ? req.query : req.body) as Record<string, unknown> | undefined;
    const result = initiateLogin(deps.db, deps.urls, req.params.account, params ?? {}, now());
    if (!result.ok) {
      log.warn('login_rejected', { trace_id: req.traceId, code: result.code, detail: result.detail });
      return errorPage(reply, req, result.code);
    }
    return reply.code(302).headers({ location: result.location, 'set-cookie': result.setCookie, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }).send();
  };
  app.get('/lti/login/:account', login);
  app.post('/lti/login/:account', login);

  // ---------------------------------------------------------------- launch / redirect URI (contract §2.2)
  app.post<{ Params: { account: string } }>('/lti/launch/:account', async (req, reply) => {
    const form = (req.body ?? {}) as Record<string, unknown>;
    const result = await handleLaunch({ db: deps.db, urls: deps.urls, keys: deps.keys, ltikTtlSeconds: deps.ltikTtlSeconds, now },
      req.params.account, form, req.headers.cookie, req.traceId);
    if (!result.ok) {
      log.warn('launch_check_failed', { trace_id: req.traceId, check: result.check, code: result.code, detail: result.detail });
      if (result.clearCookie) reply.header('set-cookie', result.clearCookie);
      return errorPage(reply, req, result.code, {
        ...(result.help ? { help: result.help } : {}),
        ...(result.oidcError ? { detail: result.oidcError } : {}),
      });
    }
    log.info('launch_accepted', { trace_id: req.traceId, platform_id: result.platformId, message_type: result.messageType });
    return reply.code(303).headers({ location: result.location, 'set-cookie': result.clearCookie, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }).send();
  });
  app.get('/lti/launch/:account', async (req, reply) => {
    reply.header('allow', 'POST');
    return errorPage(reply, req, 'METHOD_NOT_ALLOWED');
  });

  // ---------------------------------------------------------------- ID token (contract §3.1)
  app.get<{ Querystring: { raw?: string } }>('/api/idtoken', async (req) => {
    const { account, launch } = auth(req, ['ltik']);
    const platform = getPlatform(deps.db, account.id, launch!.platformId);
    if (!platform) throw new ApiError('INVALID_LTIK_AUTH_AUTHORIZATION_HEADER', 'Invalid or expired ltik.');
    if (!platform.active) throw new ApiError('PLATFORM_NOT_ACTIVE', 'The platform is not active.');
    return req.query.raw === 'true' ? launch!.claims : toIdToken(launch!, platform);
  });

  // ---------------------------------------------------------------- platforms (contract §3.9)
  const platformView = (p: Platform) => ({
    id: p.id, url: p.issuer, clientId: p.clientId, name: p.name, authenticationEndpoint: p.authEndpoint,
    accesstokenEndpoint: p.tokenEndpoint, authConfig: { method: 'JWK_SET', key: p.jwksUrl },
    publicKey: activePublicKeyPem(deps.db, p.toolAccountId), active: p.active, deploymentIds: p.deploymentIds,
    productFamilyCode: p.productFamilyCode,
  });

  app.get('/api/platforms', async (req) => {
    const { account } = auth(req, ['bearer']);
    const q = PlatformQuery.safeParse(req.query ?? {});
    if (!q.success) throw invalid(q.error);
    const filter = Object.fromEntries(Object.entries(q.data).filter(([, v]) => v !== undefined)) as { id?: string; url?: string; clientId?: string };
    return { platforms: listPlatforms(deps.db, account.id, filter).map(platformView) };
  });

  app.post('/api/platforms', async (req, reply) => {
    const { account } = auth(req, ['bearer']);
    const parsed = PlatformCreate.safeParse(req.body ?? {});
    if (!parsed.success) throw invalid(parsed.error);
    const b = parsed.data;
    if (b.authConfig.method !== 'JWK_SET') throw new ApiError('UNSUPPORTED_AUTH_METHOD', 'Only authConfig.method JWK_SET is supported.');
    for (const [field, value] of [['url', b.url], ['authenticationEndpoint', b.authenticationEndpoint], ['accesstokenEndpoint', b.accesstokenEndpoint], ['authConfig.key', b.authConfig.key]] as const) {
      if (!isHttpsUrl(value)) throw new ApiError('INVALID_REQUEST', `Invalid field: ${field} must be an https URL.`);
    }
    // Security §2.4: every platform endpoint is on the issuer origin (Moodle: auth.php, token.php, certs.php).
    const origin = new URL(b.url).origin;
    for (const [field, value] of [['authenticationEndpoint', b.authenticationEndpoint], ['accesstokenEndpoint', b.accesstokenEndpoint], ['authConfig.key', b.authConfig.key]] as const) {
      if (new URL(value).origin !== origin) throw new ApiError('PLATFORM_URL_NOT_ON_ISSUER_ORIGIN', `${field} is not on the issuer origin.`);
    }
    try {
      const p = createPlatform(deps.db, account.id, {
        issuer: b.url, clientId: b.clientId, name: b.name, authEndpoint: b.authenticationEndpoint, tokenEndpoint: b.accesstokenEndpoint,
        jwksUrl: b.authConfig.key, deploymentIds: b.deploymentIds, active: b.active ?? true, productFamilyCode: b.productFamilyCode ?? null,
      });
      return reply.code(201).send(platformView(p));
    } catch (err) {
      if (err instanceof PlatformExistsError) throw new ApiError('PLATFORM_ALREADY_EXISTS', 'A platform with this issuer and client id exists.');
      throw err;
    }
  });

  app.get<{ Params: { id: string } }>('/api/platforms/:id', async (req) => {
    const { account } = auth(req, ['bearer']);
    const p = getPlatform(deps.db, account.id, req.params.id);
    if (!p) throw new ApiError('UNREGISTERED_PLATFORM', 'Unknown platform id.');
    return platformView(p);
  });

  app.patch<{ Params: { id: string } }>('/api/platforms/:id', async (req) => {
    const { account } = auth(req, ['bearer']);
    const parsed = PlatformPatch.safeParse(req.body ?? {});
    if (!parsed.success) throw invalid(parsed.error);
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)) as { name?: string; active?: boolean; deploymentIds?: string[] };
    const p = updatePlatform(deps.db, account.id, req.params.id, patch);
    if (!p) throw new ApiError('UNREGISTERED_PLATFORM', 'Unknown platform id.');
    return platformView(p);
  });

  return app;
}
