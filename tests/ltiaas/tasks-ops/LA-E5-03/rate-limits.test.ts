// LA-E5-03 acceptance (K1-SIM): rate limits per class, soft account buckets, auth_failure, trusted proxy, operator API.
// Runs in the e2e container on the acceptance profile (QA_TASK=LA-E5-03). One test per K1-SIM AC; each title starts
// with its AC id. AC-10 and AC-13 are Author UNIT tests.
// Source: docs/architecture/ltiaas/tasks/LA-E5-03.md; contract delta §1.3, §1.4, §1.6, §3, §6; LA-ADR-06 D1; BD-A2-16..20.
//
// Shared state rule (Q-LAB-04): every AC that changes a global rate limit restores it in `finally` with
// `PATCH /operator/v1/rate-limits {classes: {<class>: null}}`; per-account limits use a fresh account, never `qa-second`.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { exportJWK, generateKeyPair } from 'jose';
import { afterAll, beforeAll, it } from 'vitest';
import { publicUrls } from '../../../acceptance/lib/env';
import { httpsRequest } from '../../../acceptance/lib/https';
import { readLog, waitForLog } from '../../../acceptance/lib/logs';
import {
  ACCOUNT, apiKey, auth, errorCode, hasErrorShape, ltiApi, recordSecret,
} from '../../../acceptance/lib/lti';
import {
  QA_DEPLOYMENT, QA_FIXTURE_DIR, QA_ISSUER, postLaunch, resourceLinkClaims, signRs256, type QaLogin, type QaPlatform,
} from '../../../acceptance/lib/qa-platform';
import { OPERATOR_KEY_RE, TENANT_KEY_RE, operatorApi, operatorAuth, readOperatorKey } from '../LA-E5-01/operator';
import { listAudit } from '../LA-E5-02/audit-client';
import { ltiBootstrap } from '../LA-E5-04/host-bootstrap';

const urls = publicUrls();
const runId = crypto.randomBytes(3).toString('hex');
const freshId = (label: string) => `qa2-${label}-${runId}`;
const DIRECT_LTI_ORIGIN = process.env.LTI_DIRECT_URL ?? 'http://lti-service:4100';

const ALL_RATE_CLASSES = [
  'protocol',
  'protocol_account',
  'registration',
  'registration_account',
  'keys',
  'api',
  'admin',
  'auth_failure',
  'operator',
] as const;

type RateClassName = (typeof ALL_RATE_CLASSES)[number];

interface RateClassEntry {
  ratePerMinute: number;
  burst: number;
  source: 'operator' | 'env' | 'default';
}

interface RateLimitsResponse {
  classes: Record<string, RateClassEntry>;
  registrationSessionsPerAddress?: number;
  registrationSessionsSource?: 'operator' | 'env' | 'default';
}

