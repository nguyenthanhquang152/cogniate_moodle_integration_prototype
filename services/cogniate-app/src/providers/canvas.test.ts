import { expect, it } from 'vitest';
import { canvasProvider, parseCanvasBody } from './canvas.ts';
import type { InitialTargetContext } from './types.ts';

const grantCode = 'g'.repeat(43);
const context: InitialTargetContext = {
  connection: { id: 'con_canvas', libraryId: 'lib_a', name: 'School', lms: 'canvas', profile: 'canvas-cloud-production', siteUrl: 'https://canvas.school.edu', serviceUrl: 'https://school.instructure.com', status: 'pending', ltiPlatformId: null },
  values: { clientId: 'client', deploymentId: 'deployment', grantCode },
  profile: { id: 'canvas-cloud-production', lms: 'canvas', label: 'Canvas', sharing: 'exclusive', issuer: 'https://canvas.instructure.com', authenticationEndpoint: 'https://sso.canvaslms.com/api/lti/authorize_redirect', accesstokenEndpoint: '{serviceUrl}/login/oauth2/token', jwksUrl: 'https://sso.canvaslms.com/api/lti/security/jwks', siteUrlOn: 'platform', serviceUrl: true, simulation: false, sharedPlatform: null },
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
  expect(canvasProvider.createRequest!(target, { libraryName: 'Library A' })).toEqual({
    kind: 'platform', body: {
      profile: 'canvas-cloud-production', clientId: 'client', name: 'Cogniate (Library A)', siteUrl: context.connection.siteUrl,
      serviceUrl: context.connection.serviceUrl, deploymentIds: ['deployment'],
    },
  });
  expect(JSON.stringify(target)).not.toContain(grantCode);
  expect(canvasProvider.initialTarget!({ ...context, profile: { ...context.profile, issuer: '{siteUrl}' }, connection: { ...context.connection, profile: 'canvas-self-hosted' } })).toMatchObject({ issuer: context.connection.siteUrl });
  expect(canvasProvider.createRequest!({ kind: 'platform_deployment', platformId: 'plt_own', deploymentId: 'dep_2' }, { libraryName: 'Library A' })).toEqual({
    kind: 'deployment', platformId: 'plt_own', body: { deploymentId: 'dep_2' },
  });
});

it('supplies the four exact admin rows, profile labels and capability limits', () => {
  expect(canvasProvider.toolConfiguration({
    urls: { lti: 'https://lti.test', app: 'https://app.test', content: 'https://content.test', moodle: 'https://moodle.test' },
    libraryName: 'Library A', sharedClientId: null,
  })).toEqual([
    { key: 'key_name', label: 'Key Name', value: 'Cogniate (Library A)' },
    { key: 'redirect_uris', label: 'Redirect URIs', value: 'https://lti.test/lti/launch/cogniate' },
    { key: 'method', label: 'Method', value: 'Paste JSON' },
    { key: 'lti_json', label: 'LTI 1.3 Configuration', value: 'Paste the JSON from "Copy JSON" or "Download JSON". Do not edit it.' },
  ]);
  expect(canvasProvider.capabilities).toEqual({ dynamicRegistration: false, operatorApproval: true, webServices: false, courseShell: false, addDeployment: true, canvasConfiguration: true });
  expect(canvasProvider.profileLabel('canvas-sim-cloud')).toBe('Canvas cloud (simulation)');
  expect(canvasProvider.profileLabel('blackboard')).toBeNull();
  expect(canvasProvider.siteRuleSuffixes('canvas-self-hosted')).toEqual(['instructure.com', 'canvaslms.com']);
});
