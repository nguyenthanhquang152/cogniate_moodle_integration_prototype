// T7 Scenario B: manual registration, second library, isolation (tasks/T7.md B1–B6; AC-T7-08, AC-T7-09).
// QA Library B connects "Dev Moodle B" with the manual method. The admin types the 16 shown values (read by `key`,
// app contract §4.1) into "configure a tool manually" and copies the six Moodle values back.
import { courseZipCopy } from '../acceptance/lib/course-fixtures';
import { QA_B, THANH } from '../acceptance/lib/app';
import { captureLti } from './lib/capture';
import {
  appendList,
  CONNECTION_B,
  COURSE_B_HTML,
  COURSE_HTML,
  COURSE_SCORM,
  loadState,
  markDone,
  need,
  note,
  saveState,
  shot,
  timed,
  TOOL_A,
  TOOL_B,
  urls,
  writeEvidence,
} from './lib/e2e';
import { addCogniateActivity, checkLaunch, learnerRun } from './lib/flows';
import {
  addActivityFromChooser,
  cancelActivityForm,
  clickAndNavigate,
  closeModal,
  ensureEditMode,
  fillManualTool,
  followMenuPath,
  graderReport,
  login,
  MANAGE_TOOLS,
  missingLabels,
  moodlePage,
  NEW_WINDOW,
  openSelectContent,
  readToolDetails,
  readToolSettings,
  toolCard,
  USAGE_CHOOSER,
} from './lib/moodle';
import { course101, course102, grade, ltiModules, users } from './lib/oracle';
import { connectionOf, createCourseWithZip, manualRows, portalSignIn, publicationOf, publishCourse, resultsApi, resultsRow, startConnect } from './lib/portal';
import { expect, newContext, test } from './lib/pw';
import { classify, readSteps } from './lib/steps';

/** Moodle "Tool configuration details" label → the key of PUT …/platform (app contract §4). */
const SIX: Record<string, string> = {
  'Platform ID': 'issuer',
  'Client ID': 'clientId',
  'Deployment ID': 'deploymentId',
  'Authentication request URL': 'authenticationEndpoint',
  'Access token URL': 'accessTokenEndpoint',
  'Public keyset URL': 'jwksUrl',
};

