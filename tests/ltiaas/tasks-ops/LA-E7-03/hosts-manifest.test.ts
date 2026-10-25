/**
 * LA-E7-03 K1-SIM suite: Infra wiring of the simulator host manifest (tests/sim/hosts.json).
 *
 * ACs covered:
 *   AC-LA-E7-03-01 — With today's three simulator providers in the host manifest, the
 *                    `acceptance` stack has the same aliases, SANs and allowlist entries
 *                    as before (compare of `docker compose config` and certificate SAN list).
 *   AC-LA-E7-03-02 — A new entry in the host manifest adds its host to the aliases, the SANs
 *                    and the `acceptance` allowlist after `stack:up`, with no edit of
 *                    `infra/compose.yaml` or `infra/scripts/lib.sh`.
 *   AC-LA-E7-03-03 — The `default` profile has no simulator host in its allowlist or aliases,
 *                    and `/healthz` of the default profile equals the golden.
 *
 * Orchestrated by `node tests/ltiaas/tasks-ops/LA-E7-03/run.mjs`. Fails closed if run directly
 * without the host runner report or a running stack.
 */
import { X509Certificate } from 'node:crypto';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BASELINE_QA_CERT_SANS,
  BASELINE_SIM_ALIASES,
  BASELINE_SIM_ALLOWLIST,
} from './manifest-constants.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(dirname, '../../../..');
const HOST_REPORT_PATH = path.resolve(REPO_ROOT, 'tests/.tmp/la-e7-03-host-report.json');
const GOLDEN_G1_PATH = path.resolve(
  REPO_ROOT,
  'tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/G1.json',
);

interface HostReport {
  defaultProfile: {
    ltiAllowlistEnv: string[];
    appAllowlistEnv: string[];
    activeServices: string[];
    ltiHealthz: Record<string, unknown>;
    appHealthz: Record<string, unknown>;
  };
  baseline3Providers: {
    lmsSimAliases: string[];
    qaCertSans: string[];
    ltiAllowlistEnv: string[];
    appAllowlistEnv: string[];
    ltiHealthz?: {
      status: string;
      service: string;
      profile: string;
      outbound_allowlist: string[];
    };
    appHealthz?: {
      status: string;
      service: string;
      profile: string;
      outbound_allowlist: string[];
    };
  };
  addedEntryAcceptance: {
    addedProvider: {
      id: string;
      aliases: string[];
      allowlist: string[];
    };
    lmsSimAliases: string[];
    qaCertSans: string[];
    ltiAllowlistEnv: string[];
    appAllowlistEnv: string[];
    ltiHealthz: {
      status: string;
      service: string;
      profile: string;
      outbound_allowlist: string[];
    };
    appHealthz: {
      status: string;
      service: string;
      profile: string;
      outbound_allowlist: string[];
    };
    gitStatusInfraComposeAndLib: string;
    gitStatusInfraAll: string;
  };
}

