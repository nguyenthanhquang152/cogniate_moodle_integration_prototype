// T6: literal titles (no markup runs) and accessibility. Source: tasks/T6.md AC-T6-13, AC-T6-09; security §6 (output
// escaping). AC-T6-13 uses the course of SETUP-T6 (title `<b>x</b>`, manifest title `<img src=x onerror=…>`).
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { APP, QA_B, THANH } from '../lib/app';
import { publicUrls } from '../lib/env';
import { loadState } from '../lib/lti';
import { PORTAL_ROUTES, portalSignIn } from '../lib/portal';
import { expect, test } from '../lib/pw';
import { t5 } from '../lib/t5';

const urls = publicUrls();
const XSS_COURSE_TITLE = '<b>x</b>';
const XSS_MANIFEST_TITLE = '<img src=x onerror="window.__xss=1">';

async function noMarkupRan(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const p: string[] = [];
    if ((window as unknown as { __xss?: unknown }).__xss !== undefined) p.push('window.__xss is set');
    if (document.querySelector('img[src="x"]')) p.push('an <img src="x"> element exists');
    if (Array.from(document.querySelectorAll('b')).some((b) => (b.textContent ?? '').trim() === 'x')) p.push('a <b>x</b> element exists');
    return p;
  });
}

test('AC-T6-13 `<b>x</b>` and the manifest title show literally in Courses, Publish and Results; window.__xss stays undefined', async ({ page }) => {
  test.setTimeout(120_000);
  const t6 = loadState('T6') as { xssCourseId?: string; xssPublicationId?: string };
  expect(t6.xssCourseId && t6.xssPublicationId, 'SETUP-T6 made the course').toBeTruthy();
  await portalSignIn(page, THANH);
  const problems: string[] = [];
  const check = async (where: string, texts: string[]) => {
    const body = await page.locator('body').innerText();
    for (const t of texts) if (!body.includes(t)) problems.push(`${where}: "${t}" is not shown literally`);
    problems.push(...(await noMarkupRan(page)).map((x) => `${where}: ${x}`));
  };

  await page.goto(`${APP}${PORTAL_ROUTES.courses}`);
  await page.getByText(XSS_COURSE_TITLE, { exact: false }).first().waitFor({ timeout: 15_000 }).catch(() => undefined);
  await check('Courses', [XSS_COURSE_TITLE]);
  await page.goto(`${APP}${PORTAL_ROUTES.course(String(t6.xssCourseId))}`);
  await page.waitForLoadState('networkidle');
  await check('Course report', [XSS_COURSE_TITLE, XSS_MANIFEST_TITLE]);
  await page.getByRole('button', { name: /Publish to an LMS/ }).or(page.getByRole('link', { name: /Publish to an LMS/ })).first().click();
  await page.getByRole('dialog').waitFor();
  await check('Publish dialog', [XSS_COURSE_TITLE]);
  await page.keyboard.press('Escape');
  await page.goto(`${APP}${PORTAL_ROUTES.results(String(t6.xssPublicationId))}`);
  await page.waitForLoadState('networkidle');
  await check('Results', [XSS_COURSE_TITLE]);
  expect(problems).toEqual([]);
});

