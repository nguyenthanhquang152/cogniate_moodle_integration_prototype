// Moodle 5.2.4 dynamic registration UI (T3b onward). Markup from mod/lti/templates:
// - tool_configure.mustache: input#tool-url, button#tool-create-button ("Add LTI Advantage"); the JS opens
//   <iframe src="startltiadvregistration.php?url=…">.
// - registration_upgrade_choice_page.mustache (shown in that frame when a tool with the same domain exists):
//   one "update" button per tool with data-href "…&type=<id>", and "register as new" with "…&type=0".
// - tool_card.mustache: <div class="tool-card" data-type-id="…">; a Pending tool has a.activate.
// QA stands in for {PUBLIC_APP_URL}/tool/register (T3b scope): a route holds the frame there, the test drives the API,
// and the test then puts the close page (the `html` of /complete) into the frame.
import type { BrowserContext, Frame, Page, Route } from '@playwright/test';
import { publicUrls } from './env';
import { moodleLogin } from './moodle-ui';
import type { MoodleUser } from './seed';

const urls = publicUrls();
export const TOOL_REGISTER = `${urls.app}/tool/register`;

export type RegistrationChoice = 'new' | { updateTypeId: number };

export interface HeldRegistration {
  /** The URL that Moodle's frame reached on the app (with registrationId and the passthrough params). */
  toolUrl: string;
  registrationId: string;
  ref: string | null;
  /** True if Moodle showed the "update or register new" page first. */
  sawChoice: boolean;
  frame: Frame;
  /** The app's answer for the frame URL (hold: false only): status, headers, body. */
  response?: { status: number; headers: Record<string, string>; body: string };
  release: () => Promise<void>;
}

export async function openManageTools(page: Page, admin: MoodleUser): Promise<void> {
  await moodleLogin(page, urls.moodle, admin.username, admin.password);
  await page.goto(`${urls.moodle}/mod/lti/toolconfigure.php`);
  await page.locator('#tool-url').waitFor();
}

/** Paste a registration URL, click "Add LTI Advantage", answer the choice page, and hold the frame at the app. */
export async function startRegistration(
  context: BrowserContext,
  page: Page,
  registrationUrl: string,
  choice: RegistrationChoice = 'new',
  timeoutMs = 45_000,
  { hold = true }: { hold?: boolean } = {},
): Promise<HeldRegistration> {
  let toolUrl: string | undefined;
  let response: HeldRegistration['response'];
  const matcher = (u: URL) => u.href.startsWith(TOOL_REGISTER);
  const handler = async (route: Route) => {
    toolUrl ??= route.request().url();
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<p id="qa-hold">QA holds this registration.</p>' });
  };
  // hold: false → the real app page loads in Moodle's frame; QA records its answer.
  const onResponse = async (r: import('@playwright/test').Response) => {
    if (toolUrl || !r.url().startsWith(TOOL_REGISTER) || r.request().method() !== 'GET') return;
    toolUrl = r.url();
    response = { status: r.status(), headers: await r.allHeaders(), body: await r.text().catch(() => '') };
  };
  if (hold) await context.route(matcher, handler);
  else context.on('response', onResponse);
  await page.locator('#tool-url').fill(registrationUrl);
  await page.locator('#tool-create-button').click();

  const deadline = Date.now() + timeoutMs;
  let sawChoice = false;
  while ((!toolUrl || (!hold && !response)) && Date.now() < deadline) {
    const reg = page.frames().find((f) => /startltiadvregistration\.php/.test(f.url()));
    if (reg && !sawChoice) {
      const buttons = reg.locator('button[data-href*="startltiadvregistration.php"]');
      if ((await buttons.count().catch(() => 0)) > 0) {
        sawChoice = true;
        const wanted = choice === 'new' ? 'button[data-href$="&type=0"]' : `button[data-href$="&type=${choice.updateTypeId}"]`;
        await reg.locator(wanted).first().click();
      }
    }
    await page.waitForTimeout(250);
  }
  const release = async () => {
    if (hold) await context.unroute(matcher, handler);
    else context.off('response', onResponse);
  };
  if (!toolUrl || (!hold && !response)) {
    await release();
    throw new Error(`Moodle's registration frame did not reach ${TOOL_REGISTER} within ${timeoutMs} ms`);
  }
  let frame = page.frames().find((f) => f.url().startsWith(TOOL_REGISTER));
  for (let i = 0; !frame && i < 40; i++) {
    await page.waitForTimeout(250);
    frame = page.frames().find((f) => f.url().startsWith(TOOL_REGISTER));
  }
  if (!frame) throw new Error('no frame at the app registration URL');
  if (!hold) await frame.waitForLoadState('load');
  const q = new URL(toolUrl).searchParams;
  return {
    toolUrl,
    registrationId: q.get('registrationId') ?? '',
    ref: q.get('ref'),
    sawChoice,
    frame,
    response,
    release,
  };
}

