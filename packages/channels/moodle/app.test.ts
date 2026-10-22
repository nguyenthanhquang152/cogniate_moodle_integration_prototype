import { expect, it } from 'vitest';
import setup, { badPlatformFields } from './app.ts';
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
