// The LTI service HTTP app (contract lti-service-api). Setup only: hooks, error handling, health, auth and the error
// page; the routes live in one file per group (B-T2a-01): routes/protocol.ts (Moodle and browser), routes/idtoken.ts
// and routes/services.ts (LTIAAS-shaped API), routes/platforms.ts (admin), routes/registration.ts (dynamic registration).
import { randomBytes } from 'node:crypto';
import formbody from '@fastify/formbody';
import type { Knob, Logger, OutboundClient, PublicUrls } from '@cogniate/shared';
import { ApiErrorBase, redactPath } from '@cogniate/shared';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { ApiError, apiErrorBody } from '../api-errors.ts';
import type { Db } from '../db/index.ts';
import { PROTOCOL_ERRORS } from '../lti/codes.ts';
import type { PlatformKeys } from '../lti/jwks.ts';
import type { AgsClient } from '../platform/ags.ts';
import { authenticate } from './auth.ts';
import type { RouteContext } from './context.ts';
import { ERROR_PAGE_HEADERS, renderErrorPage } from './error-page.ts';
import { registerIdTokenRoutes } from './routes/idtoken.ts';
import { registerPlatformRoutes } from './routes/platforms.ts';
import { registerRegistrationRoutes } from './routes/registration.ts';
import { registerProtocolRoutes } from './routes/protocol.ts';
import { registerServiceRoutes } from './routes/services.ts';

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
  /** LTI_MASTER_KEY: tool signing keys (AES-256-GCM) and service key derivation (T3a). */
  masterKey: Buffer;
  /** AGS client (platform token client + score clock), T3a. */
  ags: AgsClient;
  /** Guarded outbound client (dynamic registration, T3b). */
  outbound: OutboundClient;
  profile: string;
  knobs: Knob[];
  /** Active outbound allowlist, shown in /healthz (T2b). */
  outboundAllowlist?: readonly string[];
  now?: () => number;
}

const TRACE_ID = /^[A-Za-z0-9-]{16,64}$/; // contract §1.4
const BODY_LIMIT = 256 * 1024; // contract §1.4
const MAX_PARAM_LENGTH = 2048; // :lineItemId is a URL-encoded line item URL (contract §1.4)

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const now = deps.now ?? Date.now;
  const log = deps.logger;
  const app = Fastify({ logger: false, bodyLimit: BODY_LIMIT, maxParamLength: MAX_PARAM_LENGTH, return503OnClosing: false });
  await app.register(formbody, { bodyLimit: BODY_LIMIT });

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
    if (err instanceof ApiErrorBase) return reply.code(err.status).send(err.body());
    // 413 keeps the INVALID_REQUEST code (contract §1.4: max 256 KB).
    if (err.code === 'FST_ERR_CTP_BODY_TOO_LARGE') return reply.code(413).send(apiErrorBody(413, 'INVALID_REQUEST', 'Body is larger than 256 KB.'));
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.code(400).send(new ApiError('INVALID_REQUEST', 'The request could not be read.').body());
    }
    log.error('internal_error', { trace_id: req.traceId, error: err.name });
    return reply.code(500).send(new ApiError('INTERNAL_ERROR', `Internal error. Trace id: ${req.traceId}`).body());
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send(new ApiError('NOT_FOUND', 'Unknown route.').body()));

  const ctx: RouteContext = {
    db: deps.db, urls: deps.urls, logger: log, keys: deps.keys, ltikTtlSeconds: deps.ltikTtlSeconds, masterKey: deps.masterKey, ags: deps.ags, outbound: deps.outbound, now,
    auth: (req, schemes) => authenticate(deps.db, req.headers.authorization, schemes, now(),
      (scheme, code) => log.warn('api_auth_failed', { trace_id: req.traceId, scheme, code })),
    errorPage: (reply, req, code, opts = {}) =>
      reply.code(opts.status ?? PROTOCOL_ERRORS[code].status).headers(ERROR_PAGE_HEADERS)
        .send(renderErrorPage(code, req.traceId, opts.help ?? PROTOCOL_ERRORS[code].action, opts.detail, opts.heading)),
  };

  // Health (contract §2.5)
  app.get('/healthz', async () => ({
    status: 'ok', service: 'lti-service', profile: deps.profile, knobs: deps.knobs, outbound_allowlist: deps.outboundAllowlist ?? [],
  }));

  registerProtocolRoutes(app, ctx);
  registerIdTokenRoutes(app, ctx);
  registerServiceRoutes(app, ctx);
  registerPlatformRoutes(app, ctx);
  registerRegistrationRoutes(app, ctx);
  return app;
}
