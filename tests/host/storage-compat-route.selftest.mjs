// HARNESS ONLY: ADR-012 §12 qualification logic on synthetic configs and records. No Docker, no git.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StorageBlocked, StorageFail } from './storage-docker.mjs';
import { CompatRoute, OLD_SHAS, disallowedDifferences, forbiddenCommand, normalizeConfig, parseShaFile, qualifyRow, storagePreflightOk } from './storage-compat-route.mjs';
import { StorageLane } from './storage-lane.mjs';

const CHECKOUT = '/q/clone', P = 'qa-multi-r1';
const hex = (c) => c.repeat(64);
function c0() {
  return { name: P, services: {
    'lti-service': { image: 'x', environment: { A: '1' }, volumes: [{ type: 'bind', source: `${CHECKOUT}/infra/.data/lti-service`, target: '/data' }, { type: 'bind', source: `${CHECKOUT}/infra/.logs`, target: '/logs' }] },
    'cogniate-app': { image: 'y', volumes: [{ type: 'bind', source: `${CHECKOUT}/infra/.data/cogniate-app`, target: '/data' }] },
  } };
}
const preflight = () => ({ image: 'node:24.22.0-alpine3.24', profiles: ['storage'], user: '0:0', network_mode: 'none', restart: 'no',
  entrypoint: ['node', '/probe/sqlite-lock-probe.mjs'], command: null, environment: { HOST_UID: '501', HOST_GID: '20' },
  labels: { 'org.cogniate.storage': 'preflight' }, volumes: [
    { type: 'volume', source: 'ltidb', target: '/check/lti-service' }, { type: 'volume', source: 'appdb', target: '/check/cogniate-app' },
    { type: 'bind', source: `${CHECKOUT}/.tmp/storage-compat/sqlite-lock-probe.mjs`, target: '/probe/sqlite-lock-probe.mjs', read_only: true },
    { type: 'bind', source: `${CHECKOUT}/infra/.logs`, target: '/logs' }] });
function c1() {
  const c = c0();
  c.services['lti-service'].volumes[0] = { type: 'volume', source: 'ltidb', target: '/data' };
  c.services['cogniate-app'].volumes = [{ type: 'volume', source: 'appdb', target: '/data' },
    { type: 'bind', source: `${CHECKOUT}/infra/.data/cogniate-app/packages`, target: '/data/packages' },
    { type: 'bind', source: `${CHECKOUT}/infra/.data/cogniate-app/uploads`, target: '/data/uploads' }];
  c.volumes = { ltidb: { name: `${P}_ltidb` }, appdb: { name: `${P}_appdb` } };
  c.services['storage-preflight'] = preflight();
  c['x-cogniate-storage-compat'] = { formatVersion: 1 };
  return c;
}

test('HARNESS ONLY: C1 − C0 limited to (a)–(e) passes; any other difference is reported', () => {
  assert.deepEqual(disallowedDifferences(c0(), c1(), { checkout: CHECKOUT, project: P }), []);
  const env = c1(); env.services['lti-service'].environment.B = '2';
  assert.deepEqual(disallowedDifferences(c0(), env, { checkout: CHECKOUT, project: P }), ['services.lti-service.environment.B']);
  const label = c1(); label.services['cogniate-app'].labels = { x: 'y' };
  assert.deepEqual(disallowedDifferences(c0(), label, { checkout: CHECKOUT, project: P }), ['services.cogniate-app.labels']);
  const wrongBind = c1(); wrongBind.services['cogniate-app'].volumes[1].source = '/elsewhere';
  assert.ok(disallowedDifferences(c0(), wrongBind, { checkout: CHECKOUT, project: P }).includes('services.cogniate-app.volumes./data/packages'));
  const extraService = c1(); extraService.services.other = { image: 'z' };
  assert.deepEqual(disallowedDifferences(c0(), extraService, { checkout: CHECKOUT, project: P }), ['services.other']);
  const sameOrder = normalizeConfig({ services: { s: { volumes: [{ target: '/b' }, { target: '/a' }] } } });
  assert.deepEqual(Object.keys(sameOrder.services.s.volumes), ['/a', '/b'], 'volumes as a set keyed by target');
});

test('HARNESS ONLY: the storage-preflight service has exactly the §5 table fields', () => {
  assert.equal(storagePreflightOk(preflight(), CHECKOUT), true);
  for (const edit of [(s) => { s.user = '501:20'; }, (s) => { s.environment.EXTRA = '1'; }, (s) => { s.ports = ['1:1']; },
    (s) => { s.volumes.push({ type: 'bind', source: '/x', target: '/y' }); }, (s) => { s.profiles = []; }, (s) => { s.depends_on = {}; }]) {
    const s = preflight(); edit(s);
    assert.equal(storagePreflightOk(s, CHECKOUT), false);
  }
});

