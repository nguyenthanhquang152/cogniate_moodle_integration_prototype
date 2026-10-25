#!/usr/bin/env node
/**
 * Host runner for LA-E7-03 (Infra wiring of the simulator host manifest).
 *
 * Orchestrates:
 *   Phase 0 (K0): AC-LA-E7-03-04 (`npm run test:infra` + fake-docker temp git checkout checks)
 *   Phase 1 (K1-SIM, default profile): AC-LA-E7-03-03 (`default` profile has no simulator host in
 *     allowlist or aliases, and `/healthz` equals the golden G1.json)
 *   Phase 2 (K1-SIM, acceptance profile, 3 baseline providers): AC-LA-E7-03-01 & AC-LA-E7-03-04
 *     (`docker compose config` aliases/allowlist, `qa.crt` SANs, `/healthz`, and `git status` under `infra/`)
 *   Phase 3 (K1-SIM, acceptance profile, new manifest entry `zz-qa2-sim`): AC-LA-E7-03-02
 *     (adds `zz-qa2.sim.test` and `page.zz-qa2.sim.test` to `tests/sim/hosts.json`, runs `stack:up`,
 *     verifies aliases, SANs, allowlist, and zero edits to `infra/compose.yaml` / `infra/scripts/lib.sh`,
 *     then runs `hosts-manifest.test.ts` inside the `e2e` container)
 */
import { spawnSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(dirname, '../../../..');
const MANIFEST_PATH = path.resolve(REPO_ROOT, 'tests/sim/hosts.json');
const TEMP_PROVIDER_DIR = path.resolve(REPO_ROOT, 'tests/sim/zz-qa2-sim');
const HOST_REPORT_PATH = path.resolve(REPO_ROOT, 'tests/.tmp/la-e7-03-host-report.json');

const BASELINE_HOSTS_MANIFEST = {
  version: 1,
  providers: [
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
      aliases: ['canvas-self.sim.test', 'api.canvas-self.sim.test'],
      allowlist: ['canvas-self.sim.test', 'api.canvas-self.sim.test'],
    },
  ],
};

const ADDED_PROVIDER_ENTRY = {
  id: 'zz-qa2-sim',
  aliases: ['zz-qa2.sim.test', 'page.zz-qa2.sim.test'],
  allowlist: ['zz-qa2.sim.test'],
};

const TEMP_PROVIDER_SOURCE = `import { createProvider } from '../core/provider.mjs';

export const zzQa2 = {
  id: 'zz-qa2-sim',
  issuer: 'https://zz-qa2.sim.test',
  family: 'zz-qa2',
  auth: { host: 'zz-qa2.sim.test', path: '/oidc/auth', methods: ['GET', 'POST'] },
  jwks: { host: 'zz-qa2.sim.test', path: '/.well-known/jwks.json' },
  token: { hosts: ['zz-qa2.sim.test'], path: '/oauth2/token', audience: 'token' },
  sites: [{
    host: 'zz-qa2.sim.test',
    lineitems: '/api/lti/courses/1/line_items',
    nrps: '/api/lti/courses/1/names_and_roles',
    dlReturn: '/deep_link_return',
  }],
  pageHosts: ['page.zz-qa2.sim.test'],
  dlData: 'claim',
  dlSubject: true,
  documentTarget: 'iframe',
};

export function createProviders(runtime) {
  return [createProvider(runtime, zzQa2)];
}
`;

function sh(cmd, { inherit = false, env = {} } = {}) {
  const mergedEnv = { ...process.env, ...env };
  if ('STACK_PROFILE' in env && env.STACK_PROFILE === undefined) {
    delete mergedEnv.STACK_PROFILE;
  }
  const res = spawnSync('bash', ['-c', cmd], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : 'pipe',
    env: mergedEnv,
    timeout: 600_000,
  });
  return {
    code: res.status ?? 1,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
  };
}

function must(label, res) {
  if (res.code !== 0) {
    process.stderr.write(`[LA-E7-03] Step failed (${label}), exit ${res.code}\n`);
    if (res.stdout) process.stderr.write(res.stdout + '\n');
    if (res.stderr) process.stderr.write(res.stderr + '\n');
    throw new Error(`[LA-E7-03] Step failed (${label}), exit ${res.code}`);
  }
  return res;
}

function readCertDnsSans(certPath) {
  const cert = new X509Certificate(fs.readFileSync(certPath));
  const raw = cert.subjectAltName ?? '';
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('DNS:'))
    .map((part) => part.slice(4));
}

