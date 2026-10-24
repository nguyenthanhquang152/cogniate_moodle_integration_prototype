// Unit tests of the old-build storage-compatibility override (ADR-012 §12, infra/scripts/storage-compat.sh) in temp git
// repos (run: npm run test:infra). A fake `docker` and a fake `npm` on PATH; no test calls the real Docker or npm.
// The "old build" is a temp repo with the committed old lib.sh of b0b83a8 (its dc() adds -f .tmp/compose.knobs.yaml);
// its override copy names the temp HEAD, so the old-only rule can pass there.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OLD = ['b0b83a8289e1bf9cf349068aca184f0879e9aaf0', '9f96f7b24cd0aed702e4dc40373bdda4307aad31'];
const MARKER = 'x-cogniate-storage-compat';
const PROJECT = 'compat-unit';
const FILES = { knobs: 'infra/compat/storage-compat.knobs.json', probe: 'infra/scripts/sqlite-lock-probe.mjs', runner: 'infra/scripts/storage-compat.sh', lock: 'infra/scripts/storage-oplock.sh' };
const sha = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const temps = [];
afterEach(() => { for (const t of temps.splice(0)) fs.rmSync(t, { recursive: true, force: true }); });

// The fake docker: the lock's storage-container list is empty; `compose … run … storage-preflight` exits
// FAKE_PREFLIGHT_EXIT; `compose … ps -aq <svc>` names one container; `inspect` prints its mounts (FAKE_MOUNTS ok|bad).
const FAKE_DOCKER = `#!/bin/bash
echo "docker $*" >> "$CALLS"
case "$1" in
  ps) exit 0 ;;
  inspect)
    id="\${!#}"
    if [ "$FAKE_MOUNTS" = bad ]; then printf 'bind||/x/infra/.data/lti-service|/data\\n'; exit 0; fi
    case "$id" in
      id-lti-service) printf 'volume|%s_ltidb|/var/lib/docker/volumes/%s_ltidb/_data|/data\\n' "$COMPOSE_PROJECT_NAME" "$COMPOSE_PROJECT_NAME" ;;
      id-cogniate-app) printf 'volume|%s_appdb|/v|/data\\nbind||/x/packages|/data/packages\\nbind||/x/uploads|/data/uploads\\n' "$COMPOSE_PROJECT_NAME" ;;
    esac
    exit 0 ;;
  compose)
    case " $* " in
      *" run "*storage-preflight*) exit "\${FAKE_PREFLIGHT_EXIT:-0}" ;;
      *" ps -aq "*) echo "id-\${!#}"; exit 0 ;;
    esac
    exit 3 ;;
esac
exit 3
`;
// The fake npm: logs its arguments and whether the storage lock is held (the lock folder exists) while it runs.
const FAKE_NPM = `#!/bin/sh
held=no; [ -d "$LOCK" ] && held=yes
echo "npm $* lock=$held" >> "$CALLS"
exit "\${FAKE_NPM_EXIT:-0}"
`;

function writeHashList(root, list = path.join(root, 'infra/compat/storage-compat.sha256')) {
  fs.writeFileSync(list, Object.values(FILES).map((f) => `${sha(path.join(root, f))}  ${f}\n`).join(''));
}

