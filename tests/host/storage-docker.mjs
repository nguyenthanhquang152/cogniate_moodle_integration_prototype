// Docker-facing helpers of the ADR-012 storage harness (revision 3.3 §11, §15, §17).
// Every Docker call goes through an injectable `docker(args, opts)` function, so the
// rules here are tested host-only with recorded answers. Node built-ins only.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { run } from './lib.mjs';

export class StorageBlocked extends Error { constructor(message) { super(message); this.name = 'StorageBlocked'; } }
export class StorageFail extends Error { constructor(message) { super(message); this.name = 'StorageFail'; } }

export const NODE_IMAGE = 'node:24.22.0-alpine3.24';
export const LANE_KEYS = ['ltidb', 'appdb'];
export const QA_KINDS = ['storage-fixture', 'storage-probe', 'storage-oracle', 'storage-decoy', 'storage-volume-user', 'storage-p5'];
// Mount points inside QA containers (QA's own choice; never product paths).
export const MOUNT = { ltidb: '/v/ltidb', appdb: '/v/appdb', script: '/qa/bin', out: '/qa/out' };

/** A docker runner with the lib.mjs `run` contract: resolves { code, stdout, stderr }. */
export const defaultDocker = (args, opts = {}) => run('docker', args, { timeoutMs: 120_000, ...opts });

// ------------------------------------------------------------ Docker clock (§11 item 6)

/** Whole seconds since the epoch from a Docker time string (RFC 3339, any fraction, Z or offset). */
export function dockerSecond(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(String(text ?? '').trim());
  if (!m) throw new StorageBlocked('Unreadable Docker time: ' + JSON.stringify(text));
  const [, y, mo, d, h, mi, s, zone] = m;
  let seconds = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)) / 1000;
  if (zone !== 'Z') {
    const sign = zone[0] === '-' ? -1 : 1;
    seconds -= sign * (Number(zone.slice(1, 3)) * 3600 + Number(zone.slice(4, 6)) * 60);
  }
  return seconds;
}
/** The Docker engine clock, rounded down to the whole second, plus the host time (recorded only). */
export async function dockerClock(docker = defaultDocker) {
  const r = await docker(['system', 'info', '--format', '{{.SystemTime}}']);
  if (r.code !== 0) throw new StorageBlocked('Cannot read the Docker engine clock');
  const text = r.stdout.trim();
  return { second: dockerSecond(text), engine: text, host: new Date().toISOString() };
}
/** §11 item 6: made after a start only when the creation second is not earlier than the start second. */
export const createdNotBefore = (created, startSecond) => dockerSecond(created) >= startSecond;

// ------------------------------------------------------------ lane volume presence (§11 items 1, 5)

export const laneVolumeName = (project, key) => `${project}_${key}`;
export const composeLabelsOk = (labels, project, key) => (labels?.['com.docker.compose.project'] === project)
  && (key === undefined || labels?.['com.docker.compose.volume'] === key);

/** Inspects one volume by its exact name. Absent is a value; any other error is unverifiable. */
export async function inspectVolume(docker, name) {
  const r = await docker(['volume', 'inspect', name]);
  if (r.code === 0) {
    const list = JSON.parse(r.stdout);
    const found = list.find((v) => v.Name === name);
    if (!found) throw new StorageBlocked('volume inspect returned another name for ' + name);
    return found;
  }
  if (/no such volume/i.test(r.stderr + r.stdout)) return null;
  throw new StorageBlocked(`Cannot inspect volume ${name}: ${r.stderr.trim().slice(0, 200)}`);
}
export function volumeRecord(v) {
  return v ? { Name: v.Name, CreatedAt: v.CreatedAt, Driver: v.Driver, Labels: v.Labels ?? {}, Mountpoint: v.Mountpoint,
    Options: v.Options ?? null, Scope: v.Scope } : null;
}
/** Both lane volumes by exact name: absent, labeled (mountable) or unsafe (§11 item 1). */
export async function volumePresence(docker, project) {
  const out = {};
  for (const key of LANE_KEYS) {
    const name = laneVolumeName(project, key);
    const v = await inspectVolume(docker, name);
    out[key] = !v ? { name, state: 'absent', record: null }
      : composeLabelsOk(v.Labels, project, key) ? { name, state: 'labeled', record: volumeRecord(v) }
        : { name, state: 'unsafe', record: volumeRecord(v) };
  }
  return out;
}
/**
 * Mount gate: a QA container mounts a lane volume only when it exists with this project's labels.
 * unsafe → FAIL (before the first start: BLOCKED). absent → never mounted (the caller must not need it).
 */
