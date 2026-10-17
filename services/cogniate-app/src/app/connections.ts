// Connections (app contract §4): connect a Moodle site by dynamic or manual registration. Every lookup uses the
// session user's library: a connection of another library gives 404 NOT_FOUND.
import { decrypt, encrypt, randomToken, sha256Hex } from '@cogniate/shared';
import type { PublicUrls } from '@cogniate/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Connection, PlatformInfo, RefToken } from '../domain/connections.ts';
import {
  PlatformTakenError, createConnection, disableConnection, getConnection, listConnections, markRegistered, replaceRef,
} from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';
import type { LtiClient, LtiPlatform } from '../domain/lti-client.ts';
import { LtiServiceError } from '../domain/lti-client.ts';
import { ApiError } from './api-errors.ts';

/** The tool account of the app in the LTI service (contract §4.1). */
export const TOOL_ACCOUNT = 'cogniate';

export interface ConnectionDeps {
  db: Db;
  urls: PublicUrls;
  masterKey: Buffer;
  lti: LtiClient;
  refTtlSeconds: number;
  now: () => number;
}

const iso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString());

/** A new registration ref (43 characters, 256 bits): the URL holds it, the table its hash and an encrypted copy. */
export function newRef(masterKey: Buffer, ttlSeconds: number, now: number): { token: string; stored: RefToken } {
  const token = randomToken();
  return { token, stored: { hash: sha256Hex(token), encrypted: encrypt(masterKey, token), expiresAt: now + ttlSeconds * 1000 } };
}

export const registrationUrl = (urls: PublicUrls, ref: string): string => `${urls.lti}/lti/register/${TOOL_ACCOUNT}?ref=${ref}`;

/** Tool name in Moodle: `Cogniate (<library name>)`, ASCII only (flows §6a). */
export function toolName(libraryName: string): string {
  const ascii = libraryName.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
  return `Cogniate (${ascii || 'Library'})`;
}

export function connectionJson(c: Connection, urls: PublicUrls, masterKey: Buffer) {
  const showRef = c.status === 'pending' && c.method === 'dynamic' && c.refTokenEncrypted !== null;
  return {
    id: c.id, name: c.name, siteUrl: c.siteUrl, method: c.method, status: c.status,
    registrationUrl: showRef ? registrationUrl(urls, decrypt(masterKey, c.refTokenEncrypted!)) : null,
    registrationUrlExpiresAt: showRef ? iso(c.refExpiresAt) : null,
    platform: c.platform, createdAt: iso(c.createdAt), lastLaunchAt: iso(c.lastLaunchAt),
  };
}