/** A temp candidate checkout with the four §12 files, its own hash list and the old lib.sh; a git repo. */
function compatRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-test-'));
  temps.push(root);
  for (const f of Object.values(FILES)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.copyFileSync(path.join(REPO, f), path.join(root, f));
  }
  // The old lib.sh (committed at b0b83a8): the copied runner sources it for dc() in the old checkout.
  fs.writeFileSync(path.join(root, 'infra/scripts/lib.sh'), execFileSync('git', ['-C', REPO, 'show', `${OLD[0]}:infra/scripts/lib.sh`]));
  fs.writeFileSync(path.join(root, '.gitignore'), '.tmp/\ninfra/.data/\ninfra/.logs/\nfake-bin/\ncalls.log\n');
  writeHashList(root);
  const git = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } }).trim();
  git('init', '-q');
  git('-c', 'user.email=unit@example.invalid', '-c', 'user.name=unit', 'add', '-A');
  git('-c', 'user.email=unit@example.invalid', '-c', 'user.name=unit', 'commit', '-q', '-m', 'temp');
  const head = git('rev-parse', 'HEAD');
  const bin = path.join(root, 'fake-bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'docker'), FAKE_DOCKER, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'npm'), FAKE_NPM, { mode: 0o755 });
  const calls = path.join(root, 'calls.log');
  const knobs = path.join(root, '.tmp/compose.knobs.yaml');
  const copies = path.join(root, '.tmp/storage-compat');
  const lockDir = path.join(root, '.tmp', `storage-op.${PROJECT}.lock`);
  const sh = (script, args, extra = {}) => {
    fs.writeFileSync(calls, '');
    const r = spawnSync('bash', [script, ...args], { cwd: root, encoding: 'utf8', timeout: 60_000,
      env: { PATH: `${bin}:${process.env.PATH}`, HOME: root, CALLS: calls, LOCK: lockDir, COMPOSE_PROJECT_NAME: PROJECT, GIT_CONFIG_GLOBAL: '/dev/null', ...extra } });
    return { code: r.status, stdout: r.stdout, stderr: r.stderr, calls: fs.readFileSync(calls, 'utf8').split('\n').filter(Boolean) };
  };
  const candidate = (args, extra) => sh(path.join(root, 'infra/scripts/storage-compat.sh'), args, extra);
  const copy = (args, extra) => sh(path.join(copies, 'storage-compat.sh'), args, extra);
  /** The temp "old build": the override copy names this temp HEAD, and the copied hash list is updated for it. */
  const retarget = () => {
    const k = JSON.parse(fs.readFileSync(knobs, 'utf8'));
    k[MARKER].revisions = [head];
    fs.writeFileSync(knobs, JSON.stringify(k, null, 2));
    const list = path.join(copies, 'storage-compat.sha256');
    fs.writeFileSync(list, fs.readFileSync(list, 'utf8').replace(/^[0-9a-f]{64}(?= {2}infra\/compat\/storage-compat\.knobs\.json$)/m, sha(knobs)));
  };
  const events = () => {
    const f = path.join(root, 'infra/.logs/storage-lock.jsonl');
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).event) : [];
  };
  return { root, head, knobs, copies, lockDir, candidate, copy, retarget, events };
}

describe('the candidate guard (ADR-012 §12)', () => {
  it('exit 1 only while .tmp/compose.knobs.yaml has the marker; test knobs without it do not block', () => {
    const r = compatRepo();
    assert.equal(r.candidate(['guard']).code, 0);
    fs.mkdirSync(path.dirname(r.knobs), { recursive: true });
    fs.writeFileSync(r.knobs, JSON.stringify({ services: { 'lti-service': { environment: { X: '1' } } } }));
    assert.equal(r.candidate(['guard']).code, 0);
    fs.writeFileSync(r.knobs, JSON.stringify({ [MARKER]: { formatVersion: 1, revisions: OLD } }));
    const g = r.candidate(['guard']);
    assert.equal(g.code, 1);
    assert.match(g.stderr, /Run `npm run stack:storage-compat -- disable` first/);
  });

  it('every candidate start or database command takes the guard: stack:up/restart/reset, test:acceptance/e2e/compat, e2e:reset, demo*, stack:data-*', () => {
    const scripts = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).scripts;
    const viaGuard = (name) => scripts[name].startsWith('bash infra/scripts/storage-compat.sh guard && ');
    const guarded = (file) => /^storage_compat_guard$/m.test(fs.readFileSync(path.join(HERE, file), 'utf8'));
    for (const name of ['demo', 'demo:prepare', 'demo:users', 'demo:browser', 'test:compat']) assert.ok(viaGuard(name), name);
    const SCRIPT_OF = { 'stack:up': 'stack-up.sh', 'stack:restart': 'stack-restart.sh', 'stack:reset': 'stack-reset.sh', 'e2e:reset': 'e2e-reset.sh', 'test:acceptance': 'qa-suite.sh',
      'test:e2e': 'qa-suite.sh', 'stack:data-backup': 'stack-data.sh', 'stack:data-restore': 'stack-data.sh', 'stack:data-import': 'stack-data.sh', 'stack:data-quarantine': 'stack-data.sh' };
    for (const [name, file] of Object.entries(SCRIPT_OF)) {
      assert.ok(scripts[name].includes(`infra/scripts/${file}`), name);
      assert.ok(guarded(file), file);
    }
    // Every other stack:data-*, demo* and test:* script is in one of the lists above (host-only unit runs excepted).
    for (const name of Object.keys(scripts).filter((n) => /^(stack:data-|demo|test:)/.test(n) && !['test:unit', 'test:infra', 'test:k0'].includes(n))) {
      assert.ok(viaGuard(name) || name in SCRIPT_OF, name);
    }
  });
});

