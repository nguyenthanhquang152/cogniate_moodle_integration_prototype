import type { ChannelRegistry } from '@cogniate/channel-kernel';
// The app listener (PUBLIC_APP_URL): /healthz, the portal API /app-api/* (contract cogniate-app-api §1-§5), the tool
// pages /tool/*, the player shell /play/* (§6), and the built portal SPA.
import { randomBytes } from 'node:crypto';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import type { Limits } from '@cogniate/package-inspector';
import { DEFAULT_LIMITS } from '@cogniate/package-inspector';
import type { Knob, Logger, OutboundClient, PublicUrls } from '@cogniate/shared';
import { ApiErrorBase, redactPath } from '@cogniate/shared';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../domain/db.ts';
import type { SignedIn } from '../domain/libraries.ts';
import type { LtiClient } from '../clients/lti-client.ts';
import type { StorePaths } from '../domain/package-store.ts';
import { registerLaunchPages } from '../tool-pages/launch.ts';
import { registerPickerPages } from '../tool-pages/picker.ts';
import { registerPlayPages, registerPlayStatusRoute } from '../tool-pages/play.ts';
import { registerRegisterPages } from '../tool-pages/register.ts';
import { createBindingCleanup } from './binding-cleanup.ts';
import type { connectionJson } from './connections.ts';
import { connectionDto, registerConnectionRoutes } from './connections.ts';
import { createRedemptionEngine } from './redemption.ts';
import { registerCourseRoutes } from './courses.ts';
import { registerDeploymentRoutes, registerExtensionRoutes, registerExporterRoutes } from '../kernel/extensions.ts';
import { registerPublicationRoutes } from './publications.ts';
import { registerResultRoutes } from './results.ts';
import { registerPortal } from './portal.ts';
import { ApiError, apiErrorBody } from './api-errors.ts';
import { registerSessionRoutes, sessionOf } from './session.ts';

declare module 'fastify' {
  interface FastifyRequest {
    traceId: string;
    /** Set by the session hook on /app-api/* routes (null on the public route). */
    auth: { token: string; signedIn: SignedIn } | null;
  }
  interface FastifyContextConfig {
    /** The route needs no session (POST /app-api/session). */
    public?: boolean;
  }
}

export interface AppApiDeps {
  channels: ChannelRegistry;
  db: Db;
  urls: PublicUrls;
  logger: Logger;
  store: StorePaths;
  profile: string;
  knobs: Knob[];
  /** Active outbound allowlist, shown in /healthz (T2b). */
  outboundAllowlist?: string[];
  now?: () => number;
  /** Package limits (security §7). Tests make them smaller. */
  limits?: Partial<Limits>;
  /** APP_MASTER_KEY (32 bytes): the stored copy of the registration ref (T4b1). */
  masterKey: Buffer;
  /** LTI service API client (T4b1). */
  lti: LtiClient;
  /** REF_TTL_SECONDS knob (default 86400): life of a registration URL. */
  refTtlSeconds: number;
  /** PICKER_TTL_SECONDS knob (default 3600): life of a content picker session (T4b2). */
  pickerTtlSeconds: number;
  /** PLAY_TTL_SECONDS knob (default 86400): life of a play session (T4b2). */
  playTtlSeconds: number;
  /** apps/player build folder (the shell script /_player/shell.js, T5a). */
  playerDir: string;
  /** Ask the score sync worker to send now (Resend, T5b). */
  kickSync?: () => void;
  /** T8: the Build Runner queue folder (BUILD_QUEUE_DIR) and the knobs passed to each build request. */
  buildQueueDir?: string;
  buildKnobs?: { hold: boolean; failAt: string };
  /** Guarded network access for channel extensions. */
  outbound: OutboundClient;
}

const TRACE_ID = /^[A-Za-z0-9-]{16,64}$/;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const JSON_BODY_LIMIT = 64 * 1024;

