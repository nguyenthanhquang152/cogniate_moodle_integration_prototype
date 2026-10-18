// Cogniate portal steps (T6 UI at PUBLIC_APP_URL), driven by the visible labels (QA exploration, 2026-10-18):
// sign-in "Email", "Password", "Sign in"; sidebar "Integrations", "Libraries"; Moodle card link "Connect"; wizard
// "Connection name", "Moodle site URL", "Automatic (recommended)" / "Manual", "Continue"; registration URL "Copy";
// manual rows `[data-key]` with "Copy", inputs named by the contract keys, button "Connect Moodle"; Courses "New course",
// "Course title", "Create course", file input + "Upload package"; "Publish to Moodle" dialog with the select
// "Moodle connection" and "Publish".
import type { Locator, Page } from '@playwright/test';
import { appApi, portalUser, signIn as apiSignIn, type Session } from '../../acceptance/lib/app';
import { urls } from './e2e';

export async function portalSignIn(page: Page, email: string): Promise<void> {
  await page.goto(`${urls.app}/signin`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(portalUser(email).password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 20_000 }), page.getByRole('button', { name: 'Sign in' }).click()]);
}

export async function clipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

/** Integrations → Moodle card → "Connect" (or "Connect another site") → the wizard form → Continue. Returns the connection id. */
export async function startConnect(page: Page, name: string, method: 'dynamic' | 'manual'): Promise<string> {
  await page.getByRole('link', { name: 'Integrations', exact: true }).first().click();
  await page.waitForURL(/\/integrations$/);
  const card = page.locator('article, section, div').filter({ hasText: 'Export SCORM packages and sync course content with your Moodle LMS.' }).last();
  await card.waitFor();
  const connect = card.getByRole('link', { name: 'Connect', exact: true }).or(card.getByRole('button', { name: 'Connect', exact: true }));
  const another = page.getByRole('link', { name: 'Connect another site' }).or(page.getByRole('button', { name: 'Connect another site' }));
  await ((await connect.count()) ? connect.first() : another.first()).click();
  await page.waitForURL(/\/integrations\/moodle\/connect$/);
  await page.getByLabel('Connection name').fill(name);
  await page.getByLabel(/^Moodle site URL/).fill(urls.moodle);
  await page.getByRole('radio', { name: method === 'dynamic' ? /^Automatic \(recommended\)/ : /^Manual/ }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/integrations\/moodle\/con_[^/]+$/, { timeout: 20_000 });
  return new URL(page.url()).pathname.split('/').pop()!;
}

export interface ScreenStep {
  id: string;
  text: string;
}

export async function stepsOnScreen(page: Page): Promise<ScreenStep[]> {
  return page.locator('[data-step-id]').evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-step-id') ?? '', text: (e.textContent ?? '').replace(/\s+/g, ' ').trim() })));
}

/** The 16 tool-configuration keys of app contract §4.1, in order. */
export const TOOL_CONFIG_KEYS = [
  'tool_name', 'tool_url', 'lti_version', 'public_key_type', 'public_keyset_url', 'initiate_login_url', 'redirection_uris', 'deep_linking',
  'content_selection_url', 'tool_configuration_usage', 'launch_container', 'ags', 'nrps', 'share_name', 'share_email', 'accept_grades',
];