describe('enable and disable (candidate tree, under the lock)', () => {
  it('enable: content folders 0700, the override and three copies, every hash checked, the lock taken and released', () => {
    const r = compatRepo();
    const e = r.candidate(['enable']);
    assert.equal(e.code, 0, e.stderr);
    assert.equal(sha(r.knobs), sha(path.join(r.root, FILES.knobs)));
    for (const f of ['sqlite-lock-probe.mjs', 'storage-compat.sh', 'storage-oplock.sh', 'storage-compat.sha256']) assert.ok(fs.existsSync(path.join(r.copies, f)), f);
    for (const d of ['infra/.data/cogniate-app', 'infra/.data/cogniate-app/packages', 'infra/.data/cogniate-app/uploads']) assert.equal(fs.statSync(path.join(r.root, d)).mode & 0o777, 0o700, d);
    assert.deepEqual(r.events(), ['storage_lock_acquired', 'storage_lock_released']);
    assert.equal(r.candidate(['guard']).code, 1);
  });

  it('enable refuses when test knobs are active (never merges); nothing is copied', () => {
    const r = compatRepo();
    fs.mkdirSync(path.dirname(r.knobs), { recursive: true });
    fs.writeFileSync(r.knobs, '{"services":{}}');
    const e = r.candidate(['enable']);
    assert.equal(e.code, 1);
    assert.match(e.stderr, /test knobs are active: restore the defaults first/);
    assert.equal(fs.readFileSync(r.knobs, 'utf8'), '{"services":{}}');
    assert.equal(fs.existsSync(r.copies), false);
  });

  it('enable with a hash that does not match removes the override again (negative control: a modified source file)', () => {
    const r = compatRepo();
    fs.appendFileSync(path.join(r.root, FILES.probe), '\n// changed\n');
    const e = r.candidate(['enable']);
    assert.equal(e.code, 1);
    assert.match(e.stderr, /hash_mismatch: .*sqlite-lock-probe\.mjs \(infra\/scripts\/sqlite-lock-probe\.mjs\)/);
    assert.deepEqual([fs.existsSync(r.knobs), fs.existsSync(r.copies)], [false, false]);
  });

  it('enable runs only from the candidate tree; disable removes the override and the copies, but never test knobs', () => {
    const r = compatRepo();
    assert.equal(r.candidate(['enable']).code, 0);
    const fromCopy = r.copy(['enable']);
    assert.equal(fromCopy.code, 1);
    assert.match(fromCopy.stderr, /enable runs from the candidate tree/);
    assert.equal(r.candidate(['disable']).code, 0);
    assert.deepEqual([fs.existsSync(r.knobs), fs.existsSync(r.copies)], [false, false]);
    fs.mkdirSync(path.dirname(r.knobs), { recursive: true });
    fs.writeFileSync(r.knobs, '{"services":{}}');
    const d = r.candidate(['disable']);
    assert.equal(d.code, 1);
    assert.match(d.stderr, /holds test knobs, not the storage override/);
    assert.ok(fs.existsSync(r.knobs));
  });
});