test('AC-T6-09 axe: no serious or critical violation on Integrations, wizard, Courses, Publish dialog, Results; wizard and dialog work by keyboard; focus returns to the opener', async ({ page }) => {
  test.setTimeout(240_000);
  await portalSignIn(page, THANH);
  const st = t5();
  const t6 = loadState('T6') as { uiScormCourseId?: string };
  const courseId = String(t6.uiScormCourseId ?? st.scorm?.courseId);
  const violations: string[] = [];
  const scan = async (label: string, include?: string) => {
    const builder = new AxeBuilder({ page });
    if (include) builder.include(include);
    const r = await builder.analyze();
    for (const v of r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
      violations.push(`${label}: ${v.id} (${v.impact}) ×${v.nodes.length} — ${v.help}`);
    }
  };
  await page.goto(`${APP}${PORTAL_ROUTES.integrations}`);
  await page.waitForLoadState('networkidle');
  await scan('Integrations');
  await page.goto(`${APP}${PORTAL_ROUTES.connect}`);
  await page.waitForLoadState('networkidle');
  await scan('Connect wizard');
  await page.goto(`${APP}${PORTAL_ROUTES.courses}`);
  await page.waitForLoadState('networkidle');
  await scan('Courses');
  await page.goto(`${APP}${PORTAL_ROUTES.course(courseId)}`);
  await page.getByRole('button', { name: /Publish to an LMS/ }).or(page.getByRole('link', { name: /Publish to an LMS/ })).first().click();
  await page.getByRole('dialog').waitFor();
  // A native <dialog> has the dialog role without the attribute.
  await scan('Publish dialog', (await page.locator('[role="dialog"]').count()) ? '[role="dialog"]' : 'dialog[open]');
  await page.keyboard.press('Escape');
  await page.goto(`${APP}${PORTAL_ROUTES.results(String(st.scormPublicationId))}`);
  await page.waitForLoadState('networkidle');
  await scan('Results');
  expect(violations).toEqual([]);

  // Keyboard only: the Publish dialog opens with Enter, closes with Esc, and focus returns to its opener.
  await page.goto(`${APP}${PORTAL_ROUTES.course(courseId)}`);
  await routeFocusSettled(page);
  const opener = page.getByRole('button', { name: /Publish to an LMS/ }).or(page.getByRole('link', { name: /Publish to an LMS/ })).first();
  await tabTo(page, opener);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(opener, 'focus is back on "Publish to an LMS"').toBeFocused();

  // Keyboard only: the wizard (QA Library B, Automatic) reaches the registration URL step.
  await portalSignIn(page, QA_B);
  await page.goto(`${APP}${PORTAL_ROUTES.connect}`);
  await routeFocusSettled(page, 'Connect Moodle');
  await tabTo(page, page.getByLabel(/url/i).first());
  await page.keyboard.type(urls.moodle);
  await expect(page.locator(':focus'), 'the typed site URL stays in the focused field').toHaveValue(urls.moodle);
  await tabTo(page, page.getByLabel(/name/i).first());
  await page.keyboard.type(`QA keyboard ${Date.now().toString(36)}`);
  await expect(page.locator(':focus'), 'the typed name stays in the focused field').toHaveValue(/^QA keyboard [0-9a-z]+$/);
  const auto = page.getByRole('radio', { name: /Automatic \(recommended\)/ });
  await tabTo(page, auto.or(page.getByRole('radio', { name: /^Manual/ })).first());
  if (!(await auto.isChecked())) await page.keyboard.press('ArrowUp');
  if (!(await auto.isChecked())) await page.keyboard.press('Space');
  expect(await auto.isChecked(), '"Automatic (recommended)" chosen by keyboard').toBe(true);
  await tabTo(page, page.getByRole('button', { name: /continue|next|create|connect/i }).first());
  await page.keyboard.press('Enter');
  await expect(page.getByText(new RegExp(`${urls.lti.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/lti/register/`)).first().or(page.locator('input[value*="/lti/register/"]')).first()).toBeVisible({ timeout: 15_000 });
});

/** The portal moves focus to the page heading after a route change (App.tsx Frame: a content observer and one
 *  animation frame). Wait for the move, then for one frame, so no later move can take keystrokes. */
async function routeFocusSettled(page: Page, heading?: string) {
  await expect(page.getByRole('heading', heading ? { level: 1, name: heading, exact: true } : { level: 1 }), heading ? `the "${heading}" heading has the focus` : 'the page heading has the focus').toBeFocused();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

/** Press Tab until `target` has the focus (at most 60 times). */
async function tabTo(page: Page, target: import('@playwright/test').Locator): Promise<void> {
  const handle = await target.elementHandle({ timeout: 10_000 });
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate((el) => document.activeElement === el, handle)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('the element did not get the focus with Tab');
}
