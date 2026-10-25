// HARNESS ONLY: the Docker-facing storage rules with recorded answers; no Docker command runs.
// This proves QA's gate, container arguments, identity binding and ownership decisions, not Docker.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOUND_IDENTITY, OwnershipLedger, StorageBlocked, StorageFail, afterCleanupOk, assertMountable, compareIdentity, createdNotBefore,
  dockerSecond, fixtureArgs, listLane, mountedLaneKeys, readClientIdentity, removePlanned, volumePresence,
} from './storage-docker.mjs';

const P = 'qa-multi-r1-st', IMAGE = 'sha256:' + 'a'.repeat(64);
const vol = (name, labels, created = '2026-10-21T10:00:05Z') => ({ Name: name, CreatedAt: created, Driver: 'local', Labels: labels,
  Mountpoint: '/var/lib/docker/volumes/' + name + '/_data', Options: null, Scope: 'local' });
const lanelabels = (key) => ({ 'com.docker.compose.project': P, 'com.docker.compose.volume': key });
/** A fake docker with a table of volumes, containers and networks. */
function fakeDocker(world) {
  const calls = [];
  const fn = async (args) => {
    calls.push(args);
    const [a, b, ...rest] = args;
    if (a === 'volume' && b === 'inspect') {
      const found = rest.map((n) => world.volumes.find((v) => v.Name === n));
      if (found.some((x) => !x)) return { code: 1, stdout: '[]', stderr: 'Error response from daemon: get x: no such volume' };
      return { code: 0, stdout: JSON.stringify(found), stderr: '' };
    }
    if (a === 'volume' && b === 'ls') return { code: 0, stdout: world.volumes.filter((v) => v.Labels?.['com.docker.compose.project'] === P).map((v) => v.Name).join('\n'), stderr: '' };
    if (a === 'ps') {
      const label = args[args.indexOf('--filter') + 1].replace('label=', '');
      const [k, v] = label.split('=');
      return { code: 0, stdout: world.containers.filter((c) => c.Config.Labels[k] === v).map((c) => c.Id).join('\n'), stderr: '' };
    }
    if (a === 'network' && b === 'ls') return { code: 0, stdout: world.networks.map((n) => n.Id).join('\n'), stderr: '' };
    if (a === 'container' && b === 'inspect') return { code: 0, stdout: JSON.stringify(rest.map((id) => world.containers.find((c) => c.Id === id))), stderr: '' };
    if (a === 'network' && b === 'inspect') return { code: 0, stdout: JSON.stringify(rest.map((id) => world.networks.find((n) => n.Id === id))), stderr: '' };
    if (a === 'rm' || (a === 'volume' && b === 'rm') || (a === 'network' && b === 'rm')) return { code: 0, stdout: '', stderr: '' };
    if (a === 'system') return { code: 0, stdout: world.clock ?? '2026-10-21T10:00:00.987654321Z\n', stderr: '' };
    throw new Error('unexpected docker call ' + args.join(' '));
  };
  fn.calls = calls;
  return fn;
}

test('HARNESS ONLY: Docker times are whole seconds on the engine clock; a same-second creation counts as after the start', () => {
  assert.equal(dockerSecond('2026-10-21T10:00:00Z'), Date.UTC(2026, 9, 21, 10, 0, 0) / 1000);
  assert.equal(dockerSecond('2026-10-21T10:00:00.999999999Z'), dockerSecond('2026-10-21T10:00:00Z'), 'Rounded down');
  assert.equal(dockerSecond('2026-10-21T12:00:00+02:00'), dockerSecond('2026-10-21T10:00:00Z'), 'Offsets');
  const start = dockerSecond('2026-10-21T10:00:00.700Z');
  assert.equal(createdNotBefore('2026-10-21T10:00:00Z', start), true, 'G1-QA-02: same second passes');
  assert.equal(createdNotBefore('2026-10-21T09:59:59Z', start), false);
  assert.throws(() => dockerSecond('yesterday'), StorageBlocked);
});

