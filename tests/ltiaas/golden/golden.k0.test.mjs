// LA-E0-03 K0 checks of the golden tool, no Docker: AC-05 (normalization, secret scan), AC-06 (compare under 5 s,
// differences by path), AC-07 (negative control on a copy of the stored G-BASE capture), AC-08 (expected deltas).
// Run: node --test tests/ltiaas/golden/golden.k0.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  G1_LMS_PROVIDERS_AND_CONNECTIONS, captureDocuments, checkAcceptanceOutboundAllowlist, cliBinding, compareCaptures, diff, differingPaths, loadExpectedDelta, loadSimAllowlist, report,
} from './lib/compare.mjs';
import { DROP, normalize, normalizeFile, secretScan } from './lib/normalize.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BASELINE = '1b17261be97c4701b928fa9dc2fa74c6d23028f6';
const baseDir = path.join(here, BASELINE);
const FILES = ['G1', 'G2', 'G3', 'G4'];
const load = (dir) => Object.fromEntries(FILES.map((f) => [f, JSON.parse(fs.readFileSync(path.join(dir, `${f}.json`), 'utf8'))]));
// A fake JWT (no real key), joined at run time so that this file itself passes the secret scan.
const JWT = ['eyJhbGciOiJSUzI1NiJ9', 'eyJzdWIiOiJsZWFybmVyLTEifQ', 'c2lnbmF0dXJlLXZhbHVlLWZvci10ZXN0'].join('.');

test('AC-05 normalization: ids by first use, times, tokens, sorted keys', () => {
  const ctx = { ids: new Map(), dropped: new Map(), secrets: 0 };
  const out = normalize({
    z: 'con_yLzsibvxgMdzbFRUtERmWQ', a: { id: 'plt_Q9f2kLmNoPqRsTuVwXyZ12', again: 'con_yLzsibvxgMdzbFRUtERmWQ' },
    created: '2026-10-22T06:29:57.401Z', url: `https://app.cogniate.test:9443/tool/launch?ltik=${'x'.repeat(40)}&a=1`,
    id_token: JWT, raw: JWT, code: 'A'.repeat(43), name: 'M1 course-0123456789ab', tokenRef: '0123456789abcdef',
    jwk: { kty: 'RSA', n: 'q'.repeat(342), e: 'AQAB', kid: 'key-1' },
  }, ctx);
  assert.deepEqual(Object.keys(out), ['a', 'code', 'created', 'id_token', 'jwk', 'name', 'raw', 'tokenRef', 'url', 'z']);
  assert.equal(out.a.id, '<id:2>'); assert.equal(out.a.again, '<id:1>'); assert.equal(out.z, '<id:1>');
  assert.equal(out.created, '<t>');
  assert.equal(out.id_token, `<redacted:${JWT.length}>`); assert.equal(out.raw, `<redacted:${JWT.length}>`);
  assert.equal(out.code, '<redacted:43>');
  assert.equal(out.url, 'https://app.cogniate.test:9443/tool/launch?ltik=<redacted:40>&a=1');
  // Keys are visited in sorted order, so `jwk.kid` (key `jwk`) is used before `name` and `tokenRef`.
  assert.deepEqual(out.jwk, { e: '<public-key:4>', kid: '<id:3>', kty: 'RSA', n: '<public-key:342>' });
  assert.equal(out.name, 'M1 course-<id:4>');
  assert.equal(out.tokenRef, '<id:5>');
});

test('AC-05 drop list: each entry has a reason; jti, nonce, iat, exp go; timestamp only in score bodies', () => {
  for (const entry of DROP) assert.ok(typeof entry.reason === 'string' && entry.reason.length > 10, entry.key);
  assert.deepEqual(DROP.map((d) => d.key).sort(), ['exp', 'iat', 'jti', 'nonce', 'timestamp']);
  const { data, stats } = normalizeFile({ claims: { jti: 'x', nonce: 'y', iat: 1, exp: 2, sub: 'learner-1' },
    score: { scoreGiven: 7, scoreMaximum: 10, timestamp: '2026-10-22T00:00:00Z' }, page: { timestamp: 'kept' } });
  assert.deepEqual(data, { claims: { sub: 'learner-1' }, page: { timestamp: 'kept' }, score: { scoreGiven: 7, scoreMaximum: 10 } });
  assert.deepEqual(stats.dropped, { exp: 1, iat: 1, jti: 1, nonce: 1, timestamp: 1 });
});

