// LA-E2-03 K1-SIM acceptance tests (pending: Docker window):
// - AC-LA-E2-03-03: `GET /app-api/lms-providers` lists `lti-generic` after the three baseline entries with
//   `channelName: "LMS"` and `registration` `[{dynamic, self}, {manual, operatorGrant}]`; the baseline entries are
//   unchanged. `GET /api/providers` lists the `lti-generic` profile after the baseline real profiles and before the
//   simulation profiles.
// - AC-LA-E2-03-04: `POST /app-api/connections {lms: "lti-generic", method: "manual", siteUrl}` with an IP literal,
//   `localhost` or one of our hosts gives `422 INVALID_SITE_URL` with `details.rule`; a valid https origin gives `201`
//   with `channel: "lti-generic"`, `profile: "lti-generic"` and authority `operatorGrant`.
// - AC-LA-E2-03-05: `GET …/tool-configuration` of an `lti-generic` connection gives the rows `tool_name`, `login_url`,
//   `redirect_uri`, `target_link_uri`, `jwks_url`, `deep_linking_url`, `scopes`, `privacy` in this order, with the
//   values of app API delta §3.3.
// - AC-LA-E2-03-07: Through the LTI service, an active `POST /api/platforms` with profile `lti-generic` and the token
//   endpoint on another host gives `400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`, and the staged create of the same values
//   gives an inactive platform (proves LA-E2-01 end to end).
// Source: docs/architecture/ltiaas/tasks/LA-E2-03.md (at f01bfcd); LA-ADR-02 D2, D2a, D3; cogniate-app-api-delta.md
// §1–§3; lti-service-api-delta.md §4.1.
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  admin,
  app,
  connPath,
  expectStatus,
  session,
  unique,
  urls,
  type Json,
} from '../../../acceptance/M1/common/client';

const BASELINE_REAL_PROFILES = [
  'standard',
  'canvas-cloud-production',
  'canvas-cloud-beta',
  'canvas-cloud-test',
  'canvas-self-hosted',
  'blackboard',
] as const;

const EXPECTED_TOOL_ROW_KEYS = [
  'tool_name',
  'login_url',
  'redirect_uri',
  'target_link_uri',
  'jwks_url',
  'deep_linking_url',
  'scopes',
  'privacy',
] as const;

const FOUR_AGS_SCOPES = [
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/score',
] as const;

function writeArtifact(name: string, content: string): void {
  const runDir = process.env.LA_RUN_DIR;
  if (!runDir) return;
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(runDir, name), content, { mode: 0o600 });
}

