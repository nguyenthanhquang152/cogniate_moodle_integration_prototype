// LA-E1-05 K1-SIM acceptance tests:
// - AC-LA-E1-05-01: Golden G1 GET /api/providers equals the baseline in values and order.
// - AC-LA-E1-05-07: LTI service starts and serves a Moodle-shaped launch with PUBLIC_MOODLE_URL absent, and /healthz equals golden G1 under the LA-IC-16 rule (LA-IC-02, LA-IC-16 / BD-A1-36).
// - AC-LA-E1-05-08: Stored claims of Canvas and Blackboard simulator launches equal golden G2 / privacyFloor 'allowlist'; Moodle-shaped launch keeps every claim ('none').
// - AC-LA-E1-05-09: Golden compare G1-G4 equals the baseline with 0 unexplained differences (under LA-IC-16).
// Source: docs/architecture/ltiaas/tasks/LA-E1-05.md; LA-ADR-01 D4, D6; LA-ADR-04 D1 S3, D8 (LA-IC-02, LA-IC-16); BD-A1-36; contracts/lti-service-api.md §3.1, §3.8, §9.6, §9.13.
// QA-4 wrote these tests from the spec, contracts and ADRs only (test-first).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLOUD, canvasLaunch, canvasPlatform } from '../../../acceptance/M1/canvas/canvas';
import {
  AGS,
  LTI,
  NRPS,
  admin,
  assert,
  deploymentPath,
  expectStatus,
  httpsRequest,
  idToken,
  launch,
  logEvents,
  records,
  sharedPlatform,
  unique,
  urls,
  type Json,
} from '../../../acceptance/M1/common/client';
import { apiKey } from '../../../acceptance/lib/lti';
import { artifactsDir } from '../../../acceptance/lib/paths';
import { qaLaunchLtik, resourceLinkClaims, setupQaPlatform } from '../../../acceptance/lib/qa-platform';
import {
  checkAcceptanceOutboundAllowlist,
  compareCaptures,
  diff,
  loadCapture,
  loadExpectedDelta,
  loadSimAllowlist,
} from '../../golden/lib/compare.mjs';
import { normalizeFile } from '../../golden/lib/normalize.mjs';
import {
  BASELINE_LMS,
  BASELINE_PROFILES,
  BASELINE_SIMULATION_PROFILES,
  checkProfiles,
  checkSimulationProfiles,
  sameBaselineFields,
} from '../../lib/open-world.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '../../../..');
const DEFAULT_GOLDEN_BASELINE = path.join(REPO_ROOT, 'tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6');

function loadGoldenFile(name: 'G1.json' | 'G2.json' | 'G3.json' | 'G4.json'): Json {
  const baselineDir = process.env.LA_GOLDEN_BASELINE ?? DEFAULT_GOLDEN_BASELINE;
  const file = path.join(baselineDir, name);
  expect(fs.existsSync(file), `Baseline golden file exists: ${file}`).toBe(true);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
}

function saveEvidence(name: string, payload: unknown): void {
  const outDir = process.env.LA_RUN_DIR ?? artifactsDir('acceptance');
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
}

function requireShas(): void {
  assert.match(process.env.QA_PRODUCT_SHA ?? '', /^[0-9a-f]{40}$/, 'Exact 40-hex QA_PRODUCT_SHA required for K1-SIM evidence');
  assert.match(process.env.QA_TEST_SHA ?? '', /^[0-9a-f]{40}$/, 'Exact 40-hex QA_TEST_SHA required for K1-SIM evidence');
}

