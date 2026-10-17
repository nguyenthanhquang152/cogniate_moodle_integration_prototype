// T6: the Results view. Source: tasks/T6.md AC-T6-08, AC-T6-14; contract cogniate-app-api.md §5 (ResultRow, refresh,
// resend); T5b recipes AC-T5-31 (conflict row), AC-T5-32 (failed row), AC-T5-33 (override row).
// The AC-T5-32 row of the T5b pass is already resent ("Sent"). AC-T6-14 needs a failed row "before re-enrolment", so QA
// runs the AC-T5-32 recipe again on its own activity "Cogniate HTML AC-T6-14" in COGNIATE-DEV-102.
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { APP, THANH } from '../lib/app';
import { publicUrls } from '../lib/env';
import { newStackContext } from '../lib/moodle-launch';
import { moodleLogin } from '../lib/moodle-ui';
import { cellUnder, markNoReload, PORTAL_ROUTES, portalSignIn, resultsRow } from '../lib/portal';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import {
  ACT,
  addPickedActivity,
  driveCourse,
  enrolInUi,
  enrolledUser,
  openPlayer,
  results,
  rowsFor,
  t5,
  unenrolInUi,
  waitForRow,
} from '../lib/t5';

const urls = publicUrls();
const T6_FAILED_ACTIVITY = 'Cogniate HTML AC-T6-14';

/** The history of a row: the region that its expand control opens (aria-controls), else the row's next sibling. */
async function historyText(page: Page, row: Locator): Promise<string> {
  const toggle = row.locator('[aria-expanded]').or(row.getByRole('button', { name: /history|details|syncs|expand/i })).first();
  await toggle.click();
  const controls = await toggle.getAttribute('aria-controls');
  if (controls) return (await page.locator(`[id="${controls}"]`).innerText()).replace(/\s+/g, ' ');
  return (await row.locator('xpath=following-sibling::*[1]').innerText().catch(() => '')).replace(/\s+/g, ' ');
}

test.describe.serial('T6 Results (Thanh)', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await newStackContext(browser);
    page = await context.newPage();
    await portalSignIn(page, THANH);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T6-08 SCORM results: cg_student "Passed 100" and cg_student2 with the best outcome, both "Sent"; "Refresh from Moodle" fills the gradebook column', async () => {
    test.setTimeout(120_000);
    await page.goto(`${APP}${PORTAL_ROUTES.results(String(t5().scormPublicationId))}`);
    const r1 = resultsRow(page, seed().users.cg_student.id, ACT.scorm).first();
    const r2 = resultsRow(page, seed().users.cg_student2.id, ACT.scorm).first();
    await expect(r1).toContainText(/Passed\s*100/, { timeout: 15_000 });
    await expect(r1).toContainText('Sent');
    // cg_student2's best outcome after AC-T5-08 (failed 0) and AC-T5-23 (passed 100) is passed 100.
    await expect(r2).toContainText(/Passed\s*100/);
    await expect(r2).toContainText('Sent');
    await page.getByRole('button', { name: 'Refresh from Moodle' }).click();
    await expect.poll(() => cellUnder(r1, /gradebook/i), { timeout: 30_000 }).toMatch(/100/);
    await expect.poll(() => cellUnder(r2, /gradebook/i), { timeout: 30_000 }).toMatch(/100/);
  });

  test('AC-T6-14 conflict row text + Resend; a failed row with its error + Resend → Pending → Sent without a reload; the override text after Refresh; the sync history lists every sync', async ({ browser }) => {
    test.setTimeout(480_000);
    const st = t5();
    const s2 = seed().users.cg_student2;
    const htmlPub = String(st.htmlPublicationId);

    // 1. The AC-T5-31 conflict row.
    await page.goto(`${APP}${PORTAL_ROUTES.results(htmlPub)}`);
    const conflict = resultsRow(page, s2.id, ACT.htmlConflict).first();
    await expect(conflict).toContainText('Moodle has a grade with a newer time', { timeout: 15_000 });
    await expect(conflict.getByRole('button', { name: 'Resend' })).toBeVisible();

    // 2. A failed row (AC-T5-32 recipe on QA's activity): enrolled → launch; unenrol; complete → failed.
    const c102 = seed().courses['COGNIATE-DEV-102'];
    const cmid = await addPickedActivity(context, seed().users.cg_teacher, c102, Number(st.typeId), String(st.html?.title), T6_FAILED_ACTIVITY);
    const player = await openPlayer(context, s2, cmid);
    const email = String((await enrolledUser(c102, s2.id))?.email ?? '');
    const admin = await newStackContext(browser);
    try {
      const a = await admin.newPage();
      await moodleLogin(a, urls.moodle, seed().users.admin.username, seed().users.admin.password);
      await unenrolInUi(a, c102, s2.id);
      await driveCourse(player, { answer: 'correct' });
      const failed = await waitForRow(htmlPub, s2, T6_FAILED_ACTIVITY, (r) => r.scoreSyncs.some((s) => s.status === 'failed'), { timeoutMs: 60_000 });
      expect(failed?.scoreSyncs.map((s) => s.status), JSON.stringify(failed?.scoreSyncs)).toContain('failed');

      await page.goto(`${APP}${PORTAL_ROUTES.results(htmlPub)}`);
      const row = resultsRow(page, s2.id, T6_FAILED_ACTIVITY).first();
      await expect(row).toContainText(/PLATFORM_REJECTED_REQUEST|Incorrect score|rejected/i, { timeout: 15_000 });
      await expect(row.getByRole('button', { name: 'Resend' })).toBeVisible();

      await enrolInUi(a, c102, email);
      const samePage = await markNoReload(page);
      await row.getByRole('button', { name: 'Resend' }).click();
      await expect(row).toContainText('Pending', { timeout: 15_000 });
      await expect(row).toContainText('Sent', { timeout: 120_000 });
      expect(await samePage(), 'no reload').toBe(true);
    } finally {
      await admin.close();
      await player.popup.close({ runBeforeUnload: true }).catch(() => undefined);
    }

    // 3. The AC-T5-33 override row after "Refresh from Moodle", and its sync history.
    const scormPub = String(st.scormPublicationId);
    await page.goto(`${APP}${PORTAL_ROUTES.results(scormPub)}`);
    await page.getByRole('button', { name: 'Refresh from Moodle' }).click();
    const override = resultsRow(page, s2.id, ACT.scormOverride).first();
    await expect(override).toContainText('Moodle keeps another grade, for example a teacher override', { timeout: 30_000 });
    const apiRow = rowsFor(await results(scormPub), s2, ACT.scormOverride)[0];
    const history = await historyText(page, override);
    const statusWord: Record<string, RegExp> = { sent: /Sent/g, pending: /Pending/g, failed: /Failed/g, conflict: /Conflict/g, superseded: /Superseded/g };
    const problems: string[] = [];
    for (const [status, re] of Object.entries(statusWord)) {
      const want = (apiRow?.scoreSyncs ?? []).filter((s) => s.status === status).length;
      const got = (history.match(re) ?? []).length;
      if (got < want) problems.push(`history shows "${status}" ${got} times, the row has ${want} such syncs`);
    }
    expect(apiRow?.scoreSyncs.length ?? 0, 'the AC-T5-33 row has two syncs').toBeGreaterThanOrEqual(2);
    test.info().annotations.push({ type: 'history', description: history.slice(0, 300) });
    expect(problems).toEqual([]);
  });
});
