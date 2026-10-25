// LA-E3-01 K0 / host-only suite (no Docker).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-01.md (AC-LA-E3-01-01 .. AC-LA-E3-01-09 UNIT, exclusive file rules)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D1 rules 1-4, 9
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §2.1
// - docs/architecture/ltiaas/security-delta.md §2, §5
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

function findStateStorageMigration(): { relPath: string; content: string } | null {
  const migDir = path.join(TARGET_ROOT, 'services/lti-service/src/db/migrations');
  if (!fs.existsSync(migDir)) return null;
  const files = fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    const relPath = `services/lti-service/src/db/migrations/${f}`;
    const content = fs.readFileSync(path.join(migDir, f), 'utf8');
    if (content.includes('storage_target') && content.includes('storage_origin')) {
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

describe('LA-E3-01 K0: Platform storage login page and state columns', () => {
  it('AC-LA-E3-01-03 .. AC-LA-E3-01-07 (static check): storage-pages.ts implements rule 3 CSP, JSON escaping, cog_state_<d> and lti.put_data', () => {
    const pageSrc = readRepoFile('services/lti-service/src/lti/storage-pages.ts');

    // Rule 3 CSP: default-src 'none'; script-src 'nonce-...'; frame-ancestors https:; form-action 'none'; base-uri 'none'
    expect(pageSrc.includes("default-src 'none'"), "storage-pages.ts sets default-src 'none'").toBe(true);
    expect(pageSrc.includes("script-src 'nonce-"), "storage-pages.ts sets script-src 'nonce-'").toBe(true);
    expect(pageSrc.includes('frame-ancestors https:'), 'storage-pages.ts sets frame-ancestors https:').toBe(true);
    expect(pageSrc.includes("form-action 'none'"), "storage-pages.ts sets form-action 'none'").toBe(true);
    expect(pageSrc.includes("base-uri 'none'"), "storage-pages.ts sets base-uri 'none'").toBe(true);

    // Rule 3 & AC-LA-E3-01-06: <script type="application/json"> with \u003c, \u003e, \u0026, \u2028, \u2029 escapes
    expect(pageSrc.includes('application/json'), 'storage-pages.ts uses application/json script block').toBe(true);
    expect(
      /\\u003c|toString\(16\)|padStart\(4/i.test(pageSrc),
      'storage-pages.ts escapes <, >, &, U+2028, U+2029 as unicode escapes',
    ).toBe(true);

    // BD-A2-41 static login page body text and noscript fallback (added in Round 2 with profiles/storage.ts)
    if (fs.existsSync(path.join(TARGET_ROOT, 'services/lti-service/src/profiles/storage.ts'))) {
      expect(
        pageSrc.includes('Opening the activity. Please wait.'),
        'storage-pages.ts includes BD-A2-41 static login status text',
      ).toBe(true);
      expect(
        pageSrc.includes('This activity needs JavaScript.'),
        'storage-pages.ts includes BD-A2-41 noscript fallback text',
      ).toBe(true);
    }

    // Rule 3, 9 & AC-LA-E3-01-07: lti.put_data, lti.put_data.response, cog_state_, 1500 ms wait
    expect(pageSrc.includes('lti.put_data'), 'storage-pages.ts sends lti.put_data').toBe(true);
    expect(pageSrc.includes('lti.put_data.response'), 'storage-pages.ts waits for lti.put_data.response').toBe(true);
    expect(pageSrc.includes('cog_state_'), 'storage-pages.ts writes key cog_state_<d>').toBe(true);
    expect(/1500|1_500/.test(pageSrc), 'storage-pages.ts waits up to 1500 ms').toBe(true);
  });

  it('AC-LA-E3-01-01 .. AC-LA-E3-01-05, AC-LA-E3-01-08, AC-LA-E3-01-09 (static check): login.ts, profiles/storage.ts, states.ts and migration add storage_target and storage_origin', () => {
    const loginSrc = readRepoFile('services/lti-service/src/lti/login.ts');
    const protocolSrc = readRepoFile('services/lti-service/src/http/routes/protocol.ts');
    const schemaSrc = readRepoFile('services/lti-service/src/profiles/schema.ts');
    const storageHelperAbs = path.join(TARGET_ROOT, 'services/lti-service/src/profiles/storage.ts');
    const storageHelperSrc = fs.existsSync(storageHelperAbs) ? fs.readFileSync(storageHelperAbs, 'utf8') : '';
    const statesSrc = readRepoFile('services/lti-service/src/store/states.ts');
    const combinedLoginAndStorage = `${loginSrc}\n${protocolSrc}\n${schemaSrc}\n${storageHelperSrc}`;

    // login.ts / profiles/storage.ts reads lti_storage_target, platformStorage and _parent
    expect(
      combinedLoginAndStorage.includes('lti_storage_target'),
      'login.ts / profiles/storage.ts reads lti_storage_target',
    ).toBe(true);
    expect(
      combinedLoginAndStorage.includes('platformStorage'),
      'login.ts / profiles/schema.ts reads platformStorage trait',
    ).toBe(true);
    expect(
      combinedLoginAndStorage.includes('_parent') ||
        readRepoFile('services/lti-service/src/lti/storage-pages.ts').includes('_parent'),
      'validates _parent target',
    ).toBe(true);

    // states.ts writes storage_target and storage_origin into oidc_state
    expect(statesSrc.includes('storage_target'), 'states.ts stores storage_target').toBe(true);
    expect(statesSrc.includes('storage_origin'), 'states.ts stores storage_origin').toBe(true);

    // Migration adds storage_target and storage_origin to oidc_state
    const mig = findStateStorageMigration();
    expect(
      mig,
      'Expected an LTI migration in services/lti-service/src/db/migrations/*.sql adding storage_target and storage_origin to oidc_state',
    ).not.toBeNull();
    expect(/oidc_state/i.test(mig!.content), 'migration alters oidc_state').toBe(true);
    expect(/storage_target/i.test(mig!.content), 'migration adds storage_target').toBe(true);
    expect(/storage_origin/i.test(mig!.content), 'migration adds storage_origin').toBe(true);
  });

  it('Profile registry contract check: standard profile keeps platformStorage: null in LA-E3-01', async () => {
    const profilesModUrl = pathToFileURL(
      path.join(TARGET_ROOT, 'services/lti-service/src/profiles/index.ts'),
    ).href;
    const profilesMod = (await import(profilesModUrl)) as {
      profileDefinition: (
        id: string,
        opts?: { simulation?: boolean },
      ) => { id: string; platformStorage: unknown } | undefined;
      listProfiles: (opts?: { simulation?: boolean }) => Array<{ id: string }>;
    };

    const standard = profilesMod.profileDefinition('standard', { simulation: true });
    expect(standard).toBeDefined();
    expect(standard?.platformStorage).toBeNull();

    // Design note of LA-E3-01: until LA-E3-02 lands, no baseline profile has a non-null trait (and standard is always null).
    for (const entry of profilesMod.listProfiles({ simulation: true })) {
      const def = profilesMod.profileDefinition(entry.id, { simulation: true });
      if (entry.id === 'standard' || entry.id === 'blackboard' || entry.id === 'blackboard-sim') {
        expect(def?.platformStorage, `${entry.id} platformStorage must be null`).toBeNull();
      }
    }
  });

  it('F1 (lms-names) and F5 (sql-portability) checks pass on LA-E3-01 files', () => {
    const mig = findStateStorageMigration();
    expect(mig, 'state storage migration must exist').not.toBeNull();

    const f1Targets = [
      'services/lti-service/src/lti/storage-pages.ts',
      'services/lti-service/src/lti/login.ts',
      'services/lti-service/src/store/states.ts',
      mig!.relPath,
    ];

    for (const relPath of f1Targets) {
      expect(isF1Core(relPath), `${relPath} is an F1 core path`).toBe(true);
      const src = readRepoFile(relPath);
      const f1 = checkF1OnText(relPath, src);
      expect(f1.code, `${relPath} passes F1 check; output:\n${f1.output}`).toBe(0);
      expect(f1.rawHits, `${relPath} must have 0 F1 hits`).toEqual([]);
    }

    for (const relPath of ['services/lti-service/src/store/states.ts', mig!.relPath]) {
      const src = readRepoFile(relPath);
      const f5 = checkF5OnText(relPath, src);
      expect(f5.code, `${relPath} passes F5 check; output:\n${f5.output}`).toBe(0);
    }
  });

  it('AC-LA-E3-01-01 .. AC-LA-E3-01-09 (UNIT): Author unit and migration tests in services/lti-service pass', () => {
    const unitRes = spawnSync(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/lti-service/src/lti',
        'services/lti-service/src/store',
        'services/lti-service/src/db',
      ],
      {
        cwd: TARGET_ROOT,
        env: plainEnv(),
        encoding: 'utf8',
        timeout: 90_000,
      },
    );
    const unitOutput = `${unitRes.stdout ?? ''}${unitRes.stderr ?? ''}`;
    expect(unitRes.status, `lti, store & db unit tests exit 0; output:\n${unitOutput}`).toBe(0);
  });
});
