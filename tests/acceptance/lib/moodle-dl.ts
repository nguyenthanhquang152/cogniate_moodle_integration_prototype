// Moodle 5.2.4 UI flows for Deep Linking and manual tools (T3a onward).
// - "Add an activity → <tool>" opens course/modedit.php?add=lti&typeid=<typeId>&course=<id> (Moodle 5.2.4 chooser link,
//   mod/lti/lib.php: `typeid`; with `type` Moodle refuses: "manual creation of tools … no longer supported"); QA opens it directly
//   (the chooser UI is covered in T7). "Select content" is button #id_selectcontent (mod/lti/mod_form.php).
// - QA stands in for the app page {PUBLIC_APP_URL}/tool/deep-link (T3a design note). Playwright routes do not see the
//   redirected GET to that page (the 303 of /lti/launch), so QA routes the id_token POST that Moodle's auth.php page
//   sends to /lti/launch (a new navigation in the frame), sends it itself from Node with the state cookie of the
//   login, reads the ltik from the 303 Location, calls the LTI API, and fulfils the POST with a short QA page. Then the
//   modedit page posts the signed JWT into Moodle's dialog iframe (target "contentitem-page-iframe"). Why from the
//   parent: a document made by route.fulfill cannot navigate a frame to another origin (checked in the e2e image), and
//   a same-origin POST carries Moodle's SameSite=Lax session cookie. The browser never opens the app page.
// - Manual tool form: mod/lti/typessettings.php (field names from mod/lti/edit_form.php).
import type { BrowserContext, Page, Response, Route } from '@playwright/test';
import { publicUrls } from './env';
import { ACCOUNT, apiKey, auth, type ApiResult, LAUNCH_URL, LOGIN_URL, ltiApi, recordSecret } from './lti';
import { postLaunchFromNode, stateCookieHeader } from './moodle-launch';
import { callWs } from './moodle-ws';
import { moodleLogin } from './moodle-ui';
import { type MoodleUser, seed } from './seed';

const urls = publicUrls();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export interface DeepLinkRun {
  /** The 303 Location of the deep-linking launch ({app}/tool/deep-link?ltik=…): the URL that Moodle's frame would open. */
  toolUrl: string;
  ltik: string;
  idtoken: ApiResult;
  dl: ApiResult<{ message?: string; target?: string }>;
  /** Time (ms) when the /api/deeplinking response arrived. */
  dlAt: number;
  nameAfter: string;
  saved: boolean;
}

/** The body that deepLinkActivity sends to POST /api/deeplinking (the AC-T3-07 body); AC-T3-09 sends the same. */
export function deepLinkBody(contentItems: Record<string, unknown>[]): Record<string, unknown> {
  return { contentItems, options: { message: 'QA deep link' } };
}