test('HARNESS ONLY: forbidden old commands and the copied hash file', () => {
  assert.equal(forbiddenCommand('npm', ['run', 'stack:restart', '--', 'lti-service']), 'old npm run stack:restart');
  assert.equal(forbiddenCommand('npm', ['run', 'stack:up']), 'old stack:up outside storage-compat.sh run --');
  assert.equal(forbiddenCommand('bash', ['.tmp/storage-compat/storage-compat.sh', 'run', '--', 'npm', 'run', 'stack:up']), null);
  assert.equal(forbiddenCommand('npm', ['run', 'seed']), null);
  assert.equal(forbiddenCommand('docker', ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env', 'stop', 'cogniate-app']), null);
  assert.equal(forbiddenCommand('docker', ['compose', '-f', 'infra/compose.yaml', 'up', '-d']), 'docker compose up without the knobs file');
  assert.equal(forbiddenCommand('npm', ['ci', '--no-audit']), null);
  const text = `${hex('a')}  infra/compat/storage-compat.knobs.json\n${hex('b')}  infra/scripts/sqlite-lock-probe.mjs\n${hex('c')}  infra/scripts/storage-compat.sh\n${hex('d')}  infra/scripts/storage-oplock.sh\n`;
  assert.deepEqual(parseShaFile(text), { 'storage-compat.knobs.json': hex('a'), 'sqlite-lock-probe.mjs': hex('b'), 'storage-compat.sh': hex('c'), 'storage-oplock.sh': hex('d') });
  assert.throws(() => parseShaFile(text.split('\n').slice(1).join('\n')), StorageBlocked);
});

test('HARNESS ONLY: j-row decision — a complete record passes; each missing or failed qualifier fails the row', () => {
  const step = () => ({ label: 's', oldSha: 'b0b83a8289e1bf9cf349068aca184f0879e9aaf0', treeRule: { ok: true }, compatHashes: { ok: true },
    configDiff: [{ profiles: [], disallowed: [] }], starts: [{ command: 'npm run stack:up', throughWrapper: true, preflightPass: true, statusPass: true, lockHeld: true }],
    commandLog: { forbidden: [], hostRestarts: 0 } });
  const old = 'b0b83a8289e1bf9cf349068aca184f0879e9aaf0';
  assert.deepEqual(qualifyRow([step()], { oldSha: old }), []);
  assert.deepEqual(qualifyRow([], { oldSha: old }), ['no old-build step was recorded']);
  const edits = [(s) => { delete s.compatHashes; }, (s) => { s.treeRule = { ok: false, problem: 'x' }; }, (s) => { s.configDiff[0].disallowed = ['services.x']; },
    (s) => { s.starts[0].preflightPass = false; }, (s) => { s.starts[0].statusPass = false; }, (s) => { s.starts[0].lockHeld = false; },
    (s) => { s.commandLog.forbidden = ['old npm run stack:reset']; }, (s) => { s.commandLog.hostRestarts = 1; }, (s) => { s.oldSha = '9f96f7b24cd0aed702e4dc40373bdda4307aad31'; }];
  for (const edit of edits) { const s = step(); edit(s); assert.equal(qualifyRow([s], { oldSha: old }).length, 1, edit.toString()); }
});

// ---------------------------------------------------------------- site #14: configDiff capture files (storage repair triage revision 4 §7.3, V4-8)

const SENTINEL = 'QA_SENTINEL_SECRET=qa-sentinel-' + Date.now();
/** A CompatRoute on a real StorageLane private scratch; `shell` and `docker` are fakes; no Docker, no bash. */
function route(t) {
  const run = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-config-diff-'))); t.after(() => fs.rmSync(run, { recursive: true, force: true }));
  const clone = path.join(run, 'clone'); fs.mkdirSync(clone);
  const r = { PROJECT: 'qa-multi-r1', CLONE: clone, STACK_ENV: {}, saveText: () => {} };
  const lane = new StorageLane(r);
  for (const d of [lane.private, lane.scratch]) fs.mkdirSync(d, { mode: 0o700 });
  const rt = new CompatRoute(r, { testSha: 'f'.repeat(40), lane });
  rt.begin('m1-23-old', OLD_SHAS[0]);
  const seen = { docker: 0, shell: [] };
  const docker = async () => { seen.docker++; return { code: 0, stdout: JSON.stringify(c0()), stderr: '' }; };
  return { rt, lane, run, seen, docker };
}
const writeCaptures = (opts) => {
  fs.writeFileSync(opts.env.QA_ARGS_FILE, ['compose', '-f', 'infra/compose.yaml', '-f', '.tmp/compose.knobs.yaml', 'config', ''].join('\0'));
  fs.writeFileSync(opts.env.QA_ENV_FILE, ['PATH=/usr/bin', SENTINEL, ''].join('\0'));
};
const umask022 = (fn) => async (t) => { const old = process.umask(0o022); try { assert.equal(process.umask(0o022), 0o022); await fn(t); } finally { process.umask(old); } };

test('HARNESS ONLY: V4-8 #14 both capture files are private empty files at creation and the same files after the shell', umask022(async (t) => {
  const { rt, lane, seen, docker } = route(t);
  const shell = async (script, opts) => {
    for (const f of [opts.env.QA_ARGS_FILE, opts.env.QA_ENV_FILE]) { const st = fs.lstatSync(f); seen.shell.push({ f, mode: st.mode & 0o7777, size: st.size, ino: st.ino, regular: st.isFile() }); }
    assert.ok(opts.env.QA_ENV_FILE.startsWith(path.join(lane.private, 'scratch') + path.sep), 'The capture is in the lane private scratch');
    writeCaptures(opts);
    return { code: 0, stdout: '', stderr: '' };
  };
  const record = await rt.configDiff([], { shell, docker });
  assert.deepEqual(record.disallowed, []);
  assert.deepEqual(seen.shell.map((x) => [x.mode, x.size, x.regular]), [[0o600, 0, true], [0o600, 0, true]], '0600 and size 0 when the shell starts, under umask 022');
  assert.deepEqual(fs.readdirSync(lane.scratch), [], 'The scratch is removed after a clean scan');
  assert.equal(lane.scans.at(-1).point, 'scratch removal compat-config'); assert.equal(lane.scans.at(-1).failed, false);
}));

test('HARNESS ONLY: V4-8 #14 a capture file swapped or filled before the shell stops before the shell; another inode after it stops before any read', umask022(async (t) => {
  // Before the shell: the env target becomes a link to a file outside the scratch, or gets bytes (the race between create and check).
  for (const swap of ['link', 'filled']) {
    const { rt, run, seen, docker } = route(t);
    const outside = path.join(run, 'outside-target'); fs.writeFileSync(outside, 'outside'); fs.chmodSync(outside, 0o600);
    const lstat = fs.lstatSync;
    fs.lstatSync = function (p, ...rest) {
      if (typeof p === 'string' && p.endsWith(path.sep + 'env') && p.includes('compat-config-')) {
        fs.lstatSync = lstat;
        if (swap === 'link') { fs.rmSync(p); fs.symlinkSync(outside, p); } else fs.writeFileSync(p, 'x');
      }
      return lstat.call(fs, p, ...rest);
    };
    let ran = false;
    try {
      await assert.rejects(rt.configDiff([], { shell: async () => { ran = true; return { code: 0 }; }, docker }),
        (e) => e instanceof StorageFail && /^Capture files are not private: env before the shell: /.test(e.message) && (swap === 'link' ? /not a regular file/ : /not empty/).test(e.message));
    } finally { fs.lstatSync = lstat; }
    assert.equal(ran, false, swap + ': the shell does not start');
    assert.equal(fs.readFileSync(outside, 'utf8'), 'outside', 'The link target is unchanged');
    assert.equal(seen.docker, 0);
  }
  // During the shell: another inode at the env path. QA reads no captured byte; the scratch is kept (its scan found the new file).
  const { rt, lane, seen, docker } = route(t);
  const shell = async (script, opts) => { writeCaptures(opts); const bytes = fs.readFileSync(opts.env.QA_ENV_FILE); fs.rmSync(opts.env.QA_ENV_FILE); fs.writeFileSync(opts.env.QA_ENV_FILE, bytes, { mode: 0o644 }); return { code: 0 }; };
  await assert.rejects(rt.configDiff([], { shell, docker }), (e) => e instanceof StorageFail && /^Capture files changed during the shell: env after the shell: another device or inode/.test(e.message) && !e.message.includes('qa-sentinel'));
  assert.equal(seen.docker, 0, 'No docker call: no captured byte was used');
  const kept = fs.readdirSync(lane.scratch);
  assert.equal(kept.length, 1, 'The scratch with the 0644 capture is kept as evidence');
  assert.equal(lane.scans.at(-1).failed, true);
  assert.equal(fs.lstatSync(path.join(lane.scratch, kept[0], 'env')).mode & 0o7777, 0o600, 'A safe correction of the same inode; still a FAIL');
}));
