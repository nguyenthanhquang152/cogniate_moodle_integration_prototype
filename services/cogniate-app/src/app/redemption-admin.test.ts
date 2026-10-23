// LA-E2-04 (LA-ADR-02 D6; app API delta §3.4): the redemption of an admin-value grant. A manual binding compares every
// bound value with the body; a staged registration adopts its staged platform with no S1 create. Unit level with the
// fake LTI service; QA proves the stack (AC-LA-E2-04-03, -04 at K1-SIM).
import { createLogger, sha256Hex } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { approvalOf, grantsOfConnection, insertGrant } from '../domain/bindings.ts';
import { getConnectionAnyLibrary, stageRegistration } from '../domain/connections.ts';
import type { TestApp } from '../testkit.ts';
import { TEST_CHANNELS, THANH, ltiPlatform, testApp } from '../testkit.ts';
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

  const platformActive = () => t.lti.platforms.get('plt_staged')!.active;
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
