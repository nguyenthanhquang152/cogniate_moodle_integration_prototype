// LA-E2-04: the staged Dynamic Registration in the app (LA-ADR-02 D5 item 10; A1 BD-A1-90, -91) and the register page
// texts from the channel manifest (BD-A1-59). Unit level with the fake LTI service; QA proves the stack (AC-04).
import type { ChannelManifest } from '@cogniate/channel-kernel';
import { DEFAULT_REGISTRATION_TEXTS, TOOL_MAY_EXIST_CODE, buildChannelRegistry, fillText, pendingToolText } from '@cogniate/channel-kernel';
import { afterEach, describe, expect, it } from 'vitest';
import { getConnectionAnyLibrary, stageRegistration } from '../domain/connections.ts';
import type { TestApp } from '../testkit.ts';
import { TEST_CHANNELS, TEST_URLS, THANH, testApp } from '../testkit.ts';
import { registerErrorText } from './register-texts.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const SITE = 'https://lms.school.edu';
const STAGE = {
  authenticationEndpoint: `${SITE}/auth`, accesstokenEndpoint: 'https://token.provider.test/token',
  authConfig: { method: 'JWK_SET', key: `${SITE}/jwks` }, clientAssertionAud: 'https://token.provider.test/aud',
};
const STAGED_TEXT = 'Done. Cogniate checks this connection before it works. Ask your Cogniate operator for the approval code.';

let t: TestApp;
afterEach(async () => { await t?.app.close(); });

async function world(channels = TEST_CHANNELS) {
  t = await testApp({ channels });
  const cookie = await t.login(THANH);
  const call = (method: 'GET' | 'POST', url: string, payload?: unknown) =>
    t.app.inject({ method, url, headers: method === 'GET' ? { cookie } : t.writeHeaders(cookie), ...(payload !== undefined ? { payload: payload as Json } : {}) });
  const pending = async (lms: string, siteUrl: string) => {
    const c = (await call('POST', '/app-api/connections', { name: 'School', siteUrl, method: 'dynamic', lms })).json();
    return { id: c.id as string, ref: new URL(c.registrationUrl).searchParams.get('ref')! };
  };
  const post = (registrationId: string, ref: string) => t.app.inject({ method: 'POST', url: '/tool/register',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: TEST_URLS.app }, payload: new URLSearchParams({ registrationId, ref }).toString() });
  return { call, pending, post };
}

