// T4b2 negative and security cases. Source: tasks/T4b2.md AC-T4-18, -20, -22, -26, -28, -29;
// contract cogniate-app-api.md §6, §12; security §4, §6, §7 (output), §8.
// AC-T4-18 needs the activity that the host runner makes with `npm run seed:lti-activity` after pass 1 (T4b2.md setup
// order): it is named "QA foreign" and points at library B's publication. The runner runs AC-T4-18 in pass 2.
// AC-T4-20 has a knob part (PICKER_TTL_SECONDS=20): the host runner runs it in a knob pass.
import crypto from 'node:crypto';
import { APP, appApi, QA_B, signIn } from '../lib/app';
import { publicUrls } from '../lib/env';
import { httpsRequest } from '../lib/https';
import { checkErrorPage, eventsSince, hostIs, pageTraceId, waitForEvent } from '../lib/lti';
import { cmidByName, openPicker, pickerOptions, submitPicker } from '../lib/moodle-dl';
import { launchActivity, launchToHandoff, newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import { t4b } from '../lib/t4b-state';

const urls = publicUrls();
const LTI_HOST = new URL(urls.lti).hostname;
const course101 = () => seed().courses['COGNIATE-DEV-101'];

/** No call from the app to the LTI service with this trace id (no deep-linking call). */
function ltiCalls(trace: string) {
  return eventsSince('cogniate-app', 0, (e) => e.event === 'outbound_request' && e.trace_id === trace && hostIs(e, LTI_HOST));
}

async function postPicker(pickerUrl: string, publicationId: string, origin: string | null) {
  const form = new URLSearchParams({ publicationId }).toString();
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(form)) };
  if (origin !== null) headers.origin = origin;
  return httpsRequest(pickerUrl, { method: 'POST', headers, body: form });
}

