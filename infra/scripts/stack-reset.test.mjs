// Unit tests of the stack:reset content-parent rule (ADR-012 §15, revision 3.4; brief storage-reset-parent-repair §5)
// in a temp checkout whose path has a space (run: npm run test:infra). It has copies of stack-reset.sh, lib.sh,
// storage-oplock.sh and storage-compat.sh, a minimal .env and a fake `docker` first on PATH; no test calls the real Docker.
// P is infra/.data/cogniate-app. All reads use lstat: a symbolic link is never followed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = 'reset-unit';
const SCRIPTS = ['stack-reset.sh', 'lib.sh', 'storage-oplock.sh', 'storage-compat.sh'];
const SUCCESS = /^Stack data deleted\. Kept: /m;
const KEPT_EMPTY = 'Kept: .env, infra/.certs/, infra/.data/fixtures/, the empty folder infra/.data/cogniate-app/. Next:';
const KEPT_NONE = 'Kept: .env, infra/.certs/, infra/.data/fixtures/. Next:';
const sha = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const lstatOrNull = (p) => { try { return fs.lstatSync(p, { bigint: true }); } catch (err) { if (err.code === 'ENOENT') return null; throw err; } };
const temps = [];

/** Give every folder under `dir` (not through a link) the owner write and search bits, so the cleanup can remove it. */
function unlockTree(dir) {
  const st = lstatOrNull(dir);
  if (!st || !st.isDirectory()) return;
  fs.chmodSync(dir, 0o700);
  for (const name of fs.readdirSync(dir)) unlockTree(path.join(dir, name));
}
afterEach(() => { for (const t of temps.splice(0)) { unlockTree(t); fs.rmSync(t, { recursive: true, force: true }); } });

// The fake docker: `info` answers; `ps` lists nothing (the lock's storage containers; the own-project check prints
// FAKE_OTHER_CHECKOUT when it is set); `compose … down -v --remove-orphans` exits FAKE_DOWN_EXIT (default 0).
const FAKE_DOCKER = `#!/bin/bash
echo "docker $*" >> "$CALLS"
case "$1" in
  info) exit 0 ;;
  ps) case "$*" in *working_dir*) [ -z "$FAKE_OTHER_CHECKOUT" ] || echo "$FAKE_OTHER_CHECKOUT" ;; esac; exit 0 ;;
  compose) case " $* " in *" down -v --remove-orphans "*) exit "\${FAKE_DOWN_EXIT:-0}" ;; esac ;;
esac
exit 3
`;

/** A temp checkout (its path has a space), an `outside` folder next to it, and the fake docker. */
function checkout() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'stack reset '));
  temps.push(base);
  const root = path.join(base, 'check out');
  const outside = path.join(base, 'outside');
  fs.mkdirSync(path.join(root, 'infra/scripts'), { recursive: true });
  for (const f of SCRIPTS) fs.copyFileSync(path.join(HERE, f), path.join(root, 'infra/scripts', f));
  fs.writeFileSync(path.join(root, '.env'), `COMPOSE_PROJECT_NAME=${PROJECT}\n`);
  const bin = path.join(base, 'fake-bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'docker'), FAKE_DOCKER, { mode: 0o755 });
  const calls = path.join(base, 'calls.log');
  const at = (rel) => path.join(root, rel);
  const P = at('infra/.data/cogniate-app');
  const put = (file, text = path.basename(file)) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  const reset = (extra = {}) => {
    fs.writeFileSync(calls, '');
    const r = spawnSync('bash', [at('infra/scripts/stack-reset.sh')], { cwd: root, encoding: 'utf8', timeout: 60_000,
      env: { PATH: `${bin}:${process.env.PATH}`, HOME: base, CALLS: calls, ...extra } });
    return { code: r.status, stdout: r.stdout, stderr: r.stderr, calls: fs.readFileSync(calls, 'utf8').split('\n').filter(Boolean) };
  };
  return { root, outside, at, P, put, reset, lockDir: at(`.tmp/storage-op.${PROJECT}.lock`) };
}