let operatorKey = '';
let cogniateKey = '';
let cogniatePlatform: QaPlatform;
let cogniateLtik = '';
const createdPlatforms: { key: string; id: string }[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function defaultAccountBody(id: string, name = `QA2 Account ${id}`) {
  return {
    id,
    name,
    launchUrl: `${urls.app}/tool/launch`,
    deepLinkingUrl: `${urls.app}/tool/deep-link`,
    registrationUrl: `${urls.app}/tool/register`,
  };
}

/** Issues or rotates an API key for `accountId` (supports both LA-E5-07 operator API and B1 host bootstrap). */
async function ensureAccountApiKey(accountId: string, name: string): Promise<string> {
  const viaApi = await operatorApi<{ apiKey?: string }>(
    'POST',
    `/operator/v1/accounts/${encodeURIComponent(accountId)}/api-keys`,
    {
      authorization: operatorAuth(operatorKey),
      body: { label: 'qa2-e503', scopes: ['launch', 'admin'] },
    },
  );
  if (viaApi.status === 201 && typeof viaApi.json?.apiKey === 'string') {
    recordSecret('api_key', viaApi.json.apiKey);
    return viaApi.json.apiKey;
  }
  const boot = await ltiBootstrap(accountId, name, { rotateApiKey: true });
  assert.equal(boot.cliCode, 0, `lti:bootstrap for ${accountId} exits 0`);
  assert.equal(boot.keyFileWritten, true, `lti:bootstrap wrote infra/.secrets/lti-api-key.${accountId}`);
  return apiKey(accountId);
}

async function setupAccountPlatform(accountKey: string, accountId: string, label: string): Promise<QaPlatform> {
  const id = `${label}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const kid = `qa-${id}`;
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  fs.mkdirSync(QA_FIXTURE_DIR, { recursive: true });
  const jwksFile = `jwks-${id}.json`;
  fs.writeFileSync(path.join(QA_FIXTURE_DIR, jwksFile), JSON.stringify({ keys: [publicJwk] }));
  const stranger = await generateKeyPair('RS256');
  const clientId = `qa-client-${id}`;
  const jwksUrl = `${QA_ISSUER}/${jwksFile}`;
  const res = await ltiApi<{ id?: string }>('POST', '/api/platforms', {
    authorization: auth.bearer(accountKey),
    body: {
      url: QA_ISSUER,
      clientId,
      name: `QA platform ${accountId} ${id}`,
      authenticationEndpoint: `${QA_ISSUER}/auth`,
      accesstokenEndpoint: `${QA_ISSUER}/token`,
      authConfig: { method: 'JWK_SET', key: jwksUrl },
      deploymentIds: [QA_DEPLOYMENT],
    },
  });
  assert.equal(res.status, 201, `POST /api/platforms for ${accountId}: status ${res.status}`);
  const platformId = String(res.json?.id ?? '');
  createdPlatforms.push({ key: accountKey, id: platformId });
  return {
    clientId,
    platformId,
    kid,
    privateKey,
    publicJwk,
    jwksUrl,
    jwksFile,
    strangerKid: `qa-stranger-${id}`,
    strangerKey: stranger.privateKey,
  };
}

async function launchForAccount(p: QaPlatform, accountId: string): Promise<string> {
  const targetLinkUri = `${urls.lti}/lti/launch/${accountId}?resource=qa-e503`;
  const body = new URLSearchParams({
    iss: QA_ISSUER,
    login_hint: 'qa-user-e503',
    target_link_uri: targetLinkUri,
    client_id: p.clientId,
    lti_deployment_id: QA_DEPLOYMENT,
    lti_message_hint: 'qa-hint-e503',
  }).toString();
  const loginRes = await httpsRequest(`${urls.lti}/lti/login/${accountId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': String(Buffer.byteLength(body)),
    },
    body,
  });
  assert.equal(loginRes.status, 302, `POST /lti/login/${accountId} status ${loginRes.status}`);
  const loc = new URL(String(loginRes.headers.location ?? ''));
  const state = loc.searchParams.get('state') ?? '';
  const nonce = loc.searchParams.get('nonce') ?? '';
  const cookie =
    [loginRes.headers['set-cookie'] ?? []]
      .flat()
      .map((c) => c.split(';')[0])
      .find((c) => c.startsWith('__Host-lti_state_')) ?? '';
  recordSecret('state', state);
  recordSecret('nonce', nonce);
  const login: QaLogin = {
    status: loginRes.status,
    location: loc.href,
    state,
    nonce,
    cookie,
    targetLinkUri,
    traceId: String(loginRes.headers['x-trace-id'] ?? ''),
    body: loginRes.body,
  };
  const token = await signRs256(resourceLinkClaims(p, login), p.privateKey, p.kid);
  const res = await postLaunch({ id_token: token, state }, cookie, accountId);
  assert.equal(res.status, 303, `POST /lti/launch/${accountId} status ${res.status}`);
  const ltik = res.location ? new URL(res.location).searchParams.get('ltik') ?? '' : '';
  assert.ok(ltik.length > 20, `launch on ${accountId} produced ltik`);
  recordSecret('ltik', ltik);
  return ltik;
}

/** Sends a plain HTTP request directly from the e2e container to lti-service:4100 (untrusted peer). */
function directHttpRequest(
  urlPath: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<Awaited<ReturnType<typeof httpsRequest>>> {
  const target = new URL(urlPath, DIRECT_LTI_ORIGIN);
  const rawBody = options.body;
  return new Promise((resolve, reject) => {
    const req = http.request(
      target,
      {
        method: options.method ?? 'GET',
        headers: {
          ...options.headers,
          ...(rawBody !== undefined ? { 'content-length': String(Buffer.byteLength(rawBody)) } : {}),
        },
        timeout: 15_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const headers: Record<string, string | string[] | undefined> = {};
          for (const [k, v] of Object.entries(res.headers)) headers[k.toLowerCase()] = v;
          resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks).toString('utf8') });
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error(`Timeout after 15s for ${target.href}`)));
    req.on('error', reject);
    if (rawBody !== undefined) req.write(rawBody);
    req.end();
  });
}

async function patchRateLimits(classes: Record<string, { ratePerMinute: number; burst: number } | null>) {
  return operatorApi<RateLimitsResponse>('PATCH', '/operator/v1/rate-limits', {
    authorization: operatorAuth(operatorKey),
    body: { classes },
  });
}

/**
 * Sets a class limit to `{ ratePerMinute, burst }` while ensuring any existing bucket for the e2e
 * client address is refilled to full `burst` first (works whether PATCH clears buckets or refills lazily).
 */