export function assertMountable(presence, keys, { beforeFirstStart = false } = {}) {
  for (const key of keys) {
    const p = presence[key];
    if (p.state === 'unsafe') {
      const why = `Unsafe lane volume ${p.name} (labels ${JSON.stringify(p.record.Labels)}, CreatedAt ${p.record.CreatedAt}); QA mounts, changes and removes nothing`;
      throw beforeFirstStart ? new StorageBlocked(why) : new StorageFail(why);
    }
    if (p.state !== 'labeled') throw new StorageFail(`Lane volume ${p.name} is absent; QA never mounts an absent volume`);
  }
  return true;
}

// ------------------------------------------------------------ QA fixture containers (§11 table)

const assertHex16 = (v) => { if (!/^[0-9a-f]{16}$/.test(v)) throw new Error('16 lowercase hex required'); };
export const hex16 = () => crypto.randomBytes(8).toString('hex');
/**
 * Builds the exact `docker run` / `docker create` arguments of one QA container kind.
 * Throws on any mount, user or option that the kind does not allow.
 */
export function fixtureArgs(spec) {
  const { kind, project, imageId, hostUid, hostGid, runTag = hex16() } = spec;
  if (!QA_KINDS.includes(kind)) throw new Error('Unknown QA container kind ' + kind);
  if (!/^(?:qa[234]?|qalead)-[a-z0-9-]+$/.test(project ?? '')) throw new Error('QA containers run only in a qa- lane');
  if (!/^sha256:[0-9a-f]{64}$/.test(imageId ?? '')) throw new Error('QA image must be pinned by its recorded image id');
  if (!/^\d+$/.test(String(hostUid)) || !/^\d+$/.test(String(hostGid))) throw new Error('HOST_UID and HOST_GID required');
  assertHex16(runTag);
  const name = `${project}-qa-${kind.replace('storage-', '')}-${runTag}`;
  const labels = ['--label', `org.cogniate.qa=${kind}`, '--label', `org.cogniate.lane=${project}`];
  const common = ['--name', name, '--network', 'none', ...labels];
  const user = (root) => ['--user', root ? '0:0' : `${hostUid}:${hostGid}`];
  const vol = (key, rw) => ['--mount', `type=volume,source=${laneVolumeName(project, key)},target=${MOUNT[key]}${rw ? '' : ',readonly'}`];
  const bind = (source, target, rw) => {
    if (!path.isAbsolute(source)) throw new Error('Bind sources must be absolute');
    return ['--mount', `type=bind,source=${source},target=${target}${rw ? '' : ',readonly'}`];
  };
  const cmd = spec.command ?? [];
  if (!Array.isArray(cmd) || cmd.some((a) => typeof a !== 'string')) throw new Error('Command must be a string list');
  switch (kind) {
    case 'storage-fixture': {
      const mode = spec.mode ?? 'read';
      if (!['read', 'write'].includes(mode)) throw new Error('Fixture mode is read or write');
      const root = spec.root === true;
      if (root && !(mode === 'write' && ['d-owner', 'd-mountpoint'].includes(spec.rootReason)))
        throw new Error('Root is allowed only for the owner changes of d-owner and d-mountpoint');
      const keys = spec.volumes ?? LANE_KEYS;
      if (!keys.length || keys.some((k) => !LANE_KEYS.includes(k))) throw new Error('Fixture mounts only the two lane volumes');
      return { name, verb: 'run', args: ['run', '--rm', ...common, ...user(root), ...keys.flatMap((k) => vol(k, mode === 'write')),
        ...bind(spec.scriptDir, MOUNT.script, false), ...bind(spec.outDir, MOUNT.out, true), imageId, ...cmd] };
    }
    case 'storage-probe': {
      const mounts = [...bind(spec.probeFile, '/probe/sqlite-lock-probe.mjs', false)];
      if (spec.hostNegativeDir) {
        if (!/[/\\]\.tmp[/\\]qa-host-negative-[0-9a-f]{16}$/.test(spec.hostNegativeDir)) throw new Error('Only the QA scratch bind');
        mounts.push(...bind(spec.hostNegativeDir, '/check/host-negative', true));
      }
      return { name, verb: 'run', args: ['run', '--rm', ...common, ...user(false), ...mounts, imageId, ...cmd] };
    }
    case 'storage-oracle': {
      if (!/[/\\]\.tmp[/\\]qa-host-negative-[0-9a-f]{16}$/.test(spec.hostNegativeDir ?? '')) throw new Error('Oracle uses only the QA scratch bind');
      return { name, verb: 'run', args: ['run', '--rm', ...common, ...user(false), ...bind(spec.scriptDir, MOUNT.script, false),
        ...bind(spec.hostNegativeDir, '/check/host-negative', true), ...bind(spec.outDir, MOUNT.out, true), imageId, ...cmd] };
    }
    case 'storage-decoy': {
      if (!/[/\\]infra[/\\]\.data[/\\]lti-service$/.test(spec.legacyLtiDir ?? '')) throw new Error('Decoy mounts only the legacy lti folder');
      return { name, verb: 'run', args: ['run', '-d', '--rm', ...common, '--label', `com.docker.compose.project=${project}`,
        ...user(false), ...bind(spec.legacyLtiDir, '/data', false), imageId, 'sleep', '300'] };
    }
    case 'storage-volume-user':
      return { name, verb: 'create', args: ['create', ...common, ...user(false), ...vol('ltidb', false), imageId, 'true'] };
    case 'storage-p5':
      return { name, verb: 'run', args: ['run', '--rm', ...common, ...user(false), ...vol('appdb', true),
        ...bind(spec.scriptDir, MOUNT.script, false), ...bind(spec.outDir, MOUNT.out, true), imageId, ...cmd] };
    default: throw new Error('unreachable');
  }
}
/** The lane volumes that one built argument list mounts (for the mount gate). */
export function mountedLaneKeys(args, project) {
  return LANE_KEYS.filter((key) => args.some((a) => a.startsWith('type=volume,') && a.includes(`source=${laneVolumeName(project, key)},`)));
}

