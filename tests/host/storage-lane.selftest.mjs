// HARNESS ONLY: StorageLane on host temporary folders with a recording HTTPS function and a fake Docker. No Docker,
// no network. Storage repair triage revision 4: V3-1, V3-2 (Origin), V4-1 #10 and #4 (host), boot and scratch/, and
// the Lead's LD-1 rule for the QA containers that a row keeps.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StorageLane } from './storage-lane.mjs';
import { rootClosure, binRule } from './storage-private-scan.mjs';

const { DatabaseSync } = await import('node:sqlite');
const PROJECT = 'qa-lane-st', IMAGE = 'sha256:' + 'b'.repeat(64);
const APP = 'https://app.qa-lane.test:8443', LTI = 'https://lti.qa-lane.test:8443';
const id64 = () => crypto.randomBytes(32).toString('hex');
const okResult = (stdout = '') => ({ code: 0, stdout, stderr: '', durationMs: 0 });

/** A lane on a temporary run root: fake runner, fake Docker (volumes labeled; QA containers as the control sets them). */
function lane(t, { request } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-lane-'))); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const clone = path.join(root, PROJECT + '-clone'); fs.mkdirSync(clone);
  const world = { qa: [], removed: [], failRemove: false, ran: [] };
  const docker = async (args) => {
    if (args[0] === 'image') return okResult(IMAGE + '\n');
    if (args[0] === 'volume' && args[1] === 'inspect') return okResult(JSON.stringify([{ Name: args[2], CreatedAt: '2026-10-21T10:00:00Z',
      Labels: { 'com.docker.compose.project': PROJECT, 'com.docker.compose.volume': args[2].split('_').at(-1) } }]));
    if (args[0] === 'ps') return okResult(world.qa.join('\n') + (world.qa.length ? '\n' : ''));
    if (args[0] === 'rm') {
      if (world.failRemove) return { code: 1, stdout: '', stderr: 'removal failed', durationMs: 0 };
      world.qa = world.qa.filter((id) => id !== args.at(-1)); world.removed.push(args.at(-1)); return okResult(args.at(-1) + '\n');
    }
    throw new Error('fake docker: ' + args.join(' '));
  };
  const r = { PROJECT, CLONE: clone, STACK_ENV: {}, docker, redact: { add: () => {} }, saveText: () => {}, record: () => {},
    state: { env: { PUBLIC_APP_URL: APP, PORTAL_THANH_PASSWORD: 'qa-thanh-password' }, urls: { app: APP, lti: LTI, moodle: 'https://moodle.qa-lane.test:8443' }, ca: null },
    exec: async (name, cmd, args) => {
      const all = cmd === 'bash' ? args.slice(4) : args;
      world.ran.push(name);
      if (all[0] === 'create' || (all[0] === 'run' && all.includes('-d'))) { const id = id64(); world.qa.push(id); return okResult(id + '\n'); }
      if (world.transientStays) world.qa.push(world.transientStays);
      return okResult(JSON.stringify({ op: 'list', lti: { state: 'present', entries: [] }, app: { state: 'present', entries: [] } }) + '\n');
    } };
  const l = new StorageLane(r, { request });
  l.imageId = IMAGE;
  return { lane: l, world, root, clone };
}

