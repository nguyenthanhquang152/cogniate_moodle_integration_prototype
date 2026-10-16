// T4b2: withdraw and rebind. Source: tasks/T4b2.md AC-T4-27, AC-T4-25; security §4 (binding, attempt after a rebind).
// AC-T4-27 runs first and publishes the SCORM course again, so that AC-T4-25 can launch it.
//
// AC-T4-25 note (reported to the Lead): "attempt in_progress" needs a runtime commit, and "shows under the SCORM
// publication's results" needs the results API; both come in T5a. "A new attempt for cg_student2" has no T4b2 oracle
// (no API shows attempt ids). This test checks what T4b2 can show: both learners get the HTML course after the rebind,
// and resource_link_rebound is logged. The T5a suite checks the attempt parts.
import { APP, appApi, signIn, THANH } from '../lib/app';
import { checkErrorPage, eventsSince } from '../lib/lti';
import { openPicker, submitPicker } from '../lib/moodle-dl';
import { launchActivity, newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import { t4b } from '../lib/t4b-state';

const PLAY = `${APP}/play/`;

test.describe.serial('T4b2 withdraw and rebind', () => {
  test('AC-T4-27 a withdrawn publication: the launch shows 410 "This course is no longer available"', async ({ browser }) => {
    test.setTimeout(90_000);
    const st = t4b();
    const thanh = await signIn(THANH);
    expect((await appApi('POST', `/app-api/publications/${st.thanhScormPublicationId}/withdraw`, { cookie: thanh.cookie })).status).toBe(200);
    const context = await newStackContext(browser);
    try {
      const cap = await launchActivity(context, seed().users.cg_student, st.scormActivityCmid!, { timeoutMs: 20_000 });
      expect(cap.toolLaunch, 'the app answered /tool/launch').toBeDefined();
      expect(checkErrorPage(cap.toolLaunch!, 'PUBLICATION_WITHDRAWN', { statuses: [410], test: 'AC-T4-27', endpoint: 'tool' })).toEqual([]);
      expect(cap.toolLaunch!.body.replace(/\s+/g, ' ')).toContain('This course is no longer available');
      expect(cap.play, 'no player').toBeUndefined();
    } finally {
      await context.close();
      // Publish again (withdrawn → available) for the next tests.
      const again = await appApi<{ status: string }>('POST', '/app-api/publications', { cookie: thanh.cookie, body: { connectionId: st.thanhConnectionId, courseId: st.thanhScorm!.courseId } });
      expect(again.json.status).toBe('available');
    }
  });

  test('AC-T4-25 the teacher picks the HTML course for the SCORM activity: the next launches open the HTML course; resource_link_rebound', async ({ browser }) => {
    test.setTimeout(180_000);
    const st = t4b();
    const since = Date.now() - 1_000;
    const context = await newStackContext(browser);
    try {
      const before = await launchActivity(context, seed().users.cg_student2, st.scormActivityCmid!, { until: PLAY, timeoutMs: 20_000 });
      expect((await before.popup!.locator('body').innerText()).replace(/\s+/g, ' '), 'before: the SCORM course').toContain(st.thanhScorm!.title);
      await before.popup!.close();

      const open = await openPicker(context, seed().users.cg_teacher, seed().courses['COGNIATE-DEV-101'], st.thanhTypeId!, 45_000, { updateCmid: st.scormActivityCmid });
      const { pickerPost } = await submitPicker(open, st.thanhHtml!.title);
      expect(pickerPost.status).toBe(200);
      // Keep the activity name; only the content changes.
      await open.page.locator('#id_name').fill(st.scormActivityName!);
      await Promise.all([open.page.waitForURL(/\/course\/view\.php|\/mod\/lti\/view\.php/, { timeout: 30_000 }), open.page.locator('#id_submitbutton2').click()]);

      for (const user of [seed().users.cg_student, seed().users.cg_student2]) {
        const cap = await launchActivity(context, user, st.scormActivityCmid!, { until: PLAY, timeoutMs: 20_000 });
        const text = (await cap.popup!.locator('body').innerText()).replace(/\s+/g, ' ');
        expect(text, `${user.username}: the HTML course opens`).toContain(st.thanhHtml!.title);
        await cap.popup!.close();
      }
      const rebound = eventsSince('cogniate-app', since, (e) => e.event === 'resource_link_rebound');
      expect(rebound.length, 'resource_link_rebound logged').toBeGreaterThanOrEqual(1);
      expect(rebound.some((e) => e.to_publication === st.thanhHtmlPublicationId), 'rebound to the HTML publication').toBe(true);
      test.info().annotations.push({ type: 'not checked in T4b2', description: 'attempt in_progress, new attempt for cg_student2, SCORM results row (T5a)' });
    } finally {
      await context.close();
    }
  });
});
