// T7 Scenario A: dynamic registration, both courses, both learners (tasks/T7.md A1–A6; AC-T7-02 to -07, -14).
// Each step is one test. A step reads what earlier steps made from the run state (lib/e2e.ts), so a failed check does
// not hide the later steps. Moodle labels: Moodle 5.2.4 as seen live (lib/moodle.ts header).
import type { Page } from '@playwright/test';
import { courseZipCopy } from '../acceptance/lib/course-fixtures';
import { THANH } from '../acceptance/lib/app';
import { captureLti, stateCookieHeader } from './lib/capture';
import {
  appendList,
  CONNECTION_A,
  COURSE_HTML,
  COURSE_SCORM,
  LIBRARY_A,
  loadState,
  markDone,
  need,
  note,
  pollUntil,
  recordSecret,
  saveState,
  SHELL_DONE_100,
  shot,
  timed,
  TOOL_A,
  urls,
  writeEvidence,
  type LaunchRecord,
} from './lib/e2e';
import { doCourse, launchFromCourse, shellText } from './lib/learner';
import {
  activateTool,
  addActivityFromChooser,
  editToolSettings,
  ensureEditMode,
  followMenuPath,
  graderReport,
  login,
  MANAGE_TOOLS,
  missingLabels,
  moodlePage,
  NEW_WINDOW,
  openSelectContent,
  pickCourse,
  readToolSettings,
  saveAndReturn,
  setCompletionReceiveGrade,
  toolCard,
  USAGE_CHOOSER,
  waitRegistrationClosed,
  waitRegistrationFrame,
  type RegistrationFrame,
} from './lib/moodle';
import { cmidByName, completion, course101, grade, users } from './lib/oracle';
import { cellUnder, clipboard, connectionOf, createCourseWithZip, portalSignIn, publicationBlockText, publicationOf, publishCourse, resultsApi, resultsRow, startConnect, stepsOnScreen } from './lib/portal';
import { newContext, expect, test } from './lib/pw';
import { classify, readSteps, type StepAction } from './lib/steps';

const SCORM = { key: 'scorm', title: COURSE_SCORM, format: 'SCORM 1.2' } as const;
const HTML = { key: 'html', title: COURSE_HTML, format: 'HTML' } as const;

test.describe.configure({ mode: 'default' });

