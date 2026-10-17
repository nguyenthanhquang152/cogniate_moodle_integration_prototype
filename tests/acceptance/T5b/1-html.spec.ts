// T5b: the HTML runtime with the real HTML package. Source: tasks/T5b.md AC-T5-09, AC-T5-36, AC-T5-10; contract
// cogniate-app-api.md §7 (content host), §9 (HTML runtime markup); ADR-004 "HTML: option C" (attach when the child
// document is parsed, not on load; no change of package bytes); ADR-010 (mapping).
// AC-T5-36 uses QA's activity "QA HTML hang" (a fresh attempt for cg_student after AC-T5-09).
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
