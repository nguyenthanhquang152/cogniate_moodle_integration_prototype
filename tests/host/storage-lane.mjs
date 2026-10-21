// The storage lane context of the AC-M1-41 rows (ADR-012 revision 3.3 §11). It joins the host runner
// (core.mjs), QA's fixture containers and QA's own oracles. Every lane volume mount passes the
// exact-name gate first; every write-mode fixture runs under QA's operation lock.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { httpsLoopback, run } from './lib.mjs';
import { logicalRead, privateCopy } from './storage-fixture-script.mjs';
import {
  MOUNT, NODE_IMAGE, StorageBlocked, StorageFail, assertMountable, dockerClock, fixtureArgs, hex16, mountedLaneKeys,
  qaContainers, serviceContainers, servicesStopped, storageContainers, volumePresence,
} from './storage-docker.mjs';
import { check, clockSample, fileSets, identities, jsonLines, nothingChanged, readJsonl, spawnGroup } from './storage-oracle.mjs';
import { PhaseAbort, correctAll, folderChange, scanCause, scanPoint, scanRecord, scanTree } from './storage-private-scan.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SCRIPT = 'storage-fixture-script.mjs';
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64');

/** The last JSON line of QA's fixture script (it has `op` or `error`, never a lock `event`). */
export const fixtureAnswer = (stdout) => jsonLines(stdout).filter((l) => !('event' in l) && ('op' in l || 'error' in l)).at(-1) ?? null;

export class StorageLane {
  /**
   * @param r       the core.mjs runner (CLONE, PROJECT, STACK_ENV, exec, npm, observe, docker, record, saveText, state)
   * @param options { oplock: lock helper path relative to the clone, privateRoot: folder outside the checkout,
   *                  scans: the scan record list of the phase (shared by the lanes of one phase),
   *                  request: the HTTPS function (lib.mjs httpsLoopback; a self-test records the requests),
   *                  copyHook: a self-test observer of the creation checks of copy site #12; null at run time }
   */
  constructor(r, { oplock = 'infra/scripts/storage-oplock.sh', privateRoot, docker, scans, request, copyHook = null } = {}) {
    this.r = r; this.project = r.PROJECT; this.clone = r.CLONE; this.oplock = oplock;
    this.docker = docker ?? r.docker;
    this.request = request ?? httpsLoopback;
    this.copyHook = copyHook;
    this.hostUid = process.getuid(); this.hostGid = process.getgid();
    this.private = privateRoot ?? path.join(path.dirname(r.CLONE), path.basename(r.CLONE) + '-storage-private');
    this.bin = path.join(this.private, 'bin'); this.out = path.join(this.private, 'out');
    this.backups = path.join(this.private, 'backups'); this.quarantine = path.join(this.private, 'quarantine');
    this.scratch = path.join(this.private, 'scratch');
    this.imageId = null; this.markers = []; this.evidence = {};
    // §7.4: the scan records of the phase, QA's write ledger of protected files outside the areas, and the extra
    // private roots of the phase (the migration roots).
    this.scans = scans ?? []; this.writeLedger = new Set(); this.extraRoots = [];
    // LD-1 (Lead): the exact ids of the QA containers that a row keeps (its detached decoy, its created volume user),
    // with that row; `step` is the row that runs now (storagePhase sets it).
    this.kept = new Map(); this.step = null;
  }

