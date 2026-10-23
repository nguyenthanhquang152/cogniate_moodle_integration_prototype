// LA-E2-03: the kernel admin-value setup adapter (LA-ADR-01 D2 FieldSpec.default, D5) and its create rules.
import type { ChannelManifest } from '@cogniate/channel-kernel';
import { buildChannelRegistry } from '@cogniate/channel-kernel';
import { afterEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../../testkit.ts';
import { TEST_CHANNELS, TEST_URLS, THANH, testApp } from '../../testkit.ts';
import type { SetupConnection } from '../ports.ts';
import { servedByKernel, setupOf } from '../setup.ts';
import { toolContext } from './common.ts';
import { adminValueSetup } from './admin-value.ts';

const SITE = 'https://lms.school.edu';
const AGS = ['https://purl.imsglobal.org/spec/lti-ags/scope/lineitem', 'https://purl.imsglobal.org/spec/lti-ags/scope/score'];

/** An admin-value channel as lti-generic is (no app.ts), with a {siteUrl} default on the issuer. */
const manifest: ChannelManifest = {
  ...TEST_CHANNELS.channel('moodle')!, id: 'zz-admin', names: { text: 'your LMS', label: 'ZZ admin platform' },
  card: { ...TEST_CHANNELS.channel('moodle')!.card, order: 90 },
  registration: [
    { method: 'dynamic', authority: 'self', profiles: ['zz-admin'], defaultProfile: 'zz-admin' },
    { method: 'manual', authority: 'operatorGrant', profiles: ['zz-admin'], defaultProfile: 'zz-admin' },
  ],
  capabilities: { 'registration.scopes': AGS, 'deployments.multiple': true, 'records.reporters': ['lti-ags'] },
  lti: { guardedFamilies: [], toolConfiguration: 'none' },
  setup: {
    createFields: [{ key: 'siteUrl', label: 'LMS site URL', kind: 'origin', required: true }],
    bindingFields: [
      { key: 'issuer', label: 'Issuer', kind: 'url', required: true, method: 'manual', default: '{siteUrl}' },
      { key: 'clientId', label: 'Client ID', kind: 'id', required: true, method: 'manual' },
    ],
  },
  storage: undefined,
};
const registry = buildChannelRegistry([...TEST_CHANNELS.channels(), manifest]
  .map((m) => ({ folder: `/test/${m.id}`, manifest: m, appAdapter: TEST_CHANNELS.appAdapter(m.id) ?? undefined })), { simulations: true });
const setup = setupOf(registry, 'zz-admin')!;

const CODE = 'A'.repeat(43);
const full = {
  issuer: `${SITE}/sakai`, clientId: 'client-1', deploymentId: 'dep-1', authenticationEndpoint: `${SITE}/auth`,
  accessTokenEndpoint: 'https://token.provider.test/token', jwksUrl: `${SITE}/jwks`, grantCode: CODE,
};
const ctx = { siteUrl: SITE, sharedClientId: null, purpose: 'initial' as const };
const without = (keys: string[]) => Object.fromEntries(Object.entries(full).filter(([k]) => !keys.includes(k)));
const connection: SetupConnection = { id: 'con_1', libraryId: 'lib', name: 'School', channel: 'zz-admin', profile: 'zz-admin', siteUrl: SITE, serviceUrl: SITE, status: 'pending', ltiPlatformId: null };

describe('AC-LA-E2-03-06: the admin-value strict body', () => {
  it('AC-LA-E2-03-06: takes the eight keys; the issuer may have a path, other endpoints may be on another https host', () => {
    expect(setup.parseBindingBody({ ...full, tokenAudience: 'https://token.provider.test/aud' }, ctx)).toEqual({ ok: true, values: {
      clientId: 'client-1', deploymentId: 'dep-1', grantCode: CODE,
      adminValues: { issuer: `${SITE}/sakai`, authenticationEndpoint: `${SITE}/auth`, accessTokenEndpoint: 'https://token.provider.test/token', jwksUrl: `${SITE}/jwks`, tokenAudience: 'https://token.provider.test/aud' },
    } });
    const parsed = setup.parseBindingBody(full, ctx);
    expect(parsed.ok && parsed.values.adminValues).not.toHaveProperty('tokenAudience');
  });

  it('AC-LA-E2-03-06: refuses an unknown or a missing field, a malformed value, and an issuer off the site', () => {
    expect(setup.parseBindingBody({ ...full, extra: 'x' }, ctx)).toEqual({ ok: false, fields: ['extra'] });
    expect(setup.parseBindingBody(without(['jwksUrl', 'grantCode']), ctx)).toEqual({ ok: false, fields: ['jwksUrl', 'grantCode'] });
    expect(setup.parseBindingBody({ ...full, authenticationEndpoint: 'http://lms.school.edu/auth', clientId: 'has space', grantCode: 'short' }, ctx))
      .toEqual({ ok: false, fields: ['clientId', 'authenticationEndpoint', 'grantCode'] });
    expect(setup.parseBindingBody({ ...full, issuer: 'https://other.school.edu/sakai' }, ctx)).toEqual({ ok: false, fields: ['issuer'], reason: 'origin' });
    expect(setup.parseBindingBody([full], ctx)).toEqual({ ok: false, fields: ['body'] });
  });

  it('AC-LA-E2-03-06: a FieldSpec.default with {siteUrl} gives the filled value, and a posted value replaces it', () => {
    const filled = setup.parseBindingBody(without(['issuer']), ctx);
    expect(filled.ok && filled.values.adminValues!.issuer).toBe(SITE);
    const posted = setup.parseBindingBody({ ...full, issuer: `${SITE}/lti/issuer` }, ctx);
    expect(posted.ok && posted.values.adminValues!.issuer).toBe(`${SITE}/lti/issuer`);
    // A field with no default stays required.
    expect(setup.parseBindingBody(without(['clientId']), ctx)).toEqual({ ok: false, fields: ['clientId'] });
  });

  it('an added deployment takes only the deployment id and the code; the client id comes from the platform', () => {
    expect(setup.parseBindingBody({ deploymentId: 'dep-2', grantCode: CODE }, { ...ctx, purpose: 'add_deployment', clientId: 'client-1' }))
      .toEqual({ ok: true, values: { clientId: 'client-1', deploymentId: 'dep-2', grantCode: CODE } });
    expect(setup.parseBindingBody({ deploymentId: 'dep-2', grantCode: CODE, issuer: SITE }, { ...ctx, purpose: 'add_deployment', clientId: 'client-1' }))
      .toEqual({ ok: false, fields: ['issuer'] });
  });
});

describe('the kernel admin-value adapter (LA-ADR-01 D5)', () => {
  it('offers every manifest profile as an exclusive profile with no service URL and the channel label', () => {
    expect(setup.channel).toBe('zz-admin');
    expect(setup.profiles).toEqual({ 'zz-admin': { sharing: 'exclusive', serviceUrl: false, label: 'ZZ admin platform' } });
    expect([setup.sharingOf('zz-admin'), setup.sharingOf('standard')]).toEqual(['exclusive', null]);
    expect(setup.checkCreate({ siteUrl: SITE, profile: { id: 'zz-admin', issuer: null, sharing: 'exclusive', serviceUrl: false } })).toEqual({ ok: true, siteUrl: SITE, serviceUrl: SITE });
    expect(setup.checkCreate({ siteUrl: SITE, serviceUrl: SITE, profile: { id: 'zz-admin', issuer: null, sharing: 'exclusive', serviceUrl: false } })).toEqual({ ok: false, field: 'serviceUrl' });
    expect(setup.checkCreate({ siteUrl: SITE, profile: { id: 'other', issuer: null, sharing: 'exclusive', serviceUrl: false } })).toEqual({ ok: false, field: 'profile' });
  });

  it('gives the generic tool configuration rows of app API delta §3.3, in order', () => {
    const rows = setup.toolConfiguration({ ...toolContext(TEST_URLS), urls: TEST_URLS, libraryName: "Thanh's Library", sharedClientId: null });
    expect(rows.map((r) => [r.key, r.value])).toEqual([
      ['tool_name', "Cogniate (Thanh's Library)"],
      ['login_url', `${TEST_URLS.lti}/lti/login/cogniate`],
      ['redirect_uri', `${TEST_URLS.lti}/lti/launch/cogniate`],
      ['target_link_uri', `${TEST_URLS.lti}/lti/launch/cogniate`],
      ['jwks_url', `${TEST_URLS.lti}/lti/keys/cogniate`],
      ['deep_linking_url', `${TEST_URLS.lti}/lti/launch/cogniate`],
      ['scopes', AGS.join(' ')],
      ['privacy', "Do not send the learner's name or e-mail."],
    ]);
    expect(rows.every((r) => r.label.length > 0)).toBe(true);
  });

  it('targets an exclusive platform with the admin values and stages the admin-value create', () => {
    const parsed = setup.parseBindingBody({ ...full, tokenAudience: 'https://token.provider.test/aud' }, ctx);
    if (!parsed.ok) throw new Error('valid body');
    const target = setup.initialTarget!({ connection, values: parsed.values, profile: { id: 'zz-admin', issuer: null }, sharedPlatform: null });
    expect(target).toEqual({
      kind: 'exclusive_platform', profile: 'zz-admin', issuer: `${SITE}/sakai`, clientId: 'client-1', deploymentId: 'dep-1',
      siteUrl: SITE, serviceUrl: SITE, platformId: null, adminValues: parsed.values.adminValues,
    });
    expect(setup.createRequest!(target, { ...toolContext(TEST_URLS), libraryName: "Thanh's Library" })).toEqual({ kind: 'platform', body: {
      profile: 'zz-admin', url: `${SITE}/sakai`, clientId: 'client-1', name: "Cogniate (Thanh's Library)", authenticationEndpoint: `${SITE}/auth`,
      accesstokenEndpoint: 'https://token.provider.test/token', authConfig: { method: 'JWK_SET', key: `${SITE}/jwks` },
      clientAssertionAud: 'https://token.provider.test/aud', deploymentIds: ['dep-1'],
    } });
    expect(setup.createRequest!({ kind: 'platform_deployment', platformId: 'plt_1', deploymentId: 'dep-2' }, { ...toolContext(TEST_URLS), libraryName: 'L' }))
      .toEqual({ kind: 'deployment', platformId: 'plt_1', body: { deploymentId: 'dep-2' } });
    expect(() => setup.createRequest!({ kind: 'shared_deployment', platformId: 'plt_1', deploymentId: 'd', siteUrl: SITE }, { ...toolContext(TEST_URLS), libraryName: 'L' })).toThrow();
    expect(setup.selfCreate).toBeUndefined();
  });

  it('setupOf gives the app.ts adapter when there is one, else the kernel adapter (made once), and null for an unknown id', () => {
    expect(setupOf(registry, 'canvas')).toBe(TEST_CHANNELS.appAdapter('canvas'));
    expect(setupOf(registry, 'zz-admin')).toBe(setup);
    expect(setupOf(registry, 'zz-unknown')).toBeNull();
    expect([servedByKernel(registry, 'zz-admin'), servedByKernel(registry, 'moodle'), servedByKernel(registry, 'zz-unknown')]).toEqual([true, false, false]);
    expect(adminValueSetup(manifest, registry.capabilities('zz-admin')).profiles).toEqual(setup.profiles);
  });
});

describe('create rules of a kernel-served channel (app API delta §3.1)', () => {
  let t: TestApp;
  afterEach(async () => { await t?.app.close(); });

  const zzRow = { id: 'zz-admin', lms: 'zz-admin', label: 'ZZ admin platform', sharing: 'exclusive' as const, issuer: null, authenticationEndpoint: null, accesstokenEndpoint: null,
    jwksUrl: null, siteUrlOn: null, serviceUrl: false, simulation: false, sharedPlatform: null };

  it('a dynamic create passes site rules 1–4: an IP literal, localhost or one of our hosts gives 422 INVALID_SITE_URL', async () => {
    t = await testApp({ channels: registry });
    t.lti.providers.push({ ...zzRow, endpoints: 'admin' });
    const cookie = await t.login(THANH);
    const create = (siteUrl: string) => t.app.inject({ method: 'POST', url: '/app-api/connections', headers: t.writeHeaders(cookie),
      payload: { name: 'School', siteUrl, method: 'dynamic', lms: 'zz-admin' } });
    for (const [siteUrl, rule] of [['https://192.0.2.10', 2], ['https://localhost', 2], [TEST_URLS.app, 3], ['http://lms.school.edu', 1]] as const) {
      const r = await create(siteUrl);
      expect([siteUrl, r.statusCode, r.json().details]).toEqual([siteUrl, 422, expect.objectContaining({ message: 'INVALID_SITE_URL', rule, field: 'siteUrl' })]);
    }
    const ok = await create('HTTPS://LMS.School.Edu:443/');
    expect(ok.statusCode).toBe(201);
    expect(ok.json()).toMatchObject({ channel: 'zz-admin', lms: 'zz-admin', profile: 'zz-admin', siteUrl: SITE, method: 'dynamic', bindingAuthority: 'self', status: 'pending' });
    // Moodle keeps its M1 rule (no site rules in the self path).
    const moodle = await t.app.inject({ method: 'POST', url: '/app-api/connections', headers: t.writeHeaders(cookie), payload: { name: 'M', siteUrl: TEST_URLS.moodle, method: 'dynamic' } });
    expect(moodle.statusCode).toBe(201);
  });

  it('BD-A1-79: a profile that the LTI service reports as endpoints: fixed makes the method unavailable; one log line', async () => {
    t = await testApp({ channels: registry });
    t.lti.providers.push({ ...zzRow, endpoints: 'fixed' });
    const cookie = await t.login(THANH);
    const create = (method: 'dynamic' | 'manual') => t.app.inject({ method: 'POST', url: '/app-api/connections', headers: t.writeHeaders(cookie),
      payload: { name: 'School', siteUrl: SITE, method, lms: 'zz-admin' } });
    for (const method of ['dynamic', 'manual'] as const) {
      const r = await create(method);
      expect([method, r.statusCode, r.json().details]).toEqual([method, 400, expect.objectContaining({ message: 'INVALID_REQUEST', field: 'profile' })]);
    }
    const list = (await t.app.inject({ method: 'GET', url: '/app-api/lms-providers', headers: { cookie } })).json().lms as Array<{ lms: string; profiles: unknown[] }>;
    expect(list.find((e) => e.lms === 'zz-admin')!.profiles).toEqual([]);
    expect(list.find((e) => e.lms === 'canvas')!.profiles.length).toBeGreaterThan(0);
    expect(t.logs.filter((l) => l.event === 'channel_profile_unknown' && l.profile === 'zz-admin')).toEqual([expect.objectContaining({ level: 'warn', reason: 'endpoints_fixed' })]);
    // A reported admin row is usable again.
    t.lti.providers.at(-1)!.endpoints = 'admin';
    expect((await create('manual')).statusCode).toBe(201);
  });
});