describe('the old-build wrapper (copies only; old-only; allowlist; hashes; preflight; mount check)', () => {
  function oldBuild() {
    const r = compatRepo();
    assert.equal(r.candidate(['enable']).code, 0);
    return r;
  }

  it('wrapper_old_only: HEAD is not one of the marker revisions, or the override is not enabled; nothing runs', () => {
    const r = oldBuild();
    for (const args of [['run', '--', 'npm', 'run', 'stack:up'], ['preflight'], ['status']]) {
      const res = r.copy(args);
      assert.equal(res.code, 1, args.join(' '));
      assert.match(res.stderr, new RegExp(`wrapper_old_only: HEAD ${r.head} is not one of the old builds`));
      assert.deepEqual(res.calls, []);
    }
    fs.rmSync(r.knobs);
    const off = r.copy(['run', '--', 'npm', 'run', 'stack:up']);
    assert.match(off.stderr, /wrapper_old_only: the storage-compatibility override is not enabled/);
    assert.deepEqual(off.calls, []);
  });

  it('wrapper_command_not_allowed for every other command: no lock, no preflight, no command', () => {
    const r = oldBuild();
    r.retarget();
    for (const cmd of [['npm', 'run', 'stack:restart', '--', 'lti-service'], ['npm', 'run', 'stack:reset'], ['npm', 'run', 'e2e:reset'], ['npm', 'run', 'test:e2e'],
      ['npm', 'run', 'demo'], ['npm', 'run', 'stack:up', '--', '--x'], ['npm', 'run', 'test:acceptancex'], ['bash', '-c', 'npm run stack:up'], ['docker', 'compose', 'up', '-d']]) {
      const res = r.copy(['run', '--', ...cmd]);
      assert.equal(res.code, 1, cmd.join(' '));
      assert.match(res.stderr, /wrapper_command_not_allowed/);
      assert.deepEqual(res.calls, [], cmd.join(' '));
    }
    assert.deepEqual(r.events(), ['storage_lock_acquired', 'storage_lock_released']); // only the enable
  });

  it('npm run stack:up and npm run test:acceptance …: lock, hashes, preflight through the old dc() with the knobs file, the command, status; exit = the command', () => {
    const r = oldBuild();
    r.retarget();
    for (const [cmd, exit] of [[['npm', 'run', 'stack:up'], '0'], [['npm', 'run', 'test:acceptance', '--', '--grep', 'x'], '5']]) {
      const res = r.copy(['run', '--', ...cmd], { FAKE_NPM_EXIT: exit });
      assert.equal(res.code, Number(exit), res.stderr);
      const at = (re) => res.calls.findIndex((l) => re.test(l));
      const [pre, command] = [at(/ run .*storage-preflight check --prepare/), at(/^npm /)];
      const status = res.calls.findIndex((l, i) => i > command && / ps -aq lti-service$/.test(l));
      assert.ok(pre >= 0 && command > pre && status > command, res.calls.join('\n'));
      const line = res.calls[pre];
      assert.ok(line.includes(`-f ${r.knobs}`), 'the old dc() adds the knobs file');
      assert.match(line, new RegExp(`--profile storage run --rm -T --name ${PROJECT}-storage-([0-9a-f]{16}) --label org\\.cogniate\\.storage\\.run=\\1 storage-preflight check --prepare --run-id \\1 --project ${PROJECT} --folder lti=/check/lti-service --folder app=/check/cogniate-app`));
      assert.equal(res.calls.find((l) => l.startsWith('npm ')), `npm ${cmd.slice(1).join(' ')} lock=yes`);
    }
    assert.equal(fs.existsSync(r.lockDir), false);
  });

  it('a modified or missing copy, or a changed knobs file, stops before the command; a changed lock helper is never sourced', () => {
    const r = oldBuild();
    r.retarget();
    const lock = path.join(r.copies, 'storage-oplock.sh');
    const original = fs.readFileSync(lock);
    fs.appendFileSync(lock, '\necho SOURCED >> "$CALLS"\n');
    const changed = r.copy(['run', '--', 'npm', 'run', 'stack:up']);
    assert.equal(changed.code, 1);
    assert.match(changed.stderr, /hash_mismatch: .*storage-oplock\.sh/);
    assert.match(changed.stderr, /stop now: the storage-compatibility files changed \(hash\)/);
    assert.deepEqual(changed.calls, []); // no SOURCED line, no docker, no npm
    fs.writeFileSync(lock, original);
    const probe = path.join(r.copies, 'sqlite-lock-probe.mjs');
    const probeBytes = fs.readFileSync(probe);
    fs.rmSync(probe);
    const missing = r.copy(['preflight']);
    assert.deepEqual([missing.code, /hash_mismatch: .*sqlite-lock-probe\.mjs .* is missing/.test(missing.stderr), missing.calls], [1, true, []]);
    fs.writeFileSync(probe, probeBytes);
    fs.appendFileSync(r.knobs, ' ');
    const knobs = r.copy(['status']);
    assert.deepEqual([knobs.code, /hash_mismatch: .*compose\.knobs\.yaml/.test(knobs.stderr), knobs.calls], [1, true, []]);
  });

  it('a failed preflight stops before the command; a failed mount check after it stops with the command exit; status alone', () => {
    const r = oldBuild();
    r.retarget();
    const pre = r.copy(['run', '--', 'npm', 'run', 'stack:up'], { FAKE_PREFLIGHT_EXIT: '1' });
    assert.equal(pre.code, 1);
    assert.match(pre.stderr, /stop now: the storage preflight failed/);
    assert.equal(pre.calls.some((l) => l.startsWith('npm ')), false);
    const mounts = r.copy(['run', '--', 'npm', 'run', 'stack:up'], { FAKE_MOUNTS: 'bad' });
    assert.equal(mounts.code, 1);
    assert.match(mounts.stderr, /status: lti-service \/data is not the volume compat-unit_ltidb/);
    assert.match(mounts.stderr, /stop now: the mount check failed after the command \(command exit 0\)/);
    const ok = r.copy(['status']);
    assert.equal(ok.code, 0, ok.stderr);
    assert.match(ok.stdout, /storage-compat status: OK/);
    assert.equal(r.copy(['status'], { FAKE_MOUNTS: 'bad' }).code, 1);
    assert.equal(r.copy(['disable']).code, 0); // the copied disable, under the copied lock
    assert.deepEqual([fs.existsSync(r.knobs), fs.existsSync(r.copies)], [false, false]);
  });
});