export async function buildAppApi(deps: AppApiDeps): Promise<FastifyInstance> {
  const now = deps.now ?? Date.now;
  const log = deps.logger;
  const limits: Limits = { ...DEFAULT_LIMITS, ...deps.limits };
  const app = Fastify({ logger: false, bodyLimit: JSON_BODY_LIMIT, return503OnClosing: false });
  await app.register(formbody, { bodyLimit: 8 * 1024 }); // /tool/register and /tool/picker forms
  await app.register(multipart, {
    throwFileSizeLimit: true,
    limits: { fileSize: limits.maxUploadBytes, files: 1, fields: 4, fieldSize: 1024, parts: 5, headerPairs: 100 },
  });

  app.decorateRequest('traceId', '');
  app.decorateRequest('auth', null);
  app.addHook('onRequest', async (req, reply) => {
    const given = req.headers['x-trace-id'];
    req.traceId = typeof given === 'string' && TRACE_ID.test(given) ? given : randomBytes(16).toString('hex');
    reply.header('x-trace-id', req.traceId);
  });
  // A-T4a-05: no response of the app is sniffed as another type (JSON holds untrusted report text).
  app.addHook('onSend', async (_req, reply) => {
    reply.header('x-content-type-options', 'nosniff');
  });
  app.addHook('onResponse', async (req, reply) => {
    // Route pattern (no ids, no query); a request without a route logs the redacted path.
    const path = req.routeOptions.url ?? redactPath(req.url.split('?')[0] ?? '/');
    log.log(path === '/healthz' ? 'debug' : 'info', 'http_request', {
      trace_id: req.traceId, method: req.method, path, status: reply.statusCode, ms: Math.round(reply.elapsedTime),
    });
  });

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, req, reply) => {
    if (err instanceof ApiErrorBase) return reply.code(err.status).send(err.body());
    if (err.code === 'FST_ERR_CTP_BODY_TOO_LARGE') return reply.code(413).send(apiErrorBody(413, 'INVALID_REQUEST', 'The JSON body is larger than 64 KB.'));
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.code(400).send(new ApiError('INVALID_REQUEST', 'The request cannot be read.').body());
    }
    log.error('internal_error', { trace_id: req.traceId, error: err.name });
    return reply.code(500).send(new ApiError('INTERNAL_ERROR', `Internal error. Trace id: ${req.traceId}`).body());
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send(new ApiError('NOT_FOUND', 'Unknown route.').body()));

  app.get('/healthz', async () => ({
    status: 'ok', service: 'cogniate-app', profile: deps.profile, knobs: deps.knobs, outbound_allowlist: deps.outboundAllowlist ?? [],
  }));

  // The ONE redemption and cleanup engine of every binding (app contract §4.7.1, §4.9).
  const engine = createRedemptionEngine({ channels: deps.channels, db: deps.db, lti: deps.lti, logger: log, now });
  const cleanup = createBindingCleanup({ db: deps.db, lti: deps.lti, logger: log, now });

  // Portal API. The hooks of this scope run only for its routes, before the body is read.
  await app.register(async (api) => {
    // CSRF (security §6): every write needs Origin = PUBLIC_APP_URL (also the login).
    api.addHook('onRequest', async (req) => {
      if (!WRITE_METHODS.has(req.method)) return;
      const origin = req.headers.origin;
      if (origin === deps.urls.app) return;
      log.warn('csrf_rejected', { trace_id: req.traceId, origin: typeof origin === 'string' ? origin.slice(0, 200) : null });
      throw new ApiError('ORIGIN_NOT_ALLOWED', 'This request must come from the Cogniate app.');
    });
    // Session (contract §1): every route except the public one needs the cookie.
    api.addHook('onRequest', async (req) => {
      if (req.routeOptions.config.public === true) return;
      const found = sessionOf(deps.db, req.headers.cookie, now());
      if (!found) throw new ApiError('NOT_SIGNED_IN', 'Sign in first.');
      req.auth = found;
    });
    api.addHook('onSend', async (_req, reply) => {
      reply.header('cache-control', 'no-store');
    });
    registerSessionRoutes(api, { db: deps.db, now });
    const extensions = { ...deps, now };
    registerCourseRoutes(api, { db: deps.db, logger: log, store: deps.store, limits, now, extensions });
    registerConnectionRoutes(api, { channels: deps.channels, db: deps.db, urls: deps.urls, masterKey: deps.masterKey, lti: deps.lti, logger: log, refTtlSeconds: deps.refTtlSeconds, now, engine, cleanup });
    // Deployment route dependencies share the common redemption engine.
    const providerDeps = {
      channels: deps.channels, db: deps.db, urls: deps.urls, masterKey: deps.masterKey, lti: deps.lti, logger: log, now,
      redeem: engine.redeem, connectionDto: (c: Parameters<typeof connectionJson>[0], libraryName: string) => connectionDto(deps.db, c, deps.urls, deps.masterKey, deps.channels, libraryName),
    };
    registerDeploymentRoutes(api, providerDeps);
    registerExtensionRoutes(api, extensions);
    registerPublicationRoutes(api, extensions);
    registerExporterRoutes(api, extensions);
    registerResultRoutes(api, { channels: deps.channels, db: deps.db, lti: deps.lti, logger: log, masterKey: deps.masterKey, now, ...(deps.kickSync ? { kickSync: deps.kickSync } : {}) });
    registerPlayStatusRoute(api, { channels: deps.channels, db: deps.db, now });
  }, { prefix: '/app-api' });

  // Tool pages (app contract §6): server-rendered, no cookies; their own headers and Origin rule.
  const pageDeps = { channels: deps.channels, db: deps.db, urls: deps.urls, logger: log, lti: deps.lti, masterKey: deps.masterKey, now };
  registerRegisterPages(app, pageDeps);
  registerLaunchPages(app, { ...pageDeps, pickerTtlSeconds: deps.pickerTtlSeconds, playTtlSeconds: deps.playTtlSeconds });
  registerPickerPages(app, pageDeps);
  registerPlayPages(app, { ...pageDeps, playerDir: deps.playerDir });
  registerPortal(app, { db: deps.db, now });

  return app;
}