test.describe.serial('T4b2 negative cases', () => {
  test('AC-T4-18 an activity under Thanh\'s tool that points at library B\'s publication → 404 "This course is not available"; no attempt', async ({ browser }) => {
    test.setTimeout(90_000);
    const st = t4b();
    const cmid = await cmidByName(course101(), 'QA foreign');
    expect(cmid, 'the host runner made the activity with npm run seed:lti-activity').toBeDefined();
    const context = await newStackContext(browser);
    try {
      const cap = await launchActivity(context, seed().users.cg_student, cmid!, { timeoutMs: 20_000 });
      expect(cap.toolLaunch, 'the app answered /tool/launch').toBeDefined();
      expect(checkErrorPage(cap.toolLaunch!, 'PUBLICATION_NOT_IN_CONNECTION', { statuses: [404], test: 'AC-T4-18', endpoint: 'tool' })).toEqual([]);
      expect(cap.toolLaunch!.body.replace(/\s+/g, ' ')).toContain('This course is not available');
      const ev = await waitForEvent('cogniate-app', (e) => e.event === 'launch_rejected' && e.trace_id === pageTraceId(cap.toolLaunch!));
      expect(ev?.reason).toBe('publication_not_in_connection');
      expect(cap.play, 'no player, so no attempt').toBeUndefined();
      const { saveState } = await import('../lib/lti');
      saveState('T4b', { errorPageHeaders: cap.toolLaunch!.headers });
    } finally {
      await context.close();
    }
  });

  test('AC-T4-20 /tool/deep-link with an unused student resource ltik → 403 page, deep_link_rejected {reason: not_deep_linking}; a POST to a used picker → 410', async ({ browser }) => {
    test.setTimeout(90_000);
    const st = t4b();
    const context = await newStackContext(browser);
    try {
      // An unused student ltik: QA sends Moodle's id_token POST itself and reads the 303 Location, so the app never
      // sees this ltik at /tool/launch (Playwright routes cannot hold the redirected GET).
      const handoff = await launchToHandoff(context, seed().users.cg_student, st.scormActivityCmid!);
      expect(handoff.ltik).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const dl = await httpsRequest(`${APP}/tool/deep-link?ltik=${encodeURIComponent(handoff.ltik)}`);
      const code = dl.body.match(/data-error-code="([^"]+)"/)?.[1] ?? '?';
      expect(checkErrorPage(dl, code, { statuses: [403], test: 'AC-T4-20', endpoint: 'tool' })).toEqual([]);
      const ev = await waitForEvent('cogniate-app', (e) => e.event === 'deep_link_rejected' && e.trace_id === pageTraceId(dl));
      expect(ev, `deep_link_rejected with the page trace id ${pageTraceId(dl)}`).toBeDefined();
      expect(ev!.reason, 'check order of app contract §6: message type before role').toBe('not_deep_linking');
    } finally {
      await context.close();
    }
    const used = String(st.usedPickerUrl ?? '');
    expect(used, 'AC-T4-15 used a picker').toContain('/tool/picker/');
    const again = await postPicker(used, String(st.thanhScormPublicationId), APP);
    expect(again.status, again.body.slice(0, 200)).toBe(410);
    expect(checkErrorPage(again, again.body.match(/data-error-code="([^"]+)"/)?.[1] ?? '?', { statuses: [410], test: 'AC-T4-20', endpoint: 'tool' })).toEqual([]);
  });

  test('AC-T4-20 [knob PICKER_TTL_SECONDS=20] a picker POST at TTL + 3 s → 410 page', async ({ browser }) => {
    test.setTimeout(150_000);
    const st = t4b();
    const context = await newStackContext(browser);
    try {
      const open = await openPicker(context, seed().users.cg_teacher, course101(), st.thanhTypeId!);
      const openedAt = Date.now();
      await new Promise((r) => setTimeout(r, Math.max(0, openedAt + 23_000 - Date.now())));
      const { pickerPost } = await submitPicker(open, st.thanhScorm!.title);
      expect(pickerPost.status, pickerPost.body.slice(0, 200)).toBe(410);
    } finally {
      await context.close();
    }
  });

  test('AC-T4-22 POST /tool/picker/<id> with Origin evil.test, null or none → 403, csrf_rejected; the picker is not used; no deep-linking call', async ({ browser }) => {
    test.setTimeout(120_000);
    const st = t4b();
    const context = await newStackContext(browser);
    try {
      const open = await openPicker(context, seed().users.cg_teacher, course101(), st.thanhTypeId!);
      for (const [label, origin] of [['Origin https://evil.test', 'https://evil.test'], ['Origin null', 'null'], ['no Origin', null]] as const) {
        const res = await postPicker(open.pickerUrl, String(st.thanhScormPublicationId), origin);
        expect(res.status, label).toBe(403);
        const trace = pageTraceId(res);
        const ev = await waitForEvent('cogniate-app', (e) => e.event === 'csrf_rejected' && e.trace_id === trace);
        expect(ev, `${label}: csrf_rejected`).toBeDefined();
        expect(ltiCalls(trace), `${label}: no call to the LTI service`).toEqual([]);
      }
      const still = await httpsRequest(open.pickerUrl);
      expect(still.status, 'the picker is not used (GET still works)').toBe(200);
    } finally {
      await context.close();
    }
  });

  test('AC-T4-26 a real picker POST with library B\'s publication id, and with a withdrawn one → 400 PUBLICATION_NOT_AVAILABLE; no deep-linking call', async ({ browser }) => {
    test.setTimeout(150_000);
    const st = t4b();
    for (const [label, forceValue] of [['library B publication', st.bHtmlPublicationId], ['withdrawn publication', st.withdrawnPublicationId]] as const) {
      const context = await newStackContext(browser);
      try {
        const open = await openPicker(context, seed().users.cg_teacher, course101(), st.thanhTypeId!);
        const { pickerPost } = await submitPicker(open, st.thanhScorm!.title, { forceValue: String(forceValue) });
        expect(checkErrorPage(pickerPost, 'PUBLICATION_NOT_AVAILABLE', { statuses: [400], test: 'AC-T4-26', endpoint: 'tool' }), label).toEqual([]);
        expect(ltiCalls(pageTraceId(pickerPost)), `${label}: no deep-linking call`).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });

  test('AC-T4-28 the course title <b>x</b>, manifest title <img …> and activity name x < y & "z" stay safe; window.__xss stays undefined', async ({ browser }) => {
    test.setTimeout(180_000);
    const st = t4b();
    const context = await newStackContext(browser);
    try {
      const open = await openPicker(context, seed().users.cg_teacher, course101(), st.thanhTypeId!);
      const options = await pickerOptions(open.frame);
      const xss = options.find((o) => o.value === st.xssPublicationId);
      expect(xss?.label ?? xss?.row, 'the picker shows the title as text').toContain('<b>x</b>');
      expect(await open.frame.evaluate(() => Array.from(document.querySelectorAll('b')).some((e) => e.textContent === 'x')), 'no <b>x</b> element from the title').toBe(false);
      expect(await open.frame.evaluate(() => (window as unknown as { __xss?: unknown }).__xss), 'picker: window.__xss').toBeUndefined();
      const { pickerPost } = await submitPicker(open, '<b>x</b>');
      expect(pickerPost.status).toBe(200);
      const activityName = 'x < y & "z"';
      await open.page.locator('#id_name').fill(activityName);
      await Promise.all([open.page.waitForURL(/\/course\/view\.php/, { timeout: 30_000 }), open.page.locator('#id_submitbutton2').click()]);
      // Moodle's course-contents API returns this name HTML-escaped. Read the rendered activity link instead.
      const activityLink = open.page.locator('a[href*="/mod/lti/view.php"]').filter({ hasText: activityName });
      await expect(activityLink, 'the activity name is shown literally in Moodle').toHaveCount(1);
      const cmid = Number(new URL((await activityLink.getAttribute('href'))!, open.page.url()).searchParams.get('id'));
      expect(cmid).toBeGreaterThan(0);
      test.info().annotations.push({ type: 'moodle activity name', description: activityName });

      const cap = await launchActivity(context, seed().users.cg_student, cmid!, { until: `${APP}/play/`, timeoutMs: 20_000 });
      const shell = cap.popup!;
      const text = (await shell.locator('body').innerText()).replace(/\s+/g, ' ');
      expect(text, 'the shell shows the course title as text').toContain('<b>x</b>');
      expect(
        await shell.evaluate(() => Array.from(document.querySelectorAll('b, i')).some((e) => (e.tagName === 'B' && e.textContent === 'x') || (e.tagName === 'I' && e.textContent === 'y'))),
        'no <b>x</b> or <i>y</i> element from the titles',
      ).toBe(false);
      for (const frame of shell.frames()) {
        expect(await frame.evaluate(() => (window as unknown as { __xss?: unknown }).__xss).catch(() => undefined), `${frame.url()}: window.__xss`).toBeUndefined();
      }
    } finally {
      await context.close();
    }
  });

  test('AC-T4-29 an unknown playId → 404; library B gets 404 for Thanh\'s publication after the launches (no stats leak)', async () => {
    const unknown = await appApi('GET', `/app-api/play/ply_${crypto.randomBytes(16).toString('base64url')}/status`);
    expect(unknown.status).toBe(404);
    const b = await signIn(QA_B);
    const res = await appApi('GET', `/app-api/publications/${t4b().thanhScormPublicationId}`, { cookie: b.cookie });
    expect(res.status).toBe(404);
    expect(res.body).not.toMatch(/"learners"\s*:\s*[1-9]/);
  });
});
