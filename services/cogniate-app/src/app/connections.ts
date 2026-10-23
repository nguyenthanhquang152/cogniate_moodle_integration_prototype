import type { ChannelRegistry } from '@cogniate/channel-kernel';
// Connections (app contract §4, M1 §4.2 to §4.7): connect a Moodle site by dynamic or manual registration, or a Canvas
// or Blackboard site with an operator approval grant (the common redemption engine). Every lookup uses the session
// user's library: a connection of another library gives 404 NOT_FOUND.
import { randomToken, sha256Hex } from '@cogniate/shared';
import { REF_COPY_COLUMN, appAad, openText, sealText } from './sealing.ts';
import type { Logger, PublicUrls } from '@cogniate/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { LtiClient } from '../clients/lti-client.ts';
import type { Connection, RefToken } from '../domain/connections.ts';
import {
  createConnection, getConnection, listConnections, replaceRef,
} from '../domain/connections.ts';
import { approvalsOfConnection } from '../domain/bindings.ts';
import type { Db } from '../domain/db.ts';
import { transaction } from '../domain/db.ts';
import { checkSiteUrl, fixedHostsOf, originHost } from '@cogniate/shared';
import { ownedProfiles, servedByKernel, setupOf } from '../kernel/setup.ts';
import { usableProfileRow } from '../kernel/setup/admin-value.ts';
import type { BindingCleanup } from './binding-cleanup.ts';
import { activeShared, providerProfiles, snapshotOf, stagedRegistration } from './binding-targets.ts';
import type { RedemptionEngine } from './redemption.ts';
import { toolContext, toolUrls } from '../kernel/setup/common.ts';
import { toolName } from '@cogniate/channel-kernel/setup';
import { authorityFor } from '../kernel/authority/index.ts';
import { registerErrorText } from '../tool-pages/register-texts.ts';
import { ApiError, providerNotReady } from './api-errors.ts';


export interface ConnectionDeps {
  channels: ChannelRegistry;
  db: Db;
  urls: PublicUrls;
  masterKey: Buffer;
  lti: LtiClient;
  logger: Logger;
  refTtlSeconds: number;
  now: () => number;
  /** M1: the common redemption engine and the cleanup owners (app contract §4.7). */
  engine?: RedemptionEngine;
  cleanup?: BindingCleanup;
}

const iso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString());

/**
 * A new registration ref (43 characters, 256 bits): the URL holds it, the table its hash and a sealed copy. LA-E5-22:
 * the copy is bound to the library and to its hash (the row key; the ref is made before the connection has an id).
 */
export function newRef(masterKey: Buffer, libraryId: string, ttlSeconds: number, now: number): { token: string; stored: RefToken } {
  const token = randomToken();
  const hash = sha256Hex(token);
  return { token, stored: { hash, encrypted: sealText(masterKey, token, appAad(REF_COPY_COLUMN, libraryId, hash)), expiresAt: now + ttlSeconds * 1000 } };
}

export const registrationUrl = (urls: PublicUrls, ref: string): string => `${toolUrls(urls).register}?ref=${ref}`;


/**
 * The connection DTO (app contract §4, §4.2). `libraryName` fills the tool name into a lastError action line.
 * `approvedDeploymentIds`: Canvas and Blackboard list only deployments with a committed approval (connectionDto). A
 * pending staged registration lists the deployments of its staged platform: the portal pre-fills them (app API delta §3.4).
 */