function captureComposeConfig(profile) {
  const profileSetup =
    profile === 'acceptance'
      ? 'apply_profile acceptance; dc --profile acceptance config --format json'
      : 'apply_profile default; dc config --format json';
  const res = must(
    `dc config (${profile})`,
    sh(`source infra/scripts/lib.sh && ${profileSetup}`),
  );
  const cfg = JSON.parse(res.stdout);
  const services = cfg.services ?? {};
  const activeServices = Object.keys(services);
  const ltiEnv = services['lti-service']?.environment ?? {};
  const appEnv = services['cogniate-app']?.environment ?? {};
  const ltiAllowlistEnv = String(ltiEnv.OUTBOUND_PRIVATE_HOST_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const appAllowlistEnv = String(appEnv.OUTBOUND_PRIVATE_HOST_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const lmsSimAliases =
    services['lms-sim']?.networks?.default?.aliases ?? [];
  return {
    activeServices,
    lmsSimAliases,
    ltiAllowlistEnv,
    appAllowlistEnv,
  };
}

function captureHealthz() {
  const ltiRes = must(
    'lti-service /healthz',
    sh('source infra/scripts/lib.sh && dc exec -T lti-service wget -qO- http://127.0.0.1:4100/healthz'),
  );
  const appRes = must(
    'cogniate-app /healthz',
    sh('source infra/scripts/lib.sh && dc exec -T cogniate-app wget -qO- http://127.0.0.1:4200/healthz'),
  );
  return {
    ltiHealthz: JSON.parse(ltiRes.stdout),
    appHealthz: JSON.parse(appRes.stdout),
  };
}

// Fail closed before touching any file if Docker is not available.
const dockerCheck = sh('docker info >/dev/null 2>&1');
if (dockerCheck.code !== 0) {
  process.stderr.write(
    '[LA-E7-03] Docker is not running or not reachable. Failing closed without modifying any files.\n',
  );
  process.exit(1);
}

// Phase 0: Run K0 suite (AC-LA-E7-03-04).
console.log('=== [LA-E7-03] Phase 0: K0 suite (AC-LA-E7-03-04) ===');
must(
  'K0 vitest suite',
  sh('LA_LEVEL=k0 npx --prefix tests vitest run -c tests/ltiaas/tasks-ops/LA-E7-03/vitest.config.mts', {
    inherit: true,
  }),
);

const hadOriginalManifest = fs.existsSync(MANIFEST_PATH);
const originalManifestRaw = hadOriginalManifest ? fs.readFileSync(MANIFEST_PATH, 'utf8') : null;
const originalManifest = originalManifestRaw ? JSON.parse(originalManifestRaw) : null;
const hadExtraProviders =
  Array.isArray(originalManifest?.providers) && originalManifest.providers.length > 3;

try {
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  if (!hadOriginalManifest) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(BASELINE_HOSTS_MANIFEST, null, 2) + '\n');
  }

  // Phase 1: Default profile (AC-LA-E7-03-03).
  console.log('=== [LA-E7-03] Phase 1: Default profile (AC-LA-E7-03-03) ===');
  must('gen-env (default)', sh('npm run gen-env', { inherit: true, env: { STACK_PROFILE: undefined } }));
  must('stack:up (default)', sh('npm run stack:up', { inherit: true, env: { STACK_PROFILE: undefined } }));
  must('seed (default)', sh('npm run seed', { inherit: true, env: { STACK_PROFILE: undefined } }));

  const defaultCfg = captureComposeConfig('default');
  const defaultHealth = captureHealthz();

  // Phase 2: Acceptance profile with today's 3 simulator providers (AC-LA-E7-03-01 & AC-LA-E7-03-04).
  console.log('=== [LA-E7-03] Phase 2: Acceptance profile, 3 baseline providers (AC-LA-E7-03-01) ===');
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(BASELINE_HOSTS_MANIFEST, null, 2) + '\n');
  must(
    'gen-env (acceptance, 3 baseline providers)',
    sh('STACK_PROFILE=acceptance bash infra/scripts/gen-env.sh', { inherit: true }),
  );
  const baseline3Cfg = captureComposeConfig('acceptance');
  const baseline3QaCertSans = readCertDnsSans(path.resolve(REPO_ROOT, 'infra/.certs/qa.crt'));

  let baselineHealth = undefined;
  if (hadExtraProviders && originalManifestRaw) {
    // Restore the checkout's full manifest so lms-sim has entries for all loaded provider modules.
    fs.writeFileSync(MANIFEST_PATH, originalManifestRaw);
    must('stack:up (acceptance)', sh('STACK_PROFILE=acceptance npm run stack:up', { inherit: true }));
    must('seed (acceptance)', sh('npm run seed', { inherit: true }));
  } else {
    must(
      'stack:up (acceptance, 3 baseline providers)',
      sh('STACK_PROFILE=acceptance npm run stack:up', { inherit: true }),
    );
    must('seed (acceptance)', sh('npm run seed', { inherit: true }));
    baselineHealth = captureHealthz();
  }

  // Phase 3: Acceptance profile with a new entry in tests/sim/hosts.json (AC-LA-E7-03-02).
  console.log('=== [LA-E7-03] Phase 3: Acceptance profile, added manifest entry (AC-LA-E7-03-02) ===');
  const baseForAddition = hadExtraProviders && originalManifest
    ? originalManifest
    : BASELINE_HOSTS_MANIFEST;
  const extendedManifest = {
    version: 1,
    providers: [
      ...baseForAddition.providers.filter((p) => p.id !== ADDED_PROVIDER_ENTRY.id),
      ADDED_PROVIDER_ENTRY,
    ],
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(extendedManifest, null, 2) + '\n');
  fs.mkdirSync(TEMP_PROVIDER_DIR, { recursive: true });
  fs.writeFileSync(path.join(TEMP_PROVIDER_DIR, 'index.mjs'), TEMP_PROVIDER_SOURCE);

  must(
    'stack:up (acceptance, added manifest entry)',
    sh('STACK_PROFILE=acceptance npm run stack:up', { inherit: true }),
  );

  const addedCfg = captureComposeConfig('acceptance');
  const addedQaCertSans = readCertDnsSans(path.resolve(REPO_ROOT, 'infra/.certs/qa.crt'));
  const addedHealth = captureHealthz();
  const gitStatusComposeAndLib = must(
    'git status compose.yaml + lib.sh',
    sh('git status --porcelain -- infra/compose.yaml infra/scripts/lib.sh'),
  ).stdout.trim();
  const gitStatusInfraAll = must(
    'git status infra/',
    sh('git status --porcelain -- infra/'),
  ).stdout.trim();

  const report = {
    defaultProfile: {
      ltiAllowlistEnv: defaultCfg.ltiAllowlistEnv,
      appAllowlistEnv: defaultCfg.appAllowlistEnv,
      activeServices: defaultCfg.activeServices,
      ltiHealthz: defaultHealth.ltiHealthz,
      appHealthz: defaultHealth.appHealthz,
    },
    baseline3Providers: {
      lmsSimAliases: baseline3Cfg.lmsSimAliases,
      qaCertSans: baseline3QaCertSans,
      ltiAllowlistEnv: baseline3Cfg.ltiAllowlistEnv,
      appAllowlistEnv: baseline3Cfg.appAllowlistEnv,
      ...(baselineHealth ?? {}),
    },
    addedEntryAcceptance: {
      addedProvider: ADDED_PROVIDER_ENTRY,
      lmsSimAliases: addedCfg.lmsSimAliases,
      qaCertSans: addedQaCertSans,
      ltiAllowlistEnv: addedCfg.ltiAllowlistEnv,
      appAllowlistEnv: addedCfg.appAllowlistEnv,
      ltiHealthz: addedHealth.ltiHealthz,
      appHealthz: addedHealth.appHealthz,
      gitStatusInfraComposeAndLib: gitStatusComposeAndLib,
      gitStatusInfraAll: gitStatusInfraAll,
    },
  };

  fs.mkdirSync(path.dirname(HOST_REPORT_PATH), { recursive: true });
  fs.writeFileSync(HOST_REPORT_PATH, JSON.stringify(report, null, 2) + '\n');

  console.log('=== [LA-E7-03] Running in-container K1-SIM assertions ===');
  must(
    'in-container K1-SIM vitest suite',
    sh(
      'source infra/scripts/lib.sh && prepare_e2e && dc --profile test run --rm --build -e QA_TASK=LA-E7-03 e2e sh -c "npm ci --prefix tests --no-audit --no-fund && npm --prefix tests run acceptance:api"',
      { inherit: true },
    ),
  );

  console.log('=== [LA-E7-03] All K0 and K1-SIM checks passed ===');
} catch (err) {
  process.exitCode = 1;
  throw err;
} finally {
  fs.rmSync(TEMP_PROVIDER_DIR, { recursive: true, force: true });
  if (hadOriginalManifest && originalManifestRaw !== null) {
    fs.writeFileSync(MANIFEST_PATH, originalManifestRaw);
  } else {
    fs.rmSync(MANIFEST_PATH, { force: true });
  }
  sh('source infra/scripts/lib.sh && dc --profile acceptance --profile test down -v --remove-orphans', {
    inherit: true,
  });
}
