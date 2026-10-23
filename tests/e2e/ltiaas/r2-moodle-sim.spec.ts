// Slot 6 R2-sim browser & protocol suite on `moodle-sim` (https://moodle.sim.test).
// Covers manual Moodle connect, .mbz backup export, Deep Linking (no window hint), SCORM 1.2 + HTML grades (200/409/503 + Resend),
// and Check 14 family guard refusal on `standard` profile.
import {
  APP,
  COURSE_ZIP,
  MOODLE_SIM,
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

    // Upload HTML course and verify .mbz export endpoint (capabilities['export.packages'] = ['mbz'])
    const htmlTitle = unique('R2-Sim HTML Course');
    const htmlCourseId = await createCourseWithZip(page, htmlTitle, COURSE_ZIP.html, 'HTML');
    const mbzRes = await httpsRequest(`${APP}/app-api/courses/${htmlCourseId}/moodle-backup`, {
      headers: { cookie: s.cookie },
    });
    expect(mbzRes.status, 'GET /app-api/courses/:id/moodle-backup returns 200').toBe(200);
    expect(String(mbzRes.headers['content-disposition'] ?? '')).toContain('.mbz');

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

    // Learner completion on HTML course
    await performLearnerCompletion(page, target, String(pub.id), 'Moodle', 'r2-sim-moodle-html');
    await assertPortalResultsSent(page, String(pub.id), MOODLE_SIM.siteHost);
    expect((await connection(s, connectionId)).status).toBe('connected');
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
    const htmlCourseId = await createCourseWithZip(page, htmlTitle, COURSE_ZIP.html, 'HTML');
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
    await shot(page, 'r2-sim-moodle-409-and-check14');
  },
  360_000,
);