export function connectionJson(c: Connection, urls: PublicUrls, masterKey: Buffer, channels: ChannelRegistry, libraryName = '', approvedDeploymentIds?: string[]) {
  const showRef = c.status === 'pending' && c.method === 'dynamic' && c.refTokenEncrypted !== null;
  const platform = c.platform === null ? null : {
    ...c.platform,
    ...(c.bindingAuthority === 'operatorGrant' && approvedDeploymentIds && !(c.status === 'pending' && stagedRegistration(c)) ? { deploymentIds: approvedDeploymentIds } : {}),
    // M1: the site and service origins (for Moodle both equal the connection siteUrl).
    siteUrl: c.siteUrl, serviceUrl: c.serviceUrl,
  };
  return {
    id: c.id, name: c.name, siteUrl: c.siteUrl, method: c.method, status: c.status,
    registrationUrl: showRef ? registrationUrl(urls, openText(masterKey, c.refTokenEncrypted!, appAad(REF_COPY_COLUMN, c.libraryId, c.refTokenHash ?? ''))) : null,
    registrationUrlExpiresAt: showRef ? iso(c.refExpiresAt) : null,
    // M1 (§4.2)
    lms: c.channel, profile: c.profile, serviceUrl: c.serviceUrl, capabilities: channels.legacyCapabilities(c.channel),
    channel: c.channel, channelName: channels.textName(c.channel), bindingAuthority: c.bindingAuthority,
    channelCapabilities: channels.capabilities(c.channel, { id: c.profile, sharing: setupOf(channels, c.channel)?.sharingOf(c.profile) ?? undefined, serviceUrl: setupOf(channels, c.channel)?.profiles[c.profile]?.serviceUrl ?? false }),
    platform, createdAt: iso(c.createdAt), lastLaunchAt: iso(c.lastLaunchAt),
    // T8 course shell: set when a web services token was saved (the portal shows "Also create an empty Moodle course").
    webServices: c.webServices,
    // B-T4b1-01: the last failed connect attempt while pending (null after success).
    lastError: c.lastError ? {
      code: c.lastError.code, ltiCode: c.lastError.ltiCode, traceId: c.lastError.traceId, at: iso(c.lastError.at),
      // The same title and action line as the register page of that code (one text table, register-texts.ts).
      title: registerErrorText(c.lastError.code, toolName(libraryName), channels, c.channel)?.title ?? null,
      action: registerErrorText(c.lastError.code, toolName(libraryName), channels, c.channel)?.action ?? null,
    } : null,
  };
}

/** The DTO with the approved deployment ids of a Canvas or Blackboard connection (never an unapproved remote row). */
export function connectionDto(db: Db, c: Connection, urls: PublicUrls, masterKey: Buffer, channels: ChannelRegistry, libraryName = '') {
  return connectionJson(c, urls, masterKey, channels, libraryName, c.bindingAuthority === 'self' ? undefined : approvalsOfConnection(db, c.id).map((a) => a.deploymentId));
}

const ConnectionCreate = z.object({
  name: z.string().trim().min(1).max(100),
  siteUrl: z.string().max(2048),
  method: z.enum(['dynamic', 'manual']),
  // M1 (§4.2)
  lms: z.string().optional(),
  channel: z.string().optional(),
  profile: z.string().min(1).max(64).optional(),
  serviceUrl: z.string().max(2048).optional(),
});

type IdParams = { Params: { id: string } };

