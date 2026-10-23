// Platforms admin API (contract §3.9, Bearer) with the M1 provider profiles (§9.3 to §9.6, §9.15).
import { canonicalOrigin } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../api-errors.ts';
import { BINDING_REF, DEPLOYMENT_ID, checkPlatformUrls, checkProfileSiteUrl, checkRotation } from '../../lti/platform-rules.ts';
import type { ProviderProfile } from '../../profiles/index.ts';
import {
  fillTemplate, findProfile, isSharedProfile, isStandardProfile, listProfiles, profileDefinition, profileEndpoints, reservedIssuerOrigins, siteRulesFor,
} from '../../profiles/index.ts';
import type { DeploymentRecord, NewPlatform, Platform, RefCondition } from '../../store/platforms.ts';
import {
  BindingRefMismatchError, DeploymentExistsError, PlatformExistsError, SharedPlatformExistsError, SharedPlatformInUseError, UnknownDeploymentError,
  addDeployment, changeDeployment, createPlatform, deletePlatform, findSharedPlatform, getPlatform, listPlatforms, siteOriginOf, updatePlatform,
} from '../../store/platforms.ts';
import { activePublicKeyPem } from '../../store/tool-keys.ts';
import type { RouteContext } from '../context.ts';
import { invalid } from '../validation.ts';

const url = z.string().min(1).max(2048);
const ref = z.string().regex(BINDING_REF, '1 to 64 characters [A-Za-z0-9_-]');

/** Every field that a create may have; the per-profile rules below decide which are required or allowed. */
const PlatformCreateBase = z.object({
  url: url.optional(),
  clientId: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  authenticationEndpoint: url.optional(),
  accesstokenEndpoint: url.optional(),
  authConfig: z.object({ method: z.string(), key: z.string().min(1).max(2048) }).optional(),
  deploymentIds: z.array(z.string().min(1).max(255)).max(100).optional(),
  active: z.boolean().optional(),
  productFamilyCode: z.string().max(64).optional(),
  profile: z.string().min(1).max(64).optional(),
  siteUrl: url.optional(),
  serviceUrl: url.optional(),
  bindingRef: ref.optional(),
});
type CreateBody = z.infer<typeof PlatformCreateBase>;

/** `standard`: the body of §3.9 (unchanged required fields). */
const StandardCreate = z.object({
  url: url, clientId: z.string().min(1).max(255), name: z.string().min(1).max(255), authenticationEndpoint: url, accesstokenEndpoint: url,
  authConfig: z.object({ method: z.string(), key: z.string().min(1).max(2048) }), deploymentIds: z.array(z.string().min(1).max(255)).min(1).max(100),
});

const PlatformPatch = z.object({
  name: z.string().min(1).max(255).optional(),
  active: z.boolean().optional(),
  deploymentIds: z.array(z.string().min(1).max(255)).min(1).max(100).optional(),
  bindingRef: ref.optional(),
  ifBindingRef: ref.nullable().optional(),
});

const PlatformQuery = z.object({ id: z.string().optional(), url: z.string().optional(), clientId: z.string().optional(), profile: z.string().optional() });

const DeploymentCreate = z.object({
  deploymentId: z.string().regex(DEPLOYMENT_ID, '1 to 255 printable ASCII characters without a space'),
  siteUrl: url.optional(),
  active: z.boolean().optional(),
  bindingRef: ref.optional(),
});

const DeploymentPatch = z.object({
  active: z.boolean().optional(),
  siteUrl: url.optional(),
  bindingRef: ref.optional(),
  ifBindingRef: ref.nullable().optional(),
});

const bad = (field: string) => new ApiError('INVALID_REQUEST', `Invalid field: ${field}.`);