describe('LA-E1-05 LTI profiles in channel folders (K1-SIM)', () => {
  it('[SIM] AC-LA-E1-05-01: GET /api/providers equals the G1 baseline in values and order {case:LA-E1-05-01}', async () => {
    requireShas();
    // Ensure the shared Blackboard simulation platform exists so sharedPlatform matches G1.acceptance.providers.
    await sharedPlatform();

    const res = await admin('GET', '/api/providers');
    expectStatus(res, 200);
    const profiles = res.json?.profiles as Json[];
    expect(Array.isArray(profiles), 'GET /api/providers returns profiles array').toBe(true);

    // 1. Validate against shared open-world helpers.
    const registered = new Set<string>(BASELINE_LMS);
    checkProfiles(profiles, BASELINE_PROFILES, { registered, label: 'GET /api/providers' });
    const simIds = profiles.filter((p) => p.simulation === true).map((p) => String(p.id));
    checkSimulationProfiles(simIds, BASELINE_SIMULATION_PROFILES, {
      profiles,
      registered,
      label: 'GET /api/providers simulation_profiles',
    });
    expect(
      profiles.slice(0, BASELINE_PROFILES.length).map((p) => p.id),
      'GET /api/providers profile order equals baseline',
    ).toEqual([
      'standard',
      'canvas-cloud-production',
      'canvas-cloud-beta',
      'canvas-cloud-test',
      'canvas-self-hosted',
      'blackboard',
      'blackboard-sim',
      'canvas-sim-cloud',
    ]);
    for (let i = 0; i < BASELINE_PROFILES.length; i++) {
      sameBaselineFields(profiles[i], BASELINE_PROFILES[i], `GET /api/providers profile[${i}] (${BASELINE_PROFILES[i].id})`);
    }

    // 2. Compare normalized GET /api/providers against G1.json baseline.
    const g1 = loadGoldenFile('G1.json');
    const expectedProviders = (g1.acceptance?.providers ?? g1.providers) as Json;
    const normalizedLive = normalizeFile({ providers: res.json }).data.providers as Json;
    const diffs = diff(expectedProviders, normalizedLive, 'acceptance.providers');
    expect(diffs, 'GET /api/providers has 0 golden diffs against G1.acceptance.providers').toEqual([]);

    saveEvidence('LA-E1-05-01-providers.json', {
      id: 'AC-LA-E1-05-01',
      productSha: process.env.QA_PRODUCT_SHA,
      testSha: process.env.QA_TEST_SHA,
      environment: 'K1-SIM',
      profileIds: profiles.map((p) => p.id),
      goldenDiffs: diffs.length,
    });
  });

  it('[SIM] AC-LA-E1-05-07: LTI service starts and serves a Moodle-shaped launch without PUBLIC_MOODLE_URL, and /healthz equals golden G1 under the LA-IC-16 rule (LA-IC-02, LA-IC-16) {case:LA-E1-05-07}', async () => {
    requireShas();
    const prevMoodleUrl = process.env.PUBLIC_MOODLE_URL;
    delete process.env.PUBLIC_MOODLE_URL;
    try {
      // 1. Check /healthz against golden G1.acceptance.ltiHealth under LA-IC-02 (MOODLE_HOST) and LA-IC-16 (tests/sim/hosts.json allowlist).
      const healthRes = await httpsRequest(`${urls.lti}/healthz`);
      expect(healthRes.status, 'GET /healthz returns 200').toBe(200);
      const healthJson = JSON.parse(healthRes.body) as Json;
      expect(healthJson.status).toBe('ok');
      expect(healthJson.service).toBe('lti-service');
      expect(healthJson.profile).toBe('acceptance');
      expect(healthJson.knobs).toEqual([]);
      expect(
        Array.isArray(healthJson.outbound_allowlist) && healthJson.outbound_allowlist.includes('moodle.test'),
        'outbound_allowlist still includes moodle.test from MOODLE_HOST (LA-IC-02)',
      ).toBe(true);

      const g1 = loadGoldenFile('G1.json');
      const expectedHealth = (g1.acceptance?.ltiHealth ?? g1.ltiHealth) as Json;
      const normalizedHealth = normalizeFile({ ltiHealth: healthJson }).data.ltiHealth as Json;
      const simHosts = loadSimAllowlist();

      const allowlistCheck = checkAcceptanceOutboundAllowlist(
        expectedHealth.outbound_allowlist,
        normalizedHealth.outbound_allowlist,
        simHosts,
      );
      expect(
        allowlistCheck.ok,
        `acceptance /healthz outbound_allowlist satisfies LA-IC-16 (${allowlistCheck.reason ?? 'ok'})`,
      ).toBe(true);

      const laIc16 = loadExpectedDelta('LA-IC-16');
      const healthCompare = compareCaptures(
        { G1: { acceptance: { ltiHealth: expectedHealth } } },
        { G1: { acceptance: { ltiHealth: normalizedHealth } } },
        [laIc16],
        { simHosts },
      );
      const unexplainedHealth = healthCompare.differences.filter((d) => !d.explainedBy);
      expect(
        unexplainedHealth,
        `/healthz equals golden G1.acceptance.ltiHealth under LA-IC-16: ${JSON.stringify(unexplainedHealth)}`,
      ).toEqual([]);

      const healthDiffs = diff(expectedHealth, normalizedHealth, 'acceptance.ltiHealth', [], { simHosts });
      expect(healthDiffs, '/healthz diff under LA-IC-16 rule is empty').toEqual([]);

      // 2. Register a standard platform on qa-platform.test and serve Moodle-shaped launches (family 'moodle' and omitted).
      const p = await setupQaPlatform(apiKey('cogniate'), unique('LA-E1-05-07-moodle'));
      for (const family of ['moodle', undefined] as const) {
        const ltik = await qaLaunchLtik(p, (login) => ({
          ...resourceLinkClaims(p, login),
          ...(family
            ? {
                [LTI + 'tool_platform']: {
                  product_family_code: family,
                  name: 'Moodle',
                  version: '5.2.4',
                },
              }
            : {}),
        }));
        const token = await idToken(ltik);
        expectStatus(token, 200);
        expect(token.json.platform.profile).toBe('standard');
        expect(token.json.platform.siteUrl).toBe('https://qa-platform.test');
        expect(token.json.platform.serviceUrl).toBe('https://qa-platform.test');
      }

      saveEvidence('LA-E1-05-07-moodle-launch-healthz.json', {
        id: 'AC-LA-E1-05-07',
        productSha: process.env.QA_PRODUCT_SHA,
        testSha: process.env.QA_TEST_SHA,
        environment: 'K1-SIM',
        healthz: healthJson,
        healthDiffs: healthDiffs.length,
        platformId: p.platformId,
      });
    } finally {
      if (prevMoodleUrl !== undefined) process.env.PUBLIC_MOODLE_URL = prevMoodleUrl;
    }
  });

  it('[SIM] AC-LA-E1-05-08: stored claims of Canvas and Blackboard simulator launches equal golden G2 (allowlist) and Moodle-shaped launch keeps every claim (none) {case:LA-E1-05-08}', async () => {
    requireShas();
    const g2 = loadGoldenFile('G2.json');

    // 1. Blackboard simulator launch (privacyFloor: 'allowlist').
    const bbPlatformId = await sharedPlatform();
    const bbDeploymentId = unique('e105-bb');
    expectStatus(
      await admin('POST', deploymentPath(bbPlatformId), {
        deploymentId: bbDeploymentId,
        siteUrl: 'https://learn-a.blackboard.sim.test',
      }),
      201,
    );
    const bbMarker = unique('BB-PII');
    const bbSince = Date.now();
    const bbStripped: Json = {
      name: bbMarker,
      given_name: bbMarker,
      family_name: bbMarker,
      email: bbMarker,
      picture: bbMarker,
      locale: bbMarker,
      [LTI + 'lis']: { person_sourcedid: bbMarker },
      [LTI + 'lti1p1']: { user_id: bbMarker },
      [LTI + 'custom']: { secret: bbMarker },
      'https://blackboard.com/lti/claim/one_time_session_token': bbMarker,
    };
    const bbLaunch = await launch({
      deploymentId: bbDeploymentId,
      claims: {
        ...bbStripped,
        [LTI + 'context']: { id: 'context-1', label: 'kept', extra: bbMarker },
        [LTI + 'resource_link']: { id: 'resource-1', title: 'kept', extra: bbMarker },
        [LTI + 'tool_platform']: { product_family_code: 'BlackboardLearn', contact_email: bbMarker, extra: bbMarker },
        [LTI + 'launch_presentation']: { document_target: 'window', extra: bbMarker },
      },
    });
    expect(bbLaunch.response.status, 'Blackboard simulator launch redirects (303)').toBe(303);

    // Check Blackboard OIDC parameters against G2.blackboard.oidc.
    const bbOidcUrl = new URL(bbLaunch.location);
    expect(`${bbOidcUrl.origin}${bbOidcUrl.pathname}`).toBe(g2.blackboard.oidc[1].endpoint);
    expect(bbOidcUrl.searchParams.get('client_id')).toBe('qa-bb-app');
    expect(bbOidcUrl.searchParams.get('prompt')).toBe('none');
    expect(bbOidcUrl.searchParams.get('response_mode')).toBe('form_post');
    expect(bbOidcUrl.searchParams.get('response_type')).toBe('id_token');
    expect(bbOidcUrl.searchParams.get('scope')).toBe('openid');

    const bbRaw = await idToken(bbLaunch.ltik, true);
    expectStatus(bbRaw, 200);
    expect(JSON.stringify(bbRaw.json).includes(bbMarker), 'Blackboard raw idtoken stores no stripped marker').toBe(false);
    const allowlistKeys = [
      'iss',
      'sub',
      'aud',
      'iat',
      'exp',
      'nonce',
      ...[
        'message_type',
        'version',
        'deployment_id',
        'target_link_uri',
        'roles',
        'context',
        'resource_link',
        'tool_platform',
        'launch_presentation',
      ].map((k) => LTI + k),
      AGS,
      NRPS,
    ].sort();
    expect(Object.keys(bbRaw.json).sort()).toEqual(allowlistKeys);
    expect(bbRaw.json[LTI + 'context']).toEqual({ id: 'context-1', label: 'kept' });
    expect(bbRaw.json[LTI + 'resource_link']).toEqual({ id: 'resource-1', title: 'kept' });
    expect(bbRaw.json[LTI + 'tool_platform']).toEqual({ product_family_code: 'BlackboardLearn' });
    expect(bbRaw.json[LTI + 'launch_presentation']).toEqual({ document_target: 'window' });

    const bbNorm = await idToken(bbLaunch.ltik, false);
    expectStatus(bbNorm, 200);
    expect(bbNorm.json.user.name).toBeUndefined();
    expect(bbNorm.json.user.email).toBeUndefined();
    expect(bbNorm.json.launch.custom).toEqual({});
    expect(bbNorm.json.platform.profile).toBe('blackboard-sim');
    const bbMinLogs = logEvents('launch_claims_minimized', bbSince, { platform_id: bbPlatformId }, 'lti-service');
    expect(bbMinLogs.length).toBe(1);
    expect(JSON.stringify(bbMinLogs).includes(bbMarker)).toBe(false);
    expect(bbMinLogs[0].claims).toEqual(
      [
        ...Object.keys(bbStripped),
        `${LTI}context#extra`,
        `${LTI}resource_link#extra`,
        `${LTI}tool_platform#contact_email`,
        `${LTI}tool_platform#extra`,
        `${LTI}launch_presentation#extra`,
      ].sort(),
    );

    // 2. Canvas simulator launch (privacyFloor: 'allowlist').
    const cvCursor = (await records()).cursor;
    const cvPlatform = await canvasPlatform();
    const cvMarker = unique('CV-PII');
    const cvSince = Date.now();
    const cvStripped: Json = {
      name: cvMarker,
      given_name: cvMarker,
      family_name: cvMarker,
      email: cvMarker,
      picture: cvMarker,
      locale: cvMarker,
      [LTI + 'lis']: { person_sourcedid: cvMarker },
      [LTI + 'lti1p1']: { user_id: cvMarker },
      [LTI + 'custom']: { canvas_user_login_id: cvMarker },
      [LTI + 'lti11_legacy_user_id']: cvMarker,
      'https://www.instructure.com/placement': 'assignment_selection',
      'https://purl.imsglobal.org/spec/lti/claim/role_scope_mentor': [cvMarker],
    };
    const cvLaunch = await canvasLaunch(cvPlatform, {
      claims: {
        ...cvStripped,
        [LTI + 'context']: {
          id: 'context-1',
          label: 'kept',
          title: 'Course',
          type: ['http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering'],
          extra: cvMarker,
        },
        [LTI + 'resource_link']: { id: 'resource-1', title: 'kept', description: 'kept', extra: cvMarker },
        [LTI + 'tool_platform']: {
          guid: 'guid-1',
          name: 'Canvas',
          version: 'cloud',
          product_family_code: 'canvas',
          contact_email: cvMarker,
          extra: cvMarker,
        },
        [LTI + 'launch_presentation']: {
          document_target: 'iframe',
          return_url: `${CLOUD.siteA}/courses/1`,
          locale: 'en',
          extra: cvMarker,
        },
      },
    });
    expect(cvLaunch.response.status, 'Canvas simulator launch redirects (303)').toBe(303);

    // Check Canvas OIDC parameters and simulator records against G2.canvas.
    const cvOidcUrl = new URL(cvLaunch.location);
    expect(`${cvOidcUrl.origin}${cvOidcUrl.pathname}`).toBe(g2.canvas.oidc[1].endpoint);
    expect(cvOidcUrl.searchParams.get('client_id')).toBe(cvPlatform.clientId);
    expect(cvOidcUrl.searchParams.get('prompt')).toBe('none');
    expect(cvOidcUrl.searchParams.get('response_mode')).toBe('form_post');
    expect(cvOidcUrl.searchParams.get('response_type')).toBe('id_token');
    expect(cvOidcUrl.searchParams.get('scope')).toBe('openid');
    const cvSimRecords = (await records(cvCursor)).records;
    const cvOidcRecord = cvSimRecords.filter((r) => r.kind === 'canvas-oidc').at(-1);
    expect(cvOidcRecord?.missing, 'Canvas simulator OIDC record has no missing params').toEqual([]);

    const cvRaw = await idToken(cvLaunch.ltik, true);
    expectStatus(cvRaw, 200);
    expect(JSON.stringify(cvRaw.json).includes(cvMarker), 'Canvas raw idtoken stores no stripped marker').toBe(false);
    expect(Object.keys(cvRaw.json).sort()).toEqual(allowlistKeys);
    expect(cvRaw.json[LTI + 'context']).toEqual({
      id: 'context-1',
      label: 'kept',
      title: 'Course',
      type: ['http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering'],
    });
    expect(cvRaw.json[LTI + 'resource_link']).toEqual({ id: 'resource-1', title: 'kept', description: 'kept' });
    expect(cvRaw.json[LTI + 'tool_platform']).toEqual({
      guid: 'guid-1',
      name: 'Canvas',
      version: 'cloud',
      product_family_code: 'canvas',
    });
    expect(cvRaw.json[LTI + 'launch_presentation']).toEqual({
      document_target: 'iframe',
      return_url: `${CLOUD.siteA}/courses/1`,
      locale: 'en',
    });

    const cvNorm = await idToken(cvLaunch.ltik, false);
    expectStatus(cvNorm, 200);
    expect(cvNorm.json.user?.name).toBeUndefined();
    expect(cvNorm.json.user?.email).toBeUndefined();
    expect(cvNorm.json.launch.custom).toEqual({});
    expect(cvNorm.json.platform.profile).toBe('canvas-sim-cloud');
    const cvMinLogs = logEvents('launch_claims_minimized', cvSince, { platform_id: cvPlatform.platformId }, 'lti-service');
    expect(cvMinLogs.length).toBe(1);
    expect(JSON.stringify(cvMinLogs).includes(cvMarker)).toBe(false);
    expect(cvMinLogs[0].claims).toEqual(
      [
        ...Object.keys(cvStripped),
        `${LTI}context#extra`,
        `${LTI}resource_link#extra`,
        `${LTI}tool_platform#contact_email`,
        `${LTI}tool_platform#extra`,
        `${LTI}launch_presentation#extra`,
      ].sort(),
    );

    // 3. Moodle-shaped launch on standard profile (privacyFloor: 'none'): keeps every claim.
    const moodlePlatform = await setupQaPlatform(apiKey('cogniate'), unique('LA-E1-05-08-moodle'));
    const moodleKeepMarker = unique('MOODLE-KEEP');
    const moodleSince = Date.now();
    const moodleLtik = await qaLaunchLtik(moodlePlatform, (login) => ({
      ...resourceLinkClaims(moodlePlatform, login),
      name: 'QA Moodle Full Name',
      given_name: 'QA',
      family_name: 'Moodle',
      email: 'moodle.learner@example.invalid',
      picture: 'https://qa-platform.test/avatar.png',
      locale: 'en',
      [LTI + 'lis']: { person_sourcedid: moodleKeepMarker, course_section_sourcedid: 'sec-1' },
      [LTI + 'lti1p1']: { user_id: 'legacy-moodle-user-1' },
      [LTI + 'custom']: { moodle_course_id: '42', custom_keep: moodleKeepMarker },
      [LTI + 'context']: { id: 'qa-ctx-1', label: 'QA', title: 'QA context', extra: moodleKeepMarker },
      [LTI + 'resource_link']: { id: 'qa-rl-1', title: 'QA resource link', extra: moodleKeepMarker },
      [LTI + 'tool_platform']: {
        product_family_code: 'moodle',
        name: 'Moodle',
        contact_email: 'admin@example.invalid',
        extra: moodleKeepMarker,
      },
      [LTI + 'launch_presentation']: { document_target: 'window', extra: moodleKeepMarker },
    }));

    const moodleRaw = await idToken(moodleLtik, true);
    expectStatus(moodleRaw, 200);
    expect(moodleRaw.json.name).toBe('QA Moodle Full Name');
    expect(moodleRaw.json.given_name).toBe('QA');
    expect(moodleRaw.json.family_name).toBe('Moodle');
    expect(moodleRaw.json.email).toBe('moodle.learner@example.invalid');
    expect(moodleRaw.json.picture).toBe('https://qa-platform.test/avatar.png');
    expect(moodleRaw.json.locale).toBe('en');
    expect(moodleRaw.json[LTI + 'lis']).toEqual({ person_sourcedid: moodleKeepMarker, course_section_sourcedid: 'sec-1' });
    expect(moodleRaw.json[LTI + 'lti1p1']).toEqual({ user_id: 'legacy-moodle-user-1' });
    expect(moodleRaw.json[LTI + 'custom']).toEqual({ moodle_course_id: '42', custom_keep: moodleKeepMarker });
    expect(moodleRaw.json[LTI + 'context']?.extra).toBe(moodleKeepMarker);
    expect(moodleRaw.json[LTI + 'resource_link']?.extra).toBe(moodleKeepMarker);
    expect(moodleRaw.json[LTI + 'tool_platform']?.contact_email).toBe('admin@example.invalid');
    expect(moodleRaw.json[LTI + 'tool_platform']?.extra).toBe(moodleKeepMarker);
    expect(moodleRaw.json[LTI + 'launch_presentation']?.extra).toBe(moodleKeepMarker);

    const moodleNorm = await idToken(moodleLtik, false);
    expectStatus(moodleNorm, 200);
    expect(moodleNorm.json.user.name).toBe('QA Moodle Full Name');
    expect(moodleNorm.json.user.email).toBe('moodle.learner@example.invalid');
    expect(moodleNorm.json.launch.custom).toEqual({ moodle_course_id: '42', custom_keep: moodleKeepMarker });
    expect(moodleNorm.json.platform.profile).toBe('standard');
    expect(
      logEvents('launch_claims_minimized', moodleSince, { platform_id: moodlePlatform.platformId }, 'lti-service'),
      'standard profile (privacyFloor none) never emits launch_claims_minimized',
    ).toEqual([]);

    saveEvidence('LA-E1-05-08-claims.json', {
      id: 'AC-LA-E1-05-08',
      productSha: process.env.QA_PRODUCT_SHA,
      testSha: process.env.QA_TEST_SHA,
      environment: 'K1-SIM',
      blackboardRawKeys: Object.keys(bbRaw.json).sort(),
      canvasRawKeys: Object.keys(cvRaw.json).sort(),
      moodleRawKeys: Object.keys(moodleRaw.json).sort(),
    });
  });

  it('[SIM] AC-LA-E1-05-09: golden compare has 0 unexplained differences {case:LA-E1-05-09}', async () => {
    const baselineDir = process.env.LA_GOLDEN_BASELINE ?? DEFAULT_GOLDEN_BASELINE;
    const captureDir = process.env.LA_GOLDEN_CAPTURE;
    const simHosts = loadSimAllowlist();
    const laIc16 = loadExpectedDelta('LA-IC-16');
    if (captureDir) {
      const report = compareCaptures(loadCapture(baselineDir), loadCapture(captureDir), [laIc16], { simHosts });
      const unexplained = report.differences.filter((d: { explainedBy: string | null }) => !d.explainedBy);
      saveEvidence('LA-E1-05-09-golden-compare.json', report);
      expect(unexplained, `Golden compare unexplained diffs: ${JSON.stringify(unexplained)}`).toEqual([]);
      return;
    }

    // In-container live check of the LTI golden G1 sections when LA_GOLDEN_CAPTURE is not set.
    requireShas();
    await sharedPlatform();
    const providersRes = await admin('GET', '/api/providers');
    expectStatus(providersRes, 200);
    const healthRes = await httpsRequest(`${urls.lti}/healthz`);
    expect(healthRes.status).toBe(200);

    const g1 = loadGoldenFile('G1.json');
    const liveNorm = normalizeFile({
      providers: providersRes.json,
      ltiHealth: JSON.parse(healthRes.body),
    }).data as Json;
    const diffs = [
      ...diff(g1.acceptance?.providers ?? g1.providers, liveNorm.providers, 'acceptance.providers', [], { simHosts }),
      ...diff(g1.acceptance?.ltiHealth ?? g1.ltiHealth, liveNorm.ltiHealth, 'acceptance.ltiHealth', [], { simHosts }),
    ];
    saveEvidence('LA-E1-05-09-golden-live-g1.json', {
      id: 'AC-LA-E1-05-09',
      productSha: process.env.QA_PRODUCT_SHA,
      testSha: process.env.QA_TEST_SHA,
      environment: 'K1-SIM',
      diffs,
    });
    expect(diffs, 'Live LTI G1 sections match baseline golden under LA-IC-16 with 0 diffs').toEqual([]);
  });
});