test('B1-B2 QA Library B connects "Dev Moodle B" (Manual); the admin configures the tool manually with the shown values ("Cogniate (QA Library B)") and copies the six values back → "Registered"', async ({ browser }, testInfo) => {
  test.setTimeout(300_000);
  need(loadState().done?.A2, 'Scenario A (A2)');
  const bCtx = await newContext(browser, { clipboard: true });
  const adminCtx = await newContext(browser);
  try {
    // B1: the manual wizard and its 16 rows.
    const portal = await bCtx.newPage();
    await portalSignIn(portal, QA_B);
    const connectionId = await startConnect(portal, CONNECTION_B, 'manual');
    saveState({ connectionB: connectionId });
    const { rows, missing } = await manualRows(portal);
    writeEvidence('B1-tool-configuration-rows.json', rows);
    await shot(portal, 'B1-wizard-manual', testInfo);
    expect(missing, 'tool-configuration rows missing in the wizard (§4.1 keys)').toEqual([]);
    expect.soft(rows.find((r) => r.key === 'tool_name')?.value, 'tool_name').toBe(TOOL_B);

    // B2: the admin follows the manual steps of the wizard.
    const admin = await moodlePage(adminCtx);
    await login(admin, users().admin);
    const diffs: string[] = [];
    let details: Record<string, string> = {};
    await timed('B2', async () => {
      for (const step of readSteps().manual) {
        const action = classify(step);
        note(testInfo, 'B2 step', `${step.id} → ${action}`);
        if (action === 'open-manage-tools') {
          diffs.push(...(await followMenuPath(admin, step.menuPath, MANAGE_TOOLS())).map((d) => `${step.id}: ${d}`));
          diffs.push(...(await missingLabels(admin.locator('body'), step.labels)).map((l) => `${step.id}: label "${l}" is not on Manage tools`));
        } else if (action === 'configure-manually') {
          if (!admin.url().startsWith(MANAGE_TOOLS())) await admin.goto(MANAGE_TOOLS());
          diffs.push(...(await missingLabels(admin.locator('body'), step.labels)).map((l) => `${step.id}: label "${l}" is not on Manage tools`));
          await clickAndNavigate(admin, admin.getByRole('link', { name: 'configure a tool manually', exact: true }));
        } else if (action === 'fill-values') {
          await admin.getByLabel('Tool name', { exact: true }).waitFor();
          diffs.push(...(await missingLabels(admin.locator('body'), step.labels)).map((l) => `${step.id}: label "${l}" is not on the tool form`));
          diffs.push(...(await fillManualTool(admin, rows)).map((d) => `${step.id}: ${d}`));
        } else if (action === 'copy-details') {
          if (!admin.url().startsWith(MANAGE_TOOLS())) await admin.goto(MANAGE_TOOLS());
          await toolCard(admin, TOOL_B).waitFor();
          details = await readToolDetails(admin, TOOL_B);
          const modal = admin.locator('.modal.show');
          diffs.push(...(await missingLabels(modal, step.labels.filter((l) => l !== 'View configuration details'))).map((l) => `${step.id}: label "${l}" is not in the details dialog`));
          if (step.labels.includes('View configuration details')) diffs.push(...(await missingLabels(toolCard(admin, TOOL_B), ['View configuration details'])).map((l) => `${step.id}: label "${l}" is not on the tool card`));
          await shot(admin, 'B2-tool-details', testInfo);
          await closeModal(admin);
        } else {
          appendList('findings', `B2: QA cannot map the manual wizard step "${step.id}" ("${step.text}") to a Moodle action`);
        }
      }
    });
    writeEvidence('B2-manual-diffs.json', diffs);
    if (diffs.length) appendList('findings', ...diffs.map((d) => `B2 (manual steps, not part of AC-T7-14): ${d}`));
    writeEvidence('B2-tool-details.json', details);
    expect(Object.keys(details).sort(), 'the six values in "Tool configuration details"').toEqual(Object.keys(SIX).sort());

    // Moodle shows the manual tool with the shown values.
    const settings = await readToolSettings(admin, TOOL_B, (p, n) => shot(p, n, testInfo), 'B2-tool-B');
    saveState({ typeIdB: Number(await toolCard(admin, TOOL_B).getAttribute('data-type-id')) });
    writeEvidence('B2-tool-settings.json', settings);
    expect.soft(settings.badge, 'tool B badge').toBe('Active');
    expect.soft(settings.usage, 'tool B: Tool configuration usage').toBe(USAGE_CHOOSER);
    expect.soft(settings.container, 'tool B: Default launch container').toBe(NEW_WINDOW);

    // The six values back into the portal → "Registered".
    for (const [label, key] of Object.entries(SIX)) await portal.locator(`input[name="${key}"]`).fill(details[label] ?? '');
    await shot(portal, 'B2-six-values', testInfo);
    await portal.getByRole('button', { name: 'Connect Moodle', exact: true }).click();
    await expect(portal.getByText(/^Registered\b/).first()).toBeVisible({ timeout: 20_000 });
    await shot(portal, 'B2-portal-registered', testInfo);
    const status = (await connectionOf(QA_B, connectionId)).status;
    saveState({ connectionStatus: { 'B after B2': status } });
    expect(status, 'connection B status').toBe('registered');
    markDone('B2');
  } finally {
    await bCtx.close();
    await adminCtx.close();
  }
});

test('B3 QA Library B uploads the HTML zip and publishes it to "Dev Moodle B"', async ({ browser }, testInfo) => {
  test.setTimeout(240_000);
  need(loadState().done?.B2, 'B2 (connection B)');
  const ctx = await newContext(browser);
  try {
    const page = await ctx.newPage();
    await timed('B3', async () => {
      await portalSignIn(page, QA_B);
      const courseId = await createCourseWithZip(page, COURSE_B_HTML, courseZipCopy('html'), 'HTML');
      saveState({ courses: { bhtml: courseId } });
      await publishCourse(page, CONNECTION_B);
      await expect.soft(page.getByText(`Teachers: Add an activity > ${TOOL_B} > Select content`).first()).toBeVisible();
      await shot(page, 'B3-published', testInfo);
      saveState({ publications: { bhtml: (await publicationOf(QA_B, courseId)).id } });
    });
    markDone('B3');
  } finally {
    await ctx.close();
  }
});

test('B4 AC-T7-08 cg_teacher in COGNIATE-DEV-102: Add content → Activity or resource → "Cogniate (QA Library B)" → Select content → the course, completion "Receive a grade"; the picker lists only the library B course', async ({ browser }, testInfo) => {
  test.setTimeout(240_000);
  need(loadState().done?.B3, 'B3 (publication B)');
  const ctx = await newContext(browser);
  try {
    const cap = await captureLti(ctx, 'B4 teacher deep linking');
    const page = await moodlePage(ctx);
    await login(page, users().cg_teacher);
    await timed('B4', async () => {
      const cmid = await addCogniateActivity(page, course102(), TOOL_B, COURSE_B_HTML, 'B4', testInfo);
      saveState({ activities: { bhtml: { name: COURSE_B_HTML, cmid, courseId: course102() } } });
    });
    await cap.stop();
    expect(loadState().pickers?.B4, 'AC-T7-08: the B4 picker lists only the library B course').toEqual([COURSE_B_HTML]);
    const act = need(loadState().activities?.bhtml, 'activity B');
    expect.soft((await grade(course102(), users().cg_student, act))?.max, 'grade item maximum').toBe(100);
    markDone('B4');
  } finally {
    await ctx.close();
  }
});