async function setCleanClassLimit(
  cls: RateClassName,
  ratePerMinute: number,
  burst: number,
  warmupRequest?: () => Promise<unknown>,
) {
  const high = await patchRateLimits({
    [cls]: { ratePerMinute: 600_000, burst: burst + 1 },
  });
  assert.equal(high.status, 200, `PATCH /operator/v1/rate-limits warmup (${cls}) status`);
  if (warmupRequest) {
    await sleep(25);
    await warmupRequest();
  }
  const target = await patchRateLimits({
    [cls]: { ratePerMinute, burst },
  });
  assert.equal(target.status, 200, `PATCH /operator/v1/rate-limits (${cls}=${ratePerMinute}/${burst}) status`);
  return target;
}

function sendProxyLogin(accountId = ACCOUNT, iss = QA_ISSUER, clientId = cogniatePlatform.clientId) {
  const form = new URLSearchParams({
    iss,
    login_hint: 'qa-rate-user',
    target_link_uri: `${urls.lti}/lti/launch/${accountId}?resource=qa`,
    client_id: clientId,
    lti_deployment_id: QA_DEPLOYMENT,
  }).toString();
  return httpsRequest(`${urls.lti}/lti/login/${accountId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });
}

function sendDirectLogin(xff: string, accountId = ACCOUNT) {
  const form = new URLSearchParams({
    iss: QA_ISSUER,
    login_hint: 'qa-direct-user',
    target_link_uri: `${urls.lti}/lti/launch/${accountId}?resource=qa`,
    client_id: cogniatePlatform.clientId,
    lti_deployment_id: QA_DEPLOYMENT,
  }).toString();
  return directHttpRequest(`/lti/login/${accountId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-for': xff,
    },
    body: form,
  });
}

beforeAll(async () => {
  operatorKey = readOperatorKey();
  assert.ok(OPERATOR_KEY_RE.test(operatorKey), 'operator key format');
  cogniateKey = apiKey(ACCOUNT);
  assert.ok(TENANT_KEY_RE.test(cogniateKey), 'cogniate API key format');
  cogniatePlatform = await setupAccountPlatform(cogniateKey, ACCOUNT, 'cog-e503');
  cogniateLtik = await launchForAccount(cogniatePlatform, ACCOUNT);
});

afterAll(async () => {
  await patchRateLimits(
    Object.fromEntries(ALL_RATE_CLASSES.map((c) => [c, null])),
  ).catch(() => undefined);

  for (const p of createdPlatforms.splice(0)) {
    await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(p.id)}`, {
      authorization: auth.bearer(p.key),
    }).catch(() => undefined);
  }
});

it(
  'AC-LA-E5-03-01 on a fresh account, with its api limit set to 5 per minute, burst 5, the 6th GET /api/idtoken within one minute gives 429 RATE_LIMITED with Retry-After >= 1; a cogniate request in the same second gives 200',
  async () => {
    const accountId = freshId('ac01');
    const created = await operatorApi('POST', '/operator/v1/accounts', {
      authorization: operatorAuth(operatorKey),
      body: defaultAccountBody(accountId),
    });
    assert.equal(created.status, 201, `POST /operator/v1/accounts (${accountId}) status`);

    const freshKey = await ensureAccountApiKey(accountId, `QA2 ${accountId}`);
    const freshPlatform = await setupAccountPlatform(freshKey, accountId, 'ac01');
    const freshLtik = await launchForAccount(freshPlatform, accountId);

    const patchRes = await operatorApi('PATCH', `/operator/v1/accounts/${encodeURIComponent(accountId)}`, {
      authorization: operatorAuth(operatorKey),
      body: { limits: { api: { ratePerMinute: 5, burst: 5 } } },
    });
    assert.equal(patchRes.status, 200, `PATCH limits on ${accountId} status`);

    for (let i = 1; i <= 5; i += 1) {
      const okRes = await ltiApi('GET', '/api/idtoken', {
        authorization: auth.ltik(freshKey, freshLtik),
      });
      assert.equal(okRes.status, 200, `request #${i} within burst 5 gives 200`);
    }

    const sixth = await ltiApi('GET', '/api/idtoken', {
      authorization: auth.ltik(freshKey, freshLtik),
    });
    assert.equal(sixth.status, 429, '6th GET /api/idtoken gives 429');
    assert.equal(hasErrorShape(sixth), true, '429 response has standard error shape');
    assert.equal(errorCode(sixth), 'RATE_LIMITED', '429 error code is RATE_LIMITED');
    const retryAfter = Number(sixth.headers['retry-after']);
    assert.equal(Number.isInteger(retryAfter) && retryAfter >= 1, true, `Retry-After is whole seconds >= 1 (got ${sixth.headers['retry-after']})`);
    const bodyRetryAfter = (sixth.json as { details?: { retryAfter?: unknown } })?.details?.retryAfter;
    assert.equal(bodyRetryAfter, retryAfter, 'details.retryAfter equals Retry-After header (BD-A2-16)');

    // A cogniate request in the same second still gives 200 (separate bucket).
    const cogRes = await ltiApi('GET', '/api/idtoken', {
      authorization: auth.ltik(cogniateKey, cogniateLtik),
    });
    assert.equal(cogRes.status, 200, 'cogniate GET /api/idtoken in the same second gives 200');
  },
);