  /** Private folders (mode 0700, outside the checkout), QA's script copy, and the pinned image id. */
  async boot() {
    for (const dir of [this.private, this.bin, this.out, this.backups, this.quarantine, this.scratch]) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); fs.chmodSync(dir, 0o700);
    }
    const script = path.join(this.bin, SCRIPT);
    fs.copyFileSync(path.join(HERE, SCRIPT), script); fs.chmodSync(script, 0o555);
    this.scriptSha = sha(script);
    // QA records the image id at the start of the run; the harness never pulls (no implicit download).
    const image = await this.docker(['image', 'inspect', '--format', '{{.Id}}', NODE_IMAGE]);
    if (image.code !== 0) throw new StorageBlocked(`QA image ${NODE_IMAGE} is not present; it must be made available under a separate authorization`);
    this.imageId = image.stdout.trim();
    this.r.saveText('storage/qa-image.json', JSON.stringify({ image: NODE_IMAGE, id: this.imageId, script: SCRIPT, sha256: this.scriptSha }, null, 2));
  }

  // ---------------------------------------------------------------- product commands

  /** One product command through npm, with the Docker-clock start second and the ownership listing after it. */
  async product(name, args, { env = {}, timeoutMs = 900_000 } = {}) {
    const clock = await dockerClock(this.docker);
    const result = await this.r.npm(name, ['run', ...args], { env: { ...this.r.STACK_ENV, ...env }, timeoutMs });
    return { ...result, startSecond: clock.second, startEngine: clock.engine, lines: jsonLines(result.stdout, result.stderr) };
  }
  async bash(name, args, { env = {}, timeoutMs = 600_000 } = {}) {
    const clock = await dockerClock(this.docker);
    const result = await this.r.exec(name, 'bash', args, { env: { ...this.r.STACK_ENV, ...env }, timeoutMs });
    return { ...result, startSecond: clock.second, lines: jsonLines(result.stdout, result.stderr) };
  }
  /** QA's own operation-lock wrapper (§7 scope): never around a guarded candidate command. */
  oplockArgs(command) { return [this.oplock, 'run', '--', ...command]; }
  compose(args) { return ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env', ...args]; }

  /** The harness stop of both services (an accepted harness action, §11); then QA checks both are stopped. */
  async stopServices(label = 'harness-stop') {
    const r = await this.r.exec(label, 'docker', this.compose(['stop', 'cogniate-app', 'lti-service']), { timeoutMs: 180_000 });
    check(r.code === 0, 'Harness docker compose stop failed');
    const services = await this.services();
    check(servicesStopped(services), 'Both services are positively stopped');
    return services;
  }
  async services() { return serviceContainers(this.docker, this.project); }
  async storageContainers() { return storageContainers(this.docker, this.project); }
  async presence() { return volumePresence(this.docker, this.project); }

  // ---------------------------------------------------------------- QA containers

  /** Runs one QA container. Read and write fixtures pass the exact-name gate; write mode needs stopped services and QA's lock. */
  async container(spec, { lock = false, timeoutMs = 120_000, allowWhileRunning = false, label } = {}) {
    const built = fixtureArgs({ project: this.project, imageId: this.imageId, hostUid: this.hostUid, hostGid: this.hostGid,
      scriptDir: this.bin, outDir: this.out, ...spec });
    const keys = mountedLaneKeys(built.args, this.project);
    if (keys.length) assertMountable(await this.presence(), keys, { beforeFirstStart: spec.beforeFirstStart === true });
    if (lock && !allowWhileRunning) check(servicesStopped(await this.services()), 'Write mode only while both services are positively stopped');
    const argv = lock ? ['bash', this.oplockArgs(['docker', ...built.args])] : ['docker', built.args];
    const result = await this.r.exec(label ?? `qa-${spec.kind}`, argv[0], argv[1], { timeoutMs });
    if (result.timedOut || result.code === -1) {
      // The host-side time bound: QA removes its own container by name, then reports.
      await this.docker(['rm', '-f', built.name]);
      throw new StorageFail(`QA container ${built.name} exceeded its time bound and was removed`);
    }
    if (built.verb === 'run' && !spec.detach) {
      // Only a container that this lane keeps for the row that runs now may stay; any other QA container fails.
      const left = await qaContainers(this.docker, this.project);
      check(left.every((id) => this.step !== null && this.kept.get(id) === this.step), 'No QA container remains after its run');
    }
    const keeps = (built.verb === 'run' && spec.detach && spec.kind === 'storage-decoy') || (built.verb === 'create' && spec.kind === 'storage-volume-user');
    if (keeps && result.code === 0 && /^[0-9a-f]{64}$/.test(result.stdout.trim())) this.kept.set(result.stdout.trim(), this.step);
    return { ...result, name: built.name };
  }
  /** Removes a kept QA container by its id; the id is retired only after a successful removal (LD-1). */
  async removeKept(id, flags = []) {
    const res = await this.docker(['rm', ...flags, id]);
    if (res.code === 0) this.kept.delete(id);
    return res;
  }
  /** Runs QA's script in a storage-fixture container and returns its JSON answer. */
  async script(op, { spec = {}, mode = 'read', root = false, rootReason, volumes, lock, allowWhileRunning = false, beforeFirstStart } = {}) {
    const keys = volumes ?? ['ltidb', 'appdb'];
    const command = ['node', '--no-warnings', `${MOUNT.script}/${SCRIPT}`, op,
      ...(keys.includes('ltidb') ? ['--lti', MOUNT.ltidb] : []), ...(keys.includes('appdb') ? ['--app', MOUNT.appdb] : []),
      '--out', MOUNT.out, '--spec', b64(spec)];
    const result = await this.container({ kind: 'storage-fixture', mode, root, rootReason, volumes: keys, command, beforeFirstStart },
      { lock: lock ?? mode === 'write', allowWhileRunning, label: `fixture-${op}` });
    // Under QA's lock the helper prints its own lock events on stdout; the answer is QA's script line.
    const answer = fixtureAnswer(result.stdout);
    if (result.code !== 0 || !answer || answer.error) throw new StorageFail(`QA fixture ${op} failed: ${answer?.error ?? result.stderr.slice(0, 300)}`);
    return answer;
  }
  /** Both volumes' listing; an absent volume is the value "absent" and is never mounted. */
  async listing() {
    const p = await this.presence();
    const present = ['ltidb', 'appdb'].filter((k) => p[k].state !== 'absent');
    const answer = present.length ? await this.script('list', { volumes: present }) : {};
    return { lti: p.ltidb.state === 'absent' ? { state: 'absent', entries: [] } : answer.lti,
      app: p.appdb.state === 'absent' ? { state: 'absent', entries: [] } : answer.app, presence: p };
  }
  async fileset() {
    const p = await this.presence();
    const present = ['ltidb', 'appdb'].filter((k) => p[k].state !== 'absent');
    const answer = present.length ? await this.script('fileset', { volumes: present }) : {};
    return { lti: answer.lti ?? { state: 'absent' }, app: answer.app ?? { state: 'absent' } };
  }
  async state() { const f = await this.fileset(); return { fileset: f, sets: fileSets(f), ids: identities(f) }; }
  async logical(markers, extra = {}) {
    return this.script('logical', { spec: { markers: markers.map((m) => m.value), ...extra } });
  }
  async plant(ops, { root = false, rootReason, allowWhileRunning = false } = {}) {
    return this.script('plant', { spec: { ops }, mode: 'write', root, rootReason, allowWhileRunning });
  }

  // ---------------------------------------------------------------- "nothing changes"

  async snapshot() {
    const clock = await dockerClock(this.docker);
    const listing = await this.listing();
    return { listing, presence: listing.presence, services: await this.services(), second: clock.second };
  }
  /** Compares a snapshot taken before a command with the state now (M1 rules and §11 item 5). */
  async assertUnchanged(before, what) {
    const after = await this.snapshot();
    const diffs = nothingChanged({ beforeListing: before.listing, afterListing: after.listing, beforePresence: before.presence,
      afterPresence: after.presence, beforeServices: before.services, afterServices: after.services, startSecond: before.second });
    check(diffs.length === 0, `${what}: something changed: ${diffs.join('; ')}`);
    return after;
  }

  // ---------------------------------------------------------------- public API (synthetic QA values only)

  loadStack() { this.r.loadStackFiles(); return this.r.state.urls; }
  apiKey() { const k = fs.readFileSync(path.join(this.clone, 'infra/.secrets/lti-api-key.cogniate'), 'utf8').trim(); this.r.redact.add(k); return k; }
  async lti(method, route, body, key = this.apiKey()) {
    const urls = this.r.state.urls;
    const res = await this.request(urls.lti + route, { method, ca: this.r.state.ca,
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    let json = null; try { json = JSON.parse(res.body); } catch { /* not JSON */ }
    return { ...res, json };
  }
  async portal(email = 'thanh@cogniate.test', password) {
    const urls = this.r.state.urls;
    const pw = password ?? this.r.state.env?.[email.startsWith('thanh') ? 'PORTAL_THANH_PASSWORD' : 'PORTAL_QAB_PASSWORD'];
    this.r.redact.add(pw);
    // security.md: every /app-api write, also the sign-in, needs Origin = PUBLIC_APP_URL.
    const res = await this.request(urls.app + '/app-api/session', { method: 'POST', ca: this.r.state.ca,
      headers: { 'content-type': 'application/json', origin: urls.app }, body: JSON.stringify({ email, password: pw }) });
    const cookie = [res.headers['set-cookie'] ?? []].flat().map((c) => c.split(';')[0]).find((c) => c.startsWith('__Host-cog_session='));
    check(res.status === 204 && cookie, `Portal sign-in of ${email}: HTTP ${res.status}`);
    this.r.redact.add(cookie.split('=')[1]);
    return cookie;
  }
  async app(cookie, method, route, body) {
    const urls = this.r.state.urls;
    const res = await this.request(urls.app + route, { method, ca: this.r.state.ca,
      headers: { cookie, 'content-type': 'application/json', ...(method !== 'GET' ? { origin: urls.app } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    let json = null; try { json = JSON.parse(res.body); } catch { /* not JSON */ }
    return { ...res, json };
  }
  /** The write after B in both databases: one new LTI platform and one new app connection (public API). */
  async writeMarkers(tag) {
    const value = (kind) => `qa-st-${kind}-${tag}-${hex16()}`;
    const platform = { vol: 'lti', value: value('platform') }, connection = { vol: 'app', value: value('conn') };
    const issuer = 'https://qa-storage.test';
    const p = await this.lti('POST', '/api/platforms', { url: issuer, clientId: platform.value, name: platform.value,
      authenticationEndpoint: issuer + '/auth', accesstokenEndpoint: issuer + '/token',
      authConfig: { method: 'JWK_SET', key: issuer + '/jwks' }, deploymentIds: ['qa-storage'] });
    check(p.status === 201, `New LTI platform: HTTP ${p.status} ${p.body.slice(0, 160)}`);
    const cookie = await this.portal();
    const c = await this.app(cookie, 'POST', '/app-api/connections', { name: connection.value, siteUrl: this.r.state.urls.moodle, method: 'manual' });
    check(c.status === 201, `New app connection: HTTP ${c.status} ${c.body.slice(0, 160)}`);
    return [platform, connection];
  }
  async waitHealthy() {
    const urls = this.r.state.urls;
    for (const [url, service] of [[urls.lti, 'lti-service'], [urls.app, 'cogniate-app']]) {
      const h = await this.r.waitHealth(url, (b) => b.status === 'ok', 120_000);
      check(h.ok, `${service} is healthy`);
    }
  }

  // ---------------------------------------------------------------- host files of the clone

  lockFolder() { return path.join(this.clone, '.tmp', `storage-op.${this.project}.lock`); }
  lockEvents() { return readJsonl(path.join(this.clone, 'infra/.logs/storage-lock.jsonl')); }
  preflightLog() { return readJsonl(path.join(this.clone, 'infra/.logs/storage-preflight.jsonl')); }
  allLogLines() {
    const dir = path.join(this.clone, 'infra/.logs');
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).flatMap((f) => readJsonl(path.join(dir, f))) : [];
  }
  /** Reads a backup's database copies on the host, in a private scratch folder, never the backup itself. */
  async backupLogical(folder, markers, { hook } = {}) {
    const out = {};
    for (const [vol, sub, db] of [['lti', 'lti-service', 'lti.db'], ['app', 'cogniate-app', 'cogniate.db']]) {
      const src = path.join(folder, sub);
      out[vol] = await this.withScratch('backup-read', async (scratch) => {
        for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(path.join(src, db + suffix))) privateCopy(path.join(src, db + suffix), path.join(scratch, db + suffix), { hook });
        return logicalRead(scratch, db, { markers: markers.map((m) => m.value), scratchBase: scratch, hook });
      });
    }
    return out;
  }

  // ---------------------------------------------------------------- private scratch and scans (triage §7.3–§7.5)

  /** A new folder `<private root>/scratch/<label>-<16 hex>` (mode 0700). remove() scans it first. */
  privateScratch(label) {
    if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Scratch label: ' + label);
    const dir = path.join(this.scratch, `${label}-${hex16()}`);
    fs.mkdirSync(dir, { mode: 0o700 }); fs.chmodSync(dir, 0o700); // a new empty folder: the mode is explicit, never the umask
    const st = fs.lstatSync(dir);
    check(st.isDirectory() && !st.isSymbolicLink() && (st.mode & 0o7777) === 0o700 && st.uid === this.hostUid, 'Private scratch is a 0700 folder of the host user: ' + dir);
    return { path: dir, remove: () => this.removeScratch(label, dir) };
  }
  /**
   * Zero hits: the folder is removed. A hit: the step FAILs and the folder stays as evidence, also after a safe correction.
   * A scratch folder that is not a real folder of the host user (from the private root down) is never walked or removed:
   * the cleanup cannot run safely, so the phase stops (triage §4.3).
   */
  removeScratch(label, dir) {
    const s = scanTree(dir, `scratch/${path.basename(dir)}`, { uid: this.hostUid, base: this.private });
    const record = scanRecord(`scratch removal ${label}`, { problems: s.problems, hits: s.hits, ...correctAll(s.hits, { uid: this.hostUid }) });
    this.recordScan(record);
    if (!s.scanned) throw new PhaseAbort(`private scratch ${label}: ${scanCause(record)}; the folder is not a real folder of the host user and is kept`);
    if (record.refusals.length) throw new PhaseAbort(`private scratch ${label}: ${scanCause(record)}; the folder is kept`);
    if (record.failed) throw new StorageFail(`private scratch ${label}: ${scanCause(record)}; the folder is kept as evidence`);
    // The folders from the private root down were checked by the scan; check them again just before the removal.
    const moved = folderChange({ base: this.private, chain: s.chain }, this.hostUid);
    if (moved) throw new PhaseAbort(`private scratch ${label}: the folder changed before the removal: ${moved}; the folder is kept`);
    fs.rmSync(dir, { recursive: true });
  }
  /**
   * Runs `fn(scratchPath)` in a new private scratch; the removal scan runs also after a failure (first cause kept). A
   * removal error after a body error (a scan hit or a phase stop) stays on that error as `scratchCleanup` (§7.5, §4.3).
   */
  async withScratch(label, fn) {
    const scratch = this.privateScratch(label);
    let value, first = null;
    try { value = await fn(scratch.path); } catch (e) { first = e instanceof Error ? e : new StorageFail(String(e)); }
    try { scratch.remove(); } catch (e) { if (!first) first = e; else first.scratchCleanup ??= e; }
    if (first) throw first;
    return value;
  }
  /** One §7.4 scan point of this lane: closure, bin/, the four areas, the extra roots and the outside classes. */
  scanPoint(point) {
    const record = scanPoint({ point, privateRoot: this.private, uid: this.hostUid, script: SCRIPT, scriptSha: this.scriptSha,
      extraRoots: this.extraRoots, clone: this.clone, ledger: this.writeLedger });
    this.recordScan(record);
    return record;
  }
  recordScan(record) {
    this.scans.push(record);
    this.r.saveText?.(`storage/scans/${String(this.scans.length).padStart(3, '0')}-${record.point.replace(/[^\w.-]+/g, '_').slice(0, 80)}.json`, JSON.stringify(record, null, 2));
  }
  /** The harness clock sample of a-serialize: host time, the Docker engine time, host time (triage §3.1 step 8). */
  async clockSample() { return clockSample(this.docker); }
  /** Starts a command as its own process group (storage-oracle.mjs spawnGroup); a self-test lane replaces it. */
  spawnGroup(cmd, args, opts) { return spawnGroup(cmd, args, opts); }
  newFolder(base, label) {
    const folder = path.join(base, `${label}-${hex16()}`);
    check(!folder.startsWith(this.clone + path.sep), 'Backup and quarantine folders stay outside the checkout');
    return folder;
  }
  async clock() { return dockerClock(this.docker); }
  /** Type, owner and mode of named entries of one volume (fixture op `meta`; lstat only). */
  async meta(vol, names) {
    const answer = await this.script('meta', { spec: { vol, names }, volumes: [vol === 'lti' ? 'ltidb' : 'appdb'] });
    return answer.entries;
  }
  run(cmd, args, opts) { return run(cmd, args, opts); }
  async storageContainerCheck() { return storageContainers(this.docker, this.project); }
}
