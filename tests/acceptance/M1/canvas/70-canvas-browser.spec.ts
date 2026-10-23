// Canvas M1 browser rows (Chromium in the e2e container, acceptance profile, SIM): AC-M1-09 top-level and framed
// embedded behaviour, AC-M1-14 runtime name, AC-M1-22 status text, AC-M1-40 (b) frame refusal and (c) return fallback.
// Titles carry {case:<id>}; the M1 runner maps them to tests/acceptance/M1/canvas/manifest.json (kind "browser").
import type { BrowserContext, Page } from '@playwright/test';
import { LTI_CLAIM } from '../../lib/lti';
import { expect, test } from '../../lib/pw';
import {
  APP, CLOUD, canvasBinding, captureSecrets, check, completeHtml, embeddedPath, pause, pickerUrlFor, playPath,
  publicationFor, requireShas, scenario, unique, urls, waitForFrame,
} from './browser';

function caseTest(id: string, title: string, body: (f: { page: Page; context: BrowserContext }) => Promise<void>) {
  test(`[SIM] AC-${id.split('.')[0]} ${title} {case:${id}}`, async ({ page, context }) => {
    requireShas(); test.setTimeout(180_000);
    await body({ page, context });
  });
}

caseTest('M1-09.canvas.browser-top-level', 'a top-level Canvas learner launch passes the embedded page to the player without a click', async ({ page, context }) => {
  captureSecrets(context);
  const b = await canvasBinding(), pub = await publicationFor(b, 'html');
  const { loginUrl } = await scenario(b, { resource: pub.id, resourceLinkId: unique('rl') });
  const visited: string[] = [];
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) visited.push(f.url()); });
  await page.goto(loginUrl);
  await page.waitForURL((u) => u.origin === APP && playPath.test(u.pathname), { timeout: 30_000 });
  check(visited.some((u) => embeddedPath.test(new URL(u).pathname)), `The embedded page came first: ${visited.map((u) => new URL(u).pathname).join(' → ')}`);
  expect(page.url().includes('ltik')).toBe(false);
  await waitForFrame(page, (u) => u.origin === urls.content && u.pathname.startsWith('/rt/'));
});

caseTest('M1-09.canvas.browser-framed', 'the same Canvas launch inside a school-a frame stays framed with Open in a new window', async ({ page, context }) => {
  captureSecrets(context);
  const b = await canvasBinding(), pub = await publicationFor(b, 'html');
  const { loginUrl } = await scenario(b, { resource: pub.id, resourceLinkId: unique('rl') });
  const frameUrl = `${CLOUD.siteA}/__frame?url=${encodeURIComponent(loginUrl)}`;
  const csp: string[] = [];
  page.on('response', (r) => { if (embeddedPath.test(new URL(r.url()).pathname)) csp.push(String(r.headers()['content-security-policy'] ?? '')); });
  await page.goto(frameUrl);
  const frame = await waitForFrame(page, (u) => u.origin === APP && embeddedPath.test(u.pathname));
  await expect(frame.getByText('Open in a new window').first()).toBeVisible();
  await pause(3000);
  expect(embeddedPath.test(new URL(frame.url()).pathname), 'The framed page does not leave the frame').toBe(true);
  expect(page.url()).toBe(frameUrl);
  check(csp.some((v) => v.includes(`frame-ancestors ${CLOUD.siteA}`)), `frame-ancestors ${CLOUD.siteA}: ${csp.join(' | ')}`);
  await page.screenshot({ path: test.info().outputPath('canvas-framed-embedded.png') });
});

