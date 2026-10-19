// Moodle 5.2.4 UI steps for T7, driven like a person: visible labels, menus, buttons.
// Facts from the live Moodle 5.2.4 site (QA exploration on the qa-e2e stack, 2026-10-18):
// - Site administration is a menu item of the primary navigation (admin/search.php). Its "Plugins" tab lists
//   "Activity modules" (h4 link), then "External tool" (link) with "Manage tools" (link) in the next list item.
// - Manage tools (mod/lti/toolconfigure.php): input#tool-url (placeholder "Tool URL..."), button "Add LTI Advantage",
//   link "configure a tool manually". The registration runs in an inline iframe (not a modal). Tool cards:
//   `.tool-card`, badge "Pending"/"Active", link "Activate", icon links titled "View configuration details", "Edit".
// - The course page in edit mode: "Add content" buttons (aria-label "Insert content in section '<name>'") open a menu
//   with "Activity or resource". The chooser modal "Add an activity or resource": select an option, then "Add".
// - A user tour ("Activate edit mode …") can cover the course page: QA ends it, as a person would.
// - Moodle help icons have aria-label "Help with <label>", so form fields are found with exact labels.
import type { BrowserContext, Frame, Locator, Page } from '@playwright/test';
import type { MoodleUser } from '../../acceptance/lib/seed';
import { recordSecret, urls } from './e2e';

const toursHandled = new WeakSet<Page>();

/** A new Moodle page that ends user tours when they cover the page. */
export async function moodlePage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await endUserTours(page);
  return page;
}

export async function endUserTours(page: Page): Promise<void> {
  if (toursHandled.has(page)) return;
  toursHandled.add(page);
  await page.addLocatorHandler(page.locator('[data-flexitour="container"]').first(), async (tour) => {
    await tour.locator('[data-role="end"]').first().click();
  });
}

export async function login(page: Page, user: MoodleUser): Promise<void> {
  await endUserTours(page);
  await page.goto(`${urls.moodle}/login/index.php`);
  if ((await page.locator('#username').count()) === 0) {
    const logout = page.getByRole('button', { name: 'Log out' });
    if (await logout.count()) {
      await Promise.all([page.waitForLoadState('load'), logout.first().click()]);
      await page.goto(`${urls.moodle}/login/index.php`);
    }
  }
  // core/togglesensitive re-creates the password field when its JS starts; a value typed before that is lost.
  await page.locator('.toggle-sensitive-wrapper #password').waitFor({ state: 'visible' });
  await page.locator('#username').fill(user.username);
  await page.locator('#password').fill(user.password);
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith('/login/index.php'), { timeout: 30_000 }), page.locator('#loginbtn').click()]);
}

/** Clicks and waits until the page URL changes and the new page has loaded. */
export async function clickAndNavigate(page: Page, target: Locator, timeoutMs = 30_000): Promise<void> {
  const before = page.url();
  await Promise.all([page.waitForURL((u) => u.href !== before, { timeout: timeoutMs }), target.click()]);
  await page.waitForLoadState('load');
}

// ---------------------------------------------------------------- labels (AC-T7-14)

/**
 * Which of `labels` are NOT shown inside `root` (for a page or frame: `x.locator('body')`): visible text, and the
 * placeholder, aria-label, title and alt of elements, input values and option texts. Whitespace is normalised; the
 * match is case-sensitive.
 */
export async function missingLabels(root: Locator, labels: string[]): Promise<string[]> {
  if (labels.length === 0) return [];
  return root.evaluate((el, list) => {
    const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
    const texts: string[] = [norm((el as HTMLElement).innerText)];
    for (const e of Array.from(el.querySelectorAll('[placeholder],[aria-label],[title],[alt],input[type=submit],input[type=button],option'))) {
      for (const a of ['placeholder', 'aria-label', 'title', 'alt']) {
        const v = e.getAttribute(a);
        if (v) texts.push(norm(v));
      }
      if (e.tagName === 'INPUT') texts.push(norm((e as HTMLInputElement).value));
      if (e.tagName === 'OPTION') texts.push(norm(e.textContent));
    }
    const all = texts.join('\n');
    return list.filter((label) => !all.includes(norm(label)));
  }, labels);
}

