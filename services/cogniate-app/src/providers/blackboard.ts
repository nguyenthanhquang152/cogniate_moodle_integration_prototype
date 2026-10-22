// Blackboard Learn (ADR-011 §7, app contract §4.4, §4.5): one shared platform (the Cogniate Application ID); each
// school is one deployment that one connection binds with an operator approval grant.
import { parseStrictBody, toolUrls } from './common.ts';
import type { BindingTarget, PlatformBodyResult, ProviderAdapter, StagedCreate, ToolRow } from './types.ts';

const PROFILE_LABELS: Readonly<Record<string, string>> = {
  blackboard: 'Blackboard Learn',
  'blackboard-sim': 'Blackboard Learn (simulation)',
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

export const blackboardProvider: ProviderAdapter = {
  lms: 'blackboard',
  lmsName: 'Blackboard',
  label: 'Blackboard Learn',
  methods: ['manual'],
  capabilities: { dynamicRegistration: false, operatorApproval: true, webServices: false, courseShell: false, addDeployment: false, canvasConfiguration: false },
  defaultProfile: 'blackboard',
  acceptsServiceUrl: false,
  sharingOf: (id) => PROFILE_LABELS[id] ? 'shared' : null,
  siteRuleSuffixes: () => null,
  profileLabel: (id) => PROFILE_LABELS[id] ?? null,
  toolConfiguration: (ctx) => blackboardToolRows(ctx.urls, ctx.sharedClientId),
  parsePlatformBody: (body, ctx) => parseBlackboardBody(body, ctx.sharedClientId),
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
