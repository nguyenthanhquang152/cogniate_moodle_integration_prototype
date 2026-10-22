// Canvas setup data and pure adapter functions (app contract §4.4–§4.5).
// The common engine owns grants, staging, refs, approval and cleanup.
import { parseStrictBody, toolName, toolUrls } from './common.ts';
import type { BindingTarget, PlatformBodyResult, ProviderAdapter, StagedCreate } from './types.ts';

const profileLabels: Readonly<Record<string, string>> = {
  'canvas-cloud-production': 'Instructure-hosted Canvas (production)',
  'canvas-cloud-beta': 'Instructure-hosted Canvas (beta)',
  'canvas-cloud-test': 'Instructure-hosted Canvas (test)',
  'canvas-self-hosted': 'Self-hosted Canvas',
  'canvas-sim-cloud': 'Canvas cloud (simulation)',
};

export function parseCanvasBody(body: unknown): PlatformBodyResult {
  const parsed = parseStrictBody(body, { required: ['clientId', 'deploymentId', 'grantCode'] });
  if (!parsed.ok) return parsed;
  return { ok: true, values: {
    clientId: parsed.values.clientId!, deploymentId: parsed.values.deploymentId!, grantCode: parsed.values.grantCode!,
  } };
}

export const canvasProvider: ProviderAdapter = {
  lms: 'canvas', lmsName: 'Canvas', label: 'Canvas', methods: ['manual'],
  capabilities: { dynamicRegistration: false, operatorApproval: true, webServices: false, courseShell: false, addDeployment: true, canvasConfiguration: true },
  defaultProfile: 'canvas-cloud-production', acceptsServiceUrl: true,
  sharingOf: (id) => profileLabels[id] ? 'exclusive' : null,
  siteRuleSuffixes: (profileId) => profileId === 'canvas-self-hosted' ? ['instructure.com', 'canvaslms.com'] : null,
  profileLabel: (profileId) => profileLabels[profileId] ?? null,
  toolConfiguration: ({ urls, libraryName }) => [
    { key: 'key_name', label: 'Key Name', value: toolName(libraryName) },
    { key: 'redirect_uris', label: 'Redirect URIs', value: toolUrls(urls).launch },
    { key: 'method', label: 'Method', value: 'Paste JSON' },
    { key: 'lti_json', label: 'LTI 1.3 Configuration', value: 'Paste the JSON from "Copy JSON" or "Download JSON". Do not edit it.' },
  ],
  parsePlatformBody: parseCanvasBody,
  initialTarget: ({ connection, values, profile }): BindingTarget => {
    if (profile.lms !== 'canvas' || !profile.issuer) throw new Error('Canvas target needs a Canvas profile issuer');
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
