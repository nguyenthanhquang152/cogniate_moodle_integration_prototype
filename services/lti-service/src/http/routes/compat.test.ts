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

  it('normalizes only leading slashes and always reports Basic Outcomes unavailable, independently of AGS', async () => {
    for (const over of [{}, { [CLAIM.ags]: undefined, [CLAIM.nrps]: undefined }]) {
      const headers = auth(over);
      const normal = await h.app.inject({ url: '/api/idtoken', headers });
      expect(normal.statusCode).toBe(200);
      expect(normal.json().services.outcomes).toEqual({ available: false });
      expect(normal.json().services.assignmentAndGrades.available).toBe(!(CLAIM.ags in over));
      for (const prefix of ['//', '///', '////']) {
        const r = await h.app.inject({ url: `${prefix}api/idtoken`, headers });
        expect(r.statusCode).toBe(200);
        expect(r.json()).toEqual(normal.json());
      }
      const raw = await h.app.inject({ url: '//api/idtoken?raw=true', headers });
      expect(raw.json()).toEqual((await h.app.inject({ url: '/api/idtoken?raw=true', headers })).json());
    }
    const headers = auth();
    for (const path of ['/api//idtoken', '//api//idtoken', '//api/idtoken//', `/api/lineitems/${ITEM}`, `//api/lineitems/${ITEM}/scores`]) {
      const r = await h.app.inject({ url: path, headers });
      expect([r.statusCode, r.json().details.message], path).toEqual([404, 'NOT_FOUND']);
    }
    expect(calls).toEqual([]);
  });

  it('keeps the decoded line item URL guard with leading slashes, before any outbound request', async () => {
    const headers = auth();
    for (const separator of ['%2F', '%2f', '%5C', '%2E', '%25']) {
      const badId = ITEM.replace('/7/lineitem', `/7${separator}other/lineitem`);
      for (const suffix of ['', '/scores']) {
        const r = await h.app.inject({ url: `//api/lineitems/${enc(badId)}${suffix}`, headers });
        expect([r.statusCode, r.json().details.message], badId).toEqual([400, 'INVALID_LINE_ITEM_ID']);
      }
    }
    expect(calls).toEqual([]);
  });

  const score = { userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: 87, scoreMaximum: 100, comment: null };
  const itemOperations = [
    { method: 'GET', suffix: '', status: 200, upstream: ITEM, payload: undefined, data: { id: ITEM, ...item } },
    { method: 'PUT', suffix: '', status: 201, upstream: ITEM, payload: item, data: { id: ITEM, ...item } },
    { method: 'DELETE', suffix: '', status: 204, upstream: ITEM, payload: undefined, data: '' },
    { method: 'GET', suffix: '/scores', status: 200, upstream: ITEM.replace('/lineitem?', '/lineitem/results?'), payload: undefined, data: [{ userId: '5', resultScore: 87 }] },
    { method: 'POST', suffix: '/scores', status: 204, upstream: ITEM.replace('/lineitem?', '/lineitem/scores?'), payload: score, data: '' },
  ] as const;

  it('accepts one or two encoding layers on every item route; null score comments are absent upstream', async () => {
    const headers = auth();
    const lowerEscapes = enc(ITEM).replace(/%[0-9A-F]{2}/g, (escape) => escape.toLowerCase());
    for (const credential of [headers, await serviceAuth(headers)]) {
      for (const id of [enc(ITEM), enc(enc(ITEM)), enc(lowerEscapes)]) {
        for (const op of itemOperations) {
          answer = () => response(op.status, op.data);
          const r = await h.app.inject({ method: op.method, url: `//api/lineitems/${id}${op.suffix}`, headers: credential,
            ...(op.payload === undefined ? {} : { payload: op.payload }) });
          expect(r.statusCode, `${op.method} ${op.suffix} ${id}`).toBe(op.status);
          expect(calls.at(-1)!.url).toBe(op.upstream);
          if (op.method === 'POST') {
            const body = JSON.parse(calls.at(-1)!.req!.body! as string);
            expect(body).toMatchObject({ userId: '5', scoreGiven: 87, scoreMaximum: 100 });
            expect(body).not.toHaveProperty('comment');
          }
        }
      }
    }
  });

  it('refuses double-encoded URL violations and triple-encoded ids on every item route, without outbound calls', async () => {
    const headers = auth();
    const badUrls = [
      ...['%2F', '%2f', '%5C', '%2E', '%25', '%252F', '\\'].map((sep) => ITEM.replace('/7/lineitem', `/7${sep}other/lineitem`)),
      ITEM.replace('/7/lineitem', '/../7/lineitem'), ITEM.replace('/7/lineitem', '/./7/lineitem'),
      ITEM.replace('moodle.test', 'evil.test'), ITEM.replace('moodle.test', 'moodle.test:8443'),
      ITEM.replace('/2/lineitems', '/3/lineitems'), ITEM.replace('type_id=1', 'type_id=2'),
      ITEM.replace('?type_id=1', ''), `${ITEM}&type_id=2`,
    ];
    const ids = [...badUrls.map((url) => enc(enc(url))), enc(enc(enc(ITEM))), enc(`${enc(ITEM)}%ZZ`)];
    for (const credential of [headers, await serviceAuth(headers)]) {
      for (const id of ids) {
        for (const op of itemOperations) {
          const r = await h.app.inject({ method: op.method, url: `//api/lineitems/${id}${op.suffix}`, headers: credential,
            ...(op.payload === undefined ? {} : { payload: op.payload }) });
          expect([r.statusCode, r.json().details.message], `${op.method} ${op.suffix} ${id}`).toEqual([400, 'INVALID_LINE_ITEM_ID']);
        }
      }
    }
    expect(calls).toEqual([]);
  });

  it('does not decode another layer on paging url queries', async () => {
    const headers = auth();
    for (const path of [
      `//api/lineitems?url=${enc(enc(BASE))}`,
      `//api/lineitems/${enc(enc(ITEM))}/scores?url=${enc(enc(ITEM))}`,
      `//api/memberships?url=${enc(enc(MEMBERS))}`,
    ]) {
      const r = await h.app.inject({ url: path, headers });
      expect([r.statusCode, r.json().details.message]).toEqual([400, 'INVALID_URL_PARAMETER']);
    }
    expect(calls).toEqual([]);
  });

  it('still rejects non-string score comments', async () => {
    const headers = auth();
    for (const comment of [1, false, {}, []]) {
      const r = await h.app.inject({ method: 'POST', url: `//api/lineitems/${enc(enc(ITEM))}/scores`, headers, payload: { ...score, comment } });
      expect([r.statusCode, r.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
    }
    expect(calls).toEqual([]);
  });

  it('scores accept user_id and equal aliases for ltik and service auth, with unchanged query values', async () => {
    const headers = auth();
    const scores = [{ userId: 'user//5', resultScore: 92, resultMaximum: 100 }];
    answer = () => response(200, scores);
    for (const credential of [headers, await serviceAuth(headers)]) {
      for (const query of ['userId=user//5', 'user_id=user//5', 'userId=user//5&user_id=user//5']) {
        const r = await h.app.inject({ url: `//api/lineitems/${enc(ITEM)}/scores?${query}&limit=2`, headers: credential });
        expect(r.statusCode).toBe(200);
        expect(r.json()).toEqual({ scores });
        const upstream = new URL(calls.at(-1)!.url);
        expect(upstream.pathname).toBe('/mod/lti/services.php/2/lineitems/7/lineitem/results');
        expect(Object.fromEntries(upstream.searchParams)).toEqual({ type_id: '1', user_id: 'user//5', limit: '2' });
      }
    }
  });

  it('scores reject conflicting aliases and invalid user_id values before any outbound request', async () => {
    const headers = auth();
    for (const credential of [headers, await serviceAuth(headers)]) {
      for (const query of ['userId=5&user_id=6', `userId=5&user_id=6&url=${enc(ITEM)}`, 'user_id=', 'user_id=5&user_id=6']) {
        const r = await h.app.inject({ url: `//api/lineitems/${enc(ITEM)}/scores?${query}`, headers: credential });
        expect([r.statusCode, r.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
        expect(r.json().details.description).toContain('user_id');
      }
    }
    expect(calls).toEqual([]);
  });

  it('all deep-link endpoints default missing/null resource URLs and null custom data', async () => {
    const headers = auth({ [CLAIM.deepLinkingSettings]: { deep_link_return_url: RETURN, accept_types: ['ltiResourceLink'] } }, 'LtiDeepLinkingRequest');
    for (const suffix of ['', '/message', '/form']) {
      for (const urlField of [{}, { url: null }, { url: null, custom: null }]) {
        const contentItem = { type: 'ltiResourceLink', title: 'SDK resource', custom: { course: '5' }, lineItem: item, ...urlField };
        const r = await h.app.inject({ method: 'POST', url: `//api/deeplinking${suffix}`, headers, payload: { contentItems: [contentItem] } });
        expect(r.statusCode).toBe(200);
        const data = r.json();
        const jwt = suffix === '/form' ? /name="JWT" value="([^"]+)"/.exec(data.form)![1]! : data.message;
        const { payload } = await jwtVerify(jwt, createLocalJWKSet({ keys: publicJwks(h.db, 'cogniate') }), { issuer: CLIENT_ID, audience: ISSUER });
        expect(payload[DL_CLAIM.contentItems]).toEqual([{ ...contentItem, url: LAUNCH, custom: contentItem.custom ?? {} }]);
        expect(new URL((payload[DL_CLAIM.contentItems] as Array<{ url: string }>)[0]!.url).searchParams.has('resource')).toBe(false);
      }
      for (const url of ['', false, 0, 'https://evil.test/launch']) {
        const r = await h.app.inject({ method: 'POST', url: `/api/deeplinking${suffix}`, headers, payload: { contentItems: [{ type: 'ltiResourceLink', url }] } });
        expect([r.statusCode, r.json().details.message]).toEqual([400, 'INVALID_CONTENT_ITEM']);
      }
      for (const custom of [[], 1, { course: 5 }]) {
        const r = await h.app.inject({ method: 'POST', url: `/api/deeplinking${suffix}`, headers, payload: { contentItems: [{ type: 'ltiResourceLink', url: null, custom }] } });
        expect([r.statusCode, r.json().details.message]).toEqual([400, 'INVALID_CONTENT_ITEM']);
      }
    }
    expect(calls).toEqual([]);
  });

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
    const form = deepLinkingForm({ target: '<>&"\'', message: '\'&"><script>bad()</script>' });
    expect(form.match(/<form /g)).toHaveLength(1);
    expect(form.match(/<script>/g)).toHaveLength(1);
    expect(form).toContain('action="&lt;&gt;&amp;&quot;&#39;"');
    expect(form).toContain('value="&#39;&amp;&quot;&gt;&lt;script&gt;bad()&lt;/script&gt;"');
    expect(form).toMatch(/<script>document.getElementById\("lti_dl_submit"\).submit\(\)<\/script>$/);
    expect(calls).toEqual([]);
  });

  it.each([
    'javascript:alert(document.domain)',
    'data:text/html,<script>alert(1)</script>',
    'http://moodle.test/return',
    'https://evil.test/return',
    'https://moodle.test:8443/return',
    'https://moodle.test.evil.test/return',
    'https://user:password@moodle.test/return',
    `${RETURN}#fragment`,
    '//moodle.test/return',
    '/return',
    '',
  ])('all deep-link responses refuse the unsafe return URL %s', async (target) => {
    const headers = auth({ [CLAIM.deepLinkingSettings]: { deep_link_return_url: target } }, 'LtiDeepLinkingRequest');
    for (const suffix of ['', '/message', '/form']) {
      const r = await h.app.inject({ method: 'POST', url: `/api/deeplinking${suffix}`, headers, payload: { contentItems: [{ type: 'ltiResourceLink' }] } });
      expect([r.statusCode, r.json().details.message]).toEqual([400, 'INVALID_DEEP_LINK_RETURN_URL']);
      expect(r.json()).not.toHaveProperty('message');
      expect(r.json()).not.toHaveProperty('target');
      expect(r.json()).not.toHaveProperty('form');
      if (target) expect(r.body).not.toContain(target);
    }
    expect(calls).toEqual([]);
  });

  it('allows the issuer origin and escapes attribute text in its return URL', async () => {
    const target = `${RETURN}&text="'><script>alert(1)</script>`;
    const headers = auth({ [CLAIM.deepLinkingSettings]: { deep_link_return_url: target } }, 'LtiDeepLinkingRequest');
    const r = await h.app.inject({ method: 'POST', url: '/api/deeplinking/form', headers, payload: { contentItems: [{ type: 'ltiResourceLink' }] } });
    expect(r.statusCode).toBe(200);
    expect(r.json().form).toContain('action="https://moodle.test/mod/lti/contentitem_return.php?course=2&amp;id=1&amp;text=&quot;&#39;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(r.json().form.match(/<script>/g)).toHaveLength(1);
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

  it.each(['', null])('full line item updates accept empty optional metadata with resourceLinkId %s', async (resourceLinkId) => {
    const payload = { ...item, resourceLinkId, resourceId: '', tag: null, startDateTime: '', endDateTime: null, gradesReleased: false };
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
    h.db.prepare('INSERT INTO oidc_state (state_hash, tool_account_id, platform_id, nonce, target_link_uri, expires_at, used_at) VALUES (?, ?, ?, ?, ?, ?, NULL)').run('state-hash', 'cogniate', h.platform.id, 'nonce', LAUNCH, h.clock.now + 10000);
    const foreign = await h.app.inject({ method: 'DELETE', url: `/api/platforms/${h.platform.id}`, headers: { authorization: `Bearer ${h.otherApiKey}` } });
    expect([foreign.statusCode, foreign.json().details.message]).toEqual([404, 'UNREGISTERED_PLATFORM']);
    expect(h.lines.filter((line) => line.event === 'platform_deleted')).toEqual([]);
    expect(getPlatform(h.db, 'cogniate', h.platform.id)).not.toBeNull();
    const deleted = await h.app.inject({ method: 'DELETE', url: `/api/platforms/${h.platform.id}`, headers: { authorization: `Bearer ${h.apiKey}`, 'x-trace-id': 'trace-compat-delete-1234' } });
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
    expect(h.lines.filter((line) => line.event === 'platform_deleted')).toEqual([
      expect.objectContaining({ level: 'info', platform_id: h.platform.id, trace_id: 'trace-compat-delete-1234' }),
    ]);
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