test('AC-05 secret scan: a planted value, a JWT and a 43-character value are hits; the stored capture has 0 hits', () => {
  const planted = [['G9', `{"a":"${'s3cr3t-value-123'}","b":"${JWT}","c":"${'B'.repeat(43)}"}`]];
  assert.deepEqual(secretScan(planted, ['s3cr3t-value-123']).map((h) => h.kind).sort(),
    ['43-character random value', 'JWT', 'captured secret value']);
  const files = FILES.map((f) => [f, fs.readFileSync(path.join(baseDir, `${f}.json`), 'utf8')]);
  for (const name of fs.readdirSync(here)) assert.ok(!/private|raw|secret/i.test(name), `no private file in tests/ltiaas/golden: ${name}`);
  assert.deepEqual(secretScan(files), []);
});

test('AC-06 compare without Docker: the CLI compares the stored capture with itself in under 5 s', () => {
  const started = process.hrtime.bigint();
  const run = spawnSync(process.execPath, [path.join(here, 'compare.mjs'), '--base', baseDir, '--candidate', baseDir], { encoding: 'utf8' });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  assert.equal(run.status, 0, run.stdout + run.stderr); assert.match(run.stdout, /^EQUAL: 0 differences/m);
  assert.ok(ms < 5000, `compare took ${ms} ms`);
});

test('AC-07 negative control: one changed field in a copy of the capture fails and is named with the old and new value', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'golden-neg-'));
  try {
    for (const f of FILES) fs.copyFileSync(path.join(baseDir, `${f}.json`), path.join(dir, `${f}.json`));
    const g1 = JSON.parse(fs.readFileSync(path.join(dir, 'G1.json'), 'utf8'));
    const old = g1.acceptance.providers.profiles[1].issuer;
    g1.acceptance.providers.profiles[1].issuer = 'https://changed.example';
    fs.writeFileSync(path.join(dir, 'G1.json'), JSON.stringify(g1, null, 2));
    const run = spawnSync(process.execPath, [path.join(here, 'compare.mjs'), '--base', baseDir, '--candidate', dir], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.ok(run.stdout.includes(`DIFF G1 acceptance.providers.profiles[1].issuer (changed): ${JSON.stringify(old)} -> "https://changed.example"`), run.stdout);
    assert.match(run.stdout, /^DIFFERENT: 1 differences \(1 not explained\)/m);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC-08 expected delta: explained passes, unnamed fails, a named field that does not differ is "expected change missing"', () => {
  const base = { G1: { lmsProviders: { lms: [{ lms: 'moodle' }, { lms: 'canvas' }] } } };
  const candidate = { G1: { lmsProviders: { lms: [{ lms: 'moodle', channel: 'moodle' }, { lms: 'canvas', channel: 'canvas' }] } } };
  const delta = { id: 'LA-IC-99', changes: [{ file: 'G1', path: 'lmsProviders.lms[*].channel', rule: 'string' }] };
  assert.equal(compareCaptures(base, candidate, [delta]).ok, true);
  const unnamed = compareCaptures(base, candidate, []);
  assert.equal(unnamed.ok, false);
  assert.deepEqual(report(unnamed), [
    'DIFF G1 lmsProviders.lms[0].channel (added): (absent) -> "moodle"', 'DIFF G1 lmsProviders.lms[1].channel (added): (absent) -> "canvas"']);
  const extra = { id: 'LA-IC-98', changes: [{ file: 'G1', path: 'lmsProviders.lms[0].family', value: 'lti13' }] };
  const missing = compareCaptures(base, candidate, [delta, extra]);
  assert.equal(missing.ok, false);
  assert.deepEqual(report(missing).filter((l) => l.startsWith('MISSING')), [
    'MISSING G1 lmsProviders.lms[0].family: expected change missing [LA-IC-98] (value "lti13")']);
  const wrongValue = { id: 'LA-IC-97', changes: [{ file: 'G1', path: 'lmsProviders.lms[*].channel', value: 'moodle' }] };
  assert.equal(compareCaptures(base, candidate, [wrongValue]).ok, false, 'canvas does not equal the named value');
});

