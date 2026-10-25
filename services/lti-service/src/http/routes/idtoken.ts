// GET /api/idtoken (contract §3.1, LTIK-AUTH-V2). T3a: services.serviceKey when AGS or NRPS is available (§3.3).
// M1: the binding checks of §9.14 run first (no service key is issued for an old generation or an inactive deployment).
import type { FastifyInstance } from 'fastify';
import { toIdToken } from '../../lti/idtoken.ts';
import { serviceKeyForLaunch } from '../../lti/service-keys.ts';
import type { RouteContext } from '../context.ts';
import { platformOf } from '../service-context.ts';

export function registerIdTokenRoutes(app: FastifyInstance, ctx: RouteContext): void {
  app.get<{ Querystring: { raw?: string } }>('/api/idtoken', async (req) => {
    const caller = (await ctx.auth(req, ['ltik']));
    const platform = (await platformOf(ctx, caller));
    const launch = caller.launch!;
    if (req.query.raw === 'true') return launch.claims;
    return toIdToken(launch, platform, (await serviceKeyForLaunch(ctx.db, ctx.masterKey, launch, ctx.now())));
  });
}
