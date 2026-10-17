// T2b negative launch matrix with tokens that QA signs (qa-platform.test, hook H6). Plain HTTPS, no browser.
// Source: tasks/T2b.md AC-T2-20, -21, -24 to -28, -32; security §2.2 (run order 1, 3, 2, 4..12; check → code), §2.4
// (JWKS refresh failure); contract lti-service-api.md §5 (launch_check_failed.detail).
// Each case makes a fresh login (the state is single use) and posts a token with exactly one bad property.
// A positive control first proves that a correct QA token is accepted, so each negative proves its own check.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { publicUrls } from '../lib/env';
import { httpsRequest } from '../lib/https';
import { ACCOUNT, apiKey, checkErrorPage, eventsSince, hostIs, LTI_CLAIM, runStart, waitForEvent } from '../lib/lti';
import {
  hs256WithModulus,
  postLaunch,
  QA_FIXTURE_DIR,
  QA_ISSUER,
  qaLogin,
  type QaPlatform,
  resourceLinkClaims,
  setupQaPlatform,
  signRs256,
  unsignedToken,
} from '../lib/qa-platform';

const urls = publicUrls();
const QA_HOST = new URL(QA_ISSUER).hostname;
let p: QaPlatform;

/** One login + one launch POST with the claims that `edit` returns. */
async function attempt(
  edit: (claims: Record<string, unknown>) => Record<string, unknown>,
  sign: (claims: Record<string, unknown>) => Promise<string> = (c) => signRs256(c, p.privateKey, p.kid),
) {
  const login = await qaLogin(p);
  expect(login.status, `login: ${login.body.slice(0, 200)}`).toBe(302);
  const token = await sign(edit(resourceLinkClaims(p, login)));
  return { login, res: await postLaunch({ id_token: token, state: login.state }, login.cookie) };
}

const page = (r: { status: number; headers: Record<string, unknown>; body: string }) => ({
  status: r.status,
  headers: r.headers as Record<string, string | string[] | undefined>,
  body: r.body,
});

