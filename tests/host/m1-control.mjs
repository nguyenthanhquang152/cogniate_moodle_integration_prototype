// Operator actions named by M1. There is no arbitrary shell or DB-write action.
import fs from 'node:fs';
import path from 'node:path';
import { run } from './lib.mjs';

export function m1HostControl(r, runCommand = run) {
  const dir = path.join(r.CLONE, 'tests/acceptance/artifacts/control');
  const done = new Set(), active = new Set();
  const compose = ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env'];
  let stopped = false;
  async function execute(req) {
    if (!r.state.h1Verified || !/^qa-/.test(r.PROJECT)) return { code: 2, stdout: '', stderr: 'QA project guard', durationMs: 0 };
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
    if (req.action === 'm1-restart' && ['cogniate-app', 'lti-service'].includes(req.service)) {
      return runCommand('npm', ['run', 'stack:restart', '--', req.service], {
        cwd: r.CLONE, env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' }, timeoutMs: 180_000,
      });
    }
    if (req.action === 'm1-profile' && ['acceptance', 'default'].includes(req.profile) && ['on', 'off'].includes(req.simulation)) {
      return runCommand('npm', ['run', 'stack:restart', '--', 'lti-service', '--env', `LTI_PROVIDER_SIMULATION=${req.simulation}`],
        { cwd: r.CLONE, env: { ...r.STACK_ENV, STACK_PROFILE: req.profile }, timeoutMs: 180_000 });
    }
    return { code: 2, stdout: '', stderr: 'Unknown M1 host action', durationMs: 0 };
  }
  async function answer(file) {
    let req;
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192) throw new Error('Request file');
      req = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!/^m1-[a-f0-9]+$/.test(req.id)) throw new Error('Request id');
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
      const promise = answer(path.join(dir, name)).finally(() => active.delete(promise));
      active.add(promise);
    }
  }, 25);
  return async () => { stopped = true; clearInterval(timer); await Promise.all(active); };
}