describe('the wrapper refusals write one storage_refused JSON line with the code (A-SI-01, M1 "Refuses <code>")', () => {
  const refusals = (res) => res.stdout.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)).filter((l) => l.event === 'storage_refused');
  it('wrapper_old_only (not enabled, HEAD not old) and wrapper_command_not_allowed: the code line, then the same text', () => {
    const r = compatRepo();
    assert.equal(r.candidate(['enable']).code, 0);
    const head = r.copy(['preflight']);
    assert.deepEqual(refusals(head).map((l) => [l.command, l.code, l.reason, l.head]), [['storage-compat', 'wrapper_old_only', 'head_not_old', r.head]]);
    assert.match(head.stderr, /wrapper_old_only: HEAD [0-9a-f]{40} is not one of the old builds/);
    r.retarget();
    const cmd = r.copy(['run', '--', 'npm', 'run', 'stack:reset']);
    assert.deepEqual([cmd.code, refusals(cmd).map((l) => l.code)], [1, ['wrapper_command_not_allowed']]);
    assert.match(cmd.stderr, /wrapper_command_not_allowed: only 'npm run stack:up'/);
    assert.ok(!JSON.stringify(refusals(cmd)).includes('stack:reset'), 'the refused command line is not in the JSON');
    fs.rmSync(r.knobs);
    const disabled = r.copy(['run', '--', 'npm', 'run', 'stack:up']);
    assert.deepEqual(refusals(disabled).map((l) => [l.code, l.reason]), [['wrapper_old_only', 'override_not_enabled']]);
  });
  it('content_path_unsafe in the old-build wrapper: the code line with the relative path, the text, no command, the lock released', () => {
    const r = compatRepo();
    assert.equal(r.candidate(['enable']).code, 0);
    r.retarget();
    const uploads = path.join(r.root, 'infra/.data/cogniate-app/uploads');
    fs.rmSync(uploads, { recursive: true });
    fs.symlinkSync(os.tmpdir(), uploads);
    const res = r.copy(['run', '--', 'npm', 'run', 'stack:up']);
    assert.equal(res.code, 1);
    assert.deepEqual(refusals(res).map((l) => [l.code, l.path]), [['content_path_unsafe', 'infra/.data/cogniate-app/uploads']]);
    assert.match(res.stderr, /content_path_unsafe: .*uploads is a symbolic link, not a directory, or not owned by /);
    assert.equal(res.calls.some((l) => l.startsWith('npm ') || / run .*storage-preflight/.test(l)), false);
    assert.equal(fs.existsSync(r.lockDir), false);
    assert.ok(!res.stdout.includes(os.tmpdir()), 'no absolute path in the JSON');
  });
});