export function registerPlatformRoutes(app: FastifyInstance, ctx: RouteContext): void {
  const ownOrigins = [ctx.urls.lti, ctx.urls.app, ctx.urls.content];

  const deploymentView = (p: Platform, d: DeploymentRecord) => ({
    deploymentId: d.deploymentId, siteUrl: siteOriginOf(p, d), active: d.active, bindingGeneration: d.bindingGeneration, bindingRef: d.bindingRef,
  });
  const view = (p: Platform) => ({
    id: p.id, url: p.issuer, clientId: p.clientId, name: p.name, authenticationEndpoint: p.authEndpoint,
    accesstokenEndpoint: p.tokenEndpoint, authConfig: { method: 'JWK_SET', key: p.jwksUrl },
    publicKey: activePublicKeyPem(ctx.db, p.toolAccountId), active: p.active, deploymentIds: p.deploymentIds,
    productFamilyCode: p.productFamilyCode,
    // M1 (§9.4)
    profile: p.profile, siteUrl: p.siteUrl, serviceUrl: p.serviceUrl, bindingRef: p.bindingRef, deployments: p.deployments.map((d) => deploymentView(p, d)),
  });

  /** §3.9 and §2.4 for `standard`, plus the reserved issuers (§9.4). */
  function planStandard(raw: CreateBody): NewPlatform {
    const parsed = StandardCreate.safeParse(raw);
    if (!parsed.success) throw invalid(parsed.error);
    if (raw.siteUrl !== undefined) throw bad('siteUrl');
    if (raw.serviceUrl !== undefined) throw bad('serviceUrl');
    const b = parsed.data;
    if (b.authConfig.method !== 'JWK_SET') throw new ApiError('UNSUPPORTED_AUTH_METHOD', 'Only authConfig.method JWK_SET is supported.');
    checkPlatformUrls({ url: b.url, authenticationEndpoint: b.authenticationEndpoint, accesstokenEndpoint: b.accesstokenEndpoint, jwksUrl: b.authConfig.key },
      { url: 'url', authenticationEndpoint: 'authenticationEndpoint', accesstokenEndpoint: 'accesstokenEndpoint', jwksUrl: 'authConfig.key' });
    if (reservedIssuerOrigins(ctx.profiles).includes(new URL(b.url).origin)) throw new ApiError('ISSUER_RESERVED', 'This issuer belongs to a hosted LMS profile. Use that profile.');
    return {
      issuer: b.url, clientId: b.clientId, name: b.name, authEndpoint: b.authenticationEndpoint, tokenEndpoint: b.accesstokenEndpoint,
      jwksUrl: b.authConfig.key, deploymentIds: b.deploymentIds, active: raw.active ?? true, productFamilyCode: raw.productFamilyCode ?? null,
      profile: 'standard', bindingRef: raw.bindingRef ?? null,
    };
  }

  /** §9.4 for every profile other than `standard`: fixed values, site rules, sharing rules. */
  function planProvider(b: CreateBody, profile: ProviderProfile): NewPlatform {
    const shared = isSharedProfile(profile);
    if (shared) {
      if (b.deploymentIds !== undefined && b.deploymentIds.length > 0) throw bad('deploymentIds');
      if (b.siteUrl !== undefined) throw bad('siteUrl');
      if (b.serviceUrl !== undefined) throw bad('serviceUrl');
      if (b.active === false) throw bad('active');
    } else {
      if (b.siteUrl === undefined) throw bad('siteUrl');
      if (b.deploymentIds === undefined || b.deploymentIds.length < 1) throw bad('deploymentIds');
      if (b.serviceUrl !== undefined && !profile.serviceUrl) throw bad('serviceUrl');
    }
    if (b.authConfig && b.authConfig.method !== 'JWK_SET') throw new ApiError('UNSUPPORTED_AUTH_METHOD', 'Only authConfig.method JWK_SET is supported.');
    // Sent URLs must equal the filled profile values. A value built from an invalid site URL is not compared here:
    // the site rules below refuse that input.
    const site = b.siteUrl !== undefined ? canonicalOrigin(b.siteUrl) : null;
    const service = b.serviceUrl !== undefined ? canonicalOrigin(b.serviceUrl) : site;
    const vars = { siteUrl: site?.ok ? site.origin : null, serviceUrl: service?.ok ? service.origin : null, clientId: b.clientId };
    const sent: Array<[string, string | undefined, string | null]> = [
      ['url', b.url, profile.issuer], ['authenticationEndpoint', b.authenticationEndpoint, profile.authenticationEndpoint],
      ['accesstokenEndpoint', b.accesstokenEndpoint, profile.accesstokenEndpoint], ['authConfig.key', b.authConfig?.key, profile.jwksUrl],
    ];
    for (const [field, value, template] of sent) {
      if (value === undefined || template === null) continue;
      let expected: string;
      try {
        expected = fillTemplate(template, vars);
      } catch {
        continue;
      }
      if (value !== expected) throw new ApiError('PLATFORM_URL_NOT_IN_PROFILE', `${field} is not the value of profile ${profile.id}.`);
    }
    const rules = siteRulesFor(profile, ownOrigins, ctx.profiles);
    const siteUrl = b.siteUrl !== undefined ? checkProfileSiteUrl('siteUrl', b.siteUrl, rules) : null;
    const serviceUrl = b.serviceUrl !== undefined ? checkProfileSiteUrl('serviceUrl', b.serviceUrl, rules) : siteUrl;
    const e = profileEndpoints(profile, { siteUrl, serviceUrl, clientId: b.clientId });
    return {
      issuer: e.issuer, clientId: b.clientId, name: b.name, authEndpoint: e.authenticationEndpoint, tokenEndpoint: e.accesstokenEndpoint, jwksUrl: e.jwksUrl,
      deploymentIds: b.deploymentIds ?? [], active: b.active ?? true, productFamilyCode: b.productFamilyCode ?? null, profile: profile.id,
      siteUrl: profile.siteUrlOn === 'platform' ? siteUrl : null, serviceUrl: profile.siteUrlOn === 'platform' ? serviceUrl : null,
      bindingRef: b.bindingRef ?? null, shared,
    };
  }

  app.get('/api/platforms', async (req) => {
    const { account } = ctx.auth(req, ['bearer']);
    const q = PlatformQuery.safeParse(req.query ?? {});
    if (!q.success) throw invalid(q.error);
    const filter = Object.fromEntries(Object.entries(q.data).filter(([, v]) => v !== undefined)) as { id?: string; url?: string; clientId?: string; profile?: string };
    return { platforms: listPlatforms(ctx.db, account.id, filter).map(view) };
  });

  app.post('/api/platforms', async (req, reply) => {
    const { account } = ctx.auth(req, ['bearer']);
    const parsed = PlatformCreateBase.safeParse(req.body ?? {});
    // Keep the §3.9 field error of a standard body (for example a missing url).
    if (!parsed.success) {
      const raw = (req.body ?? {}) as { profile?: unknown };
      if (raw.profile === undefined || raw.profile === 'standard') {
        const std = StandardCreate.safeParse(req.body ?? {});
        if (!std.success) throw invalid(std.error);
      }
      throw invalid(parsed.error);
    }
    const b = parsed.data;
    const profile = findProfile(b.profile ?? 'standard', ctx.profiles);
    if (!profile) throw new ApiError('UNKNOWN_PROFILE', `Unknown provider profile: ${b.profile}.`);
    const plan = isStandardProfile(profile) ? planStandard(b) : planProvider(b, profile);
    try {
      const p = createPlatform(ctx.db, account.id, plan);
      if (!isStandardProfile(profile)) ctx.logger.info('platform_created', { trace_id: req.traceId, platform_id: p.id, profile: p.profile });
      return reply.code(201).send(view(p));
    } catch (err) {
      if (err instanceof SharedPlatformExistsError) throw new ApiError('SHARED_PLATFORM_EXISTS', `This account already has a ${profile.id} platform.`);
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

  app.delete<{ Params: { id: string }; Querystring: { ifBindingRef?: string } }>('/api/platforms/:id', async (req, reply) => {
    const { account } = ctx.auth(req, ['bearer']);
    const current = getPlatform(ctx.db, account.id, req.params.id);
    if (!current) throw new ApiError('UNREGISTERED_PLATFORM');
    const condition: RefCondition = typeof req.query.ifBindingRef === 'string' ? req.query.ifBindingRef : undefined;
    try {
      if (!deletePlatform(ctx.db, account.id, req.params.id, { ifBindingRef: condition, shared: profileDefinition(current.profile)?.sharing === 'shared' })) {
        throw new ApiError('UNREGISTERED_PLATFORM');
      }
    } catch (err) {
      if (err instanceof BindingRefMismatchError) throw new ApiError('BINDING_REF_MISMATCH');
      if (err instanceof SharedPlatformInUseError) throw new ApiError('SHARED_PLATFORM_IN_USE');
      throw err;
    }
    ctx.logger.info('platform_deleted', { trace_id: req.traceId, platform_id: req.params.id });
    return reply.code(204).send();
  });

  app.patch<{ Params: { id: string } }>('/api/platforms/:id', async (req) => {
    const { account } = ctx.auth(req, ['bearer']);
    const parsed = PlatformPatch.safeParse(req.body ?? {});
    if (!parsed.success) throw invalid(parsed.error);
    const current = getPlatform(ctx.db, account.id, req.params.id);
    if (!current) throw new ApiError('UNREGISTERED_PLATFORM', 'Unknown platform id.');
    if (parsed.data.deploymentIds !== undefined && profileDefinition(current.profile)?.sharing === 'shared') {
      throw new ApiError('SHARED_PLATFORM_DEPLOYMENTS');
    }
    checkRotation(parsed.data);
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)) as Parameters<typeof updatePlatform>[3];
    let p: Platform | null;
    try {
      p = updatePlatform(ctx.db, account.id, req.params.id, patch);
    } catch (err) {
      if (err instanceof BindingRefMismatchError) throw new ApiError('BINDING_REF_MISMATCH');
      throw err;
    }
    if (!p) throw new ApiError('UNREGISTERED_PLATFORM', 'Unknown platform id.');
    return view(p);
  });

  // ---------------------------------------------------------------- deployments (§9.5, §9.6)
  app.post<{ Params: { id: string } }>('/api/platforms/:id/deployments', async (req, reply) => {
    const { account } = ctx.auth(req, ['bearer']);
    const parsed = DeploymentCreate.safeParse(req.body ?? {});
    if (!parsed.success) throw invalid(parsed.error);
    const b = parsed.data;
    const platform = getPlatform(ctx.db, account.id, req.params.id);
    if (!platform) throw new ApiError('UNREGISTERED_PLATFORM', 'Unknown platform id.');
    const def = profileDefinition(platform.profile);
    const active = b.active ?? true;
    let siteUrl: string | null = null;
    let generation = 0;
    if (!def || isStandardProfile(def)) {
      if (b.siteUrl !== undefined) throw bad('siteUrl');
    } else if (isSharedProfile(def)) {
      if (b.siteUrl === undefined) throw bad('siteUrl');
      siteUrl = checkProfileSiteUrl('siteUrl', b.siteUrl, siteRulesFor(def, ownOrigins, ctx.profiles));
      generation = active ? 1 : 0;
    } else if (b.siteUrl !== undefined) {
      // Canvas profiles: absent, or equal to the platform site URL.
      const c = canonicalOrigin(b.siteUrl);
      if (!c.ok || c.origin !== platform.siteUrl) throw new ApiError('INVALID_SITE_URL', 'Invalid field: siteUrl must be the platform site URL.', { details: { rule: 1, field: 'siteUrl' } });
    }
    let d: DeploymentRecord | null;
    try {
      d = addDeployment(ctx.db, account.id, platform.id, { deploymentId: b.deploymentId, siteUrl, active, bindingGeneration: generation, bindingRef: b.bindingRef ?? null });
    } catch (err) {
      if (err instanceof DeploymentExistsError) throw new ApiError('DEPLOYMENT_ALREADY_EXISTS');
      throw err;
    }
    if (!d) throw new ApiError('UNREGISTERED_PLATFORM', 'Unknown platform id.');
    ctx.logger.info('deployment_added', { trace_id: req.traceId, platform_id: platform.id, deployment_id: d.deploymentId });
    return reply.code(201).send(deploymentView(getPlatform(ctx.db, account.id, platform.id)!, d));
  });

  app.patch<{ Params: { id: string; deploymentId: string } }>('/api/platforms/:id/deployments/:deploymentId', async (req) => {
    const { account } = ctx.auth(req, ['bearer']);
    const parsed = DeploymentPatch.safeParse(req.body ?? {});
    if (!parsed.success) throw invalid(parsed.error);
    const b = parsed.data;
    if (b.active === undefined && b.bindingRef === undefined) throw new ApiError('INVALID_REQUEST', 'Invalid field: active (send active or bindingRef).');
    checkRotation(b);
    let d: DeploymentRecord | null;
    try {
      d = changeDeployment(ctx.db, account.id, req.params.id, req.params.deploymentId, b.ifBindingRef, (cur, platform) => {
        const def = profileDefinition(platform.profile);
        const shared = def !== null && isSharedProfile(def);
        const newRef = b.bindingRef !== undefined && b.bindingRef !== cur.bindingRef;
        // A new binding of a shared deployment: an activation, or an adoption of an active row with a new ref.
        const newBinding = shared && b.active === true && (!cur.active || newRef);
        if (b.siteUrl !== undefined && !newBinding) throw bad('siteUrl');
        const next = { active: cur.active, siteUrl: cur.siteUrl, bindingGeneration: cur.bindingGeneration, bindingRef: b.bindingRef ?? cur.bindingRef };
        if (b.active === false) next.active = false;
        else if (newBinding) {
          next.active = true;
          next.bindingGeneration = cur.bindingGeneration + 1;
          if (b.siteUrl !== undefined) next.siteUrl = checkProfileSiteUrl('siteUrl', b.siteUrl, siteRulesFor(def, ownOrigins, ctx.profiles));
        } else if (b.active === true && !shared) next.active = true;
        return next;
      });
    } catch (err) {
      if (err instanceof UnknownDeploymentError) throw new ApiError('UNKNOWN_DEPLOYMENT');
      if (err instanceof BindingRefMismatchError) throw new ApiError('BINDING_REF_MISMATCH');
      throw err;
    }
    if (!d) throw new ApiError('UNREGISTERED_PLATFORM', 'Unknown platform id.');
    ctx.logger.info('deployment_updated', { trace_id: req.traceId, platform_id: req.params.id, deployment_id: d.deploymentId, active: d.active, binding_generation: d.bindingGeneration });
    return deploymentView(getPlatform(ctx.db, account.id, req.params.id)!, d);
  });

  // ---------------------------------------------------------------- providers (§9.3)
  app.get('/api/providers', async (req) => {
    const { account } = ctx.auth(req, ['bearer']);
    return {
      profiles: listProfiles(ctx.profiles).map((p) => {
        const shared = isSharedProfile(p) ? findSharedPlatform(ctx.db, account.id, p.id) : null;
        return {
          id: p.id, lms: p.lms, label: p.label, sharing: p.sharing, issuer: p.issuer, authenticationEndpoint: p.authenticationEndpoint,
          accesstokenEndpoint: p.accesstokenEndpoint, jwksUrl: p.jwksUrl, siteUrlOn: p.siteUrlOn, serviceUrl: p.serviceUrl, simulation: p.simulation,
          sharedPlatform: shared ? { id: shared.id, clientId: shared.clientId, active: shared.active } : null,
        };
      }),
    };
  });
}
