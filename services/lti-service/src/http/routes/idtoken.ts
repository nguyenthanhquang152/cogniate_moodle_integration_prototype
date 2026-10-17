// GET /api/idtoken (contract §3.1, LTIK-AUTH-V2). T3a: services.serviceKey when AGS or NRPS is available (§3.3).
import type { FastifyInstance } from 'fastify';
import { ApiError } from '../../api-errors.ts';
import { toIdToken } from '../../lti/idtoken.ts';
import { getPlatform } from '../../store/platforms.ts';
import type { RouteContext } from '../context.ts';
import { serviceKeyForLaunch } from '../../lti/service-keys.ts';

export function registerIdTokenRoutes(app: FastifyInstance, ctx: RouteContext): void {
  app.get<{ Querystring: { raw?: string } }>('/api/idtoken', async (req) => {
    const { account, launch } = ctx.auth(req, ['ltik']);
    const platform = getPlatform(ctx.db, account.id, launch!.platformId);
    if (!platform) throw new ApiError('INVALID_LTIK_AUTH_AUTHORIZATION_HEADER', 'Invalid or expired ltik.');
    if (!platform.active) throw new ApiError('PLATFORM_NOT_ACTIVE', 'The platform is not active.');
    if (req.query.raw === 'true') return launch!.claims;
    return toIdToken(launch!, platform, serviceKeyForLaunch(ctx.db, ctx.masterKey, launch!, ctx.now()));
  });
}
