// Unit tests of the operation lock (ADR-012 §7, infra/scripts/storage-oplock.sh) in temp copies of the repo (run: npm
// run test:infra). A fake `docker` on PATH answers the storage-container list; no test calls the real Docker.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = 'oplock-unit';
const temps = [];
const repos = [];
afterEach(() => { for (const t of temps.splice(0)) fs.rmSync(t, { recursive: true, force: true }); });

// The fake docker: `ps` prints FAKE_PS (a file of "id<TAB>name<TAB>state<TAB>run" lines) or fails with FAKE_PS_FAIL=1;
// `rm <id>` succeeds. Every call goes to calls.log.
// FAKE_PS_OK_TIMES=n: the first n `ps` calls answer, then `ps` fails. FAKE_RM_FAIL=<id>: `rm <id>` fails.
const FAKE_DOCKER = `#!/bin/sh
echo "docker $*" >> "$CALLS"
case "$1" in
  ps)
    n=$(grep -c '^docker ps' "$CALLS")
    [ "$FAKE_PS_FAIL" = 1 ] && { echo "Cannot connect to the Docker daemon at unix:///secret.sock" >&2; exit 1; }
    [ -n "$FAKE_PS_OK_TIMES" ] && [ "$n" -gt "$FAKE_PS_OK_TIMES" ] && { echo "raw daemon text" >&2; exit 1; }
    [ -s "$FAKE_PS" ] && cat "$FAKE_PS"; exit 0 ;;
  rm) [ "$2" = "$FAKE_RM_FAIL" ] && { echo "raw rm text" >&2; exit 1; }; exit 0 ;;
  *) exit 3 ;;
esac
`;

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oplock-test-'));
  temps.push(root);
  fs.mkdirSync(path.join(root, 'infra/scripts'), { recursive: true });
  fs.copyFileSync(path.join(HERE, 'storage-oplock.sh'), path.join(root, 'infra/scripts/storage-oplock.sh'));
  const bin = path.join(root, 'fake-bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'docker'), FAKE_DOCKER, { mode: 0o755 });
  const calls = path.join(root, 'calls.log');
  const ps = path.join(root, 'ps.txt');
  const script = path.join(root, 'infra/scripts/storage-oplock.sh');
  const env = (extra = {}) => ({ PATH: `${bin}:${process.env.PATH}`, HOME: root, CALLS: calls, FAKE_PS: ps, COMPOSE_PROJECT_NAME: PROJECT, ...extra });
  /** `storage-oplock.sh run -- <cmd>`; the command sees the lock folder through $LOCK. */
  const run = (cmd, extra = {}) => {
    fs.writeFileSync(calls, '');
    const r = spawnSync('bash', [script, 'run', '--', 'bash', '-c', cmd], { cwd: root, encoding: 'utf8', env: { ...env(extra), LOCK: lockDir() }, timeout: 60_000 });
    return { code: r.status, stdout: r.stdout, stderr: r.stderr, calls: fs.readFileSync(calls, 'utf8').split('\n').filter(Boolean) };
  };
  const lockDir = () => path.join(root, '.tmp', `storage-op.${PROJECT}.lock`);
  const events = () => {
    const f = path.join(root, 'infra/.logs/storage-lock.jsonl');
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  };
  const tmpEntries = () => (fs.existsSync(path.join(root, '.tmp')) ? fs.readdirSync(path.join(root, '.tmp')).sort() : []);
  const ran = () => fs.existsSync(path.join(root, 'ran'));
  const r = { root, script, env, run, ps, lockDir, events, tmpEntries, ran };
  repos.push(r);
  return r;
}

const C = { ...process.env, LC_ALL: 'C' };
const lstart = (pid) => execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { env: C, encoding: 'utf8' }).trim();
const record = (r, over) => ({ formatVersion: 1, project: PROJECT, checkout: r.root, command: 'other', runId: '0'.repeat(16), pid: 1, pidStart: 'x', pgid: 1,
  acquiredAt: new Date().toISOString(), containers: [], ...over });