/** QA's own containers of this lane, any state. */
export async function qaContainers(docker, project) {
  const r = await docker(['ps', '-aq', '--no-trunc', '--filter', `label=org.cogniate.lane=${project}`]);
  if (r.code !== 0) throw new StorageBlocked('Cannot list QA containers');
  return r.stdout.split('\n').filter(Boolean);
}

// ------------------------------------------------------------ G-1 identity binding (§17, A-S-14)

export const BOUND_IDENTITY = {
  os: { version: '27.0.1', arch: 'arm64' },
  cli: { version: '29.9.2', sha256: '6bbc39e9f2950720216f64c22d6e38afdd86a4672eee0d4e4389263c40ebd3e3' },
  compose: { version: '5.6.1', sha256: '31664b8ce83f3900ed3c52b8c2276706832793a0a379d9661defd6f88b386def' },
};
const sha256OfFile = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
/** Reads the three bound identities the §17 way. `exec(cmd, args)` resolves { code, stdout }. */
export async function readClientIdentity(exec = (cmd, args) => run(cmd, args, { timeoutMs: 30_000 }), { which, realpath = fs.realpathSync, hash = sha256OfFile } = {}) {
  const text = async (cmd, args) => { const r = await exec(cmd, args); if (r.code !== 0) throw new StorageBlocked(`${cmd} ${args.join(' ')} failed`); return r.stdout.trim(); };
  const dockerPath = which ? await which('docker') : await text('/bin/sh', ['-c', 'command -v docker']);
  const cliReal = realpath(dockerPath);
  const plugins = JSON.parse(await text('docker', ['info', '--format', '{{json .ClientInfo.Plugins}}']));
  const compose = (plugins ?? []).find((p) => p.Name === 'compose');
  if (!compose?.Path) throw new StorageBlocked('The CLI reports no compose plugin path');
  const composeReal = realpath(compose.Path);
  return {
    os: { version: await text('sw_vers', ['-productVersion']), arch: await text('uname', ['-m']) },
    cli: { version: await text('docker', ['version', '--format', '{{.Client.Version}}']), path: dockerPath, realPath: cliReal, sha256: hash(cliReal) },
    compose: { version: await text('docker', ['compose', 'version', '--short']), path: compose.Path, realPath: composeReal, sha256: hash(composeReal) },
  };
}
/** Compares observed identities with the bound table. A leading "v" of the Compose version is not significant. */
export function compareIdentity(observed, bound = BOUND_IDENTITY) {
  const v = (s) => String(s ?? '').replace(/^v/, '');
  const differences = [];
  const check = (label, a, b) => { if (a !== b) differences.push(`${label}: observed ${JSON.stringify(a)}, bound ${JSON.stringify(b)}`); };
  check('os.version', observed?.os?.version, bound.os.version);
  check('os.arch', observed?.os?.arch, bound.os.arch);
  check('cli.version', v(observed?.cli?.version), v(bound.cli.version));
  check('cli.sha256', observed?.cli?.sha256, bound.cli.sha256);
  check('compose.version', v(observed?.compose?.version), v(bound.compose.version));
  check('compose.sha256', observed?.compose?.sha256, bound.compose.sha256);
  return { match: differences.length === 0, differences };
}

