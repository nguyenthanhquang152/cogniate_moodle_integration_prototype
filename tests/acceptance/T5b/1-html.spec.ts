// T5b: the HTML runtime with the real HTML package. Source: tasks/T5b.md AC-T5-09, AC-T5-36, AC-T5-10; contract
// cogniate-app-api.md §7 (content host), §9 (HTML runtime markup); ADR-004 "HTML: option C" (attach when the child
// document is parsed, not on load; no change of package bytes); ADR-010 (mapping).
// AC-T5-36 uses its own activity "Cogniate HTML AC-T5-36" (tasks/T5b.md).
import crypto from 'node:crypto';
import { courseZipCopy } from '../lib/course-fixtures';
import { httpsRequest } from '../lib/https';
import { newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import { readZip } from '../lib/zip';
import {
  ACT,
  CONTENT,
  cmidOf,
  course101,
  driveCourse,
  LESSON,
  markRan,
  newHangingContext,
  openPlayer,
  packageFrame,
  t5,
  waitForMoodle,
  waitForRow,
} from '../lib/t5';

test('AC-T5-09 HTML pass: cg_student in "Cogniate HTML" (menu, lesson ≥ 11 s + scroll, correct option); the runtime reads body[data-lesson-id]; within 60 s Moodle 100 and completion done; row passed, one sync sent', async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await newStackContext(browser);
  try {
    const user = seed().users.cg_student;
    const player = await openPlayer(context, user, cmidOf(ACT.html));
    const menu = await packageFrame(player, 'index.html');
    expect(await menu.evaluate(() => document.body.getAttribute('data-lesson-id')), 'menu page key').toBe('index');
    const lesson = await driveCourse(player, { answer: 'correct' });
    expect(await lesson.evaluate(() => document.body.getAttribute('data-lesson-id')), 'lesson page key').toBe(LESSON);
    const done = Date.now();
    const left = () => Math.max(1_000, done + 60_000 - Date.now());
    const moodle = await waitForMoodle(course101(), user, ACT.html, 100, { cmid: cmidOf(ACT.html), timeoutMs: left() });
    expect(moodle.grade, 'Moodle grade').toBe(100);
    expect(moodle.completion ?? 0, 'completion done').toBeGreaterThanOrEqual(1);
    const row = await waitForRow(String(t5().htmlPublicationId), user, ACT.html, (r) => r.scoreSyncs.some((s) => s.status === 'sent'), { timeoutMs: left() });
    expect(row?.best?.outcome, JSON.stringify(row)).toBe('passed');
    expect(row?.scoreSyncs.map((s) => s.status)).toEqual(['sent']);
    markRan('AC-T5-09');
  } finally {
    await context.close();
  }
});

test('AC-T5-36 hanging hosts: every non-*.test request hangs; cg_student completes the HTML course → passed and 100 in Moodle within 60 s', async ({ browser }) => {
  test.setTimeout(240_000);
  const { context, hung, release } = await newHangingContext(browser);
  try {
    const user = seed().users.cg_student;
    const player = await openPlayer(context, user, cmidOf(ACT.htmlHang));
    await driveCourse(player, { answer: 'correct' });
    const done = Date.now();
    const left = () => Math.max(1_000, done + 60_000 - Date.now());
    const moodle = await waitForMoodle(course101(), user, ACT.htmlHang, 100, { timeoutMs: left() });
    expect(moodle.grade, 'Moodle grade').toBe(100);
    const row = await waitForRow(String(t5().htmlPublicationId), user, ACT.htmlHang, (r) => r.best?.outcome === 'passed', { timeoutMs: left() });
    expect(row?.best?.outcome, JSON.stringify(row)).toBe('passed');
    expect(hung.length, 'requests to outside hosts that QA kept hanging (S3 images, Google fonts)').toBeGreaterThan(0);
    test.info().annotations.push({ type: 'hung requests', description: [...new Set(hung)].slice(0, 20).join(' | ') });
  } finally {
    await release();
    await context.close();
  }
});

test('AC-T5-10 the HTML package bytes are not changed: SHA-256 of GET /pkg/<id>/<path> = SHA-256 of the zip entry, for every file', async () => {
  test.setTimeout(180_000);
  const pkg = String(t5().html?.packageId ?? '');
  expect(pkg, 'T5 setup: the HTML packageId').toBeTruthy();
  const entries = readZip(courseZipCopy('html'));
  expect(entries.length, 'files in the HTML zip').toBeGreaterThan(0);
  const problems: string[] = [];
  for (const e of entries) {
    const url = `${CONTENT}/pkg/${pkg}/${e.name.split('/').map(encodeURIComponent).join('/')}`;
    const res = await httpsRequest(url, { timeoutMs: 60_000 });
    const want = crypto.createHash('sha256').update(e.data).digest('hex');
    const got = crypto.createHash('sha256').update(res.raw ?? Buffer.alloc(0)).digest('hex');
    if (res.status !== 200 || got !== want) problems.push(`${e.name}: HTTP ${res.status}, SHA-256 ${got.slice(0, 12)} ≠ ${want.slice(0, 12)}`);
  }
  test.info().annotations.push({ type: 'files', description: entries.map((e) => `${e.name} (${e.data.length} B)`).join(', ') });
  expect(problems).toEqual([]);
});

