// T5a: teacher preview and rebind with an in-progress attempt. Source: tasks/T5a.md AC-T5-13, AC-T5-37; contract
// cogniate-app-api.md §5 (preview rows), §6 (shell status texts); ADR-010 rule 6 (learners only); data-model §2
// ("After a rebind, an old in-progress attempt stays as it is and shows under its own course's publication").
// AC-T5-37 uses QA's activity "Cogniate SCORM rebind" (same SCORM publication), so that re-selecting the HTML course
// does not change "Cogniate SCORM", which AC-T5-13 and T5b use (spec note to the Architect).
import type { BrowserContext } from '@playwright/test';
import { openPicker, submitPicker } from '../lib/moodle-dl';
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
  SHELL,
  settledState,
  shellText,
  t5,
  waitForRow,
} from '../lib/t5';

test.describe('T5a preview and rebind', () => {
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await newStackContext(browser);
  });

  test.afterEach(async () => {
    await context?.close();
  });

  test('AC-T5-13 teacher preview: cg_teacher completes "Cogniate SCORM" → "Preview — no grade is sent"; the row has preview: true and no scoreSyncs; no teacher grade in Moodle', async () => {
    test.setTimeout(240_000);
    const teacher = seed().users.cg_teacher;
    const player = await openPlayer(context, teacher, cmidOf(ACT.scorm));
    await driveCourse(player, { answer: 'correct' });
    await expect.poll(() => shellText(player.popup), { timeout: 60_000, intervals: [1_000] }).toContain(SHELL.preview);
    const pub = String(t5().scormPublicationId);
    const row = await waitForRow(pub, teacher, ACT.scorm, (r) => r.attempts.some((a) => a.outcome === 'passed'), { preview: true });
    expect(row, 'a preview row for cg_teacher').toBeDefined();
    expect(row!.preview).toBe(true);
    expect(row!.scoreSyncs).toEqual([]);
    expect(rowsFor(await results(pub), teacher, ACT.scorm, false), 'no learner row for the teacher').toEqual([]);
    const grade = await moodleGrade(course101(), teacher, ACT.scorm).catch(() => undefined);
    expect(grade ?? null, 'no grade for cg_teacher in Moodle').toBeNull();
  });

  test('AC-T5-37 rebind with an in-progress attempt: the next launch opens the HTML course with a new attempt; the SCORM attempt stays in_progress, has no sync, and shows under the SCORM publication', async () => {
    test.setTimeout(300_000);
    const st = t5();
    const s2 = seed().users.cg_student2;
    const cmid = cmidOf(ACT.rebind);

    // cg_student2 opens the SCORM activity and leaves after the menu page.
    const first = await openPlayer(context, s2, cmid);
    await packageFrame(first, 'index.html');
    const scormState = await settledState(first.token);
    expect(scormState.format).toBe('scorm12');
    await first.popup.close({ runBeforeUnload: true });
    const scormPub = String(st.scormPublicationId);
    const before = rowsFor(await results(scormPub), s2, ACT.rebind)[0];
    expect(before?.attempts.map((a) => a.outcome), JSON.stringify(before)).toEqual(['in_progress']);
    const scormVersionId = before!.attempts[0].versionId;

    // cg_teacher selects the HTML course for this activity (Select content again).
    const open = await openPicker(context, seed().users.cg_teacher, course101(), Number(st.typeId), 45_000, { updateCmid: cmid });
    const { pickerPost } = await submitPicker(open, String(st.html?.title));
    expect(pickerPost.status).toBe(200);
    await open.page.locator('#id_name').fill(ACT.rebind);
    await Promise.all([open.page.waitForURL(/\/course\/view\.php|\/mod\/lti\/view\.php/, { timeout: 30_000 }), open.page.locator('#id_submitbutton2').click()]);
    await open.page.close();

    // cg_student2's next launch: the HTML course, a new attempt.
    const next = await openPlayer(context, s2, cmid);
    const htmlState = (await runtimeState(next.token)).json;
    expect(htmlState?.format, 'the next launch opens the HTML course').toBe('html');
    expect(htmlState?.packageBaseUrl).toContain(String(st.html?.packageId));
    await next.popup.close({ runBeforeUnload: true });

    const htmlRow = rowsFor(await results(String(st.htmlPublicationId)), s2, ACT.rebind)[0];
    const scormRow = rowsFor(await results(scormPub), s2, ACT.rebind)[0];
    expect(htmlRow?.attempts.map((a) => a.versionId), JSON.stringify(htmlRow)).toContain(st.html?.versionId);
    expect(scormRow?.attempts.find((a) => a.versionId === scormVersionId)?.outcome, JSON.stringify(scormRow)).toBe('in_progress');
    expect(scormRow?.scoreSyncs ?? []).toEqual([]);
    const versions = new Set([...(htmlRow?.attempts ?? []), ...(scormRow?.attempts ?? [])].map((a) => a.versionId));
    expect([...versions].sort(), 'attempts show both versions').toEqual([scormVersionId, String(st.html?.versionId)].sort());
    test.info().annotations.push({
      type: 'rows',
      description: `HTML publication row attempts: ${JSON.stringify(htmlRow?.attempts.map((a) => [a.versionId, a.outcome]))}; SCORM publication row attempts: ${JSON.stringify(scormRow?.attempts.map((a) => [a.versionId, a.outcome]))}`,
    });
  });
});