it(
  'AC-LA-E5-03-02 with protocol set to 3 per minute, burst 3 (PATCH /operator/v1/rate-limits), the 4th login from one address within one minute gives the 429 page with data-error-code="RATE_LIMITED" and no Set-Cookie',
  async () => {
    try {
      await setCleanClassLimit('protocol', 3, 3, () => sendProxyLogin());

      for (let i = 1; i <= 3; i += 1) {
        const res = await sendProxyLogin();
        assert.equal(res.status, 302, `login #${i} within burst 3 gives 302`);
      }

      const fourth = await sendProxyLogin();
      assert.equal(fourth.status, 429, '4th login gives 429');
      assert.match(String(fourth.headers['content-type'] ?? ''), /text\/html/i, '429 login response is text/html');
      assert.match(fourth.body, /data-error-code="RATE_LIMITED"/, '429 HTML page has data-error-code="RATE_LIMITED"');
      assert.equal(fourth.headers['set-cookie'], undefined, '429 HTML page sets no cookie');
      const pageRetryAfter = Number(fourth.headers['retry-after']);
      assert.equal(Number.isInteger(pageRetryAfter) && pageRetryAfter >= 1, true, '429 HTML page has Retry-After >= 1 (BD-A2-16)');
    } finally {
      await patchRateLimits({ protocol: null });
    }
  },
);

it(
  'AC-LA-E5-03-03 untrusted peer: with protocol at 3 per minute, four logins sent from the e2e container straight to the LTI service, each with another X-Forwarded-For value, give 429 on the 4th',
  async () => {
    try {
      await setCleanClassLimit('protocol', 3, 3, () => sendDirectLogin('203.0.113.250'));

      for (let i = 1; i <= 3; i += 1) {
        const res = await sendDirectLogin(`203.0.113.${i}`);
        assert.equal(res.status, 302, `direct login #${i} (XFF 203.0.113.${i}) gives 302`);
      }

      const fourth = await sendDirectLogin('203.0.113.4');
      assert.equal(fourth.status, 429, '4th direct login with distinct X-Forwarded-For gives 429 (untrusted peer ignores XFF)');
      assert.match(fourth.body, /data-error-code="RATE_LIMITED"/, '4th direct login returns RATE_LIMITED page');
      assert.equal(fourth.headers['set-cookie'], undefined, '4th direct login sets no cookie');
    } finally {
      await patchRateLimits({ protocol: null });
    }
  },
);

it(
  'AC-LA-E5-03-04 trusted peer: a limited request through the proxy logs rate_limited with client_ip = the e2e container address, not the proxy address',
  async () => {
    const proxyIp = (await dns.lookup('proxy')).address;
    const e2eIps = Object.values(os.networkInterfaces())
      .flat()
      .filter((iface): iface is os.NetworkInterfaceInfo => Boolean(iface && !iface.internal))
      .map((iface) => iface.address);
    assert.ok(e2eIps.length > 0, 'resolved e2e container network interface addresses');

    // Use the `keys` class through the proxy so its 1-per-minute log throttle is fresh for this bucket.
    const logLinesBefore = readLog('lti-service').entries.length;
    try {
      await setCleanClassLimit('keys', 2, 2, () => httpsRequest(`${urls.lti}/lti/keys/${ACCOUNT}`));
      await httpsRequest(`${urls.lti}/lti/keys/${ACCOUNT}`);
      await httpsRequest(`${urls.lti}/lti/keys/${ACCOUNT}`);
      const limited = await httpsRequest(`${urls.lti}/lti/keys/${ACCOUNT}`);
      assert.equal(limited.status, 429, '3rd GET /lti/keys/cogniate through proxy gives 429');

      const hit = await waitForLog(
        'lti-service',
        (entry) =>
          entry.event === 'rate_limited' &&
          typeof entry.client_ip === 'string' &&
          e2eIps.includes(String(entry.client_ip)),
        5_000,
      );
      const recentRateLimited = readLog('lti-service')
        .entries.slice(logLinesBefore)
        .map((e) => e.entry)
        .filter((e) => e.event === 'rate_limited');
      const targetEntry = hit?.entry ?? recentRateLimited[recentRateLimited.length - 1];
      assert.ok(targetEntry, 'lti-service logged a rate_limited event');
      assert.notEqual(targetEntry.client_ip, proxyIp, 'logged client_ip is not the proxy container address');
      assert.equal(
        e2eIps.includes(String(targetEntry.client_ip)),
        true,
        `logged client_ip (${String(targetEntry.client_ip)}) equals the e2e container address`,
      );
    } finally {
      await patchRateLimits({ keys: null });
    }
  },
);

