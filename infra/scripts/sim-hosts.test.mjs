// LA-E7-03: host-only tests of the manifest consumer. Each test uses a temp checkout and fake Docker.
// QA owns the real tests/sim/hosts.json. This fixture stays here until LA-E7-02 supplies that file.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = {
  version: 1,
  providers: [
    {
      id: 'blackboard',
      aliases: ['developer.blackboard.sim.test', 'learn-a.blackboard.sim.test', 'learn-b.blackboard.sim.test'],
      allowlist: ['developer.blackboard.sim.test', 'learn-a.blackboard.sim.test', 'learn-b.blackboard.sim.test'],
    },
    {
      id: 'canvas-cloud',
      aliases: ['sso.canvas.sim.test', 'school-a.canvas.sim.test', 'school-b.canvas.sim.test', 'canvas.school-a.sim.test'],
      allowlist: ['sso.canvas.sim.test', 'school-a.canvas.sim.test', 'school-b.canvas.sim.test'],
    },
    {
      id: 'canvas-self',
      aliases: ['canvas-self.sim.test', 'api.canvas-self.sim.test'],
      allowlist: ['canvas-self.sim.test', 'api.canvas-self.sim.test'],
    },
  ],
};
const ALIASES = ['lms-sim.test', ...FIXTURE.providers.flatMap((p) => p.aliases)];
const ALLOWLIST = FIXTURE.providers.flatMap((p) => p.allowlist);
const QA_HOSTS = ['evil.test', 'qa-platform.test', 'lti-gate.test'];
const SCRIPTS = ['lib.sh', 'storage-oplock.sh', 'gen-certs.sh'];
const temps = [];
afterEach(() => { for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

function checkout(manifest) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sim hosts ')));
  temps.push(root);
  const at = (rel) => path.join(root, rel);
  fs.mkdirSync(at('infra/scripts'), { recursive: true });
  for (const file of SCRIPTS) fs.copyFileSync(path.join(HERE, file), at(`infra/scripts/${file}`));
  fs.copyFileSync(path.join(HERE, '../compose.yaml'), at('infra/compose.yaml'));
  fs.mkdirSync(at('fake-bin'));
  // Report only argv and the public profile settings. Never call the real Docker executable.
  fs.writeFileSync(at('fake-bin/docker'), `#!/usr/bin/env node
console.log(JSON.stringify({
  args: process.argv.slice(2), profiles: process.env.COMPOSE_PROFILES,
  lti: process.env.ACCEPTANCE_LTI_ALLOWLIST_EXTRA, app: process.env.ACCEPTANCE_APP_ALLOWLIST_EXTRA,
  qa: process.env.ACCEPTANCE_ALLOWLIST_EXTRA, simulation: process.env.ACCEPTANCE_LTI_SIMULATION,
}));
`, { mode: 0o755 });
  const putManifest = (value) => {
    fs.mkdirSync(at('tests/sim'), { recursive: true });
    fs.writeFileSync(at('tests/sim/hosts.json'), typeof value === 'string' ? value : JSON.stringify(value));
  };
  if (manifest !== undefined) putManifest(manifest);
  const run = (script) => {
    const result = spawnSync('bash', ['-c', script], {
      cwd: root, encoding: 'utf8', timeout: 30_000,
      env: { PATH: `${at('fake-bin')}:${process.env.PATH}`, COMPOSE_PROJECT_NAME: 'sim-hosts-unit', LC_ALL: 'C' },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    return result;
  };
  const compose = (profile = 'acceptance') => run(`source infra/scripts/lib.sh\napply_profile ${profile}\ndc config`);
  const aliases = () => JSON.parse(fs.readFileSync(at('.tmp/compose.sim-hosts.yaml'), 'utf8')).services['lms-sim'].networks.default.aliases;
  const certs = () => {
    const result = run('bash infra/scripts/gen-certs.sh');
    assert.equal(result.status, 0, result.stderr);
    return new X509Certificate(fs.readFileSync(at('infra/.certs/qa.crt'))).subjectAltName.split(', ').map((s) => s.slice(4));
  };
  return { at, run, compose, aliases, certs, putManifest };
}

function config(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
const sorted = (values) => [...values].sort();

describe('simulator host manifest (LA-E7-03)', () => {
  it('keeps the old hosts when the manifest is absent and prints one notice across child scripts', () => {
    const c = checkout();
    const result = c.run('source infra/scripts/lib.sh\nsource infra/scripts/lib.sh\nbash -c "source infra/scripts/lib.sh"\napply_profile acceptance\ndc config');
    const out = config(result);
    assert.equal(result.stderr.trim().split('\n').length, 1);
    assert.match(result.stderr, /manifest tests\/sim\/hosts.json is absent; using the fixed simulator hosts/);
    assert.deepEqual(sorted(c.aliases()), sorted(ALIASES));
    assert.equal(out.lti, `,${ALLOWLIST.join(',')}`);
    assert.equal(fs.existsSync(c.at('tests/sim/hosts.json')), false);
  });

  it('uses the three providers for Compose aliases, the LTI allowlist and certificate SANs', () => {
    const c = checkout(FIXTURE);
    const result = c.compose();
    const out = config(result);
    assert.equal(result.stderr, '');
    assert.deepEqual(c.aliases(), ALIASES);
    assert.ok(out.args.includes(c.at('.tmp/compose.sim-hosts.yaml')));
    assert.equal(out.profiles, 'acceptance');
    assert.equal(out.lti, `,${ALLOWLIST.join(',')}`);
    assert.equal(out.app, ',lti-gate.test');
    assert.equal(out.qa, ',qa-platform.test,evil.test');
    assert.equal(out.simulation, 'on');
    assert.deepEqual(sorted(c.certs()), sorted([...QA_HOSTS, ...ALIASES]));
    const cert = fs.readFileSync(c.at('infra/.certs/qa.crt'));
    c.certs();
    assert.deepEqual(fs.readFileSync(c.at('infra/.certs/qa.crt')), cert, 'unchanged hosts keep the leaf');
  });

  it('adds and removes hosts from the manifest without a tracked infra edit or a stale alias', () => {
    const c = checkout(FIXTURE);
    const sourceFiles = ['infra/compose.yaml', ...SCRIPTS.map((f) => `infra/scripts/${f}`)];
    const before = sourceFiles.map((file) => fs.readFileSync(c.at(file), 'utf8'));
    c.certs();
    const stackCert = fs.readFileSync(c.at('infra/.certs/stack.crt'));
    const next = structuredClone(FIXTURE);
    next.providers.push({ id: 'new-lms', aliases: ['new.sim.test', 'login.new.sim.test'], allowlist: ['new.sim.test'] });
    c.putManifest(next);
    assert.equal(config(c.compose()).lti, `,${[...ALLOWLIST, 'new.sim.test'].join(',')}`);
    assert.deepEqual(c.aliases(), [...ALIASES, 'new.sim.test', 'login.new.sim.test']);
    assert.deepEqual(sorted(c.certs()), sorted([...QA_HOSTS, ...ALIASES, 'new.sim.test', 'login.new.sim.test']));
    c.putManifest(FIXTURE);
    assert.equal(config(c.compose()).lti, `,${ALLOWLIST.join(',')}`);
    assert.deepEqual(c.aliases(), ALIASES);
    assert.deepEqual(sorted(c.certs()), sorted([...QA_HOSTS, ...ALIASES]));
    assert.deepEqual(fs.readFileSync(c.at('infra/.certs/stack.crt')), stackCert, 'the public stack leaf does not change');
    assert.deepEqual(sourceFiles.map((file) => fs.readFileSync(c.at(file), 'utf8')), before);
  });

  it('default has no simulator allowlist or alias override, including after acceptance in the same shell', () => {
    const c = checkout(FIXTURE);
    const fresh = config(c.compose('default'));
    assert.equal(fs.existsSync(c.at('.tmp/compose.sim-hosts.yaml')), false);
    assert.deepEqual([fresh.profiles, fresh.lti, fresh.app, fresh.qa, fresh.simulation], ['', '', '', '', '']);
    const switched = config(c.run('source infra/scripts/lib.sh\napply_profile acceptance\ndc config >/dev/null\napply_profile default\ndc config'));
    assert.equal(fs.existsSync(c.at('.tmp/compose.sim-hosts.yaml')), true, 'an old override exists');
    assert.deepEqual(switched, fresh, 'default never includes the old override');
    const base = fs.readFileSync(c.at('infra/compose.yaml'), 'utf8');
    assert.doesNotMatch(base, /- (?:lms-sim\.test|\S+\.sim\.test)/, 'base has no simulator aliases');
    assert.match(base, /OUTBOUND_PRIVATE_HOST_ALLOWLIST:.*\$\{ACCEPTANCE_LTI_ALLOWLIST_EXTRA:-\}/);
  });

  it('deduplicates aliases and allowlist hosts, and permits an empty allowlist', () => {
    const c = checkout({ version: 1, providers: [
      { id: 'one', aliases: ['one.sim.test', 'one.sim.test'], allowlist: ['one.sim.test', 'one.sim.test'] },
      { id: 'two', aliases: ['one.sim.test', 'two.sim.test'], allowlist: ['one.sim.test'] },
    ] });
    assert.equal(config(c.compose()).lti, ',one.sim.test');
    assert.deepEqual(c.aliases(), ['lms-sim.test', 'one.sim.test', 'two.sim.test']);
    c.putManifest({ version: 1, providers: [{ id: 'browser-only', aliases: ['one.sim.test'], allowlist: [] }] });
    assert.equal(config(c.compose()).lti, '');
    c.putManifest({ version: 1, providers: [] });
    assert.equal(config(c.compose()).lti, '');
    assert.deepEqual(c.aliases(), ['lms-sim.test']);
  });

  const provider = { id: 'one', aliases: ['one.sim.test'], allowlist: ['one.sim.test'] };
  const entry = (change) => ({ version: 1, providers: [{ ...provider, ...change }] });
  for (const [name, bad] of [
    ['invalid JSON', '{'],
    ['unknown version', { version: 2, providers: [] }],
    ['missing providers', { version: 1 }],
    ['null provider', { version: 1, providers: [null] }],
    ['empty id', entry({ id: ' ' })],
    ['duplicate ids', { version: 1, providers: [provider, provider] }],
    ['empty aliases', entry({ aliases: [] })],
    ['missing allowlist', entry({ allowlist: undefined })],
    ['non-string host', entry({ aliases: [3] })],
    ['non-test host', entry({ aliases: ['one.example.com'] })],
    ['invalid DNS label', entry({ aliases: ['bad_.sim.test'] })],
    ['shell text', entry({ aliases: ['$(touch unsafe).test'] })],
    ['reserved host', entry({ aliases: ['lti.cogniate.test'] })],
    ['allowlist host without an alias', entry({ allowlist: ['other.sim.test'] })],
  ]) {
    it(`refuses ${name} before Compose, even when an old override exists`, () => {
      const c = checkout(FIXTURE);
      config(c.compose());
      const old = fs.readFileSync(c.at('.tmp/compose.sim-hosts.yaml'));
      c.putManifest(bad);
      const result = c.compose();
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '', 'no Compose call');
      assert.match(result.stderr, /^Invalid simulator host manifest tests\/sim\/hosts.json:/);
      assert.doesNotMatch(result.stderr, /using the fixed simulator hosts/);
      assert.deepEqual(fs.readFileSync(c.at('.tmp/compose.sim-hosts.yaml')), old);
    });
  }

  it('refuses an unreadable manifest path instead of treating it as absent', () => {
    const c = checkout(FIXTURE);
    fs.unlinkSync(c.at('tests/sim/hosts.json'));
    fs.symlinkSync('missing.json', c.at('tests/sim/hosts.json'));
    const result = c.compose();
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Invalid simulator host manifest.*cannot read valid JSON/);
  });
});
