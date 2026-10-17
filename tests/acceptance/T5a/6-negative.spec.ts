// T5a negative and isolation cases. Source: tasks/T5a.md AC-T5-15, -16, -17; contract cogniate-app-api.md §7 (token
// scope, commit check order: 404, 410 RUNTIME_EXPIRED, sessionId, 409 STALE_SEQUENCE, 400 INVALID_CMI with
// details.field), §12 (commit_rejected); security §7 (sandbox: no top navigation; content origin has no session).
// Activities: "QA Blank SCO" (the blank package never commits by itself, so lastSeq only moves by QA's commits).
// AC-T5-15 has a knob part (PLAY_TTL_SECONDS=20): the host runner runs it in a knob pass.
import type { BrowserContext } from '@playwright/test';
import { APP } from '../lib/app';
import { newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import {
  ACT,
  appEvents,
  apiReady,
  cmidOf,
  commitFromNode,
  openPlayer,
  packageFrame,
  PLAY,
  runtimeState,
  scormCommit,
  settledState,
} from '../lib/t5';

const code = (json: Record<string, unknown> | null) => String((json?.details as { message?: string } | undefined)?.message ?? json?.error ?? '');

test.describe('T5a negatives', () => {
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await newStackContext(browser);
  });

  test.afterEach(async () => {
    await context?.close();
  });

  test('AC-T5-15 token scope: token A reads attempt A only, token B reads B only, a random token → 404; a commit with seq ≤ lastSeq → 409 STALE_SEQUENCE', async ({ browser }) => {
    test.setTimeout(180_000);
    const a = await openPlayer(context, seed().users.cg_student, cmidOf(ACT.blankA));
    const otherContext = await newStackContext(browser);
    try {
      const b = await openPlayer(otherContext, seed().users.cg_student2, cmidOf(ACT.blankA));
      const stateA = (await runtimeState(a.token)).json;
      const stateB = (await runtimeState(b.token)).json;
      expect(stateA?.learner.id, 'token A → cg_student').toBe(String(seed().users.cg_student.id));
      expect(stateB?.learner.id, 'token B → cg_student2').toBe(String(seed().users.cg_student2.id));
      expect(stateA?.sessionId).not.toBe(stateB?.sessionId);
      expect((await runtimeState('A'.repeat(43))).status, 'random token').toBe(404);
    } finally {
      await otherContext.close();
    }

    const s = await settledState(a.token);
    const ok = await commitFromNode(a.token, scormCommit(s.sessionId, s.lastSeq + 1, 'commit'));
    expect(ok.status, `a valid commit: ${ok.body.slice(0, 200)}`).toBe(200);
    for (const seq of [s.lastSeq + 1, s.lastSeq]) {
      const stale = await commitFromNode(a.token, scormCommit(s.sessionId, seq, 'commit'));
      expect(stale.status, `seq ${seq} (lastSeq ${s.lastSeq + 1}): ${stale.body.slice(0, 200)}`).toBe(409);
      expect(code(stale.json)).toBe('STALE_SEQUENCE');
    }
  });

  test('AC-T5-15 [knob PLAY_TTL_SECONDS=20] a commit at TTL + 3 s → 410 RUNTIME_EXPIRED', async () => {
    test.setTimeout(120_000);
    const p = await openPlayer(context, seed().users.cg_student, cmidOf(ACT.blankB));
    const s = await settledState(p.token, 1_000);
    const opened = Date.now(); // the play session was made before this moment
    await new Promise((r) => setTimeout(r, Math.max(0, opened + 23_000 - Date.now()))); // TTL + 3 s (fixed wait: TTL test)
    const late = await commitFromNode(p.token, scormCommit(s.sessionId, s.lastSeq + 1, 'commit'));
    expect(late.status, late.body.slice(0, 200)).toBe(410);
    expect(code(late.json)).toBe('RUNTIME_EXPIRED');
  });

  test('AC-T5-16 a commit with 5,000 chars of suspend_data → 400 INVALID_CMI, details.field cmi.suspend_data; commit_rejected logged', async () => {
    test.setTimeout(120_000);
    const p = await openPlayer(context, seed().users.cg_student2, cmidOf(ACT.blankA));
    const s = await settledState(p.token, 1_000);
    const since = Date.now() - 1_000;
    const res = await commitFromNode(p.token, scormCommit(s.sessionId, s.lastSeq + 1, 'commit', {}, { suspend_data: 'x'.repeat(5_000) }));
    expect(res.status, res.body.slice(0, 300)).toBe(400);
    expect(code(res.json)).toBe('INVALID_CMI');
    expect((res.json?.details as { field?: string } | undefined)?.field).toBe('cmi.suspend_data');
    await expect
      .poll(() => appEvents(since, (e) => e.event === 'commit_rejected' && e.code === 'INVALID_CMI').length, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1);
    const ev = appEvents(since, (e) => e.event === 'commit_rejected' && e.code === 'INVALID_CMI')[0];
    expect(ev?.field).toBe('cmi.suspend_data');
  });

  test('AC-T5-17 from the package frame: fetch of {app}/app-api/me with credentials does not return the user; top.location = evil.test does not change the top window', async () => {
    test.setTimeout(120_000);
    const p = await openPlayer(context, seed().users.cg_student, cmidOf(ACT.blankA));
    await apiReady(p);
    const pkg = await packageFrame(p);
    const me = await pkg.evaluate(async (app) => {
      try {
        const r = await fetch(`${app}/app-api/me`, { credentials: 'include' });
        return { fetched: true, status: r.status, body: (await r.text()).slice(0, 300) };
      } catch (e) {
        return { fetched: false, status: 0, body: String(e) };
      }
    }, APP);
    expect(!me.fetched || me.status === 401, `fetch result: ${JSON.stringify(me)}`).toBe(true);
    expect(me.body, 'no user in the answer').not.toMatch(/"email"\s*:/);

    const topBefore = p.popup.url();
    const err = await pkg.evaluate(() => {
      try {
        (window.top as Window).location.href = 'https://evil.test';
        return 'no exception';
      } catch (e) {
        return String(e);
      }
    });
    await p.popup.waitForTimeout(3_000);
    expect(p.popup.url(), `top window URL after the attempt (${err})`).toBe(topBefore);
    expect(p.popup.url().startsWith(PLAY)).toBe(true);
  });
});
