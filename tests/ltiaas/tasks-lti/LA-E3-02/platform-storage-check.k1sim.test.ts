// LA-E3-02 K1-SIM acceptance suite (runs inside the e2e container on the SIM slot).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-02.md (AC-LA-E3-02-01 .. AC-LA-E3-02-12)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D1 rules 1a, 5-11
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §2.1, §2.2
// - docs/architecture/ltiaas/data-model.md §4 (storage_check table)
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { httpsRequest, type HttpResult } from '../../../acceptance/lib/https';
import {
  ACCOUNT,
  apiKey,
  auth,
  eventsSince,
  LAUNCH_URL,
  LOGIN_URL,
  ltiApi,
  recordSecret,
  waitForEvent,
} from '../../../acceptance/lib/lti';
import {
  postLaunch,
  QA_DEPLOYMENT,
  QA_ISSUER,
  type QaPlatform,
  resourceLinkClaims,
  setupQaPlatform,
  signRs256,
} from '../../../acceptance/lib/qa-platform';
import {
  CANVAS_LOGIN,
  canvasPlatform,
  scenarioOf,
} from '../../../acceptance/M1/canvas/canvas';
import {
  expectStatus,
  formPost,
  idToken,
  parseForm,
  sim,
  unique,
  urls,
} from '../../../acceptance/M1/common/client';

const PUBLIC_LTI_URL = urls.lti.replace(/\/$/, '');
const PUBLIC_LTI_ORIGIN = new URL(PUBLIC_LTI_URL).origin;
const STORAGE_CHECK_URL = `${LAUNCH_URL}/storage-check`;

interface StorageLoginPageJson {
  authUrl: string;
  storageTarget: string;
  storageOrigin: string;
  stateKey: string;
  stateValue: string;
}

interface StorageCheckPageJson {
  storageTarget: string;
  storageOrigin: string;
  stateKey: string;
  check: string;
  postUrl?: string;
}

function extractJsonScriptBlock<T>(html: string): T {
  const m = /<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  expect(m, 'Expected <script type="application/json"> block in HTML page').not.toBeNull();
  return JSON.parse(m![1]!.trim()) as T;
}

