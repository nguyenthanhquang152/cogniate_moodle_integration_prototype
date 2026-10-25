// Slot 6 R2-sim browser & protocol suite on `moodle-sim` (https://moodle.sim.test).
// File ends in .r2sim.ts so the frozen T7 suite (tests/playwright.config.ts testMatch **/*.spec.ts) never selects it (WE-F9).
// Covers manual Moodle connect, .mbz backup export, Deep Linking (no window hint), SCORM 1.2 + HTML grades (200/409/503 + Resend),
// and Check 14 family guard refusal on `standard` profile.
import { createCourse, uploadVersion } from '../../acceptance/lib/app';
import {
  APP,
  COURSE_ZIP,
  MOODLE_SIM,
  TEXT,
  THANH,
  app,
  assertPortalResultsSent,
  check,
  completeHtml,
  connection,
  createCourseWithZip,
  createSimScenario,
  expect,
  fixtureZip,
  httpsRequest,
  k2Case,
  next,
  ok,
  performLearnerCompletion,
  performTeacherDeepLinkPick,
  playPath,
  portalSignIn,
  publishCourseViaDialog,
  requireCourseZip,
  saveWizardConnection,
  session,
  shot,
  sim,
  unique,
  urls,
  waitForFrame,
  type Json,
  type Target,
} from './lib/k2';

async function createRegisteredMoodleSimConnection(page: import('@playwright/test').Page, s: Json) {
  const connName = unique('R2-Sim-Moodle');
  const clientId = unique('moodle-sim-client');
  const deploymentId = MOODLE_SIM.deployments[0];

  await page.goto(`${APP}/integrations/moodle/connect`);
  await page.getByLabel('Connection name').fill(connName);
  await page.getByLabel('Moodle site URL', { exact: true }).fill(MOODLE_SIM.siteUrl);
  await page.getByRole('radio', { name: /^Manual/i }).first().check();
  await next(page);
  await page.waitForURL(/\/integrations\/moodle\/con_[^/]+$/, { timeout: 25_000 });
  const connectionId = new URL(page.url()).pathname.split('/').pop()!;

  await page.getByLabel('Platform ID (issuer)', { exact: true }).fill(MOODLE_SIM.issuer);
  await page.getByLabel('Client ID', { exact: true }).fill(clientId);
  await page.getByLabel('Deployment ID', { exact: true }).fill(deploymentId);
  await page.getByLabel('Authentication request URL', { exact: true }).fill(MOODLE_SIM.authUrl);
  await page.getByLabel('Access token URL', { exact: true }).fill(MOODLE_SIM.tokenUrl);
  await page.getByLabel('Public keyset URL', { exact: true }).fill(MOODLE_SIM.jwksUrl);
  await saveWizardConnection(page).first().click();

  await expect(page.getByText(/Registered/i).first()).toBeVisible({ timeout: 25_000 });
  expect((await connection(s as any, connectionId)).status).toBe('registered');

  const target: Target = {
    provider: MOODLE_SIM.provider,
    issuer: MOODLE_SIM.issuer,
    clientId,
    deploymentId,
    serviceHost: MOODLE_SIM.siteHost,
    pageHost: MOODLE_SIM.siteHost,
  };
  return { connectionId, connName, clientId, deploymentId, target };
}

