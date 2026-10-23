// LA-E2-01 K1-SIM acceptance suite (runs inside the e2e container on the SIM slot).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E2-01.md (AC-LA-E2-01-03, AC-LA-E2-01-08)
// - docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md D2, D2a
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §4.6.1, §4.7
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { ACCOUNT, apiKey, auth, ltiApi } from '../../../acceptance/lib/lti';
import {
  AGS,
  admin,
  expectStatus,
  idToken,
  launch,
  records,
  service,
  sharedPlatform,
  unique,
  type Json,
} from '../../../acceptance/M1/common/client';
import { CLOUD, PATHS, canvasLaunch, canvasPlatform } from '../../../acceptance/M1/canvas/canvas';
import { diff } from '../../golden/lib/compare.mjs';
import { normalizeFile } from '../../golden/lib/normalize.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '../../../..');
const GBASE_DIR = path.join(REPO_ROOT, 'tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6');

const SCOPES = {
  lineitem: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  readonly: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  score: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  result: 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
} as const;

interface ExpectedTraits {
  channel: string;
  endpoints: 'admin' | 'fixed';
  issuerKind: 'per-tenant' | 'fixed';
  endpointOrigins: 'issuer' | 'any-https' | null;
}

const EXPECTED_TRAITS_BY_PROFILE: Record<string, ExpectedTraits> = {
  standard: {
    channel: 'moodle',
    endpoints: 'admin',
    issuerKind: 'per-tenant',
    endpointOrigins: 'issuer',
  },
  'canvas-cloud-production': {
    channel: 'canvas',
    endpoints: 'fixed',
    issuerKind: 'fixed',
    endpointOrigins: null,
  },
  'canvas-cloud-beta': {
    channel: 'canvas',
    endpoints: 'fixed',
    issuerKind: 'fixed',
    endpointOrigins: null,
  },
  'canvas-cloud-test': {
    channel: 'canvas',
    endpoints: 'fixed',
    issuerKind: 'fixed',
    endpointOrigins: null,
  },
  'canvas-self-hosted': {
    channel: 'canvas',
    endpoints: 'fixed',
    issuerKind: 'per-tenant',
    endpointOrigins: null,
  },
  blackboard: {
    channel: 'blackboard',
    endpoints: 'fixed',
    issuerKind: 'fixed',
    endpointOrigins: null,
  },
  'blackboard-sim': {
    channel: 'blackboard',
    endpoints: 'fixed',
    issuerKind: 'fixed',
    endpointOrigins: null,
  },
  'canvas-sim-cloud': {
    channel: 'canvas',
    endpoints: 'fixed',
    issuerKind: 'fixed',
    endpointOrigins: null,
  },
  'lti-generic': {
    channel: 'lti-generic',
    endpoints: 'admin',
    issuerKind: 'per-tenant',
    endpointOrigins: 'any-https',
  },
  brightspace: {
    channel: 'brightspace',
    endpoints: 'admin',
    issuerKind: 'per-tenant',
    endpointOrigins: 'any-https',
  },
};

interface GoldenG1 {
  acceptance: {
    providers: { profiles: Array<Record<string, unknown> & { id: string }> };
  };
}

interface GoldenTokenRecord {
  audience: string | string[];
  clientId: string;
  host: string;
  kind: 'token';
  method: string;
  path: string;
  provider: string;
  scopes: string[];
}

interface GoldenG2 {
  blackboard: { records: Array<Record<string, unknown>> };
  canvas: { records: Array<Record<string, unknown>> };
}

function readGbaseG1(): GoldenG1 {
  return JSON.parse(fs.readFileSync(path.join(GBASE_DIR, 'G1.json'), 'utf8')) as GoldenG1;
}

function readGbaseG2(): GoldenG2 {
  return JSON.parse(fs.readFileSync(path.join(GBASE_DIR, 'G2.json'), 'utf8')) as GoldenG2;
}

