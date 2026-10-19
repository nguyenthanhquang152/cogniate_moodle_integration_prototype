// Portal UI helpers for T6 (and the T7 portal steps). Source: tasks/T6.md (routes, texts, a11y), contract
// cogniate-app-api.md §2–§5, §4.1 (16 tool-configuration rows by `key`).
// Locators use roles, labels and the visible texts that T6.md gives. Where T6.md names no hook, the helpers try the
// contract name first (for example input name = contract key) and then a label pattern (spec note to the Architect).
import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { APP, portalUser } from './app';
import { REPO_ROOT } from './paths';

export const PORTAL_ROUTES = {
  signin: '/signin',
  integrations: '/integrations',
  connect: '/integrations/moodle/connect',
  connection: (id: string) => `/integrations/moodle/${id}`,
  courses: '/libraries/courses',
  course: (id: string) => `/libraries/courses/${id}`,
  publish: (id: string) => `/libraries/courses/${id}/publish`,
  results: (id: string) => `/publications/${id}/results`,
};

/** The 16 tool-configuration keys of app contract §4.1, in order. */
export const TOOL_CONFIG_KEYS = [
  'tool_name', 'tool_url', 'lti_version', 'public_key_type', 'public_keyset_url', 'initiate_login_url', 'redirection_uris', 'deep_linking',
  'content_selection_url', 'tool_configuration_usage', 'launch_container', 'ags', 'nrps', 'share_name', 'share_email', 'accept_grades',
];

/** The six values back from Moodle (contract §4 PUT …/platform keys) and a label pattern for each. */
export const SIX_VALUES: Record<string, RegExp> = {
  issuer: /issuer|platform id/i,
  clientId: /client id/i,
  deploymentId: /deployment id/i,
  authenticationEndpoint: /authenti/i,
  accessTokenEndpoint: /access token/i,
  jwksUrl: /keyset|jwks/i,
};

export async function portalSignIn(page: Page, email: string, password?: string): Promise<void> {
  // A context that is already signed in: /signin redirects into the app. Same user → keep the session; another user →
  // drop the app cookies first, then sign in.
  const me = await page.request.get(`${APP}/app-api/me`);
  if (me.status() === 200) {
    const who = (await me.json().catch(() => null)) as { user?: { email?: string } } | null;
    if (who?.user?.email?.toLowerCase() === email.toLowerCase()) return;
    await page.context().clearCookies({ domain: new URL(APP).hostname });
  }
  await page.goto(`${APP}${PORTAL_ROUTES.signin}`);
  await page.getByLabel(/e-?mail/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password ?? portalUser(email).password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith(PORTAL_ROUTES.signin), { timeout: 20_000 }),
    page.getByRole('button', { name: /sign in|log in/i }).first().click(),
  ]);
}

export async function allowClipboard(context: BrowserContext): Promise<void> {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
}

export async function clipboardText(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

/** Marks the page; `stillSamePage` is false after any reload or navigation. */
export async function markNoReload(page: Page): Promise<() => Promise<boolean>> {
  await page.evaluate(() => {
    (window as unknown as { __qaNoReload?: boolean }).__qaNoReload = true;
  });
  return () => page.evaluate(() => (window as unknown as { __qaNoReload?: boolean }).__qaNoReload === true).catch(() => false);
}

/** The grid of cards that holds the element with `text`: card count, distinct columns in the first row, card radius. */
export async function cardGrid(page: Page, text: string): Promise<{ count: number; columns: number; radius: string; cardTexts: string[] } | null> {
  return page.evaluate((t) => {
    const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
    const hit = all.find((el) => el.children.length === 0 && (el.textContent ?? '').includes(t)) ?? all.find((el) => (el.textContent ?? '').trim() === t);
    let card: HTMLElement | null = hit ?? null;
    while (card && card.parentElement && getComputedStyle(card.parentElement).display !== 'grid') card = card.parentElement;
    if (!card || !card.parentElement) return null;
    const cards = Array.from(card.parentElement.children) as HTMLElement[];
    const top = Math.min(...cards.map((c) => c.getBoundingClientRect().top));
    const firstRow = cards.filter((c) => Math.abs(c.getBoundingClientRect().top - top) < 4);
    return {
      count: cards.length,
      columns: new Set(firstRow.map((c) => Math.round(c.getBoundingClientRect().left))).size,
      radius: getComputedStyle(card).borderTopLeftRadius,
      cardTexts: cards.map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)),
    };
  }, text);
}

/** "rgb(r, g, b)" → [r, g, b]. */
export function rgb(css: string): number[] {
  return (css.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
}

export function near(a: number[], b: number[], tol = 1): boolean {
  return a.length === 3 && a.every((v, i) => Math.abs(v - b[i]) <= tol);
}

/** Every URL that the page requested (for "no request leaves PUBLIC_APP_URL"). */
export function recordRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  return urls;
}

