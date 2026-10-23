// LA-E2-04 (LA-ADR-02 D6; app API delta §3.4): the redemption of an admin-value grant. A manual binding compares every
// bound value with the body; a staged registration adopts its staged platform with no S1 create. Unit level with the
// fake LTI service; QA proves the stack (AC-LA-E2-04-03, -04 at K1-SIM).
import { createLogger, sha256Hex } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { approvalOf, grantsOfConnection, insertGrant } from '../domain/bindings.ts';
import { getConnectionAnyLibrary, stageRegistration } from '../domain/connections.ts';
import type { TestApp } from '../testkit.ts';
import { TEST_CHANNELS, TEST_URLS, THANH, ltiPlatform, testApp } from '../testkit.ts';
import { createBindingCleanup } from './binding-cleanup.ts';
import type { IssueInput } from './operator.ts';
import { createOperator } from './operator.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const SITE = 'https://lms.school.edu';
const VALUES = { issuer: SITE, authenticationEndpoint: `${SITE}/auth`, accessTokenEndpoint: `${SITE}/token`, jwksUrl: `${SITE}/jwks` };

let t: TestApp;
afterEach(async () => { await t?.app.close(); });

async function setup() {
  t = await testApp();
  const logger = createLogger({ service: 'cogniate-app', level: 'debug', write: (l) => t.logs.push(JSON.parse(l)) });
  const cleanup = createBindingCleanup({ db: t.db, lti: t.lti.client, logger, now: () => t.clock.now });
  const op = createOperator({ channels: TEST_CHANNELS, db: t.db, lti: t.lti.client, logger, cleanup, now: () => t.clock.now, env: {} });
  const cookie = await t.login(THANH);
  const call = async (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) => {
    const r = await t.app.inject({ method, url, headers: method === 'GET' ? { cookie } : t.writeHeaders(cookie), ...(payload !== undefined ? { payload: payload as Json } : {}) });
    return { status: r.statusCode, json: (r.body ? r.json() : null) as Json };
  };
  const library = String(t.db.prepare('SELECT id FROM library WHERE name = ?').get(THANH.library)!.id);
  const issue = async (c: Json, over: Partial<IssueInput> = {}) => {
    const r = await op.issue({ library, connection: c.id, site: c.siteUrl, clientId: 'client-1', deploymentId: 'dep-1', note: 'ticket', traceId: 't', ...over });
    expect(r.exitCode, r.lines.join('\n')).toBe(0);
    return r.lines.find((l) => l.startsWith('Approval code'))!.split(': ')[1]!;
  };
  const connection = async (method: 'manual' | 'dynamic') => {
    const r = await call('POST', '/app-api/connections', { name: 'School', siteUrl: SITE, method, lms: 'lti-generic' });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    return r.json;
  };
  const put = (c: Json, body: Json) => call('PUT', `/app-api/connections/${c.id}/platform`, body);
  const creates = () => t.lti.calls.filter((x) => x.startsWith('POST platform'));
  return { op, call, issue, connection, put, creates };
}

const refusal = (r: { status: number; json: Json }) => [r.status, r.json?.details?.message, r.json?.details?.fields];
const manualBody = (grantCode: string, over: Json = {}) => ({ ...VALUES, clientId: 'client-1', deploymentId: 'dep-1', grantCode, ...over });

