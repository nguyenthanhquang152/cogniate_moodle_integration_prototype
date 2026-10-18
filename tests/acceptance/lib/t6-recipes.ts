// AC-T6-14 setup (tasks/T6.md): QA makes fresh rows by running the recipes of AC-T5-31 (conflict), AC-T5-32 (failed,
// before re-enrolment) and AC-T5-33 (teacher override), each in its own activity. Same steps as the T5b specs
// (tests/acceptance/T5b/4-conflict-resend.spec.ts, 5-override.spec.ts), as library functions for the T6 setup.
// The failed recipe runs in COGNIATE-DEV-102 (the unenrolment touches no other test's grades); the learner stays
// unenrolled until AC-T6-14 enrols them again in the UI.
import type { Browser, BrowserContext } from '@playwright/test';
import { publicUrls } from './env';
import { hostAction } from './host-control';
import { ACCOUNT, apiKey, auth, ltiApi, recordSecret } from './lti';
import { newStackContext } from './moodle-launch';
import { moodleLogin } from './moodle-ui';
import { gradeItems } from './moodle-ws';
import { seed } from './seed';
import {
  addPickedActivity,
  commitFromRuntime,
  course101,
  driveCourse,
  enrolledUser,
  moodleGrade,
  moodleShown,
  openPlayer,
  overrideGradeInUi,
  savedSuspendData,
  scormCommit,
  settledState,
  t5,
  unenrolInUi,
  waitForMoodle,
  waitForRow,
} from './t5';

const urls = publicUrls();

/** The AC-T6-14 activities (courseOf in lib/t5.ts maps names with "102" to COGNIATE-DEV-102). */
export const T6_ACT = {
  conflict: 'Cogniate HTML AC-T6-14 conflict',
  failed: 'Cogniate HTML 102 AC-T6-14 failed',
  override: 'Cogniate SCORM AC-T6-14 override',
} as const;

interface IdTokenServices {
  user: { id: string };
  services: { serviceKey?: string; assignmentAndGrades?: { available: boolean; lineItemId?: string } };
}

function check(ok: boolean, message: string): void {
  if (!ok) throw new Error(`AC-T6-14 setup: ${message}`);
}

/** AC-T5-31 recipe: QA score 10 with timestamp now + 10 min, lti-service restart, cg_student2 passes → conflict row. */
export async function conflictRecipe(context: BrowserContext): Promise<{ cmid: number; syncId: string }> {
  const st = t5();
  const s2 = seed().users.cg_student2;
  const name = T6_ACT.conflict;
  const cmid = await addPickedActivity(context, seed().users.cg_teacher, course101(), Number(st.typeId), String(st.html?.title), name);
  const player = await openPlayer(context, s2, cmid);
  try {
    const ltik = String(player.cap.ltik ?? '');
    check(/^[A-Za-z0-9_-]{43}$/.test(ltik), 'no ltik captured');
    const id = await ltiApi<IdTokenServices>('GET', '/api/idtoken', { authorization: auth.ltik(apiKey(ACCOUNT), ltik) });
    check(id.status === 200, `GET /api/idtoken → ${id.status}`);
    const serviceKey = String(id.json.services?.serviceKey ?? '');
    const lineItemId = String(id.json.services?.assignmentAndGrades?.lineItemId ?? '');
    check(Boolean(serviceKey && lineItemId), 'no service key or line item id');
    recordSecret('service_key', serviceKey);
    const scoreAt = Date.now() + 10 * 60_000;
    const score = await ltiApi('POST', `/api/lineitems/${encodeURIComponent(lineItemId)}/scores`, {
      authorization: auth.service(apiKey(ACCOUNT), serviceKey),
      body: { userId: id.json.user.id, scoreGiven: 10, scoreMaximum: 100, activityProgress: 'Completed', gradingProgress: 'FullyGraded', timestamp: new Date(scoreAt).toISOString() },
    });
    check(score.status === 204, `QA score → ${score.status} ${score.body.slice(0, 120)}`);
    check((await waitForMoodle(course101(), s2, name, 10)).grade === 10, 'Moodle does not show the QA score 10');
    await hostAction('lti-restart');
    await driveCourse(player, { answer: 'correct' });
    const row = await waitForRow(String(st.htmlPublicationId), s2, name, (r) => r.scoreSyncs.some((s) => s.status === 'conflict'), { timeoutMs: 120_000 });
    const sync = row?.scoreSyncs.find((s) => s.status === 'conflict');
    check(Boolean(sync), `no conflict row: ${JSON.stringify(row?.scoreSyncs)}`);
    check((await moodleGrade(course101(), s2, name)) === 10, 'Moodle is not 10 after the conflict');
    return { cmid, syncId: sync!.id };
  } finally {
    await player.popup.close({ runBeforeUnload: true }).catch(() => undefined);
  }
}

