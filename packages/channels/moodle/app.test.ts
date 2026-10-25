import { expect, it } from 'vitest';
import setup, { badPlatformFields, moodleToolRows } from './app.ts';
  it('badPlatformFields: issuer origin = siteUrl; endpoints on the issuer origin; https', () => {
    const v = { issuer: 'https://moodle.test', clientId: 'c', deploymentId: '1', authenticationEndpoint: 'https://moodle.test/a', accessTokenEndpoint: 'https://moodle.test/t', jwksUrl: 'https://moodle.test/k' };
    expect(badPlatformFields('https://moodle.test', v)).toEqual([]);
    expect(badPlatformFields('https://other.test', v)).toEqual(['issuer']);
    expect(badPlatformFields('https://moodle.test', { ...v, accessTokenEndpoint: 'http://moodle.test/t', authenticationEndpoint: 'https://moodle.test:8443/a' })).toEqual(['authenticationEndpoint', 'accessTokenEndpoint']);
  });




it.each([[], 1, true, 'invalid'])('keeps the manual parser body error for non-object input %j', (body) => {
  expect(setup.parseBindingBody(body, { siteUrl: 'https://moodle.test', sharedClientId: null, purpose: 'initial' }))
    .toEqual({ ok: false, fields: ['body'] });
});

it('AC-LA-E3-07-03 (unit part): row 13 (nrps) says "Do not use this service"; still 16 rows', () => {
  const urls = { login: 'https://lti.test/login', launch: 'https://lti.test/launch', keys: 'https://lti.test/keys', register: 'https://lti.test/register', ltiOrigin: 'https://lti.test' };
  const rows = moodleToolRows(urls, 'Library');
  expect(rows).toHaveLength(16);
  expect(rows[12]).toEqual({ key: 'nrps', label: 'IMS LTI Names and Role Provisioning', value: 'Do not use this service' });
});
