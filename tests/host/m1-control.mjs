// Operator actions named by M1. There is no arbitrary shell or DB-write action.
import fs from 'node:fs';
import path from 'node:path';
import { run } from './lib.mjs';

export function compatMarkerPresent(clone) {
  const knobs = path.join(clone, '.tmp/compose.knobs.yaml');
  return fs.existsSync(knobs) && fs.readFileSync(knobs, 'utf8').includes('x-cogniate-storage-compat');
}

export function m1HostControl(r, runCommand = run) {
  const dir = path.join(r.CLONE, 'tests/acceptance/artifacts/control');
  const done = new Set(), active = new Set();
  const compose = ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env'];
  let stopped = false;
  async function execute(req) {
    if (!r.state.h1Verified || !/^(?:qa[234]?|qalead)-[a-z0-9-]+$/.test(r.PROJECT)) return { code: 2, stdout: '', stderr: 'QA project guard', durationMs: 0 };
    if (req.action === 'm1-cli') {
      if (!['app:grant', 'app:binding', 'lti:shared-platform'].includes(req.script)
        || !Array.isArray(req.args) || req.args.some((a) => typeof a !== 'string' || a.includes('\0'))
        || req.args.length > 40) return { code: 2, stdout: '', stderr: 'CLI whitelist', durationMs: 0 };
      const service = req.script.startsWith('lti:') ? 'lti-service' : 'cogniate-app';
      // Both containers start in their service directory. Resolve npm's workspace
      // selector from the mounted /repo/package.json, not from that child folder.
      return runCommand('docker', [...compose, 'exec', '-T', '--workdir', '/repo', service, 'npm', 'run', req.script,
        '-w', `services/${service}`, '--', ...req.args],
      { cwd: r.CLONE, env: r.STACK_ENV, timeoutMs: 30_000 });
    }
    // ADR-012 §11/§12: while the storage-compatibility marker is in the knobs file, an old build may run;
    // its stack:restart is forbidden, so the host control refuses restarts before it runs any command.
    if (['m1-restart', 'm1-profile'].includes(req.action) && compatMarkerPresent(r.CLONE)) {
      return { code: 2, stdout: '', stderr: 'storage-compat marker present: m1-restart and m1-profile are refused (ADR-012 §11)', durationMs: 0 };
    }
    if (req.action === 'm1-restart' && 'mode' in req) {
      if (req.mode !== 'kill' || req.service !== 'cogniate-app') {
        return { code: 2, stdout: '', stderr: 'Unknown M1 host action', durationMs: 0 };
      }
      const killStart = new Date().toISOString();
      const kill = await runCommand('docker', [...compose, 'kill', '-s', 'SIGKILL', 'cogniate-app'],
        { cwd: r.CLONE, env: r.STACK_ENV, timeoutMs: 30_000 });
      const killLine = `kill: exit ${kill.code}, ${killStart}–${new Date().toISOString()}`;
      if (kill.code !== 0) {
        return { ...kill, stdout: [killLine, kill.stdout].filter(Boolean).join('\n') };
      }
      const restart = await runCommand('npm', ['run', 'stack:restart', '--', 'cogniate-app'], {
        cwd: r.CLONE, env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' }, timeoutMs: 180_000,
      });
      return {
        code: restart.code,
        stdout: [killLine, kill.stdout, restart.stdout].filter(Boolean).join('\n'),
        stderr: [kill.stderr, restart.stderr].filter(Boolean).join('\n'),
        durationMs: (kill.durationMs ?? 0) + (restart.durationMs ?? 0),
      };
    }
    if (req.action === 'm1-restart' && ['cogniate-app', 'lti-service'].includes(req.service)) {
      return runCommand('npm', ['run', 'stack:restart', '--', req.service], {
        cwd: r.CLONE, env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' }, timeoutMs: 180_000,
      });
    }
    if (req.action === 'm1-profile' && ['acceptance', 'default'].includes(req.profile) && ['on', 'off'].includes(req.simulation)) {
      // AC-M1-35: `stack:restart -- lti-service --env …` sets both gate settings for the LTI service only.
      // STACK_PROFILE in this process env would not reach it: only stack:up changes the saved stack profile.
      // acceptance/on is the acceptance stack default, so the restore restarts without overrides.
      const overrides = req.profile === 'acceptance' && req.simulation === 'on' ? []
        : ['--env', `STACK_PROFILE=${req.profile}`, '--env', `LTI_PROVIDER_SIMULATION=${req.simulation}`];
      return runCommand('npm', ['run', 'stack:restart', '--', 'lti-service', ...overrides],
        { cwd: r.CLONE, env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' }, timeoutMs: 180_000 });
    }
    return { code: 2, stdout: '', stderr: 'Unknown M1 host action', durationMs: 0 };
  }
  async function answer(file) {
    let req;
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192) throw new Error('Request file');
      req = JSON.parse(fs.readFileSync(file, 'utf8'));
      // The scan finds the ack by the file name, so the id must be the same: a different id could overwrite another answer.
      if (req.id !== path.basename(file).slice('req-'.length, -'.json'.length)) throw new Error('Request id');
      const start = Date.now(), result = await execute(req);
      // Add once-only CLI codes before writing any command evidence.
      for (const value of result.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/g) ?? []) r.redact.add(value);
      const out = `out-${req.id}.raw.json`;
      fs.writeFileSync(path.join(dir, out), JSON.stringify(result), { mode: 0o600 });
      r.saveText(`host-actions/${req.id}.json`, JSON.stringify({
        action: req.action, script: req.script, service: req.service, startedAt: start,
        durationMs: result.durationMs, code: result.code, stdout: result.stdout, stderr: result.stderr,
      }, null, 2));
      const ack = path.join(dir, `ack-${req.id}.json`);
      fs.writeFileSync(ack + '.tmp', JSON.stringify({ action: req.action, code: result.code, ok: result.code === 0, out }));
      fs.renameSync(ack + '.tmp', ack);
    } catch (error) {
      r.record('HOST-CONTROL', 'M1 host request was rejected', 'FAIL', [String(error.message)]);
    }
  }
  const timer = setInterval(() => {
    if (stopped || !fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir).filter((n) => /^req-m1-[a-f0-9]+\.json$/.test(n))) {
      if (done.has(name)) continue;
      done.add(name);
      // Each suite starts a new controller on the same folder, and request files stay. An ack means that an
      // earlier controller answered the request; a second run can repeat a once-only command (M1-38 h4).
      if (fs.existsSync(path.join(dir, 'ack-' + name.slice('req-'.length)))) continue;
      const promise = answer(path.join(dir, name)).finally(() => active.delete(promise));
      active.add(promise);
    }
  }, 25);
  return async () => { stopped = true; clearInterval(timer); await Promise.all(active); };
}
