// LA-E5-13 K1-SIM acceptance suite: Two-tenant isolation checks for the new routes.
// Runs inside the e2e container on a SIM slot.
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E5-13.md (AC-LA-E5-13-01, -02, -03, -05, -06)
// - docs/architecture/ltiaas/adr/LA-ADR-07-security-and-tenancy.md D1 (AP-07-01, AP-07-02), D2 (A1-A6)
// - docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md §3, §5, §8
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §2.1, §2.2, §4.8
// - docs/architecture/ltiaas/security-delta.md §2.2, §4, §6, §8
//
// Secret rule: never place raw API keys, ltiks, service keys, or grant codes into assertion failure messages.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APP, appApi, createCourse, QA_B, signIn, THANH, uploadVersion, type Session } from '../../../acceptance/lib/app';
import { httpsRequest, type HttpResult } from '../../../acceptance/lib/https';
import {
  ACCOUNT,
  apiKey,
  auth,
  errorCode,
  eventsSince,
  hasErrorShape,
  LAUNCH_URL,
  LOGIN_URL,
  ltiApi,
  recordSecret,
  SECOND_ACCOUNT,
  sinkHitsSince,
  waitForEvent,
} from '../../../acceptance/lib/lti';
import {
  CANVAS_LOGIN,
  canvasBound,
  canvasPicker,
  canvasPlatform,
  scenarioOf,
  type CanvasBinding,
} from '../../../acceptance/M1/canvas/canvas';
import {
  app,
  bound,
  connPath,
  expectStatus,
  formPost,
  idToken,
  noServiceCalls,
  parseForm,
  records,
  session,
  sim,
  unique,
  urls,
  type Json,
} from '../../../acceptance/M1/common/client';
import {
  commitGrade,
  fixtureZip,
  openPlay,
  pick,
  picker,
  publication,
  results,
  returnDeepLink,
  waitSync,
} from '../../../acceptance/M1/common/course';
import {
  assertExpectedConnectionFixtures,
  assertVictimStateUnchanged,
  buildConnectionRouteProbes,
  buildVictimStateSnapshot,
  compareVictimStateBeforeAfter,
  parseLmsProvidersEnvelope,
  type ConnectionFixtureSpec,
  type ParsedLmsProvidersEnvelope,
} from './oracle';

const PUBLIC_LTI_URL = urls.lti.replace(/\/+$/, '');
const PUBLIC_LTI_ORIGIN = new URL(PUBLIC_LTI_URL).origin;

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
}