/** App contract §4.1: exactly these 16 rows, in this order (stable keys; labels are the Moodle 5.2.4 form labels). */
export function toolConfiguration(urls: PublicUrls, libraryName: string): Array<{ key: string; label: string; value: string }> {
  const launch = `${urls.lti}/lti/launch/${TOOL_ACCOUNT}`;
  return [
    { key: 'tool_name', label: 'Tool name', value: toolName(libraryName) },
    { key: 'tool_url', label: 'Tool URL', value: launch },
    { key: 'lti_version', label: 'LTI version', value: 'LTI 1.3' },
    { key: 'public_key_type', label: 'Public key type', value: 'Keyset URL' },
    { key: 'public_keyset_url', label: 'Public keyset', value: `${urls.lti}/lti/keys/${TOOL_ACCOUNT}` },
    { key: 'initiate_login_url', label: 'Initiate login URL', value: `${urls.lti}/lti/login/${TOOL_ACCOUNT}` },
    { key: 'redirection_uris', label: 'Redirection URI(s)', value: launch },
    { key: 'deep_linking', label: 'Supports Deep Linking (Content-Item Message)', value: 'Yes' },
    { key: 'content_selection_url', label: 'Content Selection URL', value: launch },
    { key: 'tool_configuration_usage', label: 'Tool configuration usage', value: 'Show in activity chooser and as a preconfigured tool' },
    { key: 'launch_container', label: 'Default launch container', value: 'New window' },
    { key: 'ags', label: 'IMS LTI Assignment and Grade Services', value: 'Use this service for grade sync and column management' },
    { key: 'nrps', label: 'IMS LTI Names and Role Provisioning', value: "Use this service to retrieve members' information as per privacy settings" },
    { key: 'share_name', label: "Share launcher's name with tool", value: 'Never' },
    { key: 'share_email', label: "Share launcher's email with tool", value: 'Never' },
    { key: 'accept_grades', label: 'Accept grades from the tool', value: 'Delegate to teacher' },
  ];
}

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
  siteUrl: z.string().max(2048).refine(isHttpsOrigin, 'must be an https origin'),
  method: z.enum(['dynamic', 'manual']),
});

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
  const { db, urls, masterKey, lti, now } = deps;
  const libraryOf = (req: FastifyRequest) => req.auth!.signedIn.library;
  const connectionOf = (req: FastifyRequest<IdParams>): Connection => {
    const c = getConnection(db, libraryOf(req).id, req.params.id);
    if (!c) throw new ApiError('NOT_FOUND', 'The connection does not exist in your library.');
    return c;
  };
  const ltiFailure = (err: unknown): never => {
    if (err instanceof LtiServiceError) throw new ApiError('LTI_SERVICE_ERROR', `The LTI service answered ${err.status || 'nothing'} (${err.code}).`);
    throw err;
  };

  api.get('/connections', async (req) => ({ connections: listConnections(db, libraryOf(req).id).map((c) => connectionJson(c, urls, masterKey)) }));

  api.post('/connections', async (req, reply) => {
    const body = ConnectionCreate.safeParse(req.body ?? {});
    if (!body.success) {
      const field = body.error.issues[0]?.path.join('.') || 'body';
      throw new ApiError('INVALID_REQUEST', `Invalid field: ${field}.`, { details: { field } });
    }
    const ref = body.data.method === 'dynamic' ? newRef(masterKey, deps.refTtlSeconds, now()).stored : null;
    const c = createConnection(db, libraryOf(req).id, body.data, ref, now());
    return reply.code(201).send(connectionJson(c, urls, masterKey));
  });

  api.get<IdParams>('/connections/:id', async (req) => connectionJson(connectionOf(req), urls, masterKey));

  api.post<IdParams>('/connections/:id/registration-url', async (req) => {
    const c = connectionOf(req);
    if (c.status !== 'pending' || c.method !== 'dynamic') throw new ApiError('CONNECTION_NOT_PENDING', 'Only a pending dynamic connection has a registration URL.');
    const ref = newRef(masterKey, deps.refTtlSeconds, now());
    if (!replaceRef(db, c.libraryId, c.id, ref.stored, now())) throw new ApiError('CONNECTION_NOT_PENDING');
    return { registrationUrl: registrationUrl(urls, ref.token), expiresAt: new Date(ref.stored.expiresAt).toISOString() };
  });

  api.get<IdParams>('/connections/:id/tool-configuration', async (req) => {
    connectionOf(req);
    return toolConfiguration(urls, libraryOf(req).name);
  });

  api.put<IdParams>('/connections/:id/platform', async (req) => {
    const c = connectionOf(req);
    const parsed = PlatformValues.safeParse(req.body ?? {});
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? 'body')))];
      throw new ApiError('INVALID_PLATFORM_VALUES', 'Some values are missing or not valid.', { details: { fields } });
    }
    const v = parsed.data;
    const fields = badPlatformFields(c.siteUrl, v);
    if (fields.length > 0) throw new ApiError('INVALID_PLATFORM_VALUES', 'The URLs must be https and on the Moodle site of this connection.', { details: { fields } });
    if (c.status !== 'pending') throw new ApiError('CONNECTION_NOT_PENDING', 'This connection already has a platform.');
    const traceId = req.traceId;
    let platform: LtiPlatform;
    try {
      platform = await lti.createPlatform({
        url: v.issuer, clientId: v.clientId, name: toolName(libraryOf(req).name), authenticationEndpoint: v.authenticationEndpoint,
        accesstokenEndpoint: v.accessTokenEndpoint, authConfig: { method: 'JWK_SET', key: v.jwksUrl }, deploymentIds: [v.deploymentId],
      }, traceId);
    } catch (err) {
      // The same issuer + client id is registered already: use that platform if no other connection holds it.
      if (!(err instanceof LtiServiceError) || err.code !== 'PLATFORM_ALREADY_EXISTS') ltiFailure(err);
      const found = (await lti.findPlatforms({ url: v.issuer, clientId: v.clientId }, traceId).catch(ltiFailure))[0];
      if (!found) throw new ApiError('LTI_SERVICE_ERROR');
      platform = found;
    }
    try {
      markRegistered(db, c.id, platformInfo(platform), now());
    } catch (err) {
      if (err instanceof PlatformTakenError) {
        throw new ApiError('INVALID_PLATFORM_VALUES', 'This Moodle tool is already connected to another connection.', { details: { fields: ['clientId'] } });
      }
      throw err;
    }
    return connectionJson(getConnection(db, c.libraryId, c.id)!, urls, masterKey);
  });

  api.delete<IdParams>('/connections/:id', async (req, reply) => {
    const c = connectionOf(req);
    if (c.ltiPlatformId) await lti.patchPlatform(c.ltiPlatformId, { active: false }, req.traceId).catch(ltiFailure);
    disableConnection(db, c.libraryId, c.id, now());
    return reply.code(204).send();
  });
}
