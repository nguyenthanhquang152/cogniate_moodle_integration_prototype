// Shared helpers for the T5a and T5b suites: player and frames, the SCORM API in the runtime frame, RuntimeState and
// commits, the course driver, results and the Moodle oracle. Source: tasks/T5a.md, T5b.md; contract
// cogniate-app-api.md §5 (results), §6 (/play), §7 (content host, RuntimeState, commit bodies, check order), §8 (SCORM
// API), §12 (log events); flows §6c, §6d; ADR-004, ADR-010; data-model §2 (attempt rule).
//
// Course facts (read from the fixture packages, flows §6c): two pages ("index" = menu, "lesson-ai-web-sprint"), one
// question (01M2M36Y89M9KPPZENF1ZW4AWJ), mastery 70. A page is seen after 10 s of visible time and a scroll to the end
// (24 px slack); the menu page is seen on visit; the first answer stands. The SCORM package calls LMSFinish itself when
// all pages are seen and the question is answered, and at once on a later load of a finished attempt.
// Rule (tasks README §2): never use window.CogniateSCORM.markLessonComplete in an AC path.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { BrowserContext, Frame, Page } from '@playwright/test';
import { APP, appApi, type Session, signIn, THANH } from './app';
import { publicUrls } from './env';
import { httpsRequest } from './https';
import { eventsSince, loadState, recordSecret, saveState } from './lti';
import type { LogEntry } from './logs';
import { openPicker, submitPicker } from './moodle-dl';
import { type LaunchCapture, launchActivity } from './moodle-launch';
import { callWs, gradeItems } from './moodle-ws';
import { type MoodleUser, seed } from './seed';
import { zipBuffer } from './zip';

const urls = publicUrls();
export const CONTENT = urls.content;
export const PLAY = `${APP}/play/`;
export const LESSON = 'lesson-ai-web-sprint';
export const QUESTION = '01M2M36Y89M9KPPZENF1ZW4AWJ';
export const SHELL = {
  completed100: 'Completed — score 100 sent to Moodle',
  preview: 'Preview — no grade is sent',
  inProgress: 'In progress',
};

/** Moodle activity names. "Cogniate SCORM" and "Cogniate HTML" are the names of the T5a setup; the others are QA's own
 * activities, so that one AC's attempts do not change another AC's state (attempts are per learner and activity). */
export const ACT = {
  scorm: 'Cogniate SCORM',
  html: 'Cogniate HTML',
  blankA: 'QA Blank SCO',
  blankB: 'QA Blank SCO 2',
  rebind: 'Cogniate SCORM rebind',
  // T5b: "fresh activity per AC" (tasks README §2, d7a88ec): `Cogniate <SCORM|HTML> <AC id>`. The T5b setup makes
  // them; "Cogniate HTML 102" is made by AC-T5-32 itself.
  htmlHang: 'Cogniate HTML AC-T5-36',
  htmlFirst: 'Cogniate HTML AC-T5-28',
  htmlDwell: 'Cogniate HTML AC-T5-29',
  htmlRetry: 'Cogniate HTML AC-T5-14',
  htmlConflict: 'Cogniate HTML AC-T5-31',
  scormOutage: 'Cogniate SCORM AC-T5-30',
  scormOverride: 'Cogniate SCORM AC-T5-33',
  html102: 'Cogniate HTML 102',
} as const;

// ---------------------------------------------------------------- state shared by the T5 spec files

export interface CourseRef {
  courseId: string;
  versionId: string;
  packageId: string;
  title: string;
}

export interface T5State {
  runId: string;
  connectionId: string;
  typeId: number;
  scorm: CourseRef;
  html: CourseRef;
  blank: CourseRef;
  scormPublicationId: string;
  htmlPublicationId: string;
  blankPublicationId: string;
  /** cmid by activity name (ACT values and T5b names). */
  cmids: Record<string, number>;
  /** AC-T5-24: the SCORM version 2. */
  scormV2?: CourseRef;
  /** Which ACs ran (for the expected values of later ACs, e.g. AC-T5-18). */
  ran?: Record<string, boolean>;
  /** AC-T5-31: the conflict row and the timestamp of QA's score (AC-T5-32 resends the row within 10 min). */
  conflictSyncId?: string;
  conflictScoreAt?: number;
}