const xpathLiteral = (s: string) => (s.includes('"') ? `concat("${s.split('"').join('", \'"\', "')}")` : `"${s}"`);

/**
 * Follows a Moodle menu path from the Dashboard: [primary navigation item, tab, group …, link]. Each label must be
 * on the page where the path says. Returns the problems (label differences); on a problem it opens `fallbackUrl`.
 */
export async function followMenuPath(page: Page, menuPath: string[], fallbackUrl: string): Promise<string[]> {
  const problems: string[] = [];
  const fail = async (p: string) => {
    problems.push(p);
    await page.goto(fallbackUrl);
    return problems;
  };
  if (menuPath.length < 3) return fail(`menu path too short to follow: ${JSON.stringify(menuPath)}`);
  await page.goto(`${urls.moodle}/my/`);
  const [top, tab, ...rest] = menuPath;
  const nav = page.locator('.primary-navigation, nav').first();
  const topItem = nav.getByRole('menuitem', { name: top, exact: true }).or(nav.getByRole('link', { name: top, exact: true })).first();
  if (!(await topItem.count())) return fail(`menu path: "${top}" is not in the primary navigation`);
  await clickAndNavigate(page, topItem);
  const tabItem = page.getByRole('tab', { name: tab, exact: true }).first();
  if (!(await tabItem.count())) return fail(`menu path: no tab "${tab}" on ${new URL(page.url()).pathname}`);
  await tabItem.click();
  const pane = page.locator('.tab-pane.active').first();
  await pane.waitFor();
  let anchor: Locator | null = null;
  for (const [i, label] of rest.entries()) {
    const last = i === rest.length - 1;
    const hit: Locator = anchor
      ? anchor.locator(`xpath=following::*[self::a or self::h3 or self::h4 or self::h5][normalize-space(.)=${xpathLiteral(label)}][1]`)
      : pane.locator(`xpath=.//*[self::a or self::h3 or self::h4 or self::h5][normalize-space(.)=${xpathLiteral(label)}]`).first();
    if (!(await hit.count())) return fail(`menu path: "${label}" not found${anchor ? ` after "${rest[i - 1]}"` : ` in the "${tab}" tab`}`);
    anchor = hit;
    if (last) {
      const link = (await hit.evaluate((e) => e.tagName)) === 'A' ? hit : hit.locator('a').first();
      await clickAndNavigate(page, link);
    }
  }
  return problems;
}

// ---------------------------------------------------------------- Manage tools

export const MANAGE_TOOLS = () => `${urls.moodle}/mod/lti/toolconfigure.php`;

export function toolCard(page: Page, name: string): Locator {
  return page.locator('.tool-card').filter({ has: page.locator('.name', { hasText: name }) });
}

export interface RegistrationFrame {
  kind: 'choice' | 'confirm' | 'error';
  frame: Frame;
  text: string;
}

