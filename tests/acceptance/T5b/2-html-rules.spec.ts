// T5b: the HTML progress rules. Source: tasks/T5b.md AC-T5-11, -27, -28, -29; ADR-004 "HTML: option C" (seen = 10 s
// visible + scroll to the end; menu page seen on visit; first answer stands; complete = all pages seen and all
// questions answered); ADR-010 (only final outcomes are sent).
// AC-T5-11 then AC-T5-27: cg_student2 in "Cogniate HTML" (serial: the "new run" continues the in-progress attempt).
// AC-T5-28 and AC-T5-29: cg_student in their own activities "Cogniate HTML AC-T5-28" and "Cogniate HTML AC-T5-29".
import type { BrowserContext } from '@playwright/test';
import { newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import {
  ACT,
  cmidOf,
  course101,
  driveCourse,
  moodleGrade,
  openPlayer,
  packageFrame,
  results,
  rowsFor,
  runtimeState,
  t5,
  waitForCommit,
  waitForMoodle,
  waitForRow,
} from '../lib/t5';

const htmlPub = () => String(t5().htmlPublicationId);

test.describe.serial('T5b HTML rules', () => {
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await newStackContext(browser);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T5-11 incomplete: cg_student2 sees only the menu page and closes the window → no grade in Moodle; row in_progress, no scoreSyncs', async () => {
    test.setTimeout(120_000);
    const s2 = seed().users.cg_student2;
    const player = await openPlayer(context, s2, cmidOf(ACT.html));
    await packageFrame(player, 'index.html');
    const session = String((await runtimeState(player.token)).json?.sessionId ?? '');
    const since = Date.now() - 1_000;
    await player.popup.waitForTimeout(2_000); // the menu page is seen on visit; let the runtime report it
    await player.popup.close({ runBeforeUnload: true });
    expect(await waitForCommit(session, 'unload', since), 'the unload of the session arrived').toBeDefined();
    const row = rowsFor(await results(htmlPub()), s2, ACT.html)[0];
    expect(row?.attempts.map((a) => a.outcome), JSON.stringify(row)).toEqual(['in_progress']);
    expect(row?.scoreSyncs ?? []).toEqual([]);
    const grade = await moodleGrade(course101(), s2, ACT.html);
    expect(grade ?? null, 'no grade in Moodle').toBeNull();
  });

  test('AC-T5-27 HTML fail: cg_student2 (new run) picks a wrong option and finishes the pages → Moodle 0; row failed, one sync sent', async () => {
    test.setTimeout(240_000);
    const s2 = seed().users.cg_student2;
    const player = await openPlayer(context, s2, cmidOf(ACT.html));
    await driveCourse(player, { answer: 'wrong' });
    const moodle = await waitForMoodle(course101(), s2, ACT.html, 0);
    expect(moodle.grade, 'Moodle grade').toBe(0);
    const row = await waitForRow(htmlPub(), s2, ACT.html, (r) => r.scoreSyncs.some((s) => s.status === 'sent'));
    expect(row?.best?.outcome, JSON.stringify(row)).toBe('failed');
    expect(row?.scoreSyncs.map((s) => `${s.status}:${s.scoreGiven}`)).toEqual(['sent:0']);
    await player.popup.close({ runBeforeUnload: true });
  });

  test('AC-T5-28 first answer stands: a wrong option, then the correct one, then the pages → failed, score 0', async () => {
    test.setTimeout(240_000);
    const user = seed().users.cg_student;
    const player = await openPlayer(context, user, cmidOf(ACT.htmlFirst));
    await driveCourse(player, { answer: 'wrong-then-correct' });
    const row = await waitForRow(htmlPub(), user, ACT.htmlFirst, (r) => r.best?.outcome === 'failed' || r.best?.outcome === 'passed');
    expect(row?.best?.outcome, JSON.stringify(row)).toBe('failed');
    expect(row?.best?.scoreGiven).toBe(0);
    const moodle = await waitForMoodle(course101(), user, ACT.htmlFirst, 0);
    expect(moodle.grade, 'Moodle grade').toBe(0);
    await player.popup.close({ runBeforeUnload: true });
  });

  test('AC-T5-29 dwell rule: the learner answers, scrolls to the end and closes the window before 10 s → in_progress, no sync', async () => {
    test.setTimeout(120_000);
    const user = seed().users.cg_student;
    const player = await openPlayer(context, user, cmidOf(ACT.htmlDwell));
    const session = String((await runtimeState(player.token)).json?.sessionId ?? '');
    const start = Date.now();
    await driveCourse(player, { answer: 'correct', dwell: false });
    const since = Date.now() - 1_000;
    await player.popup.close({ runBeforeUnload: true });
    const onLesson = Date.now() - start;
    expect(onLesson, 'ms from the lesson click to the window close').toBeLessThan(10_000);
    expect(await waitForCommit(session, 'unload', since), 'the unload of the session arrived').toBeDefined();
    await new Promise((r) => setTimeout(r, 3_000));
    const row = rowsFor(await results(htmlPub()), user, ACT.htmlDwell)[0];
    expect(row?.attempts.map((a) => a.outcome), JSON.stringify(row)).toEqual(['in_progress']);
    expect(row?.scoreSyncs ?? []).toEqual([]);
  });
});
