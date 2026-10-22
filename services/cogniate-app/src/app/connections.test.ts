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

it('BD-A1-11: the HTTP edge accepts lms or channel and rejects unequal aliases before writing', async () => {
  t = await testApp();
  const cookie = await t.login(THANH);
  const create = (alias: { lms?: string; channel?: string }) => t.app.inject({ method: 'POST', url: '/app-api/connections', headers: t.writeHeaders(cookie),
    payload: { name: 'School', siteUrl: 'https://school.test', method: 'manual', ...alias } });
  for (const alias of [{ lms: 'moodle' }, { channel: 'moodle' }, { lms: 'moodle', channel: 'moodle' }]) {
    const answer = await create(alias);
    expect(answer.statusCode).toBe(201);
    expect(answer.json()).toMatchObject({ lms: 'moodle', channel: 'moodle', channelName: 'Moodle', bindingAuthority: 'self' });
  }
  const before = t.db.prepare('SELECT count(*) AS n FROM connection').get();
  const refused = await create({ lms: 'moodle', channel: 'canvas' });
  expect(refused.statusCode).toBe(400);
  expect(refused.json()).toMatchObject({ details: { message: 'INVALID_REQUEST', field: 'channel' } });
  expect(t.db.prepare('SELECT count(*) AS n FROM connection').get()).toEqual(before);
});

it('BD-A1-24: the connection DTO reports its stored binding authority', async () => {
  t = await testApp();
  const cookie = await t.login(THANH);
  const created = await t.app.inject({ method: 'POST', url: '/app-api/connections', headers: t.writeHeaders(cookie),
    payload: { name: 'School', siteUrl: 'https://school.test', method: 'manual' } });
  const id = created.json<{ id: string }>().id;
  t.db.prepare("UPDATE connection SET binding_authority = 'operatorGrant' WHERE id = ?").run(id);
  const read = await t.app.inject({ method: 'GET', url: `/app-api/connections/${id}`, headers: { cookie } });
  expect(read.json()).toMatchObject({ channel: 'moodle', bindingAuthority: 'operatorGrant' });
});


it('BD-A1-35: malformed binding values and origin failures keep both frozen descriptions', async () => {
  t = await testApp();
  const cookie = await t.login(THANH);
  const created = await t.app.inject({ method: 'POST', url: '/app-api/connections', headers: t.writeHeaders(cookie),
    payload: { name: 'School', siteUrl: 'https://school.test', method: 'manual' } });
  const id = created.json<{ id: string }>().id;
  const bind = (payload: object) => t.app.inject({ method: 'PUT', url: `/app-api/connections/${id}/platform`, headers: t.writeHeaders(cookie), payload });
  const missing = await bind({});
  expect(missing.statusCode).toBe(422);
  expect(missing.json()).toMatchObject({ details: { message: 'INVALID_PLATFORM_VALUES', description: 'Some values are missing or not valid.' } });
  const origin = await bind({ issuer: 'https://school.test', clientId: 'c', deploymentId: 'd', authenticationEndpoint: 'https://school.test/auth',
    accessTokenEndpoint: 'https://other.test/token', jwksUrl: 'https://school.test/keys' });
  expect(origin.statusCode).toBe(422);
  expect(origin.json()).toMatchObject({ details: { message: 'INVALID_PLATFORM_VALUES', description: 'The URLs must be https and on the Moodle site of this connection.', fields: ['accessTokenEndpoint'] } });
});

it('LA-IC-17: a strict manual body refuses an unknown key with 422 and details.fields', async () => {
  t = await testApp();
  const cookie = await t.login(THANH);
  const created = await t.app.inject({ method: 'POST', url: '/app-api/connections', headers: t.writeHeaders(cookie),
    payload: { name: 'School', siteUrl: 'https://school.test', method: 'manual' } });
  const id = created.json<{ id: string }>().id;
  t.lti.calls.length = 0;
  const refused = await t.app.inject({ method: 'PUT', url: `/app-api/connections/${id}/platform`, headers: t.writeHeaders(cookie),
    payload: { issuer: 'https://school.test', clientId: 'c', deploymentId: 'd', authenticationEndpoint: 'https://school.test/auth',
      accessTokenEndpoint: 'https://school.test/token', jwksUrl: 'https://school.test/keys', label: 'unexpected' } });
  expect(refused.statusCode).toBe(422);
  expect(refused.json()).toMatchObject({ details: { message: 'INVALID_PLATFORM_VALUES', fields: ['label'] } });
  expect(t.lti.calls).toEqual([]);
});