/** Every entry under `dir` (recursive, lstat, never through a link): type, inode, mode and SHA-256 or link text. */
function listing(dir) {
  const out = {};
  const walk = (d, rel) => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      const r = rel ? `${rel}/${name}` : name;
      const st = fs.lstatSync(p, { bigint: true });
      const type = st.isSymbolicLink() ? 'link' : st.isDirectory() ? 'dir' : st.isFile() ? 'file' : 'other';
      out[r] = { type, ino: String(st.ino), mode: Number(st.mode & 0o7777n), content: type === 'file' ? sha(p) : type === 'link' ? fs.readlinkSync(p) : null };
      if (type === 'dir') walk(p, r);
    }
  };
  walk(dir, '');
  return out;
}
/** The path itself (lstat) and, for a real folder, its listing. */
function snapshot(p) {
  const st = lstatOrNull(p);
  if (!st) return null;
  return { dev: String(st.dev), ino: String(st.ino), mode: Number(st.mode & 0o7777n), dir: st.isDirectory(), entries: st.isDirectory() ? listing(p) : null };
}

/** The U1 tree: P (mode 0755) with database, dot, content and link entries; the other stack data; the outside folder. */
function seedStandard(c) {
  for (const f of ['cogniate.db', 'cogniate.db-wal', '.hidden', '.hidden-dir/x', 'packages/p1/index.html', 'uploads/.tmp/u1']) c.put(path.join(c.P, f));
  fs.chmodSync(c.P, 0o755);
  c.put(path.join(c.outside, 'target.txt'), 'outside data');
  fs.symlinkSync(c.outside, path.join(c.P, 'linked'));
  for (const f of ['infra/.data/lti-service/lti.db', 'infra/.data/backups/b', 'infra/.data/build-queue/requests/r', 'infra/.data/fixtures/f.zip',
    'infra/.secrets/seed.json', 'infra/.secrets/app/k', 'infra/.logs/x.jsonl', 'infra/.certs/root.crt']) c.put(c.at(f));
}