it(
  'AC-LA-E5-03-05 with auth_failure at 30 per minute, burst 30, 31 requests with unknown API keys from one address in one minute give 429 on the 31st; a request with a valid key from that address then also gets 429 until Retry-After has passed',
  async () => {
    let retryAfterSec = 2;
    try {
      await setCleanClassLimit('auth_failure', 30, 30);

      for (let i = 1; i <= 30; i += 1) {
        const unknownKey = `ltis_${crypto.randomBytes(32).toString('base64url')}`;
        const res = await ltiApi('GET', '/api/platforms', {
          authorization: auth.bearer(unknownKey),
        });
        assert.equal(res.status, 401, `unknown API key request #${i} gives 401`);
      }

      const unknown31 = `ltis_${crypto.randomBytes(32).toString('base64url')}`;
      const res31 = await ltiApi('GET', '/api/platforms', {
        authorization: auth.bearer(unknown31),
      });
      assert.equal(res31.status, 429, '31st unknown API key request gives 429');
      assert.equal(errorCode(res31), 'RATE_LIMITED', '31st request code is RATE_LIMITED');
      retryAfterSec = Math.max(1, Number(res31.headers['retry-after'] ?? 2));
      assert.equal(Number.isFinite(retryAfterSec) && retryAfterSec >= 1, true, 'Retry-After header >= 1');
      assert.equal(
        (res31.json as { details?: { retryAfter?: unknown } })?.details?.retryAfter,
        Number(res31.headers['retry-after']),
        '31st request details.retryAfter equals Retry-After header (BD-A2-16)',
      );

      // A request with a valid key from the same address immediately also gets 429.
      const validWhileBlocked = await ltiApi('GET', '/api/platforms', {
        authorization: auth.bearer(cogniateKey),
      });
      assert.equal(validWhileBlocked.status, 429, 'valid key from the blocked address gets 429 before Retry-After');
      assert.equal(errorCode(validWhileBlocked), 'RATE_LIMITED', 'blocked valid key code is RATE_LIMITED');
      assert.equal(
        (validWhileBlocked.json as { details?: { retryAfter?: unknown } })?.details?.retryAfter,
        Number(validWhileBlocked.headers['retry-after']),
        'blocked request details.retryAfter equals Retry-After header (BD-A2-16)',
      );

      // Wait until Retry-After has passed, then verify the valid key passes again (200).
      await sleep(retryAfterSec * 1000 + 300);
      const validAfterWait = await ltiApi('GET', '/api/platforms', {
        authorization: auth.bearer(cogniateKey),
      });
      assert.equal(validAfterWait.status, 200, 'valid key passes again (200) after Retry-After has passed');
    } finally {
      await sleep(retryAfterSec * 1000 + 100);
      await patchRateLimits({ auth_failure: null });
    }
  },
);

it(
  'AC-LA-E5-03-06 200 GET /api/idtoken calls in one minute with the valid cogniate key and random ltiks each give 401 INVALID_LTIK_AUTH_AUTHORIZATION_HEADER, never 429; the next call with a valid ltik gives 200',
  async () => {
    for (let i = 1; i <= 200; i += 1) {
      const randomLtik = crypto.randomBytes(24).toString('base64url');
      const res = await ltiApi('GET', '/api/idtoken', {
        authorization: auth.ltik(cogniateKey, randomLtik),
      });
      assert.equal(res.status, 401, `random ltik call #${i} gives 401 (never 429)`);
      assert.equal(
        errorCode(res),
        'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER',
        `random ltik call #${i} code is INVALID_LTIK_AUTH_AUTHORIZATION_HEADER`,
      );
    }

    const nextValid = await ltiApi('GET', '/api/idtoken', {
      authorization: auth.ltik(cogniateKey, cogniateLtik),
    });
    assert.equal(nextValid.status, 200, 'next GET /api/idtoken with valid ltik gives 200');
  },
);