function loadHostReport(): HostReport {
  if (!fs.existsSync(HOST_REPORT_PATH)) {
    throw new Error(
      `Missing host runner report at ${HOST_REPORT_PATH}. Run via: node tests/ltiaas/tasks-ops/LA-E7-03/run.mjs`,
    );
  }
  return JSON.parse(fs.readFileSync(HOST_REPORT_PATH, 'utf8')) as HostReport;
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

describe('LA-E7-03 K1-SIM: simulator host manifest wiring (compose aliases, qa.crt SANs, acceptance allowlist)', () => {
  it('[AC-LA-E7-03-01] with today’s three simulator providers in the host manifest, the acceptance stack has the same aliases, SANs and allowlist entries as before', async () => {
    const report = loadHostReport();
    const b = report.baseline3Providers;

    // 1. lms-sim network aliases in docker compose config must match the 10 baseline aliases
    //    (lms-sim.test + 9 provider aliases from blackboard-sim, canvas-sim-cloud, canvas-sim-self).
    expect([...b.lmsSimAliases].sort()).toEqual([...BASELINE_SIM_ALIASES].sort());
    expect(b.lmsSimAliases.length).toBe(BASELINE_SIM_ALIASES.length);

    // 2. qa.crt Subject Alternative Name list must match the 13 baseline DNS names.
    expect([...b.qaCertSans].sort()).toEqual([...BASELINE_QA_CERT_SANS].sort());
    expect(b.qaCertSans.length).toBe(BASELINE_QA_CERT_SANS.length);

    // 3. lti-service OUTBOUND_PRIVATE_HOST_ALLOWLIST in acceptance must equal
    //    moodle.test, qa-platform.test, evil.test + the 8 allowlisted simulator hosts.
    //    Browser-only alias canvas.school-a.sim.test and control alias lms-sim.test must NOT be allowlisted.
    const expectedLtiAllowlist = [
      'moodle.test',
      'qa-platform.test',
      'evil.test',
      ...BASELINE_SIM_ALLOWLIST,
    ];
    expect([...b.ltiAllowlistEnv].sort()).toEqual([...expectedLtiAllowlist].sort());
    expect(b.ltiAllowlistEnv.length).toBe(expectedLtiAllowlist.length);
    expect(b.ltiAllowlistEnv).not.toContain('canvas.school-a.sim.test');
    expect(b.ltiAllowlistEnv).not.toContain('lms-sim.test');

    if (b.ltiHealthz) {
      expect(b.ltiHealthz.profile).toBe('acceptance');
      expect([...b.ltiHealthz.outbound_allowlist].sort()).toEqual([...expectedLtiAllowlist].sort());
      expect(b.ltiHealthz.outbound_allowlist.length).toBe(expectedLtiAllowlist.length);
    }

    // 4. cogniate-app allowlist in acceptance must not include any simulator host.
    const expectedAppAllowlist = [
      'lti.cogniate.test',
      'moodle.test',
      'qa-platform.test',
      'evil.test',
      'lti-gate.test',
    ];
    expect([...b.appAllowlistEnv].sort()).toEqual([...expectedAppAllowlist].sort());
    expect(b.appAllowlistEnv.length).toBe(expectedAppAllowlist.length);
    expect(b.appAllowlistEnv.filter((h) => h.endsWith('.sim.test'))).toEqual([]);

    // 5. Inside the e2e container, every baseline simulator alias resolves to lms-sim on the compose network.
    const lmsSimLookup = await dns.lookup('lms-sim.test');
    for (const alias of BASELINE_SIM_ALIASES) {
      const resolved = await dns.lookup(alias);
      expect(resolved.address, `alias ${alias} should resolve to lms-sim IP`).toBe(
        lmsSimLookup.address,
      );
    }
  });

  it('[AC-LA-E7-03-02] a new entry in the host manifest adds its host to the aliases, the SANs and the acceptance allowlist after stack:up, with no edit of infra/compose.yaml or infra/scripts/lib.sh', async () => {
    const report = loadHostReport();
    const added = report.addedEntryAcceptance;

    // 1. No edit to infra/compose.yaml or infra/scripts/lib.sh (or any tracked file under infra/).
    expect(added.gitStatusInfraComposeAndLib).toBe('');
    expect(added.gitStatusInfraAll).toBe('');

    // 2. docker compose config lms-sim aliases include both new aliases (zz-qa2.sim.test and page.zz-qa2.sim.test)
    //    and retain the fixed control alias lms-sim.test.
    expect(added.lmsSimAliases).toContain('lms-sim.test');
    expect(added.lmsSimAliases).toContain('zz-qa2.sim.test');
    expect(added.lmsSimAliases).toContain('page.zz-qa2.sim.test');

    // 3. qa.crt SANs on the host AND mounted inside e2e (/repo/infra/.certs/qa.crt) contain the new aliases.
    expect(added.qaCertSans).toContain('zz-qa2.sim.test');
    expect(added.qaCertSans).toContain('page.zz-qa2.sim.test');

    const inContainerQaCertPath = path.resolve(REPO_ROOT, 'infra/.certs/qa.crt');
    expect(fs.existsSync(inContainerQaCertPath)).toBe(true);
    const inContainerSans = readCertDnsSans(inContainerQaCertPath);
    expect(inContainerSans).toContain('zz-qa2.sim.test');
    expect(inContainerSans).toContain('page.zz-qa2.sim.test');

    // 4. lti-service allowlist in docker compose config, host /healthz, and live in-container /healthz
    //    includes zz-qa2.sim.test (in allowlist) and excludes page.zz-qa2.sim.test (alias-only) and lms-sim.test.
    expect(added.ltiAllowlistEnv).toContain('zz-qa2.sim.test');
    expect(added.ltiAllowlistEnv).not.toContain('page.zz-qa2.sim.test');
    expect(added.ltiAllowlistEnv).not.toContain('lms-sim.test');

    expect(added.ltiHealthz.outbound_allowlist).toContain('zz-qa2.sim.test');
    expect(added.ltiHealthz.outbound_allowlist).not.toContain('page.zz-qa2.sim.test');

    const publicLtiUrl = (process.env.PUBLIC_LTI_URL ?? 'https://lti.cogniate.test').replace(/\/$/, '');
    const ltiHealthRes = await fetch(`${publicLtiUrl}/healthz`);
    expect(ltiHealthRes.status).toBe(200);
    const liveLtiHealth = (await ltiHealthRes.json()) as {
      status: string;
      service: string;
      profile: string;
      outbound_allowlist: string[];
    };
    expect(liveLtiHealth.profile).toBe('acceptance');
    expect(liveLtiHealth.outbound_allowlist).toContain('zz-qa2.sim.test');
    expect(liveLtiHealth.outbound_allowlist).not.toContain('page.zz-qa2.sim.test');
    expect(liveLtiHealth.outbound_allowlist).not.toContain('lms-sim.test');

    // 5. cogniate-app allowlist remains free of simulator hosts.
    const publicAppUrl = (process.env.PUBLIC_APP_URL ?? 'https://app.cogniate.test').replace(/\/$/, '');
    const appHealthRes = await fetch(`${publicAppUrl}/healthz`);
    expect(appHealthRes.status).toBe(200);
    const liveAppHealth = (await appHealthRes.json()) as {
      outbound_allowlist: string[];
    };
    expect(liveAppHealth.outbound_allowlist.filter((h) => h.endsWith('.sim.test'))).toEqual([]);

    // 6. Both new aliases resolve on the Docker compose network inside e2e to the lms-sim container IP.
    const lmsSimIp = (await dns.lookup('lms-sim.test')).address;
    expect((await dns.lookup('zz-qa2.sim.test')).address).toBe(lmsSimIp);
    expect((await dns.lookup('page.zz-qa2.sim.test')).address).toBe(lmsSimIp);
  });

  it('[AC-LA-E7-03-03] the default profile has no simulator host in its allowlist or aliases, and /healthz of the default profile equals the golden', () => {
    const report = loadHostReport();
    const def = report.defaultProfile;
    const golden = JSON.parse(fs.readFileSync(GOLDEN_G1_PATH, 'utf8')) as {
      default: {
        ltiHealth: Record<string, unknown>;
        appHealth: Record<string, unknown>;
      };
    };

    // 1. Default profile allowlists have no simulator host (.sim.test or lms-sim.test).
    expect(def.ltiAllowlistEnv).toEqual(['moodle.test']);
    expect(def.ltiAllowlistEnv.filter((h) => h.endsWith('.sim.test') || h === 'lms-sim.test')).toEqual(
      [],
    );
    expect(def.appAllowlistEnv).toEqual(['lti.cogniate.test', 'moodle.test']);
    expect(def.appAllowlistEnv.filter((h) => h.endsWith('.sim.test') || h === 'lms-sim.test')).toEqual(
      [],
    );

    // 2. Default profile active services do not include lms-sim.
    expect(def.activeServices).not.toContain('lms-sim');

    // 3. Default profile /healthz of lti-service and cogniate-app equals the golden G1.json.
    expect(def.ltiHealthz).toEqual(golden.default.ltiHealth);
    expect(def.appHealthz).toEqual(golden.default.appHealth);
  });
});