test('A1-A2 AC-T7-02 AC-T7-14 Thanh connects "Dev Moodle" (Automatic); the Moodle admin follows the wizard steps of moodle-steps.json; the tool is active with "New window" and "Show in activity chooser"; the connection is registered', async ({ browser }, testInfo) => {
  test.setTimeout(300_000);
  const thanhCtx = await newContext(browser, { clipboard: true });
  const adminCtx = await newContext(browser);
  try {
    // A1 (portal): Integrations → Moodle → Connect → URL, "Dev Moodle", Automatic → copy the URL.
    const portal = await thanhCtx.newPage();
    const regUrl = await timed('A1', async () => {
      await portalSignIn(portal, THANH);
      const connectionId = await startConnect(portal, CONNECTION_A, 'dynamic');
      saveState({ connectionA: connectionId });
      await portal.getByRole('button', { name: 'Copy', exact: true }).first().click();
      return clipboard(portal);
    });
    expect(regUrl, 'the registration URL from the Copy button').toMatch(new RegExp(`^${urls.lti.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/lti/register/cogniate\\?ref=`));
    recordSecret('registration_ref', new URL(regUrl).searchParams.get('ref'), 'A1 registration URL');
    await shot(portal, 'A1-wizard-dynamic', testInfo);

    // The steps that the wizard shows, and the data file the suite follows.
    const file = readSteps().dynamic;
    const screen = await stepsOnScreen(portal);
    writeEvidence('A2-steps.json', { file, screen });
    const screenIds = screen.map((s) => s.id).join(', ');
    const fileIds = file.map((s) => s.id).join(', ');
    if (screenIds !== fileIds) appendList('findings', `A2: the wizard shows the steps [${screenIds}], moodle-steps.json has [${fileIds}]`);

    // A2 (Moodle admin): follow each step in order.
    const admin = await moodlePage(adminCtx);
    await login(admin, users().admin);
    const diffs: string[] = [];
    const done = new Set<StepAction>();
    let frame: RegistrationFrame | null = null;
    const hasChoiceStep = file.some((s) => classify(s) === 'choose-new');
    const chooseNew = async (f: RegistrationFrame, labels: string[], stepId: string) => {
      diffs.push(...(await missingLabels(f.frame.locator('body'), labels)).map((l) => `${stepId}: label "${l}" is not on the choice page`));
      await shot(admin, 'A2-choice-page', testInfo);
      const button = f.frame.getByRole('button', { name: 'Register as a new external tool', exact: true });
      if (await button.count()) await button.click();
      else {
        diffs.push(`${stepId}: no button "Register as a new external tool" on the choice page`);
        await f.frame.locator('button[data-href$="&type=0"]').first().click();
      }
      return waitRegistrationFrame(admin, { skipChoice: true });
    };
    await timed('A2', async () => {
      for (const step of file) {
        const action = classify(step);
        note(testInfo, 'A2 step', `${step.id} → ${action}`);
        const where = `${step.id}`;
        if (action === 'open-manage-tools') {
          diffs.push(...(await followMenuPath(admin, step.menuPath, MANAGE_TOOLS())).map((d) => `${where}: ${d}`));
          diffs.push(...(await missingLabels(admin.locator('body'), step.labels)).map((l) => `${where}: label "${l}" is not on Manage tools`));
          await shot(admin, 'A2-manage-tools', testInfo);
        } else if (action === 'paste-url') {
          if (!admin.url().startsWith(MANAGE_TOOLS())) await admin.goto(MANAGE_TOOLS());
          diffs.push(...(await missingLabels(admin.locator('body'), step.labels)).map((l) => `${where}: label "${l}" is not on Manage tools`));
          await admin.locator('#tool-url').fill(regUrl);
          await admin.getByRole('button', { name: 'Add LTI Advantage', exact: true }).click();
          frame = await waitRegistrationFrame(admin);
          if (frame.kind === 'choice' && !hasChoiceStep) {
            appendList('findings', 'A2: Moodle showed the "update or register new" page, but the wizard has no step for it');
            frame = await chooseNew(frame, [], 'no wizard step');
          }
        } else if (action === 'choose-new') {
          const f = need(frame, 'the registration frame (paste step)');
          if (f.kind === 'choice') frame = await chooseNew(f, step.labels, where);
          else note(testInfo, 'A2 optional step', `${step.id}: Moodle did not show the choice page (no other tool on this site), so the step does not apply`);
        } else if (action === 'confirm-connect') {
          const f = need(frame, 'the registration frame (paste step)');
          expect(f.kind, `the Cogniate page in Moodle's frame: ${f.text.slice(0, 300)}`).toBe('confirm');
          diffs.push(...(await missingLabels(f.frame.locator('body'), step.labels)).map((l) => `${where}: label "${l}" is not on the Cogniate page`));
          expect.soft(f.text, 'the Cogniate page shows the library').toContain(LIBRARY_A);
          expect.soft(f.text, 'the Cogniate page shows the site').toContain(urls.moodle);
          await shot(admin, 'A2-cogniate-confirm', testInfo);
          await f.frame.getByRole('button', { name: 'Connect', exact: true }).click();
          await waitRegistrationClosed(admin, TOOL_A);
          await shot(admin, 'A2-after-connect', testInfo);
        } else if (action === 'activate') {
          if (!admin.url().startsWith(MANAGE_TOOLS())) await admin.goto(MANAGE_TOOLS());
          diffs.push(...(await missingLabels(admin.locator('body'), step.menuPath.slice(-1))).map((l) => `${where}: menu label "${l}" is not on the page`));
          diffs.push(...(await missingLabels(toolCard(admin, TOOL_A), step.labels)).map((l) => `${where}: label "${l}" is not on the tool card "${TOOL_A}"`));
          await activateTool(admin, TOOL_A);
        } else if (action === 'edit-tool') {
          if (!admin.url().startsWith(MANAGE_TOOLS())) await admin.goto(MANAGE_TOOLS());
          if (step.labels.includes('Edit')) diffs.push(...(await missingLabels(toolCard(admin, TOOL_A), ['Edit'])).map((l) => `${where}: label "${l}" is not on the tool card`));
          diffs.push(...(await editToolSettings(admin, TOOL_A, step.labels)).map((l) => `${where}: label "${l}" is not on the tool edit form`));
        } else {
          appendList('findings', `A2: QA cannot map the wizard step "${step.id}" ("${step.text}") to a Moodle action`);
        }
        done.add(action);
      }
      if (!done.has('edit-tool')) {
        appendList(
          'findings',
          'A2 (B-T6-01): the wizard has no step to edit the tool ("Tool configuration usage" = "Show in activity chooser and as a preconfigured tool", "Default launch container" = "New window"). QA did the edit anyway, so the scenario can go on.',
        );
        note(testInfo, 'finding', 'wizard step "edit the tool" is missing (B-T6-01); QA edited the tool anyway');
        await editToolSettings(admin, TOOL_A, []);
      }
    });
    appendList('labelDiffs', ...diffs);
    writeEvidence('A2-label-diffs.json', diffs);

    // AC-T7-02: Moodle shows the tool active, "New window", "Show in activity chooser".
    const settings = await readToolSettings(admin, TOOL_A, (p, n) => shot(p, n, testInfo), 'A2-tool-A');
    const typeId = Number(await toolCard(admin, TOOL_A).getAttribute('data-type-id'));
    saveState({ typeIdA: typeId });
    writeEvidence('A2-tool-settings.json', settings);
    expect.soft(settings.badge, 'tool card badge').toBe('Active');
    expect.soft(settings.usage, 'Tool configuration usage').toBe(USAGE_CHOOSER);
    expect.soft(settings.container, 'Default launch container').toBe(NEW_WINDOW);

    // The connection is "registered" (portal page and API).
    const connectionA = need(loadState().connectionA, 'connection A');
    await portal.reload();
    await expect.soft(portal.getByText('Registered — activate in Moodle').first()).toBeVisible({ timeout: 15_000 });
    await shot(portal, 'A2-portal-registered', testInfo);
    const status = (await connectionOf(THANH, connectionA)).status;
    saveState({ connectionStatus: { 'A after A2': status } });
    expect.soft(status, 'connection status after A2').toBe('registered');

    // AC-T7-14: every label that A2 used is on the live page.
    expect.soft(diffs, 'AC-T7-14: Moodle labels of moodle-steps.json that are not on the live Moodle 5.2.4 page').toEqual([]);
    markDone('A2');
  } finally {
    await thanhCtx.close();
    await adminCtx.close();
  }
});

