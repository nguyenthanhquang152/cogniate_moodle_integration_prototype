// Host channel for in-container tests (tests/acceptance/lib/host-control.ts), as a reusable module: the test writes
// artifacts/control/req-<id>.json; the runner runs only the whitelisted action for this QA project and writes
// ack-<id>.json. Here: Moodle pause/unpause (Lead decision, P1/P2: only a qa-* project; always unpaused, also on
// SIGINT/SIGTERM and at exit). Runners can add more actions.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function createHostControl(r, extraActions = {}) {
  const COMPOSE = ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env'];
  const dir = path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');
  let paused = false;
  const unpauseNow = () => {
    if (!paused) return;
    spawnSync('docker', [...COMPOSE, 'unpause', 'moodle'], { cwd: r.CLONE, env: r.STACK_ENV, stdio: 'ignore', timeout: 60_000 });
    paused = false;
  };
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      unpauseNow();
      process.exit(130);
    });
  }
  process.on('exit', unpauseNow);
  const actions = {
    'moodle-pause': async () => {
      if (!/^qa-/.test(r.PROJECT)) return { code: 9 };
      const res = await r.exec('compose-pause-moodle', 'docker', [...COMPOSE, 'pause', 'moodle'], { timeoutMs: 60_000 });
      if (res.code === 0) paused = true;
      return res;
    },
    'moodle-unpause': async () => {
      if (!/^qa-/.test(r.PROJECT)) return { code: 9 };
      const res = await r.exec('compose-unpause-moodle', 'docker', [...COMPOSE, 'unpause', 'moodle'], { timeoutMs: 60_000 });
      if (res.code === 0) paused = false;
      return res;
    },
    ...extraActions,
  };

  /** Starts answering requests; returns a stop function that returns the log (and unpauses if needed). */
  function start() {
    const done = new Set();
    const log = [];
    let busy = false;
    const timer = setInterval(async () => {
      if (busy || !fs.existsSync(dir)) return;
      const next = fs.readdirSync(dir).filter((f) => /^req-[\w-]+\.json$/.test(f)).sort().find((f) => !done.has(f));
      if (!next) return;
      busy = true;
      done.add(next);
      let req;
      try {
        req = JSON.parse(fs.readFileSync(path.join(dir, next), 'utf8'));
      } catch {
        req = { id: next.slice(4, -5), action: 'invalid' };
      }
      const startedAt = Date.now();
      const fn = actions[req.action];
      let res;
      try {
        res = fn ? await fn(req) : { code: 2 };
      } catch (err) {
        res = { code: 3, error: String(err) };
      }
      const answer = { action: req.action, ok: Boolean(fn) && res.code === 0, code: res.code, startedAt, endedAt: Date.now(), ...(res.out ? { out: res.out } : {}) };
      fs.writeFileSync(path.join(dir, `ack-${req.id}.json`), JSON.stringify(answer));
      log.push(`${new Date(startedAt).toISOString()} ${req.action}: exit ${res.code} in ${answer.endedAt - startedAt} ms`);
      busy = false;
    }, 500);
    return () => {
      clearInterval(timer);
      if (paused) {
        unpauseNow();
        log.push('Moodle was still paused at the end of the pass: unpaused by the runner');
      }
      return log;
    };
  }
  return { start, actions };
}
