import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('HARNESS ONLY: missing Canvas is a startup error, never an implicit Blackboard-only pass', async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-module-gate-'));
  const source = fileURLToPath(new URL('..', import.meta.url));
  try {
    fs.cpSync(source, scratch, { recursive: true,
      filter: (file) => !path.relative(source, file).split(path.sep).includes('canvas') });
    const { createRuntime } = await import(pathToFileURL(path.join(scratch, 'core/runtime.mjs')));
    const { loadHostManifest, loadProviders } = await import(pathToFileURL(path.join(scratch, 'server.mjs')));
    const runtime = () => createRuntime({ publicLtiUrl: 'https://tool.test',
      fetchJwks: async () => { throw new Error('Module discovery cannot fetch keys'); } });
    assert.equal((await loadProviders(runtime(), ['blackboard'])).length, 1);
    await assert.rejects(loadProviders(runtime()), /Required canvas simulator is unavailable/);

    // Full load against the complete source tree loads all 6 manifest providers.
    const allProviders = await loadProviders(runtime(), undefined, { simDir: source });
    assert.deepEqual(
      allProviders.map((p) => p.id).sort(),
      ['blackboard-sim', 'brightspace-sim', 'canvas-sim-cloud', 'canvas-sim-self', 'generic-sim', 'moodle-sim'],
    );

    // Fail-closed manifest checks (README §4b / BD-A1-01 v1.1):
    const badManifestPath = path.join(scratch, 'bad-hosts.json');
    const writeBad = (data) => {
      fs.writeFileSync(badManifestPath, JSON.stringify(data, null, 2));
      return badManifestPath;
    };
    // Committed tests/sim/hosts.json check (A-LA-E7-02-02):
    const baseManifest = JSON.parse(fs.readFileSync(path.join(source, 'hosts.json'), 'utf8'));
    const committedManifest = loadHostManifest(path.join(source, 'hosts.json'));
    const allAliases = committedManifest.providers.flatMap((p) => p.aliases);
    const allAllowlist = committedManifest.providers.flatMap((p) => p.allowlist);
    assert.equal(committedManifest.providers.length, 6);
    assert.equal(allAliases.length, 16);
    assert.equal(allAllowlist.length, 15);
    assert.equal(allAliases.includes('canvas.school-a.sim.test'), true);
    assert.equal(allAllowlist.includes('canvas.school-a.sim.test'), false);

    // Re-posting an existing scenario id moves it to the newest position (A-LA-E7-02-03):
    const orderRt = runtime();
    await loadProviders(orderRt, ['blackboard'], { simDir: source });
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

    // Unknown version
    assert.throws(() => loadHostManifest(writeBad({ ...baseManifest, version: 2 })), /Unsupported simulator host manifest version/);
    // Unknown top-level key
    assert.throws(() => loadHostManifest(writeBad({ ...baseManifest, extra: true })), /unknown top-level keys/);
    // Reserved control alias lms-sim.test in manifest
    assert.throws(() => loadHostManifest(writeBad({
      version: 1,
      providers: [{ id: 'bad-sim', aliases: ['lms-sim.test'], allowlist: [] }],
    })), /Invalid simulator alias host/);
    // Host not ending in .sim.test
    assert.throws(() => loadHostManifest(writeBad({
      version: 1,
      providers: [{ id: 'bad-sim', aliases: ['school.example.test'], allowlist: [] }],
    })), /Invalid simulator alias host/);
    // allowlist not a subset of aliases
    assert.throws(() => loadHostManifest(writeBad({
      version: 1,
      providers: [{ id: 'bad-sim', aliases: ['a.bad.sim.test'], allowlist: ['b.bad.sim.test'] }],
    })), /is not in aliases/);
    // Duplicate host across two providers in manifest
    assert.throws(() => loadHostManifest(writeBad({
      version: 1,
      providers: [
        { id: 'one-sim', aliases: ['dup.one.sim.test'], allowlist: [] },
        { id: 'two-sim', aliases: ['dup.one.sim.test'], allowlist: [] },
      ],
    })), /Duplicate simulator host/);

    // Provider hosts mismatch with manifest entry aliases
    const mismatchManifest = structuredClone(baseManifest);
    mismatchManifest.providers.find((p) => p.id === 'blackboard-sim').aliases.push('extra.blackboard.sim.test');
    await assert.rejects(
      loadProviders(runtime(), ['blackboard'], { simDir: source, manifestPath: writeBad(mismatchManifest) }),
      /hosts mismatch with hosts\.json aliases/,
    );

    // Loaded provider missing from hosts.json
    const missingEntryManifest = {
      version: 1,
      providers: baseManifest.providers.filter((p) => p.id !== 'blackboard-sim'),
    };
    await assert.rejects(
      loadProviders(runtime(), ['blackboard'], { simDir: source, manifestPath: writeBad(missingEntryManifest) }),
      /Unlisted simulator provider blackboard-sim/,
    );

    // Add a new LMS = one module + one manifest entry (zero edits to server.mjs)
    const fullCopy = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sim-ext-'));
    try {
      fs.cpSync(source, fullCopy, { recursive: true });
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
      // Without manifest entry -> fails closed
      await assert.rejects(
        loadProviders(runtime(), undefined, { simDir: fullCopy }),
        /Unlisted simulator provider sakai-sim/,
      );
      // With manifest entry -> loads all 7 providers cleanly
      const extManifest = structuredClone(baseManifest);
      extManifest.providers.push({
        id: 'sakai-sim',
        aliases: ['sakai.sim.test'],
        allowlist: ['sakai.sim.test'],
      });
      fs.writeFileSync(path.join(fullCopy, 'hosts.json'), JSON.stringify(extManifest, null, 2));
      const extProviders = await loadProviders(runtime(), undefined, { simDir: fullCopy });
      assert.equal(extProviders.length, 7);
      assert.equal(extProviders.some((p) => p.id === 'sakai-sim'), true);
    } finally {
      fs.rmSync(fullCopy, { recursive: true, force: true });
    }
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});
