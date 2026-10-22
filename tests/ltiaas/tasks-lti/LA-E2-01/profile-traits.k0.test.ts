// LA-E2-01 K0 / host-only suite (no Docker).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E2-01.md (AC-LA-E2-01-01 K0; AC-LA-E2-01-02, 04, 05, 06, 07, 09 UNIT)
// - docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md D2, D2a
// - docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md D4 load check 7
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §4.6.1, §4.7
// - docs/architecture/ltiaas/data-model.md §4 (platform.client_assertion_aud, platform.granted_scopes)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

function findPlatformE2Migration(): { relPath: string; content: string } | null {
  const migDir = path.join(TARGET_ROOT, 'services/lti-service/src/db/migrations');
  if (!fs.existsSync(migDir)) return null;
  const files = fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    const relPath = `services/lti-service/src/db/migrations/${f}`;
    const content = fs.readFileSync(path.join(migDir, f), 'utf8');
    if (content.includes('client_assertion_aud') && content.includes('granted_scopes')) {
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

interface E2ProfileDef {
  id: string;
  endpoints?: string;
  issuerKind?: string;
  endpointOrigins?: string | null;
  clientAssertionAud?: { value: string; form: string };
  assertionDeploymentId?: boolean;
  dynamicRegistration?: {
    issuerRule: string;
    configurationPath?: string;
    registrationToken: string;
  } | null;
}

describe('LA-E2-01 K0: E2-K profile traits, I-SELF and admin-value platform rules', () => {
  it('AC-LA-E2-01-01 (K0): every baseline profile has the D2 trait values', async () => {
    const profilesModUrl = pathToFileURL(
      path.join(TARGET_ROOT, 'services/lti-service/src/profiles/index.ts'),
    ).href;
    const profilesMod = (await import(profilesModUrl)) as {
      profileDefinition: (id: string, opts?: { simulation?: boolean }) => E2ProfileDef | undefined;
      listProfiles: (opts?: { simulation?: boolean }) => Array<{
        id: string;
        endpoints?: string;
        issuerKind?: string;
        endpointOrigins?: string | null;
      }>;
    };

    // 1. standard (Moodle)
    const standard = profilesMod.profileDefinition('standard', { simulation: true });
    expect(standard, 'standard profile exists').toBeDefined();
    expect(standard?.endpoints).toBe('admin');
    expect(standard?.issuerKind).toBe('per-tenant');
    expect(standard?.endpointOrigins).toBe('issuer');
    expect(standard?.clientAssertionAud).toEqual({ value: '{tokenEndpoint}', form: 'string' });
    expect(standard?.assertionDeploymentId).toBe(false);
    expect(standard?.dynamicRegistration).toEqual({
      issuerRule: 'path-prefix',
      configurationPath: '/mod/lti/openid-configuration.php',
      registrationToken: 'moodle-scope-jwt',
    });

    // 2. Canvas cloud profiles + canvas-sim-cloud
    const canvasFixedIds = [
      'canvas-cloud-production',
      'canvas-cloud-beta',
      'canvas-cloud-test',
      'canvas-sim-cloud',
    ];
    for (const id of canvasFixedIds) {
      const def = profilesMod.profileDefinition(id, { simulation: true });
      expect(def, `${id} profile exists`).toBeDefined();
      expect(def?.endpoints, `${id}.endpoints`).toBe('fixed');
      expect(def?.issuerKind, `${id}.issuerKind`).toBe('fixed');
      expect(def?.endpointOrigins ?? null, `${id}.endpointOrigins`).toBeNull();
      expect(def?.clientAssertionAud, `${id}.clientAssertionAud`).toEqual({
        value: '{tokenEndpoint}',
        form: 'string',
      });
      expect(def?.assertionDeploymentId, `${id}.assertionDeploymentId`).toBe(false);
    }

    // 3. canvas-self-hosted
    const canvasSelfHosted = profilesMod.profileDefinition('canvas-self-hosted', { simulation: true });
    expect(canvasSelfHosted, 'canvas-self-hosted profile exists').toBeDefined();
    expect(canvasSelfHosted?.endpoints).toBe('fixed');
    expect(canvasSelfHosted?.issuerKind).toBe('per-tenant');
    expect(canvasSelfHosted?.endpointOrigins ?? null).toBeNull();
    expect(canvasSelfHosted?.clientAssertionAud).toEqual({
      value: '{tokenEndpoint}',
      form: 'string',
    });
    expect(canvasSelfHosted?.assertionDeploymentId).toBe(false);

    // 4. Blackboard + blackboard-sim
    for (const id of ['blackboard', 'blackboard-sim']) {
      const def = profilesMod.profileDefinition(id, { simulation: true });
      expect(def, `${id} profile exists`).toBeDefined();
      expect(def?.endpoints, `${id}.endpoints`).toBe('fixed');
      expect(def?.issuerKind, `${id}.issuerKind`).toBe('fixed');
      expect(def?.endpointOrigins ?? null, `${id}.endpointOrigins`).toBeNull();
      expect(def?.clientAssertionAud, `${id}.clientAssertionAud`).toEqual({
        value: '{tokenEndpoint}',
        form: 'array',
      });
      expect(def?.assertionDeploymentId, `${id}.assertionDeploymentId`).toBe(false);
    }
  });

  it('Static check: platform-rules.ts, token-client.ts, platforms route/store and E2 migration implement I-SELF and traits without profile-id branches', () => {
    const rulesSrc = readRepoFile('services/lti-service/src/lti/platform-rules.ts');
    const tokenClientSrc = readRepoFile('services/lti-service/src/platform/token-client.ts');
    const platformsRouteSrc = readRepoFile('services/lti-service/src/http/routes/platforms.ts');
    const platformsStoreSrc = readRepoFile('services/lti-service/src/store/platforms.ts');

    // platform-rules.ts uses endpointOrigins trait ('issuer' | 'any-https') and checks I-SELF
    expect(rulesSrc.includes('endpointOrigins'), 'platform-rules.ts reads endpointOrigins trait').toBe(true);
    expect(rulesSrc.includes('any-https'), 'platform-rules.ts handles any-https trait').toBe(true);
    expect(
      rulesSrc.includes('PLATFORM_URL_NOT_ON_ISSUER_ORIGIN'),
      'platform-rules.ts enforces PLATFORM_URL_NOT_ON_ISSUER_ORIGIN (I-SELF)',
    ).toBe(true);
    expect(
      rulesSrc.includes('PLATFORM_URL_NOT_IN_PROFILE'),
      'platform-rules.ts refuses fixed/issuer hosts of loaded profiles with PLATFORM_URL_NOT_IN_PROFILE',
    ).toBe(true);

    // token-client.ts uses clientAssertionAud, assertionDeploymentId, and grantedScopes
    expect(
      tokenClientSrc.includes('clientAssertionAud'),
      'token-client.ts reads clientAssertionAud',
    ).toBe(true);
    expect(
      tokenClientSrc.includes('assertionDeploymentId') || tokenClientSrc.includes('deployment_id'),
      'token-client.ts supports optional deployment_id assertion claim',
    ).toBe(true);
    expect(
      tokenClientSrc.includes('grantedScopes') || tokenClientSrc.includes('granted_scopes'),
      'token-client.ts filters requested scopes by grantedScopes when set',
    ).toBe(true);

    // platforms route and store support clientAssertionAud and grantedScopes
    expect(
      platformsRouteSrc.includes('clientAssertionAud') || platformsStoreSrc.includes('clientAssertionAud'),
      'platforms route/store handles clientAssertionAud',
    ).toBe(true);
    expect(
      platformsRouteSrc.includes('grantedScopes') || platformsStoreSrc.includes('grantedScopes'),
      'platforms route/store handles grantedScopes',
    ).toBe(true);

    // E2 LTI migration adds client_assertion_aud and granted_scopes to platform
    const mig = findPlatformE2Migration();
    expect(Boolean(mig), 'LTI migration adding client_assertion_aud and granted_scopes must exist').toBe(
      true,
    );
    expect(/ALTER\s+TABLE\s+platform/i.test(mig!.content), 'migration alters platform table').toBe(true);
    expect(mig!.content.includes('client_assertion_aud'), 'migration adds client_assertion_aud').toBe(
      true,
    );
    expect(mig!.content.includes('granted_scopes'), 'migration adds granted_scopes').toBe(true);
  });

  it('F1 (lms-names) and F5 (rules) checks pass on LA-E2-01 core files', () => {
    const mig = findPlatformE2Migration();
    expect(Boolean(mig), 'E2 platform migration must exist').toBe(true);

    const coreTargets = [
      'services/lti-service/src/lti/platform-rules.ts',
      'services/lti-service/src/http/routes/platforms.ts',
      'services/lti-service/src/http/validation.ts',
      'services/lti-service/src/store/platforms.ts',
      'services/lti-service/src/platform/token-client.ts',
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

  it('AC-LA-E2-01-02, 04, 05, 06, 07, 09 (UNIT): load check 7, I-SELF active/staged rules, refused hosts, clientAssertionAud/deployment_id, granted_scopes and migration unit tests pass', () => {
    const mig = findPlatformE2Migration();
    expect(Boolean(mig), 'E2 platform migration must exist before running unit suite').toBe(true);

    const unitRes = spawnSync(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/lti-service/src/profiles',
        'services/lti-service/src/lti',
        'services/lti-service/src/platform',
        'services/lti-service/src/http',
        'services/lti-service/src/store',
        'services/lti-service/src/db',
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
    expect(unitRes.status, `LA-E2-01 unit & migration tests exit 0; output:\n${unitOutput}`).toBe(0);
  });
});
