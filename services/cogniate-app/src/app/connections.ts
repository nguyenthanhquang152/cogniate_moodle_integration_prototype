// Connections (app contract §4, M1 §4.2 to §4.7): connect a Moodle site by dynamic or manual registration, or a Canvas
// or Blackboard site with an operator approval grant (the common redemption engine). Every lookup uses the session
// user's library: a connection of another library gives 404 NOT_FOUND.
import { decrypt, encrypt, randomToken, sha256Hex } from '@cogniate/shared';
import type { Logger, PublicUrls } from '@cogniate/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { LtiClient, LtiPlatform } from '../clients/lti-client.ts';
import { LtiServiceError, ltiErrorFields } from '../clients/lti-client.ts';
import type { Connection, PlatformInfo, RefToken } from '../domain/connections.ts';
import {
  PlatformTakenError, createConnection, disableConnection, getConnection, listConnections, markRegistered, platformOwner, replaceRef,
} from '../domain/connections.ts';
import { approvalsOfConnection, revokeOpenGrants } from '../domain/bindings.ts';
import type { Db } from '../domain/db.ts';
import { transaction } from '../domain/db.ts';
import { checkSiteUrl, fixedHostsOf, originHost } from '@cogniate/shared';
import type { LtiProviderProfile } from '../clients/lti-client.ts';
import { LMS_TYPES, capabilitiesOf, ownedProfiles, providerAdapters, providerOf } from '../providers/index.ts';
import type { BindingCleanup } from './binding-cleanup.ts';
import { activeShared, providerProfiles, snapshotOf } from './binding-targets.ts';
import type { RedemptionEngine } from './redemption.ts';
import { TOOL_ACCOUNT, toolName } from '../providers/common.ts';
import { moodleToolRows } from '../providers/moodle.ts';
import { registerErrorText } from '../tool-pages/register-texts.ts';
import { ApiError, providerNotReady } from './api-errors.ts';

export { TOOL_ACCOUNT, toolName };

