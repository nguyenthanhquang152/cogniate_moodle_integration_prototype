import { randomToken, sha256Hex } from '@cogniate/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GrantPurpose } from '../domain/bindings.ts';
import { getGrant, insertGrant } from '../domain/bindings.ts';
import type { Connection } from '../domain/connections.ts';
import { createConnection, disableConnection, getConnection, markLaunched, markRegistered } from '../domain/connections.ts';
import { ensureLibrary } from '../domain/libraries.ts';
import type { LmsType } from '../providers/types.ts';
import type { TestApp } from '../testkit.ts';
import { QA_B, THANH, testApp } from '../testkit.ts';

let t: TestApp;
let cookie: string;
beforeEach(async () => {
  t = await testApp();
  cookie = await t.login(THANH);
  t.lti.providers.push({
    id: 'canvas-sim-cloud', lms: 'canvas', label: 'Canvas cloud (simulation)', sharing: 'exclusive',
    issuer: 'https://canvas.sim.test', authenticationEndpoint: 'https://sso.canvas.sim.test/api/lti/authorize_redirect',
    accesstokenEndpoint: '{serviceUrl}/login/oauth2/token', jwksUrl: 'https://sso.canvas.sim.test/api/lti/security/jwks',
    siteUrlOn: 'platform', serviceUrl: true, simulation: true, sharedPlatform: null,
  });
});
afterEach(async () => { await t?.app.close(); });

function connection(lms: LmsType = 'canvas', libraryName = THANH.library) {
  const library = ensureLibrary(t.db, libraryName, t.clock.now);
  return createConnection(t.db, library.id, {
    name: 'School', siteUrl: 'https://school-a.canvas.sim.test', method: 'manual', lms, profile: 'canvas-sim-cloud',
  }, null, t.clock.now);
}
const pathOf = (id: string) => `/app-api/connections/${id}/deployments`;
const body = { deploymentId: 'deployment-two', grantCode: 'g'.repeat(43) };
const post = (id: string, payload: unknown = body) => t.app.inject({
  method: 'POST', url: pathOf(id), headers: { ...t.writeHeaders(cookie), 'content-type': 'application/json', 'x-trace-id': 'canvas-deploy-trace-123' },
  payload: JSON.stringify(payload),
});

/** A repository fixture for the route's local guards (no outbound binding is needed for these checks). */
function ready(c = connection(), status: 'registered' | 'connected' = 'registered') {
  markRegistered(t.db, c.id, { id: `plt_${c.id}`, issuer: 'https://canvas.sim.test', clientId: 'canvas-client', deploymentIds: ['deployment-one'], productFamilyCode: 'canvas' }, t.clock.now);
  if (status === 'connected') markLaunched(t.db, c.id, t.clock.now);
  return getConnection(t.db, c.libraryId, c.id)!;
}

function grant(c: Connection, purpose: GrantPurpose, deploymentId: string) {
  const code = randomToken();
  const id = insertGrant(t.db, {
    libraryId: c.libraryId, connectionId: c.id, lms: c.lms, profile: c.profile,
    siteUrl: c.siteUrl, serviceUrl: c.serviceUrl, clientId: 'canvas-client', deploymentId,
    purpose, note: 'Canvas route self-check fixture', expiresAt: t.clock.now + 60_000,
  }, sha256Hex(code), t.clock.now);
  return { code, id };
}

/** Use the real shared redemption engine, with the testkit's local LTI service model. */
async function boundConnection() {
  // Use connection creation so the fixture receives the provider snapshot required by phase 1.
  const created = await t.app.inject({
    method: 'POST', url: '/app-api/connections', headers: t.writeHeaders(cookie),
    payload: { name: 'School', siteUrl: 'https://school-a.canvas.sim.test', method: 'manual', lms: 'canvas', profile: 'canvas-sim-cloud' },
  });
  expect(created.statusCode).toBe(201);
  const library = ensureLibrary(t.db, THANH.library, t.clock.now);
  const c = getConnection(t.db, library.id, created.json().id)!;
  const initial = grant(c, 'initial', 'deployment-one');
  const answer = await t.app.inject({
    method: 'PUT', url: `/app-api/connections/${c.id}/platform`, headers: t.writeHeaders(cookie),
    payload: { clientId: 'canvas-client', deploymentId: 'deployment-one', grantCode: initial.code },
  });
  expect(answer.statusCode).toBe(200);
  expect(getGrant(t.db, initial.id)?.redeemedAt).toBe(t.clock.now);
  return getConnection(t.db, c.libraryId, c.id)!;
}

