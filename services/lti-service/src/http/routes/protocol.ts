// Protocol endpoints for Moodle and the browser (contract §2.1-§2.3): tool JWKS, OIDC login, launch (redirect URI).
import type { FastifyInstance, FastifyReply, FastifyRequest, HTTPMethods } from 'fastify';
import { ApiError } from '../../api-errors.ts';
import { createAccountResolver } from '../../accounts/resolver.ts';
import type { LaunchResult } from '../../lti/launch.ts';
import { handleLaunch, handleStorageCheck } from '../../lti/launch.ts';
import { initiateLogin } from '../../lti/login.ts';
import { lmsNameOf } from '../../profiles/index.ts';
import { publicJwks } from '../../store/tool-keys.ts';
import type { RouteContext } from '../context.ts';

export function registerProtocolRoutes(app: FastifyInstance, ctx: RouteContext): void {
  const log = ctx.logger;
  const resolver = createAccountResolver(ctx.db, ctx.urls.lti);

  // Tool JWKS (contract §2.3)
  app.get<{ Params: { account: string } }>('/lti/keys/:account', async (req, reply) => {
    const account = resolver.resolveAccount(req);
    if (!account || account.status === 'closed') throw new ApiError('NOT_FOUND', 'Unknown tool account.');
    return reply.header('cache-control', 'public, max-age=300').send({ keys: publicJwks(ctx.db, account.id, ctx.now()) });
  });

  // OIDC login initiation (contract §2.1)
  const login = async (req: FastifyRequest<{ Params: { account: string } }>, reply: FastifyReply) => {
    const params = (req.method === 'GET' ? req.query : req.body) as Record<string, unknown> | undefined;
    const result = initiateLogin(ctx.db, ctx.urls, req.params.account, params ?? {}, ctx.now(), ctx.profiles);
    if (!result.ok) {
      log.warn('login_rejected', { trace_id: req.traceId, ...result.logIds, code: result.code, detail: result.detail });
      return ctx.errorPage(reply, req, result.code, { lms: result.lms });
    }
    if (result.page) return reply.code(result.page.status).headers({ ...result.page.headers, 'set-cookie': result.setCookie }).send(result.page.html);
    return reply.code(302).headers({ location: result.location, 'set-cookie': result.setCookie, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }).send();
  };
  app.get('/lti/login/:account', login);
  app.post('/lti/login/:account', login);

  // Both browser bindings share failure rendering and the accepted-launch response.
  const sendLaunch = (req: FastifyRequest, reply: FastifyReply, result: LaunchResult) => {
    if (!result.ok) {
      log.warn('launch_check_failed', { trace_id: req.traceId, ...result.logIds, check: result.check, code: result.code, detail: result.detail });
      if (result.clearCookie) reply.header('set-cookie', result.clearCookie);
      return ctx.errorPage(reply, req, result.code, {
        ...(result.help ? { help: result.help } : {}),
        ...(result.oidcError ? { detail: result.oidcError } : {}),
        ...(result.status ? { status: result.status } : {}),
        lms: result.lms,
      });
    }
    if (result.kind === 'storage') return reply.code(200).headers({ ...result.page.headers, 'set-cookie': result.clearCookie }).send(result.page.html);
    // Contract §9.8: the removed claim names only, never a value.
    if (result.removedClaims.length > 0) log.info('launch_claims_minimized', { trace_id: req.traceId, tool_account_id: result.toolAccountId, platform_id: result.platformId, claims: result.removedClaims });
    log.info('launch_accepted', { trace_id: req.traceId, tool_account_id: result.toolAccountId, platform_id: result.platformId, message_type: result.messageType, binding: result.binding });
    return reply.code(303).headers({ location: result.location, 'set-cookie': result.clearCookie, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }).send();
  };
  const deps = { db: ctx.db, urls: ctx.urls, keys: ctx.keys, ltikTtlSeconds: ctx.ltikTtlSeconds, now: ctx.now, profiles: ctx.profiles, logger: log };
  // Launch / redirect URI (contract §2.2)
  app.post<{ Params: { account: string } }>('/lti/launch/:account', async (req, reply) => {
    const result = await handleLaunch(deps, req.params.account, (req.body ?? {}) as Record<string, unknown>, req.headers.cookie, req.traceId);
    return sendLaunch(req, reply, result);
  });
  app.post<{ Params: { account: string } }>('/lti/launch/:account/storage-check', async (req, reply) => {
    return sendLaunch(req, reply, handleStorageCheck(deps, req.params.account, (req.body ?? {}) as Record<string, unknown>, req.headers.origin));
  });
  app.route({
    method: app.supportedMethods.filter((method) => method !== 'POST') as HTTPMethods[],
    url: '/lti/launch/:account/storage-check',
    handler: async (req, reply) => {
      reply.header('allow', 'POST');
      return ctx.errorPage(reply, req, 'METHOD_NOT_ALLOWED', { lms: lmsNameOf(null, ctx.profiles) });
    },
  });
  app.get('/lti/launch/:account', async (req, reply) => {
    reply.header('allow', 'POST');
    return ctx.errorPage(reply, req, 'METHOD_NOT_ALLOWED', { lms: lmsNameOf(null, ctx.profiles) });
  });
}
