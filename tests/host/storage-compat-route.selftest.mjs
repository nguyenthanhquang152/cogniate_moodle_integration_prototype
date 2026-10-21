// HARNESS ONLY: ADR-012 §12 qualification logic on synthetic configs and records. No Docker, no git.
import test from 'node:test';
import assert from 'node:assert/strict';
import { StorageBlocked } from './storage-docker.mjs';
import { disallowedDifferences, forbiddenCommand, normalizeConfig, parseShaFile, qualifyRow, storagePreflightOk } from './storage-compat-route.mjs';

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