describe('AC-LA-E2-04-03: the manual admin-value redemption', () => {
  it('AC-LA-E2-04-03: a body whose jwksUrl differs from the grant gives 422 GRANT_MISMATCH with details.fields ["jwksUrl"] and no LTI write', async () => {
    const { issue, connection, put, creates } = await setup();
    const c = await connection('manual');
    const code = await issue(c, { boundValues: VALUES });
    const r = await put(c, manualBody(code, { jwksUrl: `${SITE}/other-jwks` }));
    expect(refusal(r)).toEqual([422, 'GRANT_MISMATCH', ['jwksUrl']]);
    expect(creates()).toEqual([]);
    expect(t.logs).toContainEqual(expect.objectContaining({ event: 'grant_rejected', reason: 'mismatch', connection_id: c.id }));
    // Every differing value is named, in the fixed order; the grant stays open.
    const many = await put(c, manualBody(code, { authenticationEndpoint: `${SITE}/auth2`, tokenAudience: `${SITE}/aud`, deploymentId: 'dep-2' }));
    expect(many.json.details.fields).toEqual(['deploymentId', 'authenticationEndpoint', 'tokenAudience']);
    expect(grantsOfConnection(t.db, c.id)[0]!.redeemedAt).toBeNull();
  });

  it('AC-LA-E2-04-03: equal values (an origin in another form) give 200, status registered and an active platform with the bound values', async () => {
    const { issue, connection, put, creates } = await setup();
    const c = await connection('manual');
    const code = await issue(c, { boundValues: { ...VALUES, tokenAudience: `${SITE}/token` } });
    const r = await put(c, manualBody(code, { issuer: 'HTTPS://LMS.School.Edu:443', tokenAudience: `${SITE}/token` }));
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json).toMatchObject({ status: 'registered', bindingAuthority: 'operatorGrant' });
    // S1 sends the bound values (not the body's spelling of the issuer).
    expect(creates()).toHaveLength(1);
    expect(JSON.parse(creates()[0]!.replace(/^POST platform /, ''))).toMatchObject({ profile: 'lti-generic', url: SITE, clientId: 'client-1', authenticationEndpoint: VALUES.authenticationEndpoint,
      accesstokenEndpoint: VALUES.accessTokenEndpoint, authConfig: { method: 'JWK_SET', key: VALUES.jwksUrl }, clientAssertionAud: `${SITE}/token`, deploymentIds: ['dep-1'], active: false });
    const stored = getConnectionAnyLibrary(t.db, c.id)!;
    const platform = t.lti.platforms.get(stored.ltiPlatformId!)!;
    expect([platform.active, platform.url, stored.platform]).toEqual([true, SITE, { id: platform.id, issuer: SITE, clientId: 'client-1', deploymentIds: ['dep-1'], productFamilyCode: null }]);
    expect(approvalOf(t.db, platform.id, 'dep-1')?.connectionId).toBe(c.id);
    // The finalized repeat answers 200 with no LTI call.
    const before = t.lti.calls.length;
    expect((await put(c, manualBody(code, { tokenAudience: `${SITE}/token` }))).status).toBe(200);
    expect(t.lti.calls.length).toBe(before);
  });

  it('a grant without bound values does not bind admin values (GRANT_MISMATCH connection)', async () => {
    const { connection, put, creates } = await setup();
    const c = await connection('manual');
    const library = String(t.db.prepare('SELECT library_id FROM connection WHERE id = ?').get(c.id)!.library_id);
    const code = 'A'.repeat(43);
    insertGrant(t.db, { libraryId: library, connectionId: c.id, channel: 'lti-generic', profile: 'lti-generic', purpose: 'initial', siteUrl: SITE, serviceUrl: SITE,
      clientId: 'client-1', deploymentId: 'dep-1', note: 'old', expiresAt: t.clock.now + 3_600_000 }, sha256Hex(code), t.clock.now);
    const r = await put(c, manualBody(code));
    expect(refusal(r)).toEqual([422, 'GRANT_MISMATCH', ['connection']]);
    expect(creates()).toEqual([]);
  });

  it('B-LA-E2-03-01: the generic manual form body (every input; Token audience left blank) redeems', async () => {
    const { issue, connection, put } = await setup();
    const c = await connection('manual');
    const code = await issue(c, { boundValues: VALUES });
    const typed: Record<string, string> = { ...VALUES, clientId: 'client-1', deploymentId: 'dep-1', grantCode: code };
    const form = Object.fromEntries(TEST_CHANNELS.channel('lti-generic')!.setup.bindingFields.filter((f) => !f.method || f.method === 'manual').map((f) => [f.key, typed[f.key] ?? '']));
    expect(form).toHaveProperty('tokenAudience', '');
    const r = await put(c, form);
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json.status).toBe('registered');
  });
});

