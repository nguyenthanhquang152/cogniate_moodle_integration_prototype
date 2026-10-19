// T6: the Results view. Source: tasks/T6.md AC-T6-08, AC-T6-14; contract cogniate-app-api.md §5 (ResultRow, refresh,
// resend); T5b recipes AC-T5-31 (conflict row), AC-T5-32 (failed row), AC-T5-33 (override row).
// AC-T6-14 uses the fresh rows that SETUP-T6 makes with the three recipes (lib/t6-recipes.ts, tasks/T6.md).
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { APP, THANH } from '../lib/app';
import { publicUrls } from '../lib/env';
import { newStackContext } from '../lib/moodle-launch';
import { moodleLogin } from '../lib/moodle-ui';
import { cellUnder, markNoReload, PORTAL_ROUTES, portalSignIn, resultsRow } from '../lib/portal';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import { loadState } from '../lib/lti';
import { ACT, enrolInUi, enrolledUser, results, rowsFor, t5 } from '../lib/t5';
import { T6_ACT } from '../lib/t6-recipes';

const urls = publicUrls();

/** The Moodle course title of an activity (ResultRow.activity.contextTitle), as the Results view shows it. */
async function contextTitleOf(publicationId: string, activityTitle: string): Promise<string> {
  const row = (await results(publicationId)).find((r) => r.activity.title === activityTitle);
  expect(row?.activity.contextTitle, `contextTitle of "${activityTitle}"`).toBeTruthy();
  return String(row!.activity.contextTitle);
}

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
    const ctx = await contextTitleOf(String(t5().scormPublicationId), ACT.scorm);
    const r1 = resultsRow(page, seed().users.cg_student.id, ACT.scorm, ctx).first();
    const r2 = resultsRow(page, seed().users.cg_student2.id, ACT.scorm, ctx).first();
    await expect(r1).toContainText(/Passed\s*100/, { timeout: 15_000 });
    await expect(r1).toContainText('Sent');
    // cg_student2's best outcome after AC-T5-08 (failed 0) and AC-T5-23 (passed 100) is passed 100.
    await expect(r2).toContainText(/Passed\s*100/);
    await expect(r2).toContainText('Sent');
    await page.getByRole('button', { name: 'Refresh from Moodle' }).click();
    await expect.poll(() => cellUnder(r1, /gradebook/i), { timeout: 30_000 }).toMatch(/100/);
    await expect.poll(() => cellUnder(r2, /gradebook/i), { timeout: 30_000 }).toMatch(/100/);
  });

  test('AC-T6-14 (fresh rows of T6 setup) conflict row text + Resend; the failed row with its error + Resend; after enrol, Resend → Pending → Sent without a reload; the override text after Refresh; the sync history lists every sync', async ({ browser }) => {
    test.setTimeout(480_000);
    const st = t5();
    const t6 = loadState('T6') as { conflictSyncId?: string; failedSyncId?: string; failedEmail?: string; overrideCmid?: number };
    const s2 = seed().users.cg_student2;
    const htmlPub = String(st.htmlPublicationId);
    const problems: string[] = [];

    // 1. The conflict row (AC-T5-31 recipe).
    expect(t6.conflictSyncId, 'SETUP-T6 made the conflict row').toBeTruthy();
    await page.goto(`${APP}${PORTAL_ROUTES.results(htmlPub)}`);
    const conflict = resultsRow(page, s2.id, T6_ACT.conflict, await contextTitleOf(htmlPub, T6_ACT.conflict)).first();
    await expect(conflict).toContainText('Moodle has a grade with a newer time', { timeout: 15_000 });
    await expect(conflict.getByRole('button', { name: 'Resend' })).toBeVisible();

    // 2. The failed row (AC-T5-32 recipe, before re-enrolment): error + Resend; QA enrols again; Resend → Pending → Sent.
    expect(t6.failedSyncId && t6.failedEmail, 'SETUP-T6 made the failed row').toBeTruthy();
    const c102 = seed().courses['COGNIATE-DEV-102'];
    const row = resultsRow(page, s2.id, T6_ACT.failed, await contextTitleOf(htmlPub, T6_ACT.failed)).first();
    await expect(row).toContainText(/PLATFORM_REJECTED_REQUEST|Incorrect score|rejected/i, { timeout: 15_000 });
    await expect(row.getByRole('button', { name: 'Resend' })).toBeVisible();
    const admin = await newStackContext(browser);
    try {
      const a = await admin.newPage();
      await moodleLogin(a, urls.moodle, seed().users.admin.username, seed().users.admin.password);
      await enrolInUi(a, c102, String(t6.failedEmail));
      expect((await enrolledUser(c102, s2.id))?.roles, 'cg_student2 enrolled again as student').toContain('student');
    } finally {
      await admin.close();
    }
    const samePage = await markNoReload(page);
    await row.getByRole('button', { name: 'Resend' }).click();
    await expect(row).toContainText('Pending', { timeout: 15_000 });
    await expect(row).toContainText('Sent', { timeout: 120_000 });
    expect(await samePage(), 'no reload').toBe(true);

    // 3. The override row (AC-T5-33 recipe) after "Refresh from Moodle", and its sync history.
    expect(t6.overrideCmid, 'SETUP-T6 made the override row').toBeTruthy();
    const scormPub = String(st.scormPublicationId);
    await page.goto(`${APP}${PORTAL_ROUTES.results(scormPub)}`);
    await page.getByRole('button', { name: 'Refresh from Moodle' }).click();
    const override = resultsRow(page, s2.id, T6_ACT.override, await contextTitleOf(scormPub, T6_ACT.override)).first();
    await expect(override).toContainText('Moodle keeps another grade, for example a teacher override', { timeout: 30_000 });
    const apiRow = rowsFor(await results(scormPub), s2, T6_ACT.override)[0];
    const history = await historyText(page, override);
    const statusWord: Record<string, RegExp> = { sent: /Sent/g, pending: /Pending/g, failed: /Failed/g, conflict: /Conflict/g, superseded: /Superseded/g };
    for (const [status, re] of Object.entries(statusWord)) {
      const want = (apiRow?.scoreSyncs ?? []).filter((s) => s.status === status).length;
      const got = (history.match(re) ?? []).length;
      if (got < want) problems.push(`history shows "${status}" ${got} times, the row has ${want} such syncs`);
    }
    expect(apiRow?.scoreSyncs.length ?? 0, 'the override row has two syncs').toBeGreaterThanOrEqual(2);
    test.info().annotations.push({ type: 'history', description: history.slice(0, 300) });
    expect(problems).toEqual([]);
  });
});
