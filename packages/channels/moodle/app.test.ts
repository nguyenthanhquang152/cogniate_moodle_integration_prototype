import { expect, it } from 'vitest';
import setup, { badPlatformFields } from './app.ts';
  it('badPlatformFields: issuer origin = siteUrl; endpoints on the issuer origin; https', () => {
    const v = { issuer: 'https://moodle.test', clientId: 'c', deploymentId: '1', authenticationEndpoint: 'https://moodle.test/a', accessTokenEndpoint: 'https://moodle.test/t', jwksUrl: 'https://moodle.test/k' };
    expect(badPlatformFields('https://moodle.test', v)).toEqual([]);
    expect(badPlatformFields('https://other.test', v)).toEqual(['issuer']);
    expect(badPlatformFields('https://moodle.test', { ...v, accessTokenEndpoint: 'http://moodle.test/t', authenticationEndpoint: 'https://moodle.test:8443/a' })).toEqual(['authenticationEndpoint', 'accessTokenEndpoint']);
  });
import manifest from './manifest.ts';
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


it.each([[], 1, true, 'invalid'])('keeps the manual parser body error for non-object input %j', (body) => {
  expect(setup.parseBindingBody(body, { siteUrl: 'https://moodle.test', sharedClientId: null, purpose: 'initial' }))
    .toEqual({ ok: false, fields: ['body'] });
});
