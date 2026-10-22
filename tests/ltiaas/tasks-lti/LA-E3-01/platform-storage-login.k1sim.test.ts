// LA-E3-01 K1-SIM suite: Platform storage login page and state columns (AP-05-01; K1-LAUNCH L10).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-01.md (AC-LA-E3-01-10)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D1 rules 1-4 (AP-05-01)
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §2.1
// - docs/architecture/security.md §2.1, §3, §5
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { httpsRequest, type HttpResult } from '../../../acceptance/lib/https';
import {
  ACCOUNT,
  apiKey,
  auth,
  LAUNCH_URL,
  LOGIN_URL,
  ltiApi,
  recordSecret,
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

const runId = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function assertBaseline302Login(
  res: HttpResult,
  expected: {
    authEndpoint: string;
    clientId: string;
    loginHint: string;
    messageHint: string;
  },
): { state: string; nonce: string; cookiePair: string } {
  expect(res.status, res.body.slice(0, 200)).toBe(302);
  expect(String(res.headers['cache-control'] ?? '')).toContain('no-store');
  expect(String(res.headers['referrer-policy'] ?? '')).toBe('no-referrer');

  const location = String(res.headers.location ?? '');
  expect(location.startsWith(`${expected.authEndpoint}?`)).toBe(true);
  const url = new URL(location);
  expect(url.searchParams.get('scope')).toBe('openid');
  expect(url.searchParams.get('response_type')).toBe('id_token');
  expect(url.searchParams.get('response_mode')).toBe('form_post');
  expect(url.searchParams.get('prompt')).toBe('none');
  expect(url.searchParams.get('client_id')).toBe(expected.clientId);
  expect(url.searchParams.get('redirect_uri')).toBe(LAUNCH_URL);
  expect(url.searchParams.get('login_hint')).toBe(expected.loginHint);
  expect(url.searchParams.get('lti_message_hint')).toBe(expected.messageHint);

  const state = url.searchParams.get('state') ?? '';
  const nonce = url.searchParams.get('nonce') ?? '';
  expect(state).toMatch(/^[A-Za-z0-9_-]{32,}$/);
  expect(nonce).toMatch(/^[A-Za-z0-9_-]{32,}$/);
  recordSecret('state', state);
  recordSecret('nonce', nonce);

  const expectedCookieName = `__Host-lti_state_${sha256Hex(state).slice(0, 8)}`;
  const setCookies = [res.headers['set-cookie'] ?? []].flat().map(String);
  const stateCookieHeader = setCookies.find((c) => c.startsWith(`${expectedCookieName}=`));
  expect(
    stateCookieHeader,
    `Expected Set-Cookie for ${expectedCookieName}, got: ${JSON.stringify(setCookies)}`,
  ).toBeDefined();

  const cookiePair = stateCookieHeader!.split(';')[0];
  expect(cookiePair).toBe(`${expectedCookieName}=${state}`);
  expect(stateCookieHeader).toMatch(/\bPath=\/(?:;|$)/i);
  expect(stateCookieHeader).toMatch(/\bMax-Age=600\b/i);
  expect(stateCookieHeader).toMatch(/\bSecure\b/i);
  expect(stateCookieHeader).toMatch(/\bHttpOnly\b/i);
  expect(stateCookieHeader).toMatch(/\bSameSite=None\b/i);
  expect(stateCookieHeader).toMatch(/\bPartitioned\b/i);

  return { state, nonce, cookiePair };
}

describe('LA-E3-01 K1-SIM: Platform storage login regression (AP-05-01; K1-LAUNCH L10)', () => {
  let key = '';
  let qaPlatform: QaPlatform;
  const createdPlatformIds: string[] = [];

  beforeAll(async () => {
    key = apiKey(ACCOUNT);
    qaPlatform = await setupQaPlatform(key, `e301-${runId}`);
    createdPlatformIds.push(qaPlatform.platformId);
  });

  afterAll(async () => {
    for (const id of createdPlatformIds.splice(0)) {
      await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(id)}`, {
        authorization: auth.bearer(key),
      }).catch(() => undefined);
    }
  });

  it('AC-LA-E3-01-10: Moodle-shaped (standard) profile login gives the same 302, Location and Set-Cookie as before LA, with or without lti_storage_target (AP-05-01)', async () => {
    const baseFields: Record<string, string> = {
      iss: QA_ISSUER,
      login_hint: 'qa-user-1',
      target_link_uri: `${LAUNCH_URL}?resource=qa-e301`,
      client_id: qaPlatform.clientId,
      lti_deployment_id: QA_DEPLOYMENT,
      lti_message_hint: 'qa-hint-e301',
    };

    const variants: Array<{
      label: string;
      method: 'GET' | 'POST';
      extra: Record<string, string>;
    }> = [
      { label: 'POST without lti_storage_target', method: 'POST', extra: {} },
      {
        label: 'POST with lti_storage_target=post_message_forwarding',
        method: 'POST',
        extra: { lti_storage_target: 'post_message_forwarding' },
      },
      {
        label: 'GET with lti_storage_target=_parent',
        method: 'GET',
        extra: { lti_storage_target: '_parent' },
      },
      {
        label: 'POST with invalid lti_storage_target (65 chars)',
        method: 'POST',
        extra: { lti_storage_target: 'a'.repeat(65) },
      },
    ];

    let lastLogin: { state: string; nonce: string; cookiePair: string } | null = null;

    for (const v of variants) {
      const params = new URLSearchParams({ ...baseFields, ...v.extra }).toString();
      const res =
        v.method === 'GET'
          ? await httpsRequest(`${LOGIN_URL}?${params}`)
          : await httpsRequest(LOGIN_URL, {
              method: 'POST',
              headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'content-length': String(Buffer.byteLength(params)),
              },
              body: params,
            });

      const parsed = assertBaseline302Login(res, {
        authEndpoint: `${QA_ISSUER}/auth`,
        clientId: qaPlatform.clientId,
        loginHint: 'qa-user-1',
        messageHint: 'qa-hint-e301',
      });
      if (v.label === 'POST with lti_storage_target=post_message_forwarding') {
        lastLogin = parsed;
      }
    }

    // Complete the launch for the login that sent lti_storage_target=post_message_forwarding on standard:
    // proves the state row has storage_target=NULL / storage_origin=NULL and completes via state cookie -> 303 ltik.
    expect(lastLogin).not.toBeNull();
    const idToken = await signRs256(
      resourceLinkClaims(qaPlatform, {
        status: 302,
        location: `${QA_ISSUER}/auth`,
        state: lastLogin!.state,
        nonce: lastLogin!.nonce,
        cookie: lastLogin!.cookiePair,
        targetLinkUri: `${LAUNCH_URL}?resource=qa-e301`,
        traceId: '',
        body: '',
      }),
      qaPlatform.privateKey,
      qaPlatform.kid,
    );
    const launchRes = await postLaunch(
      { id_token: idToken, state: lastLogin!.state },
      lastLogin!.cookiePair,
    );
    expect(launchRes.status, launchRes.body.slice(0, 200)).toBe(303);
    const ltik = new URL(launchRes.location).searchParams.get('ltik') ?? '';
    expect(ltik).not.toBe('');
    recordSecret('ltik', ltik);
  });
});
