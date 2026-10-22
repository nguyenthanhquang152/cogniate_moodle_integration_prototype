/**
 * LA-E7-03 K0 suite: Infra wiring of the simulator host manifest (tests/sim/hosts.json).
 *
 * AC covered:
 *   AC-LA-E7-03-04 — `npm run test:infra` passes, and `git status` after `stack:up` shows
 *                    no new or changed tracked file under `infra/` (any generated compose
 *                    override lives under `.tmp/`, git-ignored; BD-A1-01, BD-A1-07, BD-A1-08).
 *
 * Host-only (no real Docker). Uses a fake `docker` executable in a temporary git checkout.
 */
import { spawnSync } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BASELINE_HOSTS_MANIFEST,
  BASELINE_QA_CERT_SANS,
  BASELINE_SIM_ALIASES,
  BASELINE_SIM_ALLOWLIST,
} from './manifest-constants.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(dirname, '../../../..');

const FAKE_DOCKER = `#!/bin/bash
echo "docker $*" >> "$CALLS"
if [ -n "$ENV_LOG" ]; then
  node -e 'const fs=require("fs");fs.appendFileSync(process.env.ENV_LOG,JSON.stringify({args:process.argv.slice(1),profile:process.env.ACTIVE_STACK_PROFILE||"",ltiExtra:process.env.ACCEPTANCE_LTI_ALLOWLIST_EXTRA||""})+"\\n");' -- "$@"
fi
case "$1" in
  info) exit 0 ;;
  ps) exit 0 ;;
  volume) exit 0 ;;
  inspect) echo "healthy"; exit 0 ;;
  compose)
    case " $* " in
      *" port proxy "*) exit 0 ;;
      *" storage-preflight report "*)
        echo '{"event":"storage_preflight","folder":"lti","state":"OK"}'
        echo '{"event":"storage_preflight","folder":"app","state":"OK"}'
        echo '{"event":"storage_preflight_summary","decision":"proceed","state":"OK"}'
        exit 0
        ;;
      *" storage-preflight check "*)
        echo '{"event":"storage_preflight","folder":"lti","state":"OK"}'
        echo '{"event":"storage_preflight","folder":"app","state":"OK"}'
        echo '{"event":"storage_preflight_summary","decision":"proceed","state":"OK"}'
        exit 0
        ;;
      *" up -d "*) exit 0 ;;
      *" rm -s -f "*) exit 0 ;;
      *" down "*) exit 0 ;;
      *" config --services "*)
        printf "proxy\\nmoodle\\nlti-service\\ncogniate-app\\nsink\\nqa-platform\\nlms-sim\\nlti-gate\\n"
        exit 0
        ;;
    esac
    exit 0
    ;;
esac
exit 0
`;

const FAKE_PS = `#!/bin/bash
if [ "$1" = "-p" ] && [ "$2" = "999999" ]; then
  echo "bash infra/scripts/build-runner.sh watch"
  exit 0
fi
exec /bin/ps "$@"
`;

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function sha256File(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readCertDnsSans(certPath: string): string[] {
  const cert = new X509Certificate(fs.readFileSync(certPath));
  const raw = cert.subjectAltName ?? '';
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('DNS:'))
    .map((part) => part.slice(4));
}

