// T8: the course shell. Source: tasks/T8.md AC-T8-08, -09, -10; app contract §11 (web services, createMoodleCourse,
// shellStatus, connection webServices). Order: AC-T8-10 without a token, AC-T8-08 (sets the token), AC-T8-09 (API),
// AC-T8-10 with the token (UI). Thanh's connection of the T5a setup; QA courses of SETUP-T8.
import crypto from 'node:crypto';
import type { BrowserContext, Page } from '@playwright/test';
import { APP, appApi, signIn, THANH } from '../lib/app';
import { publicUrls } from '../lib/env';
import { newStackContext } from '../lib/moodle-launch';
import { callWs } from '../lib/moodle-ws';
import { PORTAL_ROUTES, portalSignIn } from '../lib/portal';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import { t5 } from '../lib/t5';
import { t8 } from '../lib/t8';

const urls = publicUrls();
const CHECKBOX = 'Also create an empty Moodle course';
const errCode = (json: Record<string, unknown> | null) => String((json?.details as { message?: string } | undefined)?.message ?? json?.error ?? '');
const idnumber = (courseId: string) => `cogniate:${courseId}:default:en`;

async function coursesByIdnumber(value: string) {
  return (await callWs<{ courses: { id: number; idnumber: string; visible: number; shortname: string }[] }>(seed().oracleToken, 'core_course_get_courses_by_field', { field: 'idnumber', value })).courses;
}

/** Opens the Publish dialog and chooses Thanh's connection (the dialog starts with "Choose a connection"). */
async function openPublishDialog(page: Page, courseId: string) {
  const thanh = await signIn(THANH);
  const conn = await appApi<{ name: string; siteUrl: string }>('GET', `/app-api/connections/${encodeURIComponent(String(t5().connectionId))}`, { cookie: thanh.cookie });
  await page.goto(`${APP}${PORTAL_ROUTES.course(courseId)}`);
  await page.getByRole('button', { name: /Publish to an LMS/ }).or(page.getByRole('link', { name: /Publish to an LMS/ })).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const select = dialog.getByRole('combobox', { name: 'LMS connection' });
  const label = await select.locator('option').evaluateAll((opts, name) => opts.map((o) => o.textContent ?? '').find((t) => t.startsWith(`${name} (Moodle, `)) ?? '', conn.json.name);
  expect(label, `option for the connection "${conn.json.name}"`).toBeTruthy();
  await select.selectOption({ label });
  return dialog;
}