/** Manual wizard: each tool-configuration row by its key (§4.1); the value is what its "Copy" button puts on the clipboard. */
export async function manualRows(page: Page): Promise<{ rows: { key: string; label: string; value: string }[]; missing: string[] }> {
  await page.locator(`[data-key="${TOOL_CONFIG_KEYS[0]}"]`).first().waitFor();
  const rows: { key: string; label: string; value: string }[] = [];
  const missing: string[] = [];
  for (const key of TOOL_CONFIG_KEYS) {
    const row = page.locator(`[data-key="${key}"]`).first();
    if (!(await row.count())) {
      missing.push(key);
      continue;
    }
    await row.getByRole('button', { name: /copy/i }).click();
    const value = await clipboard(page);
    const label = await row.evaluate((r) => ((r.querySelector('th, td') as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ').trim());
    rows.push({ key, label, value });
  }
  return { rows, missing };
}

export async function apiSession(email: string): Promise<Session> {
  return apiSignIn(email);
}

export interface Connection {
  id: string;
  name: string;
  status: string;
  method: string;
}

export async function connectionOf(email: string, id: string): Promise<Connection> {
  const s = await apiSession(email);
  const res = await appApi<Connection>('GET', `/app-api/connections/${id}`, { cookie: s.cookie });
  if (res.status !== 200) throw new Error(`GET connection ${id}: HTTP ${res.status}`);
  return res.json;
}

/** Libraries → Courses → "New course" → title → "Create course" → upload the zip. Returns the course id. */
export async function createCourseWithZip(page: Page, title: string, zip: string, format: 'SCORM 1.2' | 'HTML'): Promise<string> {
  await page.getByRole('link', { name: 'Libraries', exact: true }).first().click();
  await page.waitForURL(/\/libraries\/courses$/);
  await page.getByRole('button', { name: 'New course' }).or(page.getByRole('link', { name: 'New course' })).first().click();
  await page.getByLabel('Course title').fill(title);
  await Promise.all([page.waitForURL(/\/libraries\/courses\/crs_[^/]+$/, { timeout: 20_000 }), page.getByRole('button', { name: 'Create course' }).click()]);
  const courseId = new URL(page.url()).pathname.split('/').pop()!;
  await page.locator('input[type="file"]').first().setInputFiles(zip);
  const upload = page.getByRole('button', { name: /^Upload package/ });
  if ((await upload.count()) && (await upload.first().isEnabled())) await upload.first().click();
  await page.getByText('Package accepted').first().waitFor({ timeout: 180_000 });
  await page.getByText(format, { exact: true }).first().waitFor({ timeout: 15_000 });
  return courseId;
}

/** Course page → "Publish to Moodle" → choose the connection → "Publish" → "Available in Moodle". */
export async function publishCourse(page: Page, connectionName: string): Promise<void> {
  await page.getByRole('link', { name: 'Publish to Moodle' }).or(page.getByRole('button', { name: 'Publish to Moodle' })).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const select = dialog.getByLabel('Moodle connection');
  const label = await select.evaluate((s, n) => Array.from((s as HTMLSelectElement).options).find((o) => o.text.startsWith(`${n} ·`))?.text ?? '', connectionName);
  if (!label) throw new Error(`the Publish dialog has no connection "${connectionName}"`);
  await select.selectOption({ label });
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await dialog.waitFor({ state: 'detached', timeout: 15_000 }).catch(() => undefined);
  await page.getByText('Available in Moodle').first().waitFor({ timeout: 15_000 });
}

export async function publicationOf(email: string, courseId: string): Promise<{ id: string; stats: { activities: number; learners: number } }> {
  const s = await apiSession(email);
  const res = await appApi<{ publications: { id: string; stats: { activities: number; learners: number } }[] }>('GET', `/app-api/publications?courseId=${encodeURIComponent(courseId)}`, { cookie: s.cookie });
  const pub = res.json?.publications?.[0];
  if (res.status !== 200 || !pub) throw new Error(`no publication for course ${courseId}: HTTP ${res.status}`);
  return pub;
}

/** The "Moodle publications" block text for one connection on the course page. */
export async function publicationBlockText(page: Page, courseId: string, connectionName: string): Promise<string> {
  await page.goto(`${urls.app}/libraries/courses/${courseId}`);
  await page.getByText('Moodle publications').first().waitFor();
  const block = page.locator('li, article, section, div').filter({ hasText: connectionName }).filter({ hasText: 'Available in Moodle' }).filter({ hasText: 'Selected in Moodle' }).last();
  await block.waitFor({ timeout: 15_000 });
  return (await block.innerText()).replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------- results (contract §5)

/** A results row: learner label "Learner <sub> …" and the activity title. */
export function resultsRow(page: Page, sub: number, activityTitle: string): Locator {
  return page.locator('tr, [role="row"]').filter({ hasText: new RegExp(`Learner ${sub}\\b`) }).filter({ hasText: activityTitle });
}

/** The text of the cell in `row` under the column whose header matches `header`. */
export async function cellUnder(row: Locator, header: RegExp): Promise<string> {
  return row.evaluate((tr, src) => {
    const re = new RegExp(src, 'i');
    const table = tr.closest('table, [role="table"], [role="grid"]');
    if (!table) return '';
    const heads = Array.from(table.querySelectorAll('th, [role="columnheader"]')).map((h) => (h.textContent ?? '').trim());
    const i = heads.findIndex((h) => re.test(h));
    if (i < 0) return '';
    const cells = Array.from(tr.querySelectorAll(':scope > td, :scope > th, :scope > [role="cell"], :scope > [role="gridcell"]'));
    return (cells[i]?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }, header.source);
}

export interface ResultRowApi {
  learner: { sub: string; label: string };
  activity: { resourceLinkId: string; contextTitle: string; title: string };
  preview: boolean;
  best: { outcome: string; scoreGiven: number | null; scoreMaximum: number | null } | null;
  scoreSyncs: { status: string }[];
  gradebook: { resultScore: number | null; resultMaximum: number | null } | null;
}

export async function resultsApi(email: string, publicationId: string): Promise<ResultRowApi[]> {
  const s = await apiSession(email);
  const res = await appApi<{ rows: ResultRowApi[] }>('GET', `/app-api/publications/${encodeURIComponent(publicationId)}/results`, { cookie: s.cookie });
  if (res.status !== 200) throw new Error(`results of ${publicationId}: HTTP ${res.status}`);
  return res.json.rows ?? [];
}
