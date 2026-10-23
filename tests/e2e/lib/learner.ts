// Learner steps: open the activity from the Moodle course page (launch container "New window"), then do the course in
// the real package. Course facts (flows §6c, contract §3 fixture values): two pages ("index" = menu,
// "lesson-ai-web-sprint"), one question, mastery 70. A page counts as seen after 10 s of visible time and a scroll to the
// end; the first answer stands. The SCORM package calls LMSFinish itself when all pages are seen and the question is
// answered. Rule (tasks README §2): never use window.CogniateSCORM.markLessonComplete.
import type { BrowserContext, Frame, Page } from '@playwright/test';
import type { MoodleUser } from '../../acceptance/lib/seed';
import { diagnosticUrl } from '../../acceptance/M1/canvas/browser-diagnostics.mjs';
import { type Capture, captureLti } from './capture';
import { recordSecret, urls } from './e2e';
import { login, moodlePage } from './moodle';

export const LESSON = 'lesson-ai-web-sprint';

export interface Launch {
  coursePage: Page;
  popup: Page;
  playUrl: string;
  msToPlay: number;
  /** URL of the Moodle page when the player window opened (it must stay on Moodle). */
  coursePageUrl: string;
  hasOpener: boolean;
  runtimeToken: string;
  capture: Capture;
}

/** Signs in (if needed), opens the course page, clicks the activity link, and waits for the player window. */
export async function launchFromCourse(context: BrowserContext, user: MoodleUser, courseId: number, activityName: string, where: string): Promise<Launch> {
  const coursePage = context.pages().find((p) => p.url().startsWith(urls.moodle)) ?? (await moodlePage(context));
  if (!(await coursePage.locator('a[href*="/login/logout.php"]').count())) await login(coursePage, user);
  await coursePage.goto(`${urls.moodle}/course/view.php?id=${courseId}`);
  const capture = await captureLti(context, where);
  const link = coursePage.locator('a.aalink', { has: coursePage.locator('.instancename', { hasText: activityName }) }).first();
  await link.waitFor({ timeout: 15_000 });
  const t0 = Date.now();
  const popupPromise = context.waitForEvent('page', { timeout: 20_000 });
  await link.click();
  const popup = await popupPromise;
  await popup.waitForURL((u) => u.href.startsWith(`${urls.app}/play/`), { timeout: 30_000, waitUntil: 'commit' });
  const msToPlay = Date.now() - t0;
  recordSecret('play_id', new URL(popup.url()).pathname.split('/')[2], `${where}: player URL`);
  await popup.waitForLoadState('domcontentloaded');
  const runtime = await waitForFrame(popup, (u) => u.startsWith(`${urls.content}/rt/`));
  const runtimeToken = new URL(runtime.url()).pathname.split('/')[2] ?? '';
  recordSecret('runtime_token', runtimeToken, `${where}: runtime frame`);
  return {
    coursePage,
    popup,
    playUrl: popup.url(),
    msToPlay,
    coursePageUrl: coursePage.url(),
    hasOpener: (await popup.opener()) !== null,
    runtimeToken,
    capture,
  };
}

export async function waitForFrame(page: Page, test: (url: string) => boolean, timeoutMs = 30_000): Promise<Frame> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const f = page.frames().find((fr) => test(fr.url()));
    if (f) return f;
    if (Date.now() > deadline) throw new Error(`no frame matched within ${timeoutMs} ms (frames: ${page.frames().map((fr) => diagnosticUrl(fr.url())).join(' | ')})`);
    await page.waitForTimeout(200);
  }
}

/** The package frame (content origin /pkg/…) that shows `file`. */
export async function packageFrame(popup: Page, file: string, timeoutMs = 30_000): Promise<Frame> {
  const f = await waitForFrame(popup, (u) => u.startsWith(`${urls.content}/pkg/`) && new URL(u).pathname.endsWith(`/${file}`), timeoutMs);
  await f.waitForLoadState('domcontentloaded');
  return f;
}

/** Clicks that QA had to do as DOM clicks (listed in the test annotations). */
export const domClicks: string[] = [];

/** Menu page → lesson page → the option → scroll to the end → stay 11 s → scroll again. */
export async function doCourse(popup: Page, answer: 'correct' | 'wrong'): Promise<void> {
  const menu = await packageFrame(popup, 'index.html');
  // The menu page has more than one link to the lesson (some are hidden): click the first visible one.
  const links = menu.locator(`a[href="${LESSON}.html"]`);
  await links.first().waitFor({ state: 'attached', timeout: 15_000 });
  const n = await links.count();
  let clicked = false;
  for (let i = 0; i < n && !clicked; i++) {
    if (await links.nth(i).isVisible()) {
      // A decorative layer of the HTML package can cover the link (Playwright then refuses the click): fall back to
      // a DOM click on the same link.
      clicked = await links.nth(i).click({ timeout: 5_000 }).then(() => true, () => false);
      if (!clicked) {
        await links.nth(i).evaluate((a) => (a as HTMLAnchorElement).click());
        clicked = true;
        domClicks.push('lesson link (covered by a decorative layer)');
      }
    }
  }
  if (!clicked) {
    await links.first().evaluate((a) => (a as HTMLAnchorElement).click());
    domClicks.push('lesson link (no visible copy)');
  }
  const lesson = await packageFrame(popup, `${LESSON}.html`);
  await popup.bringToFront();
  const option = lesson.locator(`[data-cog-quiz] input[data-cog-correct="${answer === 'correct' ? 'true' : 'false'}"]`).first();
  await option.scrollIntoViewIfNeeded();
  if (!(await option.click({ timeout: 5_000 }).then(() => true, () => false))) {
    await option.evaluate((el) => (el as HTMLInputElement).click());
    domClicks.push(`${answer} option (click refused)`);
  }
  const toEnd = () => lesson.evaluate(() => window.scrollTo(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)));
  await toEnd();
  await popup.waitForTimeout(11_000); // the 10 s dwell rule (fixed wait allowed: tasks README §2)
  await toEnd();
}

export async function shellText(popup: Page): Promise<string> {
  return (await popup.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
}
