import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DR_OPTIONS, LEGACY_SCENARIO_ALIASES, SCENARIO_OPTIONS, createRuntime } from './runtime.mjs';
import { loadHostManifest, loadProviders } from '../server.mjs';

const SOURCE_DIR = fileURLToPath(new URL('..', import.meta.url));
const REPO_ROOT = path.resolve(SOURCE_DIR, '../..');

function makeRuntime() {
  return createRuntime({
    publicLtiUrl: 'https://tool.test',
    fetchJwks: async () => {
      throw new Error('Module discovery cannot fetch keys');
    },
  });
}

function resolveInfraScripts() {
  const localLib = path.join(REPO_ROOT, 'infra/scripts/lib.sh');
  const localOplock = path.join(REPO_ROOT, 'infra/scripts/storage-oplock.sh');
  if (fs.existsSync(localLib) && fs.readFileSync(localLib, 'utf8').includes('load_sim_hosts')) {
    return {
      libSh: fs.readFileSync(localLib, 'utf8'),
      oplockSh: fs.existsSync(localOplock) ? fs.readFileSync(localOplock, 'utf8') : '',
    };
  }
  for (const ref of ['quang/ltiaas-milestone', 'b3af690']) {
    const libRes = spawnSync('git', ['show', `${ref}:infra/scripts/lib.sh`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    if (libRes.status === 0 && libRes.stdout.includes('load_sim_hosts')) {
      const oplockRes = spawnSync('git', ['show', `${ref}:infra/scripts/storage-oplock.sh`], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });
      return {
        libSh: libRes.stdout,
        oplockSh: oplockRes.status === 0 ? oplockRes.stdout : '',
      };
    }
  }
  return null;
}

test('HARNESS ONLY: missing Canvas is a startup error, never an implicit Blackboard-only pass', async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-module-gate-'));
  try {
    fs.cpSync(SOURCE_DIR, scratch, {
      recursive: true,
      filter: (file) => !path.relative(SOURCE_DIR, file).split(path.sep).includes('canvas'),
    });
    const { createRuntime: scratchRuntime } = await import(pathToFileURL(path.join(scratch, 'core/runtime.mjs')));
    const { loadProviders: scratchLoadProviders } = await import(pathToFileURL(path.join(scratch, 'server.mjs')));
    const rt = () => scratchRuntime({
      publicLtiUrl: 'https://tool.test',
      fetchJwks: async () => {
        throw new Error('Module discovery cannot fetch keys');
      },
    });
    assert.equal((await scratchLoadProviders(rt(), ['blackboard'])).length, 1);
    await assert.rejects(
      scratchLoadProviders(rt()),
      /Manifest entry canvas-sim-cloud has no loaded provider; a module under tests\/sim\/<folder>\/ must export a provider with id canvas-sim-cloud/,
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('HARNESS ONLY: loadHostManifest and infra/scripts/lib.sh agree on shared hosts.json table cases', async (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sim-hosts-table-'));
  const infraScripts = resolveInfraScripts();
  assert.ok(infraScripts, 'infra/scripts/lib.sh with load_sim_hosts is available for the shared table test');
  try {
    fs.mkdirSync(path.join(scratch, 'infra/scripts'), { recursive: true });
    fs.mkdirSync(path.join(scratch, 'tests/sim'), { recursive: true });
    fs.mkdirSync(path.join(scratch, 'fake-bin'), { recursive: true });
    fs.writeFileSync(path.join(scratch, 'infra/scripts/lib.sh'), infraScripts.libSh);
    fs.writeFileSync(path.join(scratch, 'infra/scripts/storage-oplock.sh'), infraScripts.oplockSh);
    fs.writeFileSync(path.join(scratch, 'fake-bin/docker'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });

    const manifestPath = path.join(scratch, 'tests/sim/hosts.json');
    const baseManifest = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, 'hosts.json'), 'utf8'));
    const oneProvider = { id: 'one-sim', aliases: ['one.sim.test'], allowlist: ['one.sim.test'] };
    const entry = (patch) => ({ version: 1, providers: [{ ...oneProvider, ...patch }] });

    const runInfra = () => {
      const res = spawnSync(
        'bash',
        ['-c', 'source infra/scripts/lib.sh && require_sim_hosts acceptance'],
        {
          cwd: scratch,
          encoding: 'utf8',
          env: {
            PATH: `${path.join(scratch, 'fake-bin')}:${process.env.PATH}`,
            COMPOSE_PROJECT_NAME: 'sim-hosts-shared-table',
            LC_ALL: 'C',
          },
        },
      );
      return res.status === 0;
    };

    const runSim = () => {
      try {
        loadHostManifest(manifestPath);
        return true;
      } catch {
        return false;
      }
    };

    const cases = [
      // Good cases (accepted by both simulator and infra)
      ['accepts committed tests/sim/hosts.json', baseManifest, true],
      ['accepts browser-only alias with empty allowlist', {
        version: 1,
        providers: [{ id: 'browser-sim', aliases: ['page.browser.sim.test'], allowlist: [] }],
      }, true],
      ['accepts empty providers array', { version: 1, providers: [] }, true],

      // Bad cases (refused by both simulator and infra)
      ['refuses repeated alias and allowlist host inside one entry', {
        version: 1,
        providers: [{
          id: 'dup-in-entry-sim',
          aliases: ['a.dup.sim.test', 'a.dup.sim.test', 'b.dup.sim.test'],
          allowlist: ['a.dup.sim.test', 'a.dup.sim.test'],
        }],
      }, false],
      ['refuses invalid JSON', '{', false],
      ['refuses non-object top-level JSON', '[]', false],
      ['refuses unknown version', { version: 2, providers: [] }, false],
      ['refuses missing providers array', { version: 1 }, false],
      ['refuses unknown top-level key', { ...entry({}), extra: true }, false],
      ['refuses null provider entry', { version: 1, providers: [null] }, false],
      ['refuses unknown provider entry key', entry({ allowList: ['one.sim.test'] }), false],
      ['refuses empty provider id', entry({ id: '' }), false],
      ['refuses whitespace-only provider id', entry({ id: '   ' }), false],
      ['refuses duplicate provider id', { version: 1, providers: [oneProvider, oneProvider] }, false],
      ['refuses empty aliases array', entry({ aliases: [] }), false],
      ['refuses missing allowlist array', entry({ allowlist: undefined }), false],
      ['refuses non-string host', entry({ aliases: [3] }), false],
      ['refuses reserved control host lms-sim.test', entry({ aliases: ['lms-sim.test'], allowlist: [] }), false],
      ['refuses non-simulator .test host', entry({ aliases: ['moodle.test'], allowlist: [] }), false],
      ['refuses non-.test host', entry({ aliases: ['school.example.com'], allowlist: [] }), false],
      ['refuses DNS label starting with hyphen', entry({ aliases: ['-bad.blackboard.sim.test'], allowlist: [] }), false],
      ['refuses DNS label ending with hyphen', entry({ aliases: ['bad-.blackboard.sim.test'], allowlist: [] }), false],
      ['refuses DNS label with underscore', entry({ aliases: ['bad_.blackboard.sim.test'], allowlist: [] }), false],
      ['refuses DNS label with uppercase characters', entry({ aliases: ['Bad.blackboard.sim.test'], allowlist: [] }), false],
      ['refuses DNS label longer than 63 characters', entry({ aliases: [`${'a'.repeat(64)}.sim.test`], allowlist: [] }), false],
      ['refuses hostname longer than 253 characters', entry({
        aliases: [`${('a'.repeat(50) + '.').repeat(5)}sim.test`],
        allowlist: [],
      }), false],
      ['refuses allowlist host not in aliases', entry({ allowlist: ['other.sim.test'] }), false],
    ];

    for (const [name, content, expectedOk] of cases) {
      await t.test(name, () => {
        fs.writeFileSync(manifestPath, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
        const simOk = runSim();
        const infraOk = runInfra();
        assert.equal(simOk, expectedOk, `simulator loadHostManifest result for "${name}"`);
        assert.equal(infraOk, expectedOk, `infra/scripts/lib.sh result for "${name}"`);
        assert.equal(simOk, infraOk, `simulator and infra agree on "${name}"`);
      });
    }

    // Verify loadHostManifest refuses repeated alias or repeated allowlist host inside one entry with a clear error naming the host (BD-A1-53)
    fs.writeFileSync(manifestPath, JSON.stringify({
      version: 1,
      providers: [{
        id: 'dup-alias-sim',
        aliases: ['a.dup.sim.test', 'a.dup.sim.test', 'b.dup.sim.test'],
        allowlist: ['a.dup.sim.test'],
      }],
    }));
    assert.throws(
      () => loadHostManifest(manifestPath),
      /Duplicate simulator alias host a\.dup\.sim\.test in dup-alias-sim/,
    );
    fs.writeFileSync(manifestPath, JSON.stringify({
      version: 1,
      providers: [{
        id: 'dup-allow-sim',
        aliases: ['a.dup.sim.test', 'b.dup.sim.test'],
        allowlist: ['a.dup.sim.test', 'a.dup.sim.test'],
      }],
    }));
    assert.throws(
      () => loadHostManifest(manifestPath),
      /Duplicate simulator allowlist host a\.dup\.sim\.test in dup-allow-sim/,
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('HARNESS ONLY: loadHostManifest refuses a duplicate host across two providers (BD-A1-01 change 3)', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sim-cross-dup-'));
  try {
    const manifestPath = path.join(scratch, 'hosts.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
      version: 1,
      providers: [
        { id: 'one-sim', aliases: ['dup.one.sim.test'], allowlist: [] },
        { id: 'two-sim', aliases: ['dup.one.sim.test'], allowlist: [] },
      ],
    }));
    assert.throws(
      () => loadHostManifest(manifestPath),
      /Duplicate simulator host dup\.one\.sim\.test across providers one-sim and two-sim/,
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('HARNESS ONLY: loadProviders reports missing in hosts.json and missing in the module on alias mismatch', async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sim-mismatch-'));
  try {
    const baseManifest = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, 'hosts.json'), 'utf8'));
    const mismatchManifest = structuredClone(baseManifest);
    const bbEntry = mismatchManifest.providers.find((p) => p.id === 'blackboard-sim');
    bbEntry.aliases = bbEntry.aliases.filter((h) => h !== 'learn-b.blackboard.sim.test');
    bbEntry.allowlist = bbEntry.allowlist.filter((h) => h !== 'learn-b.blackboard.sim.test');
    bbEntry.aliases.push('extra.blackboard.sim.test');
    const manifestPath = path.join(scratch, 'hosts.json');
    fs.writeFileSync(manifestPath, JSON.stringify(mismatchManifest, null, 2));

    await assert.rejects(
      loadProviders(makeRuntime(), ['blackboard'], { simDir: SOURCE_DIR, manifestPath }),
      /Simulator provider blackboard-sim hosts mismatch with hosts\.json aliases \(missing in hosts\.json: \[learn-b\.blackboard\.sim\.test\]; missing in the module: \[extra\.blackboard\.sim\.test\]\)/,
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('HARNESS ONLY: loadProviders refuses an unlisted provider and a manifest entry without a loaded provider', async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sim-unlisted-'));
  try {
    const baseManifest = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, 'hosts.json'), 'utf8'));
    const manifestPath = path.join(scratch, 'hosts.json');

    // Loaded provider missing from hosts.json
    fs.writeFileSync(manifestPath, JSON.stringify({
      version: 1,
      providers: baseManifest.providers.filter((p) => p.id !== 'blackboard-sim'),
    }));
    await assert.rejects(
      loadProviders(makeRuntime(), ['blackboard'], { simDir: SOURCE_DIR, manifestPath }),
      /Unlisted simulator provider blackboard-sim: missing from hosts\.json/,
    );

    // Manifest entry with no loaded provider (no guessed module name)
    fs.writeFileSync(manifestPath, JSON.stringify({
      version: 1,
      providers: [
        ...baseManifest.providers,
        { id: 'custom-unloaded-provider', aliases: ['custom.unloaded.sim.test'], allowlist: [] },
      ],
    }));
    await assert.rejects(
      loadProviders(makeRuntime(), undefined, { simDir: SOURCE_DIR, manifestPath }),
      /Manifest entry custom-unloaded-provider has no loaded provider; a module under tests\/sim\/<folder>\/ must export a provider with id custom-unloaded-provider/,
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('HARNESS ONLY: adding a new LMS takes one module folder and one hosts.json entry with zero edits to server.mjs', async () => {
  const fullCopy = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sim-ext-'));
  try {
    fs.cpSync(SOURCE_DIR, fullCopy, { recursive: true });
    const sakaiDir = path.join(fullCopy, 'sakai');
    fs.mkdirSync(sakaiDir);
    fs.writeFileSync(path.join(sakaiDir, 'index.mjs'), `
import { createProvider } from '../core/provider.mjs';
export const sakai = {
  id: 'sakai-sim',
  issuer: 'https://sakai.sim.test',
  family: 'sakai',
  auth: { host: 'sakai.sim.test', path: '/imsblis/lti13/oidc_auth', methods: ['GET', 'POST'] },
  jwks: { host: 'sakai.sim.test', path: '/imsblis/lti13/keyset' },
  token: { hosts: ['sakai.sim.test'], path: '/imsblis/lti13/token', audience: 'string' },
  sites: [{ host: 'sakai.sim.test', lineitems: '/imsblis/lti13/lineitems', nrps: '/imsblis/lti13/nrps', dlReturn: '/imsblis/lti13/dl' }],
  pageHosts: [],
  dlData: 'claim',
  dlSubject: false,
  documentTarget: 'window',
};
export function createProviders(runtime) { return [createProvider(runtime, sakai)]; }
`);
    await assert.rejects(
      loadProviders(makeRuntime(), undefined, { simDir: fullCopy }),
      /Unlisted simulator provider sakai-sim/,
    );

    const baseManifest = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, 'hosts.json'), 'utf8'));
    baseManifest.providers.push({
      id: 'sakai-sim',
      aliases: ['sakai.sim.test'],
      allowlist: ['sakai.sim.test'],
    });
    fs.writeFileSync(path.join(fullCopy, 'hosts.json'), JSON.stringify(baseManifest, null, 2));
    const extProviders = await loadProviders(makeRuntime(), undefined, { simDir: fullCopy });
    assert.equal(extProviders.length, baseManifest.providers.length);
    assert.equal(extProviders.some((p) => p.id === 'sakai-sim'), true);
  } finally {
    fs.rmSync(fullCopy, { recursive: true, force: true });
  }
});

const KNOWN_PROVIDERS = Object.freeze([
  {
    id: 'blackboard-sim',
    aliases: [
      'developer.blackboard.sim.test',
      'learn-a.blackboard.sim.test',
      'learn-b.blackboard.sim.test',
    ],
    allowlist: [
      'developer.blackboard.sim.test',
      'learn-a.blackboard.sim.test',
      'learn-b.blackboard.sim.test',
    ],
  },
  {
    id: 'canvas-sim-cloud',
    aliases: [
      'sso.canvas.sim.test',
      'school-a.canvas.sim.test',
      'school-b.canvas.sim.test',
      'canvas.school-a.sim.test',
    ],
    allowlist: [
      'sso.canvas.sim.test',
      'school-a.canvas.sim.test',
      'school-b.canvas.sim.test',
    ],
  },
  {
    id: 'canvas-sim-self',
    aliases: [
      'canvas-self.sim.test',
      'api.canvas-self.sim.test',
    ],
    allowlist: [
      'canvas-self.sim.test',
      'api.canvas-self.sim.test',
    ],
  },
  {
    id: 'generic-sim',
    aliases: [
      'generic.sim.test',
      'token.generic.sim.test',
      'school-b.generic.sim.test',
    ],
    allowlist: [
      'generic.sim.test',
      'token.generic.sim.test',
      'school-b.generic.sim.test',
    ],
  },
  {
    id: 'moodle-sim',
    aliases: [
      'moodle.sim.test',
    ],
    allowlist: [
      'moodle.sim.test',
    ],
  },
  {
    id: 'brightspace-sim',
    aliases: [
      'brightspace.sim.test',
      'auth.brightspace.sim.test',
      'school-b.brightspace.sim.test',
    ],
    allowlist: [
      'brightspace.sim.test',
      'auth.brightspace.sim.test',
      'school-b.brightspace.sim.test',
    ],
  },
]);

async function verifyOpenWorldSimManifest(simDir) {
  const manifestPath = path.join(simDir, 'hosts.json');
  const manifest = loadHostManifest(manifestPath);
  const allProviders = await loadProviders(makeRuntime(), undefined, { simDir, manifestPath });

  const folderNames = fs
    .readdirSync(simDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'core' && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
  const folderProviders = [];
  for (const folder of folderNames) {
    const modPath = path.join(simDir, folder, 'index.mjs');
    assert.equal(fs.existsSync(modPath), true, `provider folder ${folder} has index.mjs`);
    const mod = await import(pathToFileURL(modPath).href);
    assert.equal(typeof mod.createProviders, 'function', `provider folder ${folder} exports createProviders`);
    folderProviders.push(...mod.createProviders(makeRuntime()));
  }

  // Derive expected provider set from hosts.json and provider folders on disk.
  const expectedProviderIds = manifest.providers.map((p) => p.id).sort();
  assert.deepEqual(allProviders.map((p) => p.id).sort(), expectedProviderIds);
  assert.deepEqual(folderProviders.map((p) => p.id).sort(), expectedProviderIds);
  assert.equal(allProviders.length, manifest.providers.length);
  assert.equal(allProviders.length, folderProviders.length);

  // Each provider id, alias, and allowlist host is unique across the manifest and loaded providers.
  const allProviderIds = manifest.providers.map((p) => p.id);
  const allAliases = manifest.providers.flatMap((p) => p.aliases);
  const allAllowlist = manifest.providers.flatMap((p) => p.allowlist);
  const allLoadedHosts = allProviders.flatMap((p) => p.hosts);
  assert.equal(new Set(allProviderIds).size, allProviderIds.length);
  assert.equal(new Set(allAliases).size, allAliases.length);
  assert.equal(new Set(allAllowlist).size, allAllowlist.length);
  assert.equal(new Set(allLoadedHosts).size, allLoadedHosts.length);
  assert.deepEqual([...allLoadedHosts].sort(), [...allAliases].sort());

  for (const entry of manifest.providers) {
    const loaded = allProviders.find((p) => p.id === entry.id);
    assert.ok(loaded, `manifest entry ${entry.id} loaded`);
    assert.deepEqual([...loaded.hosts].sort(), [...entry.aliases].sort());
    for (const host of entry.allowlist) {
      assert.equal(entry.aliases.includes(host), true, `allowlist host ${host} is in aliases of ${entry.id}`);
    }
  }

  // The 6 known providers are still present with their exact values.
  assert.ok(manifest.providers.length >= KNOWN_PROVIDERS.length);
  for (const known of KNOWN_PROVIDERS) {
    const entry = manifest.providers.find((p) => p.id === known.id);
    assert.ok(entry, `known provider ${known.id} is present in hosts.json`);
    assert.deepEqual(entry.aliases, known.aliases);
    assert.deepEqual(entry.allowlist, known.allowlist);
    const loaded = allProviders.find((p) => p.id === known.id);
    assert.ok(loaded, `known provider ${known.id} is loaded`);
    assert.deepEqual([...loaded.hosts].sort(), [...known.aliases].sort());
  }

  const knownIds = new Set(KNOWN_PROVIDERS.map((p) => p.id));
  const extraProviders = manifest.providers.filter((p) => !knownIds.has(p.id));
  const extraAliases = extraProviders.flatMap((p) => p.aliases);
  const extraAllowlist = extraProviders.flatMap((p) => p.allowlist);

  assert.equal(manifest.providers.length, 6 + extraProviders.length);
  assert.equal(allAliases.length, 16 + extraAliases.length);
  assert.equal(allAllowlist.length, 15 + extraAllowlist.length);
  assert.equal(allAliases.includes('canvas.school-a.sim.test'), true);
  assert.equal(allAllowlist.includes('canvas.school-a.sim.test'), false);

  return { manifest, allProviders, allAliases, allAllowlist, extraProviders };
}

test('HARNESS ONLY: committed tests/sim/hosts.json matches all 6 providers and re-posting a scenario id moves it to the newest position', async () => {
  await verifyOpenWorldSimManifest(SOURCE_DIR);

  const orderRt = makeRuntime();
  await loadProviders(orderRt, ['blackboard'], { simDir: SOURCE_DIR });
  orderRt.scenario({
    id: 'sc-order-a',
    provider: 'blackboard-sim',
    clientId: 'client-order-1',
    deploymentId: 'dA',
    siteHost: 'learn-a.blackboard.sim.test',
    tokenAudience: 'https://aud-first.sim.test',
  });
  orderRt.scenario({
    id: 'sc-order-b',
    provider: 'blackboard-sim',
    clientId: 'client-order-1',
    deploymentId: 'dA',
    siteHost: 'learn-a.blackboard.sim.test',
    tokenAudience: 'https://aud-second.sim.test',
  });
  orderRt.scenario({
    id: 'sc-order-a',
    provider: 'blackboard-sim',
    clientId: 'client-order-1',
    deploymentId: 'dA',
    siteHost: 'learn-a.blackboard.sim.test',
    tokenAudience: 'https://aud-reposted.sim.test',
  });
  const newestForClient = [...orderRt.scenarios.values()].reverse().find((s) => s.clientId === 'client-order-1');
  assert.equal(newestForClient.id, 'sc-order-a');
  assert.equal(newestForClient.tokenAudience, 'https://aud-reposted.sim.test');
});

test('HARNESS ONLY: open-world canary — a seventh provider in a scratch copy joins with no change to shared lists', async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sim-open-world-canary-'));
  try {
    fs.cpSync(SOURCE_DIR, scratch, { recursive: true });
    const baseManifest = loadHostManifest(path.join(SOURCE_DIR, 'hosts.json'));
    const baseAliases = baseManifest.providers.flatMap((p) => p.aliases);
    const baseAllowlist = baseManifest.providers.flatMap((p) => p.allowlist);

    // Dot-directory positive control (B-LA-E7-02-06): ignored by both loadProviders and verifyOpenWorldSimManifest
    fs.mkdirSync(path.join(scratch, '.review-b-cache'));
    // Visible folder without index.mjs still fails closed
    const badVisibleDir = path.join(scratch, 'visible-no-index');
    fs.mkdirSync(badVisibleDir);
    await assert.rejects(
      () => verifyOpenWorldSimManifest(scratch),
      /Unknown simulator module: visible-no-index|provider folder visible-no-index has index\.mjs/,
    );
    fs.rmSync(badVisibleDir, { recursive: true, force: true });

    const canaryDir = path.join(scratch, 'canary-lms');
    fs.mkdirSync(canaryDir);
    fs.writeFileSync(path.join(canaryDir, 'index.mjs'), `
import { createProvider } from '../core/provider.mjs';
export const canaryLms = {
  id: 'canary-lms-sim',
  issuer: 'https://canary-lms.sim.test',
  family: 'canary-lms',
  auth: { host: 'canary-lms.sim.test', path: '/lti/oidc/auth', methods: ['GET', 'POST'] },
  jwks: { host: 'canary-lms.sim.test', path: '/lti/.well-known/jwks.json' },
  token: { hosts: ['auth.canary-lms.sim.test'], path: '/lti/oauth2/token', audience: 'string' },
  sites: [{
    host: 'canary-lms.sim.test',
    lineitems: '/lti/courses/1/lineitems',
    nrps: '/lti/courses/1/memberships',
    dlReturn: '/lti/dl/return',
  }],
  pageHosts: ['page.canary-lms.sim.test'],
  dlData: 'claim',
  dlSubject: true,
  documentTarget: 'iframe',
};
export function createProviders(runtime) {
  return [createProvider(runtime, canaryLms)];
}
`);

    const scratchManifest = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, 'hosts.json'), 'utf8'));
    scratchManifest.providers.push({
      id: 'canary-lms-sim',
      aliases: ['canary-lms.sim.test', 'auth.canary-lms.sim.test', 'page.canary-lms.sim.test'],
      allowlist: ['canary-lms.sim.test', 'auth.canary-lms.sim.test'],
    });
    fs.writeFileSync(path.join(scratch, 'hosts.json'), JSON.stringify(scratchManifest, null, 2));

    const verified = await verifyOpenWorldSimManifest(scratch);
    assert.equal(verified.allProviders.length, baseManifest.providers.length + 1);
    assert.equal(verified.allAliases.length, baseAliases.length + 3);
    assert.equal(verified.allAllowlist.length, baseAllowlist.length + 2);
    assert.equal(verified.extraProviders.some((p) => p.id === 'canary-lms-sim'), true);

    const canaryProvider = verified.allProviders.find((p) => p.id === 'canary-lms-sim');
    assert.ok(canaryProvider);
    const jwksRes = await canaryProvider.handle({
      method: 'GET',
      host: 'canary-lms.sim.test',
      path: '/lti/.well-known/jwks.json',
      url: new URL('https://canary-lms.sim.test/lti/.well-known/jwks.json'),
      headers: {},
      body: '',
    });
    assert.equal(jwksRes?.status, 200);
    assert.equal(Array.isArray(JSON.parse(jwksRes.body).keys), true);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('HARNESS ONLY: tests/sim/README.md scenario option tables match SCENARIO_OPTIONS, DR_OPTIONS, and LEGACY_SCENARIO_ALIASES in runtime.mjs', () => {
  const readme = fs.readFileSync(path.join(SOURCE_DIR, 'README.md'), 'utf8');
  function extractTableColumn(startTag, endTag) {
    const startIdx = readme.indexOf(startTag);
    const endIdx = readme.indexOf(endTag);
    assert.ok(startIdx >= 0 && endIdx > startIdx, `README markers ${startTag}..${endTag} present`);
    const block = readme.slice(startIdx + startTag.length, endIdx);
    return [...block.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1]);
  }
  const readmeScenarioOpts = extractTableColumn('<!-- SCENARIO_OPTIONS_START -->', '<!-- SCENARIO_OPTIONS_END -->');
  const readmeDrOpts = extractTableColumn('<!-- DR_OPTIONS_START -->', '<!-- DR_OPTIONS_END -->').map((k) => k.replace(/^dr\./, ''));
  const readmeLegacyAliases = extractTableColumn('<!-- LEGACY_ALIASES_START -->', '<!-- LEGACY_ALIASES_END -->');

  assert.deepEqual(readmeScenarioOpts, [...SCENARIO_OPTIONS]);
  assert.deepEqual(readmeDrOpts, [...DR_OPTIONS]);
  assert.deepEqual(readmeLegacyAliases, Object.keys(LEGACY_SCENARIO_ALIASES));
});