describe('LA-E2-01 K1-SIM: GET /api/providers traits and Golden G2 token requests', () => {
  const createdPlatformIds: string[] = [];

  afterAll(async () => {
    const key = apiKey(ACCOUNT);
    for (const id of createdPlatformIds.splice(0)) {
      await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(id)}`, {
        authorization: auth.bearer(key),
      }).catch(() => undefined);
    }
  });

  it('AC-LA-E2-01-03: GET /api/providers shows endpoints, issuerKind and endpointOrigins for every profile with §4.7 values; every older field equals the golden (LA-IC-01)', async () => {
    await sharedPlatform();
    const key = apiKey(ACCOUNT);
    const res = await ltiApi<{ profiles: Array<Record<string, unknown> & { id: string }> }>(
      'GET',
      '/api/providers',
      { authorization: auth.bearer(key) },
    );
    expect(res.status).toBe(200);
    const normalizedProviders = (normalizeFile({ providers: res.json }).data as Json).providers as {
      profiles: Array<Record<string, unknown> & { id: string }>;
    };
    const profiles = normalizedProviders.profiles ?? [];
    expect(profiles.length).toBeGreaterThanOrEqual(8);

    const g1 = readGbaseG1();
    const goldenById = new Map(
      g1.acceptance.providers.profiles.map((entry) => [entry.id, entry]),
    );

    for (const profile of profiles) {
      const expected = EXPECTED_TRAITS_BY_PROFILE[profile.id];
      expect(expected, `Known trait expectation for profile ${profile.id}`).toBeDefined();
      expect(profile.channel, `${profile.id}.channel`).toBe(expected!.channel);
      expect(profile.endpoints, `${profile.id}.endpoints`).toBe(expected!.endpoints);
      expect(profile.issuerKind, `${profile.id}.issuerKind`).toBe(expected!.issuerKind);
      expect(profile.endpointOrigins, `${profile.id}.endpointOrigins`).toBe(
        expected!.endpointOrigins,
      );

      // For every baseline profile in G1, every older field equals the golden (LA-IC-01 expected delta)
      const goldenEntry = goldenById.get(profile.id);
      if (goldenEntry) {
        const {
          channel: _channel,
          endpoints: _endpoints,
          issuerKind: _issuerKind,
          endpointOrigins: _endpointOrigins,
          label: _candidateLabel,
          ...candidateRest
        } = profile;
        const { label: _goldenLabel, ...goldenRest } = goldenEntry;
        const differences = diff(goldenRest, candidateRest);
        expect(
          differences,
          `Older fields of ${profile.id} on GET /api/providers must equal Golden G1`,
        ).toEqual([]);
      }
    }
  });

  it('AC-LA-E2-01-08: Golden G2 token requests (assertion claims, aud form, scopes) of the three baseline channels equal the baseline', async () => {
    const g2 = readGbaseG2();
    const goldenBbToken = g2.blackboard.records.find(
      (r) => r.kind === 'token',
    ) as unknown as GoldenTokenRecord;
    const goldenCanvasToken = g2.canvas.records.find(
      (r) => r.kind === 'token',
    ) as unknown as GoldenTokenRecord;
    expect(goldenBbToken).toBeDefined();
    expect(goldenCanvasToken).toBeDefined();

    // 1. Blackboard baseline channel (blackboard-sim): array aud ["https://developer.blackboard.sim.test/api/v1/gateway/oauth2/jwttoken"]
    const bbPlatformId = await sharedPlatform();
    const bbDepId = unique('dep-e201-bb');
    const addDep = await admin(
      'POST',
      `/api/platforms/${encodeURIComponent(bbPlatformId)}/deployments`,
      {
        deploymentId: bbDepId,
        siteUrl: 'https://learn-a.blackboard.sim.test',
      },
    );
    expectStatus(addDep, 201);

    const bbCursor0 = (await records()).cursor;
    const bbResource = unique('res-e201-bb');
    const bbLineitems = 'https://learn-a.blackboard.sim.test/learn/api/v1/lti/courses/course-1/lineItems';
    const bbLineitem = `${bbLineitems}/${encodeURIComponent(bbResource)}`;
    const bbLaunched = await launch({
      provider: 'blackboard-sim',
      clientId: 'qa-bb-app',
      deploymentId: bbDepId,
      siteHost: 'learn-a.blackboard.sim.test',
      resource: bbResource,
      claims: {
        [AGS]: {
          lineitems: bbLineitems,
          lineitem: bbLineitem,
          scope: [SCOPES.lineitem, SCOPES.readonly, SCOPES.score, SCOPES.result],
        },
      },
    });
    expect(bbLaunched.response.status).toBe(303);
    const bbTok = await idToken(bbLaunched.ltik);
    expectStatus(bbTok, 200);
    const bbServiceKey = String(bbTok.json?.services?.serviceKey ?? '');
    const bbScoreRes = await service(
      bbServiceKey,
      'POST',
      `/api/lineitems/${encodeURIComponent(bbLineitem)}/scores`,
      {
        userId: 'learner-1',
        scoreGiven: 7,
        scoreMaximum: 10,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
      },
    );
    expect([200, 204]).toContain(bbScoreRes.status);

    const bbRecs = (await records(bbCursor0)).records;
    const bbTokenRec =
      bbRecs.find((r: Json) => r.kind === 'token' && r.provider === 'blackboard-sim') ??
      (await records(0)).records.find(
        (r: Json) => r.kind === 'token' && r.provider === 'blackboard-sim',
      );
    expect(bbTokenRec, 'Blackboard token request recorded by simulator').toBeDefined();
    expect(bbTokenRec!.audience).toEqual(goldenBbToken.audience);
    expect(Array.isArray(bbTokenRec!.audience)).toBe(true);
    expect(bbTokenRec!.scopes).toEqual(goldenBbToken.scopes);
    expect(bbTokenRec!.host).toBe(goldenBbToken.host);
    expect(bbTokenRec!.path).toBe(goldenBbToken.path);
    expect(bbTokenRec!.method).toBe(goldenBbToken.method);

    // 2. Canvas baseline channel (canvas-sim-cloud): string aud "https://school-a.canvas.sim.test/login/oauth2/token"
    const cvTarget = await canvasPlatform({ name: unique('QA4 E2-01 Canvas') });
    createdPlatformIds.push(cvTarget.platformId);
    const cvCursor0 = (await records()).cursor;
    const cvResource = unique('res-e201-cv');
    const cvLineitems = `${CLOUD.siteA}${PATHS.lineitems}`;
    const cvLineitem = `${cvLineitems}/${encodeURIComponent(cvResource)}`;
    const cvLaunched = await canvasLaunch(cvTarget, {
      resource: cvResource,
      claims: {
        [AGS]: {
          lineitems: cvLineitems,
          lineitem: cvLineitem,
          scope: [SCOPES.lineitem, SCOPES.readonly, SCOPES.score, SCOPES.result],
        },
      },
    });
    expect(cvLaunched.response.status).toBe(303);
    const cvTok = await idToken(cvLaunched.ltik);
    expectStatus(cvTok, 200);
    const cvServiceKey = String(cvTok.json?.services?.serviceKey ?? '');
    const cvScoreRes = await service(
      cvServiceKey,
      'POST',
      `/api/lineitems/${encodeURIComponent(cvLineitem)}/scores`,
      {
        userId: 'learner-1',
        scoreGiven: 7,
        scoreMaximum: 10,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
      },
    );
    expect([200, 204]).toContain(cvScoreRes.status);

    const cvRecs = (await records(cvCursor0)).records;
    const cvTokenRec =
      cvRecs.find((r: Json) => r.kind === 'token' && r.provider === 'canvas-sim-cloud') ??
      (await records(0)).records.find(
        (r: Json) => r.kind === 'token' && r.provider === 'canvas-sim-cloud',
      );
    expect(cvTokenRec, 'Canvas token request recorded by simulator').toBeDefined();
    expect(cvTokenRec!.audience).toBe(goldenCanvasToken.audience);
    expect(typeof cvTokenRec!.audience).toBe('string');
    expect(cvTokenRec!.scopes).toEqual(goldenCanvasToken.scopes);
    expect(cvTokenRec!.host).toBe(goldenCanvasToken.host);
    expect(cvTokenRec!.path).toBe(goldenCanvasToken.path);
    expect(cvTokenRec!.method).toBe(goldenCanvasToken.method);

    // 3. Moodle baseline channel (standard on moodle-sim): string aud "https://moodle.sim.test/mod/lti/token.php"
    const moodleClientId = unique('qa-moodle-e201');
    const moodleDepId = '1';
    const moodleCreate = await admin('POST', '/api/platforms', {
      profile: 'standard',
      name: unique('QA4 E2-01 Moodle'),
      url: 'https://moodle.sim.test',
      clientId: moodleClientId,
      authenticationEndpoint: 'https://moodle.sim.test/mod/lti/auth.php',
      accesstokenEndpoint: 'https://moodle.sim.test/mod/lti/token.php',
      authConfig: {
        method: 'JWK_SET',
        key: 'https://moodle.sim.test/mod/lti/certs.php',
      },
      deploymentIds: [moodleDepId],
    });
    expectStatus(moodleCreate, 201);
    createdPlatformIds.push(String(moodleCreate.json.id));

    const mdCursor0 = (await records()).cursor;
    const mdResource = unique('res-e201-md');
    const mdLineitems = 'https://moodle.sim.test/mod/lti/services.php/2/lineitems';
    const mdLineitem = `${mdLineitems}/${encodeURIComponent(mdResource)}`;
    const mdLaunched = await launch({
      provider: 'moodle-sim',
      clientId: moodleClientId,
      deploymentId: moodleDepId,
      siteHost: 'moodle.sim.test',
      resource: mdResource,
      claims: {
        [AGS]: {
          lineitems: mdLineitems,
          lineitem: mdLineitem,
          scope: [SCOPES.lineitem, SCOPES.readonly, SCOPES.score, SCOPES.result],
        },
      },
    });
    expect(mdLaunched.response.status).toBe(303);
    const mdTok = await idToken(mdLaunched.ltik);
    expectStatus(mdTok, 200);
    const mdServiceKey = String(mdTok.json?.services?.serviceKey ?? '');
    const mdScoreRes = await service(
      mdServiceKey,
      'POST',
      `/api/lineitems/${encodeURIComponent(mdLineitem)}/scores`,
      {
        userId: 'learner-1',
        scoreGiven: 7,
        scoreMaximum: 10,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
      },
    );
    expect([200, 204]).toContain(mdScoreRes.status);

    const mdRecs = (await records(mdCursor0)).records;
    const mdTokenRec = mdRecs.find(
      (r: Json) => r.kind === 'token' && r.provider === 'moodle-sim' && r.clientId === moodleClientId,
    );
    expect(mdTokenRec, 'Moodle token request recorded by simulator').toBeDefined();
    expect(mdTokenRec!.audience).toBe('https://moodle.sim.test/mod/lti/token.php');
    expect(typeof mdTokenRec!.audience).toBe('string');
    expect(mdTokenRec!.scopes).toEqual([SCOPES.score]);
    expect(mdTokenRec!.host).toBe('moodle.sim.test');
    expect(mdTokenRec!.path).toBe('/mod/lti/token.php');
    expect(mdTokenRec!.method).toBe('POST');
  });
});