function extractCheckTokenFromCheckPage(html: string): string {
  const inputMatch =
    /<input\b[^>]*name=["']check["'][^>]*value=["']([^"']+)["']/i.exec(html) ??
    /<input\b[^>]*value=["']([^"']+)["'][^>]*name=["']check["']/i.exec(html);
  if (inputMatch?.[1]) return inputMatch[1];
  const data = extractJsonScriptBlock<StorageCheckPageJson>(html);
  expect(typeof data.check).toBe('string');
  return data.check;
}

async function initiateCanvasStorageLoginAndGetSignedLaunchForm(
  cvTarget: Awaited<ReturnType<typeof canvasPlatform>>,
  storageTarget = 'post_message_forwarding',
): Promise<{
  loginRes: HttpResult;
  loginData: StorageLoginPageJson;
  cookiePair: string;
  launchFields: Record<string, string>;
}> {
  const scenario = scenarioOf(cvTarget, {
    id: unique('e302-cv'),
    storageTarget,
  });
  const created = await sim('/scenarios', 'POST', scenario);
  expectStatus(created, 201);

  const loginFields: Record<string, string> = {
    ...created.json.login,
    ...CANVAS_LOGIN,
    lti_storage_target: storageTarget,
  };
  for (const k of Object.keys(loginFields)) {
    if (loginFields[k] === null || loginFields[k] === undefined) delete loginFields[k];
  }

  const loginRes = await formPost(LOGIN_URL, loginFields);
  expect(loginRes.status, `Canvas login with lti_storage_target=${storageTarget}`).toBe(200);
  expect(String(loginRes.headers['content-type'] ?? '')).toContain('text/html');

  const setCookies = [loginRes.headers['set-cookie'] ?? []].flat().map(String);
  const cookiePair =
    setCookies.map((c) => c.split(';')[0] ?? '').find((c) => c.startsWith('__Host-lti_state_')) ?? '';
  expect(cookiePair).toMatch(/^__Host-lti_state_[0-9a-f]{8}=/);

  const loginData = extractJsonScriptBlock<StorageLoginPageJson>(loginRes.body);
  expect(loginData.storageTarget).toBe(storageTarget);
  expect(loginData.storageOrigin).toBe('https://sso.canvas.sim.test');
  expect(loginData.stateKey).toMatch(/^cog_state_[0-9a-f]$/);
  expect(typeof loginData.stateValue).toBe('string');
  expect(loginData.stateValue.length).toBeGreaterThan(10);
  recordSecret('state', loginData.stateValue);

  const authorize = await httpsRequest(loginData.authUrl);
  expectStatus(authorize, 200);
  const parsed = parseForm(authorize.body);
  recordSecret('id_token', parsed.fields.id_token);
  recordSecret('state', parsed.fields.state);

  return {
    loginRes,
    loginData,
    cookiePair,
    launchFields: parsed.fields,
  };
}

async function postStorageCheck(
  fields: { check: string; value: string },
  opts?: { origin?: string | null; account?: string; method?: string },
): Promise<HttpResult> {
  const account = opts?.account ?? ACCOUNT;
  const method = opts?.method ?? 'POST';
  const originHeader = opts?.origin === undefined ? PUBLIC_LTI_ORIGIN : opts.origin;
  const url =
    account === ACCOUNT
      ? STORAGE_CHECK_URL
      : `${PUBLIC_LTI_URL}/lti/launch/${encodeURIComponent(account)}/storage-check`;
  const body = new URLSearchParams(fields).toString();
  const headers: Record<string, string> = {
    ...(method === 'POST'
      ? {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': String(Buffer.byteLength(body)),
        }
      : {}),
    ...(originHeader !== null ? { origin: originHeader } : {}),
  };
  return httpsRequest(url, {
    method,
    headers,
    ...(method === 'POST' ? { body } : {}),
  });
}

describe('LA-E3-02 K1-SIM: Platform storage check and Canvas trait values', () => {
  let key = '';
  let cvTarget: Awaited<ReturnType<typeof canvasPlatform>>;
  let qaStandardPlatform: QaPlatform;
  const createdPlatformIds: string[] = [];

  beforeAll(async () => {
    key = apiKey(ACCOUNT);
    cvTarget = await canvasPlatform({ name: unique('QA4 E3-02 Canvas') });
    createdPlatformIds.push(cvTarget.platformId);
    qaStandardPlatform = await setupQaPlatform(key, 'e302-std');
    createdPlatformIds.push(qaStandardPlatform.platformId);
  });

  afterAll(async () => {
    for (const id of createdPlatformIds.splice(0)) {
      await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(id)}`, {
        authorization: auth.bearer(key),
      }).catch(() => undefined);
    }
  });

  it('AC-LA-E3-02-01: launch without state cookie returns 200 storage-check page when state has storage_target, and 400 STATE_COOKIE_MISSING when it does not', async () => {
    // 1. Canvas login with lti_storage_target -> launch without state cookie returns 200 storage-check page
    const { loginData, launchFields } = await initiateCanvasStorageLoginAndGetSignedLaunchForm(cvTarget);
    const launchNoCookie = await formPost(LAUNCH_URL, launchFields);
    expect(launchNoCookie.status).toBe(200);
    expect(String(launchNoCookie.headers['content-type'] ?? '')).toContain('text/html');
    expect(String(launchNoCookie.headers['cache-control'] ?? '')).toContain('no-store');
    expect(String(launchNoCookie.headers['referrer-policy'] ?? '')).toBe('same-origin');

    const csp = String(launchNoCookie.headers['content-security-policy'] ?? '');
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'nonce-");
    expect(csp).toContain('frame-ancestors https:');
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'none'");

    const checkBlock = extractJsonScriptBlock<StorageCheckPageJson>(launchNoCookie.body);
    expect(checkBlock.storageTarget).toBe('post_message_forwarding');
    expect(checkBlock.storageOrigin).toBe(loginData.storageOrigin);
    expect(checkBlock.stateKey).toBe(loginData.stateKey);
    expect(checkBlock.check.length).toBeGreaterThanOrEqual(20);

    // 2. Standard profile login (no storage_target stored) -> launch without cookie returns 400 STATE_COOKIE_MISSING
    const stdParams = new URLSearchParams({
      iss: QA_ISSUER,
      login_hint: 'qa-user-1',
      target_link_uri: `${LAUNCH_URL}?resource=qa-e302`,
      client_id: qaStandardPlatform.clientId,
      lti_deployment_id: QA_DEPLOYMENT,
      lti_message_hint: 'qa-hint-e302',
      lti_storage_target: 'post_message_forwarding',
    }).toString();
    const stdLoginRes = await httpsRequest(`${LOGIN_URL}?${stdParams}`);
    expect(stdLoginRes.status).toBe(302);
    const stdLoc = new URL(String(stdLoginRes.headers.location ?? ''));
    const stdState = stdLoc.searchParams.get('state') ?? '';
    const stdNonce = stdLoc.searchParams.get('nonce') ?? '';
    recordSecret('state', stdState);
    recordSecret('nonce', stdNonce);

    const stdIdToken = await signRs256(
      resourceLinkClaims(qaStandardPlatform, {
        status: 302,
        location: `${QA_ISSUER}/auth`,
        state: stdState,
        nonce: stdNonce,
        cookie: '',
        targetLinkUri: `${LAUNCH_URL}?resource=qa-e302`,
        traceId: '',
        body: '',
      }),
      qaStandardPlatform.privateKey,
      qaStandardPlatform.kid,
    );

    const stdLaunchNoCookie = await postLaunch({ id_token: stdIdToken, state: stdState });
    expect(stdLaunchNoCookie.status).toBe(400);
    expect(stdLaunchNoCookie.body).toContain('data-error-code="STATE_COOKIE_MISSING"');
  });

  it('AC-LA-E3-02-02: storage-check with matching value gives 303 with ltik, Referrer-Policy: no-referrer, Cache-Control: no-store, and logs launch_accepted {binding: "storage"}', async () => {
    const since = Date.now();
    const { loginData, launchFields } = await initiateCanvasStorageLoginAndGetSignedLaunchForm(cvTarget);
    const launchRes = await formPost(LAUNCH_URL, launchFields);
    expect(launchRes.status).toBe(200);
    const checkToken = extractCheckTokenFromCheckPage(launchRes.body);

    const redeemRes = await postStorageCheck({
      check: checkToken,
      value: loginData.stateValue,
    });
    expect(redeemRes.status).toBe(303);
    expect(String(redeemRes.headers['referrer-policy'] ?? '')).toBe('no-referrer');
    expect(String(redeemRes.headers['cache-control'] ?? '')).toContain('no-store');

    const redirectLoc = new URL(String(redeemRes.headers.location ?? ''));
    const ltik = redirectLoc.searchParams.get('ltik') ?? '';
    expect(ltik.length).toBeGreaterThan(20);
    recordSecret('ltik', ltik);

    const idTokRes = await idToken(ltik);
    expectStatus(idTokRes, 200);

    const acceptedEvent = await waitForEvent(
      'lti-service',
      (e) =>
        Date.parse(String(e.ts)) >= since &&
        e.event === 'launch_accepted' &&
        e.binding === 'storage',
    );
    expect(acceptedEvent?.binding).toBe('storage');
  });

  it('AC-LA-E3-02-03: second POST with the same check id gives 400 INVALID_STATE (single-use)', async () => {
    const { loginData, launchFields } = await initiateCanvasStorageLoginAndGetSignedLaunchForm(cvTarget);
    const launchRes = await formPost(LAUNCH_URL, launchFields);
    expect(launchRes.status).toBe(200);
    const checkToken = extractCheckTokenFromCheckPage(launchRes.body);

    const firstRedeem = await postStorageCheck({
      check: checkToken,
      value: loginData.stateValue,
    });
    expect(firstRedeem.status).toBe(303);

    const secondRedeem = await postStorageCheck({
      check: checkToken,
      value: loginData.stateValue,
    });
    expect(secondRedeem.status).toBe(400);
    expect(secondRedeem.body).toContain('data-error-code="INVALID_STATE"');
  });

  it('AC-LA-E3-02-05: wrong value gives 400 INVALID_STATE (storage_mismatch) and consumes the check so a retry with the right value also gives 400 INVALID_STATE', async () => {
    const since = Date.now();
    const { loginData, launchFields } = await initiateCanvasStorageLoginAndGetSignedLaunchForm(cvTarget);
    const launchRes = await formPost(LAUNCH_URL, launchFields);
    expect(launchRes.status).toBe(200);
    const checkToken = extractCheckTokenFromCheckPage(launchRes.body);

    const wrongRes = await postStorageCheck({
      check: checkToken,
      value: `${loginData.stateValue}-wrong`,
    });
    expect(wrongRes.status).toBe(400);
    expect(wrongRes.body).toContain('data-error-code="INVALID_STATE"');

    const mismatchLog = await waitForEvent(
      'lti-service',
      (e) =>
        Date.parse(String(e.ts)) >= since &&
        e.event === 'launch_check_failed' &&
        e.check === 'storage' &&
        e.code === 'INVALID_STATE' &&
        e.detail === 'storage_mismatch',
    );
    expect(mismatchLog?.detail).toBe('storage_mismatch');

    const retryRes = await postStorageCheck({
      check: checkToken,
      value: loginData.stateValue,
    });
    expect(retryRes.status).toBe(400);
    expect(retryRes.body).toContain('data-error-code="INVALID_STATE"');
  });

  it('AC-LA-E3-02-06: empty value gives 400 STATE_COOKIE_MISSING with the storage help text and consumes the check', async () => {
    const { loginData, launchFields } = await initiateCanvasStorageLoginAndGetSignedLaunchForm(cvTarget);
    const launchRes = await formPost(LAUNCH_URL, launchFields);
    expect(launchRes.status).toBe(200);
    const checkToken = extractCheckTokenFromCheckPage(launchRes.body);

    const emptyRes = await postStorageCheck({
      check: checkToken,
      value: '',
    });
    expect(emptyRes.status).toBe(400);
    expect(emptyRes.body).toContain('data-error-code="STATE_COOKIE_MISSING"');
    expect(emptyRes.body).toContain(
      'Your browser blocked the launch state in both cookies and platform storage. Open the activity in a new tab, or allow cookies for this site.',
    );

    const retryRes = await postStorageCheck({
      check: checkToken,
      value: loginData.stateValue,
    });
    expect(retryRes.status).toBe(400);
    expect(retryRes.body).toContain('data-error-code="INVALID_STATE"');
  });

  it('AC-LA-E3-02-07: storage-check with a missing or wrong Origin header gives 400 INVALID_STATE (storage_origin) and leaves the check unused', async () => {
    const { loginData, launchFields } = await initiateCanvasStorageLoginAndGetSignedLaunchForm(cvTarget);
    const launchRes = await formPost(LAUNCH_URL, launchFields);
    expect(launchRes.status).toBe(200);
    const checkToken = extractCheckTokenFromCheckPage(launchRes.body);

    // 1. Missing Origin header
    const missingOriginRes = await postStorageCheck(
      { check: checkToken, value: loginData.stateValue },
      { origin: null },
    );
    expect(missingOriginRes.status).toBe(400);
    expect(missingOriginRes.body).toContain('data-error-code="INVALID_STATE"');

    // 2. Wrong Origin header
    const wrongOriginRes = await postStorageCheck(
      { check: checkToken, value: loginData.stateValue },
      { origin: 'https://evil.example.test' },
    );
    expect(wrongOriginRes.status).toBe(400);
    expect(wrongOriginRes.body).toContain('data-error-code="INVALID_STATE"');

    // 3. The check stays unused -> valid Origin now succeeds with 303
    const validRes = await postStorageCheck(
      { check: checkToken, value: loginData.stateValue },
      { origin: PUBLIC_LTI_ORIGIN },
    );
    expect(validRes.status).toBe(303);
  });

  it('AC-LA-E3-02-08: storage-check on another tool account path gives 400 INVALID_STATE (or 404) and does not redeem the check', async () => {
    const { loginData, launchFields } = await initiateCanvasStorageLoginAndGetSignedLaunchForm(cvTarget);
    const launchRes = await formPost(LAUNCH_URL, launchFields);
    expect(launchRes.status).toBe(200);
    const checkToken = extractCheckTokenFromCheckPage(launchRes.body);

    const crossAccountRes = await postStorageCheck(
      { check: checkToken, value: loginData.stateValue },
      { account: 'other-account-e302', origin: PUBLIC_LTI_ORIGIN },
    );
    expect([400, 404]).toContain(crossAccountRes.status);
    expect(crossAccountRes.status).not.toBe(303);

    // The check on 'cogniate' remains unconsumed and redeems with 303
    const ownAccountRes = await postStorageCheck(
      { check: checkToken, value: loginData.stateValue },
      { account: ACCOUNT, origin: PUBLIC_LTI_ORIGIN },
    );
    expect(ownAccountRes.status).toBe(303);
  });

  it('AC-LA-E3-02-09: GET /lti/launch/:account/storage-check gives 405 METHOD_NOT_ALLOWED with Allow: POST', async () => {
    const getRes = await postStorageCheck({ check: 'unused', value: 'unused' }, { method: 'GET' });
    expect(getRes.status).toBe(405);
    expect(String(getRes.headers.allow ?? '').toUpperCase()).toContain('POST');
  });

  it('AC-LA-E3-02-10: Canvas simulator launch WITH state cookie still completes in one step (303 + ltik, binding: "cookie"), even when lti_storage_target was sent at login', async () => {
    const since = Date.now();
    const { cookiePair, launchFields } = await initiateCanvasStorageLoginAndGetSignedLaunchForm(cvTarget);

    const launchWithCookie = await formPost(LAUNCH_URL, launchFields, cookiePair);
    expect(launchWithCookie.status).toBe(303);
    const loc = new URL(String(launchWithCookie.headers.location ?? ''));
    const ltik = loc.searchParams.get('ltik') ?? '';
    expect(ltik.length).toBeGreaterThan(20);
    recordSecret('ltik', ltik);

    const cookieEvent = await waitForEvent(
      'lti-service',
      (e) =>
        Date.parse(String(e.ts)) >= since &&
        e.event === 'launch_accepted' &&
        e.binding === 'cookie',
    );
    expect(cookieEvent?.binding).toBe('cookie');
  });

  it('AC-LA-E3-02-11 & AC-LA-E3-02-12: Canvas simulator launch WITHOUT state cookie completes end-to-end via storage-check -> 303 ltik -> GET /api/idtoken (200), and zero log lines contain stateValue or check token', async () => {
    const since = Date.now();
    const { loginData, launchFields } = await initiateCanvasStorageLoginAndGetSignedLaunchForm(cvTarget);
    const launchRes = await formPost(LAUNCH_URL, launchFields);
    expect(launchRes.status).toBe(200);
    const checkToken = extractCheckTokenFromCheckPage(launchRes.body);
    recordSecret('state', checkToken);

    const redeemRes = await postStorageCheck({
      check: checkToken,
      value: loginData.stateValue,
    });
    expect(redeemRes.status).toBe(303);
    const ltik = new URL(String(redeemRes.headers.location ?? '')).searchParams.get('ltik') ?? '';
    expect(ltik.length).toBeGreaterThan(20);
    recordSecret('ltik', ltik);

    const idTokRes = await idToken(ltik);
    expectStatus(idTokRes, 200);
    expect(idTokRes.json?.platform?.clientId).toBe(cvTarget.clientId);

    // AC-LA-E3-02-12: Neither stateValue nor checkToken appears in any lti-service log line
    const logs = eventsSince('lti-service', since);
    expect(logs.length).toBeGreaterThan(0);
    const serializedLogs = JSON.stringify(logs);
    expect(serializedLogs.includes(loginData.stateValue)).toBe(false);
    expect(serializedLogs.includes(checkToken)).toBe(false);
  });
});