describe('the committed override and its hash list (ADR-012 §12)', () => {
  const knobs = JSON.parse(fs.readFileSync(path.join(REPO, FILES.knobs), 'utf8'));
  it('the marker names exactly the two old builds; the override changes only the effective-config items (a)–(e)', () => {
    assert.deepEqual(knobs[MARKER], { formatVersion: 1, revisions: OLD });
    assert.deepEqual(Object.keys(knobs).sort(), ['services', 'volumes', MARKER].sort());
    assert.deepEqual(knobs.volumes, { ltidb: {}, appdb: {} });
    assert.deepEqual(Object.keys(knobs.services).sort(), ['cogniate-app', 'lti-service', 'storage-preflight']);
    assert.deepEqual(knobs.services['lti-service'], { volumes: [{ type: 'volume', source: 'ltidb', target: '/data' }] });
    assert.deepEqual(knobs.services['cogniate-app'], { volumes: [
      { type: 'volume', source: 'appdb', target: '/data' },
      { type: 'bind', source: './.data/cogniate-app/packages', target: '/data/packages', bind: { create_host_path: false } },
      { type: 'bind', source: './.data/cogniate-app/uploads', target: '/data/uploads', bind: { create_host_path: false } },
    ] });
    const sp = knobs.services['storage-preflight'];
    assert.deepEqual(Object.keys(sp).sort(), ['entrypoint', 'environment', 'image', 'labels', 'network_mode', 'profiles', 'restart', 'user', 'volumes']);
    assert.deepEqual([sp.image, sp.profiles, sp.user, sp.network_mode, sp.restart, sp.entrypoint, sp.environment, sp.labels],
      ['node:24.22.0-alpine3.24', ['storage'], '0:0', 'none', 'no', ['node', '/probe/sqlite-lock-probe.mjs'], { HOST_UID: '${HOST_UID}', HOST_GID: '${HOST_GID}' }, { 'org.cogniate.storage': 'preflight' }]);
    assert.deepEqual(sp.volumes, ['ltidb:/check/lti-service', 'appdb:/check/cogniate-app', '../.tmp/storage-compat/sqlite-lock-probe.mjs:/probe/sqlite-lock-probe.mjs:ro', './.logs:/logs']);
  });
  it('infra/compat/storage-compat.sha256 lists the four files with their current SHA-256', () => {
    const list = fs.readFileSync(path.join(REPO, 'infra/compat/storage-compat.sha256'), 'utf8');
    assert.deepEqual(list.split('\n').filter(Boolean), Object.values(FILES).map((f) => `${sha(path.join(REPO, f))}  ${f}`));
  });
});