describe('Canvas add deployment route (app contract §4.7.2)', () => {
  it('requires a session and checks library ownership before LMS capability or body', async () => {
    const own = ready();
    expect((await t.app.inject({ method: 'POST', url: pathOf(own.id), headers: { origin: t.writeHeaders(cookie).origin }, payload: body })).statusCode).toBe(401);
    for (const id of [connection('canvas', QA_B.library).id, connection('moodle', QA_B.library).id, 'con_missing']) {
      const answer = await post(id, {});
      expect(answer.statusCode).toBe(404);
      expect(answer.json().details.message).toBe('NOT_FOUND');
    }
    for (const lms of ['moodle', 'blackboard'] as const) {
      const answer = await post(connection(lms).id, {});
      expect(answer.statusCode).toBe(409);
      expect(answer.json().details).toMatchObject({ message: 'CAPABILITY_NOT_SUPPORTED', capability: 'addDeployment' });
    }
    expect(t.lti.calls).toEqual([]);
  });

  it('refuses pending and disabled connections before any grant or LTI call', async () => {
    const pending = connection();
    const disabled = ready();
    disableConnection(t.db, disabled.libraryId, disabled.id, t.clock.now);
    for (const c of [pending, disabled]) {
      const answer = await post(c.id);
      expect(answer.statusCode).toBe(409);
      expect(answer.json().details.message).toBe('CONNECTION_NOT_READY');
    }
    expect(t.lti.calls).toEqual([]);
  });

  it.each([
    ['registered', 'lti_platform_id'],
    ['registered', 'platform_json'],
    ['connected', 'lti_platform_id'],
    ['connected', 'platform_json'],
  ] as const)('refuses a %s connection missing %s before body parsing or grant handling', async (status, column) => {
    const c = ready(connection(), status);
    const approval = grant(c, 'add_deployment', 'deployment-two');
    t.db.prepare(`UPDATE connection SET ${column} = NULL WHERE id = ?`).run(c.id);
    for (const payload of [{}, body, { ...body, grantCode: approval.code }]) {
      const answer = await post(c.id, payload);
      expect(answer.statusCode).toBe(409);
      expect(answer.json().details.message).toBe('CONNECTION_NOT_READY');
    }
    expect(t.lti.calls).toEqual([]);
    expect(getGrant(t.db, approval.id)?.redeemedAt).toBeNull();
    expect(getConnection(t.db, c.libraryId, c.id)?.redeemingAttempt).toBeNull();
    expect(t.logs.filter((line) => line.event === 'grant_rejected' || line.event === 'grant_attempt_started')).toEqual([]);
  });

  it('accepts only deploymentId and grantCode, with the strict provider field rules', async () => {
    const c = ready();
    const cases = [
      { payload: {}, fields: ['deploymentId', 'grantCode'] },
      { payload: { ...body, clientId: 'not-an-input' }, fields: ['clientId'] },
      { payload: { ...body, clientSecret: 'not-an-input' }, fields: ['clientSecret'] },
      { payload: { ...body, grantCode: '' }, fields: ['grantCode'] },
      { payload: { ...body, deploymentId: 'has space' }, fields: ['deploymentId'] },
      { payload: { ...body, deploymentId: '界' }, fields: ['deploymentId'] },
      { payload: null, fields: ['deploymentId', 'grantCode'] },
    ];
    for (const example of cases) {
      const answer = await post(c.id, example.payload);
      expect(answer.statusCode).toBe(422);
      expect(answer.json().details).toMatchObject({ message: 'INVALID_PLATFORM_VALUES', fields: example.fields });
    }
    expect(t.lti.calls).toEqual([]);
  });

  it.each(['registered', 'connected'] as const)('adds an approved deployment to a %s connection and leaves the first deployment unchanged', async (status) => {
    let c = await boundConnection();
    if (status === 'connected') {
      markLaunched(t.db, c.id, t.clock.now);
      c = getConnection(t.db, c.libraryId, c.id)!;
    }
    const initialPlatform = structuredClone(t.lti.platforms.get(c.ltiPlatformId!)!);
    const approval = grant(c, 'add_deployment', 'deployment-two');
    t.lti.calls.length = 0;
    const answer = await post(c.id, { deploymentId: ' deployment-two ', grantCode: ` ${approval.code} ` });
    expect(answer.statusCode).toBe(200);
    expect(answer.json()).toMatchObject({
      id: c.id, lms: 'canvas', status, platform: { clientId: 'canvas-client', deploymentIds: ['deployment-one', 'deployment-two'] },
    });
    expect(getGrant(t.db, approval.id)?.redeemedAt).toBe(t.clock.now);
    const platform = t.lti.platforms.get(c.ltiPlatformId!)!;
    expect(platform.deployments.find((d) => d.deploymentId === 'deployment-one')).toEqual(initialPlatform.deployments[0]);
    expect(platform.bindingRef).toBe(initialPlatform.bindingRef);
    expect(platform.active).toBe(initialPlatform.active);
    expect(t.lti.calls.some((call) => call.startsWith('PATCH platform'))).toBe(false);
    expect(t.lti.calls.some((call) => call.startsWith('POST deployment'))).toBe(true);
    // Only the engine decides a finalized repeat. A different unknown code is not used.
    t.lti.calls.length = 0;
    const repeated = await post(c.id, { deploymentId: 'deployment-two', grantCode: 'x'.repeat(43) });
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json()).toEqual(answer.json());
    expect(t.lti.calls).toEqual([]);
  });

  it('preserves shared-engine grant and service errors, and keeps a failed grant available for retry', async () => {
    const c = await boundConnection();
    const invalid = await post(c.id);
    expect(invalid.statusCode).toBe(403);
    expect(invalid.json().details.message).toBe('GRANT_INVALID');
    const wrong = grant(c, 'add_deployment', 'other-deployment');
    const mismatch = await post(c.id, { deploymentId: 'deployment-two', grantCode: wrong.code });
    expect(mismatch.statusCode).toBe(422);
    expect(mismatch.json().details).toMatchObject({ message: 'GRANT_MISMATCH', fields: ['deploymentId'] });
    const approval = grant(c, 'add_deployment', 'deployment-two');
    t.lti.faults.push({ op: 'POST deployment', action: 'fail_before' });
    const failed = await post(c.id, { deploymentId: 'deployment-two', grantCode: approval.code });
    expect(failed.statusCode).toBe(502);
    expect(failed.json().details.message).toBe('LTI_SERVICE_ERROR');
    expect(getGrant(t.db, approval.id)?.redeemedAt).toBeNull();
    expect(JSON.stringify(t.logs)).not.toContain(approval.code);
    const retried = await post(c.id, { deploymentId: 'deployment-two', grantCode: approval.code });
    expect(retried.statusCode).toBe(200);
    expect(retried.json().platform.deploymentIds).toEqual(['deployment-one', 'deployment-two']);
  });
});