export async function deepLinkActivity(
  context: BrowserContext,
  teacher: MoodleUser,
  courseId: number,
  typeId: number,
  contentItems: Record<string, unknown>[],
  { save = true, timeoutMs = 45_000 }: { save?: boolean; timeoutMs?: number } = {},
): Promise<DeepLinkRun> {
  const page = await context.newPage();
  await moodleLogin(page, urls.moodle, teacher.username, teacher.password);
  let run: Omit<DeepLinkRun, 'nameAfter' | 'saved'> | undefined;
  let launchProblem = '';
  let pendingReturn: { target: string; jwt: string } | undefined;
  let returned = false;
  const loginCookies: string[] = [];
  const onResponse = async (r: Response) => {
    if (!r.url().startsWith(LOGIN_URL) || r.status() < 300 || r.status() >= 400) return;
    for (const h of await r.headersArray()) if (h.name.toLowerCase() === 'set-cookie') loginCookies.push(h.value);
  };
  const matcher = (u: URL) => u.href.startsWith(LAUNCH_URL);
  const handler = async (route: Route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.continue();
    const form = new URLSearchParams(req.postData() ?? '');
    const fields = { id_token: form.get('id_token') ?? '', state: form.get('state') ?? '' };
    recordSecret('id_token', fields.id_token);
    recordSecret('state', fields.state);
    const until = Date.now() + 3_000;
    while (!stateCookieHeader(loginCookies) && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
    const launch = await postLaunchFromNode(fields, stateCookieHeader(loginCookies)).catch((e: Error) => ({ status: 0, body: e.message, location: '' }));
    const toolUrl = launch.location;
    const ltik = toolUrl ? (new URL(toolUrl).searchParams.get('ltik') ?? '') : '';
    if (launch.status !== 303 || !ltik) {
      launchProblem = `the launch POST gave HTTP ${launch.status} (Location ${toolUrl || 'none'}): ${launch.body.slice(0, 200)}`;
      return route.fulfill({ status: 200, contentType: 'text/html', body: `<p>QA: ${esc(launchProblem)}</p>` });
    }
    recordSecret('ltik', ltik);
    const key = apiKey(ACCOUNT);
    const idtoken = await ltiApi('GET', '/api/idtoken', { authorization: auth.ltik(key, ltik) });
    const dl = await ltiApi<{ message?: string; target?: string }>('POST', '/api/deeplinking', {
      authorization: auth.ltik(key, ltik),
      body: deepLinkBody(contentItems),
    });
    run = { toolUrl, ltik, idtoken, dl, dlAt: Date.now() };
    if (dl.status !== 200 || !dl.json?.message || !dl.json.target) {
      return route.fulfill({ status: 200, contentType: 'text/html', body: `<p>QA: /api/deeplinking gave HTTP ${dl.status}</p>` });
    }
    recordSecret('id_token', dl.json.message);
    pendingReturn = { target: dl.json.target, jwt: dl.json.message };
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>QA: the deep-linking response is ready.</p>' });
  };
  context.on('response', onResponse);
  await context.route(matcher, handler);
  try {
    await page.goto(`${urls.moodle}/course/modedit.php?add=lti&typeid=${typeId}&course=${courseId}&section=0&return=0`);
    await page.locator('#id_selectcontent').click();
    const title = String(contentItems[0]?.title ?? '');
    const deadline = Date.now() + timeoutMs;
    let nameAfter = '';
    while (Date.now() < deadline) {
      if (pendingReturn && !returned) {
        // The modedit page (a real Moodle document) posts the JWT into Moodle's dialog iframe, as Moodle's own form
        // does (contentitem.mustache: target="contentitem-page-iframe"). Same origin, so the session cookie goes with it.
        returned = true;
        await page.evaluate(({ target, jwt }) => {
          const f = document.createElement('form');
          f.method = 'post';
          f.action = target;
          f.target = 'contentitem-page-iframe';
          const i = document.createElement('input');
          i.type = 'hidden';
          i.name = 'JWT';
          i.value = jwt;
          f.appendChild(i);
          document.body.appendChild(f);
          f.submit();
        }, pendingReturn);
      }
      nameAfter = await page.locator('#id_name').inputValue().catch(() => '');
      if (launchProblem || (run && (nameAfter === title || run.dl.status !== 200))) break;
      await page.waitForTimeout(250);
    }
    if (!run) throw new Error(launchProblem || `Moodle's content frame did not send the id_token POST to ${LAUNCH_URL} within ${timeoutMs} ms`);
    let saved = false;
    if (save && nameAfter === title) {
      await Promise.all([page.waitForURL(/\/course\/view\.php/, { timeout: 30_000 }), page.locator('#id_submitbutton2').click()]);
      saved = true;
    }
    return { ...run, nameAfter, saved };
  } finally {
    context.off('response', onResponse);
    await context.unroute(matcher, handler);
    await page.close().catch(() => undefined);
  }
}

/** The course module id of the newest activity with this name (QA oracle core_course_get_contents). */
export async function cmidByName(courseId: number, name: string): Promise<number | undefined> {
  const sections = await callWs<{ modules: { id: number; name: string; modname: string }[] }[]>(seed().oracleToken, 'core_course_get_contents', { courseid: courseId });
  const mods = sections.flatMap((s) => s.modules).filter((m) => m.name === name && m.modname === 'lti');
  return mods.length ? Math.max(...mods.map((m) => m.id)) : undefined;
}

export interface ManualTool {
  typeId: number;
  clientId: string;
}

/**
 * Site administration > Plugins > Activity modules > External tool > Manage tools > "configure a tool manually",
 * with the values of the cogniate account (ADR-009 manual values). Returns the type id and the client id.
 */
export interface ManualToolOptions {
  /** "Supports Deep Linking" with the content selection URL (ADR-009 manual values). Default false. */
  deepLinking?: boolean;
  /** "Accept grades from the tool": '1' always, '2' delegate to teacher (ADR-009). Default '1'. */
  acceptGrades?: '1' | '2';
  /** IMS LTI Names and Role Provisioning on. Default false. */
  memberships?: boolean;
  /**
   * IMS LTI Assignment and Grade Services (ltiservice_gradesynchronization): '1' = grade sync only (AGS scopes score,
   * result.readonly, lineitem.readonly), '2' = grade sync and column management (adds lineitem). Default '2'.
   */
  gradeSync?: '1' | '2';
}

export async function createManualTool(page: Page, admin: MoodleUser, name: string, opts: ManualToolOptions = {}): Promise<ManualTool> {
  await moodleLogin(page, urls.moodle, admin.username, admin.password);
  await page.goto(`${urls.moodle}/mod/lti/toolconfigure.php`);
  await page.getByRole('link', { name: /configure a tool manually/i }).click();
  await page.waitForURL(/typessettings\.php/);
  const expand = page.locator('a.collapseexpand');
  if (await expand.count()) await expand.first().click();
  const lti = `${urls.lti}`;
  await page.locator('#id_lti_typename').fill(name);
  await page.locator('#id_lti_toolurl').fill(`${lti}/lti/launch/${ACCOUNT}`);
  await page.locator('#id_lti_ltiversion').selectOption('1.3.0');
  await page.locator('#id_lti_keytype').selectOption('JWK_KEYSET');
  await page.locator('#id_lti_publickeyset').fill(`${lti}/lti/keys/${ACCOUNT}`);
  await page.locator('#id_lti_initiatelogin').fill(`${lti}/lti/login/${ACCOUNT}`);
  await page.locator('#id_lti_redirectionuris').fill(`${lti}/lti/launch/${ACCOUNT}`);
  await page.locator('#id_lti_coursevisible').selectOption('2');
  await page.locator('#id_lti_launchcontainer').selectOption('4');
  await page.locator('#id_ltiservice_gradesynchronization').selectOption(opts.gradeSync ?? '2');
  await page.locator('#id_lti_sendname').selectOption('0');
  await page.locator('#id_lti_sendemailaddr').selectOption('0');
  await page.locator('#id_lti_acceptgrades').selectOption(opts.acceptGrades ?? '1');
  if (opts.deepLinking) {
    await page.locator('#id_lti_contentitem').check();
    await page.locator('#id_lti_toolurl_ContentItemSelectionRequest').fill(`${lti}/lti/launch/${ACCOUNT}`);
  }
  if (opts.memberships) await page.locator('#id_ltiservice_memberships').selectOption('1');
  await Promise.all([page.waitForURL(/toolconfigure\.php|section=modsettinglti/, { timeout: 30_000 }), page.locator('#id_submitbutton').click()]);
  if (!/toolconfigure\.php/.test(page.url())) await page.goto(`${urls.moodle}/mod/lti/toolconfigure.php`);

  // Find the new tool: mod/lti/templates/tool_card.mustache renders <div class="tool-card" data-type-id="{{id}}">.
  // Another tool can have the same name (a dynamic registration of the same library names its tool the same way),
  // so take the newest card with this name (the highest type id).
  const cards = page.locator('.tool-card', { hasText: name });
  await cards.first().waitFor({ timeout: 15_000 });
  const ids = (await cards.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-type-id'))))).filter((n) => n > 0);
  const typeId = ids.length ? Math.max(...ids) : 0;
  if (!typeId) throw new Error(`tool "${name}" not found on Manage tools`);
  await page.goto(`${urls.moodle}/mod/lti/typessettings.php?action=update&id=${typeId}&sesskey=${await sesskey(page)}`);
  const clientId = await page.locator('#id_lti_clientid_disabled').inputValue();
  return { typeId, clientId };
}

async function sesskey(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { M?: { cfg?: { sesskey?: string } } }).M?.cfg?.sesskey ?? '');
}

