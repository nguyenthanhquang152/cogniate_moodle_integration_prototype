// LA-E5-06 K0 / host-only suite (no Docker).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E5-06.md (AC-LA-E5-06-08 K0, AC-LA-E5-06-09 UNIT, exclusive file rules)
// - docs/architecture/ltiaas/adr/LA-ADR-06-security-multi-tenancy.md D1 rules 2, 5, 6; D2 rule 5
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §1.3, §1.5, §2.2, §2.4
// - docs/architecture/ltiaas/build-decisions-A2.md BD-A2-20 (registration_session.client_key)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { f1Hits, isF1Core, plainEnv } from '../../tasks-core/LA-E1-04/fitness';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(here, '../../../..');
const TARGET_ROOT = path.resolve(
  process.env.LA_TARGET_ROOT ?? process.env.QA_REPO_ROOT ?? process.env.LA_SCRATCH_CLONE ?? DEFAULT_ROOT,
);

function readRepoFile(relPath: string): string {
  const abs = path.join(TARGET_ROOT, relPath);
  expect(fs.existsSync(abs), `Expected file to exist: ${relPath}`).toBe(true);
  return fs.readFileSync(abs, 'utf8');
}

function checkF1OnText(
  asPath: string,
  text: string,
): { code: number | null; output: string; rawHits: ReturnType<typeof f1Hits> } {
  const realRes = spawnSync('npm', ['run', '--silent', 'fitness:lms-names', '--', '--stdin', '--as', asPath], {
    cwd: TARGET_ROOT,
    env: plainEnv(),
    input: text,
    encoding: 'utf8',
    timeout: 60_000,
  });
  const probePath = `services/lti-service/src/lti/zz-f1-probe-${path.basename(asPath)}`;
  const probeRes = spawnSync('npm', ['run', '--silent', 'fitness:lms-names', '--', '--stdin', '--as', probePath], {
    cwd: TARGET_ROOT,
    env: plainEnv(),
    input: text,
    encoding: 'utf8',
    timeout: 60_000,
  });
  const realOutput = `${realRes.stdout ?? ''}${realRes.stderr ?? ''}`;
  const probeOutput = `${probeRes.stdout ?? ''}${probeRes.stderr ?? ''}`;
  const rawHits = f1Hits(probeOutput).filter((h) => h.path === probePath);
  return { code: realRes.status, output: `${realOutput}\n${probeOutput}`.trim(), rawHits };
}

