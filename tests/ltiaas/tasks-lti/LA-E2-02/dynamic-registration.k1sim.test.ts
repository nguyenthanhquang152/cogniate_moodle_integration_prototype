// LA-E2-02 K1-SIM suite: E2-K Generic Dynamic Registration fixes and staged registration.
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E2-02.md (AC-LA-E2-02-02 .. AC-LA-E2-02-07, AC-LA-E2-02-09)
// - docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md D2a, D5 (items 1-8, 10)
// - docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md D8 LA-IC-03
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §2.4, §4.5
// - docs/architecture/ltiaas/build-decisions-A1.md (BD-A1-84, BD-A1-87, BD-A1-88, BD-A1-89)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { publicUrls } from '../../../acceptance/lib/env';
import { httpsRequest } from '../../../acceptance/lib/https';
import {
  ACCOUNT,
  apiKey,
  auth,
  errorCode,
  hasErrorShape,
  LAUNCH_URL,
  LOGIN_URL,
  ltiApi,
  recordSecret,
} from '../../../acceptance/lib/lti';
import { QA_FIXTURE_DIR, QA_ISSUER } from '../../../acceptance/lib/qa-platform';

const urls = publicUrls();
const runId = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

const FIVE_ADR009_SCOPES = [
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
] as const;

interface QaOpenIdFixtureOptions {
  label: string;
  issuerPath?: string;
  configSubpath?: string;
  tokenEndpoint?: string;
  jwksEndpoint?: string;
  authorizationEndpoint?: string;
  registrationEndpoint?: string;
  authorizationServer?: string;
  productFamilyCode?: string;
  messagesSupported?: Array<{ type: string; placements?: string[] }>;
  scopesSupported?: string[];
  tokenKind?: 'scope-jwt' | 'opaque-bearer';
}

async function writeQaOpenIdFixture(opts: QaOpenIdFixtureOptions): Promise<{
  id: string;
  issuer: string;
  configUrl: string;
  regToken: string;
  cleanup: () => void;
}> {
  const id = `${opts.label}-${runId}-${crypto.randomBytes(2).toString('hex')}`;
  const kid = `qa-e202-${id}`;
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };

  const issuerPath = opts.issuerPath ?? `/${id}`;
  const issuer = `${QA_ISSUER}${issuerPath}`;
  const configSubpath = opts.configSubpath ?? '/mod/lti/openid-configuration.php';
  const relConfigPath = `${issuerPath}${configSubpath}`.replace(/^\/+/, '');
  const absConfigPath = path.join(QA_FIXTURE_DIR, relConfigPath);
  fs.mkdirSync(path.dirname(absConfigPath), { recursive: true });

  const jwksFile = `jwks-${id}.json`;
  fs.writeFileSync(path.join(QA_FIXTURE_DIR, jwksFile), JSON.stringify({ keys: [publicJwk] }));

  const openIdDoc: Record<string, unknown> = {
    issuer,
    authorization_endpoint: opts.authorizationEndpoint ?? `${QA_ISSUER}/auth`,
    token_endpoint: opts.tokenEndpoint ?? `${QA_ISSUER}/token`,
    jwks_uri: opts.jwksEndpoint ?? `${QA_ISSUER}/${jwksFile}`,
    registration_endpoint: opts.registrationEndpoint ?? `${QA_ISSUER}/register`,
    scopes_supported: opts.scopesSupported ?? ['openid', ...FIVE_ADR009_SCOPES],
    response_types_supported: ['id_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    claims_supported: ['iss', 'sub'],
    ...(opts.authorizationServer ? { authorization_server: opts.authorizationServer } : {}),
    'https://purl.imsglobal.org/spec/lti-platform-configuration': {
      product_family_code: opts.productFamilyCode ?? 'moodle',
      version: '5.2.4',
      messages_supported: opts.messagesSupported ?? [
        { type: 'LtiResourceLinkRequest' },
        { type: 'LtiDeepLinkingRequest', placements: ['ContentArea'] },
      ],
    },
  };
  fs.writeFileSync(absConfigPath, JSON.stringify(openIdDoc));

  let regToken: string;
  if (opts.tokenKind === 'opaque-bearer') {
    regToken = `opaque-token-${id}`;
  } else {
    const now = Math.floor(Date.now() / 1000);
    regToken = await new SignJWT({ sub: '0', scope: 'reg-create', iat: now, exp: now + 600 })
      .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
      .sign(privateKey);
  }
  recordSecret('id_token', regToken);

  return {
    id,
    issuer,
    configUrl: `${QA_ISSUER}/${relConfigPath}`,
    regToken,
    cleanup: () => {
      fs.rmSync(path.join(QA_FIXTURE_DIR, jwksFile), { force: true });
      const topSegment = relConfigPath.split('/')[0];
      if (topSegment) {
        fs.rmSync(path.join(QA_FIXTURE_DIR, topSegment), { recursive: true, force: true });
      }
    },
  };
}

