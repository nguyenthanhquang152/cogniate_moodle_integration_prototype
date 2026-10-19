// T8: AC-T8-03 [knob BUILD_RUNNER_HOLD=1]. Source: tasks/T8.md AC-T8-03; tasks README §3 (knob); security §10a
// (internal network, label org.cogniate.stack); app contract §11 (build_hold event with hold_file). Host actions
// build-inspect, build-release, build-leftovers (tests/host/run-t8.mjs). Run by the knob pass only.
import { signIn, THANH } from '../lib/app';
import { publicUrls } from '../lib/env';
import { httpsRequest } from '../lib/https';
import { eventsSince } from '../lib/lti';
import { expect, test } from '../lib/pw';
import { hostJson, noLeftovers, startMbz, t8, waitMbz } from '../lib/t8';

const urls = publicUrls();
type Inspect = { networks: { name: string; internal: boolean; containers: { name: string; networks: string[] }[] }[]; dns: { container: string; code: number; stdout: string } | null };
test('AC-T8-03 [knob BUILD_RUNNER_HOLD=1] the held build network is Internal with no other network on its containers; DNS for moodle.test fails inside; after release and the end, no cogniate-build-* container or volume', async () => {
  test.setTimeout(900_000);
  const health = JSON.parse((await httpsRequest(`${urls.app}/healthz`)).body) as { knobs?: { name: string; value: string }[] };
  test.skip(!(health.knobs ?? []).some((k) => k.name === 'BUILD_RUNNER_HOLD' && String(k.value) === '1'), 'knob BUILD_RUNNER_HOLD=1 is not active');
  const st = t8();
  const s = await signIn(THANH);
  const since = Date.now() - 1_000;
  const post = await startMbz(s, String(st.courseId), String(st.versionId));
  expect(post.status, post.body.slice(0, 200)).toBe(202);
  const buildId = post.json.buildId;

  // The build waits before teardown; the runner logs build_hold with the flag file.
  let hold: Record<string, unknown> | undefined;
  const deadline = Date.now() + 420_000;
  while (!hold && Date.now() < deadline) {
    hold = eventsSince('build-runner', since, (e) => e.event === 'build_hold' && e.trace_id === buildId)[0] as Record<string, unknown> | undefined;
    if (!hold) await new Promise((r) => setTimeout(r, 3_000));
  }
  expect(hold, 'build_hold event of this build').toBeDefined();

  const inspect = (await hostJson<Inspect>('build-inspect')).json;
  test.info().annotations.push({ type: 'build network', description: JSON.stringify(inspect).slice(0, 1500) });
  expect(inspect?.networks.length ?? 0, 'a build network of this stack').toBeGreaterThan(0);
  for (const n of inspect!.networks) {
    expect(n.internal, `${n.name}: Internal`).toBe(true);
    for (const c of n.containers) expect(c.networks, `${c.name}: only the build network`).toEqual([n.name]);
  }
  const [moodleTest, example] = String(inspect?.dns?.stdout ?? '').split('|');
  expect(inspect?.dns, 'DNS check in the build Moodle').not.toBeNull();
  expect(moodleTest, 'moodle.test does not resolve (gethostbyname returns the name)').toBe('moodle.test');
  expect(example, 'no internet name either').toBe('example.com');

  const release = await hostJson<{ removed: boolean }>('build-release', { holdFile: String(hold!.hold_file ?? '') });
  expect(release.json?.removed, `release: ${release.raw}`).toBe(true);
  const end = await waitMbz(s, String(st.courseId), String(st.versionId), (b) => b.buildId === buildId && (b.status === 'ready' || b.status === 'failed'), 420_000);
  expect(end?.status, JSON.stringify(end)).toBe('ready');
  const left = await noLeftovers();
  test.info().annotations.push({ type: 'leftovers', description: JSON.stringify(left) });
  expect(left?.containers.labelled, 'no cogniate-build-* container of this stack').toEqual([]);
  expect(left?.volumes.labelled, 'no cogniate-build-* volume of this stack').toEqual([]);
  expect(left?.networks.labelled, 'no cogniate-build-* network of this stack').toEqual([]);
});