/** Adds an activity with a tool type to a course (accept grades, maximum grade 100) and returns its cmid. */
export async function addToolActivity(page: Page, teacher: MoodleUser, courseId: number, typeId: number, name: string): Promise<number> {
  await moodleLogin(page, urls.moodle, teacher.username, teacher.password);
  await page.goto(`${urls.moodle}/course/modedit.php?add=lti&typeid=${typeId}&course=${courseId}&section=0&return=0`);
  await page.locator('#id_name').fill(name);
  // The grade fields sit in collapsed sections of the activity form: expand all, then fill (or set when still hidden).
  const expand = page.locator('a.collapseexpand');
  if (await expand.count()) await expand.first().click().catch(() => undefined);
  const accept = page.locator('#id_instructorchoiceacceptgrades');
  if ((await accept.count()) && !(await accept.isChecked())) {
    await accept.check({ timeout: 5_000 }).catch(() => accept.evaluate((el) => { (el as HTMLInputElement).checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }));
  }
  const max = page.locator('#id_grade_modgrade_point');
  if (await max.count()) {
    if (await max.isVisible()) await max.fill('100');
    else await max.evaluate((el) => { (el as HTMLInputElement).value = '100'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  }
  await Promise.all([page.waitForURL(/\/course\/view\.php/, { timeout: 30_000 }), page.locator('#id_submitbutton2').click()]);
  const cmid = await cmidByName(courseId, name);
  if (!cmid) throw new Error(`activity "${name}" not found after save`);
  return cmid;
}

// ---------------------------------------------------------------- the real app picker (T4b2 onward)

export interface PageAnswer {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface OpenPicker {
  page: Page;
  frame: import('@playwright/test').Frame;
  pickerUrl: string;
  pickerGet: PageAnswer;
}

/** Teacher: modedit "Add an activity → <tool>" → Select content; waits for the app picker in Moodle's frame. */
export async function openPicker(
  context: BrowserContext,
  teacher: MoodleUser,
  courseId: number,
  typeId: number,
  timeoutMs = 45_000,
  { updateCmid }: { updateCmid?: number } = {},
): Promise<OpenPicker> {
  const page = await context.newPage();
  await moodleLogin(page, urls.moodle, teacher.username, teacher.password);
  let pickerGet: PageAnswer | undefined;
  const onResponse = async (r: import('@playwright/test').Response) => {
    if (pickerGet || r.request().method() !== 'GET' || !r.url().startsWith(`${urls.app}/tool/picker/`)) return;
    pickerGet = { url: r.url(), status: r.status(), headers: await r.allHeaders(), body: await r.text().catch(() => '') };
  };
  context.on('response', onResponse);
  try {
    await page.goto(
      updateCmid
        ? `${urls.moodle}/course/modedit.php?update=${updateCmid}&return=0`
        : `${urls.moodle}/course/modedit.php?add=lti&typeid=${typeId}&course=${courseId}&section=0&return=0`,
    );
    await page.locator('#id_selectcontent').click();
    const deadline = Date.now() + timeoutMs;
    let frame = page.frames().find((f) => f.url().startsWith(`${urls.app}/tool/picker/`));
    while ((!frame || !pickerGet) && Date.now() < deadline) {
      await page.waitForTimeout(250);
      frame = page.frames().find((f) => f.url().startsWith(`${urls.app}/tool/picker/`));
    }
    if (!frame || !pickerGet) throw new Error(`the picker did not open in Moodle's frame within ${timeoutMs} ms`);
    await frame.waitForLoadState('load');
    return { page, frame, pickerUrl: frame.url(), pickerGet };
  } finally {
    context.off('response', onResponse);
  }
}

export interface PickerOption {
  value: string;
  type: string;
  label: string;
  row: string;
}

/** The picker's choices: input type, value, label text and the text of its row (badges). */
export async function pickerOptions(frame: import('@playwright/test').Frame): Promise<PickerOption[]> {
  return frame.evaluate(() =>
    Array.from(document.querySelectorAll('input[name="publicationId"]')).map((el) => {
      const input = el as HTMLInputElement;
      const label = input.closest('label') ?? (input.id ? document.querySelector(`label[for="${input.id}"]`) : null);
      const row = input.closest('li, tr, .option, .card, div') ?? input.parentElement;
      return { value: input.value, type: input.type, label: (label?.textContent ?? '').replace(/\s+/g, ' ').trim(), row: (row?.textContent ?? '').replace(/\s+/g, ' ').trim() };
    }),
  );
}

/** Picks the option whose label contains `title`, submits, and waits until Moodle's form gets the name. */
export async function submitPicker(open: OpenPicker, title: string, { forceValue }: { forceValue?: string } = {}): Promise<{ pickerPost: PageAnswer; nameAfter: string }> {
  const { page, frame } = open;
  let pickerPost: PageAnswer | undefined;
  const onResponse = async (r: import('@playwright/test').Response) => {
    if (pickerPost || r.request().method() !== 'POST' || !r.url().startsWith(open.pickerUrl.split('?')[0])) return;
    pickerPost = { url: r.url(), status: r.status(), headers: await r.allHeaders(), body: await r.text().catch(() => '') };
  };
  page.context().on('response', onResponse);
  try {
    const options = await pickerOptions(frame);
    const target = options.find((o) => o.label.includes(title) || o.row.includes(title));
    if (!target) throw new Error(`no picker option for "${title}" (options: ${options.map((o) => o.label).join(' | ')})`);
    await frame.locator(`input[name="publicationId"][value="${target.value}"]`).check();
    if (forceValue) {
      // "Real page, edited form value" (AC-T4-26): the browser sends another publication id.
      await frame.evaluate(([v, f]) => {
        const input = document.querySelector(`input[name="publicationId"][value="${v}"]`) as HTMLInputElement;
        input.value = f;
      }, [target.value, forceValue]);
    }
    await frame.locator('form button[type="submit"], form input[type="submit"]').first().click();
    const deadline = Date.now() + 30_000;
    let nameAfter = '';
    while (Date.now() < deadline) {
      nameAfter = await page.locator('#id_name').inputValue().catch(() => '');
      if (pickerPost && (pickerPost.status !== 200 || nameAfter)) break;
      await page.waitForTimeout(250);
    }
    if (!pickerPost) throw new Error('no answer to the picker POST');
    return { pickerPost, nameAfter };
  } finally {
    page.context().off('response', onResponse);
  }
}

/** Saves the open activity form ("Save and return to course") and returns the new cmid. */
export async function saveActivity(page: Page, courseId: number, name?: string): Promise<number> {
  if (name !== undefined) await page.locator('#id_name').fill(name);
  const finalName = await page.locator('#id_name').inputValue();
  await Promise.all([page.waitForURL(/\/course\/view\.php/, { timeout: 30_000 }), page.locator('#id_submitbutton2').click()]);
  const cmid = await cmidByName(courseId, finalName);
  if (!cmid) throw new Error(`activity "${finalName}" not found after save`);
  return cmid;
}
