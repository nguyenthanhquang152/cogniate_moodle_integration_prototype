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
  assert.ok(Array.isArray(ic16Delta.ld9.scanChecked) && ic16Delta.ld9.scanChecked.length >= 6, 'LA-IC-16 scanChecked');
  assert.equal(typeof ic16Delta.ld9.scanResult, 'string');

  // 1. Candidate matching repo tests/sim/hosts.json (even with reversed .sim.test order):
  //    - fails compareCaptures when LA-IC-16 is NOT in expected (opt-in semantics: A-LA-LD9-01 / B-LD9-01);
  //    - passes compareCaptures when [ic16Delta] IS in expected, and passes diff() directly.
  const cloneWithAllowlist = (allowlist) => {
    const c = structuredClone(base);
    c.G1.acceptance.ltiHealth.outbound_allowlist = allowlist;
    return c;
  };
  const candRepoHosts = cloneWithAllowlist([...baseNonSim, ...[...repoSimHosts].reverse()]);
  assert.equal(checkAcceptanceOutboundAllowlist(baseAllowlist, candRepoHosts.G1.acceptance.ltiHealth.outbound_allowlist).ok, true);
  assert.deepEqual(diff(base.G1.acceptance.ltiHealth, candRepoHosts.G1.acceptance.ltiHealth, 'acceptance.ltiHealth'), []);
  const resWithoutExpected = compareCaptures(base, candRepoHosts);
  assert.equal(resWithoutExpected.ok, false, 'Without LA-IC-16 in expected, allowlist diff must not be auto-explained');
  assert.equal(resWithoutExpected.differences.length, 1);
  assert.equal(resWithoutExpected.differences[0].explainedBy, null);
  assert.match(report(resWithoutExpected)[0], /^DIFF G1 acceptance\.ltiHealth\.outbound_allowlist \(changed\):/);
  const resExplicit = compareCaptures(base, candRepoHosts, [ic16Delta]);
  assert.equal(resExplicit.ok, true);
  assert.equal(resExplicit.differences.length, 1);
  assert.equal(resExplicit.differences[0].explainedBy, 'LA-IC-16');
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

