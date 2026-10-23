// LA-E2-02 K0 / host-only suite (no Docker).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E2-02.md (AC-LA-E2-02-01 UNIT + design notes)
// - docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md D2a, D5 (items 1-8, 10)
// - docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md D8 LA-IC-03
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §2.4, §4.5
// - docs/architecture/ltiaas/data-model.md §4.2 (migration 021: registration_session.token_kind CHECK)
// - docs/architecture/ltiaas/build-decisions-A1.md (BD-A1-43, BD-A1-54/55, BD-A1-59/68, BD-A1-75/76/77, BD-A1-83/84, BD-A1-87/88/89)
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

function findTokenKindMigration(): { relPath: string; content: string } | null {
  const migDir = path.join(TARGET_ROOT, 'services/lti-service/src/db/migrations');
  if (!fs.existsSync(migDir)) return null;
  const files = fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    const relPath = `services/lti-service/src/db/migrations/${f}`;
    const content = fs.readFileSync(path.join(migDir, f), 'utf8');
    if (content.includes('token_kind') && /registration_session/i.test(content)) {
      return { relPath, content };
    }
  }
  return null;
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

describe('LA-E2-02 K0: E2-K Generic Dynamic Registration fixes and staged registration', () => {
  it('Static & schema checks: migration 021 (token_kind CHECK), legacy flag removal (BD-A1-75/83), TOOL_MAY_EXIST (BD-A1-87), profile identity (BD-A1-88), credentials as one set (BD-A1-89), and familyGuardVerdict phases (BD-A1-43/54/55)', () => {
    const regSrc = readRepoFile('services/lti-service/src/lti/registration.ts');
    const routeSrc = readRepoFile('services/lti-service/src/http/routes/registration.ts');
    const storeRegSrc = readRepoFile('services/lti-service/src/store/registrations.ts');
    const storePlatSrc = readRepoFile('services/lti-service/src/store/platforms.ts');
    const rulesSrc = readRepoFile('services/lti-service/src/lti/platform-rules.ts');
    const codesSrc = readRepoFile('services/lti-service/src/lti/codes.ts');
    const checksSrc = readRepoFile('services/lti-service/src/lti/checks.ts');
    const tokenClientSrc = readRepoFile('services/lti-service/src/platform/token-client.ts');
    const k0ContractSrc = readRepoFile('tests/ltiaas/k0/contract.test.ts');
    const kernelProfilesSrc = readRepoFile('packages/channel-kernel/src/profiles.ts');
    const moodleManifestSrc = readRepoFile('packages/channels/moodle/manifest.ts');

    const combinedLti = `${regSrc}\n${routeSrc}\n${storeRegSrc}\n${storePlatSrc}\n${rulesSrc}\n${codesSrc}`;

    // 1. Migration 021: registration_session.token_kind TEXT NULL CHECK (token_kind IN ('scope-jwt', 'opaque-bearer')) (BD-A1-77)
    const mig = findTokenKindMigration();
    expect(Boolean(mig), 'LTI migration 021 adding registration_session.token_kind must exist').toBe(true);
    expect(mig!.relPath.includes('021'), `migration file is numbered 021 (${mig!.relPath})`).toBe(true);
    expect(mig!.content.includes('token_kind'), 'migration 021 adds token_kind').toBe(true);
    expect(
      /CHECK\s*\(\s*token_kind\s+IN\s*\(\s*'scope-jwt'\s*,\s*'opaque-bearer'\s*\)\s*\)/i.test(mig!.content),
      'migration 021 enforces CHECK (token_kind IN (\'scope-jwt\', \'opaque-bearer\'))',
    ).toBe(true);

    // 2. BD-A1-75: token-client reads only clientAssertionAud (never clientAssertionAudArray), and
    // tests/ltiaas/k0/contract.test.ts no longer requires flags.clientAssertionAudArray on profiles.
    expect(
      tokenClientSrc.includes('clientAssertionAudArray'),
      'token-client.ts reads only clientAssertionAud and never clientAssertionAudArray (BD-A1-75)',
    ).toBe(false);
    expect(
      k0ContractSrc.includes('flags.clientAssertionAudArray,'),
      'tests/ltiaas/k0/contract.test.ts no longer asserts flags.clientAssertionAudArray on profiles (BD-A1-75)',
    ).toBe(false);

    // 3. Staged DR per profile, I-SELF, token_kind, endpointsOnIssuerOrigin, grantedScopes, bindingRef (D5 items 1-8, 10; BD-A1-84)
    expect(combinedLti.includes('scope-jwt'), 'supports scope-jwt token kind').toBe(true);
    expect(combinedLti.includes('opaque-bearer'), 'supports opaque-bearer token kind').toBe(true);
    expect(combinedLti.includes('endpointsOnIssuerOrigin'), 'exposes endpointsOnIssuerOrigin on registration view').toBe(
      true,
    );
    expect(combinedLti.includes('bindingRef'), 'handles bindingRef on complete for staged DR').toBe(true);
    expect(combinedLti.includes('grantedScopes'), 'stores grantedScopes from registration response scope').toBe(true);
    expect(combinedLti.includes('authorization_server'), 'reads authorization_server for clientAssertionAud').toBe(
      true,
    );

    // 4. TOOL_MAY_EXIST channel text key (BD-A1-87)
    expect(
      moodleManifestSrc.includes('TOOL_MAY_EXIST'),
      'Moodle manifest defines texts.registration.TOOL_MAY_EXIST (BD-A1-87)',
    ).toBe(true);
    expect(
      combinedLti.includes('TOOL_MAY_EXIST'),
      'LTI registration complete uses texts.registration.TOOL_MAY_EXIST (BD-A1-87)',
    ).toBe(true);

    // 5. Profile identity on both update paths (BD-A1-88): REGISTRATION_UPDATE_NOT_ALLOWED with reason profile_mismatch
    expect(
      combinedLti.includes('profile_mismatch'),
      'enforces profile identity with reason profile_mismatch (BD-A1-88)',
    ).toBe(true);
    expect(
      combinedLti.includes('REGISTRATION_UPDATE_NOT_ALLOWED'),
      'refuses cross-profile update/duplicate with REGISTRATION_UPDATE_NOT_ALLOWED (BD-A1-88)',
    ).toBe(true);

    // 6. Credentials written as one set without COALESCE on client_assertion_aud (BD-A1-89)
    expect(
      /COALESCE\s*\(\s*[^)]*client_assertion_aud/i.test(storePlatSrc),
      'store/platforms.ts does not keep stale client_assertion_aud with COALESCE (BD-A1-89)',
    ).toBe(false);

    // 7. Two-phase familyGuardVerdict switch in registration route ('registration') and launch check 14 ('launch') (BD-A1-43, BD-A1-54, BD-A1-55)
    expect(
      routeSrc.includes('familyGuardVerdict') || regSrc.includes('familyGuardVerdict'),
      'DR capability check calls familyGuardVerdict',
    ).toBe(true);
    expect(
      checksSrc.includes('familyGuardVerdict'),
      'services/lti-service/src/lti/checks.ts calls familyGuardVerdict for check 14',
    ).toBe(true);

    // 8. DR help keys ISSUER_MISMATCH and INVALID_OPENID_CONFIGURATION (BD-A1-59, BD-A1-68)
    expect(
      moodleManifestSrc.includes('ISSUER_MISMATCH') && moodleManifestSrc.includes('INVALID_OPENID_CONFIGURATION'),
      'Moodle manifest defines ISSUER_MISMATCH and INVALID_OPENID_CONFIGURATION registration help texts (BD-A1-68)',
    ).toBe(true);
  });

  it('F1 (lms-names) and F5 (rules) checks pass on LA-E2-02 core files and migration 021', () => {
    const mig = findTokenKindMigration();
    expect(Boolean(mig), 'LTI migration 021 must exist').toBe(true);

    const coreTargets = [
      'services/lti-service/src/lti/registration.ts',
      'services/lti-service/src/lti/checks.ts',
      'services/lti-service/src/http/routes/registration.ts',
      'services/lti-service/src/store/registrations.ts',
      'services/lti-service/src/store/platforms.ts',
      'services/lti-service/src/lti/platform-rules.ts',
      'services/lti-service/src/lti/codes.ts',
      'packages/channel-kernel/src/profiles.ts',
      mig!.relPath,
    ];

    for (const relPath of coreTargets) {
      expect(isF1Core(relPath), `${relPath} is an F1 core path`).toBe(true);
      const src = readRepoFile(relPath);
      const f1 = checkF1OnText(relPath, src);
      expect(f1.code, `${relPath} passes F1 check; output:\n${f1.output}`).toBe(0);
      expect(f1.rawHits, `${relPath} must have 0 F1 hits`).toEqual([]);

      const f5 = checkF5OnText(relPath, src);
      expect(f5.code, `${relPath} passes F5 check; output:\n${f5.output}`).toBe(0);
    }
  });

  it('AC-LA-E2-02-01 + BD-A1-87, BD-A1-88, BD-A1-89, BD-A1-93 (LA-IC-21), BD-A2-84 (UNIT): rule table per profile (D5 items 1-8, 10), migration 021 token_kind CHECK, TOOL_MAY_EXIST, profile identity, credential-set replacement, stored active preserved on DR update, and reserved-host audience on staged DR unit tests pass', () => {
    const mig = findTokenKindMigration();
    expect(Boolean(mig), 'LTI migration 021 must exist before running unit suite').toBe(true);

    fs.rmSync(path.join(TARGET_ROOT, 'node_modules/.vitest-cache'), { recursive: true, force: true });
    fs.rmSync(path.join(TARGET_ROOT, 'node_modules/.vite'), { recursive: true, force: true });
    const unitRes = spawnSync(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/lti-service/src/lti',
        'services/lti-service/src/http',
        'services/lti-service/src/store',
        'services/lti-service/src/db',
        'services/lti-service/src/profiles',
        'packages/channel-kernel/src',
      ],
      {
        cwd: TARGET_ROOT,
        env: plainEnv(),
        encoding: 'utf8',
        timeout: 120_000,
      },
    );
    const unitOutput = `${unitRes.stdout ?? ''}${unitRes.stderr ?? ''}`;
    expect(unitRes.status, `LA-E2-02 unit & migration tests exit 0; output:\n${unitOutput}`).toBe(0);
  });
});