export interface ConnectionDeps {
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

/** A new registration ref (43 characters, 256 bits): the URL holds it, the table its hash and an encrypted copy. */
export function newRef(masterKey: Buffer, ttlSeconds: number, now: number): { token: string; stored: RefToken } {
  const token = randomToken();
  return { token, stored: { hash: sha256Hex(token), encrypted: encrypt(masterKey, token), expiresAt: now + ttlSeconds * 1000 } };
}

export const registrationUrl = (urls: PublicUrls, ref: string): string => `${urls.lti}/lti/register/${TOOL_ACCOUNT}?ref=${ref}`;


/**
 * The connection DTO (app contract §4, §4.2). `libraryName` fills the tool name into a lastError action line.
 * `approvedDeploymentIds`: Canvas and Blackboard list only deployments with a committed approval (connectionDto).
 */
export function connectionJson(c: Connection, urls: PublicUrls, masterKey: Buffer, libraryName = '', approvedDeploymentIds?: string[]) {
  const showRef = c.status === 'pending' && c.method === 'dynamic' && c.refTokenEncrypted !== null;
  const platform = c.platform === null ? null : {
    ...c.platform,
    ...(c.lms !== 'moodle' && approvedDeploymentIds ? { deploymentIds: approvedDeploymentIds } : {}),
    // M1: the site and service origins (for Moodle both equal the connection siteUrl).
    siteUrl: c.siteUrl, serviceUrl: c.serviceUrl,
  };
  return {
    id: c.id, name: c.name, siteUrl: c.siteUrl, method: c.method, status: c.status,
    registrationUrl: showRef ? registrationUrl(urls, decrypt(masterKey, c.refTokenEncrypted!)) : null,
    registrationUrlExpiresAt: showRef ? iso(c.refExpiresAt) : null,
    // M1 (§4.2)
    lms: c.lms, profile: c.profile, serviceUrl: c.serviceUrl, capabilities: capabilitiesOf(c.lms),
    platform, createdAt: iso(c.createdAt), lastLaunchAt: iso(c.lastLaunchAt),
    // T8 course shell: set when a web services token was saved (the portal shows "Also create an empty Moodle course").
    webServices: c.webServices,
    // B-T4b1-01: the last failed connect attempt while pending (null after success).
    lastError: c.lastError ? {
      code: c.lastError.code, ltiCode: c.lastError.ltiCode, traceId: c.lastError.traceId, at: iso(c.lastError.at),
      // The same title and action line as the register page of that code (one text table, register-texts.ts).
      title: registerErrorText(c.lastError.code, toolName(libraryName))?.title ?? null,
      action: registerErrorText(c.lastError.code, toolName(libraryName))?.action ?? null,
    } : null,
  };
}

/** The DTO with the approved deployment ids of a Canvas or Blackboard connection (never an unapproved remote row). */
export function connectionDto(db: Db, c: Connection, urls: PublicUrls, masterKey: Buffer, libraryName = '') {
  return connectionJson(c, urls, masterKey, libraryName, c.lms === 'moodle' ? undefined : approvalsOfConnection(db, c.id).map((a) => a.deploymentId));
}

/**
 * Security §2.6 "orphans are switched off": the app got this platform id from the LTI service (registration complete
 * or manual create) and could not bind it to the requesting connection. If no connection owns it, set it inactive at
 * once and log platform_orphan_deactivated. A platform that a connection owns is never touched.
 */
export async function deactivateOrphan(deps: { db: Db; lti: LtiClient; logger: Logger }, platformId: string, traceId: string): Promise<void> {
  if (platformOwner(deps.db, platformId) !== undefined) return;
  try {
    await deps.lti.patchPlatform(platformId, { active: false }, traceId);
    deps.logger.warn('platform_orphan_deactivated', { trace_id: traceId, platform_id: platformId });
  } catch (err) {
    // The platform stays active but is bound to no connection, so a launch from it only gets the "not available" page.
    deps.logger.warn('platform_orphan_deactivate_failed', { trace_id: traceId, platform_id: platformId, ...ltiErrorFields(err) });
  }
}

/** App contract §4.1: exactly these 16 rows, in this order (the Moodle adapter owns them). */
export const toolConfiguration = moodleToolRows;

export const platformInfo = (p: LtiPlatform): PlatformInfo => ({ id: p.id, issuer: p.url, clientId: p.clientId, deploymentIds: p.deploymentIds, productFamilyCode: p.productFamilyCode ?? null });

const isHttpsUrl = (v: string): boolean => {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.username === '' && u.password === '' && u.hash === '';
  } catch {
    return false;
  }
};
const isHttpsOrigin = (v: string): boolean => isHttpsUrl(v) && new URL(v).origin === v;

const ConnectionCreate = z.object({
  name: z.string().trim().min(1).max(100),
  siteUrl: z.string().max(2048),
  method: z.enum(['dynamic', 'manual']),
  // M1 (§4.2)
  lms: z.string().optional(),
  profile: z.string().min(1).max(64).optional(),
  serviceUrl: z.string().max(2048).optional(),
});

/** The LMS of a provider profile row (`standard` = Moodle). An open value (LA S1): a row of no adapter matches no LMS. */
const lmsOfRow = (p: LtiProviderProfile): string => p.lms ?? 'moodle';

const PLATFORM_FIELDS = ['issuer', 'clientId', 'deploymentId', 'authenticationEndpoint', 'accessTokenEndpoint', 'jwksUrl'] as const;
const PlatformValues = z.object(Object.fromEntries(PLATFORM_FIELDS.map((f) => [f, z.string().trim().min(1).max(2048)])) as Record<(typeof PLATFORM_FIELDS)[number], z.ZodString>);

/**
 * App contract §4 PUT .../platform rules: https; issuer origin = siteUrl; auth, token and JWKS URLs on the issuer
 * origin. Returns the names of the fields that break a rule (empty = fine).
 */
export function badPlatformFields(siteUrl: string, v: Record<(typeof PLATFORM_FIELDS)[number], string>): string[] {
  const bad = new Set<string>();
  if (!isHttpsUrl(v.issuer) || new URL(v.issuer).origin !== siteUrl) bad.add('issuer');
  const origin = isHttpsUrl(v.issuer) ? new URL(v.issuer).origin : siteUrl;
  for (const f of ['authenticationEndpoint', 'accessTokenEndpoint', 'jwksUrl'] as const) {
    if (!isHttpsUrl(v[f]) || new URL(v[f]).origin !== origin) bad.add(f);
  }
  return [...bad];
}

type IdParams = { Params: { id: string } };