/** Put the close page (the `html` that /complete returns) into Moodle's frame, and wait for the tool list. */
export async function finishInFrame(page: Page, held: HeldRegistration, html: string): Promise<void> {
  await held.frame.setContent(html);
  await page.locator('#tool-list-container').waitFor();
  await held.release();
}

export interface ToolSettings {
  name: string;
  toolUrl: string;
  keysetUrl: string;
  loginUrl: string;
  deepLinking: boolean;
  gradeSync: string;
  sendName: string;
  sendEmail: string;
  clientId: string;
  pending: boolean;
}

/** Type id of the tool card with this exact name (Manage tools page). */
export async function toolTypeId(page: Page, name: string): Promise<number | undefined> {
  await page.goto(`${urls.moodle}/mod/lti/toolconfigure.php`);
  const card = page.locator('.tool-card', { hasText: name }).first();
  await card.waitFor({ timeout: 15_000 }).catch(() => undefined);
  if (!(await card.count())) return undefined;
  return Number(await card.getAttribute('data-type-id'));
}

/** Settings of a tool, read from its edit form (mod/lti/typessettings.php) and its card. */
export async function toolSettings(page: Page, typeId: number): Promise<ToolSettings> {
  await page.goto(`${urls.moodle}/mod/lti/toolconfigure.php`);
  const card = page.locator(`.tool-card[data-type-id="${typeId}"]`);
  await card.waitFor({ timeout: 15_000 });
  const pending = (await card.locator('a.activate').count()) > 0;
  const sesskey = await page.evaluate(() => (window as unknown as { M?: { cfg?: { sesskey?: string } } }).M?.cfg?.sesskey ?? '');
  await page.goto(`${urls.moodle}/mod/lti/typessettings.php?action=update&id=${typeId}&sesskey=${sesskey}`);
  const value = (sel: string) => page.locator(sel).inputValue().catch(() => '');
  return {
    name: await value('#id_lti_typename'),
    toolUrl: await value('#id_lti_toolurl'),
    keysetUrl: await value('#id_lti_publickeyset'),
    loginUrl: await value('#id_lti_initiatelogin'),
    deepLinking: await page.locator('#id_lti_contentitem').isChecked().catch(() => false),
    gradeSync: await value('#id_ltiservice_gradesynchronization'),
    sendName: await value('#id_lti_sendname'),
    sendEmail: await value('#id_lti_sendemailaddr'),
    clientId: await value('#id_lti_clientid_disabled'),
    pending,
  };
}

/** All type ids of tool cards with this exact name. */
export async function toolTypeIds(page: Page, name: string): Promise<number[]> {
  await page.goto(`${urls.moodle}/mod/lti/toolconfigure.php`);
  await page.locator('#tool-list-container .tool-card').first().waitFor({ timeout: 15_000 }).catch(() => undefined);
  return page.evaluate((n) => {
    return Array.from(document.querySelectorAll('.tool-card'))
      .filter((c) => (c.querySelector('.tool-card-header, h4, .name')?.textContent ?? c.textContent ?? '').includes(n))
      .map((c) => Number(c.getAttribute('data-type-id')));
  }, name);
}

