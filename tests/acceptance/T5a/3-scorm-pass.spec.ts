// T5a: the full SCORM course as cg_student in "Cogniate SCORM", and what happens after it. Source: tasks/T5a.md
// AC-T5-07, -34, -20, -12; contract cogniate-app-api.md §5 (results), §7 (commits after finish never lower the
// outcome), §12; ADR-010 rules 4 and 5 (best result, never lower); data-model §2 (a launch after a final attempt on
// the same version uses that attempt again, so the package calls LMSFinish at once).
// Serial: AC-T5-34 uses the window of AC-T5-07; AC-T5-20 and AC-T5-12 come after AC-T5-07. All of them run before
// AC-T5-24 (4-scorm-student2.spec.ts) publishes version 2.
import type { BrowserContext } from '@playwright/test';
import { moodleLogin } from '../lib/moodle-ui';
import { newStackContext } from '../lib/moodle-launch';
import { publicUrls } from '../lib/env';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import {
  ACT,
  cmidOf,
  commitEvents,
  commitFromRuntime,
  commitKind,
  course101,
  driveCourse,
  markRan,
  moodleGrade,
  openPlayer,
  packageFrame,
  type Player,
  results,
  rowsFor,
  runtimeState,
  SHELL,
  savedSuspendData,
  scormCommit,
  settledState,
  shellText,
  t5,
  waitForCommit,
  waitForMoodle,
  waitForRow,
} from '../lib/t5';

const urls = publicUrls();