function createTempGitCheckout() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'la-e7-03-k0-'));
  temps.push(base);
  const root = path.join(base, 'repo');
  fs.mkdirSync(path.join(root, 'infra/scripts'), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, '.gitignore'), path.join(root, '.gitignore'));
  fs.copyFileSync(path.join(REPO_ROOT, 'infra/compose.yaml'), path.join(root, 'infra/compose.yaml'));

  const copyDirRecursive = (srcDir: string, destDir: string) => {
    fs.mkdirSync(destDir, { recursive: true });
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      const s = path.join(srcDir, entry.name);
      const d = path.join(destDir, entry.name);
      if (entry.isDirectory()) {
        copyDirRecursive(s, d);
      } else if (entry.isFile()) {
        fs.copyFileSync(s, d);
        fs.chmodSync(d, fs.statSync(s).mode);
      }
    }
  };
  copyDirRecursive(path.join(REPO_ROOT, 'infra/scripts'), path.join(root, 'infra/scripts'));

  // Pre-populate front-end dist markers so stack-up.sh does not run npm build in the temp repo.
  fs.mkdirSync(path.join(root, 'apps/player/dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'apps/player/dist/runtime.js'), '// stub\n');
  fs.mkdirSync(path.join(root, 'apps/portal/dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'apps/portal/dist/index.html'), '<!doctype html>\n');

  // Write the baseline simulator host manifest under tests/sim/hosts.json.
  fs.mkdirSync(path.join(root, 'tests/sim'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'tests/sim/hosts.json'),
    JSON.stringify(BASELINE_HOSTS_MANIFEST, null, 2) + '\n',
  );

  // Initialize git repo and commit all tracked files so git status can verify infra/ cleanliness.
  const git = (args: string[]) => {
    const res = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (res.status !== 0) {
      throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
    }
    return res.stdout;
  };
  git(['init', '-q']);
  git(['config', 'user.email', 'qa2@cogniate.test']);
  git(['config', 'user.name', 'QA-2']);
  git(['add', '.']);
  git(['commit', '-q', '-m', 'Initial temp checkout']);

  const bin = path.join(base, 'fake-bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'docker'), FAKE_DOCKER, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'ps'), FAKE_PS, { mode: 0o755 });

  const project = 'qa2-e703-k0';
  fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
  fs.writeFileSync(path.join(root, `.tmp/build-runner.${project}.pid`), '999999\n');

  const callsFile = path.join(base, 'calls.log');
  const envLogFile = path.join(base, 'env.jsonl');

  const runScript = (relScript: string, args: string[] = [], extraEnv: Record<string, string> = {}) => {
    fs.writeFileSync(callsFile, '');
    fs.writeFileSync(envLogFile, '');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      HOME: base,
      CALLS: callsFile,
      ENV_LOG: envLogFile,
      COMPOSE_PROJECT_NAME: project,
      PUBLIC_PORT: '19443',
      STACK_SUBNET: '172.31.240.0/24',
      ...extraEnv,
    };
    if (!('STACK_PROFILE' in extraEnv)) {
      delete env.STACK_PROFILE;
    }
    const res = spawnSync('bash', [path.join(root, relScript), ...args], {
      cwd: root,
      encoding: 'utf8',
      timeout: 60_000,
      env,
    });
    const calls = fs.readFileSync(callsFile, 'utf8').split('\n').filter(Boolean);
    const envCalls = fs
      .readFileSync(envLogFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { args: string[]; profile: string; ltiExtra: string });
    return {
      code: res.status ?? 1,
      stdout: res.stdout ?? '',
      stderr: res.stderr ?? '',
      calls,
      envCalls,
    };
  };

  return { root, git, runScript };
}

describe('LA-E7-03 K0: infra tests and simulator host manifest wiring', () => {
  it('[AC-LA-E7-03-04] npm run test:infra passes and stack:up with tests/sim/hosts.json leaves git status under infra/ clean while enforcing BD-A1-01/BD-A1-08', () => {
    // 1. npm run test:infra must pass in the repository root.
    const infraRes = spawnSync('npm', ['run', 'test:infra'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 120_000,
    });
    expect(infraRes.status, `npm run test:infra failed:\n${infraRes.stdout}\n${infraRes.stderr}`).toBe(0);

    // 2. Run stack:up in a temp git checkout with fake docker and the 3-provider baseline manifest.
    const checkout = createTempGitCheckout();
    const upBaseline = checkout.runScript('infra/scripts/stack-up.sh', [], {
      STACK_PROFILE: 'acceptance',
    });
    expect(
      upBaseline.code,
      `stack:up (acceptance, baseline manifest) failed:\n${upBaseline.stdout}\n${upBaseline.stderr}`,
    ).toBe(0);

    // git status under infra/ must show no new or changed tracked or non-ignored files (AC-LA-E7-03-04).
    const infraStatusAfterBaseline = checkout.git(['status', '--porcelain', '--', 'infra/']).trim();
    expect(infraStatusAfterBaseline).toBe('');

    // Baseline qa.crt SANs must match the 3-provider baseline (order-independent, no duplicates).
    const qaCertPath = path.join(checkout.root, 'infra/.certs/qa.crt');
    expect(fs.existsSync(qaCertPath)).toBe(true);
    const baselineSans = readCertDnsSans(qaCertPath);
    expect([...baselineSans].sort()).toEqual([...BASELINE_QA_CERT_SANS].sort());
    expect(baselineSans.length).toBe(BASELINE_QA_CERT_SANS.length);

    // Baseline ACCEPTANCE_LTI_ALLOWLIST_EXTRA passed to docker compose up must equal the 8 allowlist hosts.
    const upCallBaseline = upBaseline.envCalls.find((c) => c.args.includes('up'));
    expect(upCallBaseline).toBeDefined();
    const baselineLtiExtraHosts = (upCallBaseline?.ltiExtra ?? '').split(',').filter(Boolean);
    expect([...baselineLtiExtraHosts].sort()).toEqual([...BASELINE_SIM_ALLOWLIST].sort());
    expect(baselineLtiExtraHosts.length).toBe(BASELINE_SIM_ALLOWLIST.length);

    // 3. Adding a new entry to tests/sim/hosts.json must update qa.crt SANs, the generated .tmp override,
    //    and ACCEPTANCE_LTI_ALLOWLIST_EXTRA on stack:up without touching any tracked file under infra/.
    const extendedManifest = {
      version: 1,
      providers: [
        ...BASELINE_HOSTS_MANIFEST.providers,
        {
          id: 'zz-qa2-sim',
          aliases: ['zz-qa2.sim.test', 'page.zz-qa2.sim.test'],
          allowlist: ['zz-qa2.sim.test'],
        },
      ],
    };
    fs.writeFileSync(
      path.join(checkout.root, 'tests/sim/hosts.json'),
      JSON.stringify(extendedManifest, null, 2) + '\n',
    );

    const upExtended = checkout.runScript('infra/scripts/stack-up.sh', [], {
      STACK_PROFILE: 'acceptance',
    });
    expect(
      upExtended.code,
      `stack:up (acceptance, extended manifest) failed:\n${upExtended.stdout}\n${upExtended.stderr}`,
    ).toBe(0);

    // git status under infra/ must still be completely clean (AC-LA-E7-03-04, BD-A1-07).
    expect(checkout.git(['status', '--porcelain', '--', 'infra/']).trim()).toBe('');

    // qa.crt SANs must include both new aliases from tests/sim/hosts.json.
    const extendedSans = readCertDnsSans(qaCertPath);
    expect(extendedSans).toContain('zz-qa2.sim.test');
    expect(extendedSans).toContain('page.zz-qa2.sim.test');

    // ACCEPTANCE_LTI_ALLOWLIST_EXTRA must include zz-qa2.sim.test and NOT page.zz-qa2.sim.test.
    const upCallExtended = upExtended.envCalls.find((c) => c.args.includes('up'));
    expect(upCallExtended).toBeDefined();
    const ltiAllowlistHosts = (upCallExtended?.ltiExtra ?? '').split(',').filter(Boolean);
    expect(ltiAllowlistHosts).toContain('zz-qa2.sim.test');
    expect(ltiAllowlistHosts).not.toContain('page.zz-qa2.sim.test');

    // The compose override file for simulator hosts must live under .tmp/ and include the new aliases.
    const tmpFiles = fs.readdirSync(path.join(checkout.root, '.tmp'));
    const overrideText = tmpFiles
      .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json'))
      .map((f) => fs.readFileSync(path.join(checkout.root, '.tmp', f), 'utf8'))
      .join('\n');
    expect(overrideText).toContain('zz-qa2.sim.test');
    expect(overrideText).toContain('page.zz-qa2.sim.test');

    // 4. BD-A1-08 fail-closed rules on a bad tests/sim/hosts.json:
    //    - gen-certs.sh warns and keeps qa.crt unchanged
    //    - STACK_PROFILE=acceptance stack:up exits 1 before any docker compose call
    //    - STACK_PROFILE=default stack:up warns and exits 0
    const qaCertShaBeforeBad = sha256File(qaCertPath);
    fs.writeFileSync(
      path.join(checkout.root, 'tests/sim/hosts.json'),
      JSON.stringify(
        {
          version: 1,
          providers: [
            {
              id: 'bad-provider',
              aliases: ['not-a-sim-host.example.com'],
              allowlist: ['not-a-sim-host.example.com'],
            },
          ],
        },
        null,
        2,
      ) + '\n',
    );

    const certsBad = checkout.runScript('infra/scripts/gen-certs.sh');
    expect(certsBad.code).toBe(0);
    expect(sha256File(qaCertPath)).toBe(qaCertShaBeforeBad);

    const upBadAcceptance = checkout.runScript('infra/scripts/stack-up.sh', [], {
      STACK_PROFILE: 'acceptance',
    });
    expect(upBadAcceptance.code).toBe(1);
    const composeCallsOnBadAcceptance = upBadAcceptance.calls.filter((line) =>
      line.startsWith('docker compose '),
    );
    expect(composeCallsOnBadAcceptance).toEqual([]);
    expect(`${upBadAcceptance.stdout}\n${upBadAcceptance.stderr}`).toMatch(/hosts\.json/i);

    const upBadDefault = checkout.runScript('infra/scripts/stack-up.sh', [], {
      STACK_PROFILE: 'default',
    });
    expect(
      upBadDefault.code,
      `default profile stack:up should warn and succeed on bad hosts.json:\n${upBadDefault.stdout}\n${upBadDefault.stderr}`,
    ).toBe(0);
    expect(`${upBadDefault.stdout}\n${upBadDefault.stderr}`).toMatch(/hosts\.json/i);
    expect(checkout.git(['status', '--porcelain', '--', 'infra/']).trim()).toBe('');
  });
});