describe('the staged Dynamic Registration (LA-ADR-02 D5 item 10)', () => {
  it('a configuration that breaks I-SELF stages the platform: the connection stays pending with authority operatorGrant', async () => {
    const { call, pending, post } = await world();
    const c = await pending('lti-generic', SITE);
    const reg = t.lti.addRegistration({ url: `${SITE}/sakai`, familyCode: 'sakai', stage: STAGE });
    const done = await post(reg, c.ref);
    expect(done.statusCode).toBe(200);
    expect(done.body).toContain('<main data-page="register-done" data-connection-status="pending">');
    expect(done.body).toContain(`<p>${STAGED_TEXT}</p>`);
    expect(done.body).toContain("postMessage({subject:'org.imsglobal.lti.close'}, '*')");
    // The complete request names the profile, the channel scope set and a fresh binding ref.
    const complete = JSON.parse(t.lti.calls.find((x) => x.startsWith('POST complete'))!.replace(/^POST complete \S+ /, '')) as Json;
    expect(complete).toMatchObject({ profile: 'lti-generic', scopes: TEST_CHANNELS.capabilities('lti-generic')['registration.scopes'], bindingRef: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
    const platform = [...t.lti.platforms.values()].at(-1)!;
    expect([platform.active, platform.bindingRef]).toEqual([false, complete.bindingRef]);
    // The writer test (LA-ADR-04 D4 rule 5): authority, behaviour class and the staged platform record in one write.
    expect(t.db.prepare('SELECT status, binding_authority, lms, channel, target_issuer, lti_platform_id, ref_token_hash FROM connection WHERE id = ?').get(c.id)).toEqual({
      status: 'pending', binding_authority: 'operatorGrant', lms: 'canvas', channel: 'lti-generic', target_issuer: `${SITE}/sakai`, lti_platform_id: null, ref_token_hash: null,
    });
    expect(t.logs).toContainEqual(expect.objectContaining({ event: 'registration_staged', connection_id: c.id, platform_id: platform.id }));
    const dto = (await call('GET', `/app-api/connections/${c.id}`)).json();
    expect(dto).toMatchObject({ status: 'pending', bindingAuthority: 'operatorGrant', registrationUrl: null, platform: { id: platform.id, issuer: `${SITE}/sakai`, clientId: platform.clientId } });
    // The staged connection does not register again.
    expect((await call('POST', `/app-api/connections/${c.id}/registration-url`)).json().details.message).toBe('CONNECTION_NOT_PENDING');
    expect(/data-error-code="([A-Z_]+)"/.exec((await post(t.lti.addRegistration({ url: `${SITE}/sakai` }), c.ref)).body)?.[1]).toBe('REF_INVALID');
  });

  it('AC-LA-E2-04-05: the staging write changes authority, lms and the platform record together, only for a pending self connection', async () => {
    const { pending } = await world();
    const c = await pending('lti-generic', SITE);
    const info = { id: 'plt_staged', issuer: `${SITE}/sakai`, clientId: 'client-9', deploymentIds: ['d-9'], productFamilyCode: 'sakai' };
    const before = t.db.prepare('SELECT * FROM connection WHERE id = ?').get(c.id);
    t.db.exec(`CREATE TRIGGER fail_stage BEFORE UPDATE OF binding_authority ON connection BEGIN SELECT RAISE(ABORT, 'test: the write fails'); END`);
    expect(() => stageRegistration(t.db, c.id, 'lti-generic', info, t.clock.now)).toThrow(/the write fails/);
    expect(t.db.prepare('SELECT * FROM connection WHERE id = ?').get(c.id)).toEqual(before);
    t.db.exec('DROP TRIGGER fail_stage');
    expect(stageRegistration(t.db, c.id, 'lti-generic', info, t.clock.now)).toBe(true);
    const staged = getConnectionAnyLibrary(t.db, c.id)!;
    expect([staged.bindingAuthority, staged.status, staged.platform, staged.snapshot.issuer]).toEqual(['operatorGrant', 'pending', info, info.issuer]);
    expect(t.db.prepare('SELECT lms FROM connection WHERE id = ?').get(c.id)).toEqual({ lms: 'canvas' });
    // The guard: a second staging (already staged: a platform record exists) changes nothing.
    expect(stageRegistration(t.db, c.id, 'lti-generic', { ...info, id: 'plt_other' }, t.clock.now)).toBe(false);
    expect(getConnectionAnyLibrary(t.db, c.id)!.platform!.id).toBe('plt_staged');
  });

  it('an inactive platform without our binding ref keeps the A-T4b1-03 refusal; Moodle completes as today', async () => {
    const { pending, post } = await world();
    const c = await pending('lti-generic', SITE);
    const reg = t.lti.addRegistration({ url: SITE, stage: { ...STAGE, bindingRef: 'someone-else' } });
    const page = await post(reg, c.ref);
    expect(/data-error-code="([A-Z_]+)"/.exec(page.body)?.[1]).toBe('REGISTRATION_FAILED');
    expect(t.db.prepare('SELECT binding_authority, lms FROM connection WHERE id = ?').get(c.id)).toEqual({ binding_authority: 'self', lms: 'moodle' });
    const moodle = await pending('moodle', TEST_URLS.moodle);
    const done = await post(t.lti.addRegistration(), moodle.ref);
    expect(done.body).toContain('Done. Go back to Moodle and activate the tool.');
    const body = JSON.parse(t.lti.calls.filter((x) => x.startsWith('POST complete')).at(-1)!.replace(/^POST complete \S+ /, '')) as Json;
    expect(body).toMatchObject({ platformName: "Cogniate (Thanh's Library)", privacyLevel: 'anonymous', autoActivate: true, profile: 'standard',
      scopes: TEST_CHANNELS.capabilities('moodle')['registration.scopes'] });
    expect(t.db.prepare('SELECT status, binding_authority FROM connection WHERE id = ?').get(moodle.id)).toEqual({ status: 'registered', binding_authority: 'self' });
  });
});

describe('A1 BD-A1-106: a Canvas dynamic connection has authority operatorGrant from the start (LA-ADR-05 D6)', () => {
  const CANVAS_SITE = 'https://school-a.canvas.sim.test';
  const CANVAS_ISSUER = 'https://canvas.sim.test';
  const row = (id: string) => t.db.prepare('SELECT * FROM connection WHERE id = ?').get(id);

  async function canvas(siteUrl = CANVAS_SITE, method: 'dynamic' | 'manual' = 'dynamic') {
    const w = await world();
    const create = (site: string, m: 'dynamic' | 'manual') => w.call('POST', '/app-api/connections', { name: 'Canvas', siteUrl: site, method: m, lms: 'canvas', profile: 'canvas-sim-cloud' });
    const r = await create(siteUrl, method);
    expect(r.statusCode, r.body).toBe(201);
    const c = r.json();
    return { ...w, c, create, ref: c.registrationUrl === null ? null : new URL(c.registrationUrl).searchParams.get('ref')! };
  }
  // The fake reports the site origin as the registration url, so the register page reaches `complete`. The real LTI
  // service reports the Canvas issuer, which the page refuses today (G1, sent to A1 as BD-A1-107).
  const registration = (stage?: Record<string, unknown>) => t.lti.addRegistration({ url: CANVAS_SITE, familyCode: 'canvas', ...(stage ? { stage } : {}) });

  it('(a) create gives 201 with authority operatorGrant and a registration URL', async () => {
    const { c, ref } = await canvas();
    expect(c).toMatchObject({ method: 'dynamic', status: 'pending', bindingAuthority: 'operatorGrant', registrationUrl: expect.stringContaining('?ref=') });
    expect(ref).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(row(c.id)).toMatchObject({ method: 'dynamic', status: 'pending', binding_authority: 'operatorGrant', lms: 'canvas', ref_token_hash: expect.any(String) });
  });

  it('(b) a staged answer keeps the staged platform: pending, operatorGrant, the ref used up, "Waiting for approval", no deactivation', async () => {
    const { c, ref, call, post } = await canvas();
    const done = await post(registration({ url: CANVAS_ISSUER, profile: 'canvas-sim-cloud', siteUrl: CANVAS_SITE, serviceUrl: CANVAS_SITE }), ref!);
    expect(done.statusCode).toBe(200);
    expect(done.body).toContain('<main data-page="register-done" data-connection-status="pending">');
    expect(done.body).toContain(`<p>${STAGED_TEXT}</p>`);
    const complete = JSON.parse(t.lti.calls.find((x) => x.startsWith('POST complete'))!.replace(/^POST complete \S+ /, '')) as Json;
    expect(complete).toMatchObject({ profile: 'canvas-sim-cloud', scopes: TEST_CHANNELS.capabilities('canvas')['registration.scopes'], bindingRef: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
    const platform = [...t.lti.platforms.values()].at(-1)!;
    expect([platform.active, platform.bindingRef]).toEqual([false, complete.bindingRef]);
    expect(row(c.id)).toMatchObject({
      status: 'pending', binding_authority: 'operatorGrant', lms: 'canvas', channel: 'canvas', target_issuer: CANVAS_ISSUER, lti_platform_id: null, ref_token_hash: null,
      platform_json: expect.stringContaining(`"id":"${platform.id}"`),
    });
    expect(t.lti.calls.filter((x) => x.startsWith('PATCH platform'))).toEqual([]);
    expect(t.logs).toContainEqual(expect.objectContaining({ event: 'registration_staged', connection_id: c.id, platform_id: platform.id }));
    expect((await call('GET', `/app-api/connections/${c.id}`)).json()).toMatchObject({ status: 'pending', bindingAuthority: 'operatorGrant', registrationUrl: null, platform: { id: platform.id, issuer: CANVAS_ISSUER } });
  });

  it('(c) an active answer is refused: REGISTRATION_FAILED, the orphan switched off, the connection pending with no platform', async () => {
    const { c, ref, post } = await canvas();
    const page = await post(registration(), ref!);
    expect(/data-error-code="([A-Z_]+)"/.exec(page.body)?.[1]).toBe('REGISTRATION_FAILED');
    const platform = [...t.lti.platforms.values()].at(-1)!;
    expect(platform.active).toBe(false);
    expect(t.lti.calls.filter((x) => x.startsWith('PATCH platform'))).toEqual([`PATCH platform ${platform.id} {"active":false}`]);
    expect(t.logs).toContainEqual(expect.objectContaining({ event: 'platform_orphan_deactivated', platform_id: platform.id }));
    expect(row(c.id)).toMatchObject({ status: 'pending', binding_authority: 'operatorGrant', lti_platform_id: null, platform_json: null });
  });

  it('(d) the staging guard: a connection that is not pending, a manual one, or one already staged gives false and changes nothing', async () => {
    const { c, create } = await canvas();
    const info = { id: 'plt_staged', issuer: CANVAS_ISSUER, clientId: 'client-9', deploymentIds: ['d-9'], productFamilyCode: 'canvas' };
    const manual = (await create('https://school-b.canvas.sim.test', 'manual')).json();
    const disabled = (await create('https://school-c.canvas.sim.test', 'dynamic')).json();
    t.db.prepare("UPDATE connection SET status = 'disabled' WHERE id = ?").run(disabled.id);
    for (const id of [manual.id, disabled.id]) {
      const before = row(id);
      expect(stageRegistration(t.db, id, 'canvas', info, t.clock.now)).toBe(false);
      expect(row(id)).toEqual(before);
    }
    expect(stageRegistration(t.db, c.id, 'canvas', info, t.clock.now)).toBe(true);
    const staged = row(c.id);
    expect(staged).toMatchObject({ binding_authority: 'operatorGrant', lms: 'canvas', status: 'pending', target_issuer: CANVAS_ISSUER });
    expect(stageRegistration(t.db, c.id, 'canvas', { ...info, id: 'plt_other' }, t.clock.now + 1)).toBe(false);
    expect(row(c.id)).toEqual(staged);
  });
});

describe('register page texts from the channel manifest (A1 BD-A1-59, BD-A1-87)', () => {
  const base = TEST_CHANNELS.channel('moodle')!;
  const own = (id: string, registration?: Record<string, string>): ChannelManifest => ({
    ...base, id, names: { text: 'Own LMS', label: 'Own LMS' }, card: { ...base.card, order: 50 + id.length },
    registration: [{ method: 'dynamic', authority: 'self', profiles: [`${id}-profile`], defaultProfile: `${id}-profile` }],
    texts: { ...base.texts, registration },
  });
  const channels = buildChannelRegistry([...TEST_CHANNELS.channels(), own('zz-own', { UPDATE_NOT_ALLOWED: 'In {LMS}, open Tools and add Cogniate as a new tool.', TOOL_MAY_EXIST: "In {LMS}, open Tools and delete '{tool}' if it is there." }), own('zz-plain')]
    .map((m) => ({ folder: `/test/${m.id}`, manifest: m, appAdapter: TEST_CHANNELS.appAdapter(m.id) ?? undefined })), { simulations: true });

  it('UPDATE_NOT_ALLOWED takes the channel sentence, else the core default; Moodle keeps its bytes', async () => {
    const { pending } = await world(channels);
    for (const id of ['zz-own', 'zz-plain']) {
      t.lti.providers.push({ id: `${id}-profile`, lms: id, label: id, sharing: 'exclusive', issuer: null, authenticationEndpoint: null, accesstokenEndpoint: null,
        jwksUrl: null, siteUrlOn: null, serviceUrl: false, simulation: false, sharedPlatform: null, endpoints: 'admin' });
    }
    const page = async (lms: string, siteUrl: string) => {
      const c = await pending(lms, siteUrl);
      const r = await t.app.inject({ method: 'GET', url: `/tool/register?registrationId=${t.lti.addRegistration({ url: siteUrl, operation: 'update', existingPlatformId: 'plt_x' })}&ref=${c.ref}` });
      return /<p data-error-action>([^<]*)<\/p>/.exec(r.body)?.[1];
    };
    expect(await page('zz-own', 'https://own.school.edu')).toBe('In Own LMS, open Tools and add Cogniate as a new tool.');
    expect(await page('zz-plain', 'https://plain.school.edu')).toBe(DEFAULT_REGISTRATION_TEXTS.UPDATE_NOT_ALLOWED.replace('{LMS}', 'Own LMS'));
    expect(await page('moodle', TEST_URLS.moodle)).toBe('Go back in Moodle and choose Register as a new external tool.');
  });

  it('BD-A1-87: the MOODLE_TOOL_MAY_EXIST action takes the channel sentence, else the core default, with {tool}; Moodle keeps its bytes', () => {
    const tool = 'Cogniate ({LMS} $&)';
    const action = (channel: string | null) => registerErrorText(TOOL_MAY_EXIST_CODE, tool, channels, channel)!.action;
    expect(action('zz-own')).toBe("In Own LMS, open Tools and delete 'Cogniate ({LMS} $&)' if it is there.");
    expect(action('zz-plain')).toBe(fillText(DEFAULT_REGISTRATION_TEXTS.TOOL_MAY_EXIST, { LMS: 'Own LMS', tool }));
    expect([action('moodle'), action(null)]).toEqual([pendingToolText(tool), pendingToolText(tool)]);
  });
});