test('B5 AC-T7-08 cg_teacher in COGNIATE-DEV-101 opens "Select content" of "Cogniate (Thanh\'s Library)" again (no save): the library B course is not listed', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  need(loadState().done?.B3, 'B3 (publication B)');
  need(loadState().done?.A4, 'A4 (tool A in the chooser)');
  const ctx = await newContext(browser);
  try {
    const cap = await captureLti(ctx, 'B5 teacher deep linking (no save)');
    const page = await moodlePage(ctx);
    await login(page, users().cg_teacher);
    const before = (await ltiModules(course101())).length;
    await ensureEditMode(page, course101());
    await addActivityFromChooser(page, TOOL_A);
    const picker = await openSelectContent(page);
    saveState({ pickers: { B5: picker.titles } });
    await shot(page, 'B5-picker-thanh', testInfo);
    await cancelActivityForm(page);
    await cap.stop();
    expect(picker.titles, 'AC-T7-08: the B5 picker does not list the library B course').not.toContain(COURSE_B_HTML);
    expect.soft([...picker.titles].sort(), 'the B5 picker lists Thanh\'s two courses').toEqual([COURSE_HTML, COURSE_SCORM].sort());
    expect.soft((await ltiModules(course101())).length, 'B5 saved no activity').toBe(before);
    markDone('B5');
  } finally {
    await ctx.close();
  }
});

test('B6 AC-T7-09 AC-T7-07 cg_student completes the COGNIATE-DEV-102 activity (correct option): 102 gradebook 100.00; library B results show the row; Thanh\'s results views do not', async ({ browser }, testInfo) => {
  test.setTimeout(300_000);
  need(loadState().done?.B4, 'B4 (activity B)');
  const ctx = await newContext(browser);
  try {
    const r = await timed('B6', () => learnerRun(ctx, 'cg_student', 'bhtml', 'correct', testInfo));
    note(testInfo, 'cg_student bhtml', `shell "${r.shell.slice(0, 160)}", grade ${r.grade}, ${r.latency} s`);
    checkLaunch(r.launch);
    expect.soft(r.grade, 'Moodle grade in COGNIATE-DEV-102').toBe(100);
  } finally {
    await ctx.close();
  }
  const st = loadState();
  const act = need(st.activities?.bhtml, 'activity B');
  const u = users();
  const g = await grade(course102(), u.cg_student, act);
  writeEvidence('AC-T7-09-oracle-grade-102.json', g ?? null);
  expect.soft(g?.shown, 'AC-T7-09: COGNIATE-DEV-102 gradebook for cg_student').toBe('100.00');

  const teacherCtx = await newContext(browser);
  try {
    const page = await moodlePage(teacherCtx);
    await login(page, u.cg_teacher);
    writeEvidence('AC-T7-09-grader-report-102.json', await graderReport(page, course102()));
    await shot(page, 'AC-T7-09-grader-report-102', testInfo);
  } finally {
    await teacherCtx.close();
  }

  // Library B results show the row (UI); Thanh's results views do not (UI and API).
  const pubB = need(st.publications?.bhtml, 'publication B');
  const portalCtx = await newContext(browser);
  try {
    const page = await portalCtx.newPage();
    await portalSignIn(page, QA_B);
    await page.goto(`${urls.app}/publications/${pubB}/results`);
    const row = resultsRow(page, u.cg_student.id, COURSE_B_HTML).first();
    await expect.soft(row, 'library B results: the cg_student row').toContainText(/Passed/, { timeout: 30_000 });
    await expect.soft(row).toContainText(/\b100\b/);
    await shot(page, 'AC-T7-09-results-library-B', testInfo);
  } finally {
    await portalCtx.close();
  }
  const thanhCtx = await newContext(browser);
  try {
    const page = await thanhCtx.newPage();
    await portalSignIn(page, THANH);
    for (const key of ['scorm', 'html'] as const) {
      const pub = need(st.publications?.[key], `publication ${key}`);
      await page.goto(`${urls.app}/publications/${pub}/results`);
      await page.getByRole('button', { name: 'Refresh from Moodle' }).waitFor({ timeout: 15_000 });
      await page.waitForTimeout(1_000);
      const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
      expect.soft(text, `Thanh's ${key} results do not show the library B activity`).not.toContain(COURSE_B_HTML);
      expect.soft(text, `Thanh's ${key} results do not show the COGNIATE-DEV-102 context`).not.toContain('Course 102');
      await shot(page, `AC-T7-09-results-thanh-${key}`, testInfo);
      const rows = await resultsApi(THANH, pub);
      expect.soft(rows.filter((x) => x.activity.title === COURSE_B_HTML || /102/.test(x.activity.contextTitle)), `Thanh's ${key} results API`).toEqual([]);
    }
  } finally {
    await thanhCtx.close();
  }
});
