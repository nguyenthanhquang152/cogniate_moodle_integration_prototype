// M2 browser glue (QA-E2E). Texts below are the exact names and texts of docs/architecture/tasks/M2.md; the portal
// structure that M2 does not name is found by role and visible text only. Approval codes are masked in every screenshot.
import fs from 'node:fs';
import path from 'node:path';
import { test as base, expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { portalUser, QA_B, THANH, type Session } from '../../../acceptance/lib/app';
import { recordSecret } from '../../../acceptance/lib/lti';
import { TESTS_DIR } from '../../../acceptance/lib/paths';
import {
  APP, BLACKBOARD, CLOUD, admin, app, check, gate, issueGrant, ok, requireShas, session, unique, urls, type Grant, type Json,
} from '../../../acceptance/M1/canvas/browser';

export const TEXT = {
  moodleCard: 'Export SCORM packages and sync course content with your Moodle LMS.',
  canvasCard: 'Publish Cogniate courses to Canvas with LTI 1.3.',
  blackboardCard: 'Publish Cogniate courses to Blackboard Learn with LTI 1.3.',
  blackboardNotReady: 'Blackboard is not set up for this Cogniate service yet. Ask your Cogniate operator.',
  canvasUrlHelp: 'The address that teachers use, for example https://canvas.school.edu',
  canvasServiceHelp: 'The Canvas account domain, for example https://school.instructure.com. Leave empty if it is the same as the Canvas URL.',
  canvasStep2: 'Make a developer key in Canvas',
  canvasInline: 'Put a copy of the current public key in the JSON',
  canvasInlineText: 'Use this only when Canvas cannot reach Cogniate. If the Cogniate key changes, you must paste a new JSON in Canvas. Key id: ',
  canvasOperator: 'Ask your Cogniate operator for an approval code. The operator checks the request with your Canvas administrator first. The code works once and expires.',
  canvasStep4: 'Add a Cogniate course in Canvas',
  blackboardStep2: 'Register Cogniate in Blackboard Learn',
  blackboardOperator: 'Ask your Cogniate operator for an approval code. The operator checks the request with your Blackboard administrator first. The code works once and expires.',
  blackboardStep4: 'Add a Cogniate course in Blackboard',
  blackboardDisconnect: 'This switches off Cogniate for this Blackboard site only. Other schools are not affected. Cogniate items in Blackboard courses stop working, and connecting again later does not restore them.',
  publishTitle: 'Publish to an LMS',
  publishSelect: 'LMS connection',
  mbz: 'Moodle backup (.mbz) – Moodle only',
  shellCheckbox: 'Also create an empty Moodle course',
};
export const ERR = {
  rule: {
    1: 'Enter only the address, for example https://school.instructure.com. No path.',
    2: 'Enter a host name, not an IP address or localhost.',
    3: 'This is a Cogniate address. Enter your LMS address.',
    4: 'This is the LMS sign-in service, not your school site. Enter the address that teachers use.',
    5: 'This is an Instructure-hosted address. Choose an Instructure-hosted Canvas type.',
  } as Record<number, string>,
  invalidValues: 'Check the marked fields.',
  grantInvalid: 'This approval code is not valid, was used, or expired. Ask your Cogniate operator for a new code.',
  grantMismatch: 'The values do not match the approval. Check the marked fields, or ask your Cogniate operator.',
  grantInUse: 'Cogniate is already saving this connection. Wait a moment, then reload the page.',
  platformInUse: 'This Canvas developer key is already connected to Cogniate. Make a new developer key for this library.',
  deploymentInUse: 'This Blackboard site is already connected to Cogniate.',
  connectionNotPending: 'This connection changed while Cogniate saved it. Reload the page.',
  ltiServiceError: /Cogniate could not save the connection\. Try again\. Trace id: \S+/,
};
// Teacher steps (M2 "Teacher steps"); labels are unverified on real tenants, the step data marks them verified:false.
export const TEACHER = {
  canvas: ['Assignments', '+ Assignment', 'External Tool', 'Find', 'Cogniate', 'Load This Tool In A New Tab', 'Allowed Attempts', 'Save & Publish'],
  blackboardUltra: ['Course Content', 'Content Market', 'Cogniate'],
  blackboardOriginal: ['Build Content', 'Cogniate'],
};
export const FORBIDDEN_FIELDS = ['Client secret', 'Issuer', 'JWKS URL', 'Token URL', 'Authentication URL'];

const blocked: string[] = [];
export const test = base.extend<{ guard: void }>({
  guard: [async ({ context }, use, testInfo) => {
    blocked.length = 0;
    await context.route('**/*', (route) => {
      const host = new URL(route.request().url()).hostname;
      if (host.endsWith('.test')) return route.continue();
      blocked.push(route.request().url()); return route.abort('blockedbyclient');
    });
    await use();
    if (blocked.length) await testInfo.attach('blocked-external-requests.txt', { body: [...new Set(blocked)].join('\n'), contentType: 'text/plain' });
  }, { auto: true }],
});
export { expect };

/** One M2 row: `[SIM] AC-M2-NN <title> {case:M2-NN.<variant>}` (manifest tests/e2e/M2/manifest.json). */
export function m2Case(id: string, title: string, body: (f: { page: Page; context: BrowserContext; browser: Browser }) => Promise<void>, timeout = 240_000) {
  check(/^M2-\d{2}\.[a-z0-9-]+$/.test(id), `M2 case id ${id}`);
  test(`[SIM] AC-${id.split('.')[0]} ${title} {case:${id}}`, async ({ page, context, browser }) => {
    requireShas(); test.setTimeout(timeout);
    await body({ page, context, browser });
  });
}

// ---------------------------------------------------------------- portal session and navigation
export async function portalSignIn(page: Page, email: string) {
  await page.goto(`${APP}/signin`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(portalUser(email).password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 20_000 }), page.getByRole('button', { name: 'Sign in' }).click()]);
}
export async function libraryPage(browser: Browser, library: 'A' | 'B') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: process.env.QA_IGNORE_HTTPS_ERRORS === '1' });
  await context.route('**/*', (route) => new URL(route.request().url()).hostname.endsWith('.test') ? route.continue() : route.abort('blockedbyclient'));
  const page = await context.newPage();
  await portalSignIn(page, library === 'A' ? THANH : QA_B);
  return { context, page };
}
export async function integrations(page: Page) {
  await page.goto(`${APP}/integrations`);
  await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible();
  const pill = page.getByRole('button', { name: 'LMS Publishing', exact: true }).or(page.getByRole('tab', { name: 'LMS Publishing', exact: true }))
    .or(page.getByRole('link', { name: 'LMS Publishing', exact: true })).or(page.getByText('LMS Publishing', { exact: true }));
  await pill.first().click();
}
/** The smallest container that holds the card text and a Connect or Manage control. */
export function card(page: Page, text: string): Locator {
  const control = page.getByRole('button', { name: /^(Connect|Manage)$/ }).or(page.getByRole('link', { name: /^(Connect|Manage)$/ }));
  return page.locator('div, article, section, li', { hasText: text }).filter({ has: control }).last();
}
export const connectControl = (scope: Locator) =>
  scope.getByRole('button', { name: 'Connect', exact: true }).or(scope.getByRole('link', { name: 'Connect', exact: true }));