test('A3 Thanh uploads the SCORM zip and the HTML zip and publishes both to "Dev Moodle"', async ({ browser }, testInfo) => {
  test.setTimeout(300_000);
  need(loadState().done?.A2, 'A2 (the connection)');
  const ctx = await newContext(browser);
  try {
    const page = await ctx.newPage();
    await timed('A3', async () => {
      await portalSignIn(page, THANH);
      for (const c of [SCORM, HTML]) {
        const courseId = await createCourseWithZip(page, c.title, courseZipCopy(c.key), c.format);
        saveState({ courses: { [c.key]: courseId } });
        await publishCourse(page, CONNECTION_A);
        await expect.soft(page.getByText(`Teachers: Add an activity > ${TOOL_A} > Select content`).first()).toBeVisible();
        await shot(page, `A3-published-${c.key}`, testInfo);
        saveState({ publications: { [c.key]: (await publicationOf(THANH, courseId)).id } });
      }
    });
    markDone('A3');
  } finally {
    await ctx.close();
  }
});

/** Teacher: Add content → Activity or resource → the tool → Select content → the course → completion → save. */
async function addCogniateActivity(page: Page, courseId: number, toolName: string, title: string, pickerKey: string, testInfo: import('@playwright/test').TestInfo): Promise<number> {
  await ensureEditMode(page, courseId);
  const { chooserItems } = await addActivityFromChooser(page, toolName);
  note(testInfo, 'chooser', `${pickerKey}: chooser lists ${chooserItems.filter((i) => i.startsWith('Cogniate')).join(', ')}`);
  const picker = await openSelectContent(page);
  saveState({ pickers: { [pickerKey]: picker.titles } });
  await shot(page, `${pickerKey}-picker`, testInfo);
  const name = await pickCourse(page, picker, title);
  expect(name, 'Moodle fills the activity name from the picked course').toBe(title);
  await setCompletionReceiveGrade(page);
  await shot(page, `${pickerKey}-activity-form`, testInfo);
  await saveAndReturn(page);
  const cmid = need(await cmidByName(courseId, title), `the new activity "${title}"`);
  return cmid;
}

