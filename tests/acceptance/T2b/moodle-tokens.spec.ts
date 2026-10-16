// T2b negative launch checks with real Moodle tokens. Source: tasks/T2b.md AC-T2-09, -10, -11, -22, -23;
// security §2.2 (run order 1, 3, 2, 4..12; help texts). QA holds Moodle's id_token POST in Playwright and posts it
// itself as a real browser navigation (lib/moodle-launch.ts postForm), so the state cookie behaves as in Moodle.
import { publicUrls } from '../lib/env';
import { checkErrorPage, LAUNCH_URL, ltiSeed, runStart, waitForEvent } from '../lib/lti';
import { launchActivity, newStackContext, postForm } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();
const RESOURCE_LINK_HELP = 'Your browser blocked a cookie in an embedded frame. Ask your Moodle admin to set the Cogniate tool to open in a new window.';
const cmid = () => ltiSeed().cmids['COGNIATE-DEV-101'];
const student = () => seed().users.cg_student;

/** Change one character of the decoded payload (the last digit or letter of `sub`), keep header and signature. */
function tamperOneCharacter(idToken: string): string {
  const [h, payload, sig] = idToken.split('.');
  const json = Buffer.from(payload, 'base64url').toString('utf8');
  const m = /("sub"\s*:\s*")([^"]*)(")/.exec(json);
  if (!m || m[2].length === 0) throw new Error('id_token has no sub to change');
  const last = m[2].slice(-1);
  const changed = /\d/.test(last) ? String((Number(last) + 1) % 10) : last === 'a' ? 'b' : 'a';
  const edited = json.replace(m[0], `${m[1]}${m[2].slice(0, -1)}${changed}${m[3]}`);
  return `${h}.${Buffer.from(edited, 'utf8').toString('base64url')}.${sig}`;
}

test.describe.serial('T2b launch checks with Moodle tokens', () => {
  test.beforeAll(() => {
    runStart('T2b');
  });

  test('AC-T2-09 replay of a used id_token + state from the same context → INVALID_STATE, no redirect, launch_check_failed {check: 1}', async ({ browser }) => {
    const context = await newStackContext(browser);
    try {
      const used = await launchActivity(context, student(), cmid());
      expect(used.launch?.status, 'the first post is a normal launch').toBe(303);
      const page = await context.newPage();
      const replay = await postForm(page, LAUNCH_URL, { id_token: used.post!.id_token, state: used.post!.state });
      expect(checkErrorPage(replay, 'INVALID_STATE', { test: 'AC-T2-09', endpoint: 'launch' })).toEqual([]);
      const event = await waitForEvent('lti-service', (e) => e.event === 'launch_check_failed' && e.trace_id === replay.traceId);
      expect(event, `launch_check_failed with trace id ${replay.traceId}`).toBeDefined();
      expect(String(event!.check)).toBe('1');
    } finally {
      await context.close();
    }
  });

  test('AC-T2-10 an unused form from a new context → STATE_COOKIE_MISSING with the resource-link help; again with the cookie → INVALID_STATE', async ({ browser }) => {
    const context = await newStackContext(browser);
    const stranger = await newStackContext(browser);
    try {
      const held = await launchActivity(context, student(), cmid(), { hold: true });
      const fields = { id_token: held.post!.id_token, state: held.post!.state };
      const noCookie = await postForm(await stranger.newPage(), LAUNCH_URL, fields);
      expect(checkErrorPage(noCookie, 'STATE_COOKIE_MISSING', { test: 'AC-T2-10', endpoint: 'launch' })).toEqual([]);
      expect(noCookie.body.replace(/\s+/g, ' ')).toContain(RESOURCE_LINK_HELP);
      const withCookie = await postForm(await context.newPage(), LAUNCH_URL, fields);
      expect(checkErrorPage(withCookie, 'INVALID_STATE', { test: 'AC-T2-10', endpoint: 'launch' })).toEqual([]);
    } finally {
      await stranger.close();
      await context.close();
    }
  });

  test('AC-T2-11 tampered payload (one character changed, same signature) → INVALID_SIGNATURE', async ({ browser }) => {
    const context = await newStackContext(browser);
    try {
      const held = await launchActivity(context, student(), cmid(), { hold: true });
      const res = await postForm(await context.newPage(), LAUNCH_URL, { id_token: tamperOneCharacter(held.post!.id_token), state: held.post!.state });
      expect(checkErrorPage(res, 'INVALID_SIGNATURE', { test: 'AC-T2-11', endpoint: 'launch' })).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('AC-T2-23 the token of launch A with the state and cookie of launch B → INVALID_NONCE (check 8)', async ({ browser }) => {
    const context = await newStackContext(browser);
    try {
      const a = await launchActivity(context, student(), cmid(), { hold: true });
      const b = await launchActivity(context, student(), cmid(), { hold: true });
      const res = await postForm(await context.newPage(), LAUNCH_URL, { id_token: a.post!.id_token, state: b.post!.state });
      expect(checkErrorPage(res, 'INVALID_NONCE', { test: 'AC-T2-23', endpoint: 'launch' })).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('AC-T2-22 a Moodle token held for 125 s, posted with the state and cookie of a new login → TOKEN_EXPIRED (check 7)', async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await newStackContext(browser);
    try {
      const old = await launchActivity(context, student(), cmid(), { hold: true });
      const heldAt = Date.now();
      await new Promise((r) => setTimeout(r, 125_000));
      const fresh = await launchActivity(context, student(), cmid(), { hold: true });
      const res = await postForm(await context.newPage(), LAUNCH_URL, { id_token: old.post!.id_token, state: fresh.post!.state });
      expect(checkErrorPage(res, 'TOKEN_EXPIRED', { test: 'AC-T2-22', endpoint: 'launch' })).toEqual([]);
      test.info().annotations.push({ type: 'held', description: `${Math.round((Date.now() - heldAt) / 1000)} s; moodle ${urls.moodle}` });
    } finally {
      await context.close();
    }
  });
});
