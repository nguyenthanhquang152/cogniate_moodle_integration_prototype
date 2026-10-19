// T8: AC-T8-07 [knob BUILD_RUNNER_FAIL_AT=backup]. Source: tasks/T8.md AC-T8-07; app contract §11 (status failed,
// step, reason); portal: the course page "Build Moodle backup (.mbz)" status. Run by the knob pass only.
import { APP, signIn, THANH } from '../lib/app';
import { publicUrls } from '../lib/env';
import { httpsRequest } from '../lib/https';
import { newStackContext } from '../lib/moodle-launch';
import { PORTAL_ROUTES, portalSignIn } from '../lib/portal';
import { expect, test } from '../lib/pw';
import { noLeftovers, startMbz, t8, waitMbz } from '../lib/t8';

const urls = publicUrls();

test('AC-T8-07 [knob BUILD_RUNNER_FAIL_AT=backup] the build fails at backup; the portal shows it as failed with the reason; no cogniate-build-* container or volume remains', async ({ browser }) => {
  test.setTimeout(900_000);
  const health = JSON.parse((await httpsRequest(`${urls.app}/healthz`)).body) as { knobs?: { name: string; value: string }[] };
  test.skip(!(health.knobs ?? []).some((k) => k.name === 'BUILD_RUNNER_FAIL_AT' && String(k.value) === 'backup'), 'knob BUILD_RUNNER_FAIL_AT=backup is not active');
  const st = t8();
  const s = await signIn(THANH);
  const post = await startMbz(s, String(st.courseId), String(st.versionId));
  expect(post.status, post.body.slice(0, 200)).toBe(202);
  const build = await waitMbz(s, String(st.courseId), String(st.versionId), (b) => b.buildId === post.json.buildId && (b.status === 'ready' || b.status === 'failed'), 420_000);
  test.info().annotations.push({ type: 'build', description: JSON.stringify(build) });
  expect(build?.status).toBe('failed');
  expect(build?.step).toBe('backup');
  expect(String(build?.reason ?? ''), 'a reason').not.toBe('');

  const context = await newStackContext(browser);
  try {
    const page = await context.newPage();
    await portalSignIn(page, THANH);
    await page.goto(`${APP}${PORTAL_ROUTES.course(String(st.courseId))}`);
    await expect(page.getByText(String(build!.reason)).first(), 'the portal shows the reason').toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/failed/i).first(), 'the portal shows the build as failed').toBeVisible();
    await page.screenshot({ path: test.info().outputPath('mbz-failed.png'), fullPage: true });
  } finally {
    await context.close();
  }
  const left = await noLeftovers();
  test.info().annotations.push({ type: 'leftovers', description: JSON.stringify(left) });
  expect(left?.containers.labelled, 'no cogniate-build-* container of this stack').toEqual([]);
  expect(left?.volumes.labelled, 'no cogniate-build-* volume of this stack').toEqual([]);
});
