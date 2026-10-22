import { TEST_CHANNELS } from '../testkit.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LtiToolKey } from '../clients/lti-client.ts';
import { LtiServiceError } from '../clients/lti-client.ts';
import { createConnection } from '../domain/connections.ts';
import { ensureLibrary } from '../domain/libraries.ts';
import type { LmsType } from '../providers/types.ts';
import { providerOf } from '../providers/index.ts';
import type { TestApp } from '../testkit.ts';
import { QA_B, TEST_URLS, THANH, testApp } from '../testkit.ts';

let t: TestApp;
let cookie: string;
beforeEach(async () => { t = await testApp(); cookie = await t.login(THANH); });
afterEach(async () => { vi.restoreAllMocks(); await t?.app.close(); });

function connection(lms: LmsType = 'canvas', libraryName = THANH.library, profile = 'canvas-cloud-production') {
  const library = ensureLibrary(t.db, libraryName, t.clock.now);
  return createConnection(t.db, library.id, {
    name: 'School', siteUrl: 'https://school.example.test', serviceUrl: 'https://school.instructure.com',
    method: 'manual', channel: lms, profile: lms === 'canvas' ? profile : lms === 'moodle' ? 'standard' : 'blackboard',
  }, null, t.clock.now, TEST_CHANNELS, providerOf(lms)!.sharingOf);
}
const pathOf = (id: string) => `/app-api/connections/${id}/canvas-configuration`;
const get = (path: string) => t.app.inject({ method: 'GET', url: path, headers: { cookie, 'x-trace-id': 'canvas-export-trace-123' } });

function expectedExport() {
  const launch = `${TEST_URLS.lti}/lti/launch/cogniate`;
  return {
    title: `Cogniate (${THANH.library})`,
    description: 'Cogniate courses (SCORM 1.2 and HTML) with grade return.',
    oidc_initiation_url: `${TEST_URLS.lti}/lti/login/cogniate`,
    target_link_uri: launch,
    scopes: [
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/score',
      'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
    ],
    extensions: [{
      domain: 'lti.cogniate.test', tool_id: 'cogniate', platform: 'canvas.instructure.com', privacy_level: 'anonymous',
      settings: { text: 'Cogniate', placements: [{ placement: 'assignment_selection', message_type: 'LtiDeepLinkingRequest', target_link_uri: launch, text: 'Cogniate' }] },
    }],
    public_jwk_url: `${TEST_URLS.lti}/lti/keys/cogniate`,
    custom_fields: {},
  };
}

describe('Canvas configuration export (app contract §4.6)', () => {
  it('returns the exact URL document, attachment name and no-store headers for every Canvas profile', async () => {
    for (const profile of ['canvas-cloud-production', 'canvas-cloud-beta', 'canvas-cloud-test', 'canvas-self-hosted', 'canvas-sim-cloud']) {
      const c = connection('canvas', THANH.library, profile);
      const answer = await get(pathOf(c.id));
      expect(answer.statusCode).toBe(200);
      expect(answer.json()).toEqual(expectedExport());
      expect(answer.headers).toMatchObject({
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': 'attachment; filename="cogniate-canvas-lti.json"',
        'cache-control': 'no-store',
      });
      expect(answer.headers).not.toHaveProperty('x-cogniate-key-id');
      expect((await get(`${pathOf(c.id)}?jwk=url`)).body).toBe(answer.body);
    }
    expect(t.lti.calls).not.toContain('GET tool keys');
  });

  it('uses one active public-key snapshot per inline response and never exports private members', async () => {
    const c = connection();
    const first: LtiToolKey = { kty: 'RSA', kid: 'key-one', alg: 'RS256', use: 'sig', n: 'modulus-one', e: 'AQAB' };
    const second: LtiToolKey = { ...first, kid: 'key-two', n: 'modulus-two' };
    const withPrivate = { ...first, d: 'private-exponent', p: 'private-prime' };
    const keys = vi.spyOn(t.lti.client, 'getToolKeys')
      .mockResolvedValueOnce([withPrivate, { ...first, kid: 'retired-key' }])
      .mockResolvedValueOnce([second, first]);
    const base = (await get(pathOf(c.id))).json<Record<string, unknown>>();
    delete base.public_jwk_url;
    for (const key of [first, second]) {
      const answer = await get(`${pathOf(c.id)}?jwk=inline`);
      expect(answer.statusCode).toBe(200);
      expect(answer.json()).toEqual({ ...base, public_jwk: key });
      expect(answer.headers['x-cogniate-key-id']).toBe(key.kid);
      expect(answer.headers['cache-control']).toBe('no-store');
      expect(answer.body).not.toMatch(/private-exponent|private-prime|public_jwk_url/);
    }
    expect(keys).toHaveBeenCalledTimes(2);
    expect(keys).toHaveBeenCalledWith('cogniate', 'canvas-export-trace-123');
  });

  it('requires a session and hides foreign connections before checking capability or query', async () => {
    const own = connection();
    const foreign = connection('canvas', QA_B.library);
    const foreignMoodle = connection('moodle', QA_B.library, 'standard');
    expect((await t.app.inject({ method: 'GET', url: pathOf(own.id) })).statusCode).toBe(401);
    for (const id of [foreign.id, foreignMoodle.id, 'con_missing']) {
      const answer = await get(`${pathOf(id)}?jwk=other`);
      expect(answer.statusCode).toBe(404);
      expect(answer.json().details.message).toBe('NOT_FOUND');
    }
    for (const lms of ['moodle', 'blackboard'] as const) {
      const answer = await get(`${pathOf(connection(lms).id)}?jwk=inline`);
      expect(answer.statusCode).toBe(409);
      expect(answer.json().details).toMatchObject({ message: 'CAPABILITY_NOT_SUPPORTED', capability: 'canvasConfiguration' });
    }
    expect(t.lti.calls).not.toContain('GET tool keys');
  });

  it('rejects an unknown, empty or repeated jwk option without fetching keys', async () => {
    const c = connection();
    for (const query of ['jwk=other', 'jwk=', 'jwk=url&jwk=inline']) {
      const answer = await get(`${pathOf(c.id)}?${query}`);
      expect(answer.statusCode).toBe(400);
      expect(answer.json().details.message).toBe('INVALID_REQUEST');
    }
    expect(t.lti.calls).not.toContain('GET tool keys');
  });

  it('returns 502 with a trace when the public key is missing or the LTI service fails', async () => {
    const c = connection();
    vi.spyOn(t.lti.client, 'getToolKeys').mockResolvedValueOnce([])
      .mockRejectedValueOnce(new LtiServiceError(0, 'LTI_UNAVAILABLE', 'upstream details'));
    for (let index = 0; index < 2; index++) {
      const answer = await get(`${pathOf(c.id)}?jwk=inline`);
      expect(answer.statusCode).toBe(502);
      expect(answer.json().details).toMatchObject({ message: 'LTI_SERVICE_ERROR', description: expect.stringContaining('canvas-export-trace-123') });
      expect(answer.headers['cache-control']).toBe('no-store');
      expect(answer.headers).not.toHaveProperty('x-cogniate-key-id');
      expect(answer.body).not.toContain('upstream details');
    }
  });
});