describe('stack:reset keeps a content parent of the host user, empty and 0700 (ADR-012 §15)', () => {
  it('U1 standard: every entry of P goes (dot names too, a link as a link); P keeps dev and inode; the other data goes as before', () => {
    const c = checkout();
    seedStandard(c);
    const before = lstatOrNull(c.P);
    const outsideBefore = snapshot(c.outside);
    const keep = Object.fromEntries(['.env', 'infra/.data/fixtures/f.zip', 'infra/.certs/root.crt'].map((f) => [f, sha(c.at(f))]));
    const r = c.reset();
    assert.equal(r.code, 0, r.stderr);
    const after = lstatOrNull(c.P);
    assert.ok(after, 'P still exists');
    assert.deepEqual([after.dev, after.ino], [before.dev, before.ino], 'P is the same folder (dev, inode)');
    assert.ok(after.isDirectory() && !after.isSymbolicLink(), 'P is a directory');
    assert.equal(Number(after.uid), process.getuid(), 'P belongs to the test user');
    assert.equal(Number(after.mode & 0o777n), 0o700, 'P has mode 0700');
    assert.deepEqual(fs.readdirSync(c.P), [], 'P has no entry');
    assert.deepEqual(snapshot(c.outside), outsideBefore, 'the link target is unchanged');
    for (const f of ['infra/.data/lti-service', 'infra/.data/backups', 'infra/.data/build-queue', 'infra/.secrets/seed.json', 'infra/.secrets/app', 'infra/.logs/x.jsonl']) {
      assert.equal(lstatOrNull(c.at(f)), null, `${f} is removed`);
    }
    for (const [f, hash] of Object.entries(keep)) assert.equal(sha(c.at(f)), hash, `${f} is unchanged`);
    assert.ok(r.stdout.includes(KEPT_EMPTY), r.stdout);
    assert.equal(fs.existsSync(c.lockDir), false, 'the lock is released');
    // No new Docker call: the lock's container list, docker info, the own-project check and one compose down.
    assert.deepEqual(r.calls.map((l) => l.split(' ').slice(0, 2).join(' ')), ['docker ps', 'docker info', 'docker ps', 'docker compose']);
    assert.match(r.calls[3], / down -v --remove-orphans$/);
    // A second reset (e2e:reset runs it before each run) keeps the same empty P.
    const again = c.reset();
    assert.equal(again.code, 0, again.stderr);
    const third = lstatOrNull(c.P);
    assert.deepEqual([third.ino, Number(third.mode & 0o777n), fs.readdirSync(c.P).length], [before.ino, 0o700, 0]);
  });

  it('U2 absent: P stays absent (stack:reset does not make it)', () => {
    const c = checkout();
    c.put(c.at('infra/.data/fixtures/f.zip'));
    const r = c.reset();
    assert.equal(r.code, 0, r.stderr);
    assert.equal(lstatOrNull(c.P), null);
    assert.ok(r.stdout.includes(KEPT_NONE), r.stdout);
  });

  it('U3 linked P: the link is removed as a link; the folder that it names keeps its names, SHA-256 and mode', () => {
    const c = checkout();
    for (const f of ['cogniate.db', '.hidden', 'packages/p1/index.html']) c.put(path.join(c.outside, f));
    fs.chmodSync(c.outside, 0o750);
    fs.mkdirSync(path.dirname(c.P), { recursive: true });
    fs.symlinkSync(c.outside, c.P);
    const outsideBefore = snapshot(c.outside);
    const r = c.reset();
    assert.equal(r.code, 0, r.stderr);
    assert.equal(lstatOrNull(c.P), null, 'the path P is absent');
    assert.deepEqual(snapshot(c.outside), outsideBefore);
    assert.equal(outsideBefore.mode, 0o750);
    assert.ok(r.stdout.includes(KEPT_NONE), r.stdout);
  });

  it('U4 file P: a regular file at P is removed', () => {
    const c = checkout();
    c.put(c.P, 'not a folder');
    const r = c.reset();
    assert.equal(r.code, 0, r.stderr);
    assert.equal(lstatOrNull(c.P), null);
    assert.ok(r.stdout.includes(KEPT_NONE), r.stdout);
  });

  // Each refusal stops at its own step: the last Docker call (or none) and the text show where.
  for (const [name, extra, prepare, stoppedAt] of [
    ['a failed compose down -v', { FAKE_DOWN_EXIT: '1' }, () => {}, (r) => assert.match(r.calls.at(-1), / down -v --remove-orphans$/)],
    ['the storage-compatibility marker (guard)', {}, (c) => c.put(c.at('.tmp/compose.knobs.yaml'), JSON.stringify({ 'x-cogniate-storage-compat': { formatVersion: 1, revisions: [] } })),
      (r) => { assert.deepEqual(r.calls, []); assert.match(r.stderr, /storage-compatibility override is enabled/); }],
    ['a project of another checkout', { FAKE_OTHER_CHECKOUT: '/elsewhere/infra' }, () => {},
      (r) => { assert.equal(r.calls.some((l) => l.startsWith('docker compose')), false); assert.match(r.stderr, /belongs to another checkout: \/elsewhere\/infra/); }],
  ]) {
    it(`U5 refusal first (${name}): exit not 0; P (names, types, SHA-256, inode, mode) is unchanged; no success line`, () => {
      const c = checkout();
      seedStandard(c);
      prepare(c);
      const before = snapshot(c.P);
      const r = c.reset(extra);
      assert.notEqual(r.code, 0);
      stoppedAt(r);
      assert.deepEqual(snapshot(c.P), before);
      assert.doesNotMatch(r.stdout, SUCCESS);
      assert.equal(fs.existsSync(c.lockDir), false, 'no lock is left');
    });
  }

  it('U6 cannot remove: an entry that stays makes the reset fail, with no success line', { skip: process.getuid() === 0 ? 'root can remove the entry' : false }, () => {
    const c = checkout();
    c.put(path.join(c.P, 'locked/f'));
    c.put(path.join(c.P, '.hidden'));
    fs.chmodSync(path.join(c.P, 'locked'), 0o500);
    const r = c.reset();
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /locked\/f.*Permission denied/);
    assert.doesNotMatch(r.stdout, SUCCESS);
    assert.ok(fs.existsSync(path.join(c.P, 'locked/f')), 'the entry is still there');
    assert.equal(fs.existsSync(c.lockDir), false, 'the lock is released');
  });
});
