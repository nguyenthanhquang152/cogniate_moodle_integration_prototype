// T2a in-container API tests (no browser). Source: tasks/T2a.md, contract lti-service-api.md §1.2, §1.3, §2.1, §2.3,
// §3.9, security.md §2.1, §2.4. One test per AC id.
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { publicUrls } from '../lib/env';
import { httpsRequest } from '../lib/https';
import {
  ACCOUNT,
  apiKey,
  auth,
  checkErrorPage,
  errorCode,
  eventsSince,
  hasErrorShape,
  hostIs,
  LOGIN_URL,
  LAUNCH_URL,
  ltiApi,
  ltiSeed,
  SECOND_ACCOUNT,
} from '../lib/lti';
import { callWs } from '../lib/moodle-ws';
import { seed } from '../lib/seed';

const urls = publicUrls();
const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const PRIVATE_JWK_FIELDS = ['d', 'p', 'q', 'dp', 'dq', 'qi'];
const PLATFORM_FIELDS = [
  'id', 'url', 'clientId', 'name', 'authenticationEndpoint', 'accesstokenEndpoint', 'authConfig', 'publicKey', 'active', 'deploymentIds', 'productFamilyCode',
];

function platformBody(issuer: string, clientId: string, over: Record<string, unknown> = {}) {
  return {
    url: issuer,
    clientId,
    name: `QA ${clientId}`,
    authenticationEndpoint: `${issuer}/mod/lti/auth.php`,
    accesstokenEndpoint: `${issuer}/mod/lti/token.php`,
    authConfig: { method: 'JWK_SET', key: `${issuer}/mod/lti/certs.php` },
    deploymentIds: ['1'],
    ...over,
  };
}

async function postLogin(account: string, fields: Record<string, string>) {
  const body = new URLSearchParams(fields).toString();
  return httpsRequest(`${urls.lti}/lti/login/${account}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(body)) },
    body,
  });
}

describe('T2a keys and platforms', () => {
  it('AC-T2-01 GET /lti/keys/cogniate lists RS256 public keys only; an unknown account gets 404', async () => {
    const res = await httpsRequest(`${urls.lti}/lti/keys/${ACCOUNT}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    const keys = (JSON.parse(res.body) as { keys?: Record<string, unknown>[] }).keys ?? [];
    expect(keys.length).toBeGreaterThanOrEqual(1);
    for (const k of keys) {
      expect(k.kty).toBe('RSA');
      expect(typeof k.kid === 'string' && k.kid !== '', 'kid').toBe(true);
      expect(k.alg).toBe('RS256');
      expect(k.use).toBe('sig');
      expect(typeof k.n === 'string' && typeof k.e === 'string', 'n and e').toBe(true);
      for (const f of PRIVATE_JWK_FIELDS) expect(k, `no private field ${f}`).not.toHaveProperty(f);
    }
    expect((await httpsRequest(`${urls.lti}/lti/keys/unknown-${runId}`)).status).toBe(404);
  });

  it('AC-T2-02 platforms API: create, duplicate, list, auth errors, and account isolation', async () => {
    const key = apiKey(ACCOUNT);
    const issuer = `https://qa-ac02-${runId}.test`;
    const clientId = `qa-ac02-${runId}`;
    const created = await ltiApi<Record<string, unknown>>('POST', '/api/platforms', { authorization: auth.bearer(key), body: platformBody(issuer, clientId) });
    expect(created.status, created.body).toBe(201);
    for (const f of PLATFORM_FIELDS) expect(created.json, `field ${f}`).toHaveProperty(f);
    expect(created.json.url).toBe(issuer);
    expect(created.json.clientId).toBe(clientId);
    expect((created.json.authConfig as { method?: string }).method).toBe('JWK_SET');
    expect(String(created.json.publicKey)).toMatch(/-----BEGIN PUBLIC KEY-----/);
    expect(created.json.active).toBe(true);
    expect(created.json.deploymentIds).toEqual(['1']);

    const again = await ltiApi('POST', '/api/platforms', { authorization: auth.bearer(key), body: platformBody(issuer, clientId) });
    expect(again.status).toBe(409);
    expect(errorCode(again)).toBe('PLATFORM_ALREADY_EXISTS');
    expect(hasErrorShape(again), 'error shape').toBe(true);

    const list = await ltiApi<{ platforms: { id: string }[] }>('GET', `/api/platforms?clientId=${encodeURIComponent(clientId)}`, { authorization: auth.bearer(key) });
    expect(list.status).toBe(200);
    expect(list.json.platforms.map((p) => p.id)).toEqual([created.json.id]);

    const none = await ltiApi('GET', '/api/platforms');
    expect(none.status).toBe(401);
    expect(errorCode(none)).toBe('INVALID_AUTHORIZATION_HEADER');
    expect(hasErrorShape(none), 'error shape').toBe(true);

    const wrong = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(`ltis_${crypto.randomBytes(32).toString('base64url')}`) });
    expect(wrong.status).toBe(401);
    expect(errorCode(wrong)).toBe('INVALID_LTIK_AUTH_AUTHORIZATION_HEADER');
    expect(hasErrorShape(wrong), 'error shape').toBe(true);

    const second = apiKey(SECOND_ACCOUNT);
    const otherList = await ltiApi<{ platforms: unknown[] }>('GET', `/api/platforms?clientId=${encodeURIComponent(clientId)}`, { authorization: auth.bearer(second) });
    expect(otherList.status).toBe(200);
    expect(otherList.json.platforms).toEqual([]);
    const otherGet = await ltiApi('GET', `/api/platforms/${encodeURIComponent(String(created.json.id))}`, { authorization: auth.bearer(second) });
    expect(otherGet.status).toBe(404);
  });

  it('AC-T2-29 platform URLs must be https on the issuer origin; only JWK_SET; no outbound call to evil.test', async () => {
    const key = apiKey(ACCOUNT);
    const since = Date.now() - 1_000;
    const issuer = urls.moodle;
    const cases: [string, Record<string, unknown>, number, string][] = [
      ['jwks on evil.test', { authConfig: { method: 'JWK_SET', key: 'https://evil.test/jwks' } }, 400, 'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN'],
      ['token endpoint on evil.test', { accesstokenEndpoint: 'https://evil.test/token' }, 400, 'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN'],
      ['auth endpoint on evil.test', { authenticationEndpoint: 'https://evil.test/auth' }, 400, 'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN'],
      ['RSA_KEY method', { authConfig: { method: 'RSA_KEY', key: '-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----' } }, 400, 'UNSUPPORTED_AUTH_METHOD'],
    ];
    for (const [label, over, status, code] of cases) {
      const res = await ltiApi('POST', '/api/platforms', { authorization: auth.bearer(key), body: platformBody(issuer, `qa-ac29-${label.replace(/\W+/g, '-')}-${runId}`, over) });
      expect(res.status, label).toBe(status);
      expect(errorCode(res), label).toBe(code);
      expect(hasErrorShape(res), `${label}: error shape`).toBe(true);
    }
    const httpIssuer = 'http://qa-ac29-plain.test';
    const plain = await ltiApi('POST', '/api/platforms', { authorization: auth.bearer(key), body: platformBody(httpIssuer, `qa-ac29-http-${runId}`) });
    expect(plain.status, 'http:// URL').toBe(400);
    expect(errorCode(plain), 'http:// URL').toBe('INVALID_REQUEST');

    await new Promise((r) => setTimeout(r, 1_500)); // let the log lines arrive
    const evil = eventsSince('lti-service', since, (e) => /^outbound_/.test(String(e.event)) && hostIs(e, 'evil.test'));
    expect(evil, 'outbound_request or outbound_blocked for evil.test').toEqual([]);
  });
});

