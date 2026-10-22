import type { OutboundClient, OutboundRequest, OutboundResponse } from '@cogniate/shared';
import { OutboundError } from '@cogniate/shared';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../api-errors.ts';
import { openDb } from '../db/index.ts';
import { ensureAccount } from '../store/accounts.ts';
import { ensureToolKey } from '../store/tool-keys.ts';
import { createPlatform } from '../store/platforms.ts';
import { CLIENT_ID, ISSUER, MASTER_KEY, URLS, capturingLogger } from '../testkit.ts';
import { AGS_SCOPES, createAgsClient, parseScore, preflightCreateLineItem } from './ags.ts';
import { outboundFailureError, platformResponseError, shortPlatformMessage } from './error-mapping.ts';
import { parseLinkHeader } from './link-header.ts';
import { createNrpsClient } from './nrps.ts';
import { createScoreClock } from './score-clock.ts';
import { createTokenClient } from './token-client.ts';

const res = (status: number, body: unknown = '', headers: Record<string, string> = {}): OutboundResponse => {
  const buf = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  return { status, headers, body: buf, text: () => buf.toString(), json: () => JSON.parse(buf.toString()) as unknown };
};

describe('platform error mapping (contract §1.3)', () => {
  it.each([
    [409, 'PLATFORM_CONFLICT', 409],
    [400, 'PLATFORM_REJECTED_REQUEST', 400],
    [404, 'PLATFORM_REJECTED_REQUEST', 404],
    [401, 'PLATFORM_ERROR', 502],
    [403, 'PLATFORM_ERROR', 502],
    [500, 'PLATFORM_ERROR', 502],
    [503, 'PLATFORM_ERROR', 502],
  ])('platform %i -> %s (%i)', (status, code, ours) => {
    const err = platformResponseError(res(status, 'User not found <b>x</b>'));
    expect([err.code, err.status]).toEqual([code, ours]);
  });

  it('a rejected request shows a short platform message without control characters (not HTML-escaped: JSON is data)', () => {
    expect(platformResponseError(res(400, 'No grade item\n<b>grade < 0</b>')).description).toBe('The platform answered 400: No grade item <b>grade < 0</b>');
    expect(shortPlatformMessage('x'.repeat(300))).toHaveLength(203);
  });

  it('timeout -> PLATFORM_TIMEOUT (504); other outbound failures -> PLATFORM_ERROR', () => {
    expect(outboundFailureError(new OutboundError('timeout', 'moodle.test', 't')).status).toBe(504);
    expect(outboundFailureError(new OutboundError('network_error', 'moodle.test', 'n'))).toMatchObject({ code: 'PLATFORM_ERROR', status: 502 });
  });
});

describe('Link header parsing', () => {
  it('reads next, prev, first and last; ignores other relations and non-https URLs', () => {
    expect(parseLinkHeader('<https://m.test/li?page=2>; rel="next", <https://m.test/li?page=9>; rel=last, <https://m.test/x>; rel="self", <http://m.test/p>; rel="prev"'))
      .toEqual({ next: 'https://m.test/li?page=2', last: 'https://m.test/li?page=9' });
    expect(parseLinkHeader(['<https://m.test/a>; rel="first prev"'])).toEqual({ first: 'https://m.test/a', prev: 'https://m.test/a' });
    expect(parseLinkHeader(undefined)).toEqual({});
  });
});

