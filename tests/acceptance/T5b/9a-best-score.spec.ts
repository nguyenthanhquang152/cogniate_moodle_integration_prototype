// Fixture-assisted P5, expressly allowed by tasks/T5b.md (2026-10-19).
// All setup and assertions use public UI/API. The host deletes only the exact higher failed sync row.
import { publicUrls } from '../lib/env';
import { hostAction } from '../lib/host-control';
import { newStackContext } from '../lib/moodle-launch';
import { moodleLogin } from '../lib/moodle-ui';
import { expect, test } from '../lib/pw';
import { publishNewVersion, qaBlankActivity } from '../lib/qa-course';
import { seed } from '../lib/seed';
import {
  commitFromRuntime, enrolInUi, enrolledUser, openPlayer, resendSync, results, rowsFor,
  savedSuspendData, scormCommit, settledState, unenrolInUi, waitForRow,
} from '../lib/t5';

test('P5 fixture-assisted: final attempts 60 and 80 across versions; remove only failed sync 80; best remains 80 and failed sync 60 Resend is refused', async ({ browser }) => {
  test.setTimeout(480_000);
  const context = await newStackContext(browser);
  const adminContext = await newStackContext(browser);
  const admin = await adminContext.newPage();
  const user = seed().users.cg_student2;
  const course = seed().courses['COGNIATE-DEV-102'];
  let unenrolled = false;
  let email = '';
  try {
    const c = await qaBlankActivity(context, 'P5-102', course);
    email = String((await enrolledUser(course, user.id))?.email ?? '');
    expect(email).not.toBe('');
    await moodleLogin(admin, publicUrls().moodle, seed().users.admin.username, seed().users.admin.password);
    const makeFailed = async (raw: number) => {
      const player = await openPlayer(context, user, c.cmid);
      await unenrolInUi(admin, course, user.id);
      unenrolled = true;
      expect(await enrolledUser(course, user.id)).toBeUndefined();
      const s = await settledState(player.token);
      const core = { lesson_status: raw >= 70 ? 'passed' : 'failed', score: { raw: String(raw), min: '0', max: '100' } };
      for (const [i, event] of (['commit', 'finish'] as const).entries()) {
        const res = await commitFromRuntime(player.runtime, player.token,
          scormCommit(s.sessionId, s.lastSeq + i + 1, event, core, { suspend_data: savedSuspendData(s) }));
        expect(res.status, res.body.slice(0, 200)).toBe(200);
      }
      const row = await waitForRow(c.publicationId, user, c.activity,
        (r) => r.scoreSyncs.some((sync) => sync.scoreGiven === raw && sync.status === 'failed'));
      expect(row?.scoreSyncs.find((sync) => sync.scoreGiven === raw)?.lastError).toContain('PLATFORM_REJECTED_REQUEST');
      await enrolInUi(admin, course, email);
      unenrolled = false;
      expect((await enrolledUser(course, user.id))?.roles).toContain('student');
      await player.popup.close({ runBeforeUnload: true });
    };
    await makeFailed(60);
    const version2 = await publishNewVersion(c);
    await makeFailed(80);
    const before = rowsFor(await results(c.publicationId), user, c.activity)[0];
    expect(before?.attempts.map((a) => [a.versionId, a.scoreGiven]).sort()).toEqual([[c.versionId, 60], [version2, 80]].sort());
    expect(before?.scoreSyncs.map((s) => [s.status, s.scoreGiven])).toEqual([['failed', 60], ['failed', 80]]);
    const low = before!.scoreSyncs.find((s) => s.scoreGiven === 60)!;
    const high = before!.scoreSyncs.find((s) => s.scoreGiven === 80)!;
    const fixture = await hostAction('p5-remove-failed-sync', 240_000, { payload: { syncId: high.id } });
    expect(fixture.fixture).toEqual({ deletedSyncId: high.id, deletedCount: 1 });
    const after = rowsFor(await results(c.publicationId), user, c.activity)[0];
    await test.info().attach('p5-fixture-preconditions', {
      body: JSON.stringify({ before, fixture: fixture.fixture, after }, null, 2),
      contentType: 'application/json',
    });
    expect(after?.attempts, 'both attempts unchanged').toEqual(before!.attempts);
    expect(after?.best).toEqual(before!.best);
    expect(after?.best?.scoreGiven).toBe(80);
    expect(after?.best?.scoreMaximum).toBe(100);
    expect(after?.scoreSyncs, 'only lower failed row remains, otherwise resend-eligible').toEqual([low]);
    const resend = await resendSync(low.id);
    expect(resend.status, resend.body).toBe(409);
    expect((resend.json?.details as { message?: string })?.message).toBe('SYNC_NOT_RESENDABLE');
    const end = rowsFor(await results(c.publicationId), user, c.activity)[0];
    expect(end?.scoreSyncs, 'no send or retry was created').toEqual([low]);
    expect(end?.attempts).toEqual(before!.attempts);
    await test.info().attach('p5-public-evidence', {
      body: JSON.stringify({ before, fixture: fixture.fixture, after, resend: { status: resend.status, json: resend.json }, end }, null, 2),
      contentType: 'application/json',
    });
    test.info().annotations.push({ type: 'fixture-assisted P5', description: `deleted ${high.id}; count 1; failed ${low.id} still 60/100; best 80/100; Resend HTTP 409` });
  } finally {
    if (unenrolled) await enrolInUi(admin, course, email);
    await adminContext.close();
    await context.close();
  }
});
