import type { ConnectionSetup, BindingTarget, PlatformBodyResult, StagedCreate, ToolRow } from '../../../services/cogniate-app/src/kernel/ports.ts';
import { checkSiteUrl, fixedHostsOf } from '@cogniate/shared/channel';
// Blackboard Learn (ADR-011 §7, app contract §4.4, §4.5): one shared platform (the Cogniate Application ID); each
// school is one deployment that one connection binds with an operator approval grant.

const profiles: ConnectionSetup['profiles'] = {
  blackboard: { sharing: 'shared', serviceUrl: false, label: 'Blackboard Learn' },
  'blackboard-sim': { sharing: 'shared', serviceUrl: false, label: 'Blackboard Learn (simulation)' },
};

/** App contract §4.5: the 9 Learn tool registration rows, in order. */
export function blackboardToolRows(urls: Parameters<typeof toolUrls>[0], sharedClientId: string | null): ToolRow[] {
  const t = toolUrls(urls);
  return [
    { key: 'client_id', label: 'Client ID', value: sharedClientId ?? '' },
    { key: 'login_initiation_url', label: 'Login Initiation URL', value: t.login },
    { key: 'tool_redirect_url', label: 'Tool Redirect URL(s)', value: t.launch },
    { key: 'tool_jwks_url', label: 'Tool JWKS URL', value: t.keys },
    { key: 'tool_status', label: 'Tool Status', value: 'Approved' },
    { key: 'user_fields', label: 'User Fields to Send', value: 'Role in Course only. Do not send Name or Email Address.' },
    { key: 'grade_service', label: 'Allow grade service access', value: 'Yes' },
    { key: 'membership_service', label: 'Allow Membership Service access', value: 'Yes' },
    { key: 'placement', label: 'Placement', value: `Cogniate: type Deep Linking, Target Link URI ${t.launch}, student access off` },
  ];
}

/**
 * `{ deploymentId, grantCode, clientId? }` (app contract §4.4). A sent `clientId` must equal the local client id (the
 * snapshot, then the persisted platform); when there is none (an old pending 011 row), only its form is checked.
 */
export function parseBlackboardBody(body: unknown, sharedClientId: string | null): PlatformBodyResult {
  const parsed = parseStrictBody(body, { required: ['deploymentId', 'grantCode'], optional: ['clientId'] });
  if (!parsed.ok) return parsed;
  const { clientId, deploymentId, grantCode } = parsed.values;
  if (clientId !== undefined && sharedClientId !== null && clientId !== sharedClientId) return { ok: false, fields: ['clientId'] };
  return { ok: true, values: { clientId: sharedClientId ?? '', deploymentId: deploymentId!, grantCode: grantCode! } };
}

const setup: ConnectionSetup = {
  channel: 'blackboard', profiles,
  sharingOf: (id) => profiles[id]?.sharing ?? null,
  checkCreate: checkCreate,
  toolConfiguration: (ctx) => blackboardToolRows(ctx.urls, ctx.sharedClientId),
  parseBindingBody: (body, ctx) => parseBlackboardBody(body, ctx.sharedClientId),
  // The pinned shared platform of the snapshot (app contract §4.7.1 "Target"; local data only).
  initialTarget: (ctx): BindingTarget => {
    if (!ctx.sharedPlatform) throw new Error('blackboard target needs the snapshot shared platform id');
    return { kind: 'shared_deployment', platformId: ctx.sharedPlatform.id, deploymentId: ctx.values.deploymentId, siteUrl: ctx.connection.siteUrl };
  },
  createRequest: (target): StagedCreate => {
    if (target.kind !== 'shared_deployment') throw new Error(`blackboard cannot create a ${target.kind} target`);
    return { kind: 'deployment', platformId: target.platformId, body: { deploymentId: target.deploymentId, siteUrl: target.siteUrl } };
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