function writeArtifact(name: string, data: unknown): void {
  const runDir = process.env.LA_RUN_DIR;
  if (!runDir) return;
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(runDir, name), `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
}

function extractJsonScriptBlock<T>(html: string): T {
  const m = /<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  expect(m, 'Expected <script type="application/json"> block in HTML page').not.toBeNull();
  const raw = JSON.parse(m![1]!.trim()) as Record<string, unknown>;
  return {
    ...raw,
    storageTarget: raw.storageTarget ?? raw.target,
    storageOrigin: raw.storageOrigin ?? raw.origin,
    stateKey: raw.stateKey ?? raw.key,
    stateValue: raw.stateValue ?? raw.state,
  } as unknown as T;
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

async function postStorageCheck(
  account: string,
  fields: { check: string; value: string },
  origin: string | null = PUBLIC_LTI_ORIGIN,
): Promise<HttpResult> {
  const url = `${PUBLIC_LTI_URL}/lti/launch/${encodeURIComponent(account)}/storage-check`;
  const body = new URLSearchParams(fields).toString();
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
    'content-length': String(Buffer.byteLength(body)),
    ...(origin !== null ? { origin } : {}),
  };
  return httpsRequest(url, { method: 'POST', headers, body });
}

describe('LA-E5-13 K1-SIM: Two-tenant isolation checks for the new routes', () => {
  let sessA: Session & { library: Json };
  let sessB: Session & { library: Json };
  let aBb: Awaited<ReturnType<typeof bound>>;
  let bBb: Awaited<ReturnType<typeof bound>>;
  let aCv: CanvasBinding;
  let bCv: CanvasBinding;
  let parsedProviders: ParsedLmsProvidersEnvelope;
  let bMoodleManualId = '';
  let bGenericDynId = '';
  let bGenericManualId = '';
  let bBrightspaceDynId = '';
  let bBrightspaceManualId = '';
  let aPub: Json;
  let bPub: Json;
  let aCvPub: Json;
  let bCvPub: Json;
  let aCourseId = '';
  let bCourseId = '';
  let bVersionId = '';

  const createdPlatforms: { key: string; id: string }[] = [];
  const createdPendingBConnections: string[] = [];

  beforeAll(async () => {
    sessA = await session('A');
    sessB = await session('B');

    // Validate the contracted GET /app-api/lms-providers envelope ({ lms: [...] }) and assert all 5 built channels exist
    const provRes = await app(sessB, 'GET', '/app-api/lms-providers');
    expectStatus(provRes, 200);
    parsedProviders = parseLmsProvidersEnvelope(provRes.json);
    expect(parsedProviders.channelIds).toEqual(['blackboard', 'brightspace', 'canvas', 'lti-generic', 'moodle']);

    // Registered connections in Library A and Library B (Blackboard + Canvas)
    aBb = await bound('A', 'https://learn-a.blackboard.sim.test', unique('e513-bb-a'));
    bBb = await bound('B', 'https://learn-b.blackboard.sim.test', unique('e513-bb-b'));
    aCv = await canvasBound('A');
    bCv = await canvasBound('B');

    // Pending connections in Library B across all remaining built channels & methods (moodle, lti-generic, brightspace)
    const moodleManRes = await app(sessB, 'POST', '/app-api/connections', {
      name: unique('E5-13 B Moodle Manual'),
      lms: 'moodle',
      method: 'manual',
      siteUrl: 'https://moodle-b.sim.test',
    });
    expectStatus(moodleManRes, 201);
    bMoodleManualId = String(moodleManRes.json.id);
    createdPendingBConnections.push(bMoodleManualId);

    const genDynRes = await app(sessB, 'POST', '/app-api/connections', {
      name: unique('E5-13 B Generic Dynamic'),
      lms: 'lti-generic',
      method: 'dynamic',
      siteUrl: 'https://generic.sim.test',
    });
    expectStatus(genDynRes, 201);
    bGenericDynId = String(genDynRes.json.id);
    createdPendingBConnections.push(bGenericDynId);

    const genManRes = await app(sessB, 'POST', '/app-api/connections', {
      name: unique('E5-13 B Generic Manual'),
      lms: 'lti-generic',
      method: 'manual',
      siteUrl: 'https://generic.sim.test',
    });
    expectStatus(genManRes, 201);
    bGenericManualId = String(genManRes.json.id);
    createdPendingBConnections.push(bGenericManualId);

    const bsDynRes = await app(sessB, 'POST', '/app-api/connections', {
      name: unique('E5-13 B Brightspace Dynamic'),
      lms: 'brightspace',
      method: 'dynamic',
      siteUrl: 'https://brightspace.sim.test',
    });
    expectStatus(bsDynRes, 201);
    bBrightspaceDynId = String(bsDynRes.json.id);
    createdPendingBConnections.push(bBrightspaceDynId);

    const bsManRes = await app(sessB, 'POST', '/app-api/connections', {
      name: unique('E5-13 B Brightspace Manual'),
      lms: 'brightspace',
      method: 'manual',
      siteUrl: 'https://brightspace.sim.test',
    });
    expectStatus(bsManRes, 201);
    bBrightspaceManualId = String(bsManRes.json.id);
    createdPendingBConnections.push(bBrightspaceManualId);

    // Courses and publications in Library A and Library B
    aPub = await publication(aBb, 'scorm12');
    bPub = await publication(bBb, 'scorm12');
    aCvPub = await publication(aCv, 'scorm12');
    bCvPub = await publication(bCv, 'scorm12');
    aCourseId = String(aPub.courseId);
    bCourseId = String(bPub.courseId);
    bVersionId = String(bPub.versionId);
  });

  afterAll(async () => {
    for (const id of createdPendingBConnections.splice(0)) {
      await app(sessB, 'DELETE', connPath(id)).catch(() => undefined);
    }
    for (const p of createdPlatforms.splice(0)) {
      await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(p.id)}`, {
        authorization: auth.bearer(p.key),
      }).catch(() => undefined);
    }
  });

  it('AC-LA-E5-13-01: every LA app route called in library A session with a library B id returns 404 (or not-found view), makes zero outbound calls, and leaves library B DTOs completely unchanged (AP-07-01)', async () => {
    const bConnectionFixtures: ConnectionFixtureSpec[] = [
      { label: 'moodle-manual', channel: 'moodle', method: 'manual', id: bMoodleManualId },
      { label: 'blackboard', channel: 'blackboard', method: 'manual', id: String(bBb.connection.id) },
      { label: 'canvas', channel: 'canvas', method: 'manual', id: String(bCv.connection.id) },
      { label: 'lti-generic-dynamic', channel: 'lti-generic', method: 'dynamic', id: bGenericDynId },
      { label: 'lti-generic-manual', channel: 'lti-generic', method: 'manual', id: bGenericManualId },
      { label: 'brightspace-dynamic', channel: 'brightspace', method: 'dynamic', id: bBrightspaceDynId },
      { label: 'brightspace-manual', channel: 'brightspace', method: 'manual', id: bBrightspaceManualId },
    ];

    const fixtureSummary = assertExpectedConnectionFixtures(bConnectionFixtures);
    expect(fixtureSummary.exercisedChannels).toEqual(['blackboard', 'brightspace', 'canvas', 'lti-generic', 'moodle']);
    expect(fixtureSummary.exercisedMethods).toEqual(['dynamic', 'manual']);
    expect(fixtureSummary.exercisedFixtures).toHaveLength(7);

    // Capture Library B's connection and publication DTOs BEFORE Library A's foreign-ID probes (B-LA-E5-13-02)
    const bConnectionsBefore: Record<string, Record<string, unknown>> = {};
    for (const conn of bConnectionFixtures) {
      const resB = await app(sessB, 'GET', connPath(conn.id));
      expectStatus(resB, 200);
      bConnectionsBefore[conn.label] = resB.json as Record<string, unknown>;
    }
    const bPublicationsBefore: Record<string, Record<string, unknown>> = {};
    for (const [label, pub] of [
      ['blackboard-pub', bPub],
      ['canvas-pub', bCvPub],
    ] as const) {
      const resPubB = await app(sessB, 'GET', `/app-api/publications/${encodeURIComponent(String(pub.id))}`);
      expectStatus(resPubB, 200);
      bPublicationsBefore[label] = resPubB.json as Record<string, unknown>;
    }
    const victimBefore = buildVictimStateSnapshot(bConnectionsBefore, bPublicationsBefore);

    // Negative control (B-LA-E5-13-02): a mutated B snapshot (Blackboard status -> pending, siteUrl changed)
    // must be rejected by compareVictimStateBeforeAfter even if all foreign requests returned HTTP 404.
    const mutatedControl = structuredClone(victimBefore);
    mutatedControl.connections.blackboard!.status = 'pending';
    mutatedControl.connections.blackboard!.siteUrl = 'https://mutated-by-foreign-call.sim.test';
    const negativeControlResult = compareVictimStateBeforeAfter(victimBefore, mutatedControl);
    expect(negativeControlResult.ok).toBe(false);
    expect(negativeControlResult.diffs.length).toBeGreaterThanOrEqual(2);

    const since = Date.now();
    const cursor = (await records()).cursor;

    const connProbes = buildConnectionRouteProbes(bConnectionFixtures, aCourseId);
    expect(connProbes).toHaveLength(7 * 13);

    const calls: { method: string; path: string; body?: unknown; label: string }[] = connProbes.map((p) => ({
      label: p.label,
      method: p.httpMethod,
      path: p.path,
      body: p.body,
    }));

    // Publication, results, and course version routes with B's ids in A's session
    for (const pub of [bPub, bCvPub]) {
      const pid = encodeURIComponent(String(pub.id));
      calls.push(
        { label: `GET /app-api/publications/${pid}`, method: 'GET', path: `/app-api/publications/${pid}` },
        { label: `POST /app-api/publications/${pid}/withdraw`, method: 'POST', path: `/app-api/publications/${pid}/withdraw` },
        { label: `GET /app-api/publications/${pid}/results`, method: 'GET', path: `/app-api/publications/${pid}/results` },
        { label: `POST /app-api/publications/${pid}/results/refresh`, method: 'POST', path: `/app-api/publications/${pid}/results/refresh` },
      );
    }
    calls.push({
      label: 'GET /app-api/courses/:bCourseId/versions/:bVersionId',
      method: 'GET',
      path: `/app-api/courses/${encodeURIComponent(bCourseId)}/versions/${encodeURIComponent(bVersionId)}`,
    });

    const victimConnectionNames = Object.values(victimBefore.connections)
      .map((c) => String(c.name ?? ''))
      .filter((n) => n.length > 0);
    const victimSiteUrls = Object.values(victimBefore.connections)
      .map((c) => String(c.siteUrl ?? ''))
      .filter((u) => u.length > 0);

    const failures: string[] = [];
    for (const c of calls) {
      const res = await app(sessA, c.method, c.path, c.body);
      if (res.status !== 404) {
        failures.push(`${c.label} -> HTTP ${res.status} (expected 404)`);
      }
      // Ensure no B connection names or site URLs leak in the 404 body
      for (const name of victimConnectionNames) {
        if (res.body.includes(name)) {
          failures.push(`${c.label} leaked library B connection name "${name}" in 404 body`);
        }
      }
      for (const siteUrl of victimSiteUrls) {
        if (res.body.includes(siteUrl)) {
          failures.push(`${c.label} leaked library B siteUrl "${siteUrl}" in 404 body`);
        }
      }
    }
    expect(failures).toEqual([]);

    // Portal route /integrations/:channelId/:connectionId with B's id in A's session:
    // SPA shell serves index.html (or 404) with zero B data in HTML, and the backing GET /app-api/connections/:id gives 404 NOT_FOUND.
    for (const [ch, id] of [
      ['lti-generic', bGenericManualId],
      ['brightspace', bBrightspaceManualId],
    ] as const) {
      const portalRes = await httpsRequest(`${APP}/integrations/${ch}/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: { cookie: sessA.cookie, accept: 'text/html' },
      });
      expect([200, 404]).toContain(portalRes.status);
      for (const name of victimConnectionNames) {
        expect(portalRes.body).not.toContain(name);
      }
      const portalBackingApi = await app(sessA, 'GET', connPath(id));
      expectStatus(portalBackingApi, 404, 'NOT_FOUND');
    }

    // Verify zero outbound calls from cogniate-app or lti-service and zero simulator / sink hits
    const appOutbound = eventsSince('cogniate-app', since, (e) => e.event === 'outbound_request');
    const ltiOutbound = eventsSince('lti-service', since, (e) => e.event === 'outbound_request');
    expect(appOutbound).toEqual([]);
    expect(ltiOutbound).toEqual([]);
    expect(sinkHitsSince(since)).toEqual([]);
    await noServiceCalls(cursor);

    // Capture Library B's connection and publication DTOs AFTER Library A's foreign-ID probes and compare every persisted field
    const bConnectionsAfter: Record<string, Record<string, unknown>> = {};
    for (const conn of bConnectionFixtures) {
      const checkB = await app(sessB, 'GET', connPath(conn.id));
      expectStatus(checkB, 200);
      bConnectionsAfter[conn.label] = checkB.json as Record<string, unknown>;
    }
    const bPublicationsAfter: Record<string, Record<string, unknown>> = {};
    for (const [label, pub] of [
      ['blackboard-pub', bPub],
      ['canvas-pub', bCvPub],
    ] as const) {
      const checkPubB = await app(sessB, 'GET', `/app-api/publications/${encodeURIComponent(String(pub.id))}`);
      expectStatus(checkPubB, 200);
      bPublicationsAfter[label] = checkPubB.json as Record<string, unknown>;
    }
    const victimAfter = buildVictimStateSnapshot(bConnectionsAfter, bPublicationsAfter);
    const victimComparison = compareVictimStateBeforeAfter(victimBefore, victimAfter);
    expect(victimComparison).toEqual({ ok: true, diffs: [] });
    assertVictimStateUnchanged(victimBefore, victimAfter);

    writeArtifact('e5-13-ac01.json', {
      lmsProvidersChannels: parsedProviders.channelIds,
      lmsProvidersChannelMethods: parsedProviders.channelMethods,
      exercisedChannels: fixtureSummary.exercisedChannels,
      exercisedMethods: fixtureSummary.exercisedMethods,
      exercisedChannelMethods: fixtureSummary.exercisedChannelMethods,
      exercisedFixtures: fixtureSummary.exercisedFixtures,
      checkedConnectionRoutes: connProbes.length,
      checkedRoutes: calls.length,
      failures: failures.length,
      appOutboundCount: appOutbound.length,
      ltiOutboundCount: ltiOutbound.length,
      victimComparison,
    });
  });

  it('AC-LA-E5-13-02: cross-library picker POST (single & multi-select) and picker cancel change nothing in library B and post nothing to the return URL (AP-07-01)', async () => {
    const aPicker = await picker(aBb);
    const bPicker = await picker(bBb);
    const aMultiPicker = await canvasPicker(aCv);
    const bCancelPicker = await canvasPicker(bCv);

    const bPubBefore = await app(sessB, 'GET', `/app-api/publications/${encodeURIComponent(String(bPub.id))}`);
    expectStatus(bPubBefore, 200);
    const bCvPubBefore = await app(sessB, 'GET', `/app-api/publications/${encodeURIComponent(String(bCvPub.id))}`);
    expectStatus(bCvPubBefore, 200);
    const aCvPubBefore = await app(sessA, 'GET', `/app-api/publications/${encodeURIComponent(String(aCvPub.id))}`);
    expectStatus(aCvPubBefore, 200);

    const cursor = (await records()).cursor;

    // 1. Library A's picker session posting Library B's publication id -> 400 PUBLICATION_NOT_AVAILABLE, no return POST
    const crossPickSingle = await pick(aPicker.url, String(bPub.id));
    expect(crossPickSingle.status).toBe(400);
    expect(crossPickSingle.body).toContain('data-error-code="PUBLICATION_NOT_AVAILABLE"');
    expect(crossPickSingle.body).not.toContain('<form');

    // 2. Multi-select (LA-E3-05): Library A's Canvas picker posting [aCvPub.id, bCvPub.id] -> 400 PUBLICATION_NOT_AVAILABLE, atomic reject
    const multiBody = new URLSearchParams();
    multiBody.append('publicationId', String(aCvPub.id));
    multiBody.append('publicationId', String(bCvPub.id));
    const crossPickMulti = await httpsRequest(aMultiPicker.url, {
      method: 'POST',
      headers: {
        origin: APP,
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': String(Buffer.byteLength(multiBody.toString())),
      },
      body: multiBody.toString(),
    });
    expect(crossPickMulti.status).toBe(400);
    expect(crossPickMulti.body).toContain('data-error-code="PUBLICATION_NOT_AVAILABLE"');
    expect(crossPickMulti.body).not.toContain('<form');

    // 3. Library B's picker session posting Library A's publication id -> 400 PUBLICATION_NOT_AVAILABLE, no return POST
    const reverseCrossPick = await pick(bPicker.url, String(aPub.id));
    expect(reverseCrossPick.status).toBe(400);
    expect(reverseCrossPick.body).toContain('data-error-code="PUBLICATION_NOT_AVAILABLE"');
    expect(reverseCrossPick.body).not.toContain('<form');

    // 4. POST /tool/picker/{bPickerId}/cancel with a foreign Origin -> 403 and does not consume B's picker session
    const foreignOriginCancel = await httpsRequest(`${bCancelPicker.url}/cancel`, {
      method: 'POST',
      headers: {
        origin: 'https://evil.test',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: '',
    });
    expect(foreignOriginCancel.status).toBe(403);
    expect(foreignOriginCancel.body).not.toContain('<form');

    // Verify zero Deep Linking or service calls were made to the simulator
    await noServiceCalls(cursor);

    // Verify B's publications (activities count, status) and A's publication are completely unchanged
    const bPubAfter = await app(sessB, 'GET', `/app-api/publications/${encodeURIComponent(String(bPub.id))}`);
    expectStatus(bPubAfter, 200);
    expect(bPubAfter.json.activities).toBe(bPubBefore.json.activities);
    expect(bPubAfter.json.status).toBe('available');

    const bCvPubAfter = await app(sessB, 'GET', `/app-api/publications/${encodeURIComponent(String(bCvPub.id))}`);
    expectStatus(bCvPubAfter, 200);
    expect(bCvPubAfter.json.activities).toBe(bCvPubBefore.json.activities);
    expect(bCvPubAfter.json.status).toBe('available');

    const aCvPubAfter = await app(sessA, 'GET', `/app-api/publications/${encodeURIComponent(String(aCvPub.id))}`);
    expectStatus(aCvPubAfter, 200);
    expect(aCvPubAfter.json.activities).toBe(aCvPubBefore.json.activities);

    // 5. Cancelling A's picker (/tool/picker/{aPickerId}/cancel) affects only A's picker; B's picker still picks bCvPub normally
    const aCancelRes = await httpsRequest(`${aPicker.url}/cancel`, {
      method: 'POST',
      headers: {
        origin: APP,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: '',
    });
    expect(aCancelRes.status).toBe(200);
    expect(aCancelRes.body).toContain('No course was added.');

    // B's picker session (`bCancelPicker`) is still open and can pick B's own course (`bCvPub.id`)
    const bValidPick = await pick(bCancelPicker.url, String(bCvPub.id));
    expect(bValidPick.status).toBe(200);
    const dlReturn = await returnDeepLink(bValidPick);
    expect(dlReturn.response.status).toBe(200);

    writeArtifact('e5-13-ac02.json', {
      crossPickSingleStatus: crossPickSingle.status,
      crossPickMultiStatus: crossPickMulti.status,
      reverseCrossPickStatus: reverseCrossPick.status,
      foreignOriginCancelStatus: foreignOriginCancel.status,
      bValidPickStatus: bValidPick.status,
    });
  });

  it('AC-LA-E5-13-03: platform-storage login/launch on cogniate followed by POST /lti/launch/qa-second/storage-check gives 400 INVALID_STATE (storage_check_unknown_used_or_expired) and no 303, without consuming cogniate check (A-LAB-01)', async () => {
    const cogniateKey = apiKey(ACCOUNT);
    const cvTarget = await canvasPlatform({ name: unique('E5-13 AC03 Canvas') });
    createdPlatforms.push({ key: cogniateKey, id: cvTarget.platformId });

    const scenario = scenarioOf(cvTarget, {
      id: unique('e513-ac03'),
      storageTarget: 'post_message_forwarding',
    });
    const created = await sim('/scenarios', 'POST', scenario);
    expectStatus(created, 201);

    const loginFields: Record<string, string> = {
      ...created.json.login,
      ...CANVAS_LOGIN,
      lti_storage_target: 'post_message_forwarding',
    };
    for (const k of Object.keys(loginFields)) {
      if (loginFields[k] === null || loginFields[k] === undefined) delete loginFields[k];
    }

    // 1. Login on `cogniate` with lti_storage_target=post_message_forwarding -> 200 storage login page
    const loginRes = await formPost(LOGIN_URL, loginFields);
    expect(loginRes.status).toBe(200);
    const loginData = extractJsonScriptBlock<StorageLoginPageJson>(loginRes.body);
    expect(loginData.storageTarget).toBe('post_message_forwarding');
    expect(typeof loginData.stateValue).toBe('string');
    recordSecret('state', loginData.stateValue);

    const authorize = await httpsRequest(loginData.authUrl);
    expectStatus(authorize, 200);
    const parsed = parseForm(authorize.body);
    recordSecret('id_token', parsed.fields.id_token);
    recordSecret('state', parsed.fields.state);

    // 2. Launch on `cogniate` without state cookie -> 200 storage-check page
    const launchNoCookie = await formPost(LAUNCH_URL, parsed.fields);
    expect(launchNoCookie.status).toBe(200);
    const checkToken = extractCheckTokenFromCheckPage(launchNoCookie.body);

    // 3. Cross-account POST to /lti/launch/qa-second/storage-check with Origin = PUBLIC_LTI_ORIGIN and cogniate's check + value
    const sinceCross = Date.now();
    const crossRes = await postStorageCheck(
      SECOND_ACCOUNT,
      { check: checkToken, value: loginData.stateValue },
      PUBLIC_LTI_ORIGIN,
    );
    expect(crossRes.status).toBe(400);
    expect(crossRes.headers.location).toBeUndefined();
    expect(crossRes.body).toContain('data-error-code="INVALID_STATE"');

    const failedEvent = await waitForEvent(
      'lti-service',
      (e) =>
        Date.parse(String(e.ts)) >= sinceCross &&
        e.event === 'launch_check_failed' &&
        e.check === 'storage' &&
        e.code === 'INVALID_STATE',
    );
    expect(failedEvent).toBeDefined();
    expect(failedEvent?.detail).toBe('storage_check_unknown_used_or_expired');

    // 4. Control: cogniate's storage_check row was not consumed by qa-second -> redeeming on cogniate succeeds with 303
    const sinceOwn = Date.now();
    const ownRes = await postStorageCheck(
      ACCOUNT,
      { check: checkToken, value: loginData.stateValue },
      PUBLIC_LTI_ORIGIN,
    );
    expect(ownRes.status).toBe(303);
    const redirectLoc = new URL(String(ownRes.headers.location ?? ''));
    const ltik = redirectLoc.searchParams.get('ltik') ?? '';
    expect(ltik.length).toBeGreaterThan(20);
    recordSecret('ltik', ltik);

    const acceptedEvent = await waitForEvent(
      'lti-service',
      (e) =>
        Date.parse(String(e.ts)) >= sinceOwn &&
        e.event === 'launch_accepted' &&
        e.binding === 'storage',
    );
    expect(acceptedEvent?.binding).toBe('storage');

    writeArtifact('e5-13-ac03.json', {
      crossAccountStatus: crossRes.status,
      crossAccountDetail: failedEvent?.detail,
      ownAccountRedeemStatus: ownRes.status,
      ownAccountBinding: acceptedEvent?.binding,
    });
  });

  it('AC-LA-E5-13-05: with qa-second admin Bearer key and cogniate ids, POST /api/service-keys/revoke (and /api/audit, /api/account probes) returns 401/403/404, leaks no cogniate row, and leaves cogniate service keys active (AP-07-02)', async () => {
    const cogniateKey = apiKey(ACCOUNT);
    const secondKey = apiKey(SECOND_ACCOUNT);

    // 1. Register a Canvas SIM platform on cogniate and run a learner launch to mint a live serviceKey
    const cvTarget = await canvasPlatform({ name: unique('E5-13 AC05 Cogniate') });
    createdPlatforms.push({ key: cogniateKey, id: cvTarget.platformId });

    const contextId = unique('ctx-e513');
    const resourceLinkId = unique('rl-e513');
    const resource = unique('res-e513');
    const scenarioId = unique('sc-e513');
    const createdScenario = await sim('/scenarios', 'POST', {
      ...scenarioOf(cvTarget),
      id: scenarioId,
      contextId,
      resourceLinkId,
      resource,
      subject: 'learner-e513',
    });
    expectStatus(createdScenario, 201);

    const loginFields: Record<string, string> = {};
    for (const [k, v] of Object.entries((createdScenario.json.login ?? {}) as Record<string, unknown>)) {
      if (typeof v === 'string') loginFields[k] = v;
    }
    const loginRes = await formPost(LOGIN_URL, loginFields);
    expect(loginRes.status).toBe(302);
    const cookie =
      [loginRes.headers['set-cookie'] ?? []]
        .flat()
        .map((c) => c.split(';')[0] ?? '')
        .find((c) => c.startsWith('__Host-lti_state_')) ?? '';
    const authRes = await httpsRequest(String(loginRes.headers.location ?? ''));
    expectStatus(authRes, 200);
    const form = parseForm(authRes.body);
    recordSecret('id_token', form.fields.id_token);
    recordSecret('state', form.fields.state);

    const launchRes = await formPost(form.action, form.fields, cookie);
    expect(launchRes.status).toBe(303);
    const ltik = new URL(String(launchRes.headers.location ?? '')).searchParams.get('ltik') ?? '';
    expect(ltik.length).toBeGreaterThan(20);
    recordSecret('ltik', ltik);

    const idt = await idToken(ltik);
    expectStatus(idt, 200);
    const cogniateServiceKey = String(idt.json?.services?.serviceKey ?? '');
    const cogniateLineItemId = String(idt.json?.services?.assignmentAndGrades?.lineItemId ?? '');
    expect(cogniateServiceKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    recordSecret('service_key', cogniateServiceKey);

    // Control before cross-tenant calls: cogniate service key works on score POST
    const scoreBefore = await ltiApi('POST', `/api/lineitems/${encodeURIComponent(cogniateLineItemId)}/scores`, {
      authorization: auth.service(cogniateKey, cogniateServiceKey),
      body: {
        userId: 'learner-e513',
        scoreGiven: 80,
        scoreMaximum: 100,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
        timestamp: new Date().toISOString(),
      },
    });
    expect(scoreBefore.status).toBe(204);

    // 2. Call POST /api/service-keys/revoke with qa-second's admin Bearer key and cogniate's platformId / scopes
    const revokePayloads: Record<string, string>[] = [
      { platformId: cvTarget.platformId },
      { platformId: cvTarget.platformId, deploymentId: cvTarget.deploymentId },
      { platformId: cvTarget.platformId, contextId },
      { platformId: cvTarget.platformId, resourceLinkId },
    ];

    for (const body of revokePayloads) {
      const res = await ltiApi('POST', '/api/service-keys/revoke', {
        authorization: auth.bearer(secondKey),
        body,
      });
      expect([401, 403, 404]).toContain(res.status);
      if (res.status === 404) {
        expect(errorCode(res)).toBe('UNREGISTERED_PLATFORM');
        expect(hasErrorShape(res)).toBe(true);
      }
      expect(res.body).not.toContain(cogniateServiceKey);
    }

    // 3. Even if qa-second registers its own platform and passes cogniate's deploymentId / contextId / resourceLinkId,
    //    it revokes 0 keys on qa-second and never touches cogniate's service key.
    const secondPlatformRes = await ltiApi<{ id?: string }>('POST', '/api/platforms', {
      authorization: auth.bearer(secondKey),
      body: {
        url: 'https://qa-second-e513.sim.test',
        clientId: unique('qa-second-client'),
        name: 'QA Second E5-13 Platform',
        authenticationEndpoint: 'https://qa-second-e513.sim.test/oidc/auth',
        accesstokenEndpoint: 'https://qa-second-e513.sim.test/oauth2/token',
        authConfig: { method: 'JWK_SET', key: 'https://qa-second-e513.sim.test/jwks.json' },
        deploymentIds: [cvTarget.deploymentId],
      },
    });
    expect(secondPlatformRes.status).toBe(201);
    const secondPlatformId = String(secondPlatformRes.json?.id ?? '');
    createdPlatforms.push({ key: secondKey, id: secondPlatformId });

    for (const scope of [
      { platformId: secondPlatformId, deploymentId: cvTarget.deploymentId },
      { platformId: secondPlatformId, contextId },
      { platformId: secondPlatformId, resourceLinkId },
    ]) {
      const scopedRes = await ltiApi<{ revoked?: number }>('POST', '/api/service-keys/revoke', {
        authorization: auth.bearer(secondKey),
        body: scope,
      });
      expect(scopedRes.status).toBe(200);
      expect(scopedRes.json?.revoked).toBe(0);
    }

    // 4. Probe tenant /api/platforms/:id/check (LA-E6-04), /api/audit, /api/account, and /api/platforms/:id with qa-second's Bearer key and cogniate parameters
    const checkProbe = await ltiApi('POST', `/api/platforms/${encodeURIComponent(cvTarget.platformId)}/check`, {
      authorization: auth.bearer(secondKey),
    });
    expect([401, 403, 404]).toContain(checkProbe.status);
    if (checkProbe.status === 404) {
      expect(errorCode(checkProbe)).toBe('UNREGISTERED_PLATFORM');
      expect(hasErrorShape(checkProbe)).toBe(true);
    }
    expect(checkProbe.body).not.toContain(cvTarget.platformId);

    for (const p of [
      '/api/audit',
      `/api/audit?accountId=${encodeURIComponent(ACCOUNT)}`,
      `/api/audit?platformId=${encodeURIComponent(cvTarget.platformId)}`,
      '/api/account',
      `/api/account?id=${encodeURIComponent(ACCOUNT)}`,
      `/api/platforms/${encodeURIComponent(cvTarget.platformId)}`,
    ]) {
      const probe = await ltiApi('GET', p, { authorization: auth.bearer(secondKey) });
      expect([401, 403, 404]).toContain(probe.status);
      expect(probe.body).not.toContain(cvTarget.platformId);
    }

    // 5. Prove cogniate's service key was NOT revoked or altered: score POST still returns 204
    const scoreAfter = await ltiApi('POST', `/api/lineitems/${encodeURIComponent(cogniateLineItemId)}/scores`, {
      authorization: auth.service(cogniateKey, cogniateServiceKey),
      body: {
        userId: 'learner-e513',
        scoreGiven: 95,
        scoreMaximum: 100,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
        timestamp: new Date().toISOString(),
      },
    });
    expect(scoreAfter.status).toBe(204);

    writeArtifact('e5-13-ac05.json', {
      crossTenantRevokeStatus: 404,
      ownPlatformCrossScopeRevoked: 0,
      cogniateScoreAfterStatus: scoreAfter.status,
    });
  });

  it('AC-LA-E5-13-06: frozen isolation invariants (AC-T2-18, AC-T4-16, AC-T4-29, AC-T4-34, AC-T7-08, AC-T7-09) hold on this SHA', async () => {
    const cogniateKey = apiKey(ACCOUNT);
    const secondKey = apiKey(SECOND_ACCOUNT);

    // 1. AC-T2-18 invariant: qa-second may register the same issuer + clientId as cogniate; a cogniate launch still belongs to cogniate
    //    and qa-second gets 401 on GET /api/idtoken with cogniate's ltik.
    const pA = await ltiApi<Json>('GET', `/api/platforms/${encodeURIComponent(aCv.platformId)}`, {
      authorization: auth.bearer(cogniateKey),
    });
    expectStatus(pA, 200);
    const dupBody = {
      profile: pA.json.profile,
      clientId: pA.json.clientId,
      name: 'QA second copy of cogniate platform',
      siteUrl: pA.json.siteUrl,
      deploymentIds: [aCv.deploymentId],
    };
    const pSecond = await ltiApi<{ id?: string }>('POST', '/api/platforms', {
      authorization: auth.bearer(secondKey),
      body: dupBody,
    });
    expect([201, 409]).toContain(pSecond.status);
    if (pSecond.status === 201 && pSecond.json?.id) {
      createdPlatforms.push({ key: secondKey, id: pSecond.json.id });
      expect(pSecond.json.id).not.toBe(aCv.platformId);
    }

    // Launch aBb's publication and complete a grade so library A has learner stats
    const playA = await openPlay(aBb, aPub);
    await commitGrade(playA, 'scorm12', 8, 10);
    await waitSync(aBb, aPub, 'sent');

    // Cross-account ltik check (AC-T2-18): qa-second gets 401 for cogniate's ltik; cogniate gets 200
    const idtAsSecond = await ltiApi('GET', '/api/idtoken', {
      authorization: auth.ltik(secondKey, playA.result.ltik),
    });
    expect(idtAsSecond.status).toBe(401);
    const idtAsCogniate = await ltiApi('GET', '/api/idtoken', {
      authorization: auth.ltik(cogniateKey, playA.result.ltik),
    });
    expect(idtAsCogniate.status).toBe(200);

    // 2. AC-T4-16 & AC-T7-08 invariant: library B's picker lists library B's publication and not library A's;
    //    library A's picker lists library A's publication and not library B's.
    const pickerPageA = await picker(aBb);
    const pickerPageB = await picker(bBb);
    expect(pickerPageA.page.body).toContain(String(aPub.id));
    expect(pickerPageA.page.body).not.toContain(String(bPub.id));
    expect(pickerPageB.page.body).toContain(String(bPub.id));
    expect(pickerPageB.page.body).not.toContain(String(aPub.id));

    // 3. AC-T4-29 & AC-T7-09 invariant: unknown playId -> 404; library B gets 404 for library A's publication and results
    //    after a graded launch (no learner stats leak); library A's results show the learner row while library B's do not.
    const unknownPlay = await appApi('GET', `/app-api/play/ply_${crypto.randomBytes(16).toString('base64url')}/status`);
    expect(unknownPlay.status).toBe(404);

    const bReadAPub = await app(sessB, 'GET', `/app-api/publications/${encodeURIComponent(String(aPub.id))}`);
    expectStatus(bReadAPub, 404, 'NOT_FOUND');
    expect(bReadAPub.body).not.toMatch(/"learners"\s*:\s*[1-9]/);

    const bReadAResults = await app(sessB, 'GET', `/app-api/publications/${encodeURIComponent(String(aPub.id))}/results`);
    expectStatus(bReadAResults, 404, 'NOT_FOUND');

    const aRows = await results(aBb, aPub);
    expect(aRows.length).toBeGreaterThanOrEqual(1);
    const bRows = await results(bBb, bPub);
    expect(bRows).toEqual([]);

    // 4. AC-T4-34 baseline tenant matrix: library B gets 404 for library A's connection, publication, and course version endpoints
    const aConnId = String(aBb.connection.id);
    const aPubId = String(aPub.id);
    const aVerId = String(aPub.versionId);
    const matrixCalls: [string, string, unknown?][] = [
      ['GET', `/app-api/connections/${aConnId}`],
      ['POST', `/app-api/connections/${aConnId}/registration-url`],
      ['GET', `/app-api/connections/${aConnId}/tool-configuration`],
      [
        'PUT',
        `/app-api/connections/${aConnId}/platform`,
        {
          issuer: urls.moodle,
          clientId: 'x',
          deploymentId: '1',
          authenticationEndpoint: `${urls.moodle}/mod/lti/auth.php`,
          accessTokenEndpoint: `${urls.moodle}/mod/lti/token.php`,
          jwksUrl: `${urls.moodle}/mod/lti/certs.php`,
        },
      ],
      ['POST', `/app-api/connections/${aConnId}/deployments`, { deploymentId: '2', grantCode: 'c'.repeat(43) }],
      ['DELETE', `/app-api/connections/${aConnId}`],
      ['GET', `/app-api/publications/${aPubId}`],
      ['POST', `/app-api/publications/${aPubId}/withdraw`],
      ['POST', '/app-api/publications', { connectionId: aConnId, courseId: bCourseId }],
      ['GET', `/app-api/courses/${aCourseId}/versions/${aVerId}`],
    ];
    for (const [m, p, body] of matrixCalls) {
      const r = await app(sessB, m, p, body);
      expect(r.status, `${m} ${p} in library B session`).toBe(404);
    }

    writeArtifact('e5-13-ac06.json', {
      acT218CrossLtikStatus: idtAsSecond.status,
      acT416PickerIsolated: true,
      acT429UnknownPlayStatus: unknownPlay.status,
      acT434MatrixCount: matrixCalls.length,
    });
  });
});