it(
  'AC-LA-E5-03-07 with protocol_account at 3 per minute, 10 logins for cogniate with an unknown iss in one minute each get their normal error page (no 429), one rate_limit_soft {class: "protocol_account"} line exists, and a valid simulator launch of cogniate then passes',
  async () => {
    const logCountBefore = readLog('lti-service').entries.length;
    try {
      await setCleanClassLimit('protocol_account', 3, 3, () =>
        sendProxyLogin(ACCOUNT, 'https://unknown-warmup.sim.test'),
      );

      for (let i = 1; i <= 10; i += 1) {
        const res = await sendProxyLogin(ACCOUNT, `https://unknown-${i}.sim.test`);
        assert.notEqual(res.status, 429, `unknown-iss login #${i} is not rate-limited (got ${res.status})`);
        assert.equal(res.status, 400, `unknown-iss login #${i} gets its normal 400 error page`);
        assert.equal(
          res.body.includes('data-error-code="RATE_LIMITED"'),
          false,
          `unknown-iss login #${i} is not the RATE_LIMITED page`,
        );
      }

      const softHit = await waitForLog(
        'lti-service',
        (entry, _raw) =>
          entry.event === 'rate_limit_soft' &&
          entry.class === 'protocol_account' &&
          entry.tool_account_id === ACCOUNT,
        5_000,
      );
      assert.ok(softHit, 'rate_limit_soft {class: "protocol_account", tool_account_id: "cogniate"} logged');

      const newSoftEntries = readLog('lti-service')
        .entries.slice(logCountBefore)
        .filter(
          (e) =>
            e.entry.event === 'rate_limit_soft' &&
            e.entry.class === 'protocol_account' &&
            e.entry.tool_account_id === ACCOUNT,
        );
      assert.equal(newSoftEntries.length, 1, 'at most one rate_limit_soft line per minute for protocol_account:cogniate');

      // A valid launch of cogniate still passes immediately.
      const validLtik = await launchForAccount(cogniatePlatform, ACCOUNT);
      const tokRes = await ltiApi('GET', '/api/idtoken', {
        authorization: auth.ltik(cogniateKey, validLtik),
      });
      assert.equal(tokRes.status, 200, 'valid launch of cogniate passes after soft limit exceeded');
    } finally {
      await patchRateLimits({ protocol_account: null });
    }
  },
);

it(
  'AC-LA-E5-03-08 GET /healthz is never limited; after PATCH /operator/v1/rate-limits the next request uses the new value, and one settings.rate_limits audit event exists',
  async () => {
    try {
      const tighten = await setCleanClassLimit('keys', 1, 1, () => httpsRequest(`${urls.lti}/lti/keys/${ACCOUNT}`));
      const tightenTraceId = tighten.traceId;

      const firstKeyReq = await httpsRequest(`${urls.lti}/lti/keys/${ACCOUNT}`);
      assert.equal(firstKeyReq.status, 200, '1st GET /lti/keys/cogniate with limit 1/1 gives 200');
      const secondKeyReq = await httpsRequest(`${urls.lti}/lti/keys/${ACCOUNT}`);
      assert.equal(secondKeyReq.status, 429, '2nd GET /lti/keys/cogniate with limit 1/1 gives 429');

      // While keys is exhausted, GET /healthz is never limited.
      for (let i = 1; i <= 5; i += 1) {
        const health = await httpsRequest(`${urls.lti}/healthz`);
        assert.equal(health.status, 200, `GET /healthz #${i} gives 200 while keys is rate-limited`);
      }

      // Raise keys limit via PATCH /operator/v1/rate-limits; the very next request uses the new value at once.
      const raise = await patchRateLimits({ keys: { ratePerMinute: 300, burst: 100 } });
      assert.equal(raise.status, 200, 'PATCH /operator/v1/rate-limits to raise keys gives 200');
      const raiseTraceId = raise.traceId;

      const nextKeyReq = await httpsRequest(`${urls.lti}/lti/keys/${ACCOUNT}`);
      assert.equal(nextKeyReq.status, 200, 'next GET /lti/keys/cogniate immediately uses the new limit and gives 200');

      // Verify one settings.rate_limits audit event per PATCH.
      const auditRes = await listAudit(operatorKey, { action: 'settings.rate_limits', limit: 100 });
      assert.equal(auditRes.res.status, 200, 'GET /operator/v1/audit?action=settings.rate_limits status');
      for (const traceId of [tightenTraceId, raiseTraceId]) {
        const matching = auditRes.events.filter((e) => e.traceId === traceId);
        assert.equal(matching.length, 1, `exactly one settings.rate_limits audit event for traceId ${traceId}`);
        assert.equal(matching[0].result, 'ok', 'settings.rate_limits audit event result is ok');
        assert.ok(
          ['settings', 'service_setting'].includes(matching[0].target.type),
          `settings.rate_limits target.type is settings or service_setting (got ${matching[0].target.type})`,
        );
      }
    } finally {
      await patchRateLimits({ keys: null });
    }
  },
);