export interface ToolDetails {
  platformId: string;
  clientId: string;
  deploymentId: string;
  publicKeysetUrl: string;
  accessTokenUrl: string;
  authRequestUrl: string;
}

/** The six "Tool configuration details" values that the admin sends back (tool card data attributes). */
export async function toolDetails(page: Page, typeId: number): Promise<ToolDetails> {
  await page.goto(`${urls.moodle}/mod/lti/toolconfigure.php`);
  const card = page.locator(`.tool-card[data-type-id="${typeId}"]`);
  await card.waitFor({ timeout: 15_000 });
  const a = async (n: string) => (await card.getAttribute(n)) ?? '';
  return {
    platformId: await a('data-platformid'),
    clientId: await a('data-clientid'),
    deploymentId: await a('data-deploymentid'),
    publicKeysetUrl: await a('data-publickeyseturl'),
    accessTokenUrl: await a('data-accesstokenurl'),
    authRequestUrl: await a('data-authrequesturl'),
  };
}

/**
 * Checks an app error page that Moodle's registration frame shows (T4b1 AC-T4-09, -30, -33): code and trace markers,
 * error pages use `frame-ancestors https:` (security §5), and the frame really displays it (not blocked).
 */
export async function frameErrorProblems(held: HeldRegistration, code: string, test: string): Promise<string[]> {
  const { checkErrorPage } = await import('./lti');
  if (!held.response) return ['no app response recorded for the frame'];
  const problems = checkErrorPage(held.response, code, { statuses: [400, 403, 404, 409, 410], test, endpoint: 'tool' });
  const csp = held.response.headers['content-security-policy'] ?? '';
  if (!/frame-ancestors[^;]*\bhttps:/.test(csp)) problems.push(`CSP frame-ancestors is not "https:" (${csp || 'no CSP'})`);
  const visible = await held.frame.locator(`[data-error-code="${code}"]`).isVisible().catch(() => false);
  if (!visible) problems.push('the frame does not display the error page');
  return problems;
}

/** After a real "Connect" click: the registration dialog closes by itself and the tool list is shown again. */
export async function waitForDialogClosed(page: Page, timeoutMs = 20_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const open = page.frames().some((f) => f.url().startsWith(TOOL_REGISTER) || /startltiadvregistration\.php/.test(f.url()));
    if (!open) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

/** Manage tools: click "Activate" on a Pending tool and wait until it is no longer Pending. */
export async function activateTool(page: Page, typeId: number): Promise<void> {
  await page.goto(`${urls.moodle}/mod/lti/toolconfigure.php`);
  const card = page.locator(`.tool-card[data-type-id="${typeId}"]`);
  await card.waitFor({ timeout: 15_000 });
  const activate = card.locator('a.activate');
  if (await activate.count()) {
    await activate.click();
    await page.waitForFunction((id) => !document.querySelector(`.tool-card[data-type-id="${id}"] a.activate`), typeId, { timeout: 20_000 });
  }
}

/** Edit a tool: "Tool configuration usage" (lti_coursevisible) and "Default launch container" (lti_launchcontainer). */
export async function setToolOptions(page: Page, typeId: number, { coursevisible, launchcontainer }: { coursevisible?: '0' | '1' | '2'; launchcontainer?: '2' | '3' | '4' | '5' }): Promise<void> {
  await page.goto(`${urls.moodle}/mod/lti/toolconfigure.php`);
  const sesskey = await page.evaluate(() => (window as unknown as { M?: { cfg?: { sesskey?: string } } }).M?.cfg?.sesskey ?? '');
  await page.goto(`${urls.moodle}/mod/lti/typessettings.php?action=update&id=${typeId}&sesskey=${sesskey}`);
  const expand = page.locator('a.collapseexpand');
  if (await expand.count()) await expand.first().click();
  if (coursevisible) await page.locator('#id_lti_coursevisible').selectOption(coursevisible);
  if (launchcontainer) await page.locator('#id_lti_launchcontainer').selectOption(launchcontainer);
  await Promise.all([page.waitForURL(/toolconfigure\.php/, { timeout: 30_000 }), page.locator('#id_submitbutton').click()]);
}
