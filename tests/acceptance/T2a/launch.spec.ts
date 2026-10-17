// T2a in-container browser: the happy-path launch and the API around it.
// Source: tasks/T2a.md AC-T2-03, -04, -05, -06, -08, -18, -19; contract §2.1, §2.2, §3.1; security §2.1, §3.
// Two real cg_student launches of "Seed activity" run once (beforeAll); each AC is one test on the captured data.
import crypto from 'node:crypto';
import type { BrowserContext } from '@playwright/test';
import { publicUrls } from '../lib/env';
import { httpsRequest } from '../lib/https';
import { ACCOUNT, apiKey, auth, checkErrorPage, errorCode, hasErrorShape, LAUNCH_URL, LTI_CLAIM, ltiApi, ltiSeed, SECOND_ACCOUNT, SEED_TARGET } from '../lib/lti';
import { type LaunchCapture, launchActivity, newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();
const LTIK = /^[A-Za-z0-9_-]{43}$/;
const B64URL_43 = /^[A-Za-z0-9_-]{43}$/;

interface IdToken {
  user: { id: string; roles: string[]; email?: string; name?: string };
  platform: { url: string; clientId: string; deploymentId: string; productFamilyCode: string };
  launch: {
    type: string;
    target: string;
    context?: { id: string };
    resourceLink?: { id: string };
    presentation?: { documentTarget?: string; document_target?: string };
  };
  services: { deepLinking: { available: boolean } };
}

// Default mode, not serial: if one AC fails, Playwright starts a new worker and runs beforeAll again,
// so the other ACs still get a verdict (no skip chain).
test.describe('T2a happy path (Seed activity, cg_student)', () => {
  let context: BrowserContext;
  let first: LaunchCapture;
  let second: LaunchCapture;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    context = await newStackContext(browser);
    const cmid = ltiSeed().cmids['COGNIATE-DEV-101'];
    first = await launchActivity(context, seed().users.cg_student, cmid);
    second = await launchActivity(context, seed().users.cg_student, cmid);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T2-03 cg_student opens "Seed activity": within 10 s a new window reaches the tool launch URL with a 43-char ltik', async () => {
    expect(first.popup, 'a new window opened').toBeDefined();
    expect(first.msToFinal ?? Infinity, 'ms from opening the activity to the tool URL').toBeLessThanOrEqual(10_000);
    const final = new URL(first.finalUrl ?? '');
    expect(`${final.origin}${final.pathname}`).toBe(`${urls.app}/tool/launch`);
    expect(final.searchParams.get('resource')).toBe('seed');
    expect(first.ltik ?? '').toMatch(LTIK);
  });

  test('AC-T2-04 GET /api/idtoken returns the LTIAAS-shaped ID token of the launch', async () => {
    const res = await ltiApi<IdToken>('GET', '/api/idtoken', { authorization: auth.ltik(apiKey(ACCOUNT), first.ltik!) });
    expect(res.status, res.body).toBe(200);
    const t = res.json;
    const s = ltiSeed();
    expect(t.user.id).toBe(String(seed().users.cg_student.id));
    expect(t.user.roles.some((r) => /#Learner$|^Learner$/.test(r)), `roles ${t.user.roles.join(', ')}`).toBe(true);
    expect(t.user).not.toHaveProperty('email');
    expect(t.user).not.toHaveProperty('name');
    expect(t.platform.url).toBe(urls.moodle);
    expect(t.platform.clientId).toBe(s.clientId);
    expect(String(t.platform.deploymentId)).toBe(String(s.deploymentId));
    expect(t.platform.productFamilyCode).toBe('moodle');
    expect(t.launch.type).toBe('LtiResourceLinkRequest');
    expect(t.launch.target).toBe(SEED_TARGET);
    expect(String(t.launch.context?.id)).toBe(String(seed().courses['COGNIATE-DEV-101']));
    expect(String(t.launch.resourceLink?.id ?? '')).not.toBe('');
    expect(t.launch.presentation?.documentTarget).toBe(t.launch.presentation?.document_target);
    expect(t.services.deepLinking.available).toBe(false);
  });

  test('AC-T2-05 GET /api/idtoken?raw=true returns the validated raw claims', async () => {
    const res = await ltiApi<Record<string, unknown>>('GET', '/api/idtoken?raw=true', { authorization: auth.ltik(apiKey(ACCOUNT), first.ltik!) });
    expect(res.status, res.body).toBe(200);
    for (const claim of ['iss', 'aud', 'sub', `${LTI_CLAIM}message_type`, `${LTI_CLAIM}deployment_id`]) expect(res.json, claim).toHaveProperty([claim]);
  });

  test('AC-T2-08 the 302 from /lti/login/cogniate goes to Moodle auth.php with the OIDC parameters and sets the state cookie', async () => {
    const s = ltiSeed();
    for (const cap of [first, second]) {
      expect(cap.login?.status).toBe(302);
      const loc = new URL(cap.login!.location);
      expect(`${loc.origin}${loc.pathname}`).toBe(`${urls.moodle}/mod/lti/auth.php`);
      const q = loc.searchParams;
      expect(q.get('scope')).toBe('openid');
      expect(q.get('response_type')).toBe('id_token');
      expect(q.get('response_mode')).toBe('form_post');
      expect(q.get('prompt')).toBe('none');
      expect(q.get('client_id')).toBe(s.clientId);
      expect(q.get('redirect_uri')).toBe(LAUNCH_URL);
      expect(q.get('login_hint'), 'login_hint as sent').toBe(cap.loginRequest?.login_hint);
      expect(q.get('lti_message_hint'), 'lti_message_hint as sent').toBe(cap.loginRequest?.lti_message_hint);
      expect(q.get('state') ?? '').toMatch(B64URL_43);
      expect(q.get('nonce') ?? '').toMatch(B64URL_43);
      const cookie = cap.login!.setCookies.find((c) => c.startsWith('__Host-'));
      expect(cookie, `Set-Cookie: ${cap.login!.setCookies.join(' | ')}`).toBeDefined();
      const attrs = cookie!.split(';').map((a) => a.trim().toLowerCase());
      for (const a of ['secure', 'httponly', 'samesite=none', 'partitioned', 'path=/']) expect(attrs, `cookie attribute ${a}`).toContain(a);
    }
    const a = new URL(first.login!.location).searchParams;
    const b = new URL(second.login!.location).searchParams;
    expect(a.get('state')).not.toBe(b.get('state'));
    expect(a.get('nonce')).not.toBe(b.get('nonce'));
  });

  test('AC-T2-19 the 303 from /lti/launch/cogniate has no-referrer, no-store and clears the state cookie; GET → 405 METHOD_NOT_ALLOWED page with Allow: POST', async () => {
    expect(first.launch?.status).toBe(303);
    expect(first.launch!.headers['referrer-policy']).toBe('no-referrer');
    expect(first.launch!.headers['cache-control']).toMatch(/no-store/);
    const cleared = first.launch!.setCookies.find((c) => c.startsWith('__Host-lti_state_') && /max-age=0/i.test(c));
    expect(cleared, `Set-Cookie: ${first.launch!.setCookies.join(' | ')}`).toBeDefined();
    const get = await httpsRequest(LAUNCH_URL);
    expect(checkErrorPage(get, 'METHOD_NOT_ALLOWED', { statuses: [405], test: 'AC-T2-19', endpoint: 'launch' })).toEqual([]);
    expect(String(get.headers.allow ?? 'missing').trim(), 'Allow header').toBe('POST');
  });

  test('AC-T2-06 /api/idtoken header errors: account mismatch, bad ltik, no colon, wrong schemes', async () => {
    const key = apiKey(ACCOUNT);
    const cases: [string, string, string][] = [
      ['qa-second key + valid ltik', auth.ltik(apiKey(SECOND_ACCOUNT), first.ltik!), 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER'],
      ['valid key + random ltik', auth.ltik(key, crypto.randomBytes(32).toString('base64url')), 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER'],
      ['LTIK-AUTH-V2 without ":"', `LTIK-AUTH-V2 ${key}`, 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER'],
      ['Bearer key', auth.bearer(key), 'INVALID_AUTHORIZATION_HEADER'],
      ['SERVICE-AUTH-V1', auth.service(key, crypto.randomBytes(32).toString('base64url')), 'INVALID_AUTHORIZATION_HEADER'],
    ];
    for (const [label, authorization, code] of cases) {
      const res = await ltiApi('GET', '/api/idtoken', { authorization });
      expect(res.status, label).toBe(401);
      expect(errorCode(res), label).toBe(code);
      expect(hasErrorShape(res), `${label}: error shape`).toBe(true);
    }
  });

  test('AC-T2-18 qa-second may register the same issuer + client id; a Moodle launch still belongs to cogniate', async () => {
    const s = ltiSeed();
    const seedPlatform = await ltiApi<Record<string, unknown>>('GET', `/api/platforms/${encodeURIComponent(s.platformId)}`, { authorization: auth.bearer(apiKey(ACCOUNT)) });
    expect(seedPlatform.status).toBe(200);
    const body = {
      url: seedPlatform.json.url,
      clientId: seedPlatform.json.clientId,
      name: 'QA second account copy',
      authenticationEndpoint: seedPlatform.json.authenticationEndpoint,
      accesstokenEndpoint: seedPlatform.json.accesstokenEndpoint,
      authConfig: seedPlatform.json.authConfig,
      deploymentIds: seedPlatform.json.deploymentIds,
    };
    const second = apiKey(SECOND_ACCOUNT);
    const res = await ltiApi<{ id?: string }>('POST', '/api/platforms', { authorization: auth.bearer(second), body });
    if (res.status === 409) {
      // Only possible if an earlier run on the same stack made the record already.
      test.info().annotations.push({ type: 'note', description: 'qa-second record exists from an earlier run on this stack (409)' });
      const list = await ltiApi<{ platforms: unknown[] }>('GET', `/api/platforms?clientId=${encodeURIComponent(String(body.clientId))}`, { authorization: auth.bearer(second) });
      expect(list.json.platforms).toHaveLength(1);
    } else {
      expect(res.status, res.body).toBe(201);
      expect(res.json.id).not.toBe(s.platformId);
    }
    const launch = await launchActivity(context, seed().users.cg_student, s.cmids['COGNIATE-DEV-101']);
    expect(launch.ltik ?? '').toMatch(LTIK);
    const asSecond = await ltiApi('GET', '/api/idtoken', { authorization: auth.ltik(second, launch.ltik!) });
    expect(asSecond.status).toBe(401);
    const asFirst = await ltiApi<IdToken>('GET', '/api/idtoken', { authorization: auth.ltik(apiKey(ACCOUNT), launch.ltik!) });
    expect(asFirst.status).toBe(200);
  });
});