it(
  'AC-LA-E5-03-09 GET /operator/v1/rate-limits shows each class with source (operator, env or default); a PATCH with an unknown class or a value below 1 gives 400 INVALID_REQUEST and changes nothing',
  async () => {
    try {
      const initial = await operatorApi<RateLimitsResponse>('GET', '/operator/v1/rate-limits', {
        authorization: operatorAuth(operatorKey),
      });
      assert.equal(initial.status, 200, 'GET /operator/v1/rate-limits status');
      assert.ok(initial.json?.classes && typeof initial.json.classes === 'object', 'response has classes object');

      for (const cls of ALL_RATE_CLASSES) {
        const row = initial.json!.classes[cls];
        assert.ok(row, `GET /operator/v1/rate-limits includes class ${cls}`);
        assert.equal(Number.isInteger(row.ratePerMinute) && row.ratePerMinute >= 1, true, `${cls}.ratePerMinute >= 1`);
        assert.equal(Number.isInteger(row.burst) && row.burst >= 1, true, `${cls}.burst >= 1`);
        assert.equal(
          ['operator', 'env', 'default'].includes(row.source),
          true,
          `${cls}.source is operator, env or default (got ${row.source})`,
        );
      }
      assert.equal(
        Number.isInteger(initial.json?.registrationSessionsPerAddress) &&
          Number(initial.json?.registrationSessionsPerAddress) >= 1 &&
          Number(initial.json?.registrationSessionsPerAddress) <= 1000,
        true,
        'GET /operator/v1/rate-limits includes registrationSessionsPerAddress (1..1000, BD-A2-18)',
      );
      assert.equal(
        ['operator', 'env', 'default'].includes(String(initial.json?.registrationSessionsSource)),
        true,
        'GET /operator/v1/rate-limits includes registrationSessionsSource (BD-A2-18)',
      );

      // Set an operator override on `keys` and `registrationSessionsPerAddress` and verify source becomes "operator".
      const setOp = await operatorApi<RateLimitsResponse>('PATCH', '/operator/v1/rate-limits', {
        authorization: operatorAuth(operatorKey),
        body: { classes: { keys: { ratePerMinute: 77, burst: 55 } }, registrationSessionsPerAddress: 25 },
      });
      assert.equal(setOp.status, 200, 'PATCH valid operator override returns 200');
      assert.deepEqual(setOp.json?.classes?.keys, {
        ratePerMinute: 77,
        burst: 55,
        source: 'operator',
      });
      assert.equal(setOp.json?.registrationSessionsPerAddress, 25, 'registrationSessionsPerAddress updated to 25');
      assert.equal(setOp.json?.registrationSessionsSource, 'operator', 'registrationSessionsSource is operator');

      // Unknown class -> 400 INVALID_REQUEST.
      const badUnknown = await operatorApi('PATCH', '/operator/v1/rate-limits', {
        authorization: operatorAuth(operatorKey),
        body: { classes: { not_a_rate_class: { ratePerMinute: 10, burst: 10 } } },
      });
      assert.equal(badUnknown.status, 400, 'PATCH with unknown class gives 400');
      assert.equal(hasErrorShape(badUnknown), true, 'unknown class 400 error shape');
      assert.equal(errorCode(badUnknown), 'INVALID_REQUEST', 'unknown class code is INVALID_REQUEST');

      // Unknown top-level field or registrationSessionsPerAddress outside 1..1000 -> 400 INVALID_REQUEST (BD-A2-18).
      for (const badBody of [
        { unknownTopField: 10 },
        { registrationSessionsPerAddress: 0 },
        { registrationSessionsPerAddress: 1001 },
      ]) {
        const badCap = await operatorApi('PATCH', '/operator/v1/rate-limits', {
          authorization: operatorAuth(operatorKey),
          body: badBody,
        });
        assert.equal(badCap.status, 400, `PATCH with ${JSON.stringify(badBody)} gives 400`);
        assert.equal(hasErrorShape(badCap), true, 'bad top-level / cap 400 error shape');
        assert.equal(errorCode(badCap), 'INVALID_REQUEST', 'bad top-level / cap code is INVALID_REQUEST');
      }

      // Value below 1 (ratePerMinute: 0 and burst: 0) -> 400 INVALID_REQUEST.
      for (const badVal of [
        { ratePerMinute: 0, burst: 10 },
        { ratePerMinute: 10, burst: 0 },
        { ratePerMinute: -5, burst: 10 },
      ]) {
        const badRes = await operatorApi('PATCH', '/operator/v1/rate-limits', {
          authorization: operatorAuth(operatorKey),
          body: { classes: { keys: badVal } },
        });
        assert.equal(badRes.status, 400, `PATCH with ${JSON.stringify(badVal)} gives 400`);
        assert.equal(hasErrorShape(badRes), true, 'below-1 400 error shape');
        assert.equal(errorCode(badRes), 'INVALID_REQUEST', 'below-1 error code is INVALID_REQUEST');
      }

      // Verify nothing changed after the rejected PATCH calls.
      const afterBad = await operatorApi<RateLimitsResponse>('GET', '/operator/v1/rate-limits', {
        authorization: operatorAuth(operatorKey),
      });
      assert.equal(afterBad.status, 200, 'GET /operator/v1/rate-limits after bad PATCHes');
      assert.deepEqual(
        afterBad.json?.classes?.keys,
        { ratePerMinute: 77, burst: 55, source: 'operator' },
        'rejected PATCH calls left keys rate limit unchanged',
      );
      assert.equal(afterBad.json?.registrationSessionsPerAddress, 25, 'rejected PATCH calls left cap unchanged');
    } finally {
      const cleared = await operatorApi<RateLimitsResponse>('PATCH', '/operator/v1/rate-limits', {
        authorization: operatorAuth(operatorKey),
        body: { classes: { keys: null }, registrationSessionsPerAddress: null },
      });
      if (cleared.status === 200) {
        assert.notEqual(cleared.json?.classes?.keys?.source, 'operator', 'clearing operator override restores non-operator source');
        assert.notEqual(cleared.json?.registrationSessionsSource, 'operator', 'clearing cap override restores non-operator source');
      }
    }
  },
);