describe('B-LA-E2-04-02: a finalized repeat compares the bound values of the committed approval', () => {
  async function registered(bound: Json) {
    const ctx = await setup();
    const c = await ctx.connection('manual');
    const code = await ctx.issue(c, { boundValues: bound as IssueInput['boundValues'] });
    const first = await ctx.put(c, manualBody(code, bound.tokenAudience ? { tokenAudience: bound.tokenAudience } : {}));
    expect(first.status, JSON.stringify(first.json)).toBe(200);
    const calls = t.lti.calls.length;
    const platformId = getConnectionAnyLibrary(t.db, c.id)!.ltiPlatformId!;
    const before = structuredClone(t.lti.platforms.get(platformId)!);
    const repeat = async (over: Json) => {
      const r = await ctx.put(c, { ...manualBody(code), ...over });
      // A repeat never calls the LTI service and never changes the platform.
      expect([t.lti.calls.length, t.lti.platforms.get(platformId)]).toEqual([calls, before]);
      return r;
    };
    return { repeat };
  }

  it('a changed endpoint gives 422 GRANT_MISMATCH with the differing fields, in the fixed order; nothing changes', async () => {
    const { repeat } = await registered(VALUES);
    expect(refusal(await repeat({ jwksUrl: `${SITE}/different-jwks` }))).toEqual([422, 'GRANT_MISMATCH', ['jwksUrl']]);
    expect(refusal(await repeat({ accessTokenEndpoint: 'https://token.other.test/token', authenticationEndpoint: `${SITE}/auth2` })))
      .toEqual([422, 'GRANT_MISMATCH', ['authenticationEndpoint', 'accessTokenEndpoint']]);
    expect(refusal(await repeat({ issuer: `${SITE}/other` }))).toEqual([422, 'GRANT_MISMATCH', ['issuer']]);
    expect(t.logs.filter((l) => l.event === 'grant_rejected' && l.reason === 'mismatch')).toHaveLength(3);
  });

  it('an added, a removed or a changed optional audience gives GRANT_MISMATCH tokenAudience', async () => {
    const without = await registered(VALUES);
    expect(refusal(await without.repeat({ tokenAudience: `${SITE}/aud` }))).toEqual([422, 'GRANT_MISMATCH', ['tokenAudience']]);
    await t.app.close();
    const withAud = await registered({ ...VALUES, tokenAudience: `${SITE}/aud` });
    expect(refusal(await withAud.repeat({}))).toEqual([422, 'GRANT_MISMATCH', ['tokenAudience']]);
    expect(refusal(await withAud.repeat({ tokenAudience: `${SITE}/aud2` }))).toEqual([422, 'GRANT_MISMATCH', ['tokenAudience']]);
    expect((await withAud.repeat({ tokenAudience: `${SITE}/aud` })).status).toBe(200);
  });

  it('an identical repeat (an origin in another form counts as identical) answers 200 with no LTI call', async () => {
    const { repeat } = await registered(VALUES);
    expect((await repeat({})).status).toBe(200);
    const other = await repeat({ issuer: 'HTTPS://LMS.School.Edu:443' });
    expect([other.status, other.json.status]).toEqual([200, 'registered']);
    // A blank optional audience from the shared form counts as absent.
    expect((await repeat({ tokenAudience: '' })).status).toBe(200);
  });
});

describe('the grant collision text (BD-A1-101)', () => {
  it('lti-generic: a second connection with the same values gets 409 PLATFORM_IN_USE with the core default, which names no LMS', async () => {
    const { issue, connection, put } = await setup();
    const first = await connection('manual');
    expect((await put(first, manualBody(await issue(first, { boundValues: VALUES })))).status).toBe(200);
    const second = await connection('manual');
    const r = await put(second, manualBody(await issue(second, { boundValues: VALUES })));
    expect([r.status, r.json.details.message, r.json.details.description]).toEqual([409, 'PLATFORM_IN_USE',
      'This LMS tool registration is already connected to Cogniate. Make a new tool registration for this library, or ask your Cogniate operator.']);
    // BD-A1-102: the ordinary collision has no details.reason (the portal keeps its channel or generic text).
    expect(r.json.details).not.toHaveProperty('reason');
    expect(grantsOfConnection(t.db, second.id).map((g) => g.redeemedAt)).toEqual([null]);
  });
});

