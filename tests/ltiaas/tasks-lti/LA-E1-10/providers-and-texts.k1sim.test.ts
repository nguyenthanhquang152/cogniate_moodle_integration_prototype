// LA-E1-10 K1-SIM acceptance tests:
// - AC-LA-E1-10-01: GET /api/providers gives every profile a channel (standard -> moodle, Canvas -> canvas,
//   Blackboard -> blackboard, simulation profiles -> their channel) and every other field equals the golden,
//   lms included (standard -> null) (LA-IC-01 expected delta).
// - AC-LA-E1-10-02: R1 runtime path of S3 (admin-value create plan vs fixed provider plan on POST /api/platforms,
//   plus M1 sim phase and M2 baseline results per test id).
// - AC-LA-E1-10-04: Golden G4: every LTI service error page and the Moodle registration pages equal the baseline byte for byte.
// Source: docs/architecture/ltiaas/tasks/LA-E1-10.md; lti-service-api-delta.md §4.7; LA-ADR-01 D6, D12; LA-ADR-04 D1 S3/S7, D8 LA-IC-01.
// QA-4 wrote these tests from the spec, contracts and ADRs only (test-first).
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BASELINE_LMS,
  BASELINE_PROFILES,
  BASELINE_REAL_PROFILES,
  BASELINE_SIMULATION_PROFILES,
  checkProfiles,
  checkSimulationProfiles,
  sameBaselineFields,
} from '../../lib/open-world.mjs';
import { compareCaptures, diff, loadCapture, loadExpectedDelta } from '../../golden/lib/compare.mjs';
import { apiKey as ltiSeedApiKey } from '../../../acceptance/lib/lti';
import { sharedPlatform } from '../../../acceptance/M1/common/client';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '../../../..');
const GBASE_DIR = path.join(REPO_ROOT, 'tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6');

const EXPECTED_CHANNEL_BY_PROFILE: Record<string, string> = {
  standard: 'moodle',
  'canvas-cloud-production': 'canvas',
  'canvas-cloud-beta': 'canvas',
  'canvas-cloud-test': 'canvas',
  'canvas-self-hosted': 'canvas',
  blackboard: 'blackboard',
  'blackboard-sim': 'blackboard',
  'canvas-sim-cloud': 'canvas',
};

interface GoldenG1 {
  acceptance: {
    providers: { profiles: Array<Record<string, unknown> & { id: string }> };
  };
  default: {
    providers: { profiles: Array<Record<string, unknown> & { id: string }> };
  };
}

interface GoldenPage {
  action: string | null;
  errorCode: string | null;
  location: string | null;
  status: number;
  text: string;
}

interface GoldenG4 {
  blackboard: { pages: Record<string, GoldenPage> };
  canvas: { pages: Record<string, GoldenPage> };
  common: { pages: Record<string, GoldenPage> };
}

function readGbaseG1(): GoldenG1 {
  return JSON.parse(fs.readFileSync(path.join(GBASE_DIR, 'G1.json'), 'utf8')) as GoldenG1;
}

function readGbaseG4(): GoldenG4 {
  return JSON.parse(fs.readFileSync(path.join(GBASE_DIR, 'G4.json'), 'utf8')) as GoldenG4;
}

function writeArtifact(name: string, content: string): void {
  const runDir = process.env.LA_RUN_DIR;
  if (!runDir) return;
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(runDir, name), content, { mode: 0o600 });
}

function resolveCaCert(): Buffer | undefined {
  const candidates = [
    process.env.CA_FILE,
    process.env.NODE_EXTRA_CA_CERTS,
    path.join(REPO_ROOT, 'infra/certs/ca.crt'),
    path.join(REPO_ROOT, 'infra/.certs/ca.crt'),
  ].filter((p): p is string => Boolean(p));
  for (const c of candidates) {
    if (fs.existsSync(c)) return fs.readFileSync(c);
  }
  return undefined;
}

function resolveLtiApiKey(): string {
  if (process.env.LTI_API_KEY) return process.env.LTI_API_KEY.trim();
  const candidates = [
    path.join(REPO_ROOT, 'infra/.secrets/lti_api_key'),
    path.join(REPO_ROOT, 'infra/.secrets/lti/api_key'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8').trim();
  }
  try {
    return ltiSeedApiKey('cogniate');
  } catch {
    return '';
  }
}

function ltiBaseUrl(): string {
  const port = process.env.PUBLIC_PORT ?? '9443';
  return (process.env.PUBLIC_LTI_URL ?? `https://lti.cogniate.test:${port}`).replace(/\/$/, '');
}

async function httpsRequest(
  urlStr: string,
  opts: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; headers: httpIncomingHeaders; text: string; json: <T = unknown>() => T }> {
  const url = new URL(urlStr);
  const ca = resolveCaCert();
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: opts.method ?? 'GET',
        headers: opts.headers ?? {},
        ca,
        rejectUnauthorized: Boolean(ca),
        timeout: 15_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (d: Buffer) => chunks.push(d));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            text,
            json: <T = unknown>() => JSON.parse(text) as T,
          });
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`Timeout requesting ${urlStr}`)));
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}