describe('LA-E2-03 K1-SIM (pending: Docker window)', () => {
  const createdPlatformIds: string[] = [];

  afterAll(async () => {
    for (const id of createdPlatformIds.splice(0)) {
      await admin('DELETE', `/api/platforms/${encodeURIComponent(id)}`).catch(() => undefined);
    }
  });

  it('AC-LA-E2-03-03: GET /app-api/lms-providers lists lti-generic after the three baseline entries, and GET /api/providers lists lti-generic after baseline real profiles and before simulation profiles', async () => {
    const s = await session('A');
    const lmsProvRes = await app(s, 'GET', '/app-api/lms-providers');
    expectStatus(lmsProvRes, 200);
    const lmsList = (lmsProvRes.json?.lms ?? []) as Json[];
    expect(lmsList.slice(0, 3).map((e) => e.lms)).toEqual(['moodle', 'canvas', 'blackboard']);

    const genericIdx = lmsList.findIndex((e) => e.lms === 'lti-generic' || e.channel === 'lti-generic');
    expect(genericIdx, 'lti-generic appears after the three baseline entries').toBeGreaterThanOrEqual(3);
    const genericEntry = lmsList[genericIdx];
    expect(genericEntry.channel).toBe('lti-generic');
    expect(genericEntry.lms).toBe('lti-generic');
    expect(genericEntry.channelName).toBe('LMS');
    expect(genericEntry.label).toBe('Other LTI 1.3 platform');
    expect(genericEntry.registration).toEqual([
      { method: 'dynamic', authority: 'self', profiles: ['lti-generic'] },
      { method: 'manual', authority: 'operatorGrant', profiles: ['lti-generic'] },
    ]);

    const ltiProvRes = await admin('GET', '/api/providers');
    expectStatus(ltiProvRes, 200);
    const profiles = (ltiProvRes.json?.profiles ?? []) as Json[];
    const profileIds = profiles.map((p) => String(p.id));
    const ltiGenericIdx = profileIds.indexOf('lti-generic');
    expect(ltiGenericIdx, 'lti-generic profile is present in GET /api/providers').toBeGreaterThanOrEqual(0);

    for (const bpId of BASELINE_REAL_PROFILES) {
      const bpIdx = profileIds.indexOf(bpId);
      expect(bpIdx).toBeGreaterThanOrEqual(0);
      expect(ltiGenericIdx, `lti-generic index (${ltiGenericIdx}) > ${bpId} (${bpIdx})`).toBeGreaterThan(bpIdx);
    }
    const simIndices = profiles
      .map((p, idx) => (p.simulation === true ? idx : -1))
      .filter((idx) => idx >= 0);
    expect(simIndices.length).toBeGreaterThan(0);
    for (const simIdx of simIndices) {
      expect(ltiGenericIdx, `lti-generic index (${ltiGenericIdx}) < simulation profile index (${simIdx})`).toBeLessThan(
        simIdx,
      );
    }

    writeArtifact(
      'e2-03-ac03.json',
      `${JSON.stringify({ genericEntry, profileOrder: profileIds }, null, 2)}\n`,
    );
  });

  it('AC-LA-E2-03-04: POST /app-api/connections for lti-generic refuses IP literal, localhost, and our own host with 422 INVALID_SITE_URL (details.rule), and accepts valid https origin with 201 (channel, profile, operatorGrant)', async () => {
    const s = await session('A');

    for (const badSiteUrl of ['https://127.0.0.1', 'https://192.0.2.10', 'https://localhost', urls.app]) {
      const badRes = await app(s, 'POST', '/app-api/connections', {
        name: unique('QA3 bad lti-generic'),
        lms: 'lti-generic',
        method: 'manual',
        siteUrl: badSiteUrl,
      });
      expectStatus(badRes, 422, 'INVALID_SITE_URL');
      const details = badRes.json?.error?.details ?? badRes.json?.details;
      expect(details?.rule, `siteUrl ${badSiteUrl} includes details.rule`).toBeDefined();
    }

    const goodRes = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 School Sakai'),
      lms: 'lti-generic',
      method: 'manual',
      siteUrl: 'https://lms.school.edu',
    });
    expectStatus(goodRes, 201);
    expect(goodRes.json.channel).toBe('lti-generic');
    expect(goodRes.json.lms).toBe('lti-generic');
    expect(goodRes.json.profile).toBe('lti-generic');
    expect(goodRes.json.bindingAuthority).toBe('operatorGrant');

    writeArtifact('e2-03-ac04.json', `${JSON.stringify(goodRes.json, null, 2)}\n`);
  });

  it('AC-LA-E2-03-05: GET .../tool-configuration of an lti-generic connection returns the 8 rows in app API delta §3.3 order and values', async () => {
    const s = await session('A');
    const conn = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E2-03 tool-config'),
      lms: 'lti-generic',
      method: 'manual',
      siteUrl: 'https://sakai.university.edu',
    });
    expectStatus(conn, 201);

    const cfgRes = await app(s, 'GET', `${connPath(conn.json.id)}/tool-configuration`);
    expectStatus(cfgRes, 200);
    const rows = (Array.isArray(cfgRes.json) ? cfgRes.json : (cfgRes.json?.rows ?? cfgRes.json?.fields ?? [])) as Array<{
      key: string;
      label: string;
      value: string;
    }>;
    expect(rows.map((r) => r.key)).toEqual([...EXPECTED_TOOL_ROW_KEYS]);

    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    expect(byKey.get('tool_name')).toBe(`Cogniate (${s.library.name})`);
    expect(byKey.get('login_url')).toBe(`${urls.lti}/lti/login/cogniate`);
    expect(byKey.get('redirect_uri')).toBe(`${urls.lti}/lti/launch/cogniate`);
    expect(byKey.get('target_link_uri')).toBe(`${urls.lti}/lti/launch/cogniate`);
    expect(byKey.get('jwks_url')).toBe(`${urls.lti}/lti/keys/cogniate`);
    expect(byKey.get('deep_linking_url')).toBe(`${urls.lti}/lti/launch/cogniate`);
    for (const scope of FOUR_AGS_SCOPES) {
      expect(byKey.get('scopes')).toContain(scope);
    }
    expect(byKey.get('privacy')).toBe("Do not send the learner's name or e-mail.");

    writeArtifact('e2-03-ac05.json', `${JSON.stringify(rows, null, 2)}\n`);
  });

  it('AC-LA-E2-03-07: active POST /api/platforms with profile lti-generic and off-origin token endpoint gives 400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN; staged create gives inactive platform', async () => {
    const clientId = unique('qa3-lti-generic-client');
    const baseBody = {
      profile: 'lti-generic',
      name: unique('QA3 LTI Generic Platform'),
      url: 'https://lms.school.edu',
      clientId,
      authenticationEndpoint: 'https://lms.school.edu/lti/auth',
      accesstokenEndpoint: 'https://tokens.other-lms.edu/oauth2/token',
      authConfig: {
        method: 'JWK_SET',
        key: 'https://lms.school.edu/lti/jwks.json',
      },
      deploymentIds: ['dep-1'],
    };

    // 1. Active create (`active: true` / default) with off-origin token endpoint -> 400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN.
    const activeRes = await admin('POST', '/api/platforms', baseBody);
    expectStatus(activeRes, 400, 'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN');

    // 2. Staged create (`active: false` + `bindingRef`) of the same values -> 201 inactive platform.
    const stagedRes = await admin('POST', '/api/platforms', {
      ...baseBody,
      active: false,
      bindingRef: unique('bref-e203'),
    });
    expectStatus(stagedRes, 201);
    createdPlatformIds.push(String(stagedRes.json.id));
    expect(stagedRes.json.active).toBe(false);
    expect(stagedRes.json.profile).toBe('lti-generic');

    writeArtifact(
      'e2-03-ac07.json',
      `${JSON.stringify({ activeStatus: activeRes.status, activeBody: activeRes.json, stagedBody: stagedRes.json }, null, 2)}\n`,
    );
  });
});