test('HARNESS ONLY: exact-name presence — absent, labeled, unsafe; unsafe never mounts and is BLOCKED before the first start', async () => {
  const world = { volumes: [vol(`${P}_ltidb`, lanelabels('ltidb')), vol(`${P}_appdb`, {})], containers: [], networks: [] };
  const p = await volumePresence(fakeDocker(world), P);
  assert.equal(p.ltidb.state, 'labeled'); assert.equal(p.appdb.state, 'unsafe');
  assert.throws(() => assertMountable(p, ['appdb']), StorageFail);
  assert.throws(() => assertMountable(p, ['appdb'], { beforeFirstStart: true }), StorageBlocked);
  assert.equal(assertMountable(p, ['ltidb']), true);
  const absent = await volumePresence(fakeDocker({ volumes: [], containers: [], networks: [] }), P);
  assert.equal(absent.ltidb.state, 'absent');
  assert.throws(() => assertMountable(absent, ['ltidb']), /never mounts an absent volume/);
  // A foreign project label with the lane name is unsafe as well.
  const foreign = await volumePresence(fakeDocker({ volumes: [vol(`${P}_ltidb`, { 'com.docker.compose.project': 'other', 'com.docker.compose.volume': 'ltidb' })], containers: [], networks: [] }), P);
  assert.equal(foreign.ltidb.state, 'unsafe');
  // An inspect error that is not "no such volume" is unverifiable, not absent.
  await assert.rejects(volumePresence(async () => ({ code: 1, stdout: '', stderr: 'permission denied' }), P), StorageBlocked);
});

test('HARNESS ONLY: QA container arguments follow the §11 table exactly', () => {
  const base = { project: P, imageId: IMAGE, hostUid: 501, hostGid: 20, scriptDir: '/priv/bin', outDir: '/priv/out', runTag: '0123456789abcdef' };
  const read = fixtureArgs({ ...base, kind: 'storage-fixture', command: ['node', 'x'] });
  assert.deepEqual(read.args.slice(0, 2), ['run', '--rm']);
  for (const want of ['--network', 'none', '--user', '501:20', `org.cogniate.qa=storage-fixture`, `org.cogniate.lane=${P}`, IMAGE]) assert.ok(read.args.includes(want), want);
  assert.ok(read.args.includes(`type=volume,source=${P}_ltidb,target=/v/ltidb,readonly`), 'Read mode mounts read-only');
  assert.deepEqual(mountedLaneKeys(read.args, P), ['ltidb', 'appdb']);
  const write = fixtureArgs({ ...base, kind: 'storage-fixture', mode: 'write', volumes: ['appdb'] });
  assert.ok(write.args.includes(`type=volume,source=${P}_appdb,target=/v/appdb`) && !write.args.some((a) => a.includes('_ltidb')));
  assert.throws(() => fixtureArgs({ ...base, kind: 'storage-fixture', root: true }), /Root is allowed only/);
  assert.throws(() => fixtureArgs({ ...base, kind: 'storage-fixture', mode: 'write', root: true, rootReason: 'f-pairid' }), /Root is allowed only/);
  assert.ok(fixtureArgs({ ...base, kind: 'storage-fixture', mode: 'write', root: true, rootReason: 'd-owner' }).args.includes('0:0'));
  assert.throws(() => fixtureArgs({ ...base, kind: 'storage-fixture', volumes: ['moodledata'] }), /only the two lane volumes/);
  assert.throws(() => fixtureArgs({ ...base, kind: 'storage-fixture', imageId: 'node:24' }), /pinned/);
  assert.throws(() => fixtureArgs({ ...base, kind: 'storage-fixture', project: 'cogniate-stack' }), /qa- lane/);
  const probe = fixtureArgs({ ...base, kind: 'storage-probe', probeFile: '/c/infra/scripts/sqlite-lock-probe.mjs' });
  assert.deepEqual(mountedLaneKeys(probe.args, P), [], 'The probe mounts no volume');
  assert.throws(() => fixtureArgs({ ...base, kind: 'storage-probe', probeFile: '/p', hostNegativeDir: '/tmp/other' }), /scratch bind/);
  assert.ok(fixtureArgs({ ...base, kind: 'storage-oracle', hostNegativeDir: '/c/.tmp/qa-host-negative-0123456789abcdef' }).args.includes('type=bind,source=/c/.tmp/qa-host-negative-0123456789abcdef,target=/check/host-negative'));
  const decoy = fixtureArgs({ ...base, kind: 'storage-decoy', legacyLtiDir: '/c/infra/.data/lti-service' });
  assert.deepEqual(decoy.args.slice(0, 3), ['run', '-d', '--rm']);
  assert.ok(decoy.args.includes(`com.docker.compose.project=${P}`) && decoy.args.includes('type=bind,source=/c/infra/.data/lti-service,target=/data,readonly'));
  assert.deepEqual(decoy.args.slice(-2), ['sleep', '300']);
  const user = fixtureArgs({ ...base, kind: 'storage-volume-user' });
  assert.equal(user.verb, 'create'); assert.ok(user.args.includes(`type=volume,source=${P}_ltidb,target=/v/ltidb,readonly`));
  const p5 = fixtureArgs({ ...base, kind: 'storage-p5' });
  assert.deepEqual(mountedLaneKeys(p5.args, P), ['appdb'], 'storage-p5 never mounts ltidb');
  assert.throws(() => fixtureArgs({ ...base, kind: 'storage-other' }), /Unknown QA container kind/);
});