// ---------------------------------------------------------------- the Moodle steps (apps/portal/src/connect/moodle-steps.json)

export const MOODLE_STEPS_FILE = path.join(REPO_ROOT, 'apps', 'portal', 'src', 'connect', 'moodle-steps.json');

export interface MoodleStep {
  id: string;
  text: string;
  menuPath?: unknown;
  labels?: unknown;
}

/**
 * The steps of one method from moodle-steps.json. T6.md fixes the content (step id, text, Moodle menu path, exact
 * labels) but not the shape, so QA accepts {dynamic|automatic: [...], manual: [...]}, {methods: {...}}, or a list of
 * steps with a `method` field, or a list of {method, steps}.
 */
export function moodleSteps(method: 'dynamic' | 'manual'): MoodleStep[] {
  const raw = JSON.parse(fs.readFileSync(MOODLE_STEPS_FILE, 'utf8')) as unknown;
  const names = method === 'dynamic' ? ['dynamic', 'automatic'] : ['manual'];
  const asSteps = (v: unknown): MoodleStep[] | null =>
    Array.isArray(v) && v.every((s) => s && typeof s === 'object' && typeof (s as MoodleStep).text === 'string') ? (v as MoodleStep[]) : null;
  const obj = raw as Record<string, unknown>;
  for (const n of names) {
    const direct = asSteps(obj?.[n]) ?? asSteps((obj?.methods as Record<string, unknown> | undefined)?.[n]) ?? asSteps((obj?.[n] as { steps?: unknown })?.steps);
    if (direct) return direct;
  }
  if (Array.isArray(raw)) {
    const tagged = raw.filter((s) => names.includes(String((s as { method?: string }).method)));
    const nested = tagged.find((s) => asSteps((s as { steps?: unknown }).steps));
    if (nested) return asSteps((nested as { steps: unknown }).steps)!;
    if (asSteps(tagged)) return tagged as MoodleStep[];
  }
  throw new Error(`moodle-steps.json: no steps for "${method}" (shape not recognised)`);
}

/** Step texts on the wizard page: elements with data-step-id, else the items of the first ordered list in main. */
export async function stepsOnScreen(page: Page): Promise<{ id: string | null; text: string }[]> {
  return page.evaluate(() => {
    const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
    const tagged = Array.from(document.querySelectorAll('[data-step-id]'));
    if (tagged.length) return tagged.map((el) => ({ id: el.getAttribute('data-step-id'), text: norm(el.textContent) }));
    const list = document.querySelector('main ol') ?? document.querySelector('ol');
    return list ? Array.from(list.children).map((li) => ({ id: null, text: norm(li.textContent) })) : [];
  });
}

export const normText = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The exact moodle-steps.json content that tasks/T6.md gives (the ```json block with "cogniate-moodle-steps/1"). */
export function specMoodleSteps(): Record<string, unknown> {
  const md = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'architecture', 'tasks', 'T6.md'), 'utf8');
  const blocks = [...md.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]);
  const block = blocks.find((b) => b.includes('cogniate-moodle-steps/1') && b.includes('edit-tool-settings'));
  if (!block) throw new Error('tasks/T6.md: no full moodle-steps.json block');
  return JSON.parse(block) as Record<string, unknown>;
}

// ---------------------------------------------------------------- forms and tables

/** The input for one of the six Moodle values: name/id = contract key, data-key, then the label pattern. */
export async function sixValueInput(page: Page, key: string): Promise<Locator> {
  for (const sel of [`input[name="${key}"]`, `#${key}`, `[data-key="${key}"] input`]) {
    const l = page.locator(sel);
    if (await l.count()) return l.first();
  }
  return page.getByLabel(SIX_VALUES[key]).first();
}

/** Has the form an inline error now (aria-invalid on a field, or a visible alert)? */
export async function hasInlineError(page: Page): Promise<boolean> {
  const invalid = await page.locator('[aria-invalid="true"]').count();
  const alerts = await page.getByRole('alert').filter({ hasText: /\S/ }).count();
  return invalid + alerts > 0;
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

/**
 * A results row: the learner label "Learner <sub> …" and the exact activity title. The Results view shows the activity
 * title and, right after it, the Moodle course (`activity.contextTitle`, contract §5), with no space in the text
 * content. With `contextTitle`, the row must have "<title><contextTitle>" (spaces optional), so "Cogniate SCORM" does
 * not match "Cogniate SCORM AC-T5-30".
 */
export function resultsRow(page: Page, sub: string | number, activityTitle: string, contextTitle?: string): Locator {
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const title = contextTitle ? `${esc(activityTitle)}\\s*${esc(contextTitle)}` : `${esc(activityTitle)}(?![\\w-]|\\s+(AC-|rebind|\\d))`;
  return page
    .locator('tr, [role="row"]')
    .filter({ hasText: new RegExp(`Learner ${sub}\\b`) })
    .filter({ hasText: new RegExp(title) });
}
