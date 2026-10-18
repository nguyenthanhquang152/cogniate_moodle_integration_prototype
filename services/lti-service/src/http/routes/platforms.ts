// Platforms admin API (contract §3.9, Bearer).
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../api-errors.ts';
import { checkPlatformUrls } from '../../lti/platform-rules.ts';
import type { Platform } from '../../store/platforms.ts';
import { PlatformExistsError, createPlatform, deletePlatform, getPlatform, listPlatforms, updatePlatform } from '../../store/platforms.ts';
import { activePublicKeyPem } from '../../store/tool-keys.ts';
import type { RouteContext } from '../context.ts';
import { invalid } from '../validation.ts';

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

export function registerPlatformRoutes(app: FastifyInstance, ctx: RouteContext): void {
  const view = (p: Platform) => ({
    id: p.id, url: p.issuer, clientId: p.clientId, name: p.name, authenticationEndpoint: p.authEndpoint,
    accesstokenEndpoint: p.tokenEndpoint, authConfig: { method: 'JWK_SET', key: p.jwksUrl },
    publicKey: activePublicKeyPem(ctx.db, p.toolAccountId), active: p.active, deploymentIds: p.deploymentIds,
    productFamilyCode: p.productFamilyCode,
  });

  app.get('/api/platforms', async (req) => {
    const { account } = ctx.auth(req, ['bearer']);
    const q = PlatformQuery.safeParse(req.query ?? {});
    if (!q.success) throw invalid(q.error);
    const filter = Object.fromEntries(Object.entries(q.data).filter(([, v]) => v !== undefined)) as { id?: string; url?: string; clientId?: string };
    return { platforms: listPlatforms(ctx.db, account.id, filter).map(view) };
  });

  app.post('/api/platforms', async (req, reply) => {
    const { account } = ctx.auth(req, ['bearer']);
    const parsed = PlatformCreate.safeParse(req.body ?? {});
    if (!parsed.success) throw invalid(parsed.error);
    const b = parsed.data;
    if (b.authConfig.method !== 'JWK_SET') throw new ApiError('UNSUPPORTED_AUTH_METHOD', 'Only authConfig.method JWK_SET is supported.');
    checkPlatformUrls({ url: b.url, authenticationEndpoint: b.authenticationEndpoint, accesstokenEndpoint: b.accesstokenEndpoint, jwksUrl: b.authConfig.key },
      { url: 'url', authenticationEndpoint: 'authenticationEndpoint', accesstokenEndpoint: 'accesstokenEndpoint', jwksUrl: 'authConfig.key' });
    try {
      const p = createPlatform(ctx.db, account.id, {
        issuer: b.url, clientId: b.clientId, name: b.name, authEndpoint: b.authenticationEndpoint, tokenEndpoint: b.accesstokenEndpoint,
        jwksUrl: b.authConfig.key, deploymentIds: b.deploymentIds, active: b.active ?? true, productFamilyCode: b.productFamilyCode ?? null,
      });
      return reply.code(201).send(view(p));
    } catch (err) {
      if (err instanceof PlatformExistsError) throw new ApiError('PLATFORM_ALREADY_EXISTS', 'A platform with this issuer and client id exists.');
      throw err;
    }
  });

  app.get<{ Params: { id: string } }>('/api/platforms/:id', async (req) => {
    const { account } = ctx.auth(req, ['bearer']);
    const p = getPlatform(ctx.db, account.id, req.params.id);
    if (!p) throw new ApiError('UNREGISTERED_PLATFORM', 'Unknown platform id.');
    return view(p);
  });

  app.delete<{ Params: { id: string } }>('/api/platforms/:id', async (req, reply) => {
    const { account } = ctx.auth(req, ['bearer']);
    if (!deletePlatform(ctx.db, account.id, req.params.id)) throw new ApiError('UNREGISTERED_PLATFORM');
    return reply.code(204).send();
  });

  app.patch<{ Params: { id: string } }>('/api/platforms/:id', async (req) => {
    const { account } = ctx.auth(req, ['bearer']);
    const parsed = PlatformPatch.safeParse(req.body ?? {});
    if (!parsed.success) throw invalid(parsed.error);
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)) as { name?: string; active?: boolean; deploymentIds?: string[] };
    const p = updatePlatform(ctx.db, account.id, req.params.id, patch);
    if (!p) throw new ApiError('UNREGISTERED_PLATFORM', 'Unknown platform id.');
    return view(p);
  });
}
