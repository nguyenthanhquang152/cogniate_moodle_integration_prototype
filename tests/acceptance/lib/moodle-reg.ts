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
): Promise<HeldRegistration> {
  let toolUrl: string | undefined;
  const matcher = (u: URL) => u.href.startsWith(TOOL_REGISTER);
  const handler = async (route: Route) => {
    toolUrl ??= route.request().url();
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<p id="qa-hold">QA holds this registration.</p>' });
  };
  await context.route(matcher, handler);
  await page.locator('#tool-url').fill(registrationUrl);
  await page.locator('#tool-create-button').click();

  const deadline = Date.now() + timeoutMs;
  let sawChoice = false;
  while (!toolUrl && Date.now() < deadline) {
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
  if (!toolUrl) {
    await context.unroute(matcher, handler);
    throw new Error(`Moodle's registration frame did not reach ${TOOL_REGISTER} within ${timeoutMs} ms`);
  }
  const frame = page.frames().find((f) => f.url().startsWith(TOOL_REGISTER));
  if (!frame) throw new Error('no frame at the app registration URL');
  const q = new URL(toolUrl).searchParams;
  return {
    toolUrl,
    registrationId: q.get('registrationId') ?? '',
    ref: q.get('ref'),
    sawChoice,
    frame,
    release: () => context.unroute(matcher, handler),
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