describe('T2a login errors', () => {
  it('AC-T2-12 login with an unknown issuer → 400 UNKNOWN_PLATFORM page without Location; unknown account → 404 UNKNOWN_TOOL_ACCOUNT', async () => {
    const fields = { iss: 'https://evil.test', login_hint: 'qa', target_link_uri: `${LAUNCH_URL}?resource=seed` };
    const evil = await postLogin(ACCOUNT, fields);
    expect(checkErrorPage(evil, 'UNKNOWN_PLATFORM', { statuses: [400], test: 'AC-T2-12', endpoint: 'login' })).toEqual([]);
    const unknown = await postLogin(`unknown-${runId}`, { ...fields, iss: urls.moodle });
    expect(checkErrorPage(unknown, 'UNKNOWN_TOOL_ACCOUNT', { statuses: [404], test: 'AC-T2-12', endpoint: 'login' })).toEqual([]);
  });

  it('AC-T2-13 login with target_link_uri on evil.test → 400 INVALID_TARGET_LINK_URI page', async () => {
    const s = ltiSeed();
    const res = await postLogin(ACCOUNT, {
      iss: urls.moodle,
      client_id: s.clientId,
      lti_deployment_id: s.deploymentId,
      login_hint: 'qa',
      target_link_uri: 'https://evil.test/x',
    });
    expect(checkErrorPage(res, 'INVALID_TARGET_LINK_URI', { statuses: [400], test: 'AC-T2-13', endpoint: 'login' })).toEqual([]);
    expect(LOGIN_URL).toContain(`/lti/login/${ACCOUNT}`);
  });
});

describe('T2a seed hooks', () => {
  it('AC-T2-31 seed.json ltiSeed matches the LTI service platform and the Moodle activities (host runner checks reruns and reset)', async () => {
    const s = ltiSeed();
    const p = await ltiApi<Record<string, unknown>>('GET', `/api/platforms/${encodeURIComponent(s.platformId)}`, { authorization: auth.bearer(apiKey(ACCOUNT)) });
    expect(p.status, p.body).toBe(200);
    expect(p.json.url).toBe(urls.moodle);
    expect(p.json.clientId).toBe(s.clientId);
    expect(p.json.deploymentIds).toContain(s.deploymentId);
    expect(String(s.deploymentId)).toBe(String(s.typeId)); // deployment id = tool type id (T2a scope)

    const names: Record<string, string> = { 'COGNIATE-DEV-101': 'Seed activity', 'COGNIATE-DEV-102': 'Seed activity 102' };
    for (const [shortname, name] of Object.entries(names)) {
      const sections = await callWs<{ modules: { id: number; name: string; modname: string }[] }[]>(seed().oracleToken, 'core_course_get_contents', {
        courseid: seed().courses[shortname as 'COGNIATE-DEV-101'],
      });
      const mod = sections.flatMap((sec) => sec.modules).find((m) => m.id === s.cmids[shortname]);
      expect(mod, `${shortname} cmid ${s.cmids[shortname]}`).toBeDefined();
      expect(mod!.modname).toBe('lti');
      expect(mod!.name).toBe(name);
    }
  });
});