describe('LA-E2-02 K1-SIM: E2-K Generic Dynamic Registration fixes and staged registration', () => {
  let key = '';
  const cleanups: Array<() => void> = [];
  const createdPlatformIds: string[] = [];

  beforeAll(() => {
    key = apiKey(ACCOUNT);
  });

  afterAll(async () => {
    for (const fn of cleanups.splice(0)) {
      try {
        fn();
      } catch {
        // ignore cleanup error
      }
    }
    for (const id of createdPlatformIds.splice(0)) {
      await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(id)}`, {
        authorization: auth.bearer(key),
      }).catch(() => undefined);
    }
  });

  it('[SIM] AC-LA-E2-02-04: configuration endpoint whose host is a fixed host of Canvas or Blackboard simulator profile gives PLATFORM_URL_NOT_IN_PROFILE and sends nothing to that host {case:LA-E2-02-04}', async () => {
    const fixture = await writeQaOpenIdFixture({
      label: 'ac04-fixed-host',
      tokenEndpoint: 'https://sso.canvas.sim.test/login/oauth2/token',
      productFamilyCode: 'sakai',
      tokenKind: 'opaque-bearer',
    });
    cleanups.push(fixture.cleanup);

    const startUrl = `${urls.lti}/lti/register/${ACCOUNT}?openid_configuration=${encodeURIComponent(fixture.configUrl)}&registration_token=${encodeURIComponent(fixture.regToken)}`;
    const startRes = await httpsRequest(startUrl);
    // Refused either at start page (400 page with PLATFORM_URL_NOT_IN_PROFILE / INVALID_OPENID_CONFIGURATION) or at complete
    if (startRes.status === 303) {
      const regId = new URL(String(startRes.headers.location ?? '')).searchParams.get('registrationId') ?? '';
      expect(regId).not.toBe('');
      const completeRes = await ltiApi('POST', `/api/registrations/${encodeURIComponent(regId)}/complete`, {
        authorization: auth.bearer(key),
        body: {
          platformName: `QA4 E2-02 fixed-host ${runId}`,
          bindingRef: `bref-${fixture.id}`,
        },
      });
      expect(completeRes.status).toBe(400);
      expect(errorCode(completeRes)).toBe('PLATFORM_URL_NOT_IN_PROFILE');
    } else {
      expect(startRes.status).toBe(400);
      expect(
        startRes.body.includes('PLATFORM_URL_NOT_IN_PROFILE') ||
          startRes.body.includes('INVALID_OPENID_CONFIGURATION'),
      ).toBe(true);
    }
  });

  it('[SIM] AC-LA-E2-02-05: capability checks refuse guarded product_family_code (PROVIDER_PROFILE_MISMATCH), missing LtiDeepLinkingRequest, and missing channel scope with no registration request {case:LA-E2-02-05}', async () => {
    // (1) Guarded family ('canvas') -> 400 PROVIDER_PROFILE_MISMATCH ("This is a Canvas site. Connect it as Canvas.")
    const canvasFam = await writeQaOpenIdFixture({
      label: 'ac05-family',
      productFamilyCode: 'canvas',
    });
    cleanups.push(canvasFam.cleanup);
    const famStart = await httpsRequest(
      `${urls.lti}/lti/register/${ACCOUNT}?openid_configuration=${encodeURIComponent(canvasFam.configUrl)}&registration_token=${encodeURIComponent(canvasFam.regToken)}`,
    );
    expect(famStart.status).toBe(400);
    expect(famStart.body).toContain('PROVIDER_PROFILE_MISMATCH');
    expect(famStart.body).toContain('This is a Canvas site. Connect it as Canvas.');

    // (2) Missing LtiDeepLinkingRequest in messages_supported -> refused
    const noDl = await writeQaOpenIdFixture({
      label: 'ac05-nodl',
      messagesSupported: [{ type: 'LtiResourceLinkRequest' }],
    });
    cleanups.push(noDl.cleanup);
    const noDlStart = await httpsRequest(
      `${urls.lti}/lti/register/${ACCOUNT}?openid_configuration=${encodeURIComponent(noDl.configUrl)}&registration_token=${encodeURIComponent(noDl.regToken)}`,
    );
    expect(noDlStart.status).toBe(400);
    expect(noDlStart.body).toContain('INVALID_OPENID_CONFIGURATION');

    // (3) Missing channel scope in scopes_supported -> 400 INVALID_REQUEST (field scopes) at complete
    const missingScope = await writeQaOpenIdFixture({
      label: 'ac05-scope',
      scopesSupported: ['openid', FIVE_ADR009_SCOPES[0]],
    });
    cleanups.push(missingScope.cleanup);
    const scopeStart = await httpsRequest(
      `${urls.lti}/lti/register/${ACCOUNT}?openid_configuration=${encodeURIComponent(missingScope.configUrl)}&registration_token=${encodeURIComponent(missingScope.regToken)}`,
    );
    expect(scopeStart.status).toBe(303);
    const regId = new URL(String(scopeStart.headers.location ?? '')).searchParams.get('registrationId') ?? '';
    expect(regId).not.toBe('');

    const completeRes = await ltiApi('POST', `/api/registrations/${encodeURIComponent(regId)}/complete`, {
      authorization: auth.bearer(key),
      body: {
        platformName: `QA4 E2-02 missing-scope ${runId}`,
        scopes: [...FIVE_ADR009_SCOPES],
      },
    });
    expect(completeRes.status).toBe(400);
    expect(hasErrorShape(completeRes)).toBe(true);
    expect(errorCode(completeRes)).toBe('INVALID_REQUEST');
  });

  it('[SIM] AC-LA-E2-02-07 & AC-LA-E2-02-09: LA-IC-03 Moodle-shaped issuer with path accepts issuer + /mod/lti/openid-configuration.php with endpointsOnIssuerOrigin: true, and refuses another path on the same site {case:LA-E2-02-07}', async () => {
    // 1. Valid path: issuer + /mod/lti/openid-configuration.php starts session with endpointsOnIssuerOrigin: true
    const validPath = await writeQaOpenIdFixture({
      label: 'ac07-ok',
      issuerPath: `/moodle-subdir-${runId}`,
      configSubpath: '/mod/lti/openid-configuration.php',
    });
    cleanups.push(validPath.cleanup);

    const okStart = await httpsRequest(
      `${urls.lti}/lti/register/${ACCOUNT}?openid_configuration=${encodeURIComponent(validPath.configUrl)}&registration_token=${encodeURIComponent(validPath.regToken)}`,
    );
    expect(okStart.status, okStart.body.slice(0, 300)).toBe(303);
    const okRegId = new URL(String(okStart.headers.location ?? '')).searchParams.get('registrationId') ?? '';
    expect(okRegId).not.toBe('');

    const regView = await ltiApi<{ endpointsOnIssuerOrigin?: boolean }>(
      'GET',
      `/api/registrations/${encodeURIComponent(okRegId)}`,
      { authorization: auth.bearer(key) },
    );
    expect(regView.status).toBe(200);
    expect(regView.json?.endpointsOnIssuerOrigin).toBe(true);

    // 2. Wrong path on the same site (/other/openid.json) is refused for standard profile
    const wrongPath = await writeQaOpenIdFixture({
      label: 'ac07-badpath',
      issuerPath: `/moodle-wrong-${runId}`,
      configSubpath: '/other/openid.json',
    });
    cleanups.push(wrongPath.cleanup);

    const badStart = await httpsRequest(
      `${urls.lti}/lti/register/${ACCOUNT}?openid_configuration=${encodeURIComponent(wrongPath.configUrl)}&registration_token=${encodeURIComponent(wrongPath.regToken)}`,
    );
    if (badStart.status === 303) {
      const badRegId = new URL(String(badStart.headers.location ?? '')).searchParams.get('registrationId') ?? '';
      const badComplete = await ltiApi('POST', `/api/registrations/${encodeURIComponent(badRegId)}/complete`, {
        authorization: auth.bearer(key),
        body: {
          platformName: `QA4 E2-02 wrong-path ${runId}`,
          profile: 'standard',
        },
      });
      expect(badComplete.status).toBeGreaterThanOrEqual(400);
    } else {
      expect(badStart.status).toBe(400);
    }
  });

  it('[SIM] AC-LA-E2-02-02, AC-LA-E2-02-03 & AC-LA-E2-02-06: broken I-SELF (foreign authorization_server) sets endpointsOnIssuerOrigin: false and stages inactive platform that refuses learner login with PLATFORM_NOT_ACTIVE {case:LA-E2-02-03}', async () => {
    const foreignAud = await writeQaOpenIdFixture({
      label: 'ac03-foreign-aud',
      authorizationServer: 'https://auth.external-lms.example.edu/token',
      productFamilyCode: 'sakai',
      tokenKind: 'opaque-bearer',
    });
    cleanups.push(foreignAud.cleanup);

    const startRes = await httpsRequest(
      `${urls.lti}/lti/register/${ACCOUNT}?openid_configuration=${encodeURIComponent(foreignAud.configUrl)}&registration_token=${encodeURIComponent(foreignAud.regToken)}`,
    );
    if (startRes.status === 303) {
      const regId = new URL(String(startRes.headers.location ?? '')).searchParams.get('registrationId') ?? '';
      expect(regId).not.toBe('');

      const regView = await ltiApi<{ endpointsOnIssuerOrigin?: boolean }>(
        'GET',
        `/api/registrations/${encodeURIComponent(regId)}`,
        { authorization: auth.bearer(key) },
      );
      expect(regView.status).toBe(200);
      expect(regView.json?.endpointsOnIssuerOrigin).toBe(false);
    }

    // Verify that an inactive staged platform refuses OIDC login with 403 PLATFORM_NOT_ACTIVE (Q-LAD-24)
    const stagedId = `staged-${runId}`;
    const createStaged = await ltiApi<{ id?: string; active?: boolean }>('POST', '/api/platforms', {
      authorization: auth.bearer(key),
      body: {
        profile: 'standard',
        name: `QA4 E2-02 staged ${stagedId}`,
        url: `${QA_ISSUER}/${stagedId}`,
        clientId: `client-${stagedId}`,
        authenticationEndpoint: `${QA_ISSUER}/auth`,
        accesstokenEndpoint: `${QA_ISSUER}/token`,
        authConfig: { method: 'JWK_SET', key: `${QA_ISSUER}/jwks.json` },
        deploymentIds: ['1'],
        active: false,
        bindingRef: `bref-${stagedId}`,
      },
    });
    expect(createStaged.status).toBe(201);
    expect(createStaged.json?.active).toBe(false);
    const platformId = String(createStaged.json?.id ?? '');
    createdPlatformIds.push(platformId);

    const loginBody = new URLSearchParams({
      iss: `${QA_ISSUER}/${stagedId}`,
      login_hint: 'learner-1',
      target_link_uri: LAUNCH_URL,
      client_id: `client-${stagedId}`,
      lti_deployment_id: '1',
    }).toString();
    const loginRes = await httpsRequest(LOGIN_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': String(Buffer.byteLength(loginBody)),
      },
      body: loginBody,
    });
    expect(loginRes.status).toBe(403);
    expect(loginRes.body).toContain('PLATFORM_NOT_ACTIVE');
  });
});