function checkF5OnText(asPath: string, text: string): { code: number | null; output: string } {
  const res = spawnSync('npm', ['run', '--silent', 'fitness:rules', '--', '--stdin', '--as', asPath], {
    cwd: TARGET_ROOT,
    env: plainEnv(),
    input: text,
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { code: res.status, output: `${res.stdout ?? ''}${res.stderr ?? ''}`.trim() };
}

describe('LA-E5-06 K0: Protocol wiring (resolver, status pages, session cap, F5 rule)', () => {
  it("AC-LA-E5-06-08 (K0): Fitness F5 check given probe text '/lti/launch/' outside services/lti-service/src/accounts/ fails, and inside passes", () => {
    expect(
      fs.existsSync(path.join(TARGET_ROOT, 'infra/scripts/fitness/rules.mjs')),
      'infra/scripts/fitness/rules.mjs must exist',
    ).toBe(true);

    const cleanProbe = checkF5OnText('services/lti-service/src/lti/login.ts', 'export const ok = 1;\n');
    expect(cleanProbe.code, `Benign probe must exit 0; output:\n${cleanProbe.output}`).toBe(0);

    const probeText = "export const badUrl = 'https://lti.example.test/lti/launch/cogniate';\n";

    const outsideLogin = checkF5OnText('services/lti-service/src/lti/login.ts', probeText);
    expect(
      outsideLogin.code !== 0,
      `F5 must reject literal '/lti/launch/' in services/lti-service/src/lti/login.ts; output:\n${outsideLogin.output}`,
    ).toBe(true);
    expect(
      outsideLogin.output.includes('/lti/launch/'),
      `F5 output names '/lti/launch/'; output:\n${outsideLogin.output}`,
    ).toBe(true);

    const outsideRoute = checkF5OnText('services/lti-service/src/http/routes/protocol.ts', probeText);
    expect(
      outsideRoute.code !== 0,
      `F5 must reject literal '/lti/launch/' in services/lti-service/src/http/routes/protocol.ts; output:\n${outsideRoute.output}`,
    ).toBe(true);

    const insideAccounts = checkF5OnText('services/lti-service/src/accounts/resolver.ts', probeText);
    expect(
      insideAccounts.code,
      `F5 must allow '/lti/launch/' inside services/lti-service/src/accounts/resolver.ts; output:\n${insideAccounts.output}`,
    ).toBe(0);
  });

  it('Static check: lti/codes.ts defines TOOL_ACCOUNT_SUSPENDED, REGISTRATION_SESSION_LIMIT and RATE_LIMITED page codes and action lines', () => {
    const codesSrc = readRepoFile('services/lti-service/src/lti/codes.ts');

    expect(codesSrc.includes('TOOL_ACCOUNT_SUSPENDED'), 'codes.ts defines TOOL_ACCOUNT_SUSPENDED').toBe(true);
    expect(codesSrc.includes('REGISTRATION_SESSION_LIMIT'), 'codes.ts defines REGISTRATION_SESSION_LIMIT').toBe(true);
    expect(codesSrc.includes('RATE_LIMITED'), 'codes.ts defines RATE_LIMITED').toBe(true);
    expect(
      codesSrc.includes('This Cogniate tool is switched off. Ask your Cogniate admin.'),
      'codes.ts includes TOOL_ACCOUNT_SUSPENDED action line',
    ).toBe(true);
    expect(
      codesSrc.includes('Too many registrations are open. Wait one hour, or finish the open registration in'),
      'codes.ts includes REGISTRATION_SESSION_LIMIT action line',
    ).toBe(true);
  });

  it('Static check: resolver calls, status gates, session cap, and BD-A2-20 registration_session.client_key wiring', () => {
    const targetSrc = readRepoFile('services/lti-service/src/lti/target.ts');
    const loginSrc = readRepoFile('services/lti-service/src/lti/login.ts');
    const launchSrc = readRepoFile('services/lti-service/src/lti/launch.ts');
    const regLtiSrc = readRepoFile('services/lti-service/src/lti/registration.ts');
    const protocolRouteSrc = readRepoFile('services/lti-service/src/http/routes/protocol.ts');
    const regRouteSrc = readRepoFile('services/lti-service/src/http/routes/registration.ts');
    const storeRegSrc = readRepoFile('services/lti-service/src/store/registrations.ts');

    // 1. Resolver calls: target.ts, registration.ts, login.ts, launch.ts use protocolUrls
    expect(targetSrc.includes('protocolUrls'), 'lti/target.ts uses protocolUrls').toBe(true);
    expect(regLtiSrc.includes('protocolUrls'), 'lti/registration.ts uses protocolUrls').toBe(true);
    expect(
      loginSrc.includes('protocolUrls') || protocolRouteSrc.includes('protocolUrls'),
      'lti/login.ts or http/routes/protocol.ts uses protocolUrls',
    ).toBe(true);
    expect(
      launchSrc.includes('protocolUrls') || protocolRouteSrc.includes('protocolUrls'),
      'lti/launch.ts or http/routes/protocol.ts uses protocolUrls',
    ).toBe(true);

    // 2. Status gates: suspended -> TOOL_ACCOUNT_SUSPENDED (403), closed -> UNKNOWN_TOOL_ACCOUNT (404)
    expect(
      protocolRouteSrc.includes('TOOL_ACCOUNT_SUSPENDED') ||
        loginSrc.includes('TOOL_ACCOUNT_SUSPENDED') ||
        launchSrc.includes('TOOL_ACCOUNT_SUSPENDED'),
      'protocol routes / handlers return TOOL_ACCOUNT_SUSPENDED for suspended accounts',
    ).toBe(true);
    expect(
      regRouteSrc.includes('TOOL_ACCOUNT_SUSPENDED') || regLtiSrc.includes('TOOL_ACCOUNT_SUSPENDED'),
      'registration route / handler returns TOOL_ACCOUNT_SUSPENDED for suspended accounts',
    ).toBe(true);

    // 3. Session cap: checkRegistrationSessionCap + REGISTRATION_SESSION_LIMIT (409)
    expect(
      regRouteSrc.includes('checkRegistrationSessionCap') || regLtiSrc.includes('checkRegistrationSessionCap'),
      'registration start calls checkRegistrationSessionCap',
    ).toBe(true);
    expect(
      regRouteSrc.includes('REGISTRATION_SESSION_LIMIT') || regLtiSrc.includes('REGISTRATION_SESSION_LIMIT'),
      'registration start returns REGISTRATION_SESSION_LIMIT when cap exceeded',
    ).toBe(true);

    // 4. BD-A2-20: store/registrations.ts writes client_key on insert and clears to NULL at completion
    expect(storeRegSrc.includes('client_key'), 'store/registrations.ts references client_key').toBe(true);
    expect(
      /client_key\s*=\s*NULL/i.test(storeRegSrc),
      'store/registrations.ts clears client_key to NULL on completion',
    ).toBe(true);
  });

  it('F1 (lms-names) and F5 (rules) checks pass on LA-E5-06 core files', () => {
    const coreTargets = [
      'services/lti-service/src/lti/target.ts',
      'services/lti-service/src/lti/login.ts',
      'services/lti-service/src/lti/launch.ts',
      'services/lti-service/src/lti/registration.ts',
      'services/lti-service/src/http/routes/protocol.ts',
      'services/lti-service/src/http/routes/registration.ts',
      'services/lti-service/src/lti/codes.ts',
      'services/lti-service/src/store/registrations.ts',
    ];

    for (const relPath of coreTargets) {
      expect(isF1Core(relPath), `${relPath} is an F1 core path`).toBe(true);
      const src = readRepoFile(relPath);
      const f5 = checkF5OnText(relPath, src);
      expect(f5.code, `${relPath} passes F5 check; output:\n${f5.output}`).toBe(0);
    }

    // codes.ts and store/registrations.ts have 0 baseline F1 hits
    for (const zeroF1Path of [
      'services/lti-service/src/lti/codes.ts',
      'services/lti-service/src/store/registrations.ts',
      'services/lti-service/src/http/routes/protocol.ts',
    ]) {
      const src = readRepoFile(zeroF1Path);
      const f1 = checkF1OnText(zeroF1Path, src);
      expect(f1.code, `${zeroF1Path} passes F1 check; output:\n${f1.output}`).toBe(0);
      expect(f1.rawHits, `${zeroF1Path} must have 0 F1 hits`).toEqual([]);
    }
  });

  it("AC-LA-E5-06-09 (UNIT): Login target check accepts launch and Deep Linking URLs from protocolUrls(account) and refuses another account's URL", () => {
    const targetSrc = readRepoFile('services/lti-service/src/lti/target.ts');
    expect(
      fs.existsSync(path.join(TARGET_ROOT, 'services/lti-service/src/accounts/resolver.ts')),
      'services/lti-service/src/accounts/resolver.ts exists',
    ).toBe(true);
    expect(targetSrc.includes('protocolUrls'), 'lti/target.ts uses protocolUrls(account)').toBe(true);

    const unitRes = spawnSync(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/lti-service/src/lti',
        'services/lti-service/src/accounts',
        'services/lti-service/src/store',
      ],
      {
        cwd: TARGET_ROOT,
        env: plainEnv(),
        encoding: 'utf8',
        timeout: 90_000,
      },
    );
    const unitOutput = `${unitRes.stdout ?? ''}${unitRes.stderr ?? ''}`;
    expect(unitRes.status, `lti, accounts & store unit tests exit 0; output:\n${unitOutput}`).toBe(0);
  });
});