describe('the staged registration redemption (AC-LA-E2-04-04 unit part)', () => {
  const STAGED = { authenticationEndpoint: `${SITE}/auth`, accesstokenEndpoint: 'https://auth.provider.test/token', authConfig: { method: 'JWK_SET', key: `${SITE}/jwks` },
    clientAssertionAud: 'https://auth.provider.test/aud' };

  async function staged() {
    const ctx = await setup();
    const c = await ctx.connection('dynamic');
    const platform = ltiPlatform({ id: 'plt_staged', url: `${SITE}/sakai`, clientId: 'client-1', active: false, deploymentIds: ['dep-1'], profile: 'lti-generic', bindingRef: 'ref-dr', ...STAGED });
    t.lti.platforms.set(platform.id, platform);
    expect(stageRegistration(t.db, c.id, 'lti-generic', { id: platform.id, issuer: platform.url, clientId: 'client-1', deploymentIds: ['dep-1'], productFamilyCode: 'sakai' }, t.clock.now)).toBe(true);
    return { ...ctx, c, platform };
  }

  it('{clientId, deploymentId, grantCode} adopts and activates the staged platform with no new create', async () => {
    const { c, platform, issue, put, creates } = await staged();
    const code = await issue(c, { acceptStaged: true, confirmForeignHosts: true });
    const r = await put(c, { clientId: 'client-1', deploymentId: 'dep-1', grantCode: code });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json).toMatchObject({ status: 'registered', bindingAuthority: 'operatorGrant' });
    expect(creates()).toEqual([]);
    const activation = t.lti.calls.filter((x) => x.startsWith('PATCH platform'));
    expect(activation).toHaveLength(1);
    expect(JSON.parse(activation[0]!.replace(/^PATCH platform \S+ /, ''))).toMatchObject({ active: true, ifBindingRef: 'ref-dr' });
    const stored = getConnectionAnyLibrary(t.db, c.id)!;
    expect([stored.ltiPlatformId, stored.platform, platform.active]).toEqual([platform.id, { id: platform.id, issuer: `${SITE}/sakai`, clientId: 'client-1', deploymentIds: ['dep-1'], productFamilyCode: 'sakai' }, true]);
    expect(approvalOf(t.db, platform.id, 'dep-1')?.connectionId).toBe(c.id);
    // The finalized repeat of the short body: 200, no LTI call (it has no admin values to compare).
    const calls = t.lti.calls.length;
    expect((await put(c, { clientId: 'client-1', deploymentId: 'dep-1', grantCode: code })).status).toBe(200);
    expect(t.lti.calls.length).toBe(calls);
  });

  it('the full manual body on a staged connection is refused (strict body), and so is a missing id', async () => {
    const { c, issue, put } = await staged();
    const code = await issue(c, { acceptStaged: true, confirmForeignHosts: true });
    const full = await put(c, manualBody(code, { issuer: `${SITE}/sakai` }));
    expect(refusal(full)).toEqual([422, 'INVALID_PLATFORM_VALUES', ['issuer', 'authenticationEndpoint', 'accessTokenEndpoint', 'jwksUrl']]);
    const missing = await put(c, { clientId: 'client-1', grantCode: code });
    expect(missing.json.details.fields).toEqual(['deploymentId']);
    expect(platformActive()).toBe(false);
  });

  it('a staged platform whose values changed after the issue gives 422 GRANT_MISMATCH with the fields; it stays inactive', async () => {
    const { c, platform, issue, put } = await staged();
    const code = await issue(c, { acceptStaged: true, confirmForeignHosts: true });
    platform.authConfig = { method: 'JWK_SET', key: 'https://keys.provider.test/jwks' };
    const r = await put(c, { clientId: 'client-1', deploymentId: 'dep-1', grantCode: code });
    expect(refusal(r)).toEqual([422, 'GRANT_MISMATCH', ['jwksUrl']]);
    expect([platform.active, getConnectionAnyLibrary(t.db, c.id)!.status, getConnectionAnyLibrary(t.db, c.id)!.redeemingAttempt]).toEqual([false, 'pending', null]);
    expect(t.lti.calls.filter((x) => x.startsWith('PATCH platform'))).toEqual([]);
  });

  it('a staged platform that is gone gives 409 PLATFORM_IN_USE that names the cause (BD-A1-97); no create, the grant stays open', async () => {
    const { c, platform, issue, put, creates } = await staged();
    const code = await issue(c, { acceptStaged: true, confirmForeignHosts: true });
    t.lti.platforms.delete(platform.id);
    const r = await put(c, { clientId: 'client-1', deploymentId: 'dep-1', grantCode: code });
    expect([r.status, r.json.details.message, r.json.details.description]).toEqual([409, 'PLATFORM_IN_USE',
      'The staged registration of this connection is gone from the LTI service. Make a new connection, or ask your Cogniate operator.']);
    // BD-A1-102: the cause is also a details field, so the portal shows this description.
    expect(r.json.details.reason).toBe('staged_gone');
    expect(creates()).toEqual([]);
    expect(t.lti.calls.filter((x) => x.startsWith('PATCH platform'))).toEqual([]);
    expect(grantsOfConnection(t.db, c.id).map((g) => g.redeemedAt)).toEqual([null]);
    // The state after the refusal does not change with this text: still pending, the lease cleared.
    expect([getConnectionAnyLibrary(t.db, c.id)!.status, getConnectionAnyLibrary(t.db, c.id)!.redeemingAttempt]).toEqual(['pending', null]);
  });

  const platformActive = () => t.lti.platforms.get('plt_staged')!.active;

  it('the chain: the staged /tool/register page, --accept-staged, then the short body activates the same platform', async () => {
    const { call, issue, connection, put, creates } = await setup();
    const c = await connection('dynamic');
    const reg = t.lti.addRegistration({ url: `${SITE}/sakai`, familyCode: 'sakai', stage: STAGED });
    const ref = new URL(c.registrationUrl).searchParams.get('ref')!;
    const page = await t.app.inject({ method: 'POST', url: '/tool/register', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: TEST_URLS.app },
      payload: new URLSearchParams({ registrationId: reg, ref }).toString() });
    expect(page.body).toContain('data-connection-status="pending"');
    const dto = (await call('GET', `/app-api/connections/${c.id}`)).json;
    expect(dto).toMatchObject({ status: 'pending', bindingAuthority: 'operatorGrant' });
    const { clientId, id: platformId } = dto.platform as { clientId: string; id: string };
    const deploymentId = t.lti.platforms.get(platformId)!.deploymentIds[0]!;
    const code = await issue(c, { clientId, deploymentId, acceptStaged: true, confirmForeignHosts: true });
    const r = await put(c, { clientId, deploymentId, grantCode: code });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect([r.json.status, getConnectionAnyLibrary(t.db, c.id)!.ltiPlatformId, t.lti.platforms.get(platformId)!.active, creates()]).toEqual(['registered', platformId, true, []]);
  });

  it('the lti-generic dynamic form fields, pre-filled from the staged platform as the wizard does, redeem the staged registration', async () => {
    const { c, platform, call, issue, put } = await staged();
    const dynamicFields = TEST_CHANNELS.channel('lti-generic')!.setup.bindingFields.filter((f) => f.method === 'dynamic');
    expect(dynamicFields.map((f) => [f.key, f.required])).toEqual([['clientId', true], ['deploymentId', true], ['grantCode', true]]);
    const dto = (await call('GET', `/app-api/connections/${c.id}`)).json as { platform: { clientId: string; deploymentIds: string[] } };
    // The DTO of a pending staged registration lists the staged deployments (no approval yet), so the wizard pre-fills them.
    expect(dto.platform.deploymentIds).toEqual(['dep-1']);
    const code = await issue(c, { acceptStaged: true, confirmForeignHosts: true });
    const prefill: Record<string, string> = { clientId: dto.platform.clientId, deploymentId: dto.platform.deploymentIds[0]!, grantCode: code };
    const r = await put(c, Object.fromEntries(dynamicFields.map((f) => [f.key, prefill[f.key] ?? ''])));
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(t.lti.platforms.get(platform.id)!.active).toBe(true);
  });

  // A1 BD-A1-106 (4f): skipped until A1 rules on two more app gaps (sent as BD-A1-107). G1: the register page compares
  // the registration url (the issuer) with the site URL, and the Canvas issuer is the profile issuer, so the real LTI
  // service answer gives SITE_MISMATCH (the fake below reports the site). G2: a staged connection needs a grant with
  // bound values (redemption phase 1, check 5), but app:grant issue binds values only for an admin-value channel, so
  // this PUT answers 422 GRANT_MISMATCH ["connection"] today.
  it.skip('A1 BD-A1-106 (4f): a staged Canvas dynamic connection takes the staged PUT body { clientId, deploymentId, grantCode }', async () => {
    const { call, issue, put, creates } = await setup();
    const site = 'https://school-a.canvas.sim.test';
    const created = await call('POST', '/app-api/connections', { name: 'Canvas', siteUrl: site, method: 'dynamic', lms: 'canvas', profile: 'canvas-sim-cloud' });
    expect(created.status, JSON.stringify(created.json)).toBe(201);
    const c = created.json;
    const reg = t.lti.addRegistration({ url: site, familyCode: 'canvas', stage: { url: 'https://canvas.sim.test', profile: 'canvas-sim-cloud', siteUrl: site, serviceUrl: site } });
    const page = await t.app.inject({ method: 'POST', url: '/tool/register', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: TEST_URLS.app },
      payload: new URLSearchParams({ registrationId: reg, ref: new URL(c.registrationUrl).searchParams.get('ref')! }).toString() });
    expect(page.body).toContain('data-connection-status="pending"');
    const dto = (await call('GET', `/app-api/connections/${c.id}`)).json as { platform: { id: string; clientId: string; deploymentIds: string[] } };
    const code = await issue(c, { clientId: dto.platform.clientId, deploymentId: dto.platform.deploymentIds[0]! });
    const r = await put(c, { clientId: dto.platform.clientId, deploymentId: dto.platform.deploymentIds[0]!, grantCode: code });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect([r.json.status, t.lti.platforms.get(dto.platform.id)!.active, creates()]).toEqual(['registered', true, []]);
  });
});

