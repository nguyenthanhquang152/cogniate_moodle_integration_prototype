// LA-E5-14 K1-SIM acceptance tests: Platform throttling answer 429 PLATFORM_RATE_LIMITED
// (AC-LA-E5-14-01, AC-LA-E5-14-02, AC-LA-E5-14-03, AC-LA-E5-14-04, AC-LA-E5-14-05).
// Source: docs/architecture/ltiaas/tasks/LA-E5-14.md (at 4c11521); contract delta §1.3, §1.6, §4.3, §6, §9; LA-ADR-03 D7; LA-ADR-04 D8 LA-IC-11; BD-A2-15, BD-A2-16.
// QA-4 wrote these tests from the spec, contracts and ADRs only (test-first).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT,
  apiKey,
  auth,
  errorCode,
  eventsSince,
  hasErrorShape,
  ltiApi,
  waitForEvent,
  type ApiResult,
} from '../../../acceptance/lib/lti';
import {
  AGS,
  NRPS,
  expectStatus,
  idToken,
  pause,
  records,
  service,
  unique,
  type Json,
} from '../../../acceptance/M1/common/client';
import { CLOUD, PATHS, canvasLaunch, canvasPlatform } from '../../../acceptance/M1/canvas/canvas';

const SCOPES = {
  lineitem: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  readonly: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  score: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  result: 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
  nrps: 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
} as const;

const EXPECTED_DESCRIPTION = 'The platform asked us to wait before another request.';

function writeArtifact(name: string, content: string): void {
  const runDir = process.env.LA_RUN_DIR;
  if (!runDir) return;
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(runDir, name), content, { mode: 0o600 });
}