test.describe.serial('T8 course shell (web services)', () => {
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

  test('AC-T8-10 (no token) the Publish dialog has no "Also create an empty Moodle course" checkbox', async () => {
    const thanh = await signIn(THANH);
    const conn = await appApi<{ webServices?: unknown }>('GET', `/app-api/connections/${encodeURIComponent(String(t5().connectionId))}`, { cookie: thanh.cookie });
    expect(conn.json.webServices ?? null, 'the connection has no web services token yet').toBeNull();
    const dialog = await openPublishDialog(page, String(t8().shellUi?.courseId));
    await expect(dialog.getByRole('button', { name: /^Publish/ }).last(), 'the dialog is ready with the connection chosen').toBeVisible();
    expect(await dialog.getByLabel(CHECKBOX).count(), 'no checkbox without a token').toBe(0);
    expect(await dialog.getByText(CHECKBOX).count()).toBe(0);
    await page.keyboard.press('Escape');
  });

  test('AC-T8-08 PUT …/web-services {token} → 200 with release 5.2… and the function list; a wrong token → 422 WS_TOKEN_INVALID; the token is never returned', async () => {
    const thanh = await signIn(THANH);
    const conn = String(t5().connectionId);
    const wsPath = `/app-api/connections/${encodeURIComponent(conn)}/web-services`;
    const wrong = await appApi('PUT', wsPath, { cookie: thanh.cookie, body: { token: crypto.randomBytes(16).toString('hex') } });
    expect(wrong.status, wrong.body.slice(0, 200)).toBe(422);
    expect(errCode(wrong.json as Record<string, unknown> | null)).toBe('WS_TOKEN_INVALID');
    const token = seed().productToken;
    const ok = await appApi<{ siteName?: string; release?: string; functions?: string[] }>('PUT', wsPath, { cookie: thanh.cookie, body: { token } });
    expect(ok.status, ok.body.slice(0, 300)).toBe(200);
    expect(String(ok.json.release), 'release').toMatch(/^5\.2/);
    for (const f of ['core_webservice_get_site_info', 'core_course_get_courses_by_field', 'core_course_create_courses']) expect(ok.json.functions ?? [], `function ${f}`).toContain(f);
    const after = await appApi<{ webServices?: { siteName?: string; release?: string } | null }>('GET', `/app-api/connections/${encodeURIComponent(conn)}`, { cookie: thanh.cookie });
    expect(String(after.json.webServices?.release ?? ''), 'connection webServices.release').toMatch(/^5\.2/);
    expect(after.body.includes(token), 'the token is never returned').toBe(false);
    test.info().annotations.push({ type: 'web services', description: `siteName ${ok.json.siteName}; release ${ok.json.release}; ${ok.json.functions?.length} functions` });
  });

  test('AC-T8-09 publish with createMoodleCourse: one Moodle course with idnumber cogniate:<courseId>:default:en, visible 0; a second publish → shellStatus exists, still one course', async () => {
    const thanh = await signIn(THANH);
    const shell = t8().shellApi!;
    const body = { connectionId: String(t5().connectionId), courseId: shell.courseId, versionId: shell.versionId, createMoodleCourse: {} };
    const first = await appApi<{ shellStatus?: string; shellError?: string | null; moodleCourse?: { id: number; idnumber: string; url: string } }>('POST', '/app-api/publications', { cookie: thanh.cookie, body });
    expect([200, 201], first.body.slice(0, 300)).toContain(first.status);
    expect(first.json.shellStatus, `shellError: ${first.json.shellError}`).toBe('created');
    expect(first.json.moodleCourse?.idnumber).toBe(idnumber(shell.courseId));
    let courses = await coursesByIdnumber(idnumber(shell.courseId));
    expect(courses, 'one Moodle course').toHaveLength(1);
    expect(courses[0]!.visible, 'visible=0').toBe(0);
    expect(courses[0]!.id).toBe(first.json.moodleCourse?.id);
    const second = await appApi<{ shellStatus?: string }>('POST', '/app-api/publications', { cookie: thanh.cookie, body });
    expect([200, 201], second.body.slice(0, 300)).toContain(second.status);
    expect(second.json.shellStatus).toBe('exists');
    courses = await coursesByIdnumber(idnumber(shell.courseId));
    expect(courses, 'still one course').toHaveLength(1);
  });

  test('AC-T8-10 (with token) the Publish dialog shows the checkbox; after publish the page links to the new Moodle course', async () => {
    const shell = t8().shellUi!;
    const dialog = await openPublishDialog(page, shell.courseId);
    const box = dialog.getByLabel(CHECKBOX);
    await expect(box, 'the checkbox with a token').toBeVisible();
    await box.check();
    await dialog.getByRole('button', { name: /^Publish/ }).last().click();
    const link = page.getByRole('link', { name: /Moodle course|Open in Moodle|course in Moodle/i }).or(page.locator(`a[href^="${urls.moodle}/course/view.php?id="]`)).first();
    await expect(link, 'a link to the Moodle course').toBeVisible({ timeout: 30_000 });
    const href = String(await link.getAttribute('href'));
    const courses = await coursesByIdnumber(idnumber(shell.courseId));
    expect(courses, 'one shell course').toHaveLength(1);
    expect(courses[0]!.visible).toBe(0);
    expect(href, 'the link opens that course').toBe(`${urls.moodle}/course/view.php?id=${courses[0]!.id}`);
  });
});
