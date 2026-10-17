// T5a: cg_student2 in "Cogniate SCORM": close mid-course, course versions, fail, then a better result. Source:
// tasks/T5a.md AC-T5-35, -24, -08, -23; contract cogniate-app-api.md §5 (results, attempts[].versionId), §7
// (RuntimeState, unload by sendBeacon), §12; ADR-004 (versions); ADR-010 rules 5 and 11; data-model §2 (attempt rule:
// continue the newest in-progress attempt of the course; else the current version).
// Order (serial, runs after 3-scorm-pass.spec.ts): AC-T5-35 leaves cg_student2 in progress on version 1; AC-T5-24
// publishes version 2 (cg_student2 continues version 1, cg_student gets a new attempt on version 2); AC-T5-08 finishes
// cg_student2's version-1 attempt with a wrong answer; AC-T5-23 relaunches (new attempt on version 2) and posts a pass.
import type { BrowserContext } from '@playwright/test';
import { appApi, uploadVersion } from '../lib/app';
import { courseZipCopy } from '../lib/course-fixtures';
import { newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import {
  ACT,
  apiReady,
  cmidOf,
  commitEvents,
  commitFromRuntime,
  commitKind,
  course101,
  driveCourse,
  markRan,
  openPlayer,
  packageFrame,
  type Player,
  results,
  rowsFor,
  runtimeState,
  savedSuspendData,
  saveT5,
  scormCalls,
  scormCommit,
  settledState,
  t5,
  thanhSession,
  waitForCommit,
  waitForMoodle,
  waitForRow,
} from '../lib/t5';

/** Open the activity and stay on the menu page until the package's first commits are stored. */
async function openToMenu(context: BrowserContext, user: ReturnType<typeof seed>['users']['cg_student2']): Promise<{ player: Player; sessionId: string }> {
  const player = await openPlayer(context, user, cmidOf(ACT.scorm));
  await packageFrame(player, 'index.html');
  const state = await settledState(player.token);
  return { player, sessionId: state.sessionId };
}

test.describe.serial('T5a SCORM cg_student2: close mid-course, versions, fail, better result', () => {
  let context: BrowserContext;
  const s2 = () => seed().users.cg_student2;
  const pub = () => String(t5().scormPublicationId);

  test.beforeAll(async ({ browser }) => {
    context = await newStackContext(browser);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T5-35 close mid-course: exactly one commit_accepted {unload} for the session, the attempt is in_progress, the next launch gets entry "resume"', async () => {
    test.setTimeout(150_000);
    const { player, sessionId } = await openToMenu(context, s2());
    const since = Date.now() - 1_000;
    await player.popup.close({ runBeforeUnload: true });
    const unload = await waitForCommit(sessionId, 'unload', since, 20_000);
    expect(unload, `commit_accepted {unload} of session ${sessionId} (read in the log: page.route does not see it)`).toBeDefined();
    await new Promise((r) => setTimeout(r, 5_000)); // a second unload would arrive within this time
    const unloads = commitEvents(sessionId, since).filter((e) => commitKind(e) === 'unload');
    expect(unloads, 'unload events of the session').toHaveLength(1);

    const row = rowsFor(await results(pub()), s2(), ACT.scorm)[0];
    expect(row?.attempts.map((a) => a.outcome), JSON.stringify(row)).toEqual(['in_progress']);
    expect(row?.scoreSyncs ?? []).toEqual([]);

    const next = await openPlayer(context, s2(), cmidOf(ACT.scorm));
    await apiReady(next);
    await packageFrame(next, 'index.html');
    const state = await settledState(next.token);
    expect(state.scorm?.entry, 'RuntimeState scorm.entry').toBe('resume');
    const [entry] = await scormCalls(next.runtime, [['LMSGetValue', 'cmi.core.entry']]);
    expect(entry.value, 'cmi.core.entry in the runtime (session opened by the package)').toBe('resume');
    await next.popup.close({ runBeforeUnload: true });
  });

  test('AC-T5-24 version 2 published: cg_student2 continues version 1 (in progress); cg_student (final attempt) gets a new attempt on version 2', async () => {
    test.setTimeout(240_000);
    const st = t5();
    // cg_student2's in-progress attempt, started before the upload (open, menu page only).
    const before = await openToMenu(context, s2());
    const v1Base = String((await runtimeState(before.player.token)).json?.packageBaseUrl ?? '');
    expect(v1Base, 'version 1 package').toContain(String(st.scorm?.packageId));
    await before.player.popup.close({ runBeforeUnload: true });

    const thanh = await thanhSession();
    const up = await uploadVersion(thanh, String(st.scorm?.courseId), courseZipCopy('scorm'));
    expect(up.status, up.body.slice(0, 300)).toBe(201);
    const v2 = up.json as { id?: string; version?: number; packageId?: string };
    expect(v2.version).toBe(2);
    const published = await appApi<{ versionId: string; version: number }>('POST', '/app-api/publications', {
      cookie: thanh.cookie,
      body: { connectionId: st.connectionId, courseId: st.scorm?.courseId, versionId: v2.id },
    });
    expect(published.status, published.body).toBe(200);
    expect(published.json.versionId).toBe(v2.id);
    saveT5({ scormV2: { courseId: String(st.scorm?.courseId), versionId: String(v2.id), packageId: String(v2.packageId), title: String(st.scorm?.title) } });

    const s2Again = await openPlayer(context, s2(), cmidOf(ACT.scorm));
    const s2State = (await runtimeState(s2Again.token)).json;
    expect(s2State?.packageBaseUrl, 'cg_student2 continues on version 1').toContain(String(st.scorm?.packageId));
    await s2Again.popup.close({ runBeforeUnload: true });
    const s2Row = rowsFor(await results(pub()), s2(), ACT.scorm)[0];
    expect(s2Row?.attempts.map((a) => a.versionId), JSON.stringify(s2Row)).toEqual([st.scorm?.versionId]);

    const s1 = seed().users.cg_student;
    const s1Again = await openPlayer(context, s1, cmidOf(ACT.scorm));
    const s1State = (await runtimeState(s1Again.token)).json;
    expect(s1State?.packageBaseUrl, 'cg_student starts on version 2').toContain(String(v2.packageId));
    await s1Again.popup.close({ runBeforeUnload: true });
    const s1Row = rowsFor(await results(pub()), s1, ACT.scorm)[0];
    expect(s1Row?.attempts.map((a) => a.versionId).sort(), JSON.stringify(s1Row)).toEqual([st.scorm?.versionId, v2.id].sort());
    markRan('AC-T5-24');
  });

  test('AC-T5-08 SCORM fail: cg_student2 picks a wrong option and finishes → Moodle 0 and completion done; row failed, 0, one sync sent', async () => {
    test.setTimeout(240_000);
    const player = await openPlayer(context, s2(), cmidOf(ACT.scorm));
    await driveCourse(player, { answer: 'wrong' });
    const done = Date.now();
    const left = () => Math.max(1_000, done + 60_000 - Date.now());
    const moodle = await waitForMoodle(course101(), s2(), ACT.scorm, 0, { cmid: cmidOf(ACT.scorm), timeoutMs: left() });
    expect(moodle.grade, 'Moodle grade').toBe(0);
    expect(moodle.completion ?? 0, 'completion done (a grade of 0 counts as received)').toBeGreaterThanOrEqual(1);
    const row = await waitForRow(pub(), s2(), ACT.scorm, (r) => r.scoreSyncs.some((s) => s.status === 'sent'), { timeoutMs: left() });
    expect(row?.best?.outcome, JSON.stringify(row)).toBe('failed');
    expect(row?.best?.scoreGiven).toBe(0);
    expect(row?.scoreSyncs.map((s) => s.status)).toEqual(['sent']);
    await player.popup.close({ runBeforeUnload: true });
    markRan('AC-T5-08');
  });

  test('AC-T5-23 after AC-T5-08: cg_student2 relaunches, commits passed/100 and finish → one new sync sent, Moodle 100, best passed', async () => {
    test.setTimeout(180_000);
    const player = await openPlayer(context, s2(), cmidOf(ACT.scorm));
    await packageFrame(player, 'index.html');
    const state = await settledState(player.token);
    const core = { lesson_status: 'passed', score: { raw: '100', min: '0', max: '100' } };
    const commit = await commitFromRuntime(player.runtime, player.token, scormCommit(state.sessionId, state.lastSeq + 1, 'commit', core, { suspend_data: savedSuspendData(state) }));
    expect(commit.status, commit.body.slice(0, 300)).toBe(200);
    const finish = await commitFromRuntime(player.runtime, player.token, scormCommit(state.sessionId, state.lastSeq + 2, 'finish', core, { suspend_data: savedSuspendData(state) }));
    expect(finish.status, finish.body.slice(0, 300)).toBe(200);
    const row = await waitForRow(pub(), s2(), ACT.scorm, (r) => r.scoreSyncs.length >= 2 && r.scoreSyncs.every((s) => s.status === 'sent'));
    expect(row?.scoreSyncs.map((s) => `${s.status}:${s.scoreGiven}`), JSON.stringify(row)).toEqual(['sent:0', 'sent:100']);
    expect(row?.best?.outcome).toBe('passed');
    const moodle = await waitForMoodle(course101(), s2(), ACT.scorm, 100);
    expect(moodle.grade).toBe(100);
    await player.popup.close({ runBeforeUnload: true });
    markRan('AC-T5-23');
  });
});