describe('score timestamps (ADR-010 rule 7)', () => {
  it('at least 1 s apart per (platform, line item, user); floor = start + 2 s; a given timestamp is used as given', () => {
    const t = { now: Date.UTC(2026, 9, 17, 10, 0, 0) };
    const clock = createScoreClock(() => t.now);
    const a = clock.next('p', 'li', 'u1');
    expect(a).toBe(new Date(t.now + 2000).toISOString());
    const b = clock.next('p', 'li', 'u1');
    expect(Date.parse(b) - Date.parse(a)).toBe(1000);
    expect(clock.next('p', 'li', 'u2')).toBe(a); // other user: own sequence
    t.now += 60_000;
    expect(clock.next('p', 'li', 'u1')).toBe(new Date(t.now).toISOString());
    expect(clock.next('p', 'li', 'u1', '2020-01-01T00:00:00.000Z')).toBe('2020-01-01T00:00:00.000Z');
    const future = new Date(t.now + 30_000).toISOString();
    clock.next('p', 'li', 'u1', future);
    expect(Date.parse(clock.next('p', 'li', 'u1'))).toBe(t.now + 31_000); // never before a given newer time
  });
});

describe('score body (contract §3.6)', () => {
  it('accepts a full score, maps Initiated to Initialized', () => {
    expect(parseScore({ userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: 87, scoreMaximum: 100 }))
      .toEqual({ userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: 87, scoreMaximum: 100 });
    expect(parseScore({ userId: '5', activityProgress: 'Initiated', gradingProgress: 'NotReady' }).activityProgress).toBe('Initialized');
    const in10 = new Date(Date.now() + 10 * 60_000).toISOString(); // AC-T3-30: now + 10 min is allowed (AC-T5-31 conflict recipe)
    expect(parseScore({ userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', timestamp: in10 }).timestamp).toBe(in10);
  });
  it.each([
    [{ activityProgress: 'Completed', gradingProgress: 'FullyGraded' }, 'userId'],
    [{ userId: '5', activityProgress: 'Done', gradingProgress: 'FullyGraded' }, 'activityProgress'],
    [{ userId: '5', activityProgress: 'Completed', gradingProgress: 'Graded' }, 'gradingProgress'],
    [{ userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: 5 }, 'scoreMaximum'],
    [{ userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: -1, scoreMaximum: 10 }, 'scoreGiven'],
    [{ userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreMaximum: 0 }, 'scoreMaximum'],
    [{ userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', timestamp: 'yesterday' }, 'timestamp'],
    [{ userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', timestamp: new Date(Date.now() + 16 * 60_000).toISOString() }, 'timestamp'],
  ])('refuses %j (%s)', (body, field) => {
    expect(() => parseScore(body)).toThrow(ApiError);
    expect(() => parseScore(body)).toThrow(/INVALID_REQUEST/);
    try { parseScore(body); } catch (e) { expect((e as ApiError).description).toContain(field); }
  });
});

// ---------------------------------------------------------------- token client and AGS client with a fake platform
async function setup() {
  const db = openDb(':memory:');
  ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
  await ensureToolKey(db, MASTER_KEY, 'cogniate');
  const platform = createPlatform(db, 'cogniate', {
    issuer: ISSUER, clientId: CLIENT_ID, name: 'Moodle', authEndpoint: `${ISSUER}/mod/lti/auth.php`, tokenEndpoint: `${ISSUER}/mod/lti/token.php`,
    jwksUrl: `${ISSUER}/mod/lti/certs.php`, deploymentIds: ['1'], active: true,
  });
  const calls: Array<{ url: string; req: OutboundRequest }> = [];
  const answers: Array<(url: string, req: OutboundRequest) => OutboundResponse> = [];
  let tokenCount = 0;
  const outbound: OutboundClient = {
    allowlist: [],
    async request(url, req = {}) {
      calls.push({ url, req });
      if (url.endsWith('/mod/lti/token.php')) {
        tokenCount += 1;
        return res(200, { access_token: `tok-${tokenCount}`, token_type: 'Bearer', expires_in: 3600 });
      }
      const next = answers.shift();
      if (!next) throw new Error(`unexpected call ${url}`);
      return next(url, req);
    },
  };
  const { logger, lines } = capturingLogger();
  const clock = { now: Date.UTC(2026, 9, 17, 10, 0, 0) };
  const tokens = createTokenClient({ db, masterKey: MASTER_KEY, outbound, logger, now: () => clock.now });
  const ags = createAgsClient({ outbound, tokens, clock: createScoreClock(() => clock.now), logger });
  const nrps = createNrpsClient({ outbound, tokens, logger });
  return { db, platform, calls, answers, lines, clock, tokens, ags, nrps };
}

const AGS_CLAIM = {
  scope: [AGS_SCOPES.lineitemReadonly, AGS_SCOPES.score, AGS_SCOPES.resultReadonly],
  lineitems: 'https://moodle.test/mod/lti/services.php/2/lineitems?type_id=1',
  lineitem: 'https://moodle.test/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1',
};
const LINE_ITEM = AGS_CLAIM.lineitem;

describe('AGS and NRPS throttle warnings (A-LA-E5-14-01)', () => {
  it.each([
    ['ags', 429], ['ags', 403], ['nrps', 429], ['nrps', 403],
  ] as const)('%s emits one safe warning for a %i service response', async (client, status) => {
    const s = await setup();
    s.answers.push(() => res(status, 'student@example.test: Rate Limit Exceeded', { 'retry-after': '120' }));
    const context = { platform: s.platform, traceId: 'trace-throttle' };
    const operation = client === 'ags'
      ? s.ags.getLineItem({ ...context, agsClaim: AGS_CLAIM }, LINE_ITEM)
      : s.nrps.listMemberships({ ...context, nrpsClaim: { context_memberships_url: 'https://moodle.test/memberships' } }, {});
    await expect(operation).rejects.toMatchObject({ code: 'PLATFORM_RATE_LIMITED', status: 429, details: { retryAfter: 120 } });
    expect(s.calls).toHaveLength(2);
    expect(s.lines.filter((line) => line.event === 'platform_rate_limited')).toEqual([expect.objectContaining({
      level: 'warn', trace_id: 'trace-throttle', platform_id: s.platform.id, status, retry_after_s: 120,
    })]);
    expect(JSON.stringify(s.lines)).not.toContain('student@example.test');
    expect(JSON.stringify(s.lines)).not.toContain('tok-1');
    s.db.close();
  });
});

describe('platform token client (contract §4, security §2.3)', () => {
  it('signs a client assertion (iat 30 s in the past, 300 s life), caches per scope set until 60 s before expiry', async () => {
    const s = await setup();
    const t1 = await s.tokens.getToken(s.platform, [AGS_SCOPES.score], 'trace-a');
    expect(t1).toBe('tok-1');
    const body = new URLSearchParams(String(s.calls[0]!.req.body));
    expect(body.get('grant_type')).toBe('client_credentials');
    expect(body.get('client_assertion_type')).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    expect(body.get('scope')).toBe(AGS_SCOPES.score);
    const assertion = decodeJwt(body.get('client_assertion')!);
    const now = Math.floor(s.clock.now / 1000);
    expect(assertion).toMatchObject({ iss: CLIENT_ID, sub: CLIENT_ID, aud: `${ISSUER}/mod/lti/token.php`, iat: now - 30, exp: now + 300 });
    expect(typeof assertion.jti).toBe('string');
    expect(decodeProtectedHeader(body.get('client_assertion')!)).toMatchObject({ alg: 'RS256', typ: 'JWT' });

    expect(await s.tokens.getToken(s.platform, [AGS_SCOPES.score], 'trace-b')).toBe('tok-1'); // hit
    expect(await s.tokens.getToken(s.platform, [AGS_SCOPES.resultReadonly], 'trace-c')).toBe('tok-2'); // other scope set
    s.clock.now += 3600_000 - 60_000; // 60 s before expiry: a new token
    expect(await s.tokens.getToken(s.platform, [AGS_SCOPES.score], 'trace-d')).toBe('tok-3');
    const events = s.lines.filter((l) => l.event === 'platform_token').map((l) => [l.trace_id, l.cache]);
    expect(events).toEqual([['trace-a', 'miss'], ['trace-b', 'hit'], ['trace-c', 'miss'], ['trace-d', 'miss']]);
  });

  it('parallel callers share one token request', async () => {
    const s = await setup();
    const [a, b] = await Promise.all([s.tokens.getToken(s.platform, [AGS_SCOPES.score], 't1'), s.tokens.getToken(s.platform, [AGS_SCOPES.score], 't2')]);
    expect([a, b]).toEqual(['tok-1', 'tok-1']);
    expect(s.calls).toHaveLength(1);
  });

  it('a token failure is PLATFORM_ERROR (or PLATFORM_TIMEOUT), nothing is cached', async () => {
    const s = await setup();
    const failing: OutboundClient = { allowlist: [], request: async () => res(401, 'invalid_client') };
    const tokens = createTokenClient({ db: s.db, masterKey: MASTER_KEY, outbound: failing, logger: capturingLogger().logger });
    await expect(tokens.getToken(s.platform, [AGS_SCOPES.score], 't')).rejects.toMatchObject({ code: 'PLATFORM_ERROR', status: 502 });
    const slow: OutboundClient = { allowlist: [], request: async () => { throw new OutboundError('timeout', 'moodle.test', 't'); } };
    const t2 = createTokenClient({ db: s.db, masterKey: MASTER_KEY, outbound: slow, logger: capturingLogger().logger });
    await expect(t2.getToken(s.platform, [AGS_SCOPES.score], 't')).rejects.toMatchObject({ code: 'PLATFORM_TIMEOUT' });
  });
});

describe('AGS client (contract §3.5, §3.6)', () => {
  const ctx = (s: Awaited<ReturnType<typeof setup>>, agsClaim: Record<string, unknown> | null = AGS_CLAIM) => ({ platform: s.platform, agsClaim, traceId: 'trace-1' });

  it('posts a score to <line item>/scores (query kept) with the bearer token, the media type and a timestamp', async () => {
    const s = await setup();
    s.answers.push(() => res(204));
    await s.ags.postScore(ctx(s), LINE_ITEM, { userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: 87, scoreMaximum: 100 });
    const call = s.calls[1]!;
    expect(call.url).toBe('https://moodle.test/mod/lti/services.php/2/lineitems/7/lineitem/scores?type_id=1');
    expect(call.req).toMatchObject({ method: 'POST', traceId: 'trace-1', headers: { authorization: 'Bearer tok-1', 'content-type': 'application/vnd.ims.lis.v1.score+json' } });
    const sent = JSON.parse(String(call.req.body));
    expect(sent).toMatchObject({ userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: 87, scoreMaximum: 100 });
    expect(Number.isFinite(Date.parse(sent.timestamp))).toBe(true);
  });

  it('a foreign line item URL is INVALID_LINE_ITEM_ID with NO outbound request (not even a token)', async () => {
    const s = await setup();
    for (const id of ['https://evil.test/x', 'https://moodle.test/mod/lti/services.php/3/lineitems/9/lineitem?type_id=1', 'https://moodle.test/mod/lti/services.php/2/lineitems/8/lineitem?type_id=2']) {
      await expect(s.ags.postScore(ctx(s), id, { userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded' })).rejects.toMatchObject({ code: 'INVALID_LINE_ITEM_ID' });
      await expect(s.ags.getLineItem(ctx(s), id)).rejects.toMatchObject({ code: 'INVALID_LINE_ITEM_ID' });
      await expect(s.ags.getScores(ctx(s), id, {})).rejects.toMatchObject({ code: 'INVALID_LINE_ITEM_ID' });
    }
    await expect(s.ags.listLineItems(ctx(s), { url: 'https://evil.test/li' })).rejects.toMatchObject({ code: 'INVALID_URL_PARAMETER' });
    expect(s.calls).toEqual([]);
  });

  it('no AGS claim or no scope: 403 SERVICE_NOT_AVAILABLE, no outbound request', async () => {
    const s = await setup();
    await expect(s.ags.getLineItem(ctx(s, null), LINE_ITEM)).rejects.toMatchObject({ code: 'SERVICE_NOT_AVAILABLE', status: 403 });
    await expect(s.ags.postScore(ctx(s, { ...AGS_CLAIM, scope: [AGS_SCOPES.lineitemReadonly] }), LINE_ITEM, { userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded' }))
      .rejects.toMatchObject({ code: 'SERVICE_NOT_AVAILABLE' });
    expect(s.calls).toEqual([]);
  });

  it('preflightCreateLineItem (BD-A2-71): the create checks in order, with no I/O; createLineItem uses them', async () => {
    const s = await setup();
    const writer = { ...AGS_CLAIM, scope: [AGS_SCOPES.lineitemReadonly, AGS_SCOPES.lineitem] };
    expect(preflightCreateLineItem(ctx(s, writer))).toEqual({ url: AGS_CLAIM.lineitems, scope: AGS_SCOPES.lineitem });
    const refusals: Array<[Record<string, unknown> | null, string, number, string]> = [
      // (1) No line items URL (a claim with only `lineitem` cannot create). (2), the base URL, cannot fail after (1).
      [null, 'SERVICE_NOT_AVAILABLE', 403, 'The launch has no AGS line items URL.'],
      [{ ...writer, lineitems: undefined }, 'SERVICE_NOT_AVAILABLE', 403, 'The launch has no AGS line items URL.'],
      [{ ...writer, lineitems: 42 }, 'SERVICE_NOT_AVAILABLE', 403, 'The launch has no AGS line items URL.'],
      // (3) The service URL rule, before the scope check.
      [{ ...writer, lineitems: 'http://moodle.test/mod/lti/services.php/2/lineitems?type_id=1' }, 'INVALID_LINE_ITEM_ID', 400, 'The line item id does not match the line items URL of the launch.'],
      [{ ...AGS_CLAIM, lineitems: 'https://moodle.test/mod/lti/services.php/2/%2e%2e/lineitems?type_id=1' }, 'INVALID_LINE_ITEM_ID', 400, 'The line item id does not match the line items URL of the launch.'],
      // (4) The lineitem scope; lineitem.readonly is not enough.
      [AGS_CLAIM, 'SERVICE_NOT_AVAILABLE', 403, 'The launch has no AGS scope for this call.'],
      [{ ...writer, scope: undefined }, 'SERVICE_NOT_AVAILABLE', 403, 'The launch has no AGS scope for this call.'],
    ];
    for (const [claim, code, status, description] of refusals) {
      expect(() => preflightCreateLineItem(ctx(s, claim))).toThrow(expect.objectContaining({ code, status, description }));
      await expect(s.ags.createLineItem(ctx(s, claim), { label: 'QA', scoreMaximum: 10 })).rejects.toMatchObject({ code, status, description });
    }
    expect(s.calls).toEqual([]);
    s.answers.push(() => res(200, { id: LINE_ITEM, label: 'QA', scoreMaximum: 10 }));
    expect(await s.ags.createLineItem(ctx(s, writer), { label: 'QA', scoreMaximum: 10 })).toEqual({ id: LINE_ITEM, label: 'QA', scoreMaximum: 10 });
    expect(s.calls[1]).toMatchObject({ url: AGS_CLAIM.lineitems, req: { method: 'POST', body: JSON.stringify({ label: 'QA', scoreMaximum: 10 }) } });
  });

  it('lists line items with the filter parameters and the paging links; reads one line item', async () => {
    const s = await setup();
    s.answers.push(() => res(200, [{ id: LINE_ITEM, label: 'QA DL', scoreMaximum: 100, resourceLinkId: '3', extra: 'x' }], { link: '<https://moodle.test/mod/lti/services.php/2/lineitems?type_id=1&page=2>; rel="next"' }));
    const list = await s.ags.listLineItems(ctx(s), { resourceLinkId: '3', limit: 10 });
    expect(s.calls[1]!.url).toBe('https://moodle.test/mod/lti/services.php/2/lineitems?type_id=1&resource_link_id=3&limit=10');
    expect(s.calls[1]!.req.headers?.accept).toBe('application/vnd.ims.lis.v2.lineitemcontainer+json');
    expect(list).toEqual({ lineItems: [{ id: LINE_ITEM, label: 'QA DL', scoreMaximum: 100, resourceLinkId: '3' }], next: 'https://moodle.test/mod/lti/services.php/2/lineitems?type_id=1&page=2' });
    s.answers.push(() => res(200, { id: LINE_ITEM, label: 'QA DL', scoreMaximum: 100 }));
    expect(await s.ags.getLineItem(ctx(s), LINE_ITEM)).toEqual({ id: LINE_ITEM, label: 'QA DL', scoreMaximum: 100 });
    expect(s.lines.filter((l) => l.event === 'platform_token').map((l) => l.cache)).toEqual(['miss', 'hit']);
  });

  it('reads scores from <line item>/results with user_id', async () => {
    const s = await setup();
    s.answers.push(() => res(200, [{ id: 'r1', userId: '5', scoreOf: LINE_ITEM, resultScore: 92, resultMaximum: 100 }]));
    const out = await s.ags.getScores(ctx(s), LINE_ITEM, { userId: '5' });
    expect(s.calls[1]!.url).toBe('https://moodle.test/mod/lti/services.php/2/lineitems/7/lineitem/results?type_id=1&user_id=5');
    expect(out.scores).toEqual([{ id: 'r1', userId: '5', scoreOf: LINE_ITEM, resultScore: 92, resultMaximum: 100 }]);
  });

  it('maps platform answers: 400 user not in course -> PLATFORM_REJECTED_REQUEST, 409 -> PLATFORM_CONFLICT, bad JSON -> PLATFORM_ERROR', async () => {
    const s = await setup();
    const score = { userId: '99', activityProgress: 'Completed' as const, gradingProgress: 'FullyGraded' as const };
    s.answers.push(() => res(400, 'Incorrect score received'));
    await expect(s.ags.postScore(ctx(s), LINE_ITEM, score)).rejects.toMatchObject({ code: 'PLATFORM_REJECTED_REQUEST', status: 400 });
    s.answers.push(() => res(409, 'conflict'));
    await expect(s.ags.postScore(ctx(s), LINE_ITEM, score)).rejects.toMatchObject({ code: 'PLATFORM_CONFLICT', status: 409 });
    s.answers.push(() => res(200, 'not json'));
    await expect(s.ags.getLineItem(ctx(s), LINE_ITEM)).rejects.toMatchObject({ code: 'PLATFORM_ERROR' });
  });
});

describe('NRPS service versions (LA-E3-12)', () => {
  it.each([[], ['1.0'], ['2'], null, '2.0', 2].map((service_versions) => ({ service_versions })))('refuses unsupported service_versions $service_versions before any outbound request', async ({ service_versions }) => {
    const s = await setup();
    await expect(s.nrps.listMemberships({ platform: s.platform, traceId: 'versions',
      nrpsClaim: { context_memberships_url: 'https://moodle.test/memberships', service_versions } }, {}))
      .rejects.toMatchObject({ code: 'SERVICE_NOT_AVAILABLE', status: 403 });
    expect(s.calls).toEqual([]);
    s.db.close();
  });

  it.each([{}, { service_versions: ['2.0'] }, { service_versions: ['1.0', '2.0'] }])('accepts an absent version or a list with 2.0: %j', async (version) => {
    const s = await setup();
    const url = 'https://moodle.test/memberships';
    s.answers.push(() => res(200, { id: url, context: { id: '2' }, members: [] }));
    expect(await s.nrps.listMemberships({ platform: s.platform, traceId: 'versions',
      nrpsClaim: { context_memberships_url: url, ...version } }, {})).toEqual({ id: url, context: { id: '2' }, members: [] });
    expect(s.calls).toHaveLength(2);
    s.db.close();
  });
});