/** After "Add LTI Advantage": waits until Moodle's registration frame shows the choice page or the Cogniate page. */
export async function waitRegistrationFrame(page: Page, { skipChoice = false, timeoutMs = 45_000 } = {}): Promise<RegistrationFrame> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const app = page.frames().find((f) => f.url().startsWith(`${urls.app}/tool/register`));
    if (app) {
      await app.waitForLoadState('load');
      const text = (await app.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
      const hasConnect = (await app.getByRole('button', { name: 'Connect', exact: true }).count()) > 0;
      return { kind: hasConnect ? 'confirm' : 'error', frame: app, text };
    }
    if (!skipChoice) {
      const reg = page.frames().find((f) => /startltiadvregistration\.php/.test(f.url()));
      if (reg && (await reg.locator('button[data-href*="startltiadvregistration.php"]').count().catch(() => 0)) > 0) {
        return { kind: 'choice', frame: reg, text: (await reg.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ') };
      }
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`Moodle's registration frame did not show the choice page or the Cogniate page within ${timeoutMs} ms (frames: ${page.frames().map((f) => f.url().split('?')[0]).join(' | ')})`);
}

/** After "Connect" in the Cogniate page: the frame closes and the tool card is on Manage tools. */
export async function waitRegistrationClosed(page: Page, toolName: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const open = page.frames().some((f) => f.url().startsWith(`${urls.app}/tool/register`) || /startltiadvregistration\.php/.test(f.url()));
    if (!open && (await toolCard(page, toolName).count()) > 0) return;
    await page.waitForTimeout(250);
  }
  throw new Error(`after "Connect", the registration frame did not close or the tool card "${toolName}" did not appear within ${timeoutMs} ms`);
}

export async function cardBadge(page: Page, toolName: string): Promise<string> {
  return (await toolCard(page, toolName).locator('.badge').first().innerText().catch(() => '')).trim();
}

/** "Activate" on the tool card; waits until the card no longer has the link. */
export async function activateTool(page: Page, toolName: string): Promise<void> {
  const card = toolCard(page, toolName);
  await card.getByRole('link', { name: 'Activate', exact: true }).click();
  await card.getByRole('link', { name: 'Activate', exact: true }).waitFor({ state: 'detached', timeout: 20_000 });
}

export const USAGE_CHOOSER = 'Show in activity chooser and as a preconfigured tool';
export const NEW_WINDOW = 'New window';

/** The text of the selected option of a Moodle select found by its exact label. */
async function selectedText(page: Page, label: string): Promise<string> {
  return page.getByLabel(label, { exact: true }).evaluate((s) => (s as HTMLSelectElement).selectedOptions[0]?.text ?? '');
}

/** Opens the edit form of a tool from its card ("Edit"). */
export async function openToolEdit(page: Page, toolName: string): Promise<void> {
  if (!page.url().startsWith(MANAGE_TOOLS())) await page.goto(MANAGE_TOOLS());
  await clickAndNavigate(page, toolCard(page, toolName).getByTitle('Edit', { exact: true }).first());
  await page.getByLabel('Tool name', { exact: true }).waitFor();
}

/** Edit the tool: Tool configuration usage and Default launch container; Save changes. */
export async function editToolSettings(page: Page, toolName: string, editLabels: string[] = []): Promise<string[]> {
  await openToolEdit(page, toolName);
  const missing = await missingLabels(page.locator('body'), editLabels.filter((l) => l !== 'Edit'));
  await page.getByLabel('Tool configuration usage', { exact: true }).selectOption({ label: USAGE_CHOOSER });
  await page.getByLabel('Default launch container', { exact: true }).selectOption({ label: NEW_WINDOW });
  await clickAndNavigate(page, page.getByRole('button', { name: 'Save changes', exact: true }));
  return missing;
}

export interface ToolSettings {
  badge: string;
  usage: string;
  container: string;
  toolUrl: string;
  clientId: string;
}

/** Reads the tool's card badge and its edit form (selected option texts). Leaves the form with Cancel. */
export async function readToolSettings(page: Page, toolName: string, screenshot?: (p: Page, name: string) => Promise<unknown>, shotName?: string): Promise<ToolSettings> {
  await page.goto(MANAGE_TOOLS());
  await toolCard(page, toolName).waitFor();
  const badge = await cardBadge(page, toolName);
  if (screenshot && shotName) await screenshot(page, `${shotName}-manage-tools`);
  await openToolEdit(page, toolName);
  const settings = {
    badge,
    usage: await selectedText(page, 'Tool configuration usage'),
    container: await selectedText(page, 'Default launch container'),
    toolUrl: await page.getByLabel('Tool URL', { exact: true }).inputValue(),
    clientId: await page.locator('#id_lti_clientid_disabled').inputValue().catch(() => ''),
  };
  if (screenshot && shotName) await screenshot(page, `${shotName}-settings`);
  await clickAndNavigate(page, page.getByRole('button', { name: 'Cancel', exact: true }));
  return settings;
}

// ---------------------------------------------------------------- manual tool (Scenario B)

/** Moodle field ids for the §4.1 keys: used only when the exact label is not found (then QA records a difference). */
const FIELD_ID: Record<string, string> = {
  tool_name: '#id_lti_typename',
  tool_url: '#id_lti_toolurl',
  lti_version: '#id_lti_ltiversion',
  public_key_type: '#id_lti_keytype',
  public_keyset_url: '#id_lti_publickeyset',
  initiate_login_url: '#id_lti_initiatelogin',
  redirection_uris: '#id_lti_redirectionuris',
  deep_linking: '#id_lti_contentitem',
  content_selection_url: '#id_lti_toolurl_ContentItemSelectionRequest',
  tool_configuration_usage: '#id_lti_coursevisible',
  launch_container: '#id_lti_launchcontainer',
  ags: '#id_ltiservice_gradesynchronization',
  nrps: '#id_ltiservice_memberships',
  share_name: '#id_lti_sendname',
  share_email: '#id_lti_sendemailaddr',
  accept_grades: '#id_lti_acceptgrades',
};

export interface ToolRow {
  key: string;
  label: string;
  value: string;
}

/**
 * On the form that "configure a tool manually" opens: each row into the Moodle field with the same label (select: the
 * option with that text; checkbox: "Yes" = on), then Save changes. Returns the differences between the shown
 * labels/values and the Moodle form.
 */
export async function fillManualTool(page: Page, rows: ToolRow[]): Promise<string[]> {
  const diffs: string[] = [];
  await page.getByLabel('Tool name', { exact: true }).waitFor();
  const expand = page.locator('a.collapseexpand');
  if ((await expand.count()) && /expand/i.test(await expand.first().innerText())) await expand.first().click();
  for (const row of rows) {
    let field = page.getByLabel(row.label, { exact: true });
    if ((await field.count()) !== 1) {
      diffs.push(`manual form: no single field labelled "${row.label}" (key ${row.key}); QA used ${FIELD_ID[row.key] ?? 'nothing'}`);
      if (!FIELD_ID[row.key]) continue;
      field = page.locator(FIELD_ID[row.key]);
    }
    const kind = await field.evaluate((e) => `${e.tagName}:${(e as HTMLInputElement).type}`);
    if (kind.startsWith('SELECT')) {
      const options = await field.evaluate((s) => Array.from((s as HTMLSelectElement).options).map((o) => o.text.trim()));
      const exact = options.find((o) => o === row.value);
      const partial = options.find((o) => o.includes(row.value));
      if (!exact && !partial) {
        diffs.push(`manual form: "${row.label}" has no option "${row.value}" (options: ${options.join(' | ')})`);
        continue;
      }
      if (!exact) diffs.push(`manual form: "${row.label}" shows the option "${partial}", the portal value is "${row.value}"`);
      await field.selectOption({ label: exact ?? partial! });
    } else if (kind === 'INPUT:checkbox') {
      if (/^yes$/i.test(row.value)) await field.check();
      else await field.uncheck();
    } else {
      await field.fill(row.value);
    }
  }
  await clickAndNavigate(page, page.getByRole('button', { name: 'Save changes', exact: true }));
  return diffs;
}

/** "View configuration details" on the tool card: the six values, by the Moodle label. */
export async function readToolDetails(page: Page, toolName: string): Promise<Record<string, string>> {
  if (!page.url().startsWith(MANAGE_TOOLS())) await page.goto(MANAGE_TOOLS());
  await toolCard(page, toolName).getByTitle('View configuration details', { exact: true }).first().click();
  const modal = page.locator('.modal.show');
  await modal.getByText('Tool configuration details').first().waitFor();
  // The dialog body is rendered after the dialog opens (a spinner first).
  await expectCount(modal.locator('.modal-body li'), 6, 15_000);
  const items = await modal.locator('.modal-body li').evaluateAll((lis) =>
    lis.map((li) => {
      const label = (li.querySelector('strong')?.textContent ?? '').replace(/:\s*$/, '').trim();
      const value = (li.textContent ?? '').replace(li.querySelector('strong')?.textContent ?? '', '').trim();
      return [label, value] as [string, string];
    }),
  );
  return Object.fromEntries(items);
}

async function expectCount(loc: Locator, min: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while ((await loc.count()) < min) {
    if (Date.now() > deadline) throw new Error(`expected at least ${min} elements for ${loc}, found ${await loc.count()}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

export async function closeModal(page: Page): Promise<void> {
  const modal = page.locator('.modal.show');
  const cancel = modal.getByRole('button', { name: 'Cancel', exact: true }).or(modal.locator('.btn-close, [data-action="hide"]')).first();
  if (await cancel.count()) await cancel.click();
  await modal.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => undefined);
}

// ---------------------------------------------------------------- teacher: activity chooser, Select content, completion

export async function ensureEditMode(page: Page, courseId: number): Promise<void> {
  await page.goto(`${urls.moodle}/course/view.php?id=${courseId}`);
  const addContent = page.locator('button[data-action="open-addingcontent"][aria-label^="Insert content in section"]');
  const toggle = page.locator('.editmode-switch-form input[name="setmode"]').first();
  if (!(await toggle.isChecked())) await toggle.click();
  await addContent.first().waitFor({ state: 'visible', timeout: 30_000 });
}

/** "Add content" in the section → "Activity or resource" → the chooser → select `toolName` → "Add" → the activity form. */
export async function addActivityFromChooser(page: Page, toolName: string, section = 'General'): Promise<{ chooserItems: string[] }> {
  const add = page.locator(`button[data-action="open-addingcontent"][aria-label="Insert content in section '${section}'"]`).first();
  const menu = page.locator('.dropdown-menu.show');
  const item = menu.getByRole('button', { name: /Activity or resource/ }).or(menu.locator('[data-action="open-chooser"]')).first();
  // The edit-mode user tour can start while the menu opens; ending it closes the menu. Then open the menu again.
  for (let attempt = 1; attempt <= 3; attempt++) {
    await add.click();
    if (await item.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true, () => false)) break;
  }
  await item.click();
  const modal = page.locator('.modal.show');
  await modal.getByText('Add an activity or resource').first().waitFor();
  const option = modal.getByRole('menuitem', { name: toolName, exact: true }).first();
  await option.waitFor({ timeout: 15_000 });
  const chooserItems = (await modal.locator('[data-region="chooser-option-container"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))).filter(Boolean);
  // A click selects the option and "Add" opens the form. If the chooser script has not taken the click yet, the
  // option link opens the form at once. Both are the same person action; QA accepts both.
  await option.locator('.optionname').click();
  const deadline = Date.now() + 30_000;
  while (!/\/course\/modedit\.php/.test(page.url())) {
    const addButton = modal.getByRole('button', { name: 'Add', exact: true });
    if ((await addButton.isVisible().catch(() => false)) && (await addButton.isEnabled().catch(() => false))) {
      await Promise.all([page.waitForURL(/\/course\/modedit\.php/, { timeout: 30_000 }), addButton.click()]).catch(() => undefined);
    }
    if (Date.now() > deadline) throw new Error(`the activity form did not open after choosing "${toolName}" (URL ${page.url()})`);
    await page.waitForTimeout(250);
  }
  await page.waitForLoadState('load');
  await page.getByRole('button', { name: 'Select content', exact: true }).waitFor();
  return { chooserItems: [...new Set(chooserItems)] };
}

export interface PickerView {
  frame: Frame;
  /** The course titles of the options (first line of each option label). */
  titles: string[];
  text: string;
}

/** "Select content": waits for the Cogniate picker inside Moodle's dialog. */
export async function openSelectContent(page: Page, timeoutMs = 45_000): Promise<PickerView> {
  await page.getByRole('button', { name: 'Select content', exact: true }).click();
  const deadline = Date.now() + timeoutMs;
  let frame: Frame | undefined;
  while (!frame && Date.now() < deadline) {
    frame = page.frames().find((f) => f.url().startsWith(`${urls.app}/tool/picker/`));
    if (!frame) await page.waitForTimeout(250);
  }
  if (!frame) throw new Error(`the Cogniate picker did not open in Moodle's dialog within ${timeoutMs} ms (frames: ${page.frames().map((f) => f.url().split('?')[0]).join(' | ')})`);
  await frame.waitForLoadState('load');
  recordSecret('picker_id', new URL(frame.url()).pathname.split('/')[3], 'teacher: picker URL');
  await frame.locator('input[name="publicationId"]').first().waitFor({ timeout: 15_000 }).catch(() => undefined);
  const titles = await frame.locator('input[name="publicationId"]').evaluateAll((inputs) =>
    inputs.map((el) => {
      const input = el as HTMLInputElement;
      const label = input.closest('label') ?? (input.id ? document.querySelector(`label[for="${input.id}"]`) : null);
      const lines = ((label as HTMLElement | null)?.innerText ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
      return lines[0] ?? '';
    }),
  );
  const text = (await frame.locator('body').innerText()).replace(/\s+/g, ' ');
  return { frame, titles, text };
}

/** Chooses the option with this title, "Add to Moodle", and waits until Moodle's form has the activity name. */
export async function pickCourse(page: Page, picker: PickerView, title: string): Promise<string> {
  const i = picker.titles.indexOf(title);
  if (i < 0) throw new Error(`the picker has no course "${title}" (options: ${picker.titles.join(' | ')})`);
  await picker.frame.locator('input[name="publicationId"]').nth(i).check();
  await picker.frame.getByRole('button', { name: 'Add to Moodle', exact: true }).click();
  const deadline = Date.now() + 30_000;
  let name = '';
  while (Date.now() < deadline) {
    name = await page.locator('#id_name').inputValue().catch(() => '');
    if (name && (await page.locator('.modal.show').count()) === 0) break;
    await page.waitForTimeout(250);
  }
  return name;
}

/** Completion conditions: "Add requirements" + "Receive a grade" (any grade). */
export async function setCompletionReceiveGrade(page: Page): Promise<void> {
  const header = page.locator('#id_activitycompletionheader');
  const addReq = page.getByRole('radio', { name: 'Add requirements', exact: true });
  if (!(await addReq.isVisible().catch(() => false))) await header.locator('legend a, .ftoggler a').first().click();
  await addReq.check();
  await page.getByRole('checkbox', { name: 'Receive a grade', exact: true }).check();
}

export async function saveAndReturn(page: Page): Promise<void> {
  await Promise.all([page.waitForURL(/\/course\/view\.php/, { timeout: 30_000 }), page.getByRole('button', { name: 'Save and return to course', exact: true }).click()]);
}

/** Leaves an open "Select content" dialog and the activity form without saving. */
export async function cancelActivityForm(page: Page): Promise<void> {
  const modal = page.locator('.modal.show');
  if (await modal.count()) {
    await modal.locator('.btn-close, [data-action="hide"], button[aria-label="Close"]').first().click().catch(() => undefined);
    await modal.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => undefined);
  }
  await Promise.all([page.waitForURL(/\/course\/view\.php/, { timeout: 30_000 }), page.getByRole('button', { name: 'Cancel', exact: true }).first().click()]);
}

// ---------------------------------------------------------------- reports (evidence)

/** The grader report as text rows (first cell = learner). */
export async function graderReport(page: Page, courseId: number): Promise<string[][]> {
  await page.goto(`${urls.moodle}/grade/report/grader/index.php?id=${courseId}`);
  await page.locator('table#user-grades, table.gradereport-grader-table').first().waitFor({ timeout: 30_000 });
  return page.locator('table#user-grades tr, table.gradereport-grader-table tr').evaluateAll((trs) =>
    trs.map((tr) => Array.from(tr.querySelectorAll('th, td')).map((c) => ((c as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim())).filter((r) => r.some(Boolean)),
  );
}
