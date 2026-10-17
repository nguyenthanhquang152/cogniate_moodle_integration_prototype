// T5b: teacher override. Source: tasks/T5b.md AC-T5-33; contract cogniate-app-api.md §5 (refresh, gradebookDiffers);
// ADR-010 rule 8 (a teacher override is not a conflict: the sync is sent and Moodle keeps the override).
// QA's activity "QA SCORM override": in "Cogniate SCORM" cg_student2 already has 100 (AC-T5-23), so no better result
// is possible there. Both of cg_student2's results here are commits that QA posts from the runtime frame (as AC-T5-23):
// first failed/0 (so there is a grade to override), then, after the override, a better passed/100.
import type { BrowserContext } from '@playwright/test';
import { publicUrls } from '../lib/env';
import { newStackContext } from '../lib/moodle-launch';
import { moodleLogin } from '../lib/moodle-ui';
import { gradeItems } from '../lib/moodle-ws';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import {
  ACT,
  cmidOf,
  commitFromRuntime,
  course101,
  markRan,
  moodleShown,
  openPlayer,
  overrideGradeInUi,
  packageFrame,
  refreshResults,
  rowsFor,
  savedSuspendData,
  scormCommit,
  settledState,
  t5,
  waitForMoodle,
  waitForRow,
} from '../lib/t5';

const urls = publicUrls();

async function postFinal(context: BrowserContext, status: 'failed' | 'passed', raw: string): Promise<void> {
  const player = await openPlayer(context, seed().users.cg_student2, cmidOf(ACT.scormOverride));
  try {
    await packageFrame(player, 'index.html');
    const state = await settledState(player.token);
    const core = { lesson_status: status, score: { raw, min: '0', max: '100' } };
    const c1 = await commitFromRuntime(player.runtime, player.token, scormCommit(state.sessionId, state.lastSeq + 1, 'commit', core, { suspend_data: savedSuspendData(state) }));
    const c2 = await commitFromRuntime(player.runtime, player.token, scormCommit(state.sessionId, state.lastSeq + 2, 'finish', core, { suspend_data: savedSuspendData(state) }));
    expect([c1.status, c2.status], `${c1.body.slice(0, 120)} | ${c2.body.slice(0, 120)}`).toEqual([200, 200]);
  } finally {
    await player.popup.close({ runBeforeUnload: true });
  }
}

test('AC-T5-33 teacher override: the grade is overridden to 50; a better result is sent; Moodle still shows 50; after Refresh, gradebookDiffers and resultScore 50', async ({ browser }) => {
  test.setTimeout(480_000);
  const s2 = seed().users.cg_student2;
  const pub = String(t5().scormPublicationId);
  const context = await newStackContext(browser);
  try {
    await postFinal(context, 'failed', '0');
    const first = await waitForRow(pub, s2, ACT.scormOverride, (r) => r.scoreSyncs.some((s) => s.status === 'sent'));
    expect(first?.scoreSyncs.map((s) => `${s.status}:${s.scoreGiven}`), JSON.stringify(first)).toEqual(['sent:0']);
    expect((await waitForMoodle(course101(), s2, ACT.scormOverride, 0)).grade).toBe(0);

    // cg_teacher overrides cg_student2's grade in the grader report to 50.
    const item = (await gradeItems(seed().oracleToken, course101(), s2.id)).find((i) => i.itemname === ACT.scormOverride);
    expect(item, 'grade item of "QA SCORM override"').toBeDefined();
    const page = await context.newPage();
    await moodleLogin(page, urls.moodle, seed().users.cg_teacher.username, seed().users.cg_teacher.password);
    await overrideGradeInUi(page, course101(), s2.id, item!.id, '50');
    await page.screenshot({ path: test.info().outputPath('grader-report-override.png'), fullPage: true });
    await page.close();
    const overridden = await moodleShown(course101(), s2, ACT.scormOverride);
    expect(overridden, 'Moodle shows 50, overridden').toMatchObject({ shown: 50, overridden: true });

    // A better final result → a new sync row, sent; Moodle keeps the override.
    await postFinal(context, 'passed', '100');
    const second = await waitForRow(pub, s2, ACT.scormOverride, (r) => r.scoreSyncs.some((s) => s.scoreGiven === 100 && s.status === 'sent'), { timeoutMs: 120_000 });
    expect(second?.scoreSyncs.map((s) => `${s.status}:${s.scoreGiven}`), JSON.stringify(second?.scoreSyncs)).toContain('sent:100');
    expect((await moodleShown(course101(), s2, ACT.scormOverride))?.shown, 'Moodle still shows 50').toBe(50);

    // "Refresh from Moodle".
    const refreshed = await refreshResults(pub);
    expect(refreshed.status, refreshed.body.slice(0, 200)).toBe(200);
    const row = rowsFor(refreshed.rows, s2, ACT.scormOverride)[0];
    expect(row?.gradebookDiffers, JSON.stringify(row)).toBe(true);
    expect(row?.gradebook?.resultScore).toBe(50);
    markRan('AC-T5-33');
  } finally {
    await context.close();
  }
});