export const manageControl = (scope: Locator) =>
  scope.getByRole('button', { name: 'Manage', exact: true }).or(scope.getByRole('link', { name: 'Manage', exact: true }));
export const button = (scope: Page | Locator, name: string | RegExp) =>
  scope.getByRole('button', { name, exact: typeof name === 'string' }).or(scope.getByRole('link', { name, exact: typeof name === 'string' }));
/** Screenshot with every approval code input masked (AC-M3-07). */
export async function shot(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true,
    mask: [page.getByLabel('Approval code')], maskColor: '#000000' });
}
export function clipboardDenied(context: BrowserContext) {
  return context.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true,
      value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')), readText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) } });
  });
}
export const clipboardText = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

// ---------------------------------------------------------------- API facts that the browser rows compare with
export async function connections(s: Session) { const r = await app(s, 'GET', '/app-api/connections'); ok(r, 200, 'connections'); return r.json.connections as Json[]; }
export async function newestByName(s: Session, name: string, lms: string) {
  const list = (await connections(s)).filter((c) => c.name === name && c.lms === lms);
  check(list.length === 1, `Exactly one ${lms} connection named ${name} (found ${list.length})`);
  return list[0];
}
export async function connection(s: Session, id: string) { const r = await app(s, 'GET', `/app-api/connections/${id}`); ok(r, 200, 'connection'); return r.json; }
export async function canvasGrantFor(s: Session & { library: Json }, c: Json, clientId: string, deploymentId: string, purpose = 'initial'): Promise<Grant> {
  return issueGrant(s, c, { 'client-id': clientId, 'deployment-id': deploymentId, 'service-url': c.serviceUrl, purpose });
}
export async function blackboardGrantFor(s: Session & { library: Json }, c: Json, deploymentId: string): Promise<Grant> {
  return issueGrant(s, c, { 'client-id': BLACKBOARD.clientId, 'deployment-id': deploymentId });
}
/** After every submit: the approval code field is empty and the code is in no URL or web storage (AC-M2-05). */
export async function codeCleared(page: Page, code: string) {
  await expect(page.getByLabel('Approval code')).toHaveValue('');
  expect(page.url().includes(code)).toBe(false);
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(storage.includes(code)).toBe(false);
}
export async function fieldMarked(page: Page, label: string) {
  await expect(page.getByLabel(label, { exact: true })).toHaveAttribute('aria-invalid', 'true');
}
export async function noForbiddenFields(page: Page) {
  for (const name of FORBIDDEN_FIELDS) expect(await page.getByLabel(name, { exact: true }).count(), `No ${name} field`).toBe(0);
}
export async function gateFailNext(method: string, pathRegex: string) {
  ok(await gate('/reset', 'POST'), 200, 'gate reset');
  ok(await gate('/rules', 'POST', [{ id: unique('fail'), method, pathRegex, action: 'fail_before', times: 1 }]), 200, 'gate rules');
}
export async function gateClear() { ok(await gate('/reset', 'POST'), 200, 'gate reset'); }

