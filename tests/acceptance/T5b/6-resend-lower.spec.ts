// T5b round 2: Resend never lowers a grade (Reviewer-A A-T5b-02, Lead request). Source: ADR-010 rule 5 ("best result
// wins, never lower") and rule 10 (Resend only for failed or conflict, never when an equal or better result is sent or
// pending); app contract "POST /app-api/score-syncs/:syncId/resend" (409 SYNC_NOT_RESENDABLE).
// Spec note: rule 10 names only sent or pending better rows. The A-T5b-02 case is a better row that is failed itself;
// QA expects 409 for it, because a sent lower row would lower the Moodle grade (rule 5).
// QA recipe (as AC-T5-32, so no other test's grades are touched): own SCORM activity "Cogniate SCORM A-T5b-02" in
// COGNIATE-DEV-102; cg_student2 is unenrolled while two final results are made (50, then 100 in a new session): both
// rows are failed at once. QA enrols cg_student2 again, then: Resend of the 50 row → 409; Resend of the 100 row → 200,
// sent, Moodle 100; Resend of the 50 row again → 409; Moodle stays 100.
import type { BrowserContext } from '@playwright/test';
import { publicUrls } from '../lib/env';
import { newStackContext } from '../lib/moodle-launch';
import { moodleLogin } from '../lib/moodle-ui';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import {
  ACT,
  addPickedActivity,
  commitFromRuntime,
  enrolInUi,
  enrolledUser,
  moodleGrade,
  openPlayer,
  reloadRuntime,
  resendSync,
  results,
  rowsFor,
  saveT5,
  savedSuspendData,
  scormCommit,
  settledState,
  t5,
  unenrolInUi,
  waitForMoodle,
  waitForRow,
} from '../lib/t5';

const urls = publicUrls();
const errCode = (json: Record<string, unknown> | null) => String((json?.details as { message?: string } | undefined)?.message ?? json?.error ?? '');