caseTest('M1-14.canvas.browser-runtime-name', 'the Canvas SCORM runtime returns an empty student name in the browser', async ({ page, context }) => {
  captureSecrets(context);
  const b = await canvasBinding(), pub = await publicationFor(b, 'scorm12');
  const { loginUrl } = await scenario(b, { resource: pub.id, resourceLinkId: unique('rl'),
    claims: { name: 'Private Canvas Learner', given_name: 'Private', family_name: 'Learner', email: 'private@canvas.example' } });
  await page.goto(loginUrl);
  await page.waitForURL((u) => u.origin === APP && playPath.test(u.pathname), { timeout: 30_000 });
  const sco = await waitForFrame(page, (u) => u.origin === urls.content && u.pathname.endsWith('/index.html'));
  const name = await sco.evaluate(() => {
    const api = (window.parent as any).API;
    api.LMSInitialize('');
    return api.LMSGetValue('cmi.core.student_name');
  });
  expect(name).toBe('');
  expect(await page.content()).not.toContain('Private Canvas Learner');
});

caseTest('M1-22.canvas.browser-status-text', 'the player status and return link name Canvas after a sent score', async ({ page, context }) => {
  captureSecrets(context);
  const b = await canvasBinding(), pub = await publicationFor(b, 'html');
  const { loginUrl } = await scenario(b, { resource: pub.id, resourceLinkId: unique('rl') });
  await page.goto(loginUrl);
  await page.waitForURL((u) => u.origin === APP && playPath.test(u.pathname), { timeout: 30_000 });
  const runtime = await waitForFrame(page, (u) => u.origin === urls.content && u.pathname.startsWith('/rt/'));
  await completeHtml(new URL(runtime.url()).pathname.split('/')[2], 7);
  await expect(page.getByText(/sent to Canvas/).first()).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('link', { name: 'Back to Canvas' })).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(/Moodle/);
  await page.screenshot({ path: test.info().outputPath('canvas-status-text.png') });
});

caseTest('M1-40.canvas.b-frame-refused', 'the picker framed by a third Canvas page host is refused by the browser, with no Cogniate error page', async ({ page, context }) => {
  captureSecrets(context);
  const b = await canvasBinding();
  await publicationFor(b, 'html');
  const picker = await pickerUrlFor(b);
  const messages: string[] = [];
  page.on('console', (m) => messages.push(m.text()));
  // Control: the site host may frame the picker, so the refusal below is about the host only.
  await page.goto(`${CLOUD.siteA}/__frame?url=${encodeURIComponent(picker)}`);
  const allowed = await waitForFrame(page, (u) => u.origin === APP && u.pathname.startsWith('/tool/picker/'));
  await expect(allowed.locator('input[type="radio"]').first()).toBeAttached({ timeout: 15_000 });
  await page.goto(`${CLOUD.siteB}/__frame?url=${encodeURIComponent(picker)}`);
  await pause(3000);
  for (const frame of page.frames().filter((f) => f !== page.mainFrame())) {
    const errorPage = await frame.locator('[data-error-code]').count().catch(() => 0);
    const radios = await frame.locator('input[type="radio"]').count().catch(() => 0);
    expect(errorPage, 'No Cogniate error page in the refused frame').toBe(0);
    expect(radios, 'The picker is not shown').toBe(0);
  }
  check(messages.some((m) => /frame-ancestors/i.test(m) || /Refused to frame/i.test(m)), `CSP refusal in the console: ${messages.join(' | ').slice(0, 400)}`);
  await page.screenshot({ path: test.info().outputPath('canvas-third-host-frame.png') });
});

caseTest('M1-40.canvas.c-return-fallback', 'a top-level launch with a third-host return URL opens and returns to the site root', async ({ page, context }) => {
  captureSecrets(context);
  const b = await canvasBinding(), pub = await publicationFor(b, 'html');
  const { loginUrl } = await scenario(b, { resource: pub.id, resourceLinkId: unique('rl'),
    claims: { [LTI_CLAIM + 'launch_presentation']: { document_target: 'iframe', return_url: `${CLOUD.siteB}/courses/1/assignments/2` } } });
  await page.goto(loginUrl);
  await page.waitForURL((u) => u.origin === APP && playPath.test(u.pathname), { timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'Back to Canvas' })).toHaveAttribute('href', `${CLOUD.siteA}/`);
});