test('A4 AC-T7-03 AC-T7-02 cg_teacher adds both courses in COGNIATE-DEV-101 (Add content → Activity or resource → Cogniate (Thanh\'s Library) → Select content → completion "Receive a grade"); the picker lists exactly Thanh\'s two courses; grade items of maximum 100; "Selected in Moodle"; the connection is connected', async ({ browser }, testInfo) => {
  test.setTimeout(300_000);
  const st = loadState();
  need(st.done?.A3, 'A3 (the publications)');
  const ctx = await newContext(browser);
  try {
    const cap = await captureLti(ctx, 'A4 teacher deep linking');
    const page = await moodlePage(ctx);
    await login(page, users().cg_teacher);
    await timed('A4', async () => {
      for (const c of [SCORM, HTML]) {
        const cmid = await addCogniateActivity(page, course101(), TOOL_A, c.title, `A4-${c.key}`, testInfo);
        saveState({ activities: { [c.key]: { name: c.title, cmid, courseId: course101() } } });
      }
    });
    await shot(page, 'A4-course-101', testInfo);
    await cap.stop();

    // AC-T7-03: each picker listed exactly Thanh's two courses.
    const pickers = loadState().pickers ?? {};
    for (const key of ['A4-scorm', 'A4-html']) expect.soft([...(pickers[key] ?? [])].sort(), `${key} picker options`).toEqual([COURSE_HTML, COURSE_SCORM].sort());
    // Both activities have a grade item with maximum 100.
    for (const c of [SCORM, HTML]) {
      const act = need(loadState().activities?.[c.key], `activity ${c.key}`);
      const g = await grade(course101(), users().cg_student, act);
      expect.soft(g?.max, `${c.title}: grade item maximum`).toBe(100);
    }
    // Both publications show "Selected in Moodle".
    const portalCtx = await newContext(browser);
    try {
      const p = await portalCtx.newPage();
      await portalSignIn(p, THANH);
      for (const c of [SCORM, HTML]) {
        const courseId = need(loadState().courses?.[c.key], `course ${c.key}`);
        const text = await publicationBlockText(p, courseId, CONNECTION_A);
        note(testInfo, `publication ${c.key}`, text.slice(0, 200));
        expect.soft(text, `${c.title}: the publication shows "Selected in Moodle" with at least one pick`).toMatch(/Selected in Moodle\s*:?\s*[1-9]/);
        await shot(p, `A4-publication-${c.key}`, testInfo);
        const pub = await publicationOf(THANH, courseId);
        expect.soft(pub.stats.activities, `${c.title}: stats.activities`).toBeGreaterThanOrEqual(1);
      }
      // AC-T7-02: the connection is "connected" after A4.
      const status = (await connectionOf(THANH, need(loadState().connectionA, 'connection A'))).status;
      saveState({ connectionStatus: { 'A after A4': status } });
      expect.soft(status, 'connection status after A4').toBe('connected');
      await p.goto(`${urls.app}/integrations`);
      await expect.soft(p.getByText('Connected', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await shot(p, 'A4-integrations-connected', testInfo);
    } finally {
      await portalCtx.close();
    }
    markDone('A4');
  } finally {
    await ctx.close();
  }
});

/** One learner run of one activity: launch, AC-T7-07 facts, the course, the shell text and the Moodle grade (≤ 60 s). */
async function learnerRun(
  browserCtx: import('@playwright/test').BrowserContext,
  user: 'cg_student' | 'cg_student2',
  key: 'scorm' | 'html',
  answer: 'correct' | 'wrong',
  testInfo: import('@playwright/test').TestInfo,
): Promise<{ launch: LaunchRecord; shell: string; latency: number | null; grade: number | null }> {
  const act = need(loadState().activities?.[key], `activity ${key}`);
  const u = users()[user];
  const l = await launchFromCourse(browserCtx, u, act.courseId, act.name, `${user} ${key}`);
  const rec: LaunchRecord = {
    user,
    activity: act.name,
    finalUrl: l.playUrl,
    topLevel: l.popup !== l.coursePage,
    hasOpener: l.hasOpener,
    msToPlay: l.msToPlay,
  };
  saveState({ launches: [...(loadState().launches ?? []), rec] });
  await shot(l.popup, `${user}-${key}-player`, testInfo);
  if (user === 'cg_student' && key === 'scorm' && !loadState().replay) {
    const f = l.capture.forms[0];
    if (f) saveState({ replay: { id_token: f.id_token, state: f.state, cookie: stateCookieHeader(l.capture.stateCookies), firstStatus: l.capture.launchStatuses[0] ?? 0 } });
  }
  await l.capture.stop();
  await doCourse(l.popup, answer);
  const t0 = Date.now();
  const want = answer === 'correct' ? 100 : 0;
  const [g] = await Promise.all([
    pollUntil(() => grade(act.courseId, u, act), (v) => v?.raw !== null && v?.raw !== undefined && Math.abs(Number(v.raw) - want) < 0.001, 60_000, 1_000),
    answer === 'correct' ? l.popup.getByText(SHELL_DONE_100).first().waitFor({ timeout: 90_000 }).catch(() => undefined) : l.popup.waitForTimeout(2_000),
  ]);
  const ok = g?.raw !== null && g?.raw !== undefined && Math.abs(Number(g.raw) - want) < 0.001;
  const latency = ok ? Math.round((Date.now() - t0) / 100) / 10 : null;
  // The shell polls the status every 5 s; let it show the final text for the evidence.
  if (answer === 'wrong') await l.popup.waitForTimeout(6_000);
  const shell = await shellText(l.popup);
  saveState({ gradeLatency: { [`${user} ${key}`]: latency ?? -1 } });
  await shot(l.popup, `${user}-${key}-done`, testInfo);
  await l.popup.close({ runBeforeUnload: true }).catch(() => undefined);
  return { launch: rec, shell, latency, grade: g?.raw ?? null };
}

function checkLaunch(rec: LaunchRecord): void {
  // AC-T7-07: the launch ends at {PUBLIC_APP_URL}/play/... in a new top-level window; no ltik in the final URL.
  expect.soft(rec.finalUrl, `${rec.user} ${rec.activity}: final URL`).toMatch(new RegExp(`^${urls.app.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/play/`));
  expect.soft(rec.finalUrl, `${rec.user} ${rec.activity}: no ltik in the final URL`).not.toContain('ltik');
  expect.soft(rec.topLevel && rec.hasOpener, `${rec.user} ${rec.activity}: a new top-level window opened from Moodle`).toBe(true);
}

test('A5 AC-T7-07 AC-T7-04 cg_student does the SCORM activity and the HTML activity (new window, correct option) → "Completed — score 100 sent to Moodle", grade 100 within 60 s', async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  need(loadState().done?.A4, 'A4 (the activities)');
  const ctx = await newContext(browser);
  try {
    await timed('A5', async () => {
      for (const key of ['scorm', 'html'] as const) {
        const r = await learnerRun(ctx, 'cg_student', key, 'correct', testInfo);
        note(testInfo, `cg_student ${key}`, `final ${r.launch.finalUrl.replace(/\/play\/.*/, '/play/…')}, shell "${r.shell.slice(0, 160)}", grade ${r.grade}, ${r.latency} s`);
        checkLaunch(r.launch);
        expect.soft(r.shell, `cg_student ${key}: shell text`).toContain(SHELL_DONE_100);
        expect.soft(r.grade, `cg_student ${key}: Moodle grade`).toBe(100);
        expect.soft(r.latency, `cg_student ${key}: seconds from completion to the Moodle grade`).not.toBeNull();
        if (r.latency !== null) expect.soft(r.latency, `cg_student ${key}: ≤ 60 s`).toBeLessThanOrEqual(60);
      }
    });
    markDone('A5');
  } finally {
    await ctx.close();
  }
});

test('A6 AC-T7-07 cg_student2 does the SCORM activity with the wrong option and finishes the pages → grade 0 within 60 s', async ({ browser }, testInfo) => {
  test.setTimeout(240_000);
  need(loadState().done?.A4, 'A4 (the activities)');
  const ctx = await newContext(browser);
  try {
    await timed('A6', async () => {
      const r = await learnerRun(ctx, 'cg_student2', 'scorm', 'wrong', testInfo);
      note(testInfo, 'cg_student2 scorm', `shell "${r.shell.slice(0, 160)}", grade ${r.grade}, ${r.latency} s`);
      checkLaunch(r.launch);
      expect.soft(r.grade, 'cg_student2 SCORM: Moodle grade').toBe(0);
      if (r.latency !== null) expect.soft(r.latency, 'cg_student2 SCORM: ≤ 60 s').toBeLessThanOrEqual(60);
    });
    markDone('A6');
  } finally {
    await ctx.close();
  }
});

test('AC-T7-04 grades in COGNIATE-DEV-101: cg_student 100.00 (SCORM) and 100.00 (HTML); cg_student2 0.00 (SCORM) and no grade (HTML); each within 60 s; grader report screenshot', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const st = loadState();
  const scorm = need(st.activities?.scorm, 'the SCORM activity');
  const html = need(st.activities?.html, 'the HTML activity');
  const u = users();
  const values = {
    'cg_student SCORM': await grade(course101(), u.cg_student, scorm),
    'cg_student HTML': await grade(course101(), u.cg_student, html),
    'cg_student2 SCORM': await grade(course101(), u.cg_student2, scorm),
    'cg_student2 HTML': await grade(course101(), u.cg_student2, html),
  };
  writeEvidence('AC-T7-04-oracle-grades.json', { values, latency: st.gradeLatency });
  expect.soft(values['cg_student SCORM']?.shown).toBe('100.00');
  expect.soft(values['cg_student HTML']?.shown).toBe('100.00');
  expect.soft(values['cg_student2 SCORM']?.shown).toBe('0.00');
  expect.soft(values['cg_student2 HTML']?.raw ?? null, 'cg_student2 HTML has no grade').toBeNull();
  for (const k of ['cg_student scorm', 'cg_student html', 'cg_student2 scorm']) {
    const s = st.gradeLatency?.[k];
    expect.soft(s !== undefined && s >= 0 && s <= 60, `${k}: grade in Moodle within 60 s of completion (${s} s)`).toBe(true);
  }
  const ctx = await newContext(browser);
  try {
    const page = await moodlePage(ctx);
    await login(page, u.cg_teacher);
    const rows = await graderReport(page, course101());
    writeEvidence('AC-T7-04-grader-report-101.json', rows);
    await shot(page, 'AC-T7-04-grader-report-101', testInfo);
  } finally {
    await ctx.close();
  }
});