export function registerConnectionRoutes(api: FastifyInstance, deps: ConnectionDeps): void {
  const { db, urls, masterKey, lti, logger, now } = deps;
  const libraryOf = (req: FastifyRequest) => req.auth!.signedIn.library;
  const connectionOf = (req: FastifyRequest<IdParams>): Connection => {
    const c = getConnection(db, libraryOf(req).id, req.params.id);
    if (!c) throw new ApiError('NOT_FOUND', 'The connection does not exist in your library.');
    return c;
  };
  const dto = (req: FastifyRequest, c: Connection) => connectionDto(db, c, urls, masterKey, libraryOf(req).name);
  // App contract §1: a failed LTI service call is 502 LTI_SERVICE_ERROR with the trace id.
  const ltiFailure = (req: FastifyRequest) => (err: unknown): never => {
    if (err instanceof LtiServiceError) throw new ApiError('LTI_SERVICE_ERROR', `The LTI service answered ${err.status || 'nothing'} (${err.code}). Trace id: ${req.traceId}`);
    throw err;
  };
  const ownHosts = [urls.lti, urls.app, urls.content].map(originHost);

  api.get('/connections', async (req) => ({ connections: listConnections(db, libraryOf(req).id).map((c) => dto(req, c)) }));

  // M1 (§4.3): LMS types, methods, capabilities and profiles, built from GET /api/providers. LA S1: only the rows that
  // an adapter owns (app API delta §2).
  api.get('/lms-providers', async (req) => {
    const rows = ownedProfiles(await providerProfiles(lti, req.traceId), logger, req.traceId);
    return {
      lms: providerAdapters().map((a) => ({
        lms: a.lms, label: a.label, methods: a.methods, capabilities: a.capabilities,
        profiles: rows.filter((p) => lmsOfRow(p) === a.lms && a.profileLabel(p.id) !== null).map((p) => ({
          id: p.id, label: a.profileLabel(p.id)!, simulation: p.simulation, ready: p.sharing === 'exclusive' || activeShared(p) !== null,
          clientId: p.sharedPlatform?.clientId ?? null,
        })),
      })),
    };
  });

  api.post('/connections', async (req, reply) => {
    const body = ConnectionCreate.safeParse(req.body ?? {});
    const invalid = (field: string): never => { throw new ApiError('INVALID_REQUEST', `Invalid field: ${field}.`, { details: { field } }); };
    if (!body.success) return invalid(body.error.issues[0]?.path.join('.') || 'body');
    const b = body.data;
    const lms = b.lms ?? 'moodle';
    if (!(LMS_TYPES as readonly string[]).includes(lms) || !providerOf(lms)) return invalid('lms');
    const adapter = providerOf(lms)!;
    if (lms === 'moodle') {
      // The Moodle rules of §4 do not change (no LTI call).
      if (!isHttpsOrigin(b.siteUrl)) return invalid('siteUrl');
      if (b.profile !== undefined && b.profile !== 'standard') return invalid('profile');
      if (b.serviceUrl !== undefined) return invalid('serviceUrl');
      const ref = b.method === 'dynamic' ? newRef(masterKey, deps.refTtlSeconds, now()).stored : null;
      const c = createConnection(db, libraryOf(req).id, { name: b.name, siteUrl: b.siteUrl, method: b.method }, ref, now());
      return reply.code(201).send(dto(req, c));
    }
    const rows = await providerProfiles(lti, req.traceId);
    const profileId = b.profile ?? adapter.defaultProfile;
    const profile = rows.find((p) => p.id === profileId && lmsOfRow(p) === lms && adapter.profileLabel(p.id) !== null);
    if (!profile) return invalid('profile');
    if (b.method === 'dynamic') throw new ApiError('CAPABILITY_NOT_SUPPORTED', 'This LMS has no dynamic registration.', { status: 422, details: { capability: 'dynamicRegistration' } });
    if (b.serviceUrl !== undefined && !adapter.acceptsServiceUrl) return invalid('serviceUrl');
    const suffixes = adapter.siteRuleSuffixes(profile.id);
    const rules = {
      ownHosts, profileFixedHosts: fixedHostsOf([profile.issuer, profile.authenticationEndpoint, profile.accesstokenEndpoint, profile.jwksUrl]),
      ...(suffixes ? { selfHosted: { refusedSuffixes: suffixes, allFixedHosts: rows.flatMap((p) => fixedHostsOf([p.issuer, p.authenticationEndpoint, p.accesstokenEndpoint, p.jwksUrl])) } } : {}),
    };
    const site = (field: 'siteUrl' | 'serviceUrl', value: string): string => {
      const r = checkSiteUrl(value, rules);
      if (!r.ok) throw new ApiError('INVALID_SITE_URL', `Invalid field: ${field} breaks rule ${r.rule} of the site rules.`, { details: { rule: r.rule, field } });
      return r.origin;
    };
    const siteUrl = site('siteUrl', b.siteUrl);
    const serviceUrl = b.serviceUrl !== undefined ? site('serviceUrl', b.serviceUrl) : null;
    if (lms === 'blackboard' && !activeShared(profile)) {
      logger.warn('provider_not_ready', { trace_id: req.traceId, connection_id: null, profile: profile.id, cause: 'platform_inactive' });
      throw providerNotReady();
    }
    const snapshot = snapshotOf(profile, { siteUrl, serviceUrl: serviceUrl ?? siteUrl });
    const c = transaction(db, () => createConnection(db, libraryOf(req).id, {
      name: b.name, siteUrl, method: 'manual', lms: adapter.lms, profile: profile.id, serviceUrl, snapshot,
    }, null, now()));
    return reply.code(201).send(dto(req, c));
  });

  api.get<IdParams>('/connections/:id', async (req) => dto(req, connectionOf(req)));

  api.post<IdParams>('/connections/:id/registration-url', async (req) => {
    const c = connectionOf(req);
    if (c.status !== 'pending' || c.method !== 'dynamic' || c.lms !== 'moodle') throw new ApiError('CONNECTION_NOT_PENDING', 'Only a pending dynamic connection has a registration URL.');
    const ref = newRef(masterKey, deps.refTtlSeconds, now());
    if (!replaceRef(db, c.libraryId, c.id, ref.stored, now())) throw new ApiError('CONNECTION_NOT_PENDING');
    return { registrationUrl: registrationUrl(urls, ref.token), expiresAt: new Date(ref.stored.expiresAt).toISOString() };
  });

  /** The local Blackboard Application ID, including the registered old-011 fallback (§4.4, §4.5). */
  const sharedClientIdOf = (c: Connection): string | null => c.snapshot.clientId ?? c.platform?.clientId ?? null;

  api.get<IdParams>('/connections/:id/tool-configuration', async (req) => {
    const c = connectionOf(req);
    const adapter = providerOf(c.lms);
    if (!adapter || c.lms === 'moodle') return toolConfiguration(urls, libraryOf(req).name);
    const clientId = c.lms === 'blackboard' ? sharedClientIdOf(c) : null;
    if (c.lms === 'blackboard' && clientId === null) {
      logger.warn('provider_not_ready', { trace_id: req.traceId, connection_id: c.id, profile: c.profile, cause: 'no_snapshot' });
      throw providerNotReady();
    }
    return adapter.toolConfiguration({ urls, libraryName: libraryOf(req).name, sharedClientId: clientId });
  });

  // Canvas and Blackboard (§4.4): a strict body and the common two-phase grant redemption.
  async function providerPlatform(req: FastifyRequest<IdParams>, c: Connection) {
    const adapter = providerOf(c.lms);
    if (!adapter?.parsePlatformBody || !deps.engine) throw new ApiError('CAPABILITY_NOT_SUPPORTED', 'This connection has no operator approval.', { details: { capability: 'operatorApproval' } });
    const parsed = adapter.parsePlatformBody(req.body, { sharedClientId: c.lms === 'blackboard' ? sharedClientIdOf(c) : null });
    if (!parsed.ok) throw new ApiError('INVALID_PLATFORM_VALUES', 'Some values are missing or not valid.', { details: { fields: parsed.fields } });
    const done = await deps.engine.redeem({ libraryId: libraryOf(req).id, connectionId: c.id, purpose: 'initial', values: parsed.values, traceId: req.traceId });
    return dto(req, done);
  }

  // Security §2.6 "no adoption": bind only a platform that the LTI service creates in this call.
  api.put<IdParams>('/connections/:id/platform', async (req) => {
    const c = connectionOf(req);
    if (c.lms !== 'moodle') return providerPlatform(req, c);
    if (c.method !== 'manual') throw new ApiError('CONNECTION_NOT_PENDING', 'Only a pending manual connection takes platform values.');
    const parsed = PlatformValues.safeParse(req.body ?? {});
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? 'body')))];
      throw new ApiError('INVALID_PLATFORM_VALUES', 'Some values are missing or not valid.', { details: { fields } });
    }
    const v = parsed.data;
    const fields = badPlatformFields(c.siteUrl, v);
    if (fields.length > 0) throw new ApiError('INVALID_PLATFORM_VALUES', 'The URLs must be https and on the Moodle site of this connection.', { details: { fields } });
    if (c.status !== 'pending') {
      // A repeat of the call that registered this connection: 200 with its own platform, nothing changes (AC-T4-36 (3)).
      const own = c.platform;
      const repeat = c.status !== 'disabled' && own !== null && own.issuer === v.issuer && own.clientId === v.clientId && own.deploymentIds.includes(v.deploymentId);
      if (repeat) return dto(req, c);
      throw new ApiError('CONNECTION_NOT_PENDING', 'This connection already has a platform.');
    }
    const traceId = req.traceId;
    let platform: LtiPlatform;
    try {
      platform = await lti.createPlatform({
        url: v.issuer, clientId: v.clientId, name: toolName(libraryOf(req).name), authenticationEndpoint: v.authenticationEndpoint,
        accesstokenEndpoint: v.accessTokenEndpoint, authConfig: { method: 'JWK_SET', key: v.jwksUrl }, deploymentIds: [v.deploymentId],
      }, traceId);
    } catch (err) {
      // An existing platform (the dev seed, another library's tool, an orphan) is never adopted (security §2.6).
      if (err instanceof LtiServiceError && err.code === 'PLATFORM_ALREADY_EXISTS') {
        throw new ApiError('PLATFORM_IN_USE', 'This Moodle tool is already registered with Cogniate. In Moodle, make a new tool for this library and use its values.');
      }
      // M1: a hosted LMS issuer cannot be a Moodle platform (LTI contract §9.2 ISSUER_RESERVED).
      if (err instanceof LtiServiceError && err.code === 'ISSUER_RESERVED') {
        throw new ApiError('INVALID_PLATFORM_VALUES', 'This address belongs to a hosted LMS. Connect it as Canvas or Blackboard.', { details: { fields: ['issuer'] } });
      }
      // A 4xx that the user can fix becomes the app's own 422 (app contract §1).
      if (err instanceof LtiServiceError && (err.code === 'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN' || err.code === 'INVALID_REQUEST')) {
        throw new ApiError('INVALID_PLATFORM_VALUES', err.description || 'The LTI service did not accept these values.', { details: { fields: [] } });
      }
      return ltiFailure(req)(err);
    }
    try {
      markRegistered(db, c.id, platformInfo(platform), now());
    } catch (err) {
      if (!(err instanceof PlatformTakenError)) throw err;
      // The connection changed while the platform was made (for example a second PUT): the new platform is an orphan.
      await deactivateOrphan({ db, lti, logger }, platform.id, traceId);
      throw new ApiError('CONNECTION_NOT_PENDING', 'This connection already has a platform.');
    }
    return dto(req, getConnection(db, c.libraryId, c.id)!);
  });

  api.delete<IdParams>('/connections/:id', async (req, reply) => {
    const c = connectionOf(req);
    if (c.lms === 'moodle') {
      if (c.ltiPlatformId) await lti.patchPlatform(c.ltiPlatformId, { active: false }, req.traceId).catch(ltiFailure(req));
      disableConnection(db, c.libraryId, c.id, now());
      return reply.code(204).send();
    }
    // §4.7.2: one transaction (disabled, unredeemed grants revoked), then the fence-out of every owned record.
    transaction(db, () => { disableConnection(db, c.libraryId, c.id, now()); revokeOpenGrants(db, c.id, 'disconnect', now()); });
    const lines = deps.cleanup ? await deps.cleanup.fenceOut(getConnection(db, c.libraryId, c.id)!, req.traceId) : [];
    if (lines.some((l) => l.result === 'failed')) throw new ApiError('LTI_SERVICE_ERROR', `The LTI service did not switch off every record. The operator repairs it with app:binding suspend. Trace id: ${req.traceId}`);
    return reply.code(204).send();
  });
}