describe('T2b QA platform launch checks', () => {
  beforeAll(async () => {
    runStart('T2b');
    p = await setupQaPlatform(apiKey(ACCOUNT), 't2b');
  });

  afterAll(() => {
    if (p) fs.rmSync(path.join(QA_FIXTURE_DIR, p.jwksFile), { force: true });
  });

  it('H6 control: qa-platform.test serves run-time files, and a correct QA token is accepted (303 with ltik)', async () => {
    // Probe with another file, so that the JWKS path keeps only the service's fetches (AC-T2-30 count).
    const probe = `probe-${crypto.randomBytes(4).toString('hex')}.json`;
    fs.writeFileSync(path.join(QA_FIXTURE_DIR, probe), '{"qa":true}');
    try {
      const served = await httpsRequest(`${QA_ISSUER}/${probe}`);
      expect(served.status).toBe(200);
      expect(served.headers['content-type']).toMatch(/application\/json/);
    } finally {
      fs.rmSync(path.join(QA_FIXTURE_DIR, probe), { force: true });
    }
    const { res } = await attempt((c) => c);
    expect(res.status, res.body.slice(0, 300)).toBe(303);
    const to = new URL(res.location);
    expect(`${to.origin}${to.pathname}`).toBe(`${urls.app}/tool/launch`);
    expect(to.searchParams.get('ltik') ?? '').toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('AC-T2-20 alg=none and HS256 (key = JWKS n) → INVALID_ID_TOKEN (check 4)', async () => {
    const none = await attempt((c) => c, async (c) => unsignedToken(c, p.kid));
    expect(checkErrorPage(page(none.res), 'INVALID_ID_TOKEN', { test: 'AC-T2-20', endpoint: 'launch' })).toEqual([]);
    const hs = await attempt((c) => c, (c) => hs256WithModulus(c, p));
    expect(checkErrorPage(page(hs.res), 'INVALID_ID_TOKEN', { test: 'AC-T2-20', endpoint: 'launch' })).toEqual([]);
  });

  it('AC-T2-24 aud = another client id, and two aud values without azp → INVALID_ISSUER_OR_AUDIENCE (check 5)', async () => {
    const other = await attempt((c) => ({ ...c, aud: `qa-other-${crypto.randomBytes(3).toString('hex')}` }));
    expect(checkErrorPage(page(other.res), 'INVALID_ISSUER_OR_AUDIENCE', { test: 'AC-T2-24', endpoint: 'launch' })).toEqual([]);
    const two = await attempt((c) => {
      const { azp: _azp, ...rest } = c;
      return { ...rest, aud: [p.clientId, 'qa-second-audience'] };
    });
    expect(checkErrorPage(page(two.res), 'INVALID_ISSUER_OR_AUDIENCE', { test: 'AC-T2-24', endpoint: 'launch' })).toEqual([]);
  });

  it('AC-T2-25 version 1.1, and message_type LtiSubmissionReviewRequest → UNSUPPORTED_MESSAGE_TYPE (check 10)', async () => {
    const v = await attempt((c) => ({ ...c, [`${LTI_CLAIM}version`]: '1.1' }));
    expect(checkErrorPage(page(v.res), 'UNSUPPORTED_MESSAGE_TYPE', { test: 'AC-T2-25', endpoint: 'launch' })).toEqual([]);
    const m = await attempt((c) => ({ ...c, [`${LTI_CLAIM}message_type`]: 'LtiSubmissionReviewRequest' }));
    expect(checkErrorPage(page(m.res), 'UNSUPPORTED_MESSAGE_TYPE', { test: 'AC-T2-25', endpoint: 'launch' })).toEqual([]);
  });

  it('AC-T2-26 a resource-link token without resource_link, and one without sub → MISSING_CLAIM (check 11)', async () => {
    const noLink = await attempt((c) => {
      const copy = { ...c };
      delete copy[`${LTI_CLAIM}resource_link`];
      return copy;
    });
    expect(checkErrorPage(page(noLink.res), 'MISSING_CLAIM', { test: 'AC-T2-26', endpoint: 'launch' })).toEqual([]);
    const noSub = await attempt((c) => {
      const { sub: _sub, ...rest } = c;
      return rest;
    });
    expect(checkErrorPage(page(noSub.res), 'MISSING_CLAIM', { test: 'AC-T2-26', endpoint: 'launch' })).toEqual([]);
  });

  it('AC-T2-27 target_link_uri that differs from the login value → INVALID_TARGET_LINK_URI (check 12)', async () => {
    const r = await attempt((c) => ({ ...c, [`${LTI_CLAIM}target_link_uri`]: `${String(c[`${LTI_CLAIM}target_link_uri`]).split('?')[0]}?resource=qa-other` }));
    expect(checkErrorPage(page(r.res), 'INVALID_TARGET_LINK_URI', { test: 'AC-T2-27', endpoint: 'launch' })).toEqual([]);
  });

  it('AC-T2-28 error=access_denied with a valid state → PLATFORM_ERROR page with access_denied; the state is then used up', async () => {
    const login = await qaLogin(p);
    expect(login.status).toBe(302);
    const err = await postLaunch({ error: 'access_denied', error_description: 'QA denies', state: login.state }, login.cookie);
    expect(checkErrorPage(page(err), 'PLATFORM_ERROR', { test: 'AC-T2-28', endpoint: 'launch' })).toEqual([]);
    expect(err.body).toContain('access_denied');
    const token = await signRs256(resourceLinkClaims(p, login), p.privateKey, p.kid);
    const later = await postLaunch({ id_token: token, state: login.state }, login.cookie);
    expect(checkErrorPage(page(later), 'INVALID_STATE', { test: 'AC-T2-28', endpoint: 'launch' })).toEqual([]);
  });

  it('AC-T2-21 unknown kid: one JWKS refetch at ≥ 61 s after the last fetch, then none within 60 s (check 6)', { timeout: 150_000 }, async () => {
    const qaFetches = () => eventsSince('lti-service', runStart('T2b'), (e) => e.event === 'outbound_request' && hostIs(e, QA_HOST));
    const hits = (since: number) => eventsSince('qa-platform', since, (e) => e.event === 'qa_platform_hit' && String(e.path).endsWith(p.jwksFile));
    const last = Math.max(0, ...qaFetches().map((e) => Date.parse(String(e.ts))));
    const wait = last + 61_000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    const t1 = Date.now() - 500;
    const first = await attempt((c) => c, (c) => signRs256(c, p.strangerKey, p.strangerKid));
    expect(checkErrorPage(page(first.res), 'INVALID_SIGNATURE', { test: 'AC-T2-21', endpoint: 'launch' })).toEqual([]);
    await new Promise((r) => setTimeout(r, 1_500)); // log lines arrive
    const forFirst = qaFetches().filter((e) => e.trace_id === first.res.traceId);
    expect(forFirst, 'outbound_request to qa-platform.test with the trace id of the first response').toHaveLength(1);
    expect(hits(t1), 'qa_platform_hit on the JWKS path after the first post').toHaveLength(1);

    const t2 = Date.now();
    const second = await attempt((c) => c, (c) => signRs256(c, p.strangerKey, p.strangerKid));
    expect(checkErrorPage(page(second.res), 'INVALID_SIGNATURE', { test: 'AC-T2-21', endpoint: 'launch' })).toEqual([]);
    await new Promise((r) => setTimeout(r, 1_500));
    expect(qaFetches().filter((e) => Date.parse(String(e.ts)) >= t2), 'no new outbound_request within 60 s').toEqual([]);
    expect(hits(t2), 'no new qa_platform_hit within 60 s').toEqual([]);
  });

  it('AC-T2-32 JWKS refresh failure (JWKS file removed, 404): unknown kid → INVALID_SIGNATURE, detail jwks_fetch_failed, one outbound_* event; the cached key still works', { timeout: 180_000 }, async () => {
    // A fresh QA platform, so that its refetch limit and its JWKS file are its own (AC-T2-21 keeps its counts).
    const q = await setupQaPlatform(apiKey(ACCOUNT), 't2b32');
    const file = path.join(QA_FIXTURE_DIR, q.jwksFile);
    const jwks = fs.readFileSync(file, 'utf8');
    const launch = async (sign: (c: Record<string, unknown>) => Promise<string>) => {
      const login = await qaLogin(q);
      expect(login.status, `login: ${login.body.slice(0, 200)}`).toBe(302);
      return postLaunch({ id_token: await sign(resourceLinkClaims(q, login)), state: login.state }, login.cookie);
    };
    try {
      // The first launch fetches the JWKS and fills the cache.
      const warm = await launch((c) => signRs256(c, q.privateKey, q.kid));
      expect(warm.status, warm.body.slice(0, 300)).toBe(303);
      const lastFetch = Date.now();
      await new Promise((r) => setTimeout(r, Math.max(0, lastFetch + 61_000 - Date.now())));
      fs.rmSync(file, { force: true });
      // No probe of the JWKS path here: AC-T2-30 counts every qa_platform_hit on JWKS paths as a service fetch. The 404 is
      // proven by the service's own outbound event below (status 404).
      expect(fs.existsSync(file), 'the JWKS file is removed').toBe(false);

      // (1) Unknown kid → one refresh attempt, which fails → INVALID_SIGNATURE, detail jwks_fetch_failed.
      const since = Date.now() - 500;
      const bad = await launch((c) => signRs256(c, q.strangerKey, q.strangerKid));
      expect(checkErrorPage(page(bad), 'INVALID_SIGNATURE', { test: 'AC-T2-32', endpoint: 'launch' })).toEqual([]);
      const ev = await waitForEvent('lti-service', (e) => e.event === 'launch_check_failed' && e.trace_id === bad.traceId);
      expect(ev, `launch_check_failed with trace id ${bad.traceId}`).toBeDefined();
      expect(String(ev!.check)).toBe('6');
      expect(ev!.code).toBe('INVALID_SIGNATURE');
      expect(ev!.detail).toBe('jwks_fetch_failed');
      await new Promise((r) => setTimeout(r, 1_500)); // log lines arrive
      const outbound = eventsSince('lti-service', since, (e) => /^outbound_/.test(String(e.event)) && hostIs(e, QA_HOST) && e.trace_id === bad.traceId);
      expect(outbound.map((e) => `${String(e.event)} ${String(e.status ?? e.reason ?? '')}`), 'one outbound_* event for the failed fetch').toHaveLength(1);
      if (outbound[0]?.event === 'outbound_request') expect(String(outbound[0].status), 'qa-platform.test answered 404 for the removed file').toBe('404');

      // (2) A token signed with the cached key → the launch is accepted.
      const good = await launch((c) => signRs256(c, q.privateKey, q.kid));
      expect(good.status, good.body.slice(0, 300)).toBe(303);
      expect(new URL(good.location).searchParams.get('ltik') ?? '').toMatch(/^[A-Za-z0-9_-]{43}$/);
    } finally {
      fs.writeFileSync(file, jwks); // QA restores the file
    }
  });
});
