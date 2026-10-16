// T3a: service keys, scores, line item reads, token cache, outbound events on the activity of 1-deep-linking.spec.ts.
// Source: tasks/T3a.md AC-T3-11, -12, -13, -14, -22, -24; contract §3.3 to §3.6, §4, §5; security §9.
import type { BrowserContext } from '@playwright/test';
import { publicUrls } from '../lib/env';
import { ACCOUNT, apiKey, type ApiResult, auth, eventsSince, hostIs, loadState, ltiApi, saveState, recordSecret } from '../lib/lti';
import { launchActivity, newStackContext } from '../lib/moodle-launch';
import { moodleLogin } from '../lib/moodle-ui';
import { gradeItems } from '../lib/moodle-ws';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();
const MOODLE_HOST = new URL(urls.moodle).hostname;

interface IdToken {
  services: { assignmentAndGrades: { available: boolean; lineItemId?: string }; serviceKey?: string };
}

const enc = encodeURIComponent;

async function waitForGrade(userId: number, title: string, want: number, timeoutMs = 20_000): Promise<number | null> {
  const deadline = Date.now() + timeoutMs;
  let last: number | null = null;
  while (Date.now() < deadline) {
    const item = (await gradeItems(seed().oracleToken, seed().courses['COGNIATE-DEV-101'], userId)).find((i) => i.itemname === title);
    last = item?.graderaw ?? null;
    if (last !== null && Number(last) === want) return Number(last);
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return last;
}

function score(userId: number, scoreGiven: number) {
  return { userId: String(userId), activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven, scoreMaximum: 100 };
}

test.describe.serial('T3a service keys and scores ("QA DL")', () => {
  let context: BrowserContext;
  let title = '';
  let cmid = 0;
  let ltik = '';
  let lineItemId = '';
  let serviceKey = '';
  const platformCalls: ApiResult[] = [];

  test.beforeAll(async ({ browser }) => {
    const state = loadState('T3a');
    title = String(state.title ?? '');
    cmid = Number(state.cmid ?? 0);
    expect(cmid, 'AC-T3-07 made the "QA DL" activity (1-deep-linking.spec.ts)').toBeGreaterThan(0);
    context = await newStackContext(browser);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T3-11 a launch of "QA DL" has AGS with a Moodle line item and a service key; a second learner gets the same key', async () => {
    const key = apiKey(ACCOUNT);
    const a = await launchActivity(context, seed().users.cg_student, cmid);
    const ta = await ltiApi<IdToken>('GET', '/api/idtoken', { authorization: auth.ltik(key, a.ltik!) });
    expect(ta.status, ta.body).toBe(200);
    expect(ta.json.services.assignmentAndGrades.available).toBe(true);
    lineItemId = String(ta.json.services.assignmentAndGrades.lineItemId ?? '');
    expect(lineItemId.startsWith(`${urls.moodle}/mod/lti/services.php/`), lineItemId).toBe(true);
    serviceKey = String(ta.json.services.serviceKey ?? '');
    expect(serviceKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    recordSecret('service_key', serviceKey);
    ltik = a.ltik!;

    const b = await launchActivity(context, seed().users.cg_student2, cmid);
    const tb = await ltiApi<IdToken>('GET', '/api/idtoken', { authorization: auth.ltik(key, b.ltik!) });
    expect(tb.json.services.serviceKey).toBe(serviceKey);
    saveState('T3a', { lineItemId, serviceKey, studentLtik: ltik });
  });

  test('AC-T3-12 POST scores with the ltik → 204, and Moodle shows 87 for cg_student', async ({ page }, testInfo) => {
    const res = await ltiApi('POST', `/api/lineitems/${enc(lineItemId)}/scores`, { authorization: auth.ltik(apiKey(ACCOUNT), ltik), body: score(seed().users.cg_student.id, 87) });
    platformCalls.push(res);
    expect(res.status, res.body).toBe(204);
    expect(await waitForGrade(seed().users.cg_student.id, title, 87)).toBe(87);
    await moodleLogin(page, urls.moodle, seed().users.cg_teacher.username, seed().users.cg_teacher.password);
    await page.goto(`${urls.moodle}/grade/report/grader/index.php?id=${seed().courses['COGNIATE-DEV-101']}`);
    await page.screenshot({ path: testInfo.outputPath('grader-report-87.png'), fullPage: true });
  });

  test('AC-T3-13 SERVICE-AUTH-V1 scores 91 then 92 within one second → both 204; Moodle shows 92', async () => {
    const authz = auth.service(apiKey(ACCOUNT), serviceKey);
    const first = await ltiApi('POST', `/api/lineitems/${enc(lineItemId)}/scores`, { authorization: authz, body: score(seed().users.cg_student.id, 91) });
    const second = await ltiApi('POST', `/api/lineitems/${enc(lineItemId)}/scores`, { authorization: authz, body: score(seed().users.cg_student.id, 92) });
    platformCalls.push(first, second);
    expect(first.status, first.body).toBe(204);
    expect(second.status, second.body).toBe(204);
    expect(await waitForGrade(seed().users.cg_student.id, title, 92)).toBe(92);
  });

  test('AC-T3-14 GET /api/lineitems, GET the item, and GET its scores for cg_student (92 of 100)', async () => {
    const authz = auth.ltik(apiKey(ACCOUNT), ltik);
    const list = await ltiApi<{ lineItems: { id: string; label: string; scoreMaximum: number }[] }>('GET', '/api/lineitems', { authorization: authz });
    platformCalls.push(list);
    expect(list.status, list.body).toBe(200);
    const mine = list.json.lineItems.find((i) => i.label === title);
    expect(mine, `line item "${title}"`).toBeDefined();
    expect(Number(mine!.scoreMaximum)).toBe(100);

    const one = await ltiApi<{ id: string; label: string; scoreMaximum: number }>('GET', `/api/lineitems/${enc(mine!.id)}`, { authorization: authz });
    platformCalls.push(one);
    expect(one.status, one.body).toBe(200);
    expect(one.json).toMatchObject({ id: mine!.id, label: title, scoreMaximum: mine!.scoreMaximum });

    const scores = await ltiApi<{ scores: { userId: string; resultScore: number; resultMaximum: number }[] }>(
      'GET',
      `/api/lineitems/${enc(mine!.id)}/scores?userId=${enc(String(seed().users.cg_student.id))}`,
      { authorization: authz },
    );
    platformCalls.push(scores);
    expect(scores.status, scores.body).toBe(200);
    expect(Number(scores.json.scores[0]?.resultScore)).toBe(92);
    expect(Number(scores.json.scores[0]?.resultMaximum)).toBe(100);
  });

  test('AC-T3-24 each platform call of AC-T3-12 to AC-T3-14 has one outbound_request to Moodle with the trace id of its API response', async () => {
    // A token request on a cache miss is a second platform call for the same API response; it shows as
    // platform_token {cache: "miss"} with the same trace id. So: outbound_request count = 1 + misses.
    await new Promise((r) => setTimeout(r, 1_500));
    const problems: string[] = [];
    for (const res of platformCalls) {
      const out = eventsSince('lti-service', 0, (e) => e.event === 'outbound_request' && e.trace_id === res.traceId);
      const misses = eventsSince('lti-service', 0, (e) => e.event === 'platform_token' && e.trace_id === res.traceId && e.cache === 'miss').length;
      const notMoodle = out.filter((e) => !hostIs(e, MOODLE_HOST));
      if (!res.traceId) problems.push(`HTTP ${res.status} response has no X-Trace-Id`);
      if (out.length !== 1 + misses) problems.push(`trace ${res.traceId}: ${out.length} outbound_request, want 1 + ${misses} token miss(es)`);
      if (notMoodle.length) problems.push(`trace ${res.traceId}: outbound_request to ${notMoodle.map((e) => String(e.host)).join(', ')}`);
    }
    expect(platformCalls.length).toBeGreaterThanOrEqual(6);
    expect(problems).toEqual([]);
  });

  test('AC-T3-22 two score posts within 60 s: at most one platform_token miss, and the second post is a cache hit', async () => {
    const authz = auth.service(apiKey(ACCOUNT), serviceKey);
    const a = await ltiApi('POST', `/api/lineitems/${enc(lineItemId)}/scores`, { authorization: authz, body: score(seed().users.cg_student.id, 93) });
    const b = await ltiApi('POST', `/api/lineitems/${enc(lineItemId)}/scores`, { authorization: authz, body: score(seed().users.cg_student.id, 94) });
    expect(a.status, a.body).toBe(204);
    expect(b.status, b.body).toBe(204);
    await new Promise((r) => setTimeout(r, 1_500));
    const tokens = (trace: string) => eventsSince('lti-service', 0, (e) => e.event === 'platform_token' && e.trace_id === trace);
    const all = [...tokens(a.traceId), ...tokens(b.traceId)];
    expect(all.filter((e) => e.cache === 'miss').length, 'misses for the two posts').toBeLessThanOrEqual(1);
    expect(tokens(b.traceId).map((e) => e.cache), 'second post').toEqual(['hit']);
  });
});
