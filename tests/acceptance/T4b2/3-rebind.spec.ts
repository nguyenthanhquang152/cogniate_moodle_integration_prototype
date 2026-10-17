// T4b2: withdraw and rebind. Source: tasks/T4b2.md AC-T4-27, AC-T4-25 (c3746bb: the T4b2 part only; the in-progress
// attempt part is AC-T5-37 in T5a); security §4 (binding); contract cogniate-app-api.md §12 (resource_link_rebound).
// AC-T4-27 runs first and publishes the SCORM course again, so that AC-T4-25 can launch it.
import { APP, appApi, signIn, THANH } from '../lib/app';
import { checkErrorPage, waitForEvent } from '../lib/lti';
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

  test('AC-T4-25 the teacher picks the HTML course for the SCORM activity: the next cg_student launch opens the HTML course; resource_link_rebound', async ({ browser }) => {
    test.setTimeout(180_000);
    const st = t4b();
    const since = Date.now() - 1_000;
    const context = await newStackContext(browser);
    try {
      const open = await openPicker(context, seed().users.cg_teacher, seed().courses['COGNIATE-DEV-101'], st.thanhTypeId!, 45_000, { updateCmid: st.scormActivityCmid });
      const { pickerPost } = await submitPicker(open, st.thanhHtml!.title);
      expect(pickerPost.status).toBe(200);
      // Keep the activity name; only the content changes.
      await open.page.locator('#id_name').fill(st.scormActivityName!);
      await Promise.all([open.page.waitForURL(/\/course\/view\.php|\/mod\/lti\/view\.php/, { timeout: 30_000 }), open.page.locator('#id_submitbutton2').click()]);

      const cap = await launchActivity(context, seed().users.cg_student, st.scormActivityCmid!, { until: PLAY, timeoutMs: 20_000 });
      const text = (await cap.popup!.locator('body').innerText()).replace(/\s+/g, ' ');
      expect(text, 'the shell shows the HTML course title').toContain(st.thanhHtml!.title);
      await cap.popup!.close();
      const rebound = await waitForEvent('cogniate-app', (e) => e.event === 'resource_link_rebound' && Date.parse(String(e.ts)) >= since && e.to_publication === st.thanhHtmlPublicationId);
      expect(rebound, 'resource_link_rebound to the HTML publication').toBeDefined();
      expect(rebound!.from_publication, 'rebound from the SCORM publication').toBe(st.thanhScormPublicationId);
    } finally {
      await context.close();
    }
  });
});