describe('AC-LA-E2-04-07: suspend and release pick the record kind from the stored target_kind', () => {
  it('AC-LA-E2-04-07: an admin-value binding (target_kind exclusive_platform) is suspended and released through its platform record', async () => {
    const { op, issue, connection, put } = await setup();
    const c = await connection('manual');
    expect((await put(c, manualBody(await issue(c, { boundValues: VALUES })))).status).toBe(200);
    const platformId = getConnectionAnyLibrary(t.db, c.id)!.ltiPlatformId!;
    expect(t.db.prepare('SELECT target_kind FROM binding_attempt WHERE connection_id = ?').all(c.id)).toEqual([{ target_kind: 'exclusive_platform' }]);
    const suspended = await op.suspend(c.id, 'ticket', 't');
    expect(suspended.exitCode, suspended.lines.join('\n')).toBe(0);
    expect(suspended.lines).toContain(`Binding: lti-generic platform ${platformId}`);
    expect(t.lti.platforms.get(platformId)!.active).toBe(false);
    const released = await op.release(c.id, 'ticket', 't');
    expect(released.exitCode, released.lines.join('\n')).toBe(0);
    expect(t.lti.platforms.has(platformId)).toBe(false);
    expect(approvalOf(t.db, platformId, 'dep-1')).toBeUndefined();
  });
});