/** AC-T5-32 recipe up to "failed, before re-enrolment": launch, QA unenrols cg_student2 (UI), the learner passes. */
export async function failedRecipe(browser: Browser, context: BrowserContext): Promise<{ cmid: number; syncId: string; email: string }> {
  const st = t5();
  const s2 = seed().users.cg_student2;
  const c102 = seed().courses['COGNIATE-DEV-102'];
  const name = T6_ACT.failed;
  const cmid = await addPickedActivity(context, seed().users.cg_teacher, c102, Number(st.typeId), String(st.html?.title), name);
  const email = String((await enrolledUser(c102, s2.id))?.email ?? '');
  check(Boolean(email), 'cg_student2 is not enrolled in COGNIATE-DEV-102');
  const player = await openPlayer(context, s2, cmid);
  const admin = await newStackContext(browser);
  try {
    const page = await admin.newPage();
    await moodleLogin(page, urls.moodle, seed().users.admin.username, seed().users.admin.password);
    await unenrolInUi(page, c102, s2.id);
    check((await enrolledUser(c102, s2.id)) === undefined, 'cg_student2 is still enrolled');
    await driveCourse(player, { answer: 'correct' });
    const row = await waitForRow(String(st.htmlPublicationId), s2, name, (r) => r.scoreSyncs.some((s) => s.status === 'failed'), { timeoutMs: 60_000 });
    const sync = row?.scoreSyncs.find((s) => s.status === 'failed');
    check(Boolean(sync), `no failed row: ${JSON.stringify(row?.scoreSyncs)}`);
    return { cmid, syncId: sync!.id, email };
  } finally {
    await admin.close();
    await player.popup.close({ runBeforeUnload: true }).catch(() => undefined);
  }
}

/** AC-T5-33 recipe: wrong option (Moodle 0), cg_teacher overrides to 50, a better result (100) is sent; Moodle keeps 50. */
export async function overrideRecipe(context: BrowserContext): Promise<{ cmid: number }> {
  const st = t5();
  const s2 = seed().users.cg_student2;
  const pub = String(st.scormPublicationId);
  const name = T6_ACT.override;
  const cmid = await addPickedActivity(context, seed().users.cg_teacher, course101(), Number(st.typeId), String(st.scorm?.title), name);
  const first = await openPlayer(context, s2, cmid);
  await driveCourse(first, { answer: 'wrong' });
  await first.popup.close({ runBeforeUnload: true });
  await waitForRow(pub, s2, name, (r) => r.scoreSyncs.some((s) => s.status === 'sent'));
  check((await waitForMoodle(course101(), s2, name, 0)).grade === 0, 'Moodle is not 0 after the wrong option');

  const item = (await gradeItems(seed().oracleToken, course101(), s2.id)).find((i) => i.itemname === name);
  check(Boolean(item), `no grade item "${name}"`);
  const page = await context.newPage();
  try {
    await moodleLogin(page, urls.moodle, seed().users.cg_teacher.username, seed().users.cg_teacher.password);
    await overrideGradeInUi(page, course101(), s2.id, item!.id, '50');
  } finally {
    await page.close();
  }
  const shown = await moodleShown(course101(), s2, name);
  check(shown?.shown === 50 && shown.overridden, `Moodle does not show 50 overridden: ${JSON.stringify(shown)}`);

  const player = await openPlayer(context, s2, cmid);
  try {
    const state = await settledState(player.token);
    const core = { lesson_status: 'passed', score: { raw: '100', min: '0', max: '100' } };
    const c1 = await commitFromRuntime(player.runtime, player.token, scormCommit(state.sessionId, state.lastSeq + 1, 'commit', core, { suspend_data: savedSuspendData(state) }));
    const c2 = await commitFromRuntime(player.runtime, player.token, scormCommit(state.sessionId, state.lastSeq + 2, 'finish', core, { suspend_data: savedSuspendData(state) }));
    check(c1.status === 200 && c2.status === 200, `better final: ${c1.status} ${c2.status}`);
  } finally {
    await player.popup.close({ runBeforeUnload: true });
  }
  await waitForRow(pub, s2, name, (r) => r.scoreSyncs.some((s) => s.scoreGiven === 100 && s.status === 'sent'), { timeoutMs: 120_000 });
  check((await moodleShown(course101(), s2, name))?.shown === 50, 'Moodle does not keep the override 50');
  return { cmid };
}
