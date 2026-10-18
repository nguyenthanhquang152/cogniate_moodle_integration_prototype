// AC-T7-15 (second half): after `npm run demo:prepare`, cg_student opens both activities and reaches the player.
// Runs only in the demo pass of the host runner (QA_E2E_DEMO=1, QA_GREP=AC-T7-15), never in the scenario run.
import { users, course101, ltiModules } from './lib/oracle';
import { launchFromCourse, waitForFrame } from './lib/learner';
import { shot, urls, writeEvidence } from './lib/e2e';
import { expect, newContext, test } from './lib/pw';

test('DEMO AC-T7-15 after demo:prepare, cg_student opens both activities in COGNIATE-DEV-101 and reaches the player', async ({ browser }, testInfo) => {
  test.skip(process.env.QA_E2E_DEMO !== '1', 'runs only in the demo pass (QA_E2E_DEMO=1)');
  test.setTimeout(180_000);
  const mods = await ltiModules(course101());
  writeEvidence('demo-activities.json', mods);
  expect(mods.length, 'demo:prepare made two activities in COGNIATE-DEV-101').toBe(2);
  const ctx = await newContext(browser);
  try {
    const results: { name: string; playUrl: string; ms: number; packageFrame: boolean }[] = [];
    for (const m of mods) {
      const l = await launchFromCourse(ctx, users().cg_student, course101(), m.name, `demo ${m.name}`);
      await l.capture.stop();
      const pkg = await waitForFrame(l.popup, (u) => u.startsWith(`${urls.content}/pkg/`)).then(() => true).catch(() => false);
      results.push({ name: m.name, playUrl: l.playUrl.replace(/\/play\/[^/?#]+/, '/play/<id>'), ms: l.msToPlay, packageFrame: pkg });
      await shot(l.popup, `demo-player-${m.id}`, testInfo);
      expect.soft(l.playUrl, `${m.name}: the player`).toMatch(/\/play\/ply_/);
      expect.soft(pkg, `${m.name}: the course package loads in the player`).toBe(true);
      await l.popup.close().catch(() => undefined);
    }
    writeEvidence('demo-launches.json', results);
  } finally {
    await ctx.close();
  }
});