test('HARNESS ONLY: V3-1 every portal and app write sends Origin exactly PUBLIC_APP_URL; a GET sends none', async (t) => {
  const seen = [];
  const request = async (url, o) => {
    seen.push({ url, method: o.method, origin: o.headers.origin });
    if (url.endsWith('/app-api/session')) return { status: 204, headers: { 'set-cookie': ['__Host-cog_session=abc123def456; Path=/'] }, body: '' };
    if (url.startsWith(LTI)) return { status: 201, headers: {}, body: '{"id":"p1"}' };
    return { status: o.method === 'GET' ? 200 : 201, headers: {}, body: '{"id":"c1"}' };
  };
  const { lane: l, clone } = lane(t, { request });
  fs.mkdirSync(path.join(clone, 'infra/.secrets'), { recursive: true }); fs.writeFileSync(path.join(clone, 'infra/.secrets/lti-api-key.cogniate'), 'qa-lti-key-value');
  const markers = await l.writeMarkers('v3');
  assert.equal(markers.length, 2);
  const cookie = await l.portal();
  await l.app(cookie, 'GET', '/app-api/connections');
  for (const method of ['PUT', 'PATCH', 'DELETE']) await l.app(cookie, method, '/app-api/connections/c1', method === 'DELETE' ? undefined : {});
  const app = seen.filter((x) => x.url.startsWith(APP));
  const writes = app.filter((x) => x.method !== 'GET');
  assert.ok(writes.some((x) => x.url.endsWith('/app-api/session')) && writes.some((x) => x.url.endsWith('/app-api/connections') && x.method === 'POST'));
  for (const w of writes) assert.ok(originOk(w.origin), `${w.method} ${w.url}: Origin ${w.origin}`);
  assert.deepEqual(app.filter((x) => x.method === 'GET').map((x) => x.origin), [undefined], 'A GET sends no Origin (no other header change)');
  assert.ok(seen.filter((x) => x.url.startsWith(LTI)).every((x) => x.origin === undefined), 'The LTI API calls are unchanged');
});
/** The V3 predicate: exact string equality with PUBLIC_APP_URL. */
const originOk = (origin) => origin === APP;
test('HARNESS ONLY: V3-2 the Origin predicate refuses the LTI URL, PUBLIC_APP_URL + "/", and another port', () => {
  assert.equal(originOk(APP), true);
  for (const wrong of [LTI, APP + '/', 'https://app.qa-lane.test:9443', undefined, null, 'null']) assert.equal(originOk(wrong), false, String(wrong));
});

test('HARNESS ONLY: boot makes the five private folders 0700 and bin/ with the script at 0555; the closure and bin rules pass', async (t) => {
  const { lane: l } = lane(t);
  await l.boot();
  assert.deepEqual(rootClosure(l.private, { uid: process.getuid() }), []);
  assert.deepEqual(binRule(l.bin, { script: 'storage-fixture-script.mjs', sha256: l.scriptSha }), []);
  assert.deepEqual(fs.readdirSync(l.private).sort(), ['backups', 'bin', 'out', 'quarantine', 'scratch']);
  const record = l.scanPoint('after boot');
  assert.equal(record.failed, false, JSON.stringify(record.problems));
});

test('HARNESS ONLY: privateScratch makes <private>/scratch/<label>-<16 hex> at 0700; remove() removes it when clean', async (t) => {
  const { lane: l } = lane(t);
  await l.boot();
  const s = l.privateScratch('qa-label');
  assert.match(path.relative(l.private, s.path), /^scratch\/qa-label-[0-9a-f]{16}$/);
  assert.equal(fs.lstatSync(s.path).mode & 0o7777, 0o700);
  s.remove();
  assert.equal(fs.existsSync(s.path), false);
  assert.throws(() => l.privateScratch('Bad Label'), /Scratch label/);
  assert.equal(l.scans.at(-1).point, 'scratch removal qa-label', 'The removal is a scan point');
});