function headerValue(res: ApiResult, name: string): string | undefined {
  const raw = res.headers[name] ?? res.headers[name.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

function retryAfterDetails(res: ApiResult): unknown {
  const j = res.json as { details?: { retryAfter?: unknown } } | null;
  return j?.details?.retryAfter;
}

function errorDescription(res: ApiResult): unknown {
  const j = res.json as { details?: { description?: unknown } } | null;
  return j?.details?.description;
}

/**
 * Registers a fresh Canvas simulator platform (unique clientId => isolated cold token cache)
 * and performs a learner launch with the given scenario patch.
 */
async function launchOnFreshSimPlatform(label: string, scenarioPatch: Json = {}) {
  const target = await canvasPlatform({ name: unique(`QA4 E5-14 ${label}`) });
  const resource = unique(`res-${label}`);
  const lineitems = `${CLOUD.siteA}${PATHS.lineitems}`;
  const lineitem = `${lineitems}/${encodeURIComponent(resource)}`;
  const nrpsUrl = `${CLOUD.siteA}${PATHS.nrps}`;

  const launched = await canvasLaunch(target, {
    resource,
    resourceLinkId: unique(`rl-${label}`),
    contextId: unique(`ctx-${label}`),
    subject: `learner-${label}`,
    claims: {
      [AGS]: {
        lineitems,
        lineitem,
        scope: [SCOPES.lineitem, SCOPES.readonly, SCOPES.score, SCOPES.result],
      },
      [NRPS]: {
        context_memberships_url: nrpsUrl,
        service_versions: ['2.0'],
      },
      ...(scenarioPatch.claims ?? {}),
    },
    ...scenarioPatch,
  });
  expect(launched.response.status, `launch (${label}) status`).toBe(303);
  expect(launched.ltik, `launch (${label}) returned ltik`).toBeTruthy();

  const tok = await idToken(launched.ltik);
  expectStatus(tok, 200);
  const serviceKey = String(tok.json?.services?.serviceKey ?? '');
  const lineItemId = String(tok.json?.services?.assignmentAndGrades?.lineItemId ?? lineitem);
  const userId = String(tok.json?.user?.id ?? `learner-${label}`);
  expect(serviceKey, `launch (${label}) serviceKey`).toMatch(/^[A-Za-z0-9_-]{43}$/);

  return {
    target,
    platformId: target.platformId,
    resource,
    ltik: launched.ltik,
    serviceKey,
    lineItemId,
    userId,
  };
}

function scorePayload(userId: string) {
  return {
    userId,
    scoreGiven: 85,
    scoreMaximum: 100,
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
    timestamp: new Date().toISOString(),
  };
}

describe('LA-E5-14 Platform throttling answer 429 PLATFORM_RATE_LIMITED (K1-SIM)', () => {
  it('[SIM] AC-LA-E5-14-01: simulator score POST 429 with Retry-After: 120 gives 429 PLATFORM_RATE_LIMITED, header Retry-After: 120 and details.retryAfter: 120 {case:LA-E5-14-01}', async () => {
    const ctx = await launchOnFreshSimPlatform('ac01', {
      scoreAnswers: [
        {
          status: 429,
          retryAfter: 120,
          headers: { 'Retry-After': '120', 'retry-after': '120' },
          message: 'Too Many Requests',
        },
      ],
    });

    const res = await service(
      ctx.serviceKey,
      'POST',
      `/api/lineitems/${encodeURIComponent(ctx.lineItemId)}/scores`,
      scorePayload(ctx.userId),
    );

    expect(res.status, `score POST status; body=${res.body}`).toBe(429);
    expect(hasErrorShape(res), 'response matches contract §1.3 error shape').toBe(true);
    expect(errorCode(res), 'details.message').toBe('PLATFORM_RATE_LIMITED');
    expect(errorDescription(res), 'BD-A2-15 fixed description without platform text').toBe(EXPECTED_DESCRIPTION);
    expect(headerValue(res, 'retry-after'), 'Retry-After header').toBe('120');
    expect(retryAfterDetails(res), 'details.retryAfter').toBe(120);

    writeArtifact(
      'e5-14-ac01.json',
      `${JSON.stringify({ status: res.status, retryAfterHeader: headerValue(res, 'retry-after'), body: res.json }, null, 2)}\n`,
    );
  });

  it('[SIM] AC-LA-E5-14-02: simulator 403 with Rate Limit Exceeded in body gives 429 PLATFORM_RATE_LIMITED; 403 with another body keeps today answer {case:LA-E5-14-02}', async () => {
    const ctx = await launchOnFreshSimPlatform('ac02', {
      scoreAnswers: [
        {
          status: 403,
          message: '403 Forbidden (Rate Limit Exceeded)',
          body: '403 Forbidden (Rate Limit Exceeded)',
        },
        {
          status: 403,
          message: 'Forbidden: gradebook column is locked for this user',
          body: 'Forbidden: gradebook column is locked for this user',
        },
      ],
    });

    const scoresPath = `/api/lineitems/${encodeURIComponent(ctx.lineItemId)}/scores`;

    // 1. 403 with "Rate Limit Exceeded" in body -> 429 PLATFORM_RATE_LIMITED (default Retry-After: 60 when header absent).
    const throttled = await service(ctx.serviceKey, 'POST', scoresPath, scorePayload(ctx.userId));
    expect(throttled.status, `403 Rate Limit Exceeded -> 429; body=${throttled.body}`).toBe(429);
    expect(hasErrorShape(throttled), 'throttled response matches error shape').toBe(true);
    expect(errorCode(throttled), 'throttled details.message').toBe('PLATFORM_RATE_LIMITED');
    expect(errorDescription(throttled), 'BD-A2-15 fixed description without platform body').toBe(EXPECTED_DESCRIPTION);
    expect(throttled.body.includes('Rate Limit Exceeded'), 'no platform body text leaks into answer').toBe(false);
    expect(headerValue(throttled, 'retry-after'), 'default Retry-After header when absent').toBe('60');
    expect(retryAfterDetails(throttled), 'default details.retryAfter when absent').toBe(60);

    // 2. 403 with another body -> keeps today's answer (502 PLATFORM_ERROR).
    const other403 = await service(ctx.serviceKey, 'POST', scoresPath, scorePayload(ctx.userId));
    expect(other403.status, `non-rate-limit 403 keeps today status (502); body=${other403.body}`).toBe(502);
    expect(hasErrorShape(other403), 'other 403 matches error shape').toBe(true);
    expect(errorCode(other403), 'other 403 keeps PLATFORM_ERROR').toBe('PLATFORM_ERROR');
    expect(headerValue(other403, 'retry-after'), 'other 403 has no Retry-After header').toBeUndefined();

    writeArtifact(
      'e5-14-ac02.json',
      `${JSON.stringify(
        {
          throttled403: {
            status: throttled.status,
            retryAfterHeader: headerValue(throttled, 'retry-after'),
            body: throttled.json,
          },
          other403: {
            status: other403.status,
            body: other403.json,
          },
        },
        null,
        2,
      )}\n`,
    );
  });

  it('[SIM] AC-LA-E5-14-03: simulator token endpoint 429 without Retry-After gives 429 PLATFORM_RATE_LIMITED with Retry-After: 60 {case:LA-E5-14-03}', async () => {
    const ctx = await launchOnFreshSimPlatform('ac03', {
      tokenAnswers: [{ status: 429, message: 'Too Many Requests' }],
      tokenAnswer: { status: 429, message: 'Too Many Requests' },
      tokenStatus: 429,
    });

    const res = await service(
      ctx.serviceKey,
      'POST',
      `/api/lineitems/${encodeURIComponent(ctx.lineItemId)}/scores`,
      scorePayload(ctx.userId),
    );

    expect(res.status, `token 429 -> API 429; body=${res.body}`).toBe(429);
    expect(hasErrorShape(res), 'response matches contract §1.3 error shape').toBe(true);
    expect(errorCode(res), 'details.message').toBe('PLATFORM_RATE_LIMITED');
    expect(errorDescription(res), 'BD-A2-15 fixed description').toBe(EXPECTED_DESCRIPTION);
    expect(headerValue(res, 'retry-after'), 'Retry-After defaults to 60 when absent').toBe('60');
    expect(retryAfterDetails(res), 'details.retryAfter defaults to 60 when absent').toBe(60);

    writeArtifact(
      'e5-14-ac03.json',
      `${JSON.stringify({ status: res.status, retryAfterHeader: headerValue(res, 'retry-after'), body: res.json }, null, 2)}\n`,
    );
  });

  it('[SIM] AC-LA-E5-14-04: simulator GET memberships 429 gives 429 PLATFORM_RATE_LIMITED on GET /api/memberships {case:LA-E5-14-04}', async () => {
    const ctx = await launchOnFreshSimPlatform('ac04', {
      nrpsAnswers: [
        {
          status: 429,
          retryAfter: 45,
          headers: { 'Retry-After': '45', 'retry-after': '45' },
          message: 'Too Many Requests',
        },
      ],
      nrpsAnswer: {
        status: 429,
        retryAfter: 45,
        headers: { 'Retry-After': '45', 'retry-after': '45' },
        message: 'Too Many Requests',
      },
      membershipsAnswers: [
        {
          status: 429,
          retryAfter: 45,
          headers: { 'Retry-After': '45', 'retry-after': '45' },
          message: 'Too Many Requests',
        },
      ],
      membershipsAnswer: {
        status: 429,
        retryAfter: 45,
        headers: { 'Retry-After': '45', 'retry-after': '45' },
        message: 'Too Many Requests',
      },
      nrpsStatus: 429,
      membershipsStatus: 429,
    });

    const key = apiKey(ACCOUNT);
    const res = await ltiApi<Json>('GET', '/api/memberships', {
      authorization: auth.ltik(key, ctx.ltik),
    });

    expect(res.status, `GET /api/memberships status; body=${res.body}`).toBe(429);
    expect(hasErrorShape(res), 'response matches contract §1.3 error shape').toBe(true);
    expect(errorCode(res), 'details.message').toBe('PLATFORM_RATE_LIMITED');
    expect(errorDescription(res), 'BD-A2-15 fixed description').toBe(EXPECTED_DESCRIPTION);
    const retryHeader = Number(headerValue(res, 'retry-after'));
    expect(
      Number.isInteger(retryHeader) && retryHeader >= 1 && retryHeader <= 3600,
      'Retry-After header is whole seconds in 1..3600 (BD-A2-16)',
    ).toBe(true);
    expect(retryAfterDetails(res), 'details.retryAfter matches Retry-After header (BD-A2-16)').toBe(retryHeader);

    writeArtifact(
      'e5-14-ac04.json',
      `${JSON.stringify({ status: res.status, retryAfterHeader: headerValue(res, 'retry-after'), body: res.json }, null, 2)}\n`,
    );
  });

  it('[SIM] AC-LA-E5-14-05: one throttled score POST records exactly one simulator score request (no automatic retry) and logs one platform_rate_limited event {case:LA-E5-14-05}', async () => {
    const ctx = await launchOnFreshSimPlatform('ac05', {
      scoreAnswers: [
        {
          status: 429,
          retryAfter: 120,
          headers: { 'Retry-After': '120', 'retry-after': '120' },
          message: 'Too Many Requests',
        },
        { status: 204 },
      ],
    });

    const cursor = (await records()).cursor;
    const sinceMs = Date.now() - 500;

    const res = await service(
      ctx.serviceKey,
      'POST',
      `/api/lineitems/${encodeURIComponent(ctx.lineItemId)}/scores`,
      scorePayload(ctx.userId),
    );

    expect(res.status, `throttled score POST status; body=${res.body}`).toBe(429);
    expect(errorCode(res), 'details.message').toBe('PLATFORM_RATE_LIMITED');
    expect(headerValue(res, 'retry-after'), 'Retry-After header').toBe('120');
    expect(retryAfterDetails(res), 'details.retryAfter').toBe(120);

    // Wait briefly so any forbidden automatic retry inside lti-service would appear in simulator records.
    await pause(1_500);

    const simEntries = (await records(cursor)).records.filter(
      (r: Json) => r.kind === 'score' && r.resource === ctx.resource,
    );
    expect(simEntries, 'simulator recorded exactly one score request (no automatic retry)').toHaveLength(1);
    expect(simEntries[0].status, 'recorded simulator score status').toBe(429);

    const found = await waitForEvent(
      'lti-service',
      (e) =>
        e.event === 'platform_rate_limited' &&
        (e.trace_id === res.traceId || e.platform_id === ctx.platformId),
      5_000,
    );
    expect(found, 'lti-service logged platform_rate_limited').toBeDefined();

    const matchingLogs = eventsSince(
      'lti-service',
      sinceMs,
      (e) =>
        e.event === 'platform_rate_limited' &&
        (e.trace_id === res.traceId || e.platform_id === ctx.platformId),
    );
    expect(matchingLogs, 'exactly one platform_rate_limited log line for the throttled score POST').toHaveLength(1);
    expect(matchingLogs[0].level, 'log level is warn').toBe('warn');
    expect(matchingLogs[0].platform_id, 'log platform_id').toBe(ctx.platformId);
    expect(matchingLogs[0].status, 'log status').toBe(429);
    expect(matchingLogs[0].retry_after_s, 'log retry_after_s').toBe(120);

    writeArtifact(
      'e5-14-ac05.json',
      `${JSON.stringify(
        {
          platformId: ctx.platformId,
          traceId: res.traceId,
          simScoreRecordCount: simEntries.length,
          logEvents: matchingLogs,
        },
        null,
        2,
      )}\n`,
    );
  });
});
