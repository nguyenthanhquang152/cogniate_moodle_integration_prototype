// Conformance P11 (Lead, app contract §6 at 5d2bf50): the play status API returns the score of the synced row in
// scoreSync, and the player text says when Moodle keeps a better score. QA recipe: own blank SCO course and activity;
// cg_student passes with 90 (sent); version 2 is published; the retake on version 2 ends with 75 (lower: no new sync).
import type { BrowserContext } from '@playwright/test';
import { newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { publishNewVersion, qaBlankActivity } from '../lib/qa-course';
import { seed } from '../lib/seed';
import { commitFromRuntime, course101, moodleGrade, openPlayer, rowsFor, results, savedSuspendData, scormCommit, settledState, shellText, waitForMoodle, waitForRow } from '../lib/t5';

type Status = { outcome?: string; scoreGiven?: number | null; scoreMaximum?: number | null; scoreSync?: { status?: string | null; scoreGiven?: number | null; scoreMaximum?: number | null } };

async function finalCommit(player: Awaited<ReturnType<typeof openPlayer>>, raw: number): Promise<void> {
  const s = await settledState(player.token);
  const core = { lesson_status: 'passed', score: { raw: String(raw), min: '0', max: '100' } };
  const c1 = await commitFromRuntime(player.runtime, player.token, scormCommit(s.sessionId, s.lastSeq + 1, 'commit', core, { suspend_data: savedSuspendData(s) }));
  const c2 = await commitFromRuntime(player.runtime, player.token, scormCommit(s.sessionId, s.lastSeq + 2, 'finish', core, { suspend_data: savedSuspendData(s) }));
  expect([c1.status, c2.status], `${c1.body.slice(0, 120)} | ${c2.body.slice(0, 120)}`).toEqual([200, 200]);
}

test('AC-T5-07 (P11) after a lower retake (75) on a new version: the status API scoreSync is the synced row (sent, 90/100); the player says "Completed — score 75. Moodle keeps your best score: 90"; no new sync; Moodle 90', async ({ browser }) => {
  test.setTimeout(480_000);
  const user = seed().users.cg_student;
  const context: BrowserContext = await newStackContext(browser);
  try {
    const c = await qaBlankActivity(context, 'P11');
    const first = await openPlayer(context, user, c.cmid);
    await finalCommit(first, 90);
    await waitForRow(c.publicationId, user, c.activity, (r) => r.scoreSyncs.some((s) => s.scoreGiven === 90 && s.status === 'sent'), { timeoutMs: 120_000 });
    expect((await waitForMoodle(course101(), user, c.activity, 90)).grade, 'Moodle 90').toBe(90);
    await first.popup.close({ runBeforeUnload: true });

    await publishNewVersion(c);
    const retake = await openPlayer(context, user, c.cmid);
    await finalCommit(retake, 75);
    const status = async () => retake.popup.evaluate(async (id) => (await fetch(`/app-api/play/${id}/status`, { credentials: 'include' })).json(), retake.playId) as Promise<Status>;
    await expect.poll(async () => (await status()).scoreGiven, { timeout: 30_000, message: 'this attempt: 75' }).toBe(75);
    const st = await status();
    test.info().annotations.push({ type: 'status API', description: JSON.stringify(st) });
    expect(st.scoreSync, 'scoreSync = the synced row').toEqual({ status: 'sent', scoreGiven: 90, scoreMaximum: 100 });
    await expect.poll(() => shellText(retake.popup), { timeout: 30_000, message: 'player status text' }).toContain('Completed — score 75. Moodle keeps your best score: 90');
    const row = rowsFor(await results(c.publicationId), user, c.activity)[0];
    expect(row?.scoreSyncs.map((s) => `${s.status}:${s.scoreGiven}`), 'no new sync for the lower retake').toEqual(['sent:90']);
    expect(await moodleGrade(course101(), user, c.activity), 'Moodle keeps 90').toBe(90);
    await retake.popup.close({ runBeforeUnload: true });
  } finally {
    await context.close();
  }
});