test('HARNESS ONLY: V4-1 #10 and #4 (host): backupLogical copies into the lane scratch only, 0600 from creation, under umask 022 and 000', async (t) => {
  for (const mask of [0o022, 0o000]) {
    const old = process.umask(mask);
    try {
      assert.equal(process.umask(mask), mask);
      const { lane: l, root } = lane(t);
      await l.boot();
      const backup = path.join(root, 'B');
      for (const [sub, db] of [['lti-service', 'lti.db'], ['cogniate-app', 'cogniate.db']]) {
        fs.mkdirSync(path.join(backup, sub), { recursive: true });
        const d = new DatabaseSync(path.join(backup, sub, db)); d.exec(`CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('qa-marker-${sub}')`); d.close();
        fs.chmodSync(path.join(backup, sub, db), 0o644);
      }
      const hooked = [], inScratch = [];
      const remove = l.removeScratch.bind(l);
      l.removeScratch = (label, dir) => {
        for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.db'))) { const st = fs.lstatSync(path.join(dir, f)); inScratch.push({ dev: st.dev, ino: st.ino, mode: st.mode & 0o777 }); }
        return remove(label, dir);
      };
      const read = await l.backupLogical(backup, [{ vol: 'lti', value: 'qa-marker-lti-service' }, { vol: 'app', value: 'qa-marker-cogniate-app' }], { hook: (h) => hooked.push(h) });
      assert.deepEqual([read.lti.markers['qa-marker-lti-service'], read.app.markers['qa-marker-cogniate-app']], [1, 1]);
      assert.equal(hooked.length, 4, 'Two #10 copies and two #4 copies');
      for (const h of hooked) {
        assert.ok(h.regular && h.mode === '0600' && h.size === 0, 'Created 0600 and empty');
        assert.ok(h.target.startsWith(path.join(l.private, 'scratch') + path.sep), 'Inside the lane scratch/: ' + h.target);
      }
      assert.equal(inScratch.length, 2);
      for (const f of inScratch) {
        assert.equal(f.mode, 0o600, 'Final #10 copy 0600');
        assert.ok(hooked.some((h) => h.dev === f.dev && h.ino === f.ino), 'The created inode is the final file');
      }
      assert.deepEqual(fs.readdirSync(l.scratch), [], 'The scratch is removed after a clean scan');
    } finally { process.umask(old); }
  }
});

test('HARNESS ONLY: LD-1 a kept decoy or volume user may stay only while its row runs; it is retired after its removal', async (t) => {
  for (const kind of ['storage-decoy', 'storage-volume-user']) {
    const { lane: l, world, clone } = lane(t);
    l.step = kind === 'storage-decoy' ? 'e-old-layout' : 'g-quarantine-in-use';
    const spec = kind === 'storage-decoy' ? { kind, legacyLtiDir: path.join(clone, 'infra/.data/lti-service'), detach: true } : { kind };
    const held = await l.container(spec);
    const id = held.stdout.trim();
    assert.equal(l.kept.get(id), l.step, kind + ' is kept for its row');
    await l.listing(); // positive: a fixture run of the same row while the kept container stays
    const res = await l.removeKept(id, kind === 'storage-decoy' ? ['-f'] : []);
    assert.equal(res.code, 0); assert.equal(l.kept.has(id), false, 'Retired after its removal');
    await l.listing();
    assert.deepEqual(world.removed, [id]);
  }
});
test('HARNESS ONLY: LD-1 negatives: an unexpected QA container, the transient container itself, a kept id of another row, a failed removal', async (t) => {
  const NO = /No QA container remains after its run/;
  { const { lane: l, world } = lane(t); l.step = 'd-stale'; world.qa.push(id64()); await assert.rejects(l.listing(), NO, 'An unexpected remaining id'); }
  { const { lane: l, world } = lane(t); l.step = 'd-stale'; world.transientStays = id64(); await assert.rejects(l.listing(), NO, 'No exemption for the container that just ran'); }
  { const { lane: l, world } = lane(t); l.step = 'g-quarantine-in-use'; const id = (await l.container({ kind: 'storage-volume-user' })).stdout.trim();
    l.step = 'g-quarantine'; await assert.rejects(l.listing(), NO, 'A kept id is not permitted in another row');
    l.step = null; await assert.rejects(l.listing(), NO, 'Nor outside a row'); assert.ok(world.qa.includes(id)); }
  { const { lane: l, world } = lane(t); l.step = 'g-quarantine-in-use'; const id = (await l.container({ kind: 'storage-volume-user' })).stdout.trim();
    world.failRemove = true;
    assert.equal((await l.removeKept(id)).code, 1); assert.equal(l.kept.has(id), true, 'A failed removal does not retire the id');
    l.step = 'g-quarantine'; await assert.rejects(l.listing(), NO, 'The container that stayed fails the next row'); }
});
