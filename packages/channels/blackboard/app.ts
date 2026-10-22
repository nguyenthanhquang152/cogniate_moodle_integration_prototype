import { parseStrictBody } from '@cogniate/channel-kernel/setup';
import type { ConnectionSetup, BindingTarget, PlatformBodyResult, StagedCreate, ToolRow, ToolUrls } from '../../../services/cogniate-app/src/kernel/ports.ts';
import { checkSiteUrl, fixedHostsOf } from '@cogniate/shared/channel';
// Blackboard Learn (ADR-011 §7, app contract §4.4, §4.5): one shared platform (the Cogniate Application ID); each
// school is one deployment that one connection binds with an operator approval grant.

const profiles: ConnectionSetup['profiles'] = {
  blackboard: { sharing: 'shared', serviceUrl: false, label: 'Blackboard Learn' },
  'blackboard-sim': { sharing: 'shared', serviceUrl: false, label: 'Blackboard Learn (simulation)' },
};

/** App contract §4.5: the 9 Learn tool registration rows, in order. */
export function blackboardToolRows(t: ToolUrls, sharedClientId: string | null): ToolRow[] {
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
  toolConfiguration: (ctx) => blackboardToolRows(ctx.toolUrls, ctx.sharedClientId),
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

export default setup;