// ------------------------------------------------------------ ownership record and teardown (§15, G1-QA-01)

const LANE_LABEL = (project) => `label=com.docker.compose.project=${project}`;
/** Lists every lane resource kind by the project label, QA's own containers, and both exact volume names. */
export async function listLane(docker, project) {
  const ids = async (args) => {
    const r = await docker(args);
    if (r.code !== 0) throw new StorageBlocked('Cannot list lane resources: ' + args.join(' '));
    return r.stdout.split('\n').filter(Boolean);
  };
  const containerIds = [...new Set([
    ...await ids(['ps', '-aq', '--no-trunc', '--filter', LANE_LABEL(project)]),
    ...await ids(['ps', '-aq', '--no-trunc', '--filter', `label=org.cogniate.lane=${project}`]),
  ])];
  const networkIds = await ids(['network', 'ls', '-q', '--no-trunc', '--filter', LANE_LABEL(project)]);
  const volumeNames = new Set(await ids(['volume', 'ls', '-q', '--filter', LANE_LABEL(project)]));
  for (const key of LANE_KEYS) volumeNames.add(laneVolumeName(project, key));
  const inspect = async (kind, list) => {
    if (!list.length) return [];
    const r = await docker([kind, 'inspect', ...list]);
    // An item can go away between the list and the inspect; inspect one by one then.
    if (r.code === 0) return JSON.parse(r.stdout);
    const out = [];
    for (const one of list) {
      const single = await docker([kind, 'inspect', one]);
      if (single.code === 0) out.push(...JSON.parse(single.stdout));
      else if (!/no such/i.test(single.stderr + single.stdout)) throw new StorageBlocked(`Cannot inspect ${kind} ${one}`);
    }
    return out;
  };
  const containers = (await inspect('container', containerIds)).map((c) => ({ kind: 'container', Id: c.Id,
    name: String(c.Name ?? '').replace(/^\//, ''), labels: c.Config?.Labels ?? {}, created: c.Created, state: c.State?.Status }));
  const networks = (await inspect('network', networkIds)).map((n) => ({ kind: 'network', Id: n.Id, name: n.Name,
    labels: n.Labels ?? {}, created: n.Created }));
  const volumes = [];
  for (const name of [...volumeNames].sort()) {
    const v = await inspectVolume(docker, name);
    if (v) volumes.push({ kind: 'volume', name: v.Name, labels: v.Labels ?? {}, created: v.CreatedAt, metadata: volumeRecord(v) });
  }
  return { containers, networks, volumes };
}
const resourceKey = (res) => `${res.kind}:${res.kind === 'volume' ? res.name : res.Id}`;
const sameVolumeMetadata = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * QA's ownership record (ADR-012 §15). Feed it every listing in order (`observe`). A resource is made by this
 * run only when it appeared after a listing in which it was absent, with a creation second not earlier than the
 * run's start second, and with this project's labels (the two lane volumes also need their volume key label).
 */
export class OwnershipLedger {
  constructor({ project, runStartSecond }) {
    if (!Number.isInteger(runStartSecond)) throw new Error('Run start second from the Docker clock required');
    this.project = project; this.runStartSecond = runStartSecond;
    this.records = []; this.previous = null; this.initial = null;
  }
  /** First listing: the run boundary. A fresh lane shows nothing (§15 "Fresh lane"). */
  start(listing) {
    if (this.previous) throw new Error('start() once');
    this.initial = listing; this.previous = listing;
    const present = [...listing.containers, ...listing.networks, ...listing.volumes];
    return { fresh: present.length === 0, present: present.map(({ kind, Id, name, labels, created }) => ({ kind, Id, name, labels, created })) };
  }
  labelsOk(res) {
    if (res.labels?.['com.docker.compose.project'] !== this.project && res.labels?.['org.cogniate.lane'] !== this.project) return false;
    const laneKey = LANE_KEYS.find((k) => res.kind === 'volume' && res.name === laneVolumeName(this.project, k));
    if (laneKey) return composeLabelsOk(res.labels, this.project, laneKey);
    return true;
  }
  observe(listing, command) {
    if (!this.previous) throw new Error('start() first');
    const before = new Map([...this.previous.containers, ...this.previous.networks, ...this.previous.volumes].map((r) => [resourceKey(r), r]));
    for (const res of [...listing.containers, ...listing.networks, ...listing.volumes]) {
      const key = resourceKey(res), seen = before.get(key);
      const replaced = res.kind === 'volume' && seen && !sameVolumeMetadata(seen.metadata, res.metadata);
      if (seen && !replaced) continue;
      const absentBefore = !seen;
      let createdOk = false;
      try { createdOk = createdNotBefore(res.created, this.runStartSecond); } catch { createdOk = false; }
      this.records.push({ ...res, command, absentBefore, madeByRun: absentBefore && createdOk && this.labelsOk(res),
        why: !absentBefore ? 'replaced without an absent listing in between' : !createdOk ? 'created before the run start second'
          : !this.labelsOk(res) ? 'labels do not match this project' : null });
    }
    this.previous = listing;
  }
  latest(res) {
    const key = resourceKey(res);
    return [...this.records].reverse().find((r) => resourceKey(r) === key) ?? null;
  }
  /** Decides removal per resource from a fresh listing (§15 "Teardown"); pure. */
  plan(fresh) {
    const remove = [], keep = [];
    for (const res of [...fresh.containers, ...fresh.networks, ...fresh.volumes]) {
      const rec = this.latest(res);
      const report = { kind: res.kind, name: res.name, Id: res.Id ?? null, labels: res.labels, created: res.created };
      if (!rec) { keep.push({ ...report, reason: 'unrecorded' }); continue; }
      if (!rec.madeByRun) { keep.push({ ...report, reason: 'not made by this run: ' + rec.why }); continue; }
      const same = res.kind === 'volume'
        ? res.name === rec.name && sameVolumeMetadata(res.metadata, rec.metadata)
        : res.Id === rec.Id && res.name === rec.name && res.labels?.['com.docker.compose.project'] === rec.labels?.['com.docker.compose.project']
          && res.labels?.['org.cogniate.lane'] === rec.labels?.['org.cogniate.lane'];
      if (!same) { keep.push({ ...report, reason: 'differs from its latest record' }); continue; }
      remove.push(res);
    }
    return { remove, keep };
  }
}
/** Removes exactly the planned resources; containers by Id, networks by Id, volumes by exact name. */
export async function removePlanned(docker, plan) {
  const failed = [];
  const step = async (args, res) => { const r = await docker(args, { timeoutMs: 180_000 }); if (r.code !== 0) failed.push({ ...res, error: r.stderr.trim().slice(0, 200) }); };
  for (const c of plan.remove.filter((r) => r.kind === 'container')) await step(['rm', '-f', '-v', c.Id], c);
  for (const v of plan.remove.filter((r) => r.kind === 'volume')) await step(['volume', 'rm', v.name], v);
  for (const n of plan.remove.filter((r) => r.kind === 'network')) await step(['network', 'rm', n.Id], n);
  return failed;
}
/** §15 "After cleanup": neither exact name exists and no resource has the project label. */
export function afterCleanupOk(listing) {
  return listing.containers.length + listing.networks.length + listing.volumes.length === 0;
}

// ------------------------------------------------------------ service containers ("nothing changes")

export async function serviceContainers(docker, project) {
  const r = await docker(['ps', '-aq', '--no-trunc', '--filter', LANE_LABEL(project)]);
  if (r.code !== 0) throw new StorageBlocked('Cannot list service containers');
  const ids = r.stdout.split('\n').filter(Boolean);
  if (!ids.length) return [];
  const inspected = await docker(['container', 'inspect', ...ids]);
  if (inspected.code !== 0) throw new StorageBlocked('Cannot inspect service containers');
  return JSON.parse(inspected.stdout)
    .filter((c) => c.Config?.Labels?.['com.docker.compose.oneoff'] !== 'True' && !c.Config?.Labels?.['org.cogniate.storage'])
    .map((c) => ({ id: c.Id, name: String(c.Name).replace(/^\//, ''), service: c.Config?.Labels?.['com.docker.compose.service'],
      state: c.State?.Status, running: c.State?.Running === true, startedAt: c.State?.StartedAt, created: c.Created,
      mounts: (c.Mounts ?? []).map((m) => ({ type: m.Type, source: m.Source, name: m.Name ?? null, destination: m.Destination })) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
/** Storage containers of a project (§7): compose project label and org.cogniate.storage. */
export async function storageContainers(docker, project) {
  const r = await docker(['ps', '-aq', '--no-trunc', '--filter', LANE_LABEL(project), '--filter', 'label=org.cogniate.storage']);
  if (r.code !== 0) throw new StorageBlocked('Cannot list storage containers');
  const ids = r.stdout.split('\n').filter(Boolean);
  if (!ids.length) return [];
  const inspected = await docker(['container', 'inspect', ...ids]);
  if (inspected.code !== 0) throw new StorageBlocked('Cannot inspect storage containers');
  return JSON.parse(inspected.stdout).map((c) => ({ id: c.Id, name: String(c.Name).replace(/^\//, ''), state: c.State?.Status,
    runLabel: c.Config?.Labels?.['org.cogniate.storage.run'] ?? null, kind: c.Config?.Labels?.['org.cogniate.storage'] }));
}
export const ACTIVE_STATES = ['running', 'paused', 'restarting', 'removing'];
/** Both services are positively stopped: exited, created, dead or absent (§9). */
export const servicesStopped = (services) => services.filter((s) => ['lti-service', 'cogniate-app'].includes(s.service))
  .every((s) => ['exited', 'created', 'dead'].includes(s.state));