export function t5(): Partial<T5State> {
  return loadState('T5') as Partial<T5State>;
}

export function saveT5(patch: Partial<T5State>): void {
  saveState('T5', patch as Record<string, unknown>);
}

export function markRan(ac: string): void {
  saveT5({ ran: { ...(t5().ran ?? {}), [ac]: true } });
}

export function cmidOf(name: string): number {
  const cmid = t5().cmids?.[name];
  if (!cmid) throw new Error(`no activity "${name}" in the T5 state (the T5 setup did not make it)`);
  return cmid;
}

export const course101 = () => seed().courses['COGNIATE-DEV-101'];

// ---------------------------------------------------------------- setup helpers

const tmpFile = (name: string, buf: Buffer): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-t5-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, buf);
  return file;
};

/** AC-T5-05 "blank SCO": one index.html that never calls the API; manifest mastery 70. */
export function blankScoZip(): string {
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="qa.blank.sco" version="1" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
<metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
<organizations default="org"><organization identifier="org"><title>QA blank SCO</title>
<item identifier="i1" identifierref="r1"><title>QA blank SCO</title><adlcp:masteryscore>70</adlcp:masteryscore></item></organization></organizations>
<resources><resource identifier="r1" type="webcontent" adlcp:scormtype="sco" href="index.html"><file href="index.html"/></resource></resources></manifest>`;
  const index = '<!doctype html><html><head><meta charset="utf-8"><title>QA blank SCO</title></head><body data-lesson-id="index"><p>QA blank SCO: this page never calls the SCORM API.</p></body></html>';
  return tmpFile('qa-blank-sco.zip', zipBuffer([{ name: 'imsmanifest.xml', data: manifest }, { name: 'index.html', data: index }]));
}

/**
 * Moodle activity completion "Add requirements" + "Receive a grade" (any grade). Moodle 5.2.4
 * completion/classes/form/form_trait.php: radio `completion` = 2 (COMPLETION_TRACKING_AUTOMATIC), checkbox
 * `completionusegrade`, radio `completionpassgrade` = 0.
 */
export async function setCompletionReceiveGrade(page: Page): Promise<void> {
  const expand = page.locator('a.collapseexpand');
  if (await expand.count()) await expand.first().click().catch(() => undefined);
  // A real click when the input is visible; else set it and fire "change", as Moodle's hideIf rules listen for it.
  const tick = async (selector: string, required: boolean) => {
    const input = page.locator(selector);
    if (!(await input.count())) {
      if (required) throw new Error(`activity form: no ${selector}`);
      return;
    }
    await input.check({ force: true, timeout: 5_000 }).catch(() =>
      input.evaluate((el) => {
        (el as HTMLInputElement).checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }),
    );
  };
  await tick('#id_completion_2', true);
  await tick('#id_completionusegrade', true);
  await tick('#id_completionpassgrade_0', false);
}

/** Teacher: Add an activity → Thanh's tool → Select content → pick `courseTitle` → name, completion → save. */
export async function addPickedActivity(
  context: BrowserContext,
  teacher: MoodleUser,
  courseId: number,
  typeId: number,
  courseTitle: string,
  name: string,
): Promise<number> {
  const open = await openPicker(context, teacher, courseId, typeId);
  try {
    const { pickerPost, nameAfter } = await submitPicker(open, courseTitle);
    if (pickerPost.status !== 200 || nameAfter !== courseTitle) throw new Error(`picker: HTTP ${pickerPost.status}, name "${nameAfter}"`);
    await open.page.locator('#id_name').fill(name);
    await setCompletionReceiveGrade(open.page);
    await Promise.all([open.page.waitForURL(/\/course\/view\.php/, { timeout: 30_000 }), open.page.locator('#id_submitbutton2').click()]);
    const { cmidByName } = await import('./moodle-dl');
    const cmid = await cmidByName(courseId, name);
    if (!cmid) throw new Error(`activity "${name}" not found after save`);
    return cmid;
  } finally {
    await open.page.close().catch(() => undefined);
  }
}

// ---------------------------------------------------------------- player and frames

export interface Player {
  cap: LaunchCapture;
  popup: Page;
  playId: string;
  runtime: Frame;
  token: string;
}

export async function waitForFrame(page: Page, test: (url: string) => boolean, timeoutMs = 30_000): Promise<Frame> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const f = page.frames().find((fr) => test(fr.url()));
    if (f) return f;
    if (Date.now() > deadline) throw new Error(`no frame matched within ${timeoutMs} ms (frames: ${page.frames().map((fr) => fr.url()).join(' | ')})`);
    await page.waitForTimeout(200);
  }
}

/** A Moodle launch of the activity up to the player shell; the runtime frame and its token. */
export async function openPlayer(context: BrowserContext, user: MoodleUser, cmid: number, timeoutMs = 30_000): Promise<Player> {
  const cap = await launchActivity(context, user, cmid, { until: PLAY, timeoutMs });
  const popup = cap.popup!;
  await popup.bringToFront();
  const playId = new URL(popup.url()).pathname.split('/')[2] ?? '';
  const runtime = await waitForFrame(popup, (u) => u.startsWith(`${CONTENT}/rt/`), timeoutMs);
  const token = new URL(runtime.url()).pathname.split('/')[2] ?? '';
  recordSecret('runtime_token', token);
  return { cap, popup, playId, runtime, token };
}

/** The package frame (content origin /pkg/…); with `page`, waits until it shows that page (for example "index.html"). */
export async function packageFrame(player: Pick<Player, 'popup'>, page?: string, timeoutMs = 30_000): Promise<Frame> {
  const f = await waitForFrame(player.popup, (u) => u.startsWith(`${CONTENT}/pkg/`) && (!page || new URL(u).pathname.endsWith(`/${page}`)), timeoutMs);
  await f.waitForLoadState('domcontentloaded');
  return f;
}

export async function shellText(popup: Page): Promise<string> {
  return (await popup.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------- SCORM API in the runtime frame

export interface ApiCall {
  call: string;
  value: string;
  error: string;
}

/** Calls window.API in the runtime frame, in order; after each call, LMSGetLastError(). */
export async function scormCalls(runtime: Frame, calls: [string, ...string[]][]): Promise<ApiCall[]> {
  return runtime.evaluate((list) => {
    const api = (window as unknown as { API: Record<string, (...a: string[]) => unknown> }).API;
    return list.map(([fn, ...args]) => {
      const value = String(api[fn](...args));
      const error = String(api.LMSGetLastError());
      return { call: `${fn}(${args.map((a) => JSON.stringify(a)).join(', ')})`, value, error };
    });
  }, calls);
}

/** Mismatches of calls against expected [value, error] pairs (undefined = not checked). */
export function mismatches(calls: ApiCall[], want: [string | undefined, string | undefined][]): string[] {
  return calls.flatMap((c, i) => {
    const [v, e] = want[i] ?? [undefined, undefined];
    const p: string[] = [];
    if (v !== undefined && c.value !== v) p.push(`${c.call} returned "${c.value}", want "${v}"`);
    if (e !== undefined && c.error !== e) p.push(`${c.call} LMSGetLastError "${c.error}", want "${e}"`);
    return p;
  });
}

/** Waits until window.API exists in the runtime frame. */
export async function apiReady(player: Pick<Player, 'runtime'>, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const t = await player.runtime.evaluate(() => typeof (window as unknown as { API?: { LMSInitialize?: unknown } }).API?.LMSInitialize).catch(() => 'undefined');
    if (t === 'function') return;
    if (Date.now() > deadline) throw new Error(`window.API is not ready in the runtime frame after ${timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * A new page load of the runtime page (= a new session). Waits until the old document is gone (a marker set before the
 * reload has disappeared) and window.API exists in the new one; a plain waitForLoadState can still see the old page.
 */
export async function reloadRuntime(player: Pick<Player, 'runtime'>, timeoutMs = 20_000): Promise<void> {
  await player.runtime.evaluate(() => {
    (window as unknown as { __qaOldPage?: boolean }).__qaOldPage = true;
    location.reload();
  });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const ready = await player.runtime
      .evaluate(() => !(window as unknown as { __qaOldPage?: boolean }).__qaOldPage && typeof (window as unknown as { API?: { LMSInitialize?: unknown } }).API?.LMSInitialize === 'function')
      .catch(() => false);
    if (ready) return;
    if (Date.now() > deadline) throw new Error(`the runtime page did not reload with window.API within ${timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

// ---------------------------------------------------------------- RuntimeState and commits

export interface RuntimeState {
  format: string;
  packageBaseUrl: string;
  launchPath: string;
  preview: boolean;
  learner: { id: string; name: string };
  sessionId: string;
  lastSeq: number;
  scorm: { cmi: Record<string, unknown>; entry: string; masteryScore: number | null; launchData: string; credit: string } | null;
  html: { profile: Record<string, unknown>; progress: { seenPages: string[]; answers: Record<string, string> } } | null;
}

export async function runtimeState(token: string): Promise<{ status: number; json: RuntimeState | null; body: string }> {
  const res = await httpsRequest(`${CONTENT}/rt/${encodeURIComponent(token)}/state`, { timeoutMs: 15_000 });
  let json: RuntimeState | null = null;
  try {
    json = JSON.parse(res.body) as RuntimeState;
  } catch {
    json = null;
  }
  return { status: res.status, json, body: res.body };
}

/** RuntimeState after the package stopped committing (lastSeq unchanged for `quietMs`). */
export async function settledState(token: string, quietMs = 2_500, timeoutMs = 30_000): Promise<RuntimeState> {
  const deadline = Date.now() + timeoutMs;
  let last = await runtimeState(token);
  let since = Date.now();
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    const now = await runtimeState(token);
    if (now.json?.lastSeq !== last.json?.lastSeq) {
      last = now;
      since = Date.now();
    } else if (Date.now() - since >= quietMs) break;
  }
  if (last.status !== 200 || !last.json) throw new Error(`RuntimeState: HTTP ${last.status} ${last.body.slice(0, 200)}`);
  return last.json;
}

/** A SCORM commit body (contract §7). Unset fields keep the shape of the contract example. */
export function scormCommit(
  sessionId: string,
  seq: number,
  event: 'commit' | 'finish' | 'unload',
  core: Record<string, unknown> = {},
  rest: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    kind: 'scorm12',
    event,
    sessionId,
    seq,
    cmi: {
      core: { lesson_status: 'incomplete', lesson_location: '', score: { raw: '', min: '', max: '' }, session_time: '0000:00:01.00', exit: '', ...core },
      suspend_data: '',
      comments: '',
      interactions: [],
      objectives: [],
      ...rest,
    },
  };
}

/** The saved suspend_data of the attempt, if RuntimeState shows it (kept in QA commits, so progress is not erased). */
export function savedSuspendData(state: RuntimeState): string {
  const cmi = (state.scorm?.cmi ?? {}) as Record<string, unknown>;
  const v = cmi.suspend_data ?? cmi['cmi.suspend_data'];
  return typeof v === 'string' ? v : '';
}

/** POST /rt/{token}/commit from the runtime frame (same origin, like the runtime does). */
export async function commitFromRuntime(runtime: Frame, token: string, body: Record<string, unknown>): Promise<{ status: number; body: string }> {
  return runtime.evaluate(
    async ([t, b]) => {
      const r = await fetch(`/rt/${t}/commit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
      return { status: r.status, body: await r.text() };
    },
    [token, body] as const,
  );
}

/** POST /rt/{token}/commit from Node (negative cases). */
export async function commitFromNode(token: string, body: unknown): Promise<{ status: number; body: string; json: Record<string, unknown> | null }> {
  const payload = JSON.stringify(body);
  const res = await httpsRequest(`${CONTENT}/rt/${encodeURIComponent(token)}/commit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(payload)) },
    body: payload,
    timeoutMs: 15_000,
  });
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(res.body) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { status: res.status, body: res.body, json };
}

// ---------------------------------------------------------------- log events of the app and the content host

/** Events of both app log files (the content host may log in either; contract §12 names both files). */
export function appEvents(sinceMs: number, predicate: (e: LogEntry) => boolean): LogEntry[] {
  return [...eventsSince('cogniate-content', sinceMs, predicate), ...eventsSince('cogniate-app', sinceMs, predicate)];
}

export async function waitForAppEvent(predicate: (e: LogEntry) => boolean, sinceMs: number, timeoutMs = 30_000): Promise<LogEntry | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = appEvents(sinceMs, predicate)[0];
    if (found || Date.now() > deadline) return found;
    await new Promise((r) => setTimeout(r, 500));
  }
}

export function commitEvents(sessionId: string, sinceMs = 0): LogEntry[] {
  return appEvents(sinceMs, (e) => e.event === 'commit_accepted' && e.session_id === sessionId);
}

const COMMIT_KINDS = ['commit', 'finish', 'unload', 'progress'];
/**
 * The commit event (commit, finish, unload, progress) of a commit_accepted line: contract §12 field `commit_event`
 * (d7a88ec). QA prefers a key with "event" in its name (commit_event), then any other field with a commit-kind value.
 */
export function commitKind(e: LogEntry): string {
  const fields = Object.entries(e).filter(([k, v]) => k !== 'event' && typeof v === 'string' && COMMIT_KINDS.includes(v as string));
  const named = fields.find(([k]) => /event/i.test(k)) ?? fields.find(([k]) => /kind|type|commit/i.test(k)) ?? fields[0];
  return named ? String(named[1]) : '';
}

/** Waits for a commit_accepted line of this session with this commit kind. */
export async function waitForCommit(sessionId: string, kind: string, sinceMs: number, timeoutMs = 20_000): Promise<LogEntry | undefined> {
  return waitForAppEvent((e) => e.event === 'commit_accepted' && e.session_id === sessionId && commitKind(e) === kind, sinceMs, timeoutMs);
}

// ---------------------------------------------------------------- the course driver (real package, real pages)

export interface DriveOptions {
  /** Which option to click: the one with data-cog-correct="true", "false", both in this order, or none. */
  answer: 'correct' | 'wrong' | 'wrong-then-correct' | 'none';
  /** Stay ≥ 11 s on the lesson page (the 10 s dwell rule). Default true. */
  dwell?: boolean;
  /** Scroll the lesson page to the end. Default true. */
  scroll?: boolean;
}

/** Menu page → lesson page (DOM click on a lesson link; some copies are hidden) → answer → scroll → 11 s dwell. */
export async function driveCourse(player: Pick<Player, 'popup'>, opts: DriveOptions): Promise<Frame> {
  const { answer, dwell = true, scroll = true } = opts;
  const menu = await packageFrame(player, 'index.html');
  await menu.evaluate((lesson) => {
    const link = document.querySelector(`a[href="${lesson}.html"]`) as HTMLAnchorElement | null;
    if (!link) throw new Error('no link to the lesson page on the menu page');
    link.click();
  }, LESSON);
  const lesson = await packageFrame(player, `${LESSON}.html`);
  await player.popup.bringToFront();
  const click = async (flag: 'true' | 'false') => {
    const input = lesson.locator(`[data-cog-quiz] input[data-cog-correct="${flag}"]`).first();
    await input.scrollIntoViewIfNeeded();
    await input.click();
  };
  if (answer === 'correct') await click('true');
  if (answer === 'wrong') await click('false');
  if (answer === 'wrong-then-correct') {
    await click('false');
    await click('true');
  }
  const toEnd = () => lesson.evaluate(() => window.scrollTo(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)));
  if (scroll) await toEnd();
  if (dwell) {
    await player.popup.waitForTimeout(11_000); // the 10 s dwell rule (fixed wait allowed: tasks README §2)
    if (scroll) await toEnd();
  }
  return lesson;
}

// ---------------------------------------------------------------- results (contract §5) and the Moodle oracle

export interface ResultRow {
  learner: { sub: string; label: string };
  activity: { resourceLinkId: string; contextTitle: string; title: string };
  preview: boolean;
  best: { attemptId: string; outcome: string; scoreGiven: number | null; scoreMaximum: number | null } | null;
  attempts: { attemptId: string; versionId: string; outcome: string; scoreGiven: number | null; scoreMaximum: number | null; updatedAt: string }[];
  scoreSyncs: { id: string; status: string; tries: number; scoreGiven: number; scoreMaximum: number; createdAt: string; sentAt: string | null; lastError: string | null }[];
  gradebook: { resultScore: number | null; resultMaximum: number | null; readAt: string } | null;
  gradebookDiffers?: boolean;
}

let thanh: Session | undefined;
export async function thanhSession(): Promise<Session> {
  thanh ??= await signIn(THANH);
  return thanh;
}

export async function results(publicationId: string): Promise<ResultRow[]> {
  const s = await thanhSession();
  const res = await appApi<{ rows: ResultRow[] }>('GET', `/app-api/publications/${encodeURIComponent(publicationId)}/results`, { cookie: s.cookie });
  if (res.status !== 200) throw new Error(`results of ${publicationId}: HTTP ${res.status} ${res.body.slice(0, 200)}`);
  return res.json.rows ?? [];
}

export function rowsFor(rows: ResultRow[], user: MoodleUser, activityTitle: string, preview = false): ResultRow[] {
  return rows.filter((r) => r.learner.sub === String(user.id) && r.activity.title === activityTitle && Boolean(r.preview) === preview);
}

/** Polls the results until `test` passes for the row of this learner and activity; returns the last row seen. */
export async function waitForRow(
  publicationId: string,
  user: MoodleUser,
  activityTitle: string,
  test: (row: ResultRow) => boolean,
  { timeoutMs = 60_000, preview = false }: { timeoutMs?: number; preview?: boolean } = {},
): Promise<ResultRow | undefined> {
  const deadline = Date.now() + timeoutMs;
  let row: ResultRow | undefined;
  for (;;) {
    row = rowsFor(await results(publicationId), user, activityTitle, preview)[0];
    if ((row && test(row)) || Date.now() > deadline) return row;
    await new Promise((r) => setTimeout(r, 2_000));
  }
}

/** The grade that Moodle shows for the activity (final grade: a teacher override counts), and the override flag. */
export async function moodleShown(courseId: number, user: MoodleUser, itemName: string): Promise<{ shown: number | null; overridden: boolean; raw: number | null } | undefined> {
  const items = await gradeItems(seed().oracleToken, courseId, user.id);
  const item = items.find((i) => i.itemname === itemName);
  if (!item) return undefined;
  const shown = item.gradeformatted !== undefined && item.gradeformatted !== '-' && item.gradeformatted !== '' ? Number.parseFloat(item.gradeformatted) : null;
  return { shown: Number.isNaN(shown) ? null : shown, overridden: Boolean(item.gradeisoverridden), raw: item.graderaw };
}

export async function moodleGrade(courseId: number, user: MoodleUser, itemName: string): Promise<number | null | undefined> {
  const items = await gradeItems(seed().oracleToken, courseId, user.id);
  const item = items.find((i) => i.itemname === itemName);
  return item ? item.graderaw : undefined;
}

export async function completionState(courseId: number, user: MoodleUser, cmid: number): Promise<number | undefined> {
  const res = await callWs<{ statuses: { cmid: number; state: number }[] }>(seed().oracleToken, 'core_completion_get_activities_completion_status', {
    courseid: courseId,
    userid: user.id,
  });
  return res.statuses.find((s) => s.cmid === cmid)?.state;
}

/** Polls the QA oracle until the learner's grade for the activity is `want` (and completion is done, if asked). */
export async function waitForMoodle(
  courseId: number,
  user: MoodleUser,
  activityName: string,
  want: number,
  { cmid, timeoutMs = 60_000 }: { cmid?: number; timeoutMs?: number } = {},
): Promise<{ grade: number | null | undefined; completion: number | undefined }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const grade = await moodleGrade(courseId, user, activityName);
    const completion = cmid ? await completionState(courseId, user, cmid) : undefined;
    const ok = grade !== null && grade !== undefined && Math.abs(Number(grade) - want) < 0.001 && (!cmid || (completion ?? 0) >= 1);
    if (ok || Date.now() > deadline) return { grade, completion };
    await new Promise((r) => setTimeout(r, 2_000));
  }
}

// ---------------------------------------------------------------- T5b: score syncs, hanging hosts, Moodle UI steps

export async function resendSync(syncId: string): Promise<{ status: number; json: Record<string, unknown> | null; body: string }> {
  const s = await thanhSession();
  const res = await appApi<Record<string, unknown>>('POST', `/app-api/score-syncs/${encodeURIComponent(syncId)}/resend`, { cookie: s.cookie });
  return { status: res.status, json: res.json, body: res.body };
}

export async function refreshResults(publicationId: string): Promise<{ status: number; rows: ResultRow[]; body: string }> {
  const s = await thanhSession();
  const res = await appApi<{ rows: ResultRow[] }>('POST', `/app-api/publications/${encodeURIComponent(publicationId)}/results/refresh`, { cookie: s.cookie });
  return { status: res.status, rows: res.json?.rows ?? [], body: res.body };
}

/**
 * A browser context in which every request to a host outside the stack and outside *.test hangs (no answer, not
 * blocked): AC-T5-36. `hung` records the URLs. Call `release()` before closing the context.
 */
export async function newHangingContext(browser: import('@playwright/test').Browser): Promise<{ context: BrowserContext; hung: string[]; release: () => Promise<void> }> {
  const stack = new Set(Object.values(urls).map((u) => new URL(u).hostname));
  const context = await browser.newContext({ ignoreHTTPSErrors: process.env.QA_IGNORE_HTTPS_ERRORS === '1', viewport: { width: 1440, height: 900 } });
  const hung: string[] = [];
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (stack.has(u.hostname) || u.hostname.endsWith('.test')) return route.continue();
    hung.push(`${u.origin}${u.pathname}`);
    return new Promise<void>(() => undefined); // never answered
  });
  return { context, hung, release: () => context.unrouteAll({ behavior: 'ignoreErrors' }) };
}

/** Full name and email of a Moodle user in a course (QA oracle core_enrol_get_enrolled_users). */
export async function enrolledUser(courseId: number, userId: number): Promise<{ fullname: string; email: string; roles: string[] } | undefined> {
  const users = await callWs<{ id: number; fullname: string; email?: string; roles?: { shortname: string }[] }[]>(seed().oracleToken, 'core_enrol_get_enrolled_users', { courseid: courseId });
  const u = users.find((x) => x.id === userId);
  return u ? { fullname: u.fullname, email: u.email ?? '', roles: (u.roles ?? []).map((r) => r.shortname) } : undefined;
}

/** Moodle 5.2.4 Participants page: the row of the user (name link /user/view.php?id=<id>&course=…) → Unenrol → confirm. */
export async function unenrolInUi(page: Page, courseId: number, userId: number): Promise<void> {
  await page.goto(`${urls.moodle}/user/index.php?id=${courseId}&perpage=5000`);
  const row = page.locator(`tr:has(a[href*="/user/view.php?id=${userId}&"])`).first();
  await row.locator('[data-action="unenrol"]').first().click();
  await page.locator('.modal.show [data-action="save"]').click();
  await row.waitFor({ state: 'detached', timeout: 20_000 });
}

/** Moodle 5.2.4 Participants page → "Enrol users" (enrol_manual) → find by email → role Student → Enrol users. */
export async function enrolInUi(page: Page, courseId: number, email: string): Promise<void> {
  await page.goto(`${urls.moodle}/user/index.php?id=${courseId}&perpage=5000`);
  await page.locator(".enrolusersbutton.enrol_manual_plugin [type='submit']").first().click();
  const modal = page.locator('.modal.show');
  const search = modal.locator('input[id^="form_autocomplete_input"]').first();
  await search.fill(email);
  await modal.locator('[role="option"]', { hasText: email }).first().click();
  const role = modal.locator('#id_roletoassign');
  if (await role.count()) await role.selectOption({ label: 'Student' });
  await modal.locator('[data-action="save"]').click();
  await modal.waitFor({ state: 'detached', timeout: 20_000 });
}

/** Moodle 5.2.4 grader report (cg_teacher): Edit mode on, type the grade into grade_<userid>_<itemid>, Save changes. */
export async function overrideGradeInUi(page: Page, courseId: number, userId: number, itemId: number, value: string): Promise<void> {
  await page.goto(`${urls.moodle}/grade/report/grader/index.php?id=${courseId}`);
  const cell = page.locator(`#grade_${userId}_${itemId}`);
  if (!(await cell.count())) {
    await Promise.all([page.waitForLoadState('load'), page.locator('input[name="setmode"]').first().click()]);
    await page.goto(`${urls.moodle}/grade/report/grader/index.php?id=${courseId}`);
  }
  await cell.fill(value);
  await Promise.all([page.waitForLoadState('load'), page.locator('#gradersubmit').click()]);
}
