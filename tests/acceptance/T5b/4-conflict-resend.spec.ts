// T5b: the conflict recipe, the failed recipe and Resend. Source: tasks/T5b.md AC-T5-31, AC-T5-32; contract
// lti-service-api.md §3.1 (services.serviceKey, assignmentAndGrades.lineItemId), §3.6 (scores, `timestamp` used as
// given; the clock restarts with the service); cogniate-app-api.md §5 (resend), §10 (409 → conflict, 400/404 → failed);
// ADR-010 rules 8 and 10.
// Serial: AC-T5-32 resends the AC-T5-31 conflict row within its 10 min, so it does that step first.
// AC-T5-31 uses QA's activity "QA HTML conflict" (cg_student2 needs a fresh attempt there: after AC-T5-27 the attempt
// in "Cogniate HTML" is final with a wrong first answer, which cannot change).
import type { BrowserContext } from '@playwright/test';
import { hostAction } from '../lib/host-control';
import { ACCOUNT, apiKey, auth, ltiApi, recordSecret } from '../lib/lti';
import { newStackContext } from '../lib/moodle-launch';
import { moodleLogin } from '../lib/moodle-ui';
import { publicUrls } from '../lib/env';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import {
  ACT,
  addPickedActivity,
  cmidOf,
  course101,
  driveCourse,
  enrolInUi,
  enrolledUser,
  moodleGrade,
  openPlayer,
  resendSync,
  rowsFor,
  results,
  saveT5,
  t5,
  unenrolInUi,
  waitForMoodle,
  waitForRow,
} from '../lib/t5';

const urls = publicUrls();
interface IdTokenServices {
  user: { id: string };
  services: { serviceKey?: string; assignmentAndGrades?: { available: boolean; lineItemId?: string } };
}

