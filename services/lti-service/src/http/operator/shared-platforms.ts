import { storeFor } from '../../store/index.ts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { checkSharedPlatform } from '../../accounts/shared-platforms.ts';

import { siteOriginOf } from '../../store/platforms.ts';

import { invalid } from '../validation.ts';
import type { OperatorContext } from './index.ts';

const Body = z.object({ profile: z.string().min(1).max(64), clientId: z.string().regex(/^[\x21-\x7e]{1,255}$/), name: z.string().min(1).max(255).optional() }).strict();

export function registerSharedPlatformRoutes(app: FastifyInstance, ctx: OperatorContext): void {
  app.post<{ Params: { id: string } }>('/operator/v1/accounts/:id/shared-platforms', async (req, reply) =>
    (await ctx.audited(req, { action: 'platform.create_shared', toolAccountId: req.params.id, target: { type: 'platform', id: null } }, async (audit) => {
      (await storeFor(ctx.db).accounts.requireWritableAccount(req.params.id)); // 404 / closed before body validation; repeated in the change
      const parsed = Body.safeParse(req.body);
      if (!parsed.success) throw invalid(parsed.error);
      (await checkSharedPlatform(ctx.db, { simulation: ctx.simulationProfiles }, { account: req.params.id, ...parsed.data }));
      const result = (await audit.provisionSharedPlatform({ simulation: ctx.simulationProfiles }, { account: req.params.id, ...parsed.data }));
      const p = result.platform;
      if (result.created) ctx.logger.info('platform_created', { platform_id: p.id, profile: p.profile, trace_id: req.traceId });
      return reply.code(result.created ? 201 : 200).send({
        id: p.id, url: p.issuer, clientId: p.clientId, name: p.name, authenticationEndpoint: p.authEndpoint,
        accesstokenEndpoint: p.tokenEndpoint, authConfig: { method: 'JWK_SET', key: p.jwksUrl },
        publicKey: (await storeFor(ctx.db).toolKeys.activePublicKeyPem(p.toolAccountId)), active: p.active, deploymentIds: p.deploymentIds, productFamilyCode: p.productFamilyCode,
        profile: p.profile, siteUrl: p.siteUrl, serviceUrl: p.serviceUrl, bindingRef: p.bindingRef,
        deployments: p.deployments.map((d) => ({ deploymentId: d.deploymentId, siteUrl: siteOriginOf(p, d), active: d.active, bindingGeneration: d.bindingGeneration, bindingRef: d.bindingRef })),
      });
    })));
}