function plantLock(r, rec) {
  fs.mkdirSync(r.lockDir(), { recursive: true });
  fs.writeFileSync(path.join(r.lockDir(), 'owner.json'), typeof rec === 'string' ? rec : JSON.stringify(rec));
}
const EVENT_KEYS = ['command', 'container', 'event', 'owner', 'pgid', 'pid', 'pidStart', 'project', 'reason', 'runId', 'ts', 'waitedMs'];

describe('the operation lock (ADR-012 §7)', () => {
  // §7: command is not nullable. Every lock event of every test names a command (a non-empty string).
  afterEach(() => {
    for (const r of repos.splice(0)) for (const e of r.events()) assert.ok(typeof e.command === 'string' && e.command !== '', `${e.event}: command ${JSON.stringify(e.command)}`);
  });

  it('run -- holds the lock for the whole command (record with pid, pidStart, pgid), then releases it; the events have the §7 fields', () => {
    const r = repo();
    const cmd = 'cp "$LOCK/owner.json" "$HOME/owner.json"; echo "run=$COGNIATE_STORAGE_LOCK_RUN"; echo "commandVar=${STORAGE_LOCK_COMMAND-unset}"';
    const res = r.run(cmd);
    assert.equal(res.code, 0, res.stderr);
    const rec = JSON.parse(fs.readFileSync(path.join(r.root, 'owner.json'), 'utf8'));
    const own = r.events()[0];
    assert.equal(own.event, 'storage_lock_acquired');
    assert.match(res.stdout, new RegExp(`run=${own.runId}`));
    assert.match(res.stdout, /^commandVar=unset$/m); // the helper keeps its command in a shell variable that it does not export
    assert.deepEqual(Object.keys(rec).sort(), ['acquiredAt', 'checkout', 'command', 'containers', 'formatVersion', 'pgid', 'pid', 'pidStart', 'project', 'runId']);
    assert.deepEqual([rec.formatVersion, rec.project, rec.checkout, rec.runId, rec.pid, rec.pidStart, rec.pgid, rec.containers], [1, PROJECT, r.root, own.runId, own.pid, own.pidStart, own.pgid, []]);
    assert.ok(rec.pidStart.length > 0 && Number.isInteger(rec.pgid));
    assert.deepEqual(r.events().map((e) => e.event), ['storage_lock_acquired', 'storage_lock_released']);
    // The record, the acquired event and the released event name the same command.
    const command = `storage-oplock run -- bash -c ${cmd}`;
    const released = r.events()[1];
    assert.deepEqual([rec.command, own.command, released.command, released.runId], [command, command, command, own.runId]);
    for (const e of r.events()) assert.deepEqual(Object.keys(e).sort(), EVENT_KEYS);
    assert.deepEqual(r.tmpEntries(), []);
    // A6 lists the project's storage containers (both labels).
    assert.ok(res.calls.some((l) => l.startsWith(`docker ps -a --filter label=com.docker.compose.project=${PROJECT} --filter label=org.cogniate.storage --format`)));
  });

  it('a guarded command inside the lock is refused (operation_lock_reentry): no nested lock', () => {
    const r = repo();
    const res = r.run(`bash "${r.script}" run -- true; echo "inner=$?"`);
    assert.equal(res.code, 0);
    assert.match(res.stdout, /inner=1/);
    assert.match(res.stderr, /already runs inside the storage lock/);
    const refused = r.events().find((e) => e.event === 'storage_lock_refused');
    assert.equal(refused.reason, 'operation_lock_reentry');
    assert.equal(refused.owner.runId, r.events()[0].runId);
  });

  it('A6: an active storage container refuses storage_writer_active (the lock is released); an inactive one is removed first', () => {
    const r = repo();
    fs.writeFileSync(r.ps, 'abc123\toplock-unit-storage-1111111111111111\trunning\t1111111111111111\n');
    const busy = r.run(': > "$HOME/ran"');
    assert.equal(busy.code, 1);
    assert.equal(r.ran(), false);
    assert.match(busy.stderr, /still runs: oplock-unit-storage-1111111111111111 \(abc123, running, run 1111111111111111\)/);
    const refused = r.events().find((e) => e.event === 'storage_lock_refused');
    assert.deepEqual([refused.reason, refused.container], ['storage_writer_active', { id: 'abc123', name: 'oplock-unit-storage-1111111111111111', state: 'running', runLabel: '1111111111111111' }]);
    assert.deepEqual(r.tmpEntries(), []);
    fs.writeFileSync(r.ps, 'def456\toplock-unit-storage-2222222222222222\texited\t2222222222222222\n');
    const ok = r.run(': > "$HOME/ran"');
    assert.equal(ok.code, 0);
    assert.equal(r.ran(), true);
    assert.ok(ok.calls.includes('docker rm def456'));
    assert.ok(r.events().some((e) => e.event === 'storage_container_removed' && e.container.id === 'def456'));
  });

  it('Docker does not answer, or is not installed: the command never runs, nothing is left, a safe message', () => {
    const r = repo();
    const down = r.run(': > "$HOME/ran"', { FAKE_PS_FAIL: '1' });
    assert.deepEqual([down.code, r.ran()], [1, false]);
    assert.match(down.stderr, /Cannot check the storage containers: Docker does not answer \(docker ps: exit 1\)\. Start Docker, then run the command again\. No data was changed\./);
    assert.doesNotMatch(down.stderr, /Cannot connect|secret\.sock|at |Error:/); // no raw Docker text or stack trace
    assert.deepEqual(r.tmpEntries(), []);
    // No docker on PATH at all: only node (a link in its own folder), /usr/bin and /bin. Never the real Docker CLI.
    if (fs.existsSync('/usr/bin/docker') || fs.existsSync('/bin/docker')) return;
    fs.rmSync(path.join(r.root, 'fake-bin', 'docker'));
    const nodeBin = path.join(r.root, 'node-bin');
    fs.mkdirSync(nodeBin);
    fs.symlinkSync(process.execPath, path.join(nodeBin, 'node'));
    const none = spawnSync('bash', [r.script, 'run', '--', 'touch', path.join(r.root, 'ran')], { cwd: r.root, encoding: 'utf8', env: { ...r.env(), PATH: `${path.join(r.root, 'fake-bin')}:${nodeBin}:/usr/bin:/bin` } });
    assert.deepEqual([none.status, r.ran()], [1, false]);
    assert.match(none.stderr, /Cannot check the storage containers: docker is not installed\. No data was changed\./);
  });

  it('A-SI-03: a failed docker rm in A6 names the container and what happened before; the lock is released; no raw Docker text', () => {
    const r = repo();
    fs.writeFileSync(r.ps, 'aaa111\toplock-unit-storage-1111111111111111\texited\t1111111111111111\nbbb222\toplock-unit-storage-2222222222222222\tdead\t2222222222222222\n');
    plantLock(r, record(r, { pid: 999_999, pidStart: 'Thu Jan  1 00:00:00 1970', pgid: 999_999 }));
    const res = r.run(': > "$HOME/ran"', { FAKE_RM_FAIL: 'bbb222' });
    assert.deepEqual([res.code, r.ran()], [1, false]);
    assert.equal(res.stderr.trim(), 'Cannot remove the inactive storage container oplock-unit-storage-2222222222222222 (bbb222): docker rm failed (exit 1). '
      + `Before that, a stale lock record was moved to .tmp/storage-op.<project>.stale-${'0'.repeat(16)}/; inactive storage containers removed: oplock-unit-storage-1111111111111111 (aaa111). No data was changed.`);
    assert.doesNotMatch(res.stderr, /raw rm text|Docker does not answer/);
    assert.deepEqual(r.tmpEntries(), [`storage-op.${PROJECT}.stale-${'0'.repeat(16)}`]);
  });
  it('A-SI-03: a list that fails after a reclaim says that the stale record moved; a failing ps says only what is true', () => {
    const r = repo();
    plantLock(r, record(r, { pid: 999_999, pidStart: 'Thu Jan  1 00:00:00 1970', pgid: 999_999 }));
    const res = r.run(': > "$HOME/ran"', { FAKE_PS_OK_TIMES: '1' });
    assert.deepEqual([res.code, r.ran()], [1, false]);
    assert.match(res.stderr, new RegExp(`^Cannot check the storage containers: Docker does not answer \\(docker ps: exit 1\\)\\. Start Docker, then run the command again\\. Before that, a stale lock record was moved to \\.tmp/storage-op\\.<project>\\.stale-${'0'.repeat(16)}/\\. No data was changed\\.$`, 'm'));
    assert.doesNotMatch(res.stderr, /raw daemon text/);
    assert.deepEqual(r.tmpEntries(), [`storage-op.${PROJECT}.stale-${'0'.repeat(16)}`]);
  });

  it('A5: a stale record (owner ended, empty group) is reclaimed to stale-<runId> and logged with the old owner', () => {
    const r = repo();
    plantLock(r, record(r, { pid: 999_999, pidStart: 'Thu Jan  1 00:00:00 1970', pgid: 999_999 }));
    const res = r.run('echo RAN');
    assert.equal(res.code, 0, res.stderr);
    const reclaimed = r.events().find((e) => e.event === 'storage_lock_reclaimed');
    assert.equal(reclaimed.owner.runId, '0'.repeat(16));
    assert.deepEqual(r.tmpEntries(), [`storage-op.${PROJECT}.stale-${'0'.repeat(16)}`]);
  });

  it('A4: a live owner in its own process group is waited for (storage_lock_wait), then the record is reclaimed when it ends', () => {
    const r = repo();
    // `set -m`: the sleep gets its own process group, and its parent shell ends at once (no zombie keeps it "live").
    const pid = Number(execFileSync('bash', ['-c', 'set -m; sleep 3 >/dev/null 2>&1 & echo $!'], { encoding: 'utf8' }).trim());
    plantLock(r, record(r, { pid, pidStart: lstart(pid), pgid: pid }));
    const res = r.run('echo RAN');
    assert.equal(res.code, 0, res.stderr);
    const ev = r.events();
    assert.deepEqual(ev.map((e) => e.event).slice(0, 3), ['storage_lock_wait', 'storage_lock_reclaimed', 'storage_lock_acquired']);
    assert.equal(ev[0].owner.pid, pid);
    assert.ok(ev[2].waitedMs >= 1000);
  });

  it('A3: a lock folder whose record is not valid for 10 s refuses operation_lock_invalid; nothing is moved', { timeout: 30_000 }, () => {
    const r = repo();
    plantLock(r, '{"formatVersion":1,"project":');
    const res = r.run(': > "$HOME/ran"');
    assert.deepEqual([res.code, r.ran()], [1, false]);
    assert.match(res.stderr, /has no valid record/);
    assert.equal(r.events().find((e) => e.event === 'storage_lock_refused').reason, 'operation_lock_invalid');
    assert.equal(fs.readFileSync(path.join(r.lockDir(), 'owner.json'), 'utf8'), '{"formatVersion":1,"project":');
    assert.deepEqual(r.tmpEntries(), [`storage-op.${PROJECT}.lock`]);
  });

  it('release moves only its own lock: a lock that another run holds now is kept (storage_lock_lost, with the own command)', () => {
    const r = repo();
    const res = spawnSync('bash', ['-c', `source "${r.script}"; storage_lock_acquire test-lost
node -e 'const fs=require("fs");const f=process.argv[1];const k=JSON.parse(fs.readFileSync(f,"utf8"));k.runId="${'9'.repeat(16)}";k.command="other-owner";fs.writeFileSync(f,JSON.stringify(k))' "$LOCK/owner.json"
storage_lock_release`], { cwd: r.root, encoding: 'utf8', env: { ...r.env(), LOCK: r.lockDir() } });
    assert.equal(res.status, 1, res.stderr); // §7 release step 1: the status would be 0, so it is 1
    assert.deepEqual(r.events().map((e) => e.event), ['storage_lock_acquired', 'storage_lock_lost']);
    // command, runId and pid: this process (its acquire). owner: the record that holds the lock now.
    const [acquired, lost] = r.events();
    assert.deepEqual([acquired.command, lost.command, lost.runId, lost.pid], ['test-lost', 'test-lost', acquired.runId, acquired.pid]);
    assert.deepEqual([lost.owner.runId, lost.owner.command], ['9'.repeat(16), 'other-owner']);
    const kept = JSON.parse(fs.readFileSync(path.join(r.lockDir(), 'owner.json'), 'utf8'));
    assert.deepEqual([kept.runId, kept.command], ['9'.repeat(16), 'other-owner']);
  });

  it('the EXIT trap releases the lock after a failing command and after TERM; the released event names the own command', () => {
    const r = repo();
    assert.equal(r.run('exit 7').code, 7);
    assert.deepEqual(r.tmpEntries(), []);
    const term = spawnSync('bash', ['-c', `source "${r.script}"; storage_lock_acquire test-term; kill -TERM $$; sleep 5`], { cwd: r.root, encoding: 'utf8', env: r.env() });
    assert.equal(term.status, 143);
    assert.deepEqual(r.tmpEntries(), []);
    const ev = r.events();
    assert.deepEqual(ev.map((e) => [e.event, e.command]), [
      ['storage_lock_acquired', 'storage-oplock run -- bash -c exit 7'], ['storage_lock_released', 'storage-oplock run -- bash -c exit 7'],
      ['storage_lock_acquired', 'test-term'], ['storage_lock_released', 'test-term']]);
    assert.deepEqual([ev[1].runId, ev[3].runId], [ev[0].runId, ev[2].runId]);
  });

  // §7 release step 1 (W-1): after storage_lock_lost, a status of 0 becomes 1 and any nonzero status stays. The same rule
  // on the run path and on the sourced path, with no options and with set -euo pipefail.
  const FOREIGN = JSON.stringify(record({ root: '/elsewhere' }, { runId: '9'.repeat(16), command: 'other-owner', acquiredAt: 'x' }));
  const PLANT = 'printf %s "$F" > "$LOCK/owner.json"'; // the foreign record F now holds the lock
  const GONE = 'rm -rf "$LOCK"'; // the lock folder is gone
  /** released: acquired, released; nothing left. lost: acquired, lost (owner F); F byte-identical. gone: lost, owner null; nothing left. */
  function expectEnd(r, status, stderr, code, end) {
    const ev = r.events();
    assert.equal(status, code, `${stderr}${JSON.stringify(ev.map((e) => e.event))}`);
    assert.deepEqual(ev.map((e) => e.event), ['storage_lock_acquired', end === 'released' ? 'storage_lock_released' : 'storage_lock_lost']);
    assert.deepEqual([ev[1].command, ev[1].runId, ev[1].pid], [ev[0].command, ev[0].runId, ev[0].pid]);
    if (end === 'lost') {
      assert.equal(ev[1].owner.runId, '9'.repeat(16));
      assert.equal(fs.readFileSync(path.join(r.lockDir(), 'owner.json'), 'utf8'), FOREIGN);
      assert.deepEqual(r.tmpEntries(), [`storage-op.${PROJECT}.lock`]);
    } else {
      if (end === 'gone') assert.equal(ev[1].owner, null);
      assert.deepEqual(r.tmpEntries(), []);
    }
  }
  // [case, the script after storage_lock_acquire, exit status, end]
  const SOURCED = [
    ['R-1 not lost, the script ends with 0', 'true', 0, 'released'],
    ['R-2 not lost, exit 7', 'exit 7', 7, 'released'],
    ['R-4 lost (a foreign record), then 0', PLANT, 1, 'lost'],
    ['R-5 lost (no lock folder), then 0', GONE, 1, 'gone'],
    ['R-6 lost, then exit 7', `${PLANT}; exit 7`, 7, 'lost'],
    ['R-6 lost, then a failing command (1)', `${PLANT}; false`, 1, 'lost'],
    ['R-7 lost, then TERM', `${PLANT}; kill -TERM $$; sleep 5`, 143, 'lost'],
    ['R-7 lost, then INT', `${PLANT}; kill -INT $$; sleep 5`, 130, 'lost'],
    ['R-8 (i) storage_lock_release, then exit 0', 'storage_lock_release\nexit 0', 0, 'released'],
    ['R-8 (ii) a lost storage_lock_release, then a command that succeeds and exit 0', `${PLANT}\nstorage_lock_release\ntrue\nexit 0`, 1, 'lost'],
    // A plain call: a release that ended the shell through set -e would give 1, not the saved 7.
    ['R-8 (iii) a saved 7, a lost storage_lock_release, then exit with the saved status', `saved=0; bash -c 'exit 7' || saved=$?\n${PLANT}\nstorage_lock_release\nexit "$saved"`, 7, 'lost'],
  ];
  for (const opts of ['', 'set -euo pipefail']) {
    for (const [id, body, code, end] of SOURCED) {
      it(`sourced (${opts || 'no options'}): ${id} → exit ${code}`, () => {
        const r = repo();
        const res = spawnSync('bash', ['-c', `${opts}\nsource "${r.script}"\nstorage_lock_acquire test-status\n${body}`], { cwd: r.root, encoding: 'utf8', env: { ...r.env(), LOCK: r.lockDir(), F: FOREIGN }, timeout: 60_000 });
        expectEnd(r, res.status, res.stderr, code, end);
      });
    }
  }
  const RUN = [
    ['R-4 lost (a foreign record), the command exits 0', PLANT, 1, 'lost'],
    ['R-5 lost (no lock folder), the command exits 0', GONE, 1, 'gone'],
    ['R-6 lost, the command exits 7', `${PLANT}; exit 7`, 7, 'lost'],
    ['R-7 lost, then TERM', `${PLANT}; kill -TERM $PPID`, 143, 'lost'],
    ['R-7 lost, then INT', `${PLANT}; kill -INT $PPID`, 130, 'lost'],
  ];
  for (const [id, body, code, end] of RUN) {
    it(`run --: ${id} → exit ${code}`, () => {
      const r = repo();
      const res = r.run(body, { F: FOREIGN });
      expectEnd(r, res.code, res.stderr, code, end);
    });
  }

  it('selftest: rename-held, locale, orphan-client (an orphaned Docker client keeps the group live), dead-owner, own-group', { timeout: 120_000 }, () => {
    const r = repo();
    const res = spawnSync('bash', [r.script, 'selftest'], { cwd: r.root, encoding: 'utf8', env: r.env(), timeout: 110_000 });
    const lines = res.stdout.split('\n').filter((l) => l.includes('"storage_lock_selftest"')).map((l) => JSON.parse(l));
    assert.deepEqual(lines.map((l) => [l.scenario, l.ok]), [['rename-held', true], ['locale', true], ['orphan-client', true], ['dead-owner', true], ['own-group', true]], res.stdout + res.stderr);
    assert.equal(res.status, 0);
    assert.ok(lines.every((l) => l.psCommand === 'LC_ALL=C ps -A -o pid= -o pgid='));
    assert.deepEqual(r.tmpEntries(), []);
  });
});