test('compare: removed and added array elements and keys are differences', () => {
  assert.deepEqual(diff({ a: [1, 2], b: 1 }, { a: [1], c: 2 }).map((d) => `${d.path}:${d.kind}`), ['a[1]:removed', 'b:removed', 'c:added']);
});

test('AC-04 support: the stored capture is complete (G1-G4, meta)', () => {
  const g = load(baseDir);
  for (const key of ['default', 'acceptance', 'connections', 'toolConfiguration', 'canvasConfiguration']) assert.ok(g.G1[key], `G1.${key}`);
  for (const channel of ['blackboard', 'canvas']) {
    assert.ok(g.G2[channel].records.length > 0, `G2.${channel}`); assert.ok(g.G3[channel].publications, `G3.${channel}`);
    assert.ok(Object.keys(g.G4[channel].pages).length >= 8, `G4.${channel}`);
  }
  const meta = JSON.parse(fs.readFileSync(path.join(baseDir, 'meta.json'), 'utf8'));
  assert.equal(meta.productSha, BASELINE); assert.equal(meta.secretHits, 0);
});

test('cliBinding: compare, differingPaths, captureDocuments and expected-delta file path work for task suites', () => {
  const docs = captureDocuments(baseDir);
  for (const re of G1_LMS_PROVIDERS_AND_CONNECTIONS) assert.ok(docs.some((d) => re.test(d)), String(re));
  assert.ok(docs.includes('G1/app-api/lms-providers'));
  const same = cliBinding.compare(baseDir, baseDir);
  const sameRun = spawnSync(same.cmd, same.args, { encoding: 'utf8' });
  assert.equal(sameRun.status, 0);
  assert.deepEqual(differingPaths(sameRun.stdout), []);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'golden-bind-'));
  try {
    for (const f of FILES) fs.copyFileSync(path.join(baseDir, `${f}.json`), path.join(dir, `${f}.json`));
    const g1 = JSON.parse(fs.readFileSync(path.join(dir, 'G1.json'), 'utf8'));
    g1.acceptance.lmsProviders.lms[0].channel = 'moodle';
    fs.writeFileSync(path.join(dir, 'G1.json'), JSON.stringify(g1, null, 2));
    const diffCmd = cliBinding.compare(baseDir, dir);
    const diffRun = spawnSync(diffCmd.cmd, diffCmd.args, { encoding: 'utf8' });
    assert.equal(diffRun.status, 1);
    assert.deepEqual(differingPaths(diffRun.stdout), ['G1.acceptance.lmsProviders.lms[0].channel']);
    assert.ok(G1_LMS_PROVIDERS_AND_CONNECTIONS.some((re) => re.test('G1.acceptance.lmsProviders.lms[0].channel')));

    const deltaFile = path.join(dir, 'LA-IC-01.json');
    fs.writeFileSync(deltaFile, JSON.stringify({
      id: 'LA-IC-01',
      changes: [{ file: 'G1', path: 'acceptance.lmsProviders.lms[0].channel', value: 'moodle' }],
    }));
    assert.equal(loadExpectedDelta(deltaFile).id, 'LA-IC-01');
    const expCmd = cliBinding.compare(baseDir, dir, deltaFile);
    const expRun = spawnSync(expCmd.cmd, expCmd.args, { encoding: 'utf8' });
    assert.equal(expRun.status, 0, expRun.stdout + expRun.stderr);
    assert.deepEqual(differingPaths(expRun.stdout), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('LA-IC-16 (BD-A1-36): acceptance.ltiHealth.outbound_allowlist compares .sim.test hosts as a set against hosts.json; non-sim and default profile stay strict', () => {
  const base = load(baseDir);
  const baseAllowlist = base.G1.acceptance.ltiHealth.outbound_allowlist;
  const baseNonSim = baseAllowlist.filter((h) => !h.endsWith('.sim.test'));
  assert.deepEqual(baseNonSim, ['moodle.test', 'qa-platform.test', 'evil.test']);

  const repoSimHosts = loadSimAllowlist();
  assert.ok(repoSimHosts.length >= 8 && repoSimHosts.every((h) => h.endsWith('.sim.test')));
  const ic16Delta = loadExpectedDelta('LA-IC-16');
  assert.equal(ic16Delta.id, 'LA-IC-16');

  // 1. Candidate matching repo tests/sim/hosts.json (even with reversed .sim.test order) passes compareCaptures and diff.
  const cloneWithAllowlist = (allowlist) => {
    const c = structuredClone(base);
    c.G1.acceptance.ltiHealth.outbound_allowlist = allowlist;
    return c;
  };
  const candRepoHosts = cloneWithAllowlist([...baseNonSim, ...[...repoSimHosts].reverse()]);
  assert.equal(checkAcceptanceOutboundAllowlist(baseAllowlist, candRepoHosts.G1.acceptance.ltiHealth.outbound_allowlist).ok, true);
  assert.deepEqual(diff(base.G1.acceptance.ltiHealth, candRepoHosts.G1.acceptance.ltiHealth, 'acceptance.ltiHealth'), []);
  const resAuto = compareCaptures(base, candRepoHosts);
  assert.equal(resAuto.ok, true);
  assert.equal(resAuto.differences.length, 1);
  assert.equal(resAuto.differences[0].explainedBy, 'LA-IC-16');
  const resExplicit = compareCaptures(base, candRepoHosts, [ic16Delta]);
  assert.equal(resExplicit.ok, true);
  assert.deepEqual(resExplicit.missing, []);

  // 2. Adding a new .sim.test host in hosts.json and in acceptance.ltiHealth.outbound_allowlist passes (library + CLI).
  const customSimHosts = [...repoSimHosts, 'zz-new-lms.sim.test'];
  const candNewSim = cloneWithAllowlist([...baseNonSim, ...customSimHosts]);
  assert.equal(compareCaptures(base, candNewSim, [ic16Delta], { simHosts: customSimHosts }).ok, true);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'golden-ic16-'));
  try {
    for (const f of FILES) fs.copyFileSync(path.join(baseDir, `${f}.json`), path.join(dir, `${f}.json`));
    fs.writeFileSync(path.join(dir, 'G1.json'), JSON.stringify(candNewSim.G1, null, 2));
    const customHostsFile = path.join(dir, 'hosts.json');
    fs.writeFileSync(customHostsFile, JSON.stringify({
      version: 1,
      providers: [{ id: 'custom-sim', aliases: customSimHosts, allowlist: customSimHosts }],
    }, null, 2));
    const cliPass = spawnSync(
      process.execPath,
      [path.join(here, 'compare.mjs'), '--base', baseDir, '--candidate', dir, '--expected', 'LA-IC-16', '--sim-hosts', customHostsFile],
      { encoding: 'utf8' },
    );
    assert.equal(cliPass.status, 0, cliPass.stdout + cliPass.stderr);
    assert.match(cliPass.stdout, /^EXPECTED G1 acceptance\.ltiHealth\.outbound_allowlist \(changed\): .* \[LA-IC-16\]$/m);
    assert.match(cliPass.stdout, /^EQUAL: 1 differences \(0 not explained\)/m);

    // 3. An unlisted .sim.test host (not in hosts.json) fails even when --expected LA-IC-16 is passed.
    const candUnlisted = cloneWithAllowlist([...baseNonSim, ...repoSimHosts, 'unlisted-rogue.sim.test']);
    assert.equal(checkAcceptanceOutboundAllowlist(baseAllowlist, candUnlisted.G1.acceptance.ltiHealth.outbound_allowlist).ok, false);
    assert.equal(compareCaptures(base, candUnlisted, [ic16Delta]).ok, false);
    assert.equal(diff(base.G1.acceptance.ltiHealth, candUnlisted.G1.acceptance.ltiHealth, 'acceptance.ltiHealth').length, 1);
    fs.writeFileSync(path.join(dir, 'G1.json'), JSON.stringify(candUnlisted.G1, null, 2));
    const cliUnlisted = spawnSync(
      process.execPath,
      [path.join(here, 'compare.mjs'), '--base', baseDir, '--candidate', dir, '--expected', 'LA-IC-16'],
      { encoding: 'utf8' },
    );
    assert.equal(cliUnlisted.status, 1);
    assert.match(cliUnlisted.stdout, /^DIFF G1 acceptance\.ltiHealth\.outbound_allowlist \(changed\):/m);

    // 4. A missing .sim.test host (in hosts.json but absent from acceptance.ltiHealth.outbound_allowlist) or duplicate .sim.test host fails.
    const candMissingSim = cloneWithAllowlist([...baseNonSim, ...repoSimHosts.slice(1)]);
    assert.equal(compareCaptures(base, candMissingSim, [ic16Delta]).ok, false);
    const candDupSim = cloneWithAllowlist([...baseNonSim, ...repoSimHosts, repoSimHosts[0]]);
    assert.equal(compareCaptures(base, candDupSim, [ic16Delta]).ok, false);

    // 5. A non-sim host change (replaced, removed, reordered, or added) in acceptance.ltiHealth.outbound_allowlist fails.
    for (const badNonSim of [
      ['other-moodle.test', 'qa-platform.test', 'evil.test'],
      ['moodle.test', 'qa-platform.test'],
      ['qa-platform.test', 'moodle.test', 'evil.test'],
      ['moodle.test', 'qa-platform.test', 'evil.test', 'extra.test'],
    ]) {
      const candBadNonSim = cloneWithAllowlist([...badNonSim, ...repoSimHosts]);
      assert.equal(checkAcceptanceOutboundAllowlist(baseAllowlist, candBadNonSim.G1.acceptance.ltiHealth.outbound_allowlist).ok, false);
      assert.equal(compareCaptures(base, candBadNonSim, [ic16Delta]).ok, false);
      assert.equal(diff(base.G1.acceptance.ltiHealth, candBadNonSim.G1.acceptance.ltiHealth, 'acceptance.ltiHealth').length, 1);
    }

    // 6. Adding a .sim.test host to acceptance.appHealth.outbound_allowlist fails (appHealth has no simulator hosts).
    const candAppSim = structuredClone(candRepoHosts);
    candAppSim.G1.acceptance.appHealth.outbound_allowlist.push(repoSimHosts[0]);
    const resAppSim = compareCaptures(base, candAppSim, [ic16Delta]);
    assert.equal(resAppSim.ok, false);
    assert.ok(resAppSim.differences.some((d) => !d.explainedBy && d.path.startsWith('acceptance.appHealth.outbound_allowlist')));

    // 7. A default-profile outbound_allowlist change (ltiHealth or appHealth) fails strictly.
    for (const section of ['ltiHealth', 'appHealth']) {
      const candDefaultChange = structuredClone(candRepoHosts);
      candDefaultChange.G1.default[section].outbound_allowlist.push(repoSimHosts[0]);
      const resDefault = compareCaptures(base, candDefaultChange, [ic16Delta]);
      assert.equal(resDefault.ok, false, `default.${section}.outbound_allowlist must stay strictly equal to G-BASE`);
      assert.ok(
        resDefault.differences.some((d) => !d.explainedBy && d.path.startsWith(`default.${section}.outbound_allowlist`)),
        `unexplained diff on default.${section}.outbound_allowlist`,
      );
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('LA-IC-12 (LA-E3-04 service part) and LA-IC-17 (BD-A1-41): expected-delta LD-9 records load cleanly with 0 golden and 0 frozen-test changes', () => {
  const base = load(baseDir);
  for (const id of ['LA-IC-12', 'LA-IC-17']) {
    const delta = loadExpectedDelta(id);
    assert.equal(delta.id, id);
    assert.deepEqual(delta.changes, []);
    assert.deepEqual(delta.ld9.goldenFields, []);
    assert.deepEqual(delta.ld9.frozenTestsTouched, []);
    assert.ok(Array.isArray(delta.ld9.scanChecked) && delta.ld9.scanChecked.length > 0, `${id} scanChecked`);
    const res = compareCaptures(base, base, [delta]);
    assert.equal(res.ok, true);
    assert.deepEqual(res.differences, []);
    assert.deepEqual(res.missing, []);
  }
  const ic12 = loadExpectedDelta('LA-IC-12');
  assert.equal(ic12.ld9.authorUnitTestChanges.length, 3);
  assert.deepEqual(ic12.ld9.goldenFieldsPendingAppPart, [
    'G4.blackboard.pages.picker.text',
    'G4.canvas.pages.picker.text',
  ]);
});
