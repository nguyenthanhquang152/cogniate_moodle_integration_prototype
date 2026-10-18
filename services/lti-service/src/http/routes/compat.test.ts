import type { OutboundRequest, OutboundResponse } from '@cogniate/shared';
import { OutboundError } from '@cogniate/shared';
import { createLocalJWKSet, jwtVerify } from 'jose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLAIM } from '../../lti/checks.ts';
import { deepLinkingForm, DL_CLAIM } from '../../lti/deep-linking.ts';
import { AGS_SCOPES } from '../../platform/ags.ts';
import { NRPS_SCOPE } from '../../platform/nrps.ts';
import { createLaunch } from '../../store/launches.ts';
import { createPlatform, getPlatform, updatePlatform } from '../../store/platforms.ts';
import { publicJwks } from '../../store/tool-keys.ts';
import type { Harness } from '../../testkit.ts';
import { CLIENT_ID, ISSUER, LAUNCH, harness, moodleClaims } from '../../testkit.ts';

const BASE = `${ISSUER}/mod/lti/services.php/2/lineitems?type_id=1`;
const ITEM = `${ISSUER}/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1`;
const MEMBERS = `${ISSUER}/mod/lti/services.php/CourseSection/2/bindings/1/memberships`;
const RETURN = `${ISSUER}/mod/lti/contentitem_return.php?course=2&id=1`;
const item = { label: 'Extra column', scoreMaximum: 10 };
const enc = encodeURIComponent;
const memberBody = {
  id: MEMBERS, context: { id: '2', label: 'Course', title: 'Course title', email: 'hidden@example.test' },
  members: [{ user_id: '5', roles: ['Learner'], name: 'Hidden', email: 'hidden@example.test', given_name: 'Hidden', picture: 'https://evil.test/photo' }],
};

