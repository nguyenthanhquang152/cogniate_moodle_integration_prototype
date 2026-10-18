// T4b2: learner and teacher launches, the single-use handoff, and the signed target.
// Source: tasks/T4b2.md AC-T4-17, -24, -23, -19; contract cogniate-app-api.md §5, §6; security §4.
import { APP, appApi, signIn, THANH } from '../lib/app';
import { checkErrorPage, eventsSince, pageTraceId, saveState, waitForEvent } from '../lib/lti';
import { type LaunchCapture, launchActivity, launchToHandoff, newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import { t4b } from '../lib/t4b-state';

const PLAY = `${APP}/play/`;
const playIdOf = (cap: LaunchCapture) => new URL(cap.finalUrl ?? '').pathname.split('/')[2] ?? '';

// Default mode (file order, one worker), not serial: the tests share only the state file, so a failed AC does not
// stop the next ones (AC-T4-24 reads the handoff URL that AC-T4-17 saves first).
test.describe('T4b2 launches', () => {
  test('AC-T4-17 cg_student opens the activity: a new window ends at /play/<id> without ltik; the 303 has no-referrer; status not_started', async ({ browser }) => {
    test.setTimeout(90_000);
    const st = t4b();
    expect(st.scormActivityCmid, 'AC-T4-15 made the activity').toBeTruthy();
    const context = await newStackContext(browser);
    try {
      const cap = await launchActivity(context, seed().users.cg_student, st.scormActivityCmid!, { until: PLAY, timeoutMs: 20_000 });
      expect(cap.popup, 'a new window').toBeDefined();
      expect(cap.finalUrl ?? '').toMatch(new RegExp(`^${PLAY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^/?#]+$`));
      expect(cap.finalUrl, 'no ltik in the final URL').not.toContain('ltik');
      expect(cap.toolLaunch?.status).toBe(303);
      expect(cap.toolLaunch?.headers['referrer-policy']).toBe('no-referrer');
      const text = (await cap.popup!.locator('body').innerText()).replace(/\s+/g, ' ');
      expect(text).toContain(st.thanhScorm!.title);
      expect(text).toContain('Back to Moodle');
      const playId = playIdOf(cap);
      // Save the handoff URL first: AC-T4-24 needs it even if a later check of this test fails.
      saveState('T4b', { firstToolLaunchUrl: cap.toolLaunch!.url, firstPlayId: playId, playHeaders: cap.play?.headers ?? {} });
      const status = await appApi<{ outcome: string; preview: boolean }>('GET', `/app-api/play/${playId}/status`);
      expect(status.status, status.body).toBe(200);
      expect(status.json.outcome).toBe('not_started');
      expect(status.json.preview).toBe(false);
      const thanh = await signIn(THANH);
      const pub = await appApi<{ stats: { learners: number } }>('GET', `/app-api/publications/${st.thanhScormPublicationId}`, { cookie: thanh.cookie });
      expect(pub.json.stats.learners).toBe(1);
    } finally {
      await context.close();
    }
  });

  test('AC-T4-24 the captured /tool/launch?…&ltik= URL opened again in a new context → 409 HANDOFF_USED; handoff_rejected; no launch_accepted', async ({ browser }) => {
    const url = String(t4b().firstToolLaunchUrl ?? '');
    expect(url, 'AC-T4-17 captured the handoff URL').toContain('ltik=');
    const context = await newStackContext(browser);
    try {
      const page = await context.newPage();
      const res = await page.goto(url);
      const headers = (await res?.allHeaders()) ?? {};
      const body = (await res?.text()) ?? '';
      expect(checkErrorPage({ status: res?.status() ?? 0, headers, body }, 'HANDOFF_USED', { statuses: [409], test: 'AC-T4-24', endpoint: 'tool' })).toEqual([]);
      const trace = pageTraceId({ status: res?.status() ?? 0, headers, body });
      const ev = await waitForEvent('cogniate-app', (e) => e.event === 'handoff_rejected' && e.trace_id === trace);
      expect(ev?.code, 'handoff_rejected code').toBe('HANDOFF_USED');
      expect(eventsSince('cogniate-app', 0, (e) => e.event === 'launch_accepted' && e.trace_id === trace), 'launch_accepted with that trace id').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('AC-T4-23 changing resource= in the handoff URL to the HTML publication still opens the SCORM course (signed target)', async ({ browser }) => {
    test.setTimeout(90_000);
    const st = t4b();
    const context = await newStackContext(browser);
    try {
      // QA intercepts the 303 itself (Playwright routes do not see the redirected GET /tool/launch): it sends Moodle's
      // id_token POST from Node, changes `resource` in the Location, then opens that URL in the browser.
      const handoff = await launchToHandoff(context, seed().users.cg_student, st.scormActivityCmid!);
      const changed = new URL(handoff.location);
      expect(`${changed.origin}${changed.pathname}`).toBe(`${APP}/tool/launch`);
      expect(changed.searchParams.get('resource'), 'the 303 names the SCORM publication').not.toBe(String(st.thanhHtmlPublicationId));
      changed.searchParams.set('resource', String(st.thanhHtmlPublicationId));
      const page = await context.newPage();
      await page.goto(changed.toString());
      await page.waitForURL((u) => u.href.startsWith(PLAY), { timeout: 20_000 });
      const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      expect(text, 'the SCORM course opens').toContain(st.thanhScorm!.title);
      expect(text, 'not the HTML course').not.toContain(st.thanhHtml!.title);
    } finally {
      await context.close();
    }
  });

  test('AC-T4-19 cg_teacher opens the activity → play status preview=true', async ({ browser }) => {
    test.setTimeout(90_000);
    const context = await newStackContext(browser);
    try {
      const cap = await launchActivity(context, seed().users.cg_teacher, t4b().scormActivityCmid!, { until: PLAY, timeoutMs: 20_000 });
      const status = await appApi<{ preview: boolean }>('GET', `/app-api/play/${playIdOf(cap)}/status`);
      expect(status.status).toBe(200);
      expect(status.json.preview).toBe(true);
    } finally {
      await context.close();
    }
  });
});