export function registerConnectionRoutes(api: FastifyInstance, deps: ConnectionDeps): void {
  const { db, urls, masterKey, lti, logger, now, channels } = deps;
  const libraryOf = (req: FastifyRequest) => req.auth!.signedIn.library;
  const connectionOf = (req: FastifyRequest<IdParams>): Connection => {
    const c = getConnection(db, libraryOf(req).id, req.params.id);
    if (!c) throw new ApiError('NOT_FOUND', 'The connection does not exist in your library.');
    return c;
  };
  const dto = (req: FastifyRequest, c: Connection) => connectionDto(db, c, urls, masterKey, channels, libraryOf(req).name);
  // App contract §1: a failed LTI service call is 502 LTI_SERVICE_ERROR with the trace id.
  const ownHosts = [urls.lti, urls.app, urls.content].map(originHost);

  api.get('/connections', async (req) => ({ connections: listConnections(db, libraryOf(req).id).map((c) => dto(req, c)) }));

  // M1 (§4.3): LMS types, methods, capabilities and profiles, built from GET /api/providers. LA S1: only the rows that
  // an adapter owns (app API delta §2).
  api.get('/lms-providers', async (req) => {
    const rows = ownedProfiles(await providerProfiles(lti, req.traceId), logger, req.traceId, channels).filter((p) => usableProfileRow(channels, p, logger, req.traceId));
    return {
      lms: channels.channels().filter((m) => m.availability !== 'simulation-only' || rows.some((p) => channels.channelOfProfile(p.id) === m.id)).map((m) => {
        const adapter = setupOf(channels, m.id);
        return {
          lms: m.id, label: m.names.label, methods: m.registration.map((r) => r.method), capabilities: channels.legacyCapabilities(m.id),
          channel: m.id, channelName: channels.textName(m.id), channelCapabilities: channels.capabilities(m.id), family: m.family,
          registration: m.registration.map(({ method, authority, profiles }) => ({ method, authority, profiles })),
          profiles: rows.filter((p) => channels.channelOfProfile(p.id) === m.id).map((p) => ({
            id: p.id, label: adapter?.profiles[p.id]?.label ?? p.id, simulation: p.simulation, ready: p.sharing === 'exclusive' || activeShared(p) !== null,
            clientId: p.sharedPlatform?.clientId ?? null,
          })),
        };
      }),
    };
  });

  api.post('/connections', async (req, reply) => {
    const body = ConnectionCreate.safeParse(req.body ?? {});
    const invalid = (field: string): never => { throw new ApiError('INVALID_REQUEST', `Invalid field: ${field}.`, { details: { field } }); };
    if (!body.success) return invalid(body.error.issues[0]?.path.join('.') || 'body');
    const b = body.data;
    if (b.channel !== undefined && b.lms !== undefined && b.channel !== b.lms) return invalid('channel');
    const channel = b.channel ?? b.lms ?? channels.channelOfProfile('standard');
    const manifest = channel === null ? null : channels.channel(channel);
    if (!manifest || channel === null) return invalid(b.channel !== undefined ? 'channel' : 'lms');
    const registration = manifest.registration.find((r) => r.method === b.method);
    if (!registration) {
      if (b.method !== 'dynamic') return invalid('method');
      throw new ApiError('CAPABILITY_NOT_SUPPORTED', 'This LMS has no dynamic registration.', { status: 422, details: { capability: 'dynamicRegistration' } });
    }
    const profileId = b.profile ?? registration.defaultProfile;
    if (!registration.profiles.includes(profileId)) return invalid('profile');
    const adapter = setupOf(channels, channel);
    if (!adapter) return invalid('channel');
    const sharing = adapter.sharingOf(profileId);
    if (!sharing) return invalid('profile');
    if (registration.authority === 'self') {
      // The Moodle rules of §4 do not change (no LTI call). A channel of the kernel admin-value adapter first passes
      // site rules 1–4 (app API delta §3.1): no IP literal, no localhost, none of our hosts.
      let siteUrl = b.siteUrl;
      if (servedByKernel(channels, channel)) {
        const r = checkSiteUrl(b.siteUrl, { ownHosts, profileFixedHosts: [] });
        if (!r.ok) throw new ApiError('INVALID_SITE_URL', `Invalid field: siteUrl breaks rule ${r.rule} of the site rules.`, { details: { rule: r.rule, field: 'siteUrl' } });
        siteUrl = r.origin;
        // BD-A1-79: the profile must be reported, and as an admin profile.
        const row = (await providerProfiles(lti, req.traceId)).find((p) => p.id === profileId && channels.channelOfProfile(p.id) === channel);
        if (!row || !usableProfileRow(channels, row, logger, req.traceId)) return invalid('profile');
      }
      const checked = adapter.checkCreate({ siteUrl, ...(b.serviceUrl !== undefined ? { serviceUrl: b.serviceUrl } : {}), profile: { id: profileId, issuer: null, sharing, serviceUrl: false } });
      if (!checked.ok) return invalid(checked.field);
      const ref = b.method === 'dynamic' ? newRef(masterKey, libraryOf(req).id, deps.refTtlSeconds, now()).stored : null;
      const c = createConnection(db, libraryOf(req).id, { name: b.name, siteUrl: checked.siteUrl, method: b.method, channel, profile: profileId }, ref, now(), channels, adapter.sharingOf);
      return reply.code(201).send(dto(req, c));
    }
    const rows = await providerProfiles(lti, req.traceId);
    const profile = rows.find((p) => p.id === profileId && channels.channelOfProfile(p.id) === channel && adapter.profiles[p.id] !== undefined
      && usableProfileRow(channels, p, logger, req.traceId));
    if (!profile) return invalid('profile');
    if (b.serviceUrl !== undefined && !adapter.profiles[profileId]?.serviceUrl) return invalid('serviceUrl');
    const suffixes = adapter.profiles[profile.id]?.refusedHostSuffixes;
    const rules = {
      ownHosts, profileFixedHosts: fixedHostsOf([profile.issuer, profile.authenticationEndpoint, profile.accesstokenEndpoint, profile.jwksUrl]),
      ...(suffixes ? { selfHosted: { refusedSuffixes: [...suffixes], allFixedHosts: rows.flatMap((p) => fixedHostsOf([p.issuer, p.authenticationEndpoint, p.accesstokenEndpoint, p.jwksUrl])) } } : {}),
    };
    const site = (field: 'siteUrl' | 'serviceUrl', value: string): string => {
      const r = checkSiteUrl(value, rules);
      if (!r.ok) throw new ApiError('INVALID_SITE_URL', `Invalid field: ${field} breaks rule ${r.rule} of the site rules.`, { details: { rule: r.rule, field } });
      return r.origin;
    };
    const checkedSite = site('siteUrl', b.siteUrl);
    const checkedService = b.serviceUrl !== undefined ? site('serviceUrl', b.serviceUrl) : undefined;
    const checked = adapter.checkCreate({ siteUrl: checkedSite, ...(checkedService !== undefined ? { serviceUrl: checkedService } : {}), profile });
    if (!checked.ok) {
      if (checked.rule !== undefined) throw new ApiError('INVALID_SITE_URL', `Invalid field: ${checked.field} breaks rule ${checked.rule} of the site rules.`, { details: { rule: checked.rule, field: checked.field } });
      return invalid(checked.field);
    }
    const siteUrl = checked.siteUrl;
    const serviceUrl = b.serviceUrl !== undefined ? checked.serviceUrl : null;
    if (sharing === 'shared' && !activeShared(profile)) {
      logger.warn('provider_not_ready', { trace_id: req.traceId, connection_id: null, profile: profile.id, cause: 'platform_inactive' });
      throw providerNotReady();
    }
    const snapshot = snapshotOf(profile, { siteUrl, serviceUrl: serviceUrl ?? siteUrl });
    // A1 BD-A1-106: a dynamic method with authority operatorGrant (Canvas, LA-ADR-05 D6) also gets its registration URL
    // at create. The authority stays operatorGrant; the registration stages the platform for the grant.
    const ref = b.method === 'dynamic' ? newRef(masterKey, libraryOf(req).id, deps.refTtlSeconds, now()).stored : null;
    const c = transaction(db, () => createConnection(db, libraryOf(req).id, {
      name: b.name, siteUrl, method: b.method, channel, profile: profile.id, serviceUrl, snapshot,
    }, ref, now(), channels, adapter.sharingOf));
    return reply.code(201).send(dto(req, c));
  });

  api.get<IdParams>('/connections/:id', async (req) => dto(req, connectionOf(req)));

  api.post<IdParams>('/connections/:id/registration-url', async (req) => {
    const c = connectionOf(req);
    // A staged registration keeps its platform and waits for the operator grant: no new registration URL.
    if (c.status !== 'pending' || c.method !== 'dynamic' || c.platform !== null || !channels.capabilities(c.channel)['registration.dynamic']) throw new ApiError('CONNECTION_NOT_PENDING', 'Only a pending dynamic connection has a registration URL.');
    const ref = newRef(masterKey, c.libraryId, deps.refTtlSeconds, now());
    if (!replaceRef(db, c.libraryId, c.id, ref.stored, now())) throw new ApiError('CONNECTION_NOT_PENDING');
    return { registrationUrl: registrationUrl(urls, ref.token), expiresAt: new Date(ref.stored.expiresAt).toISOString() };
  });

  /** The local Blackboard Application ID, including the registered old-011 fallback (§4.4, §4.5). */
  const sharedClientIdOf = (c: Connection): string | null => c.snapshot.clientId ?? c.platform?.clientId ?? null;

  api.get<IdParams>('/connections/:id/tool-configuration', async (req) => {
    const c = connectionOf(req);
    const adapter = setupOf(channels, c.channel);
    if (!adapter) throw new ApiError('CAPABILITY_NOT_SUPPORTED');
    const clientId = adapter.sharingOf(c.profile) === 'shared' ? sharedClientIdOf(c) : null;
    if (adapter.sharingOf(c.profile) === 'shared' && clientId === null) {
      logger.warn('provider_not_ready', { trace_id: req.traceId, connection_id: c.id, profile: c.profile, cause: 'no_snapshot' });
      throw providerNotReady();
    }
    return adapter.toolConfiguration({ ...toolContext(urls), urls, libraryName: libraryOf(req).name, sharedClientId: clientId });
  });

  api.put<IdParams>('/connections/:id/platform', async (req) => {
    const c = connectionOf(req);
    const adapter = setupOf(channels, c.channel);
    if (!adapter) throw new ApiError('CAPABILITY_NOT_SUPPORTED');
    const done = await authorityFor(c, deps).bind(c, adapter, req.body, { ...toolContext(urls), libraryName: libraryOf(req).name, traceId: req.traceId });
    return dto(req, done);
  });

  api.delete<IdParams>('/connections/:id', async (req, reply) => {
    const c = connectionOf(req);
    await authorityFor(c, deps).disconnect(c, req.traceId);
    return reply.code(204).send();
  });
}