describe('T3c compat routes with real API authorization', () => {
  let h: Harness;
  let calls: Array<{ url: string; req: OutboundRequest | undefined }>;
  let answer: () => OutboundResponse;
  const response = (status: number, data: unknown = '', headers: Record<string, string> = {}): OutboundResponse => {
    const body = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));
    return { status, headers, body, text: () => body.toString(), json: () => JSON.parse(body.toString()) as unknown };
  };
  const auth = (over: Record<string, unknown> = {}, type = 'LtiResourceLinkRequest') => {
    const { ltik } = createLaunch(h.db, {
      toolAccountId: 'cogniate', platformId: h.platform.id, deploymentId: '1', messageType: type,
      claims: moodleClaims({
        [CLAIM.ags]: { lineitems: BASE, lineitem: ITEM, scope: Object.values(AGS_SCOPES) },
        [CLAIM.nrps]: { context_memberships_url: MEMBERS, service_versions: ['2.0'] }, ...over,
      }),
    }, 86400, h.clock.now);
    return { authorization: `LTIK-AUTH-V2 ${h.apiKey}:${ltik}` };
  };
  const serviceAuth = async (headers: { authorization: string }) => {
    const r = await h.app.inject({ url: '/api/idtoken', headers });
    return { authorization: `SERVICE-AUTH-V1 ${h.apiKey}:${r.json().services.serviceKey}` };
  };
  beforeEach(async () => {
    h = await harness(); calls = []; answer = () => response(200, { id: ITEM, ...item });
    h.outbound.request = async (url, req) => {
      calls.push({ url, req });
      return url === h.platform.tokenEndpoint ? response(200, { access_token: 'platform-token', expires_in: 3600 }) : answer();
    };
  });
  afterEach(async () => { await h.app.close(); h.db.close(); });

  it('form and message use the existing signed response and escape both attributes', async () => {
    const headers = auth({ [CLAIM.deepLinkingSettings]: { deep_link_return_url: RETURN, accept_types: ['ltiResourceLink'], data: 'echo-data' } }, 'LtiDeepLinkingRequest');
    const payload = { contentItems: [{ type: 'ltiResourceLink', url: LAUNCH, lineItem: item }], options: { message: 'Added' } };
    for (const suffix of ['', '/message', '/form']) {
      const r = await h.app.inject({ method: 'POST', url: `/api/deeplinking${suffix}`, headers, payload });
      expect(r.statusCode).toBe(200);
      const data = r.json();
      const jwt = suffix === '/form' ? /name="JWT" value="([^"]+)"/.exec(data.form)![1]! : data.message;
      const { payload: claims } = await jwtVerify(jwt, createLocalJWKSet({ keys: publicJwks(h.db, 'cogniate') }), { issuer: CLIENT_ID, audience: ISSUER });
      expect(claims).toMatchObject({ [DL_CLAIM.contentItems]: payload.contentItems, [DL_CLAIM.data]: 'echo-data', [DL_CLAIM.msg]: 'Added', [CLAIM.deploymentId]: '1' });
      if (suffix === '/form') expect(data.form).toContain('action="https://moodle.test/mod/lti/contentitem_return.php?course=2&amp;id=1"');
      else expect(data.target).toBe(RETURN);
    }
    const form = deepLinkingForm({ target: '<>&"\'', message: '"><script>bad()</script>' });
    expect(form.match(/<form /g)).toHaveLength(1);
    expect(form.match(/<script>/g)).toHaveLength(1);
    expect(form).toContain('&lt;&gt;&amp;&quot;');
    expect(form).toContain('&quot;&gt;&lt;script&gt;bad()&lt;/script&gt;');
    expect(form).toMatch(/<script>document.getElementById\("lti_dl_submit"\).submit\(\)<\/script>$/);
    expect(calls).toEqual([]);
  });

  it('both deep-link aliases reject resource launches, service auth and invalid content', async () => {
    const headers = auth();
    const service = await serviceAuth(headers);
    const dl = auth({ [CLAIM.deepLinkingSettings]: { deep_link_return_url: RETURN } }, 'LtiDeepLinkingRequest');
    for (const suffix of ['form', 'message']) {
      for (const [credential, expected, payload] of [[headers, 403, { contentItems: [item] }], [service, 401, {}], [dl, 400, { contentItems: [] }]] as const) {
        const r = await h.app.inject({ method: 'POST', url: `/api/deeplinking/${suffix}`, headers: credential, payload });
        expect(r.statusCode).toBe(expected);
      }
    }
  });

  it('creates, updates and deletes through both ltik and service auth with exact methods, body and scope', async () => {
    const headers = auth();
    for (const credential of [headers, await serviceAuth(headers)]) {
      for (const method of ['POST', 'PUT', 'DELETE'] as const) {
        answer = () => response(method === 'DELETE' ? 204 : 201, { id: ITEM, ...item });
        const r = await h.app.inject({ method, url: method === 'POST' ? '/api/lineitems' : `/api/lineitems/${enc(ITEM)}`, headers: credential,
          ...(method === 'DELETE' ? {} : { payload: { ...item, unknown: 'ignored', id: 'ignored' } }) });
        expect(r.statusCode).toBe(method === 'DELETE' ? 204 : 201);
        const call = calls.at(-1)!;
        expect(call.url).toBe(method === 'POST' ? BASE : ITEM);
        expect(call.req?.method).toBe(method);
        if (method !== 'DELETE') {
          expect(JSON.parse(call.req!.body! as string)).toEqual(item);
          expect(call.req?.headers?.['content-type']).toBe('application/vnd.ims.lis.v2.lineitem+json');
          expect(r.json()).toEqual({ id: ITEM, ...item });
        } else expect(r.body).toBe('');
      }
    }
    const tokenCalls = calls.filter((c) => c.url === h.platform.tokenEndpoint);
    expect(tokenCalls).toHaveLength(1);
    expect(new URLSearchParams(String(tokenCalls[0]!.req!.body)).get('scope')).toBe(AGS_SCOPES.lineitem);
  });

  it('full line item updates accept empty optional metadata returned by an AGS platform', async () => {
    const payload = { ...item, resourceId: '', tag: null, startDateTime: '', endDateTime: null, gradesReleased: false };
    const r = await h.app.inject({ method: 'PUT', url: `/api/lineitems/${enc(ITEM)}`, headers: auth(), payload });
    expect(r.statusCode).toBe(201);
    expect(JSON.parse(String(calls.at(-1)!.req!.body))).toEqual(payload);
  });

  it('all writes reject readonly or missing scopes before any outbound attempt', async () => {
    for (const scope of [[AGS_SCOPES.lineitemReadonly], []]) {
      const headers = auth({ [CLAIM.ags]: { lineitems: BASE, scope } });
      for (const method of ['POST', 'PUT', 'DELETE'] as const) {
        const r = await h.app.inject({ method, url: method === 'POST' ? '/api/lineitems' : `/api/lineitems/${enc(ITEM)}`, headers,
          ...(method === 'DELETE' ? {} : { payload: item }) });
        expect([r.statusCode, r.json().details.message]).toEqual([403, 'SERVICE_NOT_AVAILABLE']);
      }
    }
    expect(calls).toEqual([]);
  });

  it('write bodies require label and positive scoreMaximum; optional fields are validated', async () => {
    const headers = auth();
    for (const method of ['POST', 'PUT'] as const) {
      for (const payload of [{ label: 'Only label' }, { ...item, scoreMaximum: 0 }, { ...item, label: ' ' }, { ...item, startDateTime: 'yesterday' }, { ...item, gradesReleased: 'yes' }]) {
        const r = await h.app.inject({ method, url: method === 'POST' ? '/api/lineitems' : `/api/lineitems/${enc(ITEM)}`, headers, payload });
        expect([r.statusCode, r.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
      }
    }
    expect(calls).toEqual([]);
  });

  it('PUT and DELETE reject foreign, missing-query and encoded-separator URLs without outbound calls', async () => {
    const headers = auth();
    for (const url of ['https://evil.test/item', ITEM.replace('?type_id=1', ''), ITEM.replace('/7/', '/7%2f../'), ITEM.replace('/7/', '/%252e/'), ITEM.replace('/7/', '/%5C/')]) {
      for (const method of ['PUT', 'DELETE'] as const) {
        const r = await h.app.inject({ method, url: `/api/lineitems/${enc(url)}`, headers, ...(method === 'PUT' ? { payload: item } : {}) });
        expect([r.statusCode, r.json().details.message]).toEqual([400, 'INVALID_LINE_ITEM_ID']);
      }
    }
    expect(calls).toEqual([]);
  });

  it('memberships maps user_id, strips personal fields, defaults status, and preserves short and URI role filters', async () => {
    const headers = auth();
    for (const credential of [headers, await serviceAuth(headers)]) {
      for (const role of ['Learner', 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner']) {
        answer = () => response(200, memberBody, { link: `<${MEMBERS}?page=2>; rel="next"` });
        const r = await h.app.inject({ url: `/api/memberships?role=${enc(role)}&limit=2&resourceLinkId=3`, headers: credential });
        expect(r.statusCode).toBe(200);
        expect(r.json()).toEqual({ id: MEMBERS, context: { id: '2', label: 'Course', title: 'Course title' }, members: [{ userId: '5', roles: ['Learner'], status: 'Active' }], next: `${MEMBERS}?page=2` });
        const last = calls.at(-1)!;
        expect(Object.fromEntries(new URL(last.url).searchParams)).toEqual({ role, limit: '2', rlid: '3' });
        expect(last.req?.headers?.accept).toBe('application/vnd.ims.lti-nrps.v2.membershipcontainer+json');
      }
    }
    const token = calls.find((c) => c.url === h.platform.tokenEndpoint)!;
    expect(new URLSearchParams(String(token.req?.body)).get('scope')).toBe(NRPS_SCOPE);
  });

  it('memberships url replaces filters; invalid url, bad limit and absent NRPS fail locally', async () => {
    const headers = auth();
    const page = `${MEMBERS}?page=3&limit=1`;
    answer = () => response(200, memberBody);
    expect((await h.app.inject({ url: `/api/memberships?url=${enc(page)}&role=Learner&limit=8`, headers })).statusCode).toBe(200);
    expect(calls.at(-1)!.url).toBe(page);
    calls.length = 0;
    for (const url of ['', 'https://evil.test/x', MEMBERS.replace('/2/', '/2%2F../'), `${MEMBERS}/%2e%2e`]) {
      const r = await h.app.inject({ url: `/api/memberships?url=${enc(url)}`, headers });
      expect([r.statusCode, r.json().details.message]).toEqual([400, 'INVALID_URL_PARAMETER']);
    }
    expect((await h.app.inject({ url: '/api/memberships?limit=0', headers })).statusCode).toBe(400);
    const absent = await h.app.inject({ url: '/api/memberships', headers: auth({ [CLAIM.nrps]: undefined }) });
    expect([absent.statusCode, absent.json().details.message]).toEqual([403, 'SERVICE_NOT_AVAILABLE']);
    expect(calls).toEqual([]);
  });

  it('platform failures and invalid NRPS data have the stable error shape', async () => {
    const headers = auth();
    for (const [status, code] of [[400, 'PLATFORM_REJECTED_REQUEST'], [404, 'PLATFORM_REJECTED_REQUEST'], [409, 'PLATFORM_CONFLICT'], [500, 'PLATFORM_ERROR']] as const) {
      answer = () => response(status, { name: 'Private member', email: 'private@example.test' });
      for (const path of ['/api/memberships', '/api/lineitems']) {
        const r = await h.app.inject({ method: path.endsWith('lineitems') ? 'POST' : 'GET', url: path, headers, ...(path.endsWith('lineitems') ? { payload: item } : {}) });
        expect(r.json().details.message).toBe(code);
        if (path === '/api/memberships') expect(r.body).not.toMatch(/Private member|private@example/);
        expect(r.statusCode).toBe(status === 500 ? 502 : status);
      }
    }
    answer = () => response(200, { ...memberBody, members: [{ name: 'Never echo' }] });
    const bad = await h.app.inject({ url: '/api/memberships', headers });
    expect([bad.statusCode, bad.json().details.message]).toEqual([502, 'PLATFORM_ERROR']);
    expect(bad.body).not.toContain('Never echo');
    answer = () => { throw new OutboundError('timeout', 'moodle.test', 'timed out'); };
    expect((await h.app.inject({ url: '/api/memberships', headers })).statusCode).toBe(504);
  });

  it('platform delete is account scoped and cascades to states, launches and service keys; recreation does not revive keys', async () => {
    const headers = auth();
    const service = await serviceAuth(headers);
    h.db.prepare('INSERT INTO oidc_state VALUES (?, ?, ?, ?, ?, ?, NULL)').run('state-hash', 'cogniate', h.platform.id, 'nonce', LAUNCH, h.clock.now + 10000);
    const foreign = await h.app.inject({ method: 'DELETE', url: `/api/platforms/${h.platform.id}`, headers: { authorization: `Bearer ${h.otherApiKey}` } });
    expect([foreign.statusCode, foreign.json().details.message]).toEqual([404, 'UNREGISTERED_PLATFORM']);
    expect(getPlatform(h.db, 'cogniate', h.platform.id)).not.toBeNull();
    const deleted = await h.app.inject({ method: 'DELETE', url: `/api/platforms/${h.platform.id}`, headers: { authorization: `Bearer ${h.apiKey}` } });
    expect([deleted.statusCode, deleted.body]).toEqual([204, '']);
    for (const table of ['deployment', 'oidc_state', 'launch', 'service_key']) {
      expect(h.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE platform_id = ?`).get(h.platform.id)).toEqual({ n: 0 });
    }
    const recreated = createPlatform(h.db, 'cogniate', { ...h.platform });
    expect(recreated.id).not.toBe(h.platform.id);
    expect((await h.app.inject({ url: '/api/idtoken', headers })).statusCode).toBe(401);
    const revoked = await h.app.inject({ url: '/api/memberships', headers: service });
    expect([revoked.statusCode, revoked.json().details.message]).toEqual([401, 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER']);
    expect((await h.app.inject({ method: 'DELETE', url: `/api/platforms/${h.platform.id}`, headers: { authorization: `Bearer ${h.apiKey}` } })).statusCode).toBe(404);
  });

  it('inactive platforms stop compat calls and all new routes require their documented auth scheme', async () => {
    const headers = auth();
    updatePlatform(h.db, 'cogniate', h.platform.id, { active: false });
    for (const [method, url] of [['POST', '/api/lineitems'], ['PUT', `/api/lineitems/${enc(ITEM)}`], ['DELETE', `/api/lineitems/${enc(ITEM)}`], ['GET', '/api/memberships']] as const) {
      const r = await h.app.inject({ method, url, headers, ...(['POST', 'PUT'].includes(method) ? { payload: item } : {}) });
      expect([r.statusCode, r.json().details.message]).toEqual([403, 'PLATFORM_NOT_ACTIVE']);
      expect((await h.app.inject({ method, url })).statusCode).toBe(401);
    }
    expect(calls).toEqual([]);
  });

  it('OAuth access and refresh stubs return 501 with the error shape and trace id for Bearer auth', async () => {
    for (const suffix of ['', '/refresh']) {
      const url = `/api/oauth/x/access_token${suffix}`;
      const r = await h.app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${h.apiKey}`, 'x-trace-id': 'trace-compat-123456' } });
      expect(r.statusCode).toBe(501);
      expect(r.json()).toEqual({ status: 501, error: 'Not Implemented', details: { message: 'NOT_IMPLEMENTED', description: 'OAuth2 is not implemented. Trace id: trace-compat-123456' } });
      expect((await h.app.inject({ method: 'POST', url })).statusCode).toBe(401);
    }
    expect(calls).toEqual([]);
  });
});
