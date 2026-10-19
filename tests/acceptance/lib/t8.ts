// T8 helpers (black-box, from tasks/T8.md and app contract §11): `.mbz` builds through the app API, the `.mbz` file
// (tar.gz) and its moodle_backup.xml, Moodle's own SCORM player, and the T8 host actions (tests/host/run-t8.mjs).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { Frame, Page } from '@playwright/test';
import { APP, appApi, createCourse, type Session, uploadVersion } from './app';
import { publicUrls } from './env';
import { CONTROL_DIR, type HostAction, hostAction } from './host-control';
import { httpsRequest } from './https';
import { loadState, saveState } from './lti';
import { blankScoZip } from './t5';

const urls = publicUrls();
export const LESSON = 'lesson-ai-web-sprint';

export interface MbzBuild {
  buildId: string;
  courseId: string;
  versionId: string;
  status: 'queued' | 'running' | 'ready' | 'failed';
  step: string | null;
  reason: string | null;
  bytes: number | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  downloadUrl: string | null;
}

export interface T8State {
  runId: string;
  /** The SCORM course and version that AC-T8-02 builds (Thanh's "Cogniate SCORM" course of the T5a setup). */
  courseId: string;
  versionId: string;
  buildId?: string;
  /** The downloaded .mbz in the control folder (file name), for the host restore (AC-T8-05). */
  mbzFile?: string;
  mbzBytes?: number;
  restoredCourseId?: number;
  restoredCmid?: number;
  /** AC-T8-09 (API) and AC-T8-10 (UI): QA courses with a blank SCO version, for the course shell. */
  shellApi?: { courseId: string; versionId: string };
  shellUi?: { courseId: string; versionId: string };
}

export function t8(): Partial<T8State> {
  return loadState('T8') as Partial<T8State>;
}

export function saveT8(patch: Partial<T8State>): void {
  saveState('T8', patch as Record<string, unknown>);
}

const mbzPath = (courseId: string, versionId: string) => `/app-api/courses/${encodeURIComponent(courseId)}/versions/${encodeURIComponent(versionId)}/mbz`;

export async function startMbz(s: Session, courseId: string, versionId: string) {
  return appApi<MbzBuild>('POST', mbzPath(courseId, versionId), { cookie: s.cookie });
}

export async function getMbz(s: Session, courseId: string, versionId: string) {
  return appApi<MbzBuild>('GET', mbzPath(courseId, versionId), { cookie: s.cookie });
}

/** Polls GET …/mbz until `test` passes or the time is over; returns the last build seen. */
export async function waitMbz(s: Session, courseId: string, versionId: string, test: (b: MbzBuild) => boolean, timeoutMs: number): Promise<MbzBuild | null> {
  const deadline = Date.now() + timeoutMs;
  let last: MbzBuild | null = null;
  for (;;) {
    const res = await getMbz(s, courseId, versionId);
    if (res.status === 200) last = res.json;
    if ((last && test(last)) || Date.now() > deadline) return last;
    await new Promise((r) => setTimeout(r, 3_000));
  }
}

/** GET …/download?kind=mbz as bytes. */
export async function downloadMbz(s: Session, courseId: string, versionId: string): Promise<{ status: number; type: string; data: Buffer }> {
  const url = `${APP}/app-api/courses/${encodeURIComponent(courseId)}/versions/${encodeURIComponent(versionId)}/download?kind=mbz`;
  const res = await httpsRequest(url, { headers: { cookie: s.cookie }, timeoutMs: 120_000 });
  return { status: res.status, type: String(res.headers['content-type'] ?? ''), data: res.raw ?? Buffer.alloc(0) };
}

export interface TarEntry {
  name: string;
  type: string;
  data: Buffer;
}