k2Case(
  'R2-SIM.connect-mbz-deeplink-and-grades',
  'Moodle-sim manual connect, .mbz export, Deep Linking pick (no window hint), and HTML + SCORM 1.2 learner grade sync',
  async ({ page }) => {
    requireCourseZip(COURSE_ZIP.html);
    requireCourseZip(COURSE_ZIP.scorm);
    const s = await session('A');
    await portalSignIn(page, THANH);

    const { connectionId, connName, target } = await createRegisteredMoodleSimConnection(page, s);

    // Upload HTML course, publish, Deep Linking pick, and learner completion
    const htmlTitle = unique('R2-Sim HTML Course');
    const htmlCourseId = await createCourseWithZip(page, htmlTitle, COURSE_ZIP.html, 'HTML');

    await publishCourseViaDialog(page, htmlCourseId, connName);
    const pubsRes = await app(s as any, 'GET', `/app-api/publications?courseId=${encodeURIComponent(htmlCourseId)}`);
    const pub = (pubsRes.json.publications as Json[]).find((p) => p.connectionId === connectionId)!;
    check(pub, 'Moodle-sim HTML publication exists');

    // Deep Linking pick on moodle-sim: verify no window hint (launch.windowHint = false on moodle)
    const picked = await performTeacherDeepLinkPick(page, target, MOODLE_SIM.siteUrl, htmlTitle, 'r2-sim-moodle');
    const item = picked.items?.[0] as Json | undefined;
    expect(item).toBeDefined();
    expect(String(item!.url)).toContain(`resource=${pub.id}`);
    expect(Object.hasOwn(item!, 'window'), 'Moodle Deep Linking item omits window hint').toBe(false);

    // Learner completion on HTML course (200)
    await performLearnerCompletion(page, target, String(pub.id), 'Moodle', 'k2-r2-sim-moodle-html');
    await assertPortalResultsSent(page, String(pub.id), MOODLE_SIM.siteHost);
    expect((await connection(s, connectionId)).status).toBe('connected');

    // SCORM 1.2 course: verify .mbz section + .mbz build & download + SCORM 1.2 learner grade sync (200)
    const scormTitle = unique('R2-Sim SCORM Course');
    const scormCourse = await createCourse(s as any, scormTitle);
    const scormUp = await uploadVersion(s as any, scormCourse.id, fixtureZip('scorm12'));
    ok(scormUp, 201, 'upload SCORM 1.2 fixture');
    const scormCourseId = String(scormCourse.id);
    const scormVersionId = String((scormUp.json.version as Json | undefined)?.id ?? scormUp.json.id);

    await page.goto(`${APP}/libraries/courses/${scormCourseId}`);
    await expect(page.getByText(TEXT.mbz, { exact: true }).first()).toBeVisible();

    const mbzStart = await app(
      s as any,
      'POST',
      `/app-api/courses/${encodeURIComponent(scormCourseId)}/versions/${encodeURIComponent(scormVersionId)}/mbz`,
    );
    expect([200, 201, 202]).toContain(mbzStart.status);
    expect(mbzStart.json?.courseId).toBe(scormCourseId);
    expect(mbzStart.json?.versionId).toBe(scormVersionId);
    expect(['queued', 'running', 'ready', 'failed']).toContain(mbzStart.json?.status);
    const mbzGet = await app(
      s as any,
      'GET',
      `/app-api/courses/${encodeURIComponent(scormCourseId)}/versions/${encodeURIComponent(scormVersionId)}/mbz`,
    );
    expect(mbzGet.status).toBe(200);
    expect(mbzGet.json?.buildId).toBe(mbzStart.json?.buildId);

    await publishCourseViaDialog(page, scormCourseId, connName);
    const scormPubsRes = await app(s as any, 'GET', `/app-api/publications?courseId=${encodeURIComponent(scormCourseId)}`);
    const scormPub = (scormPubsRes.json.publications as Json[]).find((p) => p.connectionId === connectionId)!;
    check(scormPub, 'Moodle-sim SCORM 1.2 publication exists');

    const scormSc = await createSimScenario(target, {
      resource: String(scormPub.id),
      resourceLinkId: unique('rl-scorm'),
      subject: 'learner-scorm',
    });
    await page.goto(scormSc.loginUrl);
    await page.waitForURL((u) => u.origin === APP && playPath.test(u.pathname), { timeout: 30_000 });
    const scormRtFrame = await waitForFrame(page, (u) => u.origin === urls.content && u.pathname.startsWith('/rt/'));
    const scormRtToken = new URL(scormRtFrame.url()).pathname.split('/')[2]!;
    const scormStateRes = await httpsRequest(`${urls.content}/rt/${scormRtToken}/state`);
    ok(scormStateRes, 200, 'SCORM 1.2 runtime state');
    const scormState = JSON.parse(scormStateRes.body);
    const scormCommitRes = await httpsRequest(`${urls.content}/rt/${scormRtToken}/commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'scorm12',
        event: 'finish',
        sessionId: scormState.sessionId,
        seq: scormState.lastSeq + 1,
        cmi: {
          core: {
            lesson_status: 'completed',
            lesson_location: '',
            score: { raw: '100', min: '0', max: '100' },
            session_time: '0000:00:01.00',
            exit: '',
          },
          suspend_data: '',
          comments: '',
          interactions: [],
          objectives: [],
        },
      }),
    });
    ok(scormCommitRes, 200, 'SCORM 1.2 runtime commit');

    let scormSentSeen = false;
    for (let i = 0; i < 60; i++) {
      const res = await app(s, 'GET', `/app-api/publications/${scormPub.id}/results`);
      const row = (res.json.rows as Json[] | undefined)?.find((r) => r.learner?.sub === 'learner-scorm');
      if (row?.scoreSyncs?.some((sync: Json) => sync.status === 'sent')) {
        scormSentSeen = true;
        break;
      }
      await page.waitForTimeout(250);
    }
    expect(scormSentSeen, 'SCORM 1.2 score sync reaches sent status on moodle-sim').toBe(true);
    await shot(page, 'r2-sim-moodle-results');
  },
  480_000,
);

k2Case(
  'R2-SIM.grades-409-503-and-check14',
  'Moodle-sim 409 conflict, 503 failure + Resend recovery, and Check 14 family guard refusal on standard profile',
  async ({ page }) => {
    requireCourseZip(COURSE_ZIP.html);
    const s = await session('A');
    await portalSignIn(page, THANH);

    const { connectionId, connName, target } = await createRegisteredMoodleSimConnection(page, s);
    const htmlTitle = unique('R2-Sim Faults HTML');
    const htmlCourse = await createCourse(s as any, htmlTitle);
    ok(await uploadVersion(s as any, htmlCourse.id, fixtureZip('html')), 201, 'upload HTML fixture');
    const htmlCourseId = String(htmlCourse.id);
    await publishCourseViaDialog(page, htmlCourseId, connName);
    const pubsRes = await app(s, 'GET', `/app-api/publications?courseId=${encodeURIComponent(htmlCourseId)}`);
    const pub = (pubsRes.json.publications as Json[]).find((p) => p.connectionId === connectionId)!;

    // 1. Check 14 family guard refusal: canvas family on Moodle standard platform -> 400 PROVIDER_PROFILE_MISMATCH
    const badFamilySc = await createSimScenario(target, {
      resource: String(pub.id),
      resourceLinkId: unique('rl-bad-family'),
      family: 'canvas',
    });
    await page.goto(badFamilySc.loginUrl);
    await expect(page.locator('[data-error-code="PROVIDER_PROFILE_MISMATCH"]')).toBeVisible({ timeout: 20_000 });

    // 2. 409 Conflict score answer -> records conflict status
    const conflictSc = await createSimScenario(target, {
      resource: String(pub.id),
      resourceLinkId: unique('rl-409'),
      subject: 'learner-409',
      scoreAnswers: [{ status: 409, message: 'Score timestamp older than gradebook' }],
    });
    await page.goto(conflictSc.loginUrl);
    await page.waitForURL((u) => u.origin === APP && playPath.test(u.pathname), { timeout: 30_000 });
    const rtFrame = await waitForFrame(page, (u) => u.origin === urls.content && u.pathname.startsWith('/rt/'));
    const rtToken = new URL(rtFrame.url()).pathname.split('/')[2]!;
    await completeHtml(rtToken, 8);

    let conflictSeen = false;
    for (let i = 0; i < 60; i++) {
      const res = await app(s, 'GET', `/app-api/publications/${pub.id}/results`);
      const row = (res.json.rows as Json[] | undefined)?.find((r) => r.learner?.sub === 'learner-409');
      if (row?.scoreSyncs?.some((sync: Json) => sync.status === 'conflict')) {
        conflictSeen = true;
        break;
      }
      await page.waitForTimeout(250);
    }
    expect(conflictSeen, '409 score answer transitions sync status to conflict').toBe(true);

    // 3a. 503 transient failure followed by 200 automatic retry recovery
    const retry503Sc = await createSimScenario(target, {
      resource: String(pub.id),
      resourceLinkId: unique('rl-503'),
      subject: 'learner-503',
      scoreAnswers: [{ status: 503, message: 'Service Unavailable' }, { status: 200 }],
    });
    await page.goto(retry503Sc.loginUrl);
    await page.waitForURL((u) => u.origin === APP && playPath.test(u.pathname), { timeout: 30_000 });
    const rt503Frame = await waitForFrame(page, (u) => u.origin === urls.content && u.pathname.startsWith('/rt/'));
    const rt503Token = new URL(rt503Frame.url()).pathname.split('/')[2]!;
    await completeHtml(rt503Token, 9);

    let retry503SentSeen = false;
    for (let i = 0; i < 120; i++) {
      const res = await app(s, 'GET', `/app-api/publications/${pub.id}/results`);
      const row = (res.json.rows as Json[] | undefined)?.find((r) => r.learner?.sub === 'learner-503');
      if (row?.scoreSyncs?.some((sync: Json) => sync.status === 'sent' && Number(sync.tries) >= 2)) {
        retry503SentSeen = true;
        break;
      }
      await page.waitForTimeout(250);
    }
    expect(retry503SentSeen, '503 score answer retries and transitions to sent').toBe(true);

    // 3b. Permanent failure (400) + manual Resend recovery (200)
    const resendSc = await createSimScenario(target, {
      resource: String(pub.id),
      resourceLinkId: unique('rl-resend'),
      subject: 'learner-resend',
      scoreAnswers: [{ status: 400, message: 'Gradebook temporarily locked' }, { status: 200 }],
    });
    await page.goto(resendSc.loginUrl);
    await page.waitForURL((u) => u.origin === APP && playPath.test(u.pathname), { timeout: 30_000 });
    const rtResendFrame = await waitForFrame(page, (u) => u.origin === urls.content && u.pathname.startsWith('/rt/'));
    const rtResendToken = new URL(rtResendFrame.url()).pathname.split('/')[2]!;
    await completeHtml(rtResendToken, 9);

    let failedSyncId = '';
    for (let i = 0; i < 60; i++) {
      const res = await app(s, 'GET', `/app-api/publications/${pub.id}/results`);
      const row = (res.json.rows as Json[] | undefined)?.find((r) => r.learner?.sub === 'learner-resend');
      const failedSync = row?.scoreSyncs?.find((sync: Json) => sync.status === 'failed');
      if (failedSync) {
        failedSyncId = String(failedSync.id);
        break;
      }
      await page.waitForTimeout(250);
    }
    expect(failedSyncId, 'Failed sync row created before Resend').not.toBe('');
    const resendRes = await app(s, 'POST', `/app-api/score-syncs/${failedSyncId}/resend`);
    ok(resendRes, 200, 'POST /app-api/score-syncs/:id/resend');

    let resendSentSeen = false;
    for (let i = 0; i < 60; i++) {
      const res = await app(s, 'GET', `/app-api/publications/${pub.id}/results`);
      const row = (res.json.rows as Json[] | undefined)?.find((r) => r.learner?.sub === 'learner-resend');
      if (row?.scoreSyncs?.some((sync: Json) => sync.status === 'sent')) {
        resendSentSeen = true;
        break;
      }
      await page.waitForTimeout(250);
    }
    expect(resendSentSeen, 'Manual Resend recovers failed score sync to sent').toBe(true);
    await shot(page, 'r2-sim-moodle-409-and-check14');
  },
  360_000,
);