test('LA-IC-15 (LA-E4-03): G3 B-conflict score 409 lastError names the connection channel (Blackboard / Canvas) and fails without --expected LA-IC-15 or with wrong LMS text', () => {
  const base = load(baseDir);
  const ic15Delta = loadExpectedDelta('LA-IC-15');
  assert.equal(ic15Delta.id, 'LA-IC-15');
  assert.equal(ic15Delta.changes.length, 2);
  assert.deepEqual(ic15Delta.ld9.frozenTestsTouched, []);
  assert.ok(Array.isArray(ic15Delta.ld9.scanChecked) && ic15Delta.ld9.scanChecked.length >= 8, 'LA-IC-15 scanChecked');

  const cand = structuredClone(base);
  cand.G3.blackboard.publications['B-conflict'].results[0].scoreSyncs[0].lastError =
    '409 PLATFORM_CONFLICT: The platform answered 409: it has a newer value (for example a grade with a newer time). (Blackboard has a grade with a newer time)';
  cand.G3.canvas.publications['B-conflict'].results[0].scoreSyncs[0].lastError =
    '409 PLATFORM_CONFLICT: The platform answered 409: it has a newer value (for example a grade with a newer time). (Canvas has a grade with a newer time)';

  // Without LA-IC-15 in expected, compareCaptures fails on both G3 paths.
  const resWithout = compareCaptures(base, cand);
  assert.equal(resWithout.ok, false);
  assert.equal(resWithout.differences.length, 2);
  assert.ok(resWithout.differences.every((d) => d.explainedBy === null));

  // With LA-IC-15 in expected, both G3 differences are explained and 0 expected changes are missing.
  const resWith = compareCaptures(base, cand, [ic15Delta]);
  assert.equal(resWith.ok, true);
  assert.equal(resWith.differences.length, 2);
  assert.ok(resWith.differences.every((d) => d.explainedBy === 'LA-IC-15'));
  assert.deepEqual(resWith.missing, []);

  // If one channel keeps the old Moodle text or uses the wrong channel name, LA-IC-15 fails.
  const candPartial = structuredClone(cand);
  candPartial.G3.canvas.publications['B-conflict'].results[0].scoreSyncs[0].lastError =
    base.G3.canvas.publications['B-conflict'].results[0].scoreSyncs[0].lastError;
  const resPartial = compareCaptures(base, candPartial, [ic15Delta]);
  assert.equal(resPartial.ok, false);
  assert.equal(resPartial.missing.length, 1);

  const candWrongLms = structuredClone(cand);
  candWrongLms.G3.canvas.publications['B-conflict'].results[0].scoreSyncs[0].lastError =
    '409 PLATFORM_CONFLICT: The platform answered 409: it has a newer value (for example a grade with a newer time). (Blackboard has a grade with a newer time)';
  const resWrongLms = compareCaptures(base, candWrongLms, [ic15Delta]);
  assert.equal(resWrongLms.ok, false);
  assert.ok(resWrongLms.differences.some((d) => d.path.startsWith('canvas.') && d.explainedBy === null));

  // CLI check with --expected LA-IC-15.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'golden-ic15-'));
  try {
    for (const f of FILES) fs.copyFileSync(path.join(baseDir, `${f}.json`), path.join(dir, `${f}.json`));
    fs.writeFileSync(path.join(dir, 'G3.json'), JSON.stringify(cand.G3, null, 2));
    const cliPass = spawnSync(
      process.execPath,
      [path.join(here, 'compare.mjs'), '--base', baseDir, '--candidate', dir, '--expected', 'LA-IC-15'],
      { encoding: 'utf8' },
    );
    assert.equal(cliPass.status, 0, cliPass.stdout + cliPass.stderr);
    assert.match(cliPass.stdout, /^EXPECTED G3 blackboard\.publications\.B-conflict\.results\[0\]\.scoreSyncs\[0\]\.lastError \(changed\): .* \[LA-IC-15\]$/m);
    assert.match(cliPass.stdout, /^EXPECTED G3 canvas\.publications\.B-conflict\.results\[0\]\.scoreSyncs\[0\]\.lastError \(changed\): .* \[LA-IC-15\]$/m);
    assert.match(cliPass.stdout, /^EQUAL: 2 differences \(0 not explained\), 0 expected changes missing; expected-delta files: LA-IC-15;/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function setByPath(root, pathStr, val) {
  const segs = [];
  const re = /([^[.\]]+)|\[(\d+|"[^"]+")\]/g;
  let m;
  while ((m = re.exec(pathStr)) !== null) {
    if (m[1] !== undefined) segs.push(m[1]);
    else if (m[2].startsWith('"')) segs.push(JSON.parse(m[2]));
    else segs.push(Number(m[2]));
  }
  let cur = root;
  for (let i = 0; i < segs.length - 1; i++) cur = cur[segs[i]];
  cur[segs[segs.length - 1]] = structuredClone(val);
}

test('LA-IC-01 (E1/E2/E3/E6), LA-IC-03 (LA-E2-02), LA-IC-04 (LA-E3-07), LA-IC-12 (LA-E3-04/05), LA-IC-13 (LA-E3-12), LA-IC-14 (LA-E3-09/15), LA-IC-17 (BD-A1-41), LA-IC-18 (BD-A1-50), LA-IC-19 (BD-A1-57), LA-IC-20 (BD-A1-63/81), and LA-IC-21 (BD-A1-93): expected-delta LD-9 records load cleanly and explain their golden and frozen-test changes', () => {
  const base = load(baseDir);
  for (const id of ['LA-IC-03', 'LA-IC-13', 'LA-IC-17', 'LA-IC-18', 'LA-IC-19', 'LA-IC-20', 'LA-IC-21']) {
    const delta = loadExpectedDelta(id);
    assert.equal(delta.id, id);
    assert.deepEqual(delta.changes, []);
    assert.deepEqual(delta.ld9.goldenFields, []);
    assert.deepEqual(delta.ld9.frozenTestsTouched, []);
    assert.ok(Array.isArray(delta.ld9.scanChecked) && delta.ld9.scanChecked.length > 0, `${id} scanChecked`);
    assert.equal(typeof delta.ld9.scanResult, 'string');
    const res = compareCaptures(base, base, [delta]);
    assert.equal(res.ok, true);
    assert.deepEqual(res.differences, []);
    assert.deepEqual(res.missing, []);
  }
  const ic03 = loadExpectedDelta('LA-IC-03');
  assert.equal(ic03.ld9.authorUnitTestChanges.length, 5);
  assert.ok(ic03.ld9.scanChecked.length >= 10);
  assert.ok(
    ic03.ld9.qaTaskTestChanges.some((s) => s.includes('tests/ltiaas/tasks-lti/LA-E3-06/nrps-scopes.k1sim.test.ts')),
  );
  assert.ok(ic03.ld9.scanChecked.some((s) => s.includes('tests/acceptance/T3b/3-negative.spec.ts:32-70')));
  const ic12 = loadExpectedDelta('LA-IC-12');
  assert.equal(ic12.ld9.authorUnitTestChanges.length, 4);
  assert.equal(ic12.changes.length, 2);
  assert.deepEqual(ic12.ld9.goldenFields, [
    'G4.blackboard.pages.picker.text',
    'G4.canvas.pages.picker.text',
  ]);
  const ic13 = loadExpectedDelta('LA-IC-13');
  assert.equal(ic13.ld9.authorUnitTestChanges.length, 6);
  assert.ok(ic13.ld9.scanChecked.length >= 14);
  assert.ok(ic13.ld9.scanChecked.some((s) => s.includes('T2b/qa-platform.test.ts:82-90') && s.includes('azp removed')));
  const ic15 = loadExpectedDelta('LA-IC-15');
  assert.ok(ic15.ld9.design.some((d) => d.includes('BD-A1-27')));
  assert.ok(ic15.ld9.scanChecked.some((s) => s.includes('G3.json:363,1076')));
  assert.ok(ic15.ld9.scanChecked.some((s) => s.includes('G4.json:121-136,312-327')));
  assert.ok(ic15.ld9.scanChecked.some((s) => s.includes('05-publish-results.m2.ts:34-57')));
  const ic17 = loadExpectedDelta('LA-IC-17');
  assert.ok(ic17.ld9.scanChecked.some((s) => s.startsWith('tests/ltiaas/golden/capture.golden.ts:194-200')));
  assert.ok(ic17.ld9.scanChecked.some((s) => s.startsWith('tests/acceptance/lib/qa-platform.ts:43')));
  const ic18 = loadExpectedDelta('LA-IC-18');
  assert.ok(ic18.ld9.scanChecked.includes('tests/e2e/M2/00-blackboard-not-ready.m2.ts:10-35'));
  assert.ok(ic18.ld9.scanChecked.includes('tests/e2e/M2/03-blackboard-wizard.m2.ts:37-110'));
  const ic19 = loadExpectedDelta('LA-IC-19');
  assert.equal(ic19.ld9.authorUnitTestChanges.length, 1);
  assert.ok(ic19.ld9.scanChecked.length >= 10);
  assert.ok(ic19.ld9.scanChecked.some((s) => s.startsWith('tests/acceptance/T5a/6-negative.spec.ts:75-84')));
  const ic20 = loadExpectedDelta('LA-IC-20');
  assert.equal(ic20.ld9.authorUnitTestChanges.length, 7);
  assert.ok(ic20.ld9.scanChecked.length >= 10);
  assert.ok(ic20.ld9.scanChecked.some((s) => s.startsWith('tests/acceptance/lib/portal.ts:176-181')));
  assert.ok(ic20.ld9.scanResult.includes('ChannelErrorNotice'));
  assert.ok(ic20.ld9.scanResult.includes('PLATFORM_IN_USE in moodle'));
  const ic21 = loadExpectedDelta('LA-IC-21');
  assert.equal(ic21.ld9.authorUnitTestChanges.length, 1);
  assert.ok(ic21.ld9.scanChecked.length >= 10);
  assert.ok(ic21.ld9.scanChecked.some((s) => s.startsWith('tests/acceptance/T3b/2-update.spec.ts:61-77')));

  const ic04 = loadExpectedDelta('LA-IC-04');
  assert.equal(ic04.id, 'LA-IC-04');
  assert.equal(ic04.changes.length, 3);
  assert.equal(ic04.ld9.goldenFields.length, 3);
  assert.equal(ic04.ld9.frozenTestsTouched.length, 3);
  assert.equal(ic04.ld9.authorUnitTestChanges.length, 4);
  assert.ok(ic04.ld9.scanChecked.length >= 10);
  assert.ok(ic04.ld9.frozenTestsTouched.some((s) => s.includes('tests/acceptance/M1/canvas/31-canvas-grants.test.ts:114-120,154-163')));
  assert.ok(ic04.ld9.frozenTestsTouched.some((s) => s.includes('tests/acceptance/M1/common/00-profiles.test.ts:115-130')));
  assert.ok(ic04.ld9.frozenTestsTouched.some((s) => s.includes('tests/acceptance/T4b1/1-connect.spec.ts:96-124')));
  assert.ok(!ic04.ld9.qaTaskTestChanges.some((s) => s.includes('describe.skipIf(!process.env.LA_DOCKER_WINDOW)')));
  assert.ok(ic04.ld9.qaTaskTestChanges.some((s) => s.includes('tests/ltiaas/tasks-core/LA-E3-07/nrps-scopes.k1sim.test.ts:1-99')));
  const cand04 = structuredClone(base);
  cand04.G1.canvasConfiguration['jwk=inline'].scopes.pop();
  cand04.G1.canvasConfiguration['jwk=url'].scopes.pop();
  cand04.G1.toolConfiguration.moodle[12].value = 'Do not use this service';
  const res04 = compareCaptures(base, cand04, [ic04]);
  assert.equal(res04.ok, true);
  assert.equal(res04.differences.length, 3);
  assert.deepEqual(res04.missing, []);

  const ic14 = loadExpectedDelta('LA-IC-14');
  assert.equal(ic14.id, 'LA-IC-14');
  assert.equal(ic14.changes.length, 13);
  assert.equal(ic14.ld9.goldenFields.length, 13);
  assert.equal(ic14.ld9.frozenTestsTouched.length, 3);
  assert.equal(ic14.ld9.authorUnitTestChanges.length, 7);
  assert.ok(ic14.ld9.scanChecked.length >= 9);
  assert.ok(ic14.ld9.frozenTestsTouched.every((s) => s.includes('tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:')));
  assert.ok(ic14.ld9.qaTaskTestChanges.some((s) => s.includes('tests/ltiaas/k0/contract.test.ts:596-605')));
  assert.ok(ic14.ld9.qaTaskTestChanges.some((s) => s.includes('tests/ltiaas/tasks-core/LA-E3-15/canvas-dr.k0.test.ts')));
  assert.ok(ic14.ld9.scanChecked.some((s) => s.includes('packages/channels/canvas/portal/CanvasCreate.tsx:13-17')));
  assert.ok(!ic14.ld9.scanChecked.some((s) => s.includes('packages/channels/canvas/portal/canvas.tsx')));
  const cand14 = structuredClone(base);
  cand14.G1.acceptance.lmsProviders.lms[1].capabilities.dynamicRegistration = true;
  cand14.G1.acceptance.lmsProviders.lms[1].methods.push('dynamic');
  cand14.G1.default.lmsProviders.lms[1].capabilities.dynamicRegistration = true;
  cand14.G1.default.lmsProviders.lms[1].methods.push('dynamic');
  cand14.G1.lmsProvidersAfter.lms[1].capabilities.dynamicRegistration = true;
  cand14.G1.lmsProvidersAfter.lms[1].methods.push('dynamic');
  cand14.G1.connectionList.connections[0].capabilities.dynamicRegistration = true;
  cand14.G1.connectionList.connections[1].capabilities.dynamicRegistration = true;
  cand14.G1.connections['canvas-connected'].capabilities.dynamicRegistration = true;
  cand14.G1.connections['canvas-disabled'].capabilities.dynamicRegistration = true;
  cand14.G1.connections['canvas-pending'].capabilities.dynamicRegistration = true;
  cand14.G1.connections['canvas-registered'].capabilities.dynamicRegistration = true;
  cand14.G3.canvas.connection.capabilities.dynamicRegistration = true;
  const res14 = compareCaptures(base, cand14, [ic14]);
  assert.equal(res14.ok, true);
  assert.equal(res14.differences.length, 13);
  assert.deepEqual(res14.missing, []);

  // LA-IC-01: 259 exact-value paths (0 wildcards, 0 type-only rules), current integration HEAD values, and negative controls.
  const ic01 = loadExpectedDelta('LA-IC-01');
  const repoRoot = path.resolve(here, '../../..');
  assert.equal(ic01.id, 'LA-IC-01');
  assert.equal(ic01.changes.length, 259);
  assert.equal(ic01.ld9.goldenFields.length, 259);
  assert.equal(ic01.ld9.frozenTestsTouched.length, 7);
  for (const entry of ic01.ld9.frozenTestsTouched) {
    assert.ok(entry.includes('Pending on integration at 195930c1'), `LA-IC-01 frozenTestsTouched must record pending status: ${entry}`);
    assert.ok(entry.includes('LA-E0-04'), `LA-IC-01 frozenTestsTouched must name LA-E0-04 owner: ${entry}`);
    assert.ok(entry.includes('f0a7b306'), `LA-IC-01 frozenTestsTouched must cite f0a7b306: ${entry}`);
    assert.ok(entry.includes('wave-end gate'), `LA-IC-01 frozenTestsTouched must state wave-end gate landing: ${entry}`);
  }
  assert.ok(!ic01.ld9.scanResult.includes('landed in LA-E0-02 prior to G-BASE'));
  assert.ok(ic01.ld9.scanResult.includes('LA-E0-04 (LD-1) open-world rewrite list'));
  assert.equal(ic01.ld9.authorUnitTestChanges.length, 10);
  assert.equal(ic01.ld9.qaTaskTestChanges.length, 11);
  for (const entry of ic01.ld9.qaTaskTestChanges) {
    const head = entry.split(' (')[0];
    for (const part of head.split(' and ')) {
      const rel = part.trim().split(':')[0];
      assert.ok(fs.existsSync(path.join(repoRoot, rel)), `LA-IC-01 QA test reference must exist on disk: ${rel}`);
    }
  }
  if (fs.existsSync(path.join(repoRoot, 'packages/channel-kernel'))) {
    for (const entry of ic01.ld9.authorUnitTestChanges) {
      const head = entry.split(' (')[0];
      for (const part of head.split(' and ')) {
        const rel = part.trim().split(':')[0];
        assert.ok(fs.existsSync(path.join(repoRoot, rel)), `LA-IC-01 Author test reference must exist on disk: ${rel}`);
      }
    }
  }
  for (const stale of [
    'packages/channels/lti-generic/channel.test.ts',
    'services/cogniate-app/src/app/connect.test.ts',
    'golden-baseline.k1sim.test.ts',
    'LA-E1-06/connections.k0.test.ts',
    'LA-E1-06/connections.k1sim.test.ts',
    'lti-generic-app.k0.test.ts',
    'lti-generic-app.k1sim.test.ts',
  ]) {
    assert.ok(
      ![...ic01.ld9.authorUnitTestChanges, ...ic01.ld9.qaTaskTestChanges].some((s) => s.includes(stale)),
      `LA-IC-01 must not cite stale/non-existent test path: ${stale}`,
    );
  }
  assert.ok(ic01.ld9.scanChecked.length >= 8);
  for (const ch of ic01.changes) {
    assert.ok(!ch.path.includes('*'), `LA-IC-01 must not use wildcard paths: ${ch.path}`);
    assert.ok('value' in ch && !('rule' in ch), `LA-IC-01 must pin exact values, not type-only rules: ${ch.path}`);
  }
  const cand01 = structuredClone(base);
  for (const ch of ic01.changes) setByPath(cand01[ch.file], ch.path, ch.value);
  assert.equal(cand01.G1.acceptance.lmsProviders.lms[4].capabilities.dynamicRegistration, true);
  assert.deepEqual(cand01.G1.acceptance.lmsProviders.lms[4].methods, ['dynamic', 'manual']);
  assert.equal(cand01.G1.acceptance.lmsProviders.lms[1].channelCapabilities['setup.connectionCheck'], true);
  assert.equal(cand01.G1.acceptance.lmsProviders.lms[3].channelCapabilities['setup.connectionCheck'], true);
  assert.equal(cand01.G1.acceptance.lmsProviders.lms[4].channelCapabilities['setup.connectionCheck'], false);
  const res01Without = compareCaptures(base, cand01);
  assert.equal(res01Without.ok, false);
  assert.equal(res01Without.differences.length, 259);
  const res01 = compareCaptures(base, cand01, [ic01]);
  assert.equal(res01.ok, true);
  assert.equal(res01.differences.length, 259);
  assert.deepEqual(res01.missing, []);

  // Combined compare of all 13 reviewed LD-9 expected deltas (LA-IC-01, LA-IC-03, LA-IC-04, LA-IC-12, LA-IC-13, LA-IC-14, LA-IC-15, LA-IC-16, LA-IC-17, LA-IC-18, LA-IC-19, LA-IC-20, LA-IC-21).
  const allDeltas = ['LA-IC-01', 'LA-IC-03', 'LA-IC-04', 'LA-IC-12', 'LA-IC-13', 'LA-IC-14', 'LA-IC-15', 'LA-IC-16', 'LA-IC-17', 'LA-IC-18', 'LA-IC-19', 'LA-IC-20', 'LA-IC-21'].map((id) => loadExpectedDelta(id));
  const candAll = structuredClone(cand01);
  const baseNonSim = base.G1.acceptance.ltiHealth.outbound_allowlist.filter((h) => !h.endsWith('.sim.test'));
  candAll.G1.acceptance.ltiHealth.outbound_allowlist = [...baseNonSim, ...loadSimAllowlist()];
  candAll.G1.canvasConfiguration['jwk=inline'].scopes.pop();
  candAll.G1.canvasConfiguration['jwk=url'].scopes.pop();
  candAll.G1.toolConfiguration.moodle[12].value = 'Do not use this service';
  candAll.G1.acceptance.lmsProviders.lms[1].capabilities.dynamicRegistration = true;
  candAll.G1.acceptance.lmsProviders.lms[1].methods.push('dynamic');
  candAll.G1.default.lmsProviders.lms[1].capabilities.dynamicRegistration = true;
  candAll.G1.default.lmsProviders.lms[1].methods.push('dynamic');
  candAll.G1.lmsProvidersAfter.lms[1].capabilities.dynamicRegistration = true;
  candAll.G1.lmsProvidersAfter.lms[1].methods.push('dynamic');
  candAll.G1.connectionList.connections[0].capabilities.dynamicRegistration = true;
  candAll.G1.connectionList.connections[1].capabilities.dynamicRegistration = true;
  candAll.G1.connections['canvas-connected'].capabilities.dynamicRegistration = true;
  candAll.G1.connections['canvas-disabled'].capabilities.dynamicRegistration = true;
  candAll.G1.connections['canvas-pending'].capabilities.dynamicRegistration = true;
  candAll.G1.connections['canvas-registered'].capabilities.dynamicRegistration = true;
  candAll.G3.canvas.connection.capabilities.dynamicRegistration = true;
  candAll.G3.blackboard.publications['B-conflict'].results[0].scoreSyncs[0].lastError =
    '409 PLATFORM_CONFLICT: The platform answered 409: it has a newer value (for example a grade with a newer time). (Blackboard has a grade with a newer time)';
  candAll.G3.canvas.publications['B-conflict'].results[0].scoreSyncs[0].lastError =
    '409 PLATFORM_CONFLICT: The platform answered 409: it has a newer value (for example a grade with a newer time). (Canvas has a grade with a newer time)';
  for (const ch of ic12.changes) {
    if (ch.file === 'G4' && ch.path === 'blackboard.pages.picker.text') {
      candAll.G4.blackboard.pages.picker.text = ch.value;
    } else if (ch.file === 'G4' && ch.path === 'canvas.pages.picker.text') {
      candAll.G4.canvas.pages.picker.text = ch.value;
    }
  }
  const resAll = compareCaptures(base, candAll, allDeltas);
  assert.equal(resAll.ok, true);
  assert.equal(resAll.differences.length, 259 + 19 + ic12.changes.length);
  assert.deepEqual(resAll.missing, []);

  // Negative controls for LA-IC-01 (A-LA-LD9-11, A-LA-LD9-12, B-LD9-10): any wrong or missing channel value fails compareCaptures.
  for (const [label, mutate] of [
    ['wrong channel', (c) => { c.G1.acceptance.lmsProviders.lms[0].channel = 'wrong-channel'; }],
    ['empty channelCapabilities', (c) => { c.G1.acceptance.lmsProviders.lms[0].channelCapabilities = {}; }],
    ['wrong bindingAuthority', (c) => { c.G1.connections['canvas-connected'].bindingAuthority = 'self'; }],
    ['wrong endpointOrigins', (c) => { c.G1.default.providers.profiles[0].endpointOrigins = 42; }],
    ['empty registration', (c) => { c.G1.acceptance.lmsProviders.lms[0].registration = []; }],
    ['missing channel on one baseline lms', (c) => { delete c.G1.acceptance.lmsProviders.lms[0].channel; }],
    ['missing channel on one connection', (c) => { delete c.G1.connections['moodle-manual-pending'].channel; }],
    ['wrong setup.connectionCheck on canvas', (c) => { c.G1.acceptance.lmsProviders.lms[1].channelCapabilities['setup.connectionCheck'] = false; }],
    ['wrong setup.connectionCheck on lti-generic', (c) => { c.G1.acceptance.lmsProviders.lms[3].channelCapabilities['setup.connectionCheck'] = false; }],
    ['brightspace dynamicRegistration false', (c) => { c.G1.acceptance.lmsProviders.lms[4].capabilities.dynamicRegistration = false; }],
  ]) {
    const mutated = structuredClone(candAll);
    mutate(mutated);
    const badRes = compareCaptures(base, mutated, allDeltas);
    assert.equal(badRes.ok, false, `LA-IC-01 negative control must fail: ${label}`);
    assert.ok(badRes.missing.length > 0 || badRes.differences.some((d) => !d.explainedBy), `LA-IC-01 negative control must report diff or missing: ${label}`);
  }
});