test('AC-T7-05 completion "Receive a grade": cg_student has both activities done; cg_student2 has the SCORM activity done and the HTML activity not done (oracle and course page screenshots)', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const st = loadState();
  const scorm = need(st.activities?.scorm, 'the SCORM activity');
  const html = need(st.activities?.html, 'the HTML activity');
  const u = users();
  const read = async () => ({
    'cg_student SCORM': await completion(course101(), u.cg_student, scorm.cmid),
    'cg_student HTML': await completion(course101(), u.cg_student, html.cmid),
    'cg_student2 SCORM': await completion(course101(), u.cg_student2, scorm.cmid),
    'cg_student2 HTML': await completion(course101(), u.cg_student2, html.cmid),
  });
  const done = (s: number | undefined) => s !== undefined && s >= 1 && s !== 3;
  const states = await pollUntil(read, (v) => done(v['cg_student SCORM']) && done(v['cg_student HTML']) && done(v['cg_student2 SCORM']), 60_000);
  writeEvidence('AC-T7-05-oracle-completion.json', states);
  expect.soft(done(states['cg_student SCORM']), `cg_student SCORM done (state ${states['cg_student SCORM']})`).toBe(true);
  expect.soft(done(states['cg_student HTML']), `cg_student HTML done (state ${states['cg_student HTML']})`).toBe(true);
  expect.soft(done(states['cg_student2 SCORM']), `cg_student2 SCORM done (state ${states['cg_student2 SCORM']})`).toBe(true);
  expect.soft(states['cg_student2 HTML'] ?? 0, 'cg_student2 HTML not done').toBe(0);
  for (const user of ['cg_student', 'cg_student2'] as const) {
    const ctx = await newContext(browser);
    try {
      const page = await moodlePage(ctx);
      await login(page, u[user]);
      await page.goto(`${urls.moodle}/course/view.php?id=${course101()}`);
      await page.locator('.activity-item, li.activity').first().waitFor();
      await shot(page, `AC-T7-05-course-page-${user}`, testInfo);
    } finally {
      await ctx.close();
    }
  }
});

