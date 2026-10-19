// T8 audit item C-T8-02 (Lead): two Build Runners started at the same moment. Source: app contract §11 and security
// §10a (single-runner rule: lock file infra/.data/build-queue/.runner.pid; a second runner is refused, logs
// runner_refused and exits 1). Run last, by the "runner-race" pass of tests/host/run-t8.mjs: the host stops the
// stack's runner, QA queues a build (no runner takes it), then the host starts two runners together.
import crypto from 'node:crypto';
import { signIn, THANH } from '../lib/app';
import { expect, test } from '../lib/pw';
import { hostJson, newBlankVersion, startMbz, waitMbz } from '../lib/t8';

interface RunnerInfo {
  label: string;
  pid: number;
  alive: boolean;
  exitCode: number | null;
  events: { event?: string; trace_id?: string; other_pid?: string }[];
}

test('C-T8-02 two Build Runners started at the same moment → one runs, the other logs runner_refused and exits 1; a queued build is not lost and runs once', async () => {
  test.setTimeout(900_000);
  const stop = await hostJson<{ pid: number | null; stopped: boolean }>('runner-stop');
  expect(stop.json?.stopped, `stop the stack's runner: ${stop.raw}`).toBe(true);
  const s = await signIn(THANH);
  const v = await newBlankVersion(s, `QA T8 runner race ${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`);
  const post = await startMbz(s, v.courseId, v.versionId);
  expect(post.status, post.body.slice(0, 200)).toBe(202);

  const race = await hostJson<{ runners: RunnerInfo[]; lockPid: number | null }>('runner-race', { buildId: post.json.buildId }, 420_000);
  const runners = race.json?.runners ?? [];
  test.info().annotations.push({ type: 'runners', description: JSON.stringify(runners.map((r) => ({ ...r, events: r.events.map((e) => e.event) }))).slice(0, 1500) });
  const build = await waitMbz(s, v.courseId, v.versionId, (b) => b.buildId === post.json.buildId && (b.status === 'ready' || b.status === 'failed'), 420_000);
  test.info().annotations.push({ type: 'queued build', description: JSON.stringify(build) });

  const alive = runners.filter((r) => r.alive);
  const refused = runners.filter((r) => !r.alive && r.exitCode === 1 && r.events.some((e) => e.event === 'runner_refused'));
  expect(runners, 'two runners were started').toHaveLength(2);
  expect(alive.map((r) => r.label), 'exactly one runner runs').toHaveLength(1);
  expect(refused.map((r) => r.label), 'the other one logged runner_refused and exited 1').toHaveLength(1);
  expect(race.json?.lockPid, 'the lock file names the running runner').toBe(alive[0]?.pid);
  expect(build?.status, 'the queued build is not lost').toBe('ready');
  const starts = runners.flatMap((r) => r.events).filter((e) => e.event === 'build_started' && e.trace_id === post.json.buildId);
  expect(starts, 'the build ran once').toHaveLength(1);
});
