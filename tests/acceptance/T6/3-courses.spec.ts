// T6: Courses, upload with progress, report, download, Publish dialog. Source: tasks/T6.md AC-T6-06, -11, -07;
// contract cogniate-app-api.md §3 (report, reject codes), §5 (publications); T4a fixture values.
// Serial: AC-T6-06 makes the SCORM course in the UI; AC-T6-11 and AC-T6-07 use it.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { appApi, APP, signIn, THANH } from '../lib/app';
import { courseZipCopy } from '../lib/course-fixtures';
import { loadState, saveState } from '../lib/lti';
import { newStackContext } from '../lib/moodle-launch';
import { PORTAL_ROUTES, portalSignIn } from '../lib/portal';
import { expect, test } from '../lib/pw';
import { t5 } from '../lib/t5';
import { zipBuffer } from '../lib/zip';

const S3 = 'cogniate-prod-ai-course-creation.s3.ap-southeast-1.amazonaws.com';
const SCORM_SHA256 = 'a685744e5fd9de21c203c3b2f47916ef1079532196ed870df89a00ab8ee76df7';

/** Courses → "New course" → title → create; returns the course id from the URL /libraries/courses/:id. */
async function newCourseInUi(page: Page, title: string): Promise<string> {
  await page.goto(`${APP}${PORTAL_ROUTES.courses}`);
  await page.getByRole('button', { name: 'New course' }).or(page.getByRole('link', { name: 'New course' })).first().click();
  await page.getByLabel(/title/i).first().fill(title);
  await Promise.all([
    page.waitForURL(/\/libraries\/courses\/[^/]+$/, { timeout: 15_000 }),
    page.getByRole('button', { name: /create|save/i }).first().click(),
  ]);
  return new URL(page.url()).pathname.split('/').pop()!;
}

/** Choose the file (drag-and-drop zones have a file input) and start the upload if the page has an "Upload" button. */
async function chooseZip(page: Page, file: string): Promise<void> {
  await page.locator('input[type="file"]').first().setInputFiles(file);
  const upload = page.getByRole('button', { name: /^upload/i });
  if ((await upload.count()) && (await upload.first().isEnabled())) await upload.first().click();
}

test.describe.serial('T6 Courses (Thanh)', () => {
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

  test('AC-T6-06 upload on a slow network: a role="progressbar" with a growing aria-valuenow, then the report (SCORM 1.2, Mastery score 70, external hosts); a PATH_TRAVERSAL zip shows the plain-words reason and makes no version', async () => {
    test.setTimeout(300_000);
    const runId = Date.now().toString(36);
    const courseId = await newCourseInUi(page, `QA UI SCORM ${runId}`);
    saveState('T6', { uiScormCourseId: courseId });

    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: -1, uploadThroughput: (8 * 1024 * 1024) / 8 });
    const values: number[] = [];
    try {
      await chooseZip(page, courseZipCopy('scorm'));
      const bar = page.getByRole('progressbar');
      await bar.first().waitFor({ timeout: 15_000 });
      const deadline = Date.now() + 180_000;
      while (Date.now() < deadline) {
        const v = await bar.first().getAttribute('aria-valuenow').catch(() => null);
        if (v !== null && (values.length === 0 || Number(v) !== values[values.length - 1])) values.push(Number(v));
        if ((await page.getByText('SCORM 1.2').count()) > 0 || (await bar.count()) === 0) break;
        await page.waitForTimeout(200);
      }
    } finally {
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    }
    test.info().annotations.push({ type: 'aria-valuenow', description: values.join(', ') });
    expect(values.length, `aria-valuenow values: ${values.join(', ')}`).toBeGreaterThanOrEqual(2);
    expect(values.every((v, i) => i === 0 || v >= values[i - 1]), 'aria-valuenow never goes down').toBe(true);
    expect(values[values.length - 1]).toBeGreaterThan(values[0]);

    await expect(page.getByText('SCORM 1.2').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Mastery score\s*70/).first()).toBeVisible();
    await expect(page.getByText(S3).first(), 'external hosts warning names the S3 host').toBeVisible();

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-t6-'));
    const evil = path.join(dir, 'traversal.zip');
    fs.writeFileSync(evil, zipBuffer([{ name: 'index.html', data: '<!doctype html><html><body data-lesson-id="index">QA</body></html>' }, { name: '../evil.html', data: 'qa' }]));
    const badId = await newCourseInUi(page, `QA UI traversal ${runId}`);
    await chooseZip(page, evil);
    await expect(page.getByText('The package has an unsafe file path: ../evil.html')).toBeVisible({ timeout: 60_000 });
    const thanh = await signIn(THANH);
    const course = await appApi<{ versions?: unknown[]; latestVersion?: unknown }>('GET', `/app-api/courses/${badId}`, { cookie: thanh.cookie });
    expect(course.json.versions ?? [], 'no version made').toHaveLength(0);
    expect(course.json.latestVersion ?? null).toBeNull();
  });

  test('AC-T6-11 "Download SCORM package" on the SCORM course downloads the uploaded zip (same SHA-256); the HTML course has no such button', async () => {
    test.setTimeout(120_000);
    const courseId = String((loadState('T6') as { uiScormCourseId?: string }).uiScormCourseId ?? '');
    expect(courseId, 'AC-T6-06 made the course').toBeTruthy();
    await page.goto(`${APP}${PORTAL_ROUTES.course(courseId)}`);
    const button = page.getByRole('button', { name: 'Download SCORM package' }).or(page.getByRole('link', { name: 'Download SCORM package' })).first();
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), button.click()]);
    const file = await download.path();
    const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    expect(sha, `download ${download.suggestedFilename()}`).toBe(SCORM_SHA256);

    await page.goto(`${APP}${PORTAL_ROUTES.course(String(t5().html?.courseId))}`);
    await page.getByText('HTML').first().waitFor({ timeout: 15_000 });
    expect(await page.getByRole('button', { name: 'Download SCORM package' }).or(page.getByRole('link', { name: 'Download SCORM package' })).count(), 'HTML course').toBe(0);
  });

  test('AC-T6-07 the Publish dialog lists only registered or connected connections; after "Publish": "Available in Moodle" and the teacher text', async () => {
    test.setTimeout(120_000);
    const t6 = loadState('T6') as { uiScormCourseId?: string; pendingConnectionName?: string };
    await page.goto(`${APP}${PORTAL_ROUTES.course(String(t6.uiScormCourseId))}`);
    await page.getByRole('button', { name: /Publish to Moodle/ }).or(page.getByRole('link', { name: /Publish to Moodle/ })).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const text = (await dialog.innerText()).replace(/\s+/g, ' ');
    expect(text, 'the registered/connected connection').toContain('Dev Moodle');
    expect(text, 'the pending connection is not listed').not.toContain(String(t6.pendingConnectionName));
    const radio = dialog.getByRole('radio', { name: /Dev Moodle/ });
    if (await radio.count()) await radio.first().check();
    else {
      const select = dialog.locator('select').first();
      const value = await select.evaluate((s) => Array.from((s as HTMLSelectElement).options).find((o) => /Dev Moodle/.test(o.text))?.value ?? '');
      await select.selectOption(value);
    }
    await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText('Available in Moodle').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Teachers: Add an activity > Cogniate (Thanh's Library) > Select content").first()).toBeVisible();
  });
});
