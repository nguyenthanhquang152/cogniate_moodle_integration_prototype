import type { ConnectionSetup, BindingTarget, PlatformBodyResult, StagedCreate } from '../../../services/cogniate-app/src/kernel/ports.ts';
import { checkSiteUrl, fixedHostsOf } from '@cogniate/shared/channel';
// Canvas setup data and pure adapter functions (app contract §4.4–§4.5).
// The common engine owns grants, staging, refs, approval and cleanup.

const profiles: ConnectionSetup['profiles'] = {
  'canvas-cloud-production': { sharing: 'exclusive', serviceUrl: true, label: 'Instructure-hosted Canvas (production)' },
  'canvas-cloud-beta': { sharing: 'exclusive', serviceUrl: true, label: 'Instructure-hosted Canvas (beta)' },
  'canvas-cloud-test': { sharing: 'exclusive', serviceUrl: true, label: 'Instructure-hosted Canvas (test)' },
  'canvas-self-hosted': { sharing: 'exclusive', serviceUrl: true, label: 'Self-hosted Canvas', refusedHostSuffixes: ['instructure.com', 'canvaslms.com'] },
  'canvas-sim-cloud': { sharing: 'exclusive', serviceUrl: true, label: 'Canvas cloud (simulation)' },
};

export function parseCanvasBody(body: unknown): PlatformBodyResult {
  const parsed = parseStrictBody(body, { required: ['clientId', 'deploymentId', 'grantCode'] });
  if (!parsed.ok) return parsed;
  return { ok: true, values: {
    clientId: parsed.values.clientId!, deploymentId: parsed.values.deploymentId!, grantCode: parsed.values.grantCode!,
  } };
}

const setup: ConnectionSetup = {
  channel: 'canvas', profiles,
  sharingOf: (id) => profiles[id]?.sharing ?? null,
  checkCreate: checkCreate,
  toolConfiguration: ({ urls, libraryName }) => [
    { key: 'key_name', label: 'Key Name', value: toolName(libraryName) },
    { key: 'redirect_uris', label: 'Redirect URIs', value: toolUrls(urls).launch },
    { key: 'method', label: 'Method', value: 'Paste JSON' },
    { key: 'lti_json', label: 'LTI 1.3 Configuration', value: 'Paste the JSON from "Copy JSON" or "Download JSON". Do not edit it.' },
  ],
  parseBindingBody: (body, ctx) => {
    if (ctx.purpose === 'initial') return parseCanvasBody(body);
    const parsed = parseStrictBody(body, { required: ['deploymentId', 'grantCode'] });
    if (!parsed.ok) return parsed;
    return { ok: true, values: { clientId: ctx.clientId ?? '', deploymentId: parsed.values.deploymentId!, grantCode: parsed.values.grantCode! } };
  },
  initialTarget: ({ connection, values, profile }): BindingTarget => {
    if (!profiles[profile.id] || !profile.issuer) throw new Error('Canvas target needs a Canvas profile issuer');
    return {
      kind: 'exclusive_platform', profile: connection.profile,
      issuer: profile.issuer === '{siteUrl}' ? connection.siteUrl : profile.issuer,
      clientId: values.clientId, deploymentId: values.deploymentId,
      siteUrl: connection.siteUrl, serviceUrl: connection.serviceUrl,
      platformId: connection.ltiPlatformId,
    };
  },
  createRequest: (target, { libraryName }): StagedCreate => {
    if (target.kind === 'exclusive_platform') return {
      kind: 'platform', body: {
        profile: target.profile, url: target.issuer, clientId: target.clientId, name: toolName(libraryName),
        siteUrl: target.siteUrl, serviceUrl: target.serviceUrl, deploymentIds: [target.deploymentId],
      },
    };
    if (target.kind === 'platform_deployment') return {
      kind: 'deployment', platformId: target.platformId, body: { deploymentId: target.deploymentId },
    };
    throw new Error('Canvas cannot create a shared deployment');
  },
};

function checkCreate({ siteUrl, serviceUrl, profile }: Parameters<ConnectionSetup['checkCreate']>[0]): ReturnType<ConnectionSetup['checkCreate']> {
  const data = profiles[profile.id];
  if (!data) return { ok: false, field: 'profile' };
  if (serviceUrl !== undefined && !data.serviceUrl) return { ok: false, field: 'serviceUrl' };
  const rules = { ownHosts: [], profileFixedHosts: fixedHostsOf([profile.issuer ?? null, profile.authenticationEndpoint ?? null, profile.accesstokenEndpoint ?? null, profile.jwksUrl ?? null]),
    ...(data.refusedHostSuffixes ? { selfHosted: { refusedSuffixes: [...data.refusedHostSuffixes], allFixedHosts: [] } } : {}) };
  const site = checkSiteUrl(siteUrl, rules);
  if (!site.ok) return { ok: false, field: 'siteUrl', rule: site.rule };
  const service = serviceUrl === undefined ? site : checkSiteUrl(serviceUrl, rules);
  if (!service.ok) return { ok: false, field: 'serviceUrl', rule: service.rule };
  return { ok: true, siteUrl: site.origin, serviceUrl: service.origin };
}

// Small pieces that every provider adapter and the connection routes share (no I/O).
type PublicUrls = Parameters<ConnectionSetup['toolConfiguration']>[0]['urls'];

/** The tool account of the app in the LTI service (contract §4.1). */
export const TOOL_ACCOUNT = 'cogniate';

/** Tool name in the LMS: `Cogniate (<library name>)`, ASCII only (flows §6a). */
export function toolName(libraryName: string): string {
  const ascii = libraryName.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
  return `Cogniate (${ascii || 'Library'})`;
}

/** The protocol URLs of the tool account (all from PUBLIC_LTI_URL). */
export function toolUrls(urls: PublicUrls): { launch: string; login: string; keys: string } {
  return {
    launch: `${urls.lti}/lti/launch/${TOOL_ACCOUNT}`,
    login: `${urls.lti}/lti/login/${TOOL_ACCOUNT}`,
    keys: `${urls.lti}/lti/keys/${TOOL_ACCOUNT}`,
  };
}

/** A value of a strict provider body (app contract §4.4): 1 to 255 printable ASCII characters without spaces. */
export const PRINTABLE_ID = /^[\x21-\x7e]{1,255}$/;
/** An approval code: 43 base64url characters (256 bits). */
export const GRANT_CODE = /^[A-Za-z0-9_-]{43}$/;

export type StrictBodyResult = { ok: true; values: Record<string, string> } | { ok: false; fields: string[] };

/**
 * Strict body rule of app contract §4.4: every key must be listed; every required key must be present; values are
 * trimmed strings of the right form. The answer lists every bad key (unknown, missing or malformed), in body order
 * first, then the missing required keys.
 */
export function parseStrictBody(body: unknown, spec: { required: readonly string[]; optional?: readonly string[] }): StrictBodyResult {
  const optional = spec.optional ?? [];
  const known = new Set([...spec.required, ...optional]);
  const obj = body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const bad: string[] = [];
  const values: Record<string, string> = {};
  for (const [key, raw] of Object.entries(obj)) {
    if (!known.has(key)) { bad.push(key); continue; }
    const v = typeof raw === 'string' ? raw.trim() : null;
    const ok = v !== null && (key === 'grantCode' ? GRANT_CODE.test(v) : PRINTABLE_ID.test(v));
    if (!ok) bad.push(key);
    else values[key] = v;
  }
  for (const key of spec.required) if (!(key in obj)) bad.push(key);
  return bad.length > 0 ? { ok: false, fields: [...new Set(bad)] } : { ok: true, values };
}

export default setup;
