import { expect, it } from 'vitest';
import setup, { default as canvasProvider, parseCanvasBody } from './app.ts';
import manifest from './manifest.ts';
type BindingTarget = Parameters<NonNullable<typeof canvasProvider.createRequest>>[0];
type InitialTargetContext = Parameters<NonNullable<typeof canvasProvider.initialTarget>>[0];

const toolContext = { toolAccountId: 'selected-account', toolUrls: { login: 'https://login.test/start', launch: 'https://launch.test/start', keys: 'https://keys.test/public', register: 'https://register.test/start', ltiOrigin: 'https://lti.test' } };
const grantCode = 'g'.repeat(43);
const context: InitialTargetContext = {
  connection: { id: 'con_canvas', libraryId: 'lib_a', name: 'School', channel: 'canvas', profile: 'canvas-cloud-production', siteUrl: 'https://canvas.school.edu', serviceUrl: 'https://school.instructure.com', status: 'pending', ltiPlatformId: null },
  values: { clientId: 'client', deploymentId: 'deployment', grantCode },
  profile: { id: 'canvas-cloud-production', lms: 'canvas', issuer: 'https://canvas.instructure.com' },
  sharedPlatform: null,
};

it('parses only client id, deployment id and grant code with the common strict parser', () => {
  expect(parseCanvasBody({ clientId: ' client ', deploymentId: ' deployment ', grantCode })).toEqual({ ok: true, values: context.values });
  for (const field of ['issuer', 'authenticationEndpoint', 'jwksUrl', 'clientSecret']) {
    expect(parseCanvasBody({ ...context.values, [field]: 'unexpected' })).toEqual({ ok: false, fields: [field] });
  }
  expect(parseCanvasBody({ clientId: 'has space', deploymentId: 'd', grantCode: '' })).toEqual({ ok: false, fields: ['clientId', 'grantCode'] });
  expect(parseCanvasBody({ deploymentId: 'd', grantCode })).toEqual({ ok: false, fields: ['clientId'] });
});

it('describes the exclusive target and staged create without adding authority or secrets', () => {
  const target = canvasProvider.initialTarget!(context);
  expect(target).toEqual({
    kind: 'exclusive_platform', profile: 'canvas-cloud-production', issuer: 'https://canvas.instructure.com',
    clientId: 'client', deploymentId: 'deployment', siteUrl: context.connection.siteUrl, serviceUrl: context.connection.serviceUrl, platformId: null,
  });
  expect(canvasProvider.createRequest!(target, { ...toolContext, libraryName: 'Library A' })).toEqual({
    kind: 'platform', body: {
      profile: 'canvas-cloud-production', url: 'https://canvas.instructure.com', clientId: 'client', name: 'Cogniate (Library A)', siteUrl: context.connection.siteUrl,
      serviceUrl: context.connection.serviceUrl, deploymentIds: ['deployment'],
    },
  });
  expect(JSON.stringify(target)).not.toContain(grantCode);
  expect(canvasProvider.initialTarget!({ ...context, profile: { ...context.profile, issuer: '{siteUrl}' }, connection: { ...context.connection, profile: 'canvas-self-hosted' } })).toMatchObject({ issuer: context.connection.siteUrl });
  expect(canvasProvider.createRequest!({ kind: 'platform_deployment', platformId: 'plt_own', deploymentId: 'dep_2' }, { ...toolContext, libraryName: 'Library A' })).toEqual({
    kind: 'deployment', platformId: 'plt_own', body: { deploymentId: 'dep_2' },
  });
});

it.each([
  ['canvas-cloud-production', 'https://canvas.instructure.com'],
  ['canvas-cloud-beta', 'https://canvas.beta.instructure.com'],
  ['canvas-cloud-test', 'https://canvas.test.instructure.com'],
  ['canvas-self-hosted', 'https://canvas.school.edu'],
  ['canvas-sim-cloud', 'https://canvas.sim.test'],
  // The target, not a new profile lookup or a hardcoded default, is authoritative for S1.
  ['canvas-cloud-production', 'https://saved-issuer.example.test'],
])('pins the %s S1 URL to the committed issuer %s', (profile, issuer) => {
  const target: BindingTarget = {
    kind: 'exclusive_platform', profile, issuer, clientId: 'saved-client', deploymentId: 'saved-deployment',
    siteUrl: 'https://canvas.school.edu', serviceUrl: 'https://school.instructure.com', platformId: null,
  };
  expect(canvasProvider.createRequest!(target, { ...toolContext, libraryName: 'Library A' })).toEqual({
    kind: 'platform',
    body: {
      profile, url: issuer, clientId: 'saved-client', name: 'Cogniate (Library A)',
      siteUrl: 'https://canvas.school.edu', serviceUrl: 'https://school.instructure.com',
      deploymentIds: ['saved-deployment'],
    },
  });
});

it('supplies the four exact admin rows, profile labels and capability limits', () => {
  expect(canvasProvider.toolConfiguration({
    ...toolContext,
    urls: { lti: 'https://lti.test', app: 'https://app.test', content: 'https://content.test' },
    libraryName: 'Library A', sharedClientId: null,
  })).toEqual([
    { key: 'key_name', label: 'Key Name', value: 'Cogniate (Library A)' },
    { key: 'redirect_uris', label: 'Redirect URIs', value: toolContext.toolUrls.launch },
    { key: 'method', label: 'Method', value: 'Paste JSON' },
    { key: 'lti_json', label: 'LTI 1.3 Configuration', value: 'Paste the JSON from "Copy JSON" or "Download JSON". Do not edit it.' },
  ]);
  expect(manifest.capabilities).toMatchObject({ 'deployments.multiple': true, 'setup.artifacts': ['developer-key-json'] });
  expect(canvasProvider.profiles['canvas-sim-cloud']?.label).toBe('Canvas cloud (simulation)');
  expect(canvasProvider.profiles.blackboard).toBeUndefined();
  expect(canvasProvider.profiles['canvas-self-hosted']?.refusedHostSuffixes).toEqual(['instructure.com', 'canvaslms.com']);
});

import profiles from './lti-profiles.ts';

it('AC-LA-E1-07-10: offered profile data matches LTI traits and covers every registration profile', () => {
  for (const [id, data] of Object.entries(setup.profiles)) {
    const source = profiles.find((p) => p.id === id);
    expect(source, id).toBeDefined();
    expect(data.sharing, id).toBe(source!.sharing);
    expect(data.serviceUrl, id).toBe(source!.serviceUrl);
    expect(data.refusedHostSuffixes, id).toEqual('refusedHostSuffixes' in source! ? source!.refusedHostSuffixes : undefined);
    expect(setup.sharingOf(id), id).toBe(source!.sharing);
  }
  for (const registration of manifest.registration) {
    for (const id of registration.profiles) expect(setup.profiles[id], id).toBeDefined();
  }
});
