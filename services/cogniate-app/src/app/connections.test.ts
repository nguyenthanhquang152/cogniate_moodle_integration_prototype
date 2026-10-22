// LA-E1-01 (step S1): the provider list ignores a profile that no adapter owns (app API delta §2, §8).
import { afterEach, expect, it } from 'vitest';
import type { LtiProviderProfile } from '../clients/lti-client.ts';
import type { TestApp } from '../testkit.ts';
import { THANH, testApp } from '../testkit.ts';

let t: TestApp;
afterEach(async () => {
  await t?.app.close();
});

/** A profile row of an LMS that no app adapter owns (shape of LTI contract §9.3). */
const unknownProfile: LtiProviderProfile = {
  id: 'x-new-cloud', lms: 'x-new', label: 'X new cloud', sharing: 'exclusive', issuer: 'https://x-new.test',
  authenticationEndpoint: 'https://x-new.test/auth', accesstokenEndpoint: 'https://x-new.test/token', jwksUrl: 'https://x-new.test/jwks',
  siteUrlOn: 'platform', serviceUrl: false, simulation: false, sharedPlatform: null,
};

it('AC-LA-E1-01-02: with one unknown profile, the three baseline entries keep their values and order; the app logs it once', async () => {
  t = await testApp();
  t.lti.addSharedPlatform('blackboard-sim', 'qa-bb-app');
  const cookie = await t.login(THANH);
  const list = async (): Promise<string> => {
    const r = await t.app.inject({ method: 'GET', url: '/app-api/lms-providers', headers: { cookie } });
    expect(r.statusCode).toBe(200);
    return r.body;
  };
  const baseline = await list();
  expect((JSON.parse(baseline) as { lms: Array<{ lms: string }> }).lms.map((e) => e.lms)).toEqual(['moodle', 'canvas', 'blackboard']);
  // The unknown row comes between two known rows, so a change of order would show.
  t.lti.providers.splice(1, 0, unknownProfile);
  expect(await list()).toBe(baseline);
  expect(await list()).toBe(baseline);
  expect(t.logs.filter((l) => l.event === 'channel_profile_unknown')).toEqual([expect.objectContaining({ level: 'warn', profile: 'x-new-cloud' })]);
});