test.describe.serial('T5a SCORM pass (cg_student, "Cogniate SCORM")', () => {
  let context: BrowserContext;
  let passWindow: Player | undefined;
  let passSession = '';
  let finishAt = 0;
  const user = () => seed().users.cg_student;
  const pub = () => String(t5().scormPublicationId);

  test.beforeAll(async ({ browser }) => {
    context = await newStackContext(browser);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T5-07 SCORM pass: within 60 s the shell says "Completed — score 100 sent to Moodle", Moodle shows 100 and completion done, the row is passed/100 with one sync sent', async () => {
    test.setTimeout(240_000);
    passWindow = await openPlayer(context, user(), cmidOf(ACT.scorm));
    passSession = String((await runtimeState(passWindow.token)).json?.sessionId ?? '');
    const since = Date.now() - 1_000;
    await driveCourse(passWindow, { answer: 'correct' });
    const done = Date.now();
    const finish = await waitForCommit(passSession, 'finish', since, 30_000);
    finishAt = finish ? Date.parse(String(finish.ts)) : Date.now();
    const left = () => Math.max(1_000, done + 60_000 - Date.now());

    await expect.poll(() => shellText(passWindow!.popup), { timeout: left(), intervals: [1_000] }).toContain(SHELL.completed100);
    const moodle = await waitForMoodle(course101(), user(), ACT.scorm, 100, { cmid: cmidOf(ACT.scorm), timeoutMs: left() });
    expect(moodle.grade, 'Moodle grade').toBe(100);
    expect(moodle.completion ?? 0, 'Moodle completion state (1 = done)').toBeGreaterThanOrEqual(1);
    const row = await waitForRow(pub(), user(), ACT.scorm, (r) => r.scoreSyncs.some((s) => s.status === 'sent'), { timeoutMs: left() });
    expect(row?.best?.outcome, JSON.stringify(row)).toBe('passed');
    expect(row?.best?.scoreGiven).toBe(100);
    expect(row?.scoreSyncs.map((s) => s.status)).toEqual(['sent']);

    // Evidence: grader report (teacher) and course page (learner).
    const evidence = await context.browser()!.newContext({ ignoreHTTPSErrors: process.env.QA_IGNORE_HTTPS_ERRORS === '1' });
    try {
      const t = await evidence.newPage();
      await moodleLogin(t, urls.moodle, seed().users.cg_teacher.username, seed().users.cg_teacher.password);
      await t.goto(`${urls.moodle}/grade/report/grader/index.php?id=${course101()}`);
      await t.screenshot({ path: test.info().outputPath('grader-report.png'), fullPage: true });
      const l = await evidence.newPage();
      await moodleLogin(l, urls.moodle, user().username, user().password);
      await l.goto(`${urls.moodle}/course/view.php?id=${course101()}`);
      await l.screenshot({ path: test.info().outputPath('course-page-cg_student.png'), fullPage: true });
    } finally {
      await evidence.close();
    }
    markRan('AC-T5-07');
  });

  test('AC-T5-34 after the end, back to the menu page in the same window: no second finish, no new commit (at most one unload), outcome stays passed', async () => {
    test.setTimeout(120_000);
    expect(passWindow, 'the AC-T5-07 window').toBeDefined();
    const lesson = await packageFrame(passWindow!);
    await lesson.evaluate(() => {
      const a = document.querySelector('a[href="index.html"]') as HTMLAnchorElement | null;
      if (a) a.click();
      else location.href = 'index.html';
    });
    await packageFrame(passWindow!, 'index.html');
    // Observation window for "no new commit": 10 s on the menu page (the package commits at once on load if it would).
    await passWindow!.popup.waitForTimeout(10_000);
    const after = commitEvents(passSession, finishAt + 1).map((e) => commitKind(e));
    expect(after.filter((k) => k !== 'unload'), `commit_accepted events after the finish: ${after.join(', ') || 'none'}`).toEqual([]);
    expect(after.filter((k) => k === 'unload').length, 'unload events').toBeLessThanOrEqual(1);
    const row = rowsFor(await results(pub()), user(), ACT.scorm)[0];
    expect(row?.best?.outcome).toBe('passed');
    expect(row?.scoreSyncs).toHaveLength(1);
  });

  test('AC-T5-20 cg_student opens "Cogniate SCORM" again (the package calls LMSFinish at once): no new sync, best still passed, Moodle still 100', async () => {
    test.setTimeout(120_000);
    await passWindow?.popup.close({ runBeforeUnload: true }).catch(() => undefined);
    const again = await openPlayer(context, user(), cmidOf(ACT.scorm));
    const session = String((await runtimeState(again.token)).json?.sessionId ?? '');
    const since = Date.now() - 2_000;
    const finish = await waitForCommit(session, 'finish', since, 30_000);
    expect(finish, 'the package sent a finish in the new session (it calls LMSFinish at once on a finished attempt)').toBeDefined();
    await again.popup.waitForTimeout(3_000); // a sync row would be made in the same transaction as the attempt update
    const row = rowsFor(await results(pub()), user(), ACT.scorm)[0];
    expect(row?.scoreSyncs, 'no new scoreSyncs entry').toHaveLength(1);
    expect(row?.best?.outcome).toBe('passed');
    expect(await moodleGrade(course101(), user(), ACT.scorm)).toBe(100);
    await again.popup.close({ runBeforeUnload: true });
  });

  test('AC-T5-12 after AC-T5-07: a commit failed/0 with seq = lastSeq + 1 from the runtime frame → 200; no new sync; Moodle still 100', async () => {
    test.setTimeout(120_000);
    const again = await openPlayer(context, user(), cmidOf(ACT.scorm));
    const state = await settledState(again.token);
    const body = scormCommit(state.sessionId, state.lastSeq + 1, 'commit', { lesson_status: 'failed', score: { raw: '0', min: '0', max: '100' } }, { suspend_data: savedSuspendData(state) });
    const res = await commitFromRuntime(again.runtime, again.token, body);
    expect(res.status, res.body.slice(0, 300)).toBe(200);
    await again.popup.waitForTimeout(3_000);
    const row = rowsFor(await results(pub()), user(), ACT.scorm)[0];
    expect(row?.scoreSyncs, 'no new scoreSyncs entry').toHaveLength(1);
    expect(row?.best?.outcome).toBe('passed');
    expect(await moodleGrade(course101(), user(), ACT.scorm)).toBe(100);
    await again.popup.close({ runBeforeUnload: true });
  });
});