test('HARNESS ONLY: A-S-14 identity binding — the bound table matches; any one difference blocks', async () => {
  const observed = { os: { version: '27.0.1', arch: 'arm64' }, cli: { version: '29.9.2', sha256: BOUND_IDENTITY.cli.sha256 },
    compose: { version: 'v5.6.1', sha256: BOUND_IDENTITY.compose.sha256 } };
  assert.deepEqual(compareIdentity(observed), { match: true, differences: [] }, 'A leading v of the Compose version is not significant');
  for (const [path, value] of [['os.version', '27.0.2'], ['os.arch', 'x86_64'], ['cli.version', '29.8.2'], ['cli.sha256', '0'.repeat(64)],
    ['compose.version', '5.6.0'], ['compose.sha256', '1'.repeat(64)]]) {
    const copy = JSON.parse(JSON.stringify(observed)); const [a, b] = path.split('.'); copy[a][b] = value;
    const result = compareIdentity(copy);
    assert.equal(result.match, false, path); assert.equal(result.differences.length, 1);
  }
  const answers = { 'sw_vers -productVersion': '27.0.1', 'uname -m': 'arm64', "docker version --format {{.Client.Version}}": '29.9.2',
    'docker compose version --short': '5.6.1', 'docker info --format {{json .ClientInfo.Plugins}}': JSON.stringify([{ Name: 'compose', Path: '/plug' }]) };
  const exec = async (cmd, args) => ({ code: 0, stdout: answers[[cmd, ...args].join(' ')] ?? '' });
  const read = await readClientIdentity(exec, { which: async () => '/usr/local/bin/docker', realpath: (p) => p + '.real',
    hash: (p) => (p === '/usr/local/bin/docker.real' ? BOUND_IDENTITY.cli.sha256 : BOUND_IDENTITY.compose.sha256) });
  assert.equal(read.cli.realPath, '/usr/local/bin/docker.real'); assert.equal(read.compose.realPath, '/plug.real');
  assert.equal(compareIdentity(read).match, true);
});