type httpIncomingHeaders = Record<string, string | string[] | undefined>;

function requireSimStackOrGoldenCapture(): void {
  const hasSim = process.env.LA_SIM_STACK === '1';
  const hasCapture = Boolean(process.env.LA_GOLDEN_CAPTURE && fs.existsSync(process.env.LA_GOLDEN_CAPTURE));
  expect(
    hasSim || hasCapture,
    'Booked SIM slot required: set LA_SIM_STACK=1 (live stack on qa4-la-sim-r<N>) or LA_GOLDEN_CAPTURE=<capture-dir>',
  ).toBe(true);
}

/** Asserts that a GET /api/providers profiles array matches G1 baseline + channel (LA-IC-01). */
function assertProvidersProfilesWithChannel(
  actualProfiles: Array<Record<string, unknown> & { id: string; channel?: string; lms?: string | null }>,
  goldenProfiles: Array<Record<string, unknown> & { id: string }>,
  opts: { realOnly: boolean; label: string },
): void {
  const registered = new Set<string>([...BASELINE_LMS, 'lti-generic', 'brightspace']);
  const baselineList = opts.realOnly ? BASELINE_REAL_PROFILES : BASELINE_PROFILES;
  checkProfiles(actualProfiles, baselineList, { registered, realOnly: opts.realOnly, label: opts.label });

  const simIds = actualProfiles.filter((p) => p.simulation === true).map((p) => p.id);
  checkSimulationProfiles(simIds, opts.realOnly ? [] : BASELINE_SIMULATION_PROFILES, {
    profiles: actualProfiles,
    registered,
    label: `${opts.label} simulation profiles`,
  });

  // Every profile has a non-empty channel string; baseline profiles map to moodle / canvas / blackboard.
  for (const p of actualProfiles) {
    expect(typeof p.channel === 'string' && p.channel.length > 0, `${opts.label}: ${p.id}.channel is a non-empty string`).toBe(true);
    if (Object.hasOwn(EXPECTED_CHANNEL_BY_PROFILE, p.id)) {
      expect(p.channel, `${opts.label}: ${p.id}.channel`).toBe(EXPECTED_CHANNEL_BY_PROFILE[p.id]);
    } else {
      expect(registered.has(p.channel!), `${opts.label}: extra profile ${p.id}.channel (${p.channel}) is registered`).toBe(true);
    }
  }

  // Every baseline profile matches the golden G1 profile on all baseline fields (lms included: standard -> null),
  // and the only added field in E1 is `channel` (or LA-IC-01 fields).
  const allowedAddedKeys = new Set(['channel', 'endpoints', 'issuerKind', 'endpointOrigins']);
  for (const expected of goldenProfiles) {
    const actual = actualProfiles.find((p) => p.id === expected.id);
    expect(actual, `${opts.label}: baseline profile ${expected.id} is present`).toBeDefined();

    // Strip sharedPlatform.id UUID normalization before comparing against golden G1.
    const normalizedActual: Record<string, unknown> = structuredClone(actual!);
    if (
      normalizedActual.sharedPlatform &&
      typeof normalizedActual.sharedPlatform === 'object' &&
      expected.sharedPlatform &&
      typeof expected.sharedPlatform === 'object'
    ) {
      (normalizedActual.sharedPlatform as Record<string, unknown>).id = (
        expected.sharedPlatform as Record<string, unknown>
      ).id;
    }

    sameBaselineFields(normalizedActual, expected, `${opts.label}: ${expected.id}`);
    expect(actual!.lms, `${opts.label}: ${expected.id}.lms stays frozen`).toBe(expected.lms);

    const fieldDiffs = diff(expected, normalizedActual);
    const unexplained = fieldDiffs.filter((d) => !(d.kind === 'added' && allowedAddedKeys.has(d.path)));
    expect(
      unexplained,
      `${opts.label}: ${expected.id} has no unexplained difference from golden G1`,
    ).toEqual([]);
    expect(
      fieldDiffs.some((d) => d.kind === 'added' && d.path === 'channel' && d.new === EXPECTED_CHANNEL_BY_PROFILE[expected.id]),
      `${opts.label}: ${expected.id} adds channel=${EXPECTED_CHANNEL_BY_PROFILE[expected.id]}`,
    ).toBe(true);
  }
}

