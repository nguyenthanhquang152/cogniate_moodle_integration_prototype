import { setupQaPlatform, qaLaunchLtik, resourceLinkClaims } from '../../lib/qa-platform';
import { apiKey } from '../../lib/lti';
import { AGS, LTI, admin, assert, expectStatus, idToken, m1Test, unique } from './client';

m1Test('M1-12.common.standard-origin-control', 'standard keeps the existing signed foreign-AGS launch behavior', async () => {
  const p = await setupQaPlatform(apiKey('cogniate'), unique('M1-standard-origin'));
  const ltik = await qaLaunchLtik(p, (login) => ({ ...resourceLinkClaims(p, login),
    [AGS]: { lineitems: 'https://evil.test/lineitems', scope: ['https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly'] } }));
  expectStatus(await idToken(ltik), 200);
});
m1Test('M1-14.common.standard-name-control', 'standard keeps name data while provider profiles minimize it', async () => {
  const p = await setupQaPlatform(apiKey('cogniate'), unique('M1-standard-name'));
  const ltik = await qaLaunchLtik(p, (login) => ({ ...resourceLinkClaims(p, login), name: 'QA legacy name' }));
  const token = await idToken(ltik); expectStatus(token, 200); assert.equal(token.json.user.name, 'QA legacy name');
});
m1Test('M1-25.common.standard-site-control', 'standard reports issuer origin for site and service', async () => {
  const p = await setupQaPlatform(apiKey('cogniate'), unique('M1-standard-site'));
  const ltik = await qaLaunchLtik(p, (login) => resourceLinkClaims(p, login));
  const token = await idToken(ltik); expectStatus(token, 200);
  assert.equal(token.json.platform.siteUrl, 'https://qa-platform.test');
  assert.equal(token.json.platform.serviceUrl, 'https://qa-platform.test');
  assert.equal(token.json.platform.profile, 'standard');
});
m1Test('M1-07.common.standard-generation', 'legacy generation remains zero across deployment activation', async () => {
  const p = await setupQaPlatform(apiKey('cogniate'), unique('M1-standard-generation'));
  const first = await admin('GET', '/api/platforms/' + p.platformId); expectStatus(first, 200);
  const d = first.json.deployments[0].deploymentId;
  expectStatus(await admin('PATCH', `/api/platforms/${p.platformId}/deployments/${encodeURIComponent(d)}`, { active: false }), 200);
  const on = await admin('PATCH', `/api/platforms/${p.platformId}/deployments/${encodeURIComponent(d)}`, { active: true });
  expectStatus(on, 200); assert.equal(on.json.bindingGeneration, 0);
  expectStatus(await admin('POST', `/api/platforms/${p.platformId}/deployments`, {
    deploymentId: 'extra', siteUrl: 'https://qa-platform.test',
  }), 400, 'INVALID_REQUEST');
});
m1Test('M1-39.common.missing-family-control', 'missing and Moodle product families pass the standard profile check', async () => {
  const p = await setupQaPlatform(apiKey('cogniate'), unique('M1-standard-family'));
  for (const family of [undefined, 'moodle']) {
    const ltik = await qaLaunchLtik(p, (login) => ({ ...resourceLinkClaims(p, login),
      ...(family ? { [LTI + 'tool_platform']: { product_family_code: family } } : {}) }));
    expectStatus(await idToken(ltik), 200);
  }
});