test('HARNESS ONLY: G1-QA-01 ownership record — only resources that appeared during the run, with labels, are removed', async () => {
  const world = { volumes: [], containers: [], networks: [], clock: '2026-10-21T10:00:00.400Z' };
  const docker = fakeDocker(world);
  const ledger = new OwnershipLedger({ project: P, runStartSecond: dockerSecond(world.clock) });
  assert.equal(ledger.start(await listLane(docker, P)).fresh, true, 'Fresh lane boundary');
  // The product creates its volumes in the start second (G1-QA-02), a container and a network.
  world.volumes.push(vol(`${P}_ltidb`, lanelabels('ltidb'), '2026-10-21T10:00:00Z'), vol(`${P}_appdb`, lanelabels('appdb'), '2026-10-21T10:00:01Z'));
  world.containers.push({ Id: 'c1', Name: `/${P}-lti-service-1`, Created: '2026-10-21T10:00:02.5Z', State: { Status: 'running' }, Config: { Labels: { 'com.docker.compose.project': P } } });
  world.networks.push({ Id: 'n1', Name: `${P}_default`, Created: '2026-10-21T10:00:01.1+00:00', Labels: { 'com.docker.compose.project': P } });
  ledger.observe(await listLane(docker, P), 'stack:up');
  // A QA mount of an absent name would make an unlabeled lane volume: it must be kept and reported.
  world.volumes = world.volumes.filter((v) => v.Name !== `${P}_appdb`);
  ledger.observe(await listLane(docker, P), 'quarantine-like removal');
  world.volumes.push(vol(`${P}_appdb`, {}, '2026-10-21T10:05:00Z'));
  ledger.observe(await listLane(docker, P), 'unlabeled appearance');
  let plan = ledger.plan(await listLane(docker, P));
  assert.deepEqual(plan.remove.map((r) => r.name).sort(), [`${P}-lti-service-1`, `${P}_default`, `${P}_ltidb`].sort());
  assert.deepEqual(plan.keep.map((k) => [k.name, k.reason.startsWith('not made by this run')]), [[`${P}_appdb`, true]]);
  // A volume replaced between two listings (no absent listing in between) is not proven: kept.
  world.volumes = world.volumes.map((v) => v.Name === `${P}_ltidb` ? { ...v, CreatedAt: '2026-10-21T10:09:00Z' } : v);
  ledger.observe(await listLane(docker, P), 'replaced');
  plan = ledger.plan(await listLane(docker, P));
  assert.ok(plan.keep.some((k) => k.name === `${P}_ltidb` && /replaced/.test(k.reason)));
  // A container whose Id differs from its latest record (same name) is kept.
  world.containers = [{ ...world.containers[0], Id: 'c2' }];
  plan = ledger.plan(await listLane(docker, P));
  assert.ok(plan.keep.some((k) => k.Id === 'c2' && k.reason === 'unrecorded'), 'An unrecorded Id is kept');
  // A resource created before the run start second is never made by the run.
  const early = new OwnershipLedger({ project: P, runStartSecond: dockerSecond('2026-10-21T11:00:00Z') });
  early.start({ containers: [], networks: [], volumes: [] });
  early.observe(await listLane(docker, P), 'late listing');
  assert.equal(early.plan(await listLane(docker, P)).remove.length, 0);
  const failed = await removePlanned(docker, { remove: [{ kind: 'container', Id: 'c1', name: 'x' }, { kind: 'volume', name: `${P}_ltidb` }, { kind: 'network', Id: 'n1', name: 'n' }], keep: [] });
  assert.deepEqual(failed, []);
  assert.ok(docker.calls.some((c) => c.join(' ') === 'rm -f -v c1') && docker.calls.some((c) => c.join(' ') === `volume rm ${P}_ltidb`) && docker.calls.some((c) => c.join(' ') === 'network rm n1'),
    'Removal by Id (containers, networks) and by exact name (volumes)');
  assert.equal(afterCleanupOk({ containers: [], networks: [], volumes: [] }), true);
  assert.equal(afterCleanupOk({ containers: [], networks: [], volumes: [{ name: `${P}_appdb` }] }), false, 'A label-only check is not enough');
});

test('HARNESS ONLY: a lane that is not fresh is reported with every present resource, labeled or not', async () => {
  const world = { volumes: [vol(`${P}_ltidb`, {})], containers: [], networks: [] };
  const ledger = new OwnershipLedger({ project: P, runStartSecond: 0 });
  const boundary = ledger.start(await listLane(fakeDocker(world), P));
  assert.equal(boundary.fresh, false);
  assert.deepEqual(boundary.present.map((p) => p.name), [`${P}_ltidb`], 'The exact name is found without labels');
});
