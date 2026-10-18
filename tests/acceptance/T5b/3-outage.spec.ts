// T5b: score syncs during a Moodle outage. Source: tasks/T5b.md AC-T5-14, AC-T5-30; contract cogniate-app-api.md §10
// (retry: 5 s, 30 s, 2 min, …), §5 (rows); ADR-010 rules 5 and 9 (best result, superseded; retries).
// The host runner (tests/host/run-t5.mjs) runs "docker compose stop/start moodle" when the test asks (lib/host-control.ts).
// Moodle is always started again in `finally`, so a failure here does not break the next tests.
// AC-T5-14 uses its own activity "Cogniate HTML AC-T5-14"; AC-T5-30 uses "Cogniate SCORM AC-T5-30" (SCORM: in the HTML
// course the first answer stands, so a later fail is impossible; tasks/T5b.md).
import type { BrowserContext } from '@playwright/test';
import { hostAction } from '../lib/host-control';
import { newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import {
  ACT,
  cmidOf,
  commitFromRuntime,
  course101,
  driveCourse,
  openPlayer,
  reloadRuntime,
  rowsFor,
  results,
  savedSuspendData,
  scormCommit,
  settledState,
  t5,
  waitForMoodle,
  waitForRow,
} from '../lib/t5';

test.describe.serial('T5b Moodle outage', () => {
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await newStackContext(browser);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T5-14 retry: Moodle stopped, the learner passes → row pending with tries ≥ 1; Moodle started before 30 s since the first try → within 3 min sent and Moodle 100', async () => {
    test.setTimeout(420_000);
    const user = seed().users.cg_student;
    const pub = String(t5().htmlPublicationId);
    const player = await openPlayer(context, user, cmidOf(ACT.htmlRetry));
    let started = false;
    try {
      await hostAction('moodle-stop');
      await driveCourse(player, { answer: 'correct' });
      const pending = await waitForRow(pub, user, ACT.htmlRetry, (r) => r.scoreSyncs.some((s) => s.status === 'pending' && s.tries >= 1), { timeoutMs: 25_000 });
      const sync = pending?.scoreSyncs.find((s) => s.status === 'pending');
      expect(sync?.tries ?? 0, `row while Moodle is down: ${JSON.stringify(pending?.scoreSyncs)}`).toBeGreaterThanOrEqual(1);
      const startedAt = Date.now();
      await hostAction('moodle-start');
      started = true;
      test.info().annotations.push({ type: 'timing', description: `moodle start asked ${Math.round((startedAt - Date.parse(String(sync?.createdAt))) / 1000)} s after the row was made` });
      const sent = await waitForRow(pub, user, ACT.htmlRetry, (r) => r.scoreSyncs.some((s) => s.status === 'sent'), { timeoutMs: 180_000 });
      expect(sent?.scoreSyncs.map((s) => s.status), JSON.stringify(sent?.scoreSyncs)).toContain('sent');
      const moodle = await waitForMoodle(course101(), user, ACT.htmlRetry, 100, { timeoutMs: 60_000 });
      expect(moodle.grade).toBe(100);
    } finally {
      if (!started) await hostAction('moodle-start').catch(() => undefined);
      await player.popup.close({ runBeforeUnload: true }).catch(() => undefined);
    }
  });

  test('AC-T5-30 outage order: Moodle stopped; the learner passes (row 1 pending, 100); a failed/0 final commit in a new session; Moodle started → Moodle 100, row 1 sent, no row with 0 sent', async () => {
    test.setTimeout(420_000);
    const user = seed().users.cg_student;
    const pub = String(t5().scormPublicationId);
    const player = await openPlayer(context, user, cmidOf(ACT.scormOutage));
    let started = false;
    try {
      await hostAction('moodle-stop');
      await driveCourse(player, { answer: 'correct' });
      const pending = await waitForRow(pub, user, ACT.scormOutage, (r) => r.scoreSyncs.some((s) => s.status === 'pending' && s.scoreGiven === 100), { timeoutMs: 30_000 });
      expect(pending?.scoreSyncs.map((s) => `${s.status}:${s.scoreGiven}`), 'row 1 pending, 100').toContain('pending:100');

      // A new session (new page load of the runtime page; Moodle is down, so no new launch), then a failed/0 final commit.
      await reloadRuntime(player);
      const state = await settledState(player.token);
      const core = { lesson_status: 'failed', score: { raw: '0', min: '0', max: '100' } };
      const c1 = await commitFromRuntime(player.runtime, player.token, scormCommit(state.sessionId, state.lastSeq + 1, 'commit', core, { suspend_data: savedSuspendData(state) }));
      const c2 = await commitFromRuntime(player.runtime, player.token, scormCommit(state.sessionId, state.lastSeq + 2, 'finish', core, { suspend_data: savedSuspendData(state) }));
      expect([c1.status, c2.status], `${c1.body.slice(0, 120)} | ${c2.body.slice(0, 120)}`).toEqual([200, 200]);

      await hostAction('moodle-start');
      started = true;
      const moodle = await waitForMoodle(course101(), user, ACT.scormOutage, 100, { timeoutMs: 240_000 });
      expect(moodle.grade, 'Moodle shows 100').toBe(100);
      const row = rowsFor(await results(pub), user, ACT.scormOutage)[0];
      expect(row?.scoreSyncs.filter((s) => s.scoreGiven === 100).map((s) => s.status), JSON.stringify(row?.scoreSyncs)).toContain('sent');
      expect(row?.scoreSyncs.filter((s) => s.scoreGiven === 0 && s.status === 'sent'), 'no row with 0 is sent').toEqual([]);
    } finally {
      if (!started) await hostAction('moodle-start').catch(() => undefined);
      await player.popup.close({ runBeforeUnload: true }).catch(() => undefined);
    }
  });
});
