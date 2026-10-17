// T5a: the SCORM 1.2 API with the QA "blank SCO" (a package that never calls the API), so every call comes from QA.
// Source: tasks/T5a.md AC-T5-05, -06, -21, -22; contract cogniate-app-api.md §7 (session time, entry, LMSFinish rule),
// §8 (API table and error codes); ADR-010 (mapping: completed → 100/100).
// Activities (lib/t5.ts ACT): "QA Blank SCO" for AC-T5-05/-06 (cg_student) and AC-T5-21 (cg_student2, a new learner
// attempt); "QA Blank SCO 2" for AC-T5-22 (cg_student, a fresh attempt, so earlier sessions add no time).
import type { BrowserContext } from '@playwright/test';
import { newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import {
  ACT,
  apiReady,
  cmidOf,
  course101,
  openPlayer,
  type Player,
  runtimeState,
  savedSuspendData,
  scormCalls,
  t5,
  waitForCommit,
  waitForMoodle,
  mismatches,
  waitForRow,
} from '../lib/t5';

/** Close the player window as a person does (beforeunload/pagehide run), then wait for the runtime's unload commit. */
async function closeAndWaitUnload(player: Player, sessionId: string): Promise<void> {
  const since = Date.now() - 1_000;
  await player.popup.close({ runBeforeUnload: true });
  const unload = await waitForCommit(sessionId, 'unload', since);
  expect(unload, `commit_accepted {unload} of session ${sessionId}`).toBeDefined();
}

test.describe('T5a blank SCO', () => {
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await newStackContext(browser);
  });

  test.afterEach(async () => {
    await context?.close();
  });

  test('AC-T5-05 the SCORM 1.2 API answers per contract §8 (301 before init, 405, 404, 403, 201, 201 on a new page load, 101 after LMSFinish)', async () => {
    test.setTimeout(120_000);
    const user = seed().users.cg_student;
    const player = await openPlayer(context, user, cmidOf(ACT.blankA));
    await apiReady(player);
    const problems: string[] = [];
    const before = await scormCalls(player.runtime, [['LMSGetValue', 'cmi.core.lesson_status']]);
    problems.push(...mismatches(before, [['', '301']]));
    const s1 = await scormCalls(player.runtime, [
      ['LMSInitialize', ''],
      ['LMSGetValue', 'cmi.core.student_id'],
      ['LMSGetValue', 'cmi.student_data.mastery_score'],
      ['LMSSetValue', 'cmi.core.lesson_status', 'done'],
      ['LMSGetValue', 'cmi.core.session_time'],
      ['LMSSetValue', 'cmi.core.student_id', 'x'],
      ['LMSGetValue', 'cmi.foo'],
    ]);
    problems.push(
      ...mismatches(s1, [
        ['true', '0'],
        [String(user.id), '0'],
        ['70', '0'],
        ['false', '405'],
        [undefined, '404'],
        ['false', '403'],
        [undefined, '201'],
      ]),
    );
    // A new page load of the runtime page = a new session.
    await player.runtime.evaluate(() => location.reload());
    await player.runtime.waitForLoadState('load');
    await apiReady(player);
    const s2 = await scormCalls(player.runtime, [
      ['LMSInitialize', 'x'],
      ['LMSInitialize', ''],
      ['LMSFinish', ''],
      ['LMSGetValue', 'cmi.core.lesson_status'],
    ]);
    problems.push(...mismatches(s2, [['false', '201'], ['true', '0'], ['true', '0'], [undefined, '101']]));
    test.info().annotations.push({ type: 'calls', description: [...before, ...s1, ...s2].map((c) => `${c.call} → "${c.value}" (${c.error})`).join('; ') });
    expect(problems).toEqual([]);
  });

  test('AC-T5-06 suspend_data and exit=suspend are kept: the next launch gets suspend_data "qa-resume" and entry "resume"', async () => {
    test.setTimeout(150_000);
    const user = seed().users.cg_student;
    const first = await openPlayer(context, user, cmidOf(ACT.blankA));
    await apiReady(first);
    const set = await scormCalls(first.runtime, [
      ['LMSInitialize', ''],
      ['LMSSetValue', 'cmi.suspend_data', 'qa-resume'],
      ['LMSSetValue', 'cmi.core.exit', 'suspend'],
      ['LMSCommit', ''],
    ]);
    expect(mismatches(set, [['true', '0'], ['true', '0'], ['true', '0'], ['true', '0']])).toEqual([]);
    // Wait until the commit is stored (RuntimeState shows it), then close the window.
    await expect.poll(async () => savedSuspendData((await runtimeState(first.token)).json!), { timeout: 15_000 }).toBe('qa-resume');
    await first.popup.close({ runBeforeUnload: true });

    const second = await openPlayer(context, user, cmidOf(ACT.blankA));
    await apiReady(second);
    const read = await scormCalls(second.runtime, [
      ['LMSInitialize', ''],
      ['LMSGetValue', 'cmi.suspend_data'],
      ['LMSGetValue', 'cmi.core.entry'],
    ]);
    expect(mismatches(read, [['true', '0'], ['qa-resume', '0'], ['resume', '0']])).toEqual([]);
  });

  test('AC-T5-21 a new learner attempt with LMSInitialize + LMSFinish only → outcome completed, Moodle shows 100', async () => {
    test.setTimeout(150_000);
    const user = seed().users.cg_student2;
    const player = await openPlayer(context, user, cmidOf(ACT.blankA));
    await apiReady(player);
    const calls = await scormCalls(player.runtime, [['LMSInitialize', ''], ['LMSFinish', '']]);
    expect(mismatches(calls, [['true', '0'], ['true', '0']])).toEqual([]);
    const row = await waitForRow(String(t5().blankPublicationId), user, ACT.blankA, (r) => r.attempts.some((a) => a.outcome === 'completed') && r.scoreSyncs.some((s) => s.status === 'sent'));
    expect(row?.attempts.map((a) => a.outcome), JSON.stringify(row)).toContain('completed');
    expect(row?.best?.outcome).toBe('completed');
    const moodle = await waitForMoodle(course101(), user, ACT.blankA, 100);
    expect(moodle.grade, 'Moodle grade of cg_student2 for "QA Blank SCO"').toBe(100);
  });

  test('AC-T5-22 two sessions of 30 s (each LMSFinish, then window close) → total_time 0000:01:00.00 in the third session', async () => {
    test.setTimeout(240_000);
    const user = seed().users.cg_student;
    for (const n of [1, 2]) {
      const p = await openPlayer(context, user, cmidOf(ACT.blankB));
      await apiReady(p);
      const state = await runtimeState(p.token);
      const calls = await scormCalls(p.runtime, [['LMSInitialize', ''], ['LMSSetValue', 'cmi.core.session_time', '0000:00:30.00'], ['LMSFinish', '']]);
      expect(mismatches(calls, [['true', '0'], ['true', '0'], ['true', '0']]), `session ${n}`).toEqual([]);
      await closeAndWaitUnload(p, String(state.json?.sessionId));
    }
    const third = await openPlayer(context, user, cmidOf(ACT.blankB));
    await apiReady(third);
    const read = await scormCalls(third.runtime, [['LMSInitialize', ''], ['LMSGetValue', 'cmi.core.total_time']]);
    expect(mismatches(read, [['true', '0'], ['0000:01:00.00', '0']])).toEqual([]);
  });
});