describe('guarded paths (ADR-012 §7): the lock in each candidate command, the guard only in the QA wrappers', () => {
  const read = (f) => fs.readFileSync(path.join(HERE, f), 'utf8').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const LOCKED = ['stack-up.sh', 'stack-restart.sh', 'stack-reset.sh', 'stack-data.sh'];
  it('stack:up, stack:restart, stack:reset and stack:data-* take the guard, then the lock, before their first Docker command', () => {
    for (const f of LOCKED) {
      const text = read(f);
      const guard = text.indexOf('storage_compat_guard');
      const lock = text.indexOf('storage_lock_acquire');
      const docker = text.search(/\b(require_docker|require_services_stopped|dc |docker )/);
      assert.ok(guard > 0 && lock > guard && (docker === -1 || docker > lock), `${f}: guard ${guard}, lock ${lock}, docker ${docker}`);
    }
  });
  it('qa-suite.sh and e2e-reset.sh take only the guard (no lock of their own), so their stack:up and stack:reset never nest a lock', () => {
    for (const f of ['qa-suite.sh', 'e2e-reset.sh']) {
      const text = read(f);
      assert.ok(text.includes('storage_compat_guard'), f);
      assert.ok(!text.includes('storage_lock_acquire') && !text.includes('storage-oplock.sh run'), f);
    }
    for (const f of LOCKED) for (const other of LOCKED) if (other !== f) assert.ok(!read(f).includes(`scripts/${other}`), `${f} calls ${other}`);
  });
  it('every inline `node -e` program of the storage scripts compiles (a raw line break in a JS string would stop the script)', () => {
    let count = 0;
    for (const f of ['lib.sh', 'stack-up.sh', 'stack-restart.sh', 'stack-reset.sh', 'qa-suite.sh', 'e2e-reset.sh', 'stack-data.sh', 'storage-compat.sh', 'storage-oplock.sh']) {
      for (const m of fs.readFileSync(path.join(HERE, f), 'utf8').matchAll(/node -e '([^']*)'/g)) {
        assert.doesNotThrow(() => new vm.Script(m[1]), `${f}: ${m[1].slice(0, 60)}`);
        count += 1;
      }
    }
    assert.ok(count >= 10, `found ${count}`);
  });
  it('stack-up.sh reads the pair state from the lti storage_preflight line of `check`', () => {
    const program = /pair_state="\$\(node -e '([^']*)'/.exec(fs.readFileSync(path.join(HERE, 'stack-up.sh'), 'utf8'))?.[1];
    assert.ok(program);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oplock-test-'));
    temps.push(dir);
    const out = path.join(dir, 'check.jsonl');
    fs.writeFileSync(out, ['not json', JSON.stringify({ event: 'storage_preflight', folder: 'app', state: 'OK' }), JSON.stringify({ event: 'storage_preflight', folder: 'lti', state: 'FIRST_START' }),
      JSON.stringify({ event: 'storage_preflight_summary', result: 'pass', reasons: [] })].join('\n'));
    assert.equal(execFileSync(process.execPath, ['-e', program, out], { encoding: 'utf8' }).trim(), 'FIRST_START');
  });
  it('lib.sh refusal lines from a start script: content_path_unsafe names the command (stack:up) and the relative path, escaped JSON', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oplock-test-'));
    temps.push(root);
    fs.mkdirSync(path.join(root, 'infra/scripts'), { recursive: true });
    for (const f of ['lib.sh', 'storage-oplock.sh']) fs.copyFileSync(path.join(HERE, f), path.join(root, 'infra/scripts', f));
    fs.writeFileSync(path.join(root, 'infra/scripts/stack-up.sh'), '#!/usr/bin/env bash\nset -euo pipefail\nsource "$(dirname "$0")/lib.sh"\nprepare_content_folders\necho PREPARED\n');
    fs.mkdirSync(path.join(root, 'infra/.data/cogniate-app'), { recursive: true });
    fs.symlinkSync(os.tmpdir(), path.join(root, 'infra/.data/cogniate-app/packages'));
    const r = spawnSync('bash', [path.join(root, 'infra/scripts/stack-up.sh')], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: root, COMPOSE_PROJECT_NAME: PROJECT } });
    assert.equal(r.status, 1);
    assert.doesNotMatch(r.stdout, /PREPARED/);
    const lines = r.stdout.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
    assert.deepEqual(lines.map((l) => [l.event, l.command, l.code, l.path]), [['storage_refused', 'stack:up', 'content_path_unsafe', 'infra/.data/cogniate-app/packages']]);
    assert.match(r.stderr, /^content_path_unsafe: .*packages is a symbolic link, not a directory, or not owned by /m);
    assert.ok(!r.stdout.includes(root), 'no absolute path');
    assert.equal(fs.lstatSync(path.join(root, 'infra/.data/cogniate-app/packages')).isSymbolicLink(), true);
  });
  it('lib.sh starts the Build Runner in its own process group (set -m)', () => {
    assert.match(read('lib.sh'), /\( set -m; nohup bash "\$INFRA_DIR\/scripts\/build-runner\.sh" watch/);
  });
});
