// Flows that Scenario A and Scenario B share: the teacher adds a Cogniate activity, and a learner does one activity.
import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import { stateCookieHeader } from './capture';
import { ART, escapeRegExp, EVIDENCE, type LaunchRecord, loadState, need, note, pollUntil, saveState, SHELL_DONE_0, SHELL_DONE_100, shot, urls } from './e2e';
import { doCourse, domClicks, launchFromCourse, shellText } from './learner';
import { addActivityFromChooser, ensureEditMode, openSelectContent, pickCourse, saveAndReturn, setCompletionReceiveGrade } from './moodle';
import { cmidByName, grade, users } from './oracle';
import { expect } from './pw';

/** Viewport screenshot into tests/e2e/artifacts/evidence/<name>.png, also attached to the test report (keeps Moodle's sticky footer in the viewport). */
export async function viewportShot(page: Page, name: string, testInfo?: TestInfo): Promise<string> {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const file = path.join(EVIDENCE, `${name.replace(/[^\w.-]+/g, '_')}.png`);
  await page.screenshot({ path: file, fullPage: false });
  if (testInfo) await testInfo.attach(name, { path: file, contentType: 'image/png' });
  return path.relative(ART, file);
}

/** Teacher: Add content → Activity or resource → the tool → Select content → the course → completion → save. */
export async function addCogniateActivity(page: Page, courseId: number, toolName: string, title: string, pickerKey: string, testInfo: TestInfo): Promise<number> {
  await ensureEditMode(page, courseId);
  const { chooserItems } = await addActivityFromChooser(page, toolName);
  note(testInfo, 'chooser', `${pickerKey}: the chooser lists ${chooserItems.filter((i) => i.startsWith('Cogniate')).join(', ')}`);
  const picker = await openSelectContent(page);
  saveState({ pickers: { [pickerKey]: picker.titles } });
  await shot(page, `${pickerKey}-picker`, testInfo);
  const name = await pickCourse(page, picker, title);
  expect(name, 'Moodle fills the activity name from the picked course').toBe(title);
  await setCompletionReceiveGrade(page);
  await page.locator('#id_activitycompletionheader').scrollIntoViewIfNeeded();
  await viewportShot(page, `${pickerKey}-activity-form`, testInfo);
  await saveAndReturn(page);
  return need(await cmidByName(courseId, title), `the new activity "${title}"`);
}

export interface LearnerResult {
  launch: LaunchRecord;
  shell: string;
  /** Seconds from the end of the course to the grade in the QA oracle; null = not within 60 s. */
  latency: number | null;
  grade: number | null;
}

/** One learner run of one activity: launch, AC-T7-07 facts, the course, the shell text and the Moodle grade (≤ 60 s). */
export async function learnerRun(context: BrowserContext, user: 'cg_student' | 'cg_student2', key: string, answer: 'correct' | 'wrong', testInfo: TestInfo): Promise<LearnerResult> {
  const act = need(loadState().activities?.[key], `activity ${key}`);
  const u = users()[user];
  const l = await launchFromCourse(context, u, act.courseId, act.name, `${user} ${key}`);
  const rec: LaunchRecord = { user, activity: act.name, finalUrl: l.playUrl, topLevel: l.popup !== l.coursePage, hasOpener: l.hasOpener, msToPlay: l.msToPlay };
  saveState({ launches: [...(loadState().launches ?? []), rec] });
  await shot(l.popup, `${user}-${key}-player`, testInfo);
  // Scenario C1 replays one learner launch form: keep the first one (cg_student, SCORM).
  if (!loadState().replay) {
    const f = l.capture.forms[0];
    if (f) saveState({ replay: { id_token: f.id_token, state: f.state, cookie: stateCookieHeader(l.capture.stateCookies), firstStatus: l.capture.launchStatuses[0] ?? 0 } });
  }
  await l.capture.stop();
  domClicks.length = 0;
  await doCourse(l.popup, answer);
  if (domClicks.length) note(testInfo, 'DOM click', `${user} ${key}: ${domClicks.join('; ')}`);
  const t0 = Date.now();
  const want = answer === 'correct' ? 100 : 0;
  const matches = (v: { raw: number | null } | undefined) => v?.raw !== null && v?.raw !== undefined && Math.abs(Number(v.raw) - want) < 0.001;
  // The grade in Moodle (AC deadline 60 s) and the final shell text (the shell polls every 5 s), at the same time.
  const [g] = await Promise.all([
    pollUntil(() => grade(act.courseId, u, act), matches, 60_000, 1_000),
    l.popup.getByText(answer === 'correct' ? SHELL_DONE_100 : SHELL_DONE_0).first().waitFor({ timeout: 90_000 }).catch(() => undefined),
  ]);
  const latency = matches(g) ? Math.round((Date.now() - t0) / 100) / 10 : null;
  const shell = await shellText(l.popup);
  saveState({ gradeLatency: { [`${user} ${key}`]: latency ?? -1 } });
  await shot(l.popup, `${user}-${key}-done`, testInfo);
  await l.popup.close({ runBeforeUnload: true }).catch(() => undefined);
  return { launch: rec, shell, latency, grade: g?.raw ?? null };
}

/** AC-T7-07: the launch ends at {PUBLIC_APP_URL}/play/... in a new top-level window; no ltik in the final URL. */
export function checkLaunch(rec: LaunchRecord): void {
  expect.soft(rec.finalUrl, `${rec.user} ${rec.activity}: final URL`).toMatch(new RegExp(`^${escapeRegExp(urls.app)}/play/`));
  expect.soft(rec.finalUrl, `${rec.user} ${rec.activity}: no ltik in the final URL`).not.toContain('ltik');
  expect.soft(rec.topLevel && rec.hasOpener, `${rec.user} ${rec.activity}: a new top-level window opened from Moodle`).toBe(true);
}