describe('LA-E1-10 S3/S7 LTI service providers channel, endpoints call sites and {LMS} page texts (K1-SIM)', () => {
  it('AC-LA-E1-10-01: GET /api/providers gives every profile a channel and every other field equals the golden, lms included (LA-IC-01)', async () => {
    requireSimStackOrGoldenCapture();
    const gbaseG1 = readGbaseG1();

    if (process.env.LA_GOLDEN_CAPTURE && fs.existsSync(process.env.LA_GOLDEN_CAPTURE)) {
      const candidate = loadCapture(process.env.LA_GOLDEN_CAPTURE) as { G1: GoldenG1 };
      assertProvidersProfilesWithChannel(
        candidate.G1.acceptance.providers.profiles,
        gbaseG1.acceptance.providers.profiles,
        { realOnly: false, label: 'golden capture G1.acceptance.providers' },
      );
      assertProvidersProfilesWithChannel(
        candidate.G1.default.providers.profiles,
        gbaseG1.default.providers.profiles,
        { realOnly: true, label: 'golden capture G1.default.providers' },
      );
    }

    if (process.env.LA_SIM_STACK === '1') {
      await sharedPlatform();
      const apiKey = resolveLtiApiKey();
      expect(apiKey.length, 'LTI_API_KEY is available').toBeGreaterThan(0);
      const res = await httpsRequest(`${ltiBaseUrl()}/api/providers`, {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      expect(res.status, 'GET /api/providers status 200').toBe(200);
      const body = res.json<{ profiles: Array<Record<string, unknown> & { id: string }> }>();
      assertProvidersProfilesWithChannel(body.profiles, gbaseG1.acceptance.providers.profiles, {
        realOnly: false,
        label: 'live GET /api/providers (acceptance)',
      });
      writeArtifact('e1-10-ac01-providers.json', `${JSON.stringify(body, null, 2)}\n`);
    }
  });

  it('AC-LA-E1-10-02: R1: admin-value create plan vs fixed provider plan on POST /api/platforms, and M1 sim + M2 match the baseline per test id', async () => {
    requireSimStackOrGoldenCapture();

    // 1. Live runtime check on POST /api/platforms for endpoints: admin ('standard') vs endpoints: fixed ('canvas-sim-cloud').
    if (process.env.LA_SIM_STACK === '1') {
      await sharedPlatform();
      const apiKey = resolveLtiApiKey();
      expect(apiKey.length, 'LTI_API_KEY is available').toBeGreaterThan(0);
      const headers = {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      };
      const tag = randomUUID().slice(0, 8);
      const createdIds: string[] = [];

      try {
        // (a) Admin-value profile ('standard'): accepts admin endpoints on issuer origin, sets siteUrl/serviceUrl to null.
        const stdOrigin = `https://qa-e1-10-${tag}.moodle.test`;
        const stdCreate = await httpsRequest(`${ltiBaseUrl()}/api/platforms`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            profile: 'standard',
            name: `QA E1-10 standard ${tag}`,
            url: stdOrigin,
            clientId: `client-std-${tag}`,
            authenticationEndpoint: `${stdOrigin}/mod/lti/auth.php`,
            accesstokenEndpoint: `${stdOrigin}/mod/lti/token.php`,
            authConfig: { method: 'JWK_SET', key: `${stdOrigin}/mod/lti/certs.php` },
            deploymentIds: ['1'],
          }),
        });
        expect(stdCreate.status, `standard create status (${stdCreate.text})`).toBe(201);
        const stdBody = stdCreate.json<{ id: string; profile: string; siteUrl: string | null; serviceUrl: string | null }>();
        createdIds.push(stdBody.id);
        expect(stdBody.profile).toBe('standard');
        expect(stdBody.siteUrl).toBeNull();
        expect(stdBody.serviceUrl).toBeNull();

        // (b) Admin-value profile ('standard'): refuses off-origin endpoint with 400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN.
        const stdOffOrigin = await httpsRequest(`${ltiBaseUrl()}/api/platforms`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            profile: 'standard',
            name: `QA E1-10 off-origin ${tag}`,
            url: `https://qa-off-${tag}.moodle.test`,
            clientId: `client-off-${tag}`,
            authenticationEndpoint: `https://other-${tag}.moodle.test/mod/lti/auth.php`,
            accesstokenEndpoint: `https://qa-off-${tag}.moodle.test/mod/lti/token.php`,
            authConfig: { method: 'JWK_SET', key: `https://qa-off-${tag}.moodle.test/mod/lti/certs.php` },
            deploymentIds: ['1'],
          }),
        });
        expect(stdOffOrigin.status).toBe(400);
        expect(stdOffOrigin.json<{ details?: { message?: string } }>().details?.message).toBe(
          'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN',
        );

        // (c) Fixed profile ('canvas-sim-cloud'): follows the provider plan and refuses an endpoint not in profile.
        const fixedBadUrl = await httpsRequest(`${ltiBaseUrl()}/api/platforms`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            profile: 'canvas-sim-cloud',
            name: `QA E1-10 canvas bad ${tag}`,
            url: 'https://canvas.sim.test',
            siteUrl: 'https://school-a.canvas.sim.test',
            serviceUrl: 'https://school-a.canvas.sim.test',
            clientId: `client-canvas-${tag}`,
            authenticationEndpoint: 'https://school-a.canvas.sim.test/wrong-auth',
            accesstokenEndpoint: 'https://school-a.canvas.sim.test/login/oauth2/token',
            authConfig: { method: 'JWK_SET', key: 'https://sso.canvas.sim.test/api/lti/security/jwks' },
            deploymentIds: [`dep-${tag}`],
          }),
        });
        expect(fixedBadUrl.status).toBe(400);
        expect(fixedBadUrl.json<{ details?: { message?: string } }>().details?.message).toBe(
          'PLATFORM_URL_NOT_IN_PROFILE',
        );
      } finally {
        for (const id of createdIds) {
          await httpsRequest(`${ltiBaseUrl()}/api/platforms/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { authorization: `Bearer ${apiKey}` },
          });
        }
      }
    }

    // 2. If LA_R1_REPORT_DIR is set, verify M1 sim (394 rows) and M2 (64 cases) match baseline per test id.
    if (process.env.LA_R1_REPORT_DIR && fs.existsSync(process.env.LA_R1_REPORT_DIR)) {
      const summaryFile = path.join(process.env.LA_R1_REPORT_DIR, 'r1-summary.json');
      expect(fs.existsSync(summaryFile), `R1 summary file ${summaryFile} exists`).toBe(true);
      const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8')) as {
        m1SimFailed?: string[];
        m2Failed?: string[];
      };
      expect(summary.m1SimFailed ?? [], 'M1 sim failed test ids').toEqual([]);
      expect(summary.m2Failed ?? [], 'M2 failed test ids').toEqual([]);
    }
  });

  it('AC-LA-E1-10-04: Golden G4: every LTI service error page and the Moodle registration pages equal the baseline byte for byte', async () => {
    requireSimStackOrGoldenCapture();
    const gbaseG4 = readGbaseG4();

    // 1. Compare G4 in LA_GOLDEN_CAPTURE against G-BASE G4.json (0 differences allowed in G4).
    if (process.env.LA_GOLDEN_CAPTURE && fs.existsSync(process.env.LA_GOLDEN_CAPTURE)) {
      const base = loadCapture(GBASE_DIR);
      const candidate = loadCapture(process.env.LA_GOLDEN_CAPTURE);
      const expectedIds = (process.env.LA_GOLDEN_EXPECTED ?? 'LA-IC-01')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const expectedDeltas = expectedIds
        .map((id) => {
          const p = path.join(REPO_ROOT, 'tests/ltiaas/golden/expected', `${id}.json`);
          return fs.existsSync(p) ? loadExpectedDelta(id) : null;
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);

      const g4Comparison = compareCaptures({ G4: base.G4 }, { G4: candidate.G4 }, expectedDeltas);
      writeArtifact('e1-10-ac04-g4-diff.json', `${JSON.stringify(g4Comparison, null, 2)}\n`);
      expect(g4Comparison.differences, 'G4 has 0 differences against G-BASE').toEqual([]);
      expect(g4Comparison.ok, 'G4 golden compare ok').toBe(true);
    }

    // 2. On a live SIM stack, verify LTI service error pages and Moodle registration error page match baseline texts.
    if (process.env.LA_SIM_STACK === '1') {
      // LTI service launch with invalid state -> 401 INVALID_STATE ("Start again from Moodle.")
      const launchRes = await httpsRequest(`${ltiBaseUrl()}/lti/launch/cogniate`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'id_token=invalid&state=nonexistent-state',
      });
      const expectedInvalidState = gbaseG4.canvas.pages.INVALID_STATE;
      expect(launchRes.status).toBe(expectedInvalidState.status);
      expect(launchRes.text).toContain(expectedInvalidState.errorCode!);
      expect(launchRes.text).toContain(expectedInvalidState.action!);

      // Moodle registration start without openid_configuration -> 400 INVALID_REQUEST with "Moodle" text
      const regRes = await httpsRequest(`${ltiBaseUrl()}/lti/register/cogniate`);
      expect(regRes.status).toBe(400);
      expect(regRes.text).toContain('INVALID_REQUEST');
      expect(regRes.text).toContain('Moodle');
    }
  });
});
