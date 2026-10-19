// App contract §6 (P11) and ADR-010 rules 5/11. Each test uses a fresh activity.
// Launch both versions before the outage/unenrolment; improve version 1 while version 2 stays open.
import { hostAction } from '../lib/host-control';
import { publicUrls } from '../lib/env';
import { newStackContext } from '../lib/moodle-launch';
import { moodleLogin } from '../lib/moodle-ui';
import { expect, test } from '../lib/pw';
import { publishNewVersion, qaBlankActivity } from '../lib/qa-course';
import { seed } from '../lib/seed';
import {
  commitFromRuntime, enrolInUi, enrolledUser, openPlayer, reloadRuntime, resendSync,
  results, rowsFor, savedSuspendData, scormCommit, settledState, shellText,
  unenrolInUi, waitForMoodle, waitForRow,
} from '../lib/t5';

async function finish(player: Awaited<ReturnType<typeof openPlayer>>, raw: number) {
  const s = await settledState(player.token);
  const core = { lesson_status: raw >= 70 ? 'passed' : 'failed', score: { raw: String(raw), min: '0', max: '100' } };
  for (const [i, event] of (['commit', 'finish'] as const).entries()) {
    const res = await commitFromRuntime(player.runtime, player.token,
      scormCommit(s.sessionId, s.lastSeq + i + 1, event, core, { suspend_data: savedSuspendData(s) }));
    expect(res.status, res.body.slice(0, 200)).toBe(200);
  }
}

for (const kind of ['pending', 'failed'] as const) {
  test(`P11 ${kind}: lower version-2 retake 75 names the unsent best score 90; API and results keep both scores separate`, async ({ browser }) => {
    test.setTimeout(480_000);
    const context = await newStackContext(browser);
    const adminContext = await newStackContext(browser);
    const admin = await adminContext.newPage();
    const user = seed().users.cg_student2;
    const course = seed().courses['COGNIATE-DEV-102'];
    let stopped = false;
    let unenrolled = false;
    let email = '';
    try {
      const c = await qaBlankActivity(context, `P11-${kind}-102`, course);
      const first = await openPlayer(context, user, c.cmid);
      await finish(first, 60);
      const initial = await waitForRow(c.publicationId, user, c.activity,
        (r) => r.scoreSyncs.some((s) => s.scoreGiven === 60 && s.status === 'sent'));
      expect(initial?.scoreSyncs.map((s) => `${s.status}:${s.scoreGiven}`)).toEqual(['sent:60']);
      const version2 = await publishNewVersion(c);
      const retake = await openPlayer(context, user, c.cmid);
      await reloadRuntime(first);
      if (kind === 'pending') {
        await hostAction('moodle-stop');
        stopped = true;
      } else {
        email = String((await enrolledUser(course, user.id))?.email ?? '');
        expect(email).not.toBe('');
        await moodleLogin(admin, publicUrls().moodle, seed().users.admin.username, seed().users.admin.password);
        await unenrolInUi(admin, course, user.id);
        unenrolled = true;
        expect(await enrolledUser(course, user.id)).toBeUndefined();
      }
      await finish(first, 90);
      const high = await waitForRow(c.publicationId, user, c.activity,
        (r) => r.scoreSyncs.some((s) => s.scoreGiven === 90 && s.status === kind && s.tries >= 1));
      const sync = high?.scoreSyncs.find((s) => s.scoreGiven === 90);
      expect(sync?.status, JSON.stringify(high?.scoreSyncs)).toBe(kind);
      if (kind === 'failed') expect(sync?.lastError).toContain('PLATFORM_REJECTED_REQUEST');
      await finish(retake, 75);
      const status = await retake.popup.evaluate(async (id) =>
        (await fetch(`/app-api/play/${id}/status`)).json(), retake.playId);
      expect(status.scoreGiven).toBe(75);
      expect(status.scoreSync).toEqual({ status: kind, scoreGiven: 90, scoreMaximum: 100 });
      const message = kind === 'pending'
        ? 'Completed — score 75. Sending your best score, 90, to Moodle'
        : 'Completed — score 75. Your best score, 90, was not sent to Moodle';
      await expect.poll(() => shellText(retake.popup), { timeout: 30_000 }).toContain(message);
      const row = rowsFor(await results(c.publicationId), user, c.activity)[0];
      expect(row?.best?.scoreGiven).toBe(90);
      expect(row?.attempts.map((a) => [a.versionId, a.scoreGiven]).sort()).toEqual([[c.versionId, 90], [version2, 75]].sort());
      expect(row?.scoreSyncs.map((s) => `${s.status}:${s.scoreGiven}`)).toEqual(['sent:60', `${kind}:90`]);
      test.info().annotations.push({ type: 'status API', description: JSON.stringify(status) });
      await retake.popup.screenshot({ path: test.info().outputPath(`retake-${kind}.png`) });
      if (stopped) {
        await hostAction('moodle-start');
        stopped = false;
      }
      if (unenrolled) {
        await enrolInUi(admin, course, email);
        unenrolled = false;
        expect((await enrolledUser(course, user.id))?.roles).toContain('student');
        expect((await resendSync(sync!.id)).status).toBe(200);
      }
      expect((await waitForMoodle(course, user, c.activity, 90, { timeoutMs: 180_000 })).grade).toBe(90);
    } finally {
      if (stopped) await hostAction('moodle-start');
      if (unenrolled) await enrolInUi(admin, course, email);
      await adminContext.close();
      await context.close();
    }
  });
}