test.describe.serial('T5b Resend never lowers a grade', () => {
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await newStackContext(browser);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T5-32 (A-T5b-02) Resend never lowers a grade: rows 50 and 100 both failed (learner unenrolled); after enrol, Resend of the 50 row → 409 SYNC_NOT_RESENDABLE; Resend of the 100 row → sent, Moodle 100; the 50 row stays failed', async ({ browser }) => {
    test.setTimeout(480_000);
    const st = t5();
    const s2 = seed().users.cg_student2;
    const c102 = seed().courses['COGNIATE-DEV-102'];
    const pub = String(st.scormPublicationId);
    const name = ACT.scorm102;
    const cmid = st.cmids?.[name] ?? (await addPickedActivity(context, seed().users.cg_teacher, c102, Number(st.typeId), String(st.scorm?.title), name));
    saveT5({ cmids: { ...(t5().cmids ?? {}), [name]: cmid } });
    const before = await enrolledUser(c102, s2.id);
    expect(before?.email, 'cg_student2 is enrolled in COGNIATE-DEV-102').toBeTruthy();
    const player = await openPlayer(context, s2, cmid);

    const adminContext = await newStackContext(browser);
    let enrolledAgain = false;
    const admin = await adminContext.newPage();
    try {
      await moodleLogin(admin, urls.moodle, seed().users.admin.username, seed().users.admin.password);
      await unenrolInUi(admin, c102, s2.id);
      expect(await enrolledUser(c102, s2.id), 'cg_student2 is unenrolled').toBeUndefined();

      // Result 1: failed/50, final (session 1) → row 1 failed at once.
      const a = await settledState(player.token);
      const low = { lesson_status: 'failed', score: { raw: '50', min: '0', max: '100' } };
      const a1 = await commitFromRuntime(player.runtime, player.token, scormCommit(a.sessionId, a.lastSeq + 1, 'commit', low, { suspend_data: savedSuspendData(a) }));
      const a2 = await commitFromRuntime(player.runtime, player.token, scormCommit(a.sessionId, a.lastSeq + 2, 'finish', low, { suspend_data: savedSuspendData(a) }));
      expect([a1.status, a2.status], `${a1.body.slice(0, 120)} | ${a2.body.slice(0, 120)}`).toEqual([200, 200]);
      const r1 = await waitForRow(pub, s2, name, (r) => r.scoreSyncs.some((s) => s.scoreGiven === 50 && s.status === 'failed'), { timeoutMs: 60_000 });
      const row1 = r1?.scoreSyncs.find((s) => s.scoreGiven === 50);
      expect(row1?.status, `row 1: ${JSON.stringify(r1?.scoreSyncs)}`).toBe('failed');
      expect(String(row1?.lastError)).toContain('PLATFORM_REJECTED_REQUEST');

      // Result 2: passed/100, final, in a new session → row 2 (higher), failed at once (still unenrolled).
      await reloadRuntime(player);
      const b = await settledState(player.token);
      const high = { lesson_status: 'passed', score: { raw: '100', min: '0', max: '100' } };
      const b1 = await commitFromRuntime(player.runtime, player.token, scormCommit(b.sessionId, b.lastSeq + 1, 'commit', high, { suspend_data: savedSuspendData(b) }));
      const b2 = await commitFromRuntime(player.runtime, player.token, scormCommit(b.sessionId, b.lastSeq + 2, 'finish', high, { suspend_data: savedSuspendData(b) }));
      expect([b1.status, b2.status], `${b1.body.slice(0, 120)} | ${b2.body.slice(0, 120)}`).toEqual([200, 200]);
      const r2 = await waitForRow(pub, s2, name, (r) => r.scoreSyncs.some((s) => s.scoreGiven === 100 && s.status === 'failed'), { timeoutMs: 60_000 });
      const row2 = r2?.scoreSyncs.find((s) => s.scoreGiven === 100);
      expect(row2?.status, `row 2: ${JSON.stringify(r2?.scoreSyncs)}`).toBe('failed');
      expect(r2?.scoreSyncs.find((s) => s.id === row1!.id)?.status, 'row 1 is still failed').toBe('failed');

      await enrolInUi(admin, c102, String(before!.email));
      enrolledAgain = true;
      expect((await enrolledUser(c102, s2.id))?.roles, 'enrolled again as student').toContain('student');

      // Resend of the lower row while a better row exists (failed) → refused. Three oracles: the answer, the row, Moodle.
      const lowFirst = await resendSync(row1!.id);
      test.info().annotations.push({ type: 'resend row 1 (50) while row 2 (100) is failed', description: `HTTP ${lowFirst.status} ${errCode(lowFirst.json)}` });
      expect(lowFirst.status, lowFirst.body.slice(0, 200)).toBe(409);
      expect(errCode(lowFirst.json)).toBe('SYNC_NOT_RESENDABLE');
      const afterLow = rowsFor(await results(pub), s2, name)[0];
      expect(afterLow?.scoreSyncs.find((s) => s.id === row1!.id)?.status, 'row 1 stays failed').toBe('failed');
      expect(afterLow?.scoreSyncs.find((s) => s.id === row1!.id)?.tries, 'row 1: no new try').toBe(row1!.tries);

      // Resend of the better row → sent, Moodle 100.
      const highResend = await resendSync(row2!.id);
      expect(highResend.status, highResend.body.slice(0, 200)).toBe(200);
      const sent = await waitForRow(pub, s2, name, (r) => r.scoreSyncs.find((x) => x.id === row2!.id)?.status === 'sent', { timeoutMs: 120_000 });
      expect(sent?.scoreSyncs.find((x) => x.id === row2!.id)?.status).toBe('sent');
      expect((await waitForMoodle(c102, s2, name, 100)).grade, 'Moodle shows 100').toBe(100);

      // Resend of the lower row again (a better row is sent) → 409; Moodle stays 100; no row with 50 is sent.
      const lowAgain = await resendSync(row1!.id);
      expect(lowAgain.status, lowAgain.body.slice(0, 200)).toBe(409);
      expect(errCode(lowAgain.json)).toBe('SYNC_NOT_RESENDABLE');
      const end = rowsFor(await results(pub), s2, name)[0];
      expect(end?.scoreSyncs.filter((s) => s.scoreGiven === 50 && s.status !== 'failed'), JSON.stringify(end?.scoreSyncs)).toEqual([]);
      expect(await moodleGrade(c102, s2, name), 'Moodle still 100').toBe(100);
    } finally {
      if (!enrolledAgain && before?.email) await enrolInUi(admin, c102, String(before.email)).catch(() => undefined);
      await adminContext.close();
      await player.popup.close({ runBeforeUnload: true }).catch(() => undefined);
    }
  });
});