// ---------------------------------------------------------------- wizards
export async function canvasStep1(page: Page, values: { name: string; site: string; service?: string; type?: string }) {
  await page.goto(`${APP}/integrations/canvas/connect`);
  await page.getByLabel('Connection name', { exact: true }).fill(values.name);
  await page.getByLabel('Canvas URL', { exact: true }).fill(values.site);
  if (values.service !== undefined) await page.getByLabel('Canvas service URL', { exact: true }).fill(values.service);
  await page.getByLabel('Canvas type', { exact: true }).selectOption({ label: values.type ?? 'Canvas cloud (simulation)' });
}
export async function blackboardStep1(page: Page, values: { name: string; site: string }) {
  await page.goto(`${APP}/integrations/blackboard/connect`);
  await page.getByLabel('Connection name', { exact: true }).fill(values.name);
  await page.getByLabel('Learn URL', { exact: true }).fill(values.site);
}
/** Step 1 "Next" creates the pending connection. The portal then opens /integrations/<lms>/<id> and shows the setup
 * step and the approval step together (there is no second "Next"; B-M3-01). */
export async function next(page: Page) { await button(page, 'Next').first().click(); }
export async function pendingWizard(page: Page, lms: 'canvas' | 'blackboard') {
  await page.waitForURL(new RegExp(`/integrations/${lms}/con_[^/?#]+$`), { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: lms === 'canvas' ? TEXT.canvasStep2 : TEXT.blackboardStep2 })).toBeVisible();
  await expect(page.getByLabel('Approval code', { exact: true })).toBeVisible();
}
export async function save(page: Page) { await button(page, 'Save').first().click(); }
export function errorNear(page: Page, text: string | RegExp) { return page.getByText(text).first(); }
/** Runs the Canvas wizard to the approval step and returns the pending connection (by its unique name). */
export async function canvasToStep3(page: Page, s: Session, values: { name?: string; site?: string; service?: string } = {}) {
  const name = values.name ?? unique('Canvas M2');
  await canvasStep1(page, { name, site: values.site ?? CLOUD.siteA, service: values.service });
  await next(page);
  await pendingWizard(page, 'canvas');
  return newestByName(s, name, 'canvas');
}
export async function blackboardToStep3(page: Page, s: Session, values: { name?: string; site?: string } = {}) {
  const name = values.name ?? unique('Blackboard M2');
  await blackboardStep1(page, { name, site: values.site ?? BLACKBOARD.siteA });
  await next(page);
  await pendingWizard(page, 'blackboard');
  return newestByName(s, name, 'blackboard');
}
export async function fillCanvasStep3(page: Page, values: { clientId: string; deploymentId: string; code: string }) {
  await page.getByLabel('Client ID', { exact: true }).fill(values.clientId);
  await page.getByLabel('Deployment ID', { exact: true }).fill(values.deploymentId);
  await page.getByLabel('Approval code', { exact: true }).fill(values.code);
}
export async function fillBlackboardStep3(page: Page, values: { deploymentId: string; code: string }) {
  await page.getByLabel('Deployment ID', { exact: true }).fill(values.deploymentId);
  await page.getByLabel('Approval code', { exact: true }).fill(values.code);
}
/** The real course zips from COURSE_FIXTURES_DIR (copied into tests/fixtures/courses by the runner). */
export const COURSE_ZIP = {
  html: path.join(TESTS_DIR, 'fixtures', 'courses', 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip'),
  scorm: path.join(TESTS_DIR, 'fixtures', 'courses', 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip'),
};
export function requireCourseZip(file: string) { check(fs.existsSync(file), `Course fixture missing: ${file} (set COURSE_FIXTURES_DIR for the runner)`); }
export { admin, recordSecret, session, urls };
