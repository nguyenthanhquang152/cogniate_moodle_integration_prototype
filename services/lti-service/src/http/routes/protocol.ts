// Protocol endpoints for Moodle and the browser (contract §2.1-§2.3): tool JWKS, OIDC login, launch (redirect URI).
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../../api-errors.ts';
import { handleLaunch } from '../../lti/launch.ts';
import { initiateLogin } from '../../lti/login.ts';
import { lmsNameOf } from '../../profiles/index.ts';
import { getAccount } from '../../store/accounts.ts';
import { publicJwks } from '../../store/tool-keys.ts';
import type { RouteContext } from '../context.ts';

export function registerProtocolRoutes(app: FastifyInstance, ctx: RouteContext): void {
  const log = ctx.logger;

  // Tool JWKS (contract §2.3)
  app.get<{ Params: { account: string } }>('/lti/keys/:account', async (req, reply) => {
    if (!getAccount(ctx.db, req.params.account)) throw new ApiError('NOT_FOUND', 'Unknown tool account.');
    return reply.header('cache-control', 'public, max-age=300').send({ keys: publicJwks(ctx.db, req.params.account, ctx.now()) });
  });

  // OIDC login initiation (contract §2.1)
  const login = async (req: FastifyRequest<{ Params: { account: string } }>, reply: FastifyReply) => {
    const params = (req.method === 'GET' ? req.query : req.body) as Record<string, unknown> | undefined;
    const result = initiateLogin(ctx.db, ctx.urls, req.params.account, params ?? {}, ctx.now(), ctx.profiles);
    if (!result.ok) {
      log.warn('login_rejected', { trace_id: req.traceId, code: result.code, detail: result.detail });
      return ctx.errorPage(reply, req, result.code, { lms: result.lms });
    }
    if (result.page) return reply.code(result.page.status).headers({ ...result.page.headers, 'set-cookie': result.setCookie }).send(result.page.html);
    return reply.code(302).headers({ location: result.location, 'set-cookie': result.setCookie, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }).send();
  };
  app.get('/lti/login/:account', login);
  app.post('/lti/login/:account', login);

  // Launch / redirect URI (contract §2.2)
  app.post<{ Params: { account: string } }>('/lti/launch/:account', async (req, reply) => {
    const form = (req.body ?? {}) as Record<string, unknown>;
    const result = await handleLaunch({ db: ctx.db, urls: ctx.urls, keys: ctx.keys, ltikTtlSeconds: ctx.ltikTtlSeconds, now: ctx.now, profiles: ctx.profiles, logger: log },
      req.params.account, form, req.headers.cookie, req.traceId);
    if (!result.ok) {
      log.warn('launch_check_failed', { trace_id: req.traceId, check: result.check, code: result.code, detail: result.detail });
      if (result.clearCookie) reply.header('set-cookie', result.clearCookie);
      return ctx.errorPage(reply, req, result.code, {
        ...(result.help ? { help: result.help } : {}),
        ...(result.oidcError ? { detail: result.oidcError } : {}),
        lms: result.lms,
      });
    }
    // Contract §9.8: the removed claim names only, never a value.
    if (result.removedClaims.length > 0) log.info('launch_claims_minimized', { trace_id: req.traceId, platform_id: result.platformId, claims: result.removedClaims });
    log.info('launch_accepted', { trace_id: req.traceId, platform_id: result.platformId, message_type: result.messageType });
    return reply.code(303).headers({ location: result.location, 'set-cookie': result.clearCookie, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }).send();
  });
  app.get('/lti/launch/:account', async (req, reply) => {
    reply.header('allow', 'POST');
    return ctx.errorPage(reply, req, 'METHOD_NOT_ALLOWED', { lms: lmsNameOf(null, ctx.profiles) });
  });
}