/** A gzip tar file (ustar), as Moodle writes its .mbz. Node built-ins only. */
export function readTarGz(buf: Buffer): TarEntry[] {
  const tar = zlib.gunzipSync(buf);
  const out: TarEntry[] = [];
  let off = 0;
  let longName = '';
  while (off + 512 <= tar.length) {
    const h = tar.subarray(off, off + 512);
    if (h.every((b) => b === 0)) break;
    const str = (a: number, n: number) => h.subarray(a, a + n).toString('utf8').replace(/\0.*$/s, '');
    const size = Number.parseInt(str(124, 12).trim() || '0', 8);
    const type = str(156, 1) || '0';
    const prefix = str(345, 155);
    let name = prefix ? `${prefix}/${str(0, 100)}` : str(0, 100);
    const data = tar.subarray(off + 512, off + 512 + size);
    if (type === 'L') {
      longName = data.toString('utf8').replace(/\0.*$/s, '');
    } else {
      if (longName) {
        name = longName;
        longName = '';
      }
      out.push({ name: name.replace(/^\.\//, ''), type, data: Buffer.from(data) });
    }
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}

export interface BackupInfo {
  release: string;
  usersSetting: string | null;
  activities: { modulename: string; title: string }[];
}

/** moodle_backup.xml: moodle_release, the root setting "users", and the activities list. */
export function backupInfo(xml: string): BackupInfo {
  const release = xml.match(/<moodle_release>([^<]*)<\/moodle_release>/)?.[1] ?? '';
  const settings = [...xml.matchAll(/<setting>([\s\S]*?)<\/setting>/g)].map((m) => m[1] ?? '');
  const users = settings.find((s) => /<level>root<\/level>/.test(s) && /<name>users<\/name>/.test(s));
  const usersSetting = users?.match(/<value>([^<]*)<\/value>/)?.[1] ?? null;
  const activitiesBlock = xml.match(/<activities>([\s\S]*?)<\/activities>/)?.[1] ?? '';
  const activities = [...activitiesBlock.matchAll(/<activity>([\s\S]*?)<\/activity>/g)].map((m) => ({
    modulename: m[1]?.match(/<modulename>([^<]*)<\/modulename>/)?.[1] ?? '',
    title: m[1]?.match(/<title>([^<]*)<\/title>/)?.[1] ?? '',
  }));
  return { release, usersSetting, activities };
}

/** Writes bytes into the control folder (shared with the host runner) and returns the file name. */
export function saveToControl(name: string, data: Buffer): string {
  const dir = CONTROL_DIR();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), data);
  return name;
}

/** A T8 host action; its JSON answer file (in the control folder) is parsed and returned. */
export async function hostJson<T = Record<string, unknown>>(action: HostAction, payload: Record<string, unknown> = {}, timeoutMs = 600_000): Promise<{ code: number; json: T | null; raw: string }> {
  const answer = await hostAction(action, timeoutMs, { payload, allowFail: true });
  const raw = answer.out ? fs.readFileSync(path.join(CONTROL_DIR(), answer.out), 'utf8') : '';
  let json: T | null = null;
  try {
    json = raw ? (JSON.parse(raw) as T) : null;
  } catch {
    json = null;
  }
  return { code: answer.code, json, raw };
}

// ---------------------------------------------------------------- Moodle's own SCORM player (AC-T8-06)

/** A frame of the SCORM package inside Moodle's player (pluginfile.php/…/mod_scorm/content/…/<page>). */
export async function moodlePackageFrame(page: Page, file: string, timeoutMs = 60_000): Promise<Frame> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const f = page.frames().find((fr) => {
      const u = fr.url();
      return u.startsWith(`${urls.moodle}/pluginfile.php/`) && u.includes('/mod_scorm/content/') && new URL(u).pathname.endsWith(`/${file}`);
    });
    if (f) {
      await f.waitForLoadState('domcontentloaded');
      return f;
    }
    if (Date.now() > deadline) throw new Error(`no SCORM package frame for ${file}; frames: ${page.frames().map((x) => x.url()).join(' | ').slice(0, 600)}`);
    await page.waitForTimeout(250);
  }
}

/**
 * The real Cogniate SCORM course in Moodle's player, as in AC-T5-07: menu page → lesson page → correct option →
 * scroll to the end → 11 s dwell (fixed wait allowed for the dwell rule: tasks README §2) → scroll again.
 */
export async function driveInMoodlePlayer(page: Page): Promise<Frame> {
  const menu = await moodlePackageFrame(page, 'index.html');
  await menu.evaluate((lesson) => {
    const link = document.querySelector(`a[href="${lesson}.html"]`) as HTMLAnchorElement | null;
    if (!link) throw new Error('no link to the lesson page on the menu page');
    link.click();
  }, LESSON);
  const lesson = await moodlePackageFrame(page, `${LESSON}.html`);
  const input = lesson.locator('[data-cog-quiz] input[data-cog-correct="true"]').first();
  await input.scrollIntoViewIfNeeded();
  await input.click();
  const toEnd = () => lesson.evaluate(() => window.scrollTo(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)));
  await toEnd();
  await page.waitForTimeout(11_000);
  await toEnd();
  return lesson;
}

// ---------------------------------------------------------------- build leftovers (AC-T8-03, -07)

export type Leftovers = { containers: { labelled: string[]; cogniateBuildAny: string[] }; volumes: { labelled: string[]; cogniateBuildAny: string[] }; networks: { labelled: string[]; cogniateBuildAny: string[] } };

/** Polls the host until this stack has no cogniate-build-* container, volume or network (teardown can take a few seconds). */
export async function noLeftovers(timeoutMs = 90_000): Promise<Leftovers | null> {
  const deadline = Date.now() + timeoutMs;
  let last: Leftovers | null = null;
  for (;;) {
    last = (await hostJson<Leftovers>('build-leftovers')).json;
    const n = last ? last.containers.labelled.length + last.volumes.labelled.length + last.networks.labelled.length : 1;
    if (n === 0 || Date.now() > deadline) return last;
    await new Promise((r) => setTimeout(r, 3_000));
  }
}


/** A new QA course with one blank SCO version (a fast build); returns the course and version ids. */
export async function newBlankVersion(s: Session, title: string): Promise<{ courseId: string; versionId: string }> {
  const course = await createCourse(s, title);
  const up = await uploadVersion(s, course.id, blankScoZip());
  if (up.status !== 201) throw new Error(`upload for "${title}": HTTP ${up.status} ${up.body.slice(0, 200)}`);
  return { courseId: course.id, versionId: String((up.json as { id?: string }).id ?? '') };
}