// T5b round 2 (Reviewer-A A-T5b-01, Lead request): the proxy drops Cookie to the content host (contract §7, security
// §7), so a package that sets large cookies on the content origin must not block that origin. Round 1 evidence:
// HTTP/1.1 10 × 4,000 characters → 431; HTTP/2 5 × 4,000 → GOAWAY. Two oracles: a Node HTTP/1.1 request with one
// joined Cookie header (5 and 10 cookies), and Chromium (HTTP/2, separate cookie fields) with 10 cookies on the
// content origin while cg_student opens "Cogniate HTML" again.
test('AC-T5-10 (A-T5b-01) 5 and 10 cookies of 4,000 characters on the content origin: GET /pkg/<id>/index.html → 200 with the same bytes; in Chromium the runtime page and the package load (every content response < 400)', async ({ browser }) => {
  test.setTimeout(180_000);
  const pkg = String(t5().html?.packageId ?? '');
  expect(pkg, 'T5 setup: the HTML packageId').toBeTruthy();
  const index = readZip(courseZipCopy('html')).find((e) => e.name === 'index.html');
  expect(index, 'index.html in the HTML zip').toBeDefined();
  const sha = (b: Buffer | undefined) => crypto.createHash('sha256').update(b ?? Buffer.alloc(0)).digest('hex');
  const value = 'c'.repeat(4_000);
  for (const n of [5, 10]) {
    const cookie = Array.from({ length: n }, (_, i) => `qa_big_${i}=${value}`).join('; ');
    const res = await httpsRequest(`${CONTENT}/pkg/${pkg}/index.html`, { headers: { cookie }, timeoutMs: 30_000 });
    expect(res.status, `HTTP/1.1, ${n} × 4,000 (${cookie.length} B): ${res.body.slice(0, 120)}`).toBe(200);
    expect(sha(res.raw), `HTTP/1.1, ${n} cookies: same bytes as the zip entry`).toBe(sha(index!.data));
  }

  const context = await newStackContext(browser);
  try {
    await context.addCookies(Array.from({ length: 10 }, (_, i) => ({ name: `qa_big_${i}`, value, url: CONTENT })));
    const seen: string[] = [];
    const bad: string[] = [];
    const cookieLengths: number[] = [];
    const pending: Promise<void>[] = [];
    context.on('response', (r) => {
      if (!r.url().startsWith(`${CONTENT}/`)) return;
      const where = `${r.status()} ${new URL(r.url()).pathname.split('/').slice(0, 2).join('/')}`;
      seen.push(where);
      if (r.status() >= 400) bad.push(`${where} (${r.url().slice(0, 120)})`);
      pending.push(
        r
          .request()
          .allHeaders()
          .then((h) => {
            cookieLengths.push((h.cookie ?? '').length);
          })
          .catch(() => undefined),
      );
    });
    context.on('requestfailed', (q) => {
      if (q.url().startsWith(`${CONTENT}/`)) bad.push(`failed ${q.failure()?.errorText ?? ''} (${q.url().slice(0, 120)})`);
    });
    const player = await openPlayer(context, seed().users.cg_student, cmidOf(ACT.html));
    const frame = await packageFrame(player, 'index.html');
    expect(await frame.evaluate(() => document.readyState), 'the package page loads').not.toBe('loading');
    await player.popup.close({ runBeforeUnload: true }).catch(() => undefined);
    await Promise.all(pending);
    const sentMax = Math.max(0, ...cookieLengths);
    test.info().annotations.push({ type: 'content responses', description: `${seen.length}: ${[...new Set(seen)].join(', ')}; largest Cookie header sent by Chromium: ${sentMax} B` });
    expect(sentMax, 'Chromium sent the large cookies to the content origin').toBeGreaterThanOrEqual(40_000);
    expect(seen.some((x) => x.endsWith('/rt')), 'the runtime page answered').toBe(true);
    expect(seen.some((x) => x.endsWith('/pkg')), 'package files answered').toBe(true);
    expect(bad).toEqual([]);
  } finally {
    await context.close();
  }
});