test.describe.serial('T5b conflict, failed and Resend', () => {
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await newStackContext(browser);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T5-31 conflict: a QA score with timestamp now + 10 min, lti-service restart, then cg_student2 completes → row conflict (tries stays 1 for 2 min, PLATFORM_CONFLICT), Moodle still 10, best passed', async () => {
    test.setTimeout(480_000);
    const s2 = seed().users.cg_student2;
    const pub = String(t5().htmlPublicationId);
    const player = await openPlayer(context, s2, cmidOf(ACT.htmlConflict));
    const ltik = String(player.cap.ltik ?? '');
    expect(ltik, 'QA captured the ltik of the launch').toMatch(/^[A-Za-z0-9_-]{43}$/);
    const id = await ltiApi<IdTokenServices>('GET', '/api/idtoken', { authorization: auth.ltik(apiKey(ACCOUNT), ltik) });
    expect(id.status, id.body.slice(0, 200)).toBe(200);
    const serviceKey = String(id.json.services?.serviceKey ?? '');
    const lineItemId = String(id.json.services?.assignmentAndGrades?.lineItemId ?? '');
    expect(serviceKey && lineItemId, 'service key and line item id in the ID token').toBeTruthy();
    recordSecret('service_key', serviceKey);

    const scoreAt = Date.now() + 10 * 60_000;
    const score = await ltiApi('POST', `/api/lineitems/${encodeURIComponent(lineItemId)}/scores`, {
      authorization: auth.service(apiKey(ACCOUNT), serviceKey),
      body: { userId: id.json.user.id, scoreGiven: 10, scoreMaximum: 100, activityProgress: 'Completed', gradingProgress: 'FullyGraded', timestamp: new Date(scoreAt).toISOString() },
    });
    expect(score.status, score.body.slice(0, 200)).toBe(204);
    expect((await waitForMoodle(course101(), s2, ACT.htmlConflict, 10)).grade, 'Moodle has 10').toBe(10);
    await hostAction('lti-restart');

    await driveCourse(player, { answer: 'correct' });
    const row = await waitForRow(pub, s2, ACT.htmlConflict, (r) => r.scoreSyncs.some((s) => s.status === 'conflict'), { timeoutMs: 120_000 });
    const sync = row?.scoreSyncs.find((s) => s.status === 'conflict');
    expect(sync, `rows: ${JSON.stringify(row?.scoreSyncs)}`).toBeDefined();
    expect(sync!.tries).toBe(1);
    expect(String(sync!.lastError)).toContain('PLATFORM_CONFLICT');
    expect(row?.best?.outcome).toBe('passed');
    expect(await moodleGrade(course101(), s2, ACT.htmlConflict), 'Moodle still 10').toBe(10);
    saveT5({ conflictSyncId: sync!.id, conflictScoreAt: scoreAt });

    // No retry: tries stays 1 for 2 min (observation window named by the AC).
    const until = Date.now() + 120_000;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 10_000));
      const now = rowsFor(await results(pub), s2, ACT.htmlConflict)[0]?.scoreSyncs.find((s) => s.id === sync!.id);
      expect(`${now?.status}:${now?.tries}`, 'the conflict row is not retried').toBe('conflict:1');
    }
    await player.popup.close({ runBeforeUnload: true });
  });

  test('AC-T5-32 failed and Resend: unenrolled learner → failed at once (PLATFORM_REJECTED_REQUEST); enrol again, Resend → pending, tries 0, then sent; conflict Resend → conflict; Resend of a sent row → 409', async ({ browser }) => {
    test.setTimeout(600_000);
    const st = t5();
    const s2 = seed().users.cg_student2;
    const htmlPub = String(st.htmlPublicationId);

    // Resend of the AC-T5-31 conflict row within its 10 min → conflict again (first, to stay inside the 10 min).
    expect(st.conflictSyncId, 'AC-T5-31 made a conflict row').toBeTruthy();
    expect(Date.now(), 'still inside the 10 min of the AC-T5-31 score timestamp').toBeLessThan(Number(st.conflictScoreAt));
    const again = await resendSync(String(st.conflictSyncId));
    expect(again.status, again.body.slice(0, 200)).toBe(200);
    const conflictAgain = await waitForRow(htmlPub, s2, ACT.htmlConflict, (r) => {
      const s = r.scoreSyncs.find((x) => x.id === st.conflictSyncId);
      return s?.status === 'conflict' && s.tries >= 1;
    }, { timeoutMs: 120_000 });
    expect(conflictAgain?.scoreSyncs.find((x) => x.id === st.conflictSyncId)?.status).toBe('conflict');

    // "Cogniate HTML 102" in COGNIATE-DEV-102 (deep-linked by cg_teacher), launched by cg_student2.
    const c102 = seed().courses['COGNIATE-DEV-102'];
    const cmid102 = t5().cmids?.[ACT.html102] ?? (await addPickedActivity(context, seed().users.cg_teacher, c102, Number(st.typeId), String(st.html?.title), ACT.html102));
    saveT5({ cmids: { ...(t5().cmids ?? {}), [ACT.html102]: cmid102 } });
    const player = await openPlayer(context, s2, cmid102);

    // QA unenrols cg_student2 from COGNIATE-DEV-102 in the Moodle UI (Participants), as admin.
    const before = await enrolledUser(c102, s2.id);
    expect(before?.email, 'cg_student2 is enrolled in COGNIATE-DEV-102').toBeTruthy();
    const adminContext = await newStackContext(browser);
    try {
      const admin = await adminContext.newPage();
      await moodleLogin(admin, urls.moodle, seed().users.admin.username, seed().users.admin.password);
      await unenrolInUi(admin, c102, s2.id);
      expect(await enrolledUser(c102, s2.id), 'cg_student2 is unenrolled').toBeUndefined();

      // cg_student2 completes in the open window → failed at once.
      await driveCourse(player, { answer: 'correct' });
      const failed = await waitForRow(htmlPub, s2, ACT.html102, (r) => r.scoreSyncs.some((s) => s.status === 'failed'), { timeoutMs: 60_000 });
      const sync = failed?.scoreSyncs.find((s) => s.status === 'failed');
      expect(sync, JSON.stringify(failed?.scoreSyncs)).toBeDefined();
      expect(sync!.tries, 'failed at once (no retry)').toBe(1);
      expect(String(sync!.lastError)).toContain('PLATFORM_REJECTED_REQUEST');

      // QA enrols cg_student2 again as student (UI), then Resend.
      await enrolInUi(admin, c102, String(before!.email));
      expect((await enrolledUser(c102, s2.id))?.roles, 'enrolled again as student').toContain('student');
      const resent = await resendSync(sync!.id);
      expect(resent.status, resent.body.slice(0, 200)).toBe(200);
      expect(`${String(resent.json?.status)}:${String(resent.json?.tries)}`, 'the answer of Resend: pending, tries 0').toBe('pending:0');
      const sent = await waitForRow(htmlPub, s2, ACT.html102, (r) => r.scoreSyncs.find((x) => x.id === sync!.id)?.status === 'sent', { timeoutMs: 120_000 });
      expect(sent?.scoreSyncs.find((x) => x.id === sync!.id)?.status).toBe('sent');
      expect((await waitForMoodle(c102, s2, ACT.html102, 100)).grade, 'Moodle shows the score').toBe(100);

      // Resend of a sent row → 409 SYNC_NOT_RESENDABLE.
      const notAgain = await resendSync(sync!.id);
      expect(notAgain.status).toBe(409);
      expect(String((notAgain.json?.details as { message?: string } | undefined)?.message ?? notAgain.json?.error)).toBe('SYNC_NOT_RESENDABLE');
    } finally {
      await adminContext.close();
      await player.popup.close({ runBeforeUnload: true }).catch(() => undefined);
    }
  });
});
