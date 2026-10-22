// LA-E3-02 K0 / host-only suite (no Docker).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-02.md (AC-LA-E3-02-04 UNIT, Rule 1a Canvas trait values, exclusive file rules)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D1 rules 1a, 5-11
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §1.5, §2.2, §6, §7
// - docs/architecture/ltiaas/security-delta.md §2.2, §5, §6, §11
// - docs/architecture/ltiaas/build-decisions-A1.md BD-A1-33, BD-A1-34
// Boolean assertions only; never prints product source.
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

const CANVAS_PROFILE_IDS = [
  'canvas-cloud-production',
  'canvas-cloud-beta',
  'canvas-cloud-test',
  'canvas-self-hosted',
  'canvas-sim-cloud',
] as const;

const RULE_8_STORAGE_HELP_TEXT =
  'Your browser blocked the Cogniate sign-in in this frame. Open the activity in a new window, or allow cookies for this site.';

function readRepoFile(relPath: string): string {
  const abs = path.join(TARGET_ROOT, relPath);
  expect(fs.existsSync(abs), `Expected file to exist: ${relPath}`).toBe(true);
  return fs.readFileSync(abs, 'utf8');
}

function findStorageCheckMigration(): { relPath: string; content: string } | null {
  const migDir = path.join(TARGET_ROOT, 'services/lti-service/src/db/migrations');
  if (!fs.existsSync(migDir)) return null;
  const files = fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    const relPath = `services/lti-service/src/db/migrations/${f}`;
    const content = fs.readFileSync(path.join(migDir, f), 'utf8');
    if (/CREATE\s+TABLE\b[^;]*\bstorage_check\b/i.test(content)) {
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

describe('LA-E3-02 K0: Platform storage check and Canvas trait values', () => {
  it('Rule 1a: every Canvas profile (including canvas-sim-cloud) has platformStorage { targetFrame: "from-login", origin: "authOrigin" }; standard and Blackboard stay null', async () => {
    const profilesModUrl = pathToFileURL(
      path.join(TARGET_ROOT, 'services/lti-service/src/profiles/index.ts'),
    ).href;
    const profilesMod = (await import(profilesModUrl)) as {
      profileDefinition: (
        id: string,
        opts?: { simulation?: boolean },
      ) => { id: string; platformStorage: unknown } | undefined;
    };

    for (const id of CANVAS_PROFILE_IDS) {
      const def = profilesMod.profileDefinition(id, { simulation: true });
      expect(Boolean(def), `${id} is loaded in the profile registry`).toBe(true);
      expect(
        def?.platformStorage,
        `${id}.platformStorage equals { targetFrame: 'from-login', origin: 'authOrigin' }`,
      ).toEqual({
        targetFrame: 'from-login',
        origin: 'authOrigin',
      });
    }

    for (const id of ['standard', 'blackboard', 'blackboard-sim'] as const) {
      const def = profilesMod.profileDefinition(id, { simulation: true });
      expect(Boolean(def), `${id} is loaded in the profile registry`).toBe(true);
      expect(def?.platformStorage, `${id}.platformStorage stays null`).toBeNull();
    }
  });

  it('Rules 7-9 (static check): storage-pages.ts implements storage-check page with form-action \'self\', Referrer-Policy: same-origin, lti.get_data, and hidden form post', () => {
    const pageSrc = readRepoFile('services/lti-service/src/lti/storage-pages.ts');

    expect(pageSrc.includes("form-action 'self'"), "storage-pages.ts sets form-action 'self' on storage-check page").toBe(
      true,
    );
    expect(pageSrc.includes('same-origin'), 'storage-pages.ts sets Referrer-Policy: same-origin on storage-check page').toBe(
      true,
    );
    expect(pageSrc.includes('lti.get_data'), 'storage-pages.ts sends lti.get_data').toBe(true);
    expect(pageSrc.includes('lti.get_data.response'), 'storage-pages.ts listens for lti.get_data.response').toBe(true);
    expect(/name=["']check["']/i.test(pageSrc) || pageSrc.includes('check'), 'storage-pages.ts posts check field').toBe(
      true,
    );
    expect(/name=["']value["']/i.test(pageSrc) || pageSrc.includes('value'), 'storage-pages.ts posts value field').toBe(
      true,
    );
    expect(pageSrc.includes('storage-check'), 'storage-pages.ts targets /storage-check route').toBe(true);
  });

  it('Rules 7, 8 & 11 (static check): store/storage-checks.ts, launch.ts, protocol.ts and the storage_check migration implement storage check and retention', () => {
    const storeSrc = readRepoFile('services/lti-service/src/store/storage-checks.ts');
    const launchSrc = readRepoFile('services/lti-service/src/lti/launch.ts');
    const protocolSrc = readRepoFile('services/lti-service/src/http/routes/protocol.ts');

    // store/storage-checks.ts has storage_check SQL and 10-minute retention cleanup
    expect(storeSrc.includes('storage_check'), 'store/storage-checks.ts queries storage_check table').toBe(true);
    expect(storeSrc.includes('used_at'), 'store/storage-checks.ts marks used_at').toBe(true);
    expect(storeSrc.includes('expires_at'), 'store/storage-checks.ts checks expires_at').toBe(true);

    // launch.ts and protocol.ts wire storage-check route, details, help text and log bindings
    expect(protocolSrc.includes('storage-check'), 'protocol.ts mounts /lti/launch/:account/storage-check').toBe(true);
    expect(
      protocolSrc.includes('Allow') || launchSrc.includes('Allow'),
      'protocol.ts / launch.ts sets Allow: POST on non-POST storage-check requests',
    ).toBe(true);
    const combinedSrc = `${launchSrc}\n${protocolSrc}`;
    expect(combinedSrc.includes('storage_origin'), 'handles storage_origin detail on Origin mismatch').toBe(true);
    expect(
      combinedSrc.includes('storage_check_unknown_used_or_expired'),
      'logs/returns storage_check_unknown_used_or_expired detail',
    ).toBe(true);
    expect(combinedSrc.includes('storage_mismatch'), 'logs/returns storage_mismatch detail').toBe(true);
    expect(
      combinedSrc.includes(RULE_8_STORAGE_HELP_TEXT) || readRepoFile('services/lti-service/src/lti/codes.ts').includes(RULE_8_STORAGE_HELP_TEXT),
      'includes rule 8 empty-value STATE_COOKIE_MISSING storage help text',
    ).toBe(true);
    expect(combinedSrc.includes('binding'), 'logs launch_accepted with binding cookie | storage').toBe(true);

    // Migration creates storage_check table
    const mig = findStorageCheckMigration();
    expect(
      Boolean(mig),
      'Expected an LTI migration in services/lti-service/src/db/migrations/*.sql creating storage_check',
    ).toBe(true);
    expect(/check_hash/i.test(mig!.content), 'storage_check migration defines check_hash').toBe(true);
    expect(/tool_account_id/i.test(mig!.content), 'storage_check migration defines tool_account_id').toBe(true);
    expect(/state_hash/i.test(mig!.content), 'storage_check migration defines state_hash').toBe(true);
    expect(/expires_at/i.test(mig!.content), 'storage_check migration defines expires_at').toBe(true);
    expect(/used_at/i.test(mig!.content), 'storage_check migration defines used_at').toBe(true);
  });

  it('F1 (lms-names) and F5 (rules) checks pass on LA-E3-02 core files', () => {
    const mig = findStorageCheckMigration();
    expect(Boolean(mig), 'storage_check migration must exist').toBe(true);

    const coreTargets = [
      'services/lti-service/src/lti/launch.ts',
      'services/lti-service/src/http/routes/protocol.ts',
      'services/lti-service/src/lti/storage-pages.ts',
      'services/lti-service/src/store/storage-checks.ts',
      mig!.relPath,
    ];

    for (const relPath of coreTargets) {
      expect(isF1Core(relPath), `${relPath} is an F1 core path`).toBe(true);
      const src = readRepoFile(relPath);
      const f1 = checkF1OnText(relPath, src);
      expect(f1.code, `${relPath} passes F1 check`).toBe(0);
      expect(f1.rawHits, `${relPath} must have 0 F1 hits`).toEqual([]);

      const f5 = checkF5OnText(relPath, src);
      expect(f5.code, `${relPath} passes F5 check`).toBe(0);
    }
  });

  it('AC-LA-E3-02-04 (UNIT): controlled-clock 120 s expiry and 10-minute storage_check cleanup unit tests pass', () => {
    // Fail closed if store/storage-checks.ts has not landed yet.
    expect(
      fs.existsSync(path.join(TARGET_ROOT, 'services/lti-service/src/store/storage-checks.ts')),
      'services/lti-service/src/store/storage-checks.ts exists',
    ).toBe(true);

    const unitRes = spawnSync(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/lti-service/src/store',
        'services/lti-service/src/lti',
        'services/lti-service/src/http/routes',
      ],
      {
        cwd: TARGET_ROOT,
        env: plainEnv(),
        encoding: 'utf8',
        timeout: 90_000,
      },
    );
    expect(unitRes.status, 'services/lti-service store, lti & routes unit tests exit 0').toBe(0);
  });
});