it(
  'AC-LA-E5-03-11 with keys set to 3 per minute, burst 3, the 4th GET /lti/keys/cogniate from one address within one minute gives 429 with Retry-After; /healthz from that address still answers',
  async () => {
    try {
      await setCleanClassLimit('keys', 3, 3, () => httpsRequest(`${urls.lti}/lti/keys/${ACCOUNT}`));

      for (let i = 1; i <= 3; i += 1) {
        const okRes = await httpsRequest(`${urls.lti}/lti/keys/${ACCOUNT}`);
        assert.equal(okRes.status, 200, `GET /lti/keys/cogniate #${i} within burst 3 gives 200`);
      }

      const fourth = await httpsRequest(`${urls.lti}/lti/keys/${ACCOUNT}`);
      assert.equal(fourth.status, 429, '4th GET /lti/keys/cogniate gives 429');
      const retryAfter = Number(fourth.headers['retry-after']);
      assert.equal(Number.isInteger(retryAfter) && retryAfter >= 1, true, '429 includes Retry-After >= 1');
      const parsed = JSON.parse(fourth.body) as { details?: { message?: string; retryAfter?: unknown } };
      assert.equal(parsed.details?.message, 'RATE_LIMITED', '429 body has code RATE_LIMITED');
      assert.equal(parsed.details?.retryAfter, retryAfter, '429 body details.retryAfter equals Retry-After header (BD-A2-16)');

      const health = await httpsRequest(`${urls.lti}/healthz`);
      assert.equal(health.status, 200, 'GET /healthz from the same address still answers 200');
    } finally {
      await patchRateLimits({ keys: null });
    }
  },
);

it(
  'AC-LA-E5-03-12 with admin set to 3 per minute, burst 3, for a fresh account’s key, the 4th GET /api/platforms within one minute gives 429 RATE_LIMITED, while an api call of the same key still passes',
  async () => {
    const accountId = freshId('ac12');
    const created = await operatorApi('POST', '/operator/v1/accounts', {
      authorization: operatorAuth(operatorKey),
      body: defaultAccountBody(accountId),
    });
    assert.equal(created.status, 201, `POST /operator/v1/accounts (${accountId}) status`);

    const freshKey = await ensureAccountApiKey(accountId, `QA2 ${accountId}`);
    const freshPlatform = await setupAccountPlatform(freshKey, accountId, 'ac12');
    const freshLtik = await launchForAccount(freshPlatform, accountId);

    const patchRes = await operatorApi('PATCH', `/operator/v1/accounts/${encodeURIComponent(accountId)}`, {
      authorization: operatorAuth(operatorKey),
      body: { limits: { admin: { ratePerMinute: 3, burst: 3 } } },
    });
    assert.equal(patchRes.status, 200, `PATCH admin limit on ${accountId} status`);

    for (let i = 1; i <= 3; i += 1) {
      const okRes = await ltiApi('GET', '/api/platforms', {
        authorization: auth.bearer(freshKey),
      });
      assert.equal(okRes.status, 200, `GET /api/platforms #${i} within burst 3 gives 200`);
    }

    const fourth = await ltiApi('GET', '/api/platforms', {
      authorization: auth.bearer(freshKey),
    });
    assert.equal(fourth.status, 429, '4th GET /api/platforms gives 429');
    assert.equal(hasErrorShape(fourth), true, '429 response has error shape');
    assert.equal(errorCode(fourth), 'RATE_LIMITED', '429 error code is RATE_LIMITED');
    const retryAfter = Number(fourth.headers['retry-after']);
    assert.equal(Number.isInteger(retryAfter) && retryAfter >= 1, true, 'Retry-After >= 1');
    assert.equal(
      (fourth.json as { details?: { retryAfter?: unknown } })?.details?.retryAfter,
      retryAfter,
      '429 body details.retryAfter equals Retry-After header (BD-A2-16)',
    );

    // An `api` class call with the same key still passes (200).
    const apiCall = await ltiApi('GET', '/api/idtoken', {
      authorization: auth.ltik(freshKey, freshLtik),
    });
    assert.equal(apiCall.status, 200, 'GET /api/idtoken (api class) with the same key still gives 200');
  },
);
