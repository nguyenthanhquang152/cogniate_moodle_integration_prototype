// T5a: the content origin and the frames of the player. Source: tasks/T5a.md AC-T5-01 to -04; contract
// cogniate-app-api.md §6 (/play), §7 (content host); security §5, §7; ADR-004 (frames, CSP on package files).
// AC-T5-03 and AC-T5-04 share one cg_student launch of "Cogniate SCORM" (beforeAll). That launch starts cg_student's
// attempt; AC-T5-07 continues it.
import type { BrowserContext } from '@playwright/test';
import { APP } from '../lib/app';
import { httpsRequest } from '../lib/https';
import { newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import { ACT, CONTENT, cmidOf, openPlayer, packageFrame, type Player, t5 } from '../lib/t5';

/** The sources of the frame-ancestors directive of a CSP header. */
function frameAncestors(csp: string | string[] | undefined): string[] {
  const value = [csp ?? ''].flat().join(';');
  const d = value.split(';').map((x) => x.trim()).find((x) => x.startsWith('frame-ancestors'));
  return d ? d.split(/\s+/).slice(1) : [];
}

test('AC-T5-01 /pkg/<packageId>/index.html: 200 text/html, nosniff, frame-ancestors content + app, no Set-Cookie; raw ../ and %2e%2e/ paths → 400 or 404', async () => {
  const pkg = String(t5().scorm?.packageId ?? '');
  expect(pkg, 'T5 setup: the SCORM packageId').toBeTruthy();
  const index = await httpsRequest(`${CONTENT}/pkg/${pkg}/index.html`);
  expect(index.status).toBe(200);
  expect(String(index.headers['content-type'])).toMatch(/^text\/html/);
  expect(String(index.headers['x-content-type-options'])).toBe('nosniff');
  expect(frameAncestors(index.headers['content-security-policy']).sort()).toEqual([CONTENT, APP].sort());
  expect(index.headers['set-cookie'], 'no Set-Cookie').toBeUndefined();

  const host = new URL(CONTENT);
  const problems: string[] = [];
  for (const raw of [
    `/pkg/${pkg}/../${pkg}/index.html`,
    `/pkg/${pkg}/%2e%2e/${pkg}/index.html`,
    `/pkg/${pkg}/assets/../../${pkg}/index.html`,
    `/pkg/${pkg}/../../../../etc/passwd`,
    `/pkg/${pkg}/%2e%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd`,
  ]) {
    const res = await httpsRequest(`${host.origin}/`, { rawPath: raw });
    if (![400, 404].includes(res.status)) problems.push(`${raw}: HTTP ${res.status}, want 400 or 404`);
    if (res.body === index.body) problems.push(`${raw}: the body is the target file (index.html)`);
    if (/root:.*:0:0:/.test(res.body)) problems.push(`${raw}: the body is /etc/passwd`);
  }
  expect(problems).toEqual([]);
});

test('AC-T5-02 a Range request on assets/ask-lyra/lyra.mp4 → 206 video/mp4, Content-Range bytes 0-1023/10721508', async () => {
  const pkg = String(t5().scorm?.packageId ?? '');
  const res = await httpsRequest(`${CONTENT}/pkg/${pkg}/assets/ask-lyra/lyra.mp4`, { headers: { range: 'bytes=0-1023' } });
  expect(res.status).toBe(206);
  expect(String(res.headers['content-type'])).toMatch(/^video\/mp4/);
  expect(res.headers['content-range']).toBe('bytes 0-1023/10721508');
});

test.describe('T5a player frames (cg_student, "Cogniate SCORM")', () => {
  let context: BrowserContext;
  let player: Player;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    context = await newStackContext(browser);
    player = await openPlayer(context, seed().users.cg_student, cmidOf(ACT.scorm));
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T5-03 /rt/<token>: frame-ancestors app; random token → 404; runtime iframe sandbox and allow exact; fullscreenEnabled; no Permissions-Policy on the shell', async () => {
    const rt = await httpsRequest(`${CONTENT}/rt/${player.token}`);
    expect(rt.status).toBe(200);
    expect(frameAncestors(rt.headers['content-security-policy'])).toEqual([APP]);
    const random = await httpsRequest(`${CONTENT}/rt/${'A'.repeat(43)}`);
    expect(random.status).toBe(404);

    const iframe = await player.popup.evaluate((content) => {
      const el = Array.from(document.querySelectorAll('iframe')).find((f) => f.src.startsWith(`${content}/rt/`));
      return el ? { sandbox: el.getAttribute('sandbox'), allow: el.getAttribute('allow') } : null;
    }, CONTENT);
    expect(iframe, 'the shell has the runtime iframe').not.toBeNull();
    expect((iframe!.sandbox ?? '').trim().split(/\s+/).sort()).toEqual(['allow-same-origin', 'allow-scripts']);
    expect(iframe!.allow).toBe('autoplay; fullscreen');

    const pkgFrame = await packageFrame(player);
    expect(await pkgFrame.evaluate(() => document.fullscreenEnabled)).toBe(true);

    const shell = player.cap.play;
    expect(shell, 'the GET /play/<id> answer was recorded').toBeDefined();
    expect(shell!.headers['permissions-policy'], 'no Permissions-Policy header on the shell').toBeUndefined();
  });

  test('AC-T5-04 the runtime frame has window.API with the 8 SCORM 1.2 functions; the package frame has CogniateSCORM.available === true', async () => {
    const fns = await player.runtime.evaluate(() => {
      const api = (window as unknown as { API?: Record<string, unknown> }).API;
      return ['LMSInitialize', 'LMSFinish', 'LMSGetValue', 'LMSSetValue', 'LMSCommit', 'LMSGetLastError', 'LMSGetErrorString', 'LMSGetDiagnostic'].map((f) => [f, typeof api?.[f]]);
    });
    expect(fns.filter(([, t]) => t !== 'function'), 'functions that are missing').toEqual([]);
    const pkgFrame = await packageFrame(player);
    await expect.poll(() => pkgFrame.evaluate(() => (window as unknown as { CogniateSCORM?: { available?: boolean } }).CogniateSCORM?.available), { timeout: 15_000 }).toBe(true);
  });
});