test('AC-T7-06 portal results: SCORM cg_student "Passed 100, Sent" and cg_student2 "Failed 0, Sent"; HTML cg_student "Passed 100, Sent"; after "Refresh from Moodle" the gradebook shows 100, 0, 100', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const st = loadState();
  const pubScorm = need(st.publications?.scorm, 'the SCORM publication');
  const pubHtml = need(st.publications?.html, 'the HTML publication');
  const u = users();
  // The sync status must be "sent" first (the results API is the oracle for the wait; the UI is the AC).
  await pollUntil(
    async () => [...(await resultsApi(THANH, pubScorm)), ...(await resultsApi(THANH, pubHtml))],
    (rows) => rows.filter((r) => !r.preview && r.scoreSyncs.at(-1)?.status === 'sent').length >= 3,
    60_000,
  );
  const ctx = await newContext(browser);
  try {
    const page = await ctx.newPage();
    await portalSignIn(page, THANH);
    const views: [string, string, { user: 'cg_student' | 'cg_student2'; outcome: RegExp; score: string }[]][] = [
      ['scorm', pubScorm, [{ user: 'cg_student', outcome: /Passed/, score: '100' }, { user: 'cg_student2', outcome: /Failed/, score: '0' }]],
      ['html', pubHtml, [{ user: 'cg_student', outcome: /Passed/, score: '100' }]],
    ];
    for (const [key, pub, rows] of views) {
      const title = key === 'scorm' ? COURSE_SCORM : COURSE_HTML;
      await page.goto(`${urls.app}/publications/${pub}/results`);
      for (const r of rows) {
        const row = resultsRow(page, u[r.user].id, title).first();
        await expect.soft(row, `${key} ${r.user}: outcome`).toContainText(r.outcome, { timeout: 15_000 });
        await expect.soft(row, `${key} ${r.user}: score`).toContainText(new RegExp(`\\b${r.score}\\b`));
        await expect.soft(row, `${key} ${r.user}: sync`).toContainText('Sent');
      }
      await shot(page, `AC-T7-06-results-${key}`, testInfo);
      await page.getByRole('button', { name: 'Refresh from Moodle' }).click();
      for (const r of rows) {
        const row = resultsRow(page, u[r.user].id, title).first();
        await expect.poll(() => cellUnder(row, /gradebook/i), { timeout: 30_000, message: `${key} ${r.user}: gradebook after refresh` }).toMatch(new RegExp(`(^|\\D)${r.score}(\\.0+)?(\\D|$)`));
      }
      await shot(page, `AC-T7-06-results-${key}-refreshed`, testInfo);
    }
  } finally {
    await ctx.close();
  }
});
