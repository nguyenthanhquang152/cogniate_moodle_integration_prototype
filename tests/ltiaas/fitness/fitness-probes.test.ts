// LA-E7-04 K0 verification of the architecture fitness checks F1, F2, F3 and F5.
// Source: docs/architecture/ltiaas/tasks/LA-E7-04.md (AC-LA-E7-04-01 to -07);
// docs/architecture/ltiaas/README.md §4; tests/ltiaas/TEST-STRATEGY.md §3.1–§3.6;
// BD-A1-07, BD-A1-09, BD-A1-15, BD-A1-16, BD-A1-18, BD-A1-19, BD-A1-21; BD-A2-11, BD-A2-13, BD-A2-22, BD-A2-40, BD-A2-46.
// QA writes no second scanner: this suite invokes the Author's fitness scripts and ESLint with probes.
// Scratch files (QA form (k)) run only inside a dedicated standalone clone (checked by assertDedicatedScratchClone)
// and are removed in finally blocks.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT,
  artifact,
  channelDiff,
  f1Hits,
  f1Text,
  f5Text,
  git,
  npmCheck,
  removeScratchDir,
  requireRunDir,
  requireScratchClone,
  run,
  scratch,
  scriptEchoes,
  type RunResult,
} from '../tasks-core/LA-E1-04/fitness';

// ---------------------------------------------------------------------------
// Tool output contract (B-LA-E7-04-03): update here if a fitness tool's output wording changes.
// ---------------------------------------------------------------------------
const TOOL_OUTPUT_CONTRACT = {
  f1PassSummary: /F1 PASS: \d+ files with hits, \d+ hits/,
  f5PassSummary: /F5 PASS: \d+ rules \([^)]+\), 0 hits/,
  f1RatchetRaise: (filePath: string, nextCount: number, baseCount: number) =>
    `${filePath}: count ${nextCount}, baseline ${baseCount}, delta +1`,
  f1RatchetLower: (filePath: string, baseCount: number) =>
    `${filePath}: count 0, baseline ${baseCount}, delta -${baseCount}`,
  f1RatchetLowerHint: (filePath: string) =>
    `lower f1-baseline.json for ${filePath} to 0`,
  f5SqlPortability: {
    pragma: /sql-portability.*PRAGMA/i,
    insertOrReplace: /sql-portability.*INSERT OR REPLACE/i,
    updateOrIgnore: /sql-portability.*UPDATE OR REPLACE\/IGNORE/i,
    replaceInto: /sql-portability.*REPLACE INTO/i,
    autoincrement: /sql-portability.*AUTOINCREMENT/i,
    withoutRowid: /sql-portability.*WITHOUT ROWID/i,
    strictTable: /sql-portability.*STRICT table/i,
    virtualTable: /sql-portability.*CREATE VIRTUAL TABLE/i,
    attachDatabase: /sql-portability.*ATTACH\/DETACH DATABASE/i,
    blobLiteral: /sql-portability.*blob-literal/i,
    dateFunction: /sql-portability.*date-function/i,
    randomblob: /sql-portability.*randomblob/i,
    rowid: /sql-portability.*rowid/i,
  },
  f5ConnectionLms: /connection-lms.*Do not name connection\.lms/i,
  f5AuditEventDelete: /audit-event-delete/i,
  f5ChannelSqlTables: 'channel-sql-tables',
  f5NoScoreSync: 'no-score-sync',
} as const;

export const SCRATCH_CLONE_MARKER_REL = path.join('.git', 'la-qa-scratch-clone');
const WORKSPACE_PATH_RE = /\/orca\/workspaces\b|\/workspaces\/cogniate_moodle_integration_prototype\b/;

function gitIn(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/**
 * Safety guard (A-LA-E7-04-01): refuses to run mutating probes inside any LA workspace path,
 * any linked git worktree (.git file, git-dir != git-common-dir, or >1 entry in `git worktree list`),
 * or any clone without `.git/la-qa-scratch-clone` matching the clone's realpath.
 */
export function assertDedicatedScratchClone(
  repoRoot: string = ROOT,
  envClone: string | undefined = process.env.LA_SCRATCH_CLONE,
): string {
  const resolvedRoot = path.resolve(repoRoot);
  const realRoot = fs.existsSync(resolvedRoot) ? fs.realpathSync(resolvedRoot) : resolvedRoot;
  if (WORKSPACE_PATH_RE.test(resolvedRoot) || WORKSPACE_PATH_RE.test(realRoot)) {
    throw new Error(
      `Refused scratch-clone execution inside LA workspace path "${realRoot}" (A-LA-E7-04-01). Clone into a dedicated folder outside /orca/workspaces first.`,
    );
  }
  if (!envClone) {
    throw new Error(`Set LA_SCRATCH_CLONE="${realRoot}" to run mutating fitness probes in a dedicated clone.`);
  }
  const realEnvClone = fs.existsSync(envClone) ? fs.realpathSync(path.resolve(envClone)) : path.resolve(envClone);
  if (realEnvClone !== realRoot) {
    throw new Error(`LA_SCRATCH_CLONE ("${realEnvClone}") does not match repository root ("${realRoot}").`);
  }
  const dotGitPath = path.join(realRoot, '.git');
  if (!fs.existsSync(dotGitPath) || !fs.lstatSync(dotGitPath).isDirectory()) {
    throw new Error(
      `Refused scratch-clone execution at "${realRoot}": .git is not a directory (linked git worktrees are forbidden, A-LA-E7-04-01).`,
    );
  }
  const gitDir = path.resolve(realRoot, gitIn(realRoot, ['rev-parse', '--git-dir']));
  const gitCommonDir = path.resolve(realRoot, gitIn(realRoot, ['rev-parse', '--git-common-dir']));
  if (fs.realpathSync(gitDir) !== fs.realpathSync(gitCommonDir)) {
    throw new Error(
      `Refused scratch-clone execution at "${realRoot}": git-dir ("${gitDir}") !== git-common-dir ("${gitCommonDir}") (linked worktree, A-LA-E7-04-01).`,
    );
  }
  const worktreeLines = gitIn(realRoot, ['worktree', 'list', '--porcelain'])
    .split(/\r?\n/)
    .filter((l) => l.startsWith('worktree '));
  if (worktreeLines.length !== 1) {
    throw new Error(
      `Refused scratch-clone execution at "${realRoot}": repository has ${worktreeLines.length} worktrees (${worktreeLines.join(', ')}); expected a standalone clone with 1 worktree (A-LA-E7-04-01).`,
    );
  }
  const markerFile = path.join(realRoot, SCRATCH_CLONE_MARKER_REL);
  if (!fs.existsSync(markerFile)) {
    throw new Error(
      `Refused scratch-clone execution at "${realRoot}": missing scratch clone marker "${SCRATCH_CLONE_MARKER_REL}" (write realpath of clone to ${SCRATCH_CLONE_MARKER_REL}, A-LA-E7-04-01).`,
    );
  }
  const markerValue = fs.readFileSync(markerFile, 'utf8').trim();
  const realMarkerValue = fs.existsSync(markerValue) ? fs.realpathSync(markerValue) : markerValue;
  if (realMarkerValue !== realRoot) {
    throw new Error(
      `Refused scratch-clone execution at "${realRoot}": marker "${SCRATCH_CLONE_MARKER_REL}" value ("${markerValue}") does not match clone realpath ("${realRoot}").`,
    );
  }
  if (gitIn(realRoot, ['status', '--porcelain']) !== '') {
    throw new Error(`Scratch clone at "${realRoot}" must have a clean git status before running fitness probes.`);
  }
  return realRoot;
}

const CORE_TS = 'services/cogniate-app/src/zz-qa-probe.ts';
const CORE_TSX = 'apps/portal/src/zz-qa-probe.tsx';
const KERNEL_OTHER = 'packages/channel-kernel/src/zz-qa-probe.ts';
const LEGACY_WIRE = 'packages/channel-kernel/src/legacy-wire.ts';
const MIGRATION_013 = 'services/cogniate-app/src/domain/migrations/013_channel_kernel.sql';
const NEW_APP_MIGRATION = 'services/cogniate-app/src/domain/migrations/999_zz_qa_probe.sql';
const NEW_LTI_MIGRATION = 'services/lti-service/src/db/migrations/999_zz_qa_probe.sql';
const APPLIED_APP_MIGRATION = 'services/cogniate-app/src/domain/migrations/001_init.sql';
const PROBE_CHANNEL_DIR = 'packages/channels/zz-probe';
const DYNAMIC_CHANNEL_DIR = 'packages/channels/zz-lms';

interface EslintMessage {
  ruleId: string | null;
  severity: number;
  message: string;
  line: number;
}
interface EslintResult {
  filePath: string;
  messages: EslintMessage[];
  errorCount: number;
}

const IMPORT_RULE =
  /no-restricted-(?:imports|paths|syntax|globals)|import\/no-restricted|@typescript-eslint\/no-(?:require-imports|var-requires)|^channels\//;

async function eslintText(asPath: string, text: string): Promise<EslintResult[]> {
  const r = await run(
    'npx',
    ['--no-install', 'eslint', '--no-ignore', '--stdin', '--stdin-filename', asPath, '--format', 'json'],
    { input: text },
  );
  expect(r.stdout.trim().startsWith('['), `eslint JSON for ${asPath}; output:\n${r.output}`).toBe(true);
  return JSON.parse(r.stdout) as EslintResult[];
}

function importErrors(results: EslintResult[]): EslintMessage[] {
  return results
    .flatMap((r) => r.messages)
    .filter((m) => m.severity === 2 && m.ruleId !== null && IMPORT_RULE.test(m.ruleId));
}

function hitFor(r: RunResult, asPath: string, word: string, token: RegExp) {
  return f1Hits(r.output).find((h) => h.path === asPath && h.word === word && token.test(h.token));
}

function readBaseline(): Record<string, number> {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, 'infra/scripts/fitness/f1-baseline.json'), 'utf8'),
  ) as Record<string, number>;
}

function ruleExists(ruleId: string): boolean {
  return fs.existsSync(path.join(ROOT, `infra/scripts/fitness/rules/${ruleId}.mjs`));
}

// LA-E5-06 (A2 rule forbidding '/lti/launch/' literals outside the account resolver) is pending on integration;
// until LA-E5-06 lands and pins its rule filename in infra/scripts/fitness/rules/*.mjs, discover it by rule id or token.
function findLaunchLiteralRuleId(): string | null {
  const rulesDir = path.join(ROOT, 'infra/scripts/fitness/rules');
  for (const name of fs.readdirSync(rulesDir)) {
    if (!name.endsWith('.mjs')) continue;
    const text = fs.readFileSync(path.join(rulesDir, name), 'utf8');
    if (text.includes('/lti/launch/')) return name.slice(0, -4);
  }
  return null;
}

/** Parses the `| Class | Paths |` or `| Class | Globs |` scope table from README.md §4 or TEST-STRATEGY.md §3.1 (B-LA-E7-04-02). */
function parseDocScopeTable(markdown: string): {
  channel: string[];
  core: string[];
  coreExceptionsHasLegacyWire: boolean;
  coreExceptionsHasMigrations: boolean;
  sharedBuild: string[];
  notCore: string[];
} {
  const lines = markdown.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => /^\|\s*Class\s*\|\s*(?:Paths|Globs)\s*\|/.test(l));
  expect(headerIdx, 'scope table "| Class | Paths/Globs |" exists in document').toBeGreaterThanOrEqual(0);
  const rows = new Map<string, string>();
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length >= 2) rows.set(cells[0], cells[1]);
  }
  const codeSpans = (cell: string) =>
    [...cell.replace(/\([^)]*\)/g, '').matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const primaryGlobs = (cell: string) => codeSpans(cell.split(/[.;]\s+/)[0]);
  const channelCell = [...rows.entries()].find(([k]) => /^Channel folders/i.test(k))?.[1] ?? '';
  const coreCell = [...rows.entries()].find(([k]) => /^Core$/i.test(k))?.[1] ?? '';
  const excCell = [...rows.entries()].find(([k]) => /^Allowed exceptions/i.test(k))?.[1] ?? '';
  const sharedCell = [...rows.entries()].find(([k]) => /^Shared build files/i.test(k))?.[1] ?? '';
  const notCoreCell = [...rows.entries()].find(([k]) => /^Not core$/i.test(k))?.[1] ?? '';

  return {
    channel: primaryGlobs(channelCell).map((g) => g.replace('<id>', '*')),
    core: primaryGlobs(coreCell),
    coreExceptionsHasLegacyWire: codeSpans(excCell).includes('packages/channel-kernel/src/legacy-wire.ts'),
    coreExceptionsHasMigrations: /applied SQL migrations/i.test(excCell),
    sharedBuild: primaryGlobs(sharedCell),
    notCore: primaryGlobs(notCoreCell),
  };
}

let cleanCheck: RunResult;
let headSha = '';
let runDir = '';

function writeAcEvidence(name: string, content: string): void {
  try {
    artifact(name, content);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'EEXIST') {
      throw new Error(`LA_RUN_DIR (${runDir}) already holds ${name}; use a new run folder (B-LA-E7-04-01).`);
    }
    throw err;
  }
}

beforeAll(async () => {
  assertDedicatedScratchClone();
  requireScratchClone();
  runDir = requireRunDir();
  if (fs.existsSync(runDir)) {
    const existing = fs.readdirSync(runDir).filter((f) => /^e7-04-ac\d+/.test(f));
    if (existing.length > 0) {
      throw new Error(
        `LA_RUN_DIR (${runDir}) already holds ${existing.join(', ')}; use a new run folder (B-LA-E7-04-01).`,
      );
    }
  }
  headSha = git(['rev-parse', 'HEAD']);
  cleanCheck = await npmCheck('e7-04-ac01-check-clean');
});

describe('LA-E7-04 QA verification of fitness checks F1–F5 (K0)', () => {
  it('AC-LA-E7-04-01: the clean tree passes F1, F3 and F5 inside npm run check, and the scratch-clone guard refuses workspace paths and linked worktrees', () => {
    expect(cleanCheck.code, 'npm run check on the clean clone exits 0').toBe(0);
    const steps = scriptEchoes(cleanCheck.output);
    expect(steps, 'F3 ESLint step ran').toContain('lint');
    expect(steps, 'F3 TypeScript step ran').toContain('typecheck');
    expect(steps.some((s) => /fitness:lms-names/.test(s)), 'F1 step ran').toBe(true);
    expect(steps.some((s) => /fitness:rules/.test(s)), 'F5 step ran').toBe(true);
    expect(cleanCheck.output).toMatch(TOOL_OUTPUT_CONTRACT.f1PassSummary);
    expect(cleanCheck.output).toMatch(TOOL_OUTPUT_CONTRACT.f5PassSummary);

    const baseline = readBaseline();
    const entries = Object.entries(baseline);
    expect(entries.length, 'f1-baseline.json has per-file counts').toBeGreaterThan(0);
    expect(entries.some(([, count]) => count > 0), 'f1-baseline.json has positive counts before E1 S9').toBe(true);
    for (const [p, count] of entries) {
      expect(/^(services|packages|apps)\/[^/]+\/src\//.test(p) && !p.startsWith('packages/channels/')).toBe(true);
      expect(Number.isSafeInteger(count) && count >= 0, `${p}: count ${count} >= 0`).toBe(true);
    }

    // A-LA-E7-04-01 safety checks: refuse workspace paths, mismatched marker, and a throwaway linked git worktree.
    const fakeWorkspacePath = '/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa';
    expect(() => assertDedicatedScratchClone(fakeWorkspacePath, fakeWorkspacePath)).toThrow(/Refused scratch-clone execution inside LA workspace path/);

    const linkedWtDir = path.join(runDir, 'zz-linked-wt-probe');
    git(['worktree', 'add', '--quiet', '--detach', linkedWtDir, headSha]);
    try {
      // Linked worktree is refused on the linked worktree itself (.git is a file; git-dir != git-common-dir)
      expect(() => assertDedicatedScratchClone(linkedWtDir, linkedWtDir)).toThrow(/Refused scratch-clone execution.*linked/i);
      // And while a second worktree is attached, even the main clone is refused because `git worktree list` > 1
      expect(() => assertDedicatedScratchClone(ROOT, ROOT)).toThrow(/expected a standalone clone with 1 worktree/);
    } finally {
      git(['worktree', 'remove', '--force', linkedWtDir]);
    }
    expect(assertDedicatedScratchClone(ROOT, ROOT)).toBe(fs.realpathSync(ROOT));
  });

  it('AC-LA-E7-04-02: F1 probes (§3.2, §3.5 item 2, BD-A1-07/09/15/19, N6 legacy-wire, ratchet and dynamic channel folder)', async () => {
    const log: string[] = [];
    try {
      // 1. Failing code-token probes across all checked token classes (BD-A1-07, BD-A1-09, BD-A1-15)
      const failingProbes: Array<[string, string, string, string, RegExp]> = [
        ['identifier (camelCase)', CORE_TS, 'export function createMoodleWsClient(): number {\n  return 1;\n}\n', 'moodle', /^createMoodleWsClient$/],
        ['string literal (vendor)', CORE_TS, 'export const lmsName = "canvas";\n', 'canvas', /^canvas$/],
        ['string literal (BD-A1-09 camelCase wire name)', CORE_TS, 'export const flag = "canvasConfiguration";\n', 'canvas', /^canvasConfiguration$/],
        ['string literal (BD-A1-09 screaming snake code)', CORE_TS, 'export const code = "MOODLE_TOOL_MAY_EXIST";\n', 'moodle', /^MOODLE_TOOL_MAY_EXIST$/],
        ['string literal (BD-A1-09 route path)', CORE_TS, 'export const route = "/canvas-configuration";\n', 'canvas', /^\/canvas-configuration$/],
        ['multi-part identifier (BD-A1-07 lti-generic)', CORE_TS, 'export const ltiGeneric = 1;\n', 'lti-generic', /^ltiGeneric$/],
        ['multi-part string (BD-A1-07 lti-generic)', CORE_TS, 'export const id = "lti-generic";\n', 'lti-generic', /^lti-generic$/],
        ['digit-split vendor (BD-A1-09 d2l)', CORE_TS, 'export const d2lAudience = "https://d2l.example/token";\n', 'd2l', /^d2lAudience$/],
        ['vendor name (desire2learn)', CORE_TS, 'export const family = "desire2learn";\n', 'desire2learn', /^desire2learn$/],
        ['vendor name (brightspace)', CORE_TS, 'export const bs = "brightspace";\n', 'brightspace', /^brightspace$/],
        ['template part', CORE_TS, 'export const url = (host: string): string => `https://${host}/blackboard/x`;\n', 'blackboard', /\/blackboard\/x/],
        ['JSX text', CORE_TSX, 'export const Probe = () => <p>Connect your Moodle site</p>;\n', 'moodle', /Connect your Moodle site/],
        ['JSX attribute', CORE_TSX, 'export const Probe = () => <div data-vendor="schoology" />;\n', 'schoology', /^schoology$/],
        ['import source', CORE_TS, "import client from 'moodle-client';\nexport default client;\n", 'moodle', /^moodle-client$/],
        ['new migration SQL column', NEW_APP_MIGRATION, 'ALTER TABLE connection ADD COLUMN moodle_x TEXT;\n', 'moodle', /^moodle_x$/],
        ['new migration SQL string', NEW_APP_MIGRATION, "INSERT INTO connection (lms) VALUES ('moodle');\n", 'moodle', /^'moodle'$/],
        ['regex literal plain (BD-A1-15)', CORE_TS, 'export const re = /canvas/;\n', 'canvas', /^canvas$/],
        ['regex literal with escape separator (BD-A1-15)', CORE_TS, 'export const reWord = /\\bcanvas\\b/i;\n', 'canvas', /bcanvas/i],
        ['regex literal alternation moodle (BD-A1-15)', CORE_TS, 'export const rePrefix = /^(moodle|canvas)-/;\n', 'moodle', /^\^\(moodle\|canvas\)-$/],
        ['regex literal alternation canvas (BD-A1-15)', CORE_TS, 'export const rePrefix = /^(moodle|canvas)-/;\n', 'canvas', /^\^\(moodle\|canvas\)-$/],
        ['regex literal host suffix (BD-A1-15)', CORE_TS, 'export const reHost = /\\.instructure\\.com$/i;\n', 'instructure', /instructure.*com\$$/i],
        ['regex literal sakai/totara (BD-A1-15)', CORE_TS, 'export const reOther = /sakai|totara/gi;\n', 'sakai', /^sakai\|totara$/],
      ];

      for (const [label, asPath, text, word, tokenRe] of failingProbes) {
        const r = await f1Text(asPath, text);
        log.push(`## FAIL PROBE: ${label} (${asPath})\n${text.trim()}\n-> exit ${r.code}\n${r.output.trim()}`);
        expect.soft(r.code, `${label} at ${asPath} must exit non-zero`).not.toBe(0);
        expect.soft(hitFor(r, asPath, word, tokenRe), `${label}: expected hit for "${word}" matching ${tokenRe}; output:\n${r.output}`).toBeDefined();
      }

      // 2. Passing positive controls: comments, <canvas>, Canvas Web API tokens, and non-matching part tokens (BD-A1-09)
      const passingProbes: Array<[string, string, string]> = [
        ['TS line & block comments', CORE_TS, '// Moodle, Canvas, Blackboard, Brightspace, D2L, Sakai, Totara\n/* instructure schoology desire2learn lti-generic */\nexport const clean = 1;\n'],
        ['SQL comments', NEW_APP_MIGRATION, '-- Moodle and Canvas comment in SQL\n/* Blackboard block comment */\nSELECT 1;\n'],
        ['JSX <canvas> element', CORE_TSX, 'export const Board = () => <canvas width={100} height={50}></canvas>;\n'],
        ['HTML <canvas> element and comment', 'apps/player/src/zz-qa-probe.html', '<!-- Moodle Canvas comment -->\n<canvas id="stage" width="100"></canvas>\n'],
        ['Canvas Web API identifiers', CORE_TS, 'export type WebApiTypes = [HTMLCanvasElement, CanvasRenderingContext2D, OffscreenCanvas, OffscreenCanvasRenderingContext2D, CanvasGradient, CanvasPattern, CanvasImageSource, CanvasImageData];\n'],
        ['BD-A1-09 non-matching parts (canvases, generic, lti, d2, regex flags)', CORE_TS, 'export const words = ["canvases", "generic", "lti", "d2"];\nexport const reFlags = /^abc$/gimsuy;\n'],
      ];

      for (const [label, asPath, text] of passingProbes) {
        const r = await f1Text(asPath, text);
        log.push(`## PASS CONTROL: ${label} (${asPath})\n${text.trim()}\n-> exit ${r.code}\n${r.output.trim()}`);
        expect.soft(r.code, `${label} at ${asPath} must pass; output:\n${r.output}`).toBe(0);
        expect.soft(f1Hits(r.output), `${label}: 0 hits`).toEqual([]);
      }

      // 3. BD-A1-19 exact-token exception on 013_channel_kernel.sql only
      const m013Allowed = "UPDATE connection SET channel = lms WHERE lms IN ('moodle', 'canvas', 'blackboard');\n";
      const r013Pass = await f1Text(MIGRATION_013, m013Allowed);
      log.push(`## BD-A1-19 PASS on ${MIGRATION_013}\n${r013Pass.output.trim()}`);
      expect.soft(r013Pass.code, '013_channel_kernel.sql with frozen SQL string values passes').toBe(0);
      expect.soft(f1Hits(r013Pass.output)).toEqual([]);

      const r013OtherWord = await f1Text(MIGRATION_013, "UPDATE connection SET channel = 'brightspace';\n");
      log.push(`## BD-A1-19 FAIL other vendor word on ${MIGRATION_013}\n${r013OtherWord.output.trim()}`);
      expect.soft(r013OtherWord.code, '013_channel_kernel.sql with non-exception vendor string fails').not.toBe(0);
      expect.soft(hitFor(r013OtherWord, MIGRATION_013, 'brightspace', /'brightspace'/)).toBeDefined();

      const r013Identifier = await f1Text(MIGRATION_013, 'ALTER TABLE connection ADD COLUMN moodle_extra TEXT;\n');
      log.push(`## BD-A1-19 FAIL identifier on ${MIGRATION_013}\n${r013Identifier.output.trim()}`);
      expect.soft(r013Identifier.code, '013_channel_kernel.sql with LMS identifier fails').not.toBe(0);
      expect.soft(hitFor(r013Identifier, MIGRATION_013, 'moodle', /^moodle_extra$/)).toBeDefined();

      // 4. Rule N6: frozen wire names pass only in packages/channel-kernel/src/legacy-wire.ts
      const wireText = "export const LEGACY_WIRE_PROBES = ['canvasConfiguration', 'MOODLE_TOOL_MAY_EXIST'] as const;\n";
      const rWirePass = await f1Text(LEGACY_WIRE, wireText);
      log.push(`## N6 PASS at ${LEGACY_WIRE}\n${rWirePass.output.trim()}`);
      expect.soft(rWirePass.code).toBe(0);
      expect.soft(f1Hits(rWirePass.output)).toEqual([]);

      for (const otherPath of [KERNEL_OTHER, CORE_TS, CORE_TSX]) {
        const rWireFail = await f1Text(otherPath, wireText);
        log.push(`## N6 FAIL at ${otherPath}\n${rWireFail.output.trim()}`);
        expect.soft(rWireFail.code).not.toBe(0);
        expect.soft(hitFor(rWireFail, otherPath, 'canvas', /^canvasConfiguration$/)).toBeDefined();
        expect.soft(hitFor(rWireFail, otherPath, 'moodle', /^MOODLE_TOOL_MAY_EXIST$/)).toBeDefined();
      }

      // 5. Ratchet: higher count fails with +1; lower count passes with -<n> and decrease hint
      const baseline = readBaseline();
      const [ratchetPath, ratchetCount] = Object.entries(baseline).find(([p, c]) => p.endsWith('.ts') && c > 0)!;
      const originalSource = git(['show', `HEAD:${ratchetPath}`]);
      const raised = await f1Text(ratchetPath, `${originalSource}\nexport const zzQaRatchetMoodle = 1;\n`);
      log.push(`## RATCHET RAISE (${ratchetPath})\n${raised.output.trim()}`);
      expect.soft(raised.code).toBe(1);
      expect.soft(raised.output).toContain(TOOL_OUTPUT_CONTRACT.f1RatchetRaise(ratchetPath, ratchetCount + 1, ratchetCount));

      const lowered = await f1Text(ratchetPath, 'export const zzQaCleanOnly = 1;\n');
      log.push(`## RATCHET LOWER (${ratchetPath})\n${lowered.output.trim()}`);
      expect.soft(lowered.code).toBe(0);
      expect.soft(lowered.output).toContain(TOOL_OUTPUT_CONTRACT.f1RatchetLower(ratchetPath, ratchetCount));
      expect.soft(lowered.output).toContain(TOOL_OUTPUT_CONTRACT.f1RatchetLowerHint(ratchetPath));

      // 6. Dynamic channel folder discovery (packages/channels/zz-lms/, QA form (k))
      const dynamicIdProbe = 'export const zzLms = 1;\n';
      const dynamicNameProbe = 'export const label = "zzVendorPortal";\n';
      expect.soft((await f1Text(CORE_TS, dynamicIdProbe)).code, 'control before scratch folder: zzLms passes').toBe(0);
      expect.soft((await f1Text(CORE_TS, dynamicNameProbe)).code, 'control before scratch folder: zzVendorPortal passes').toBe(0);

      scratch({
        [`${DYNAMIC_CHANNEL_DIR}/manifest.ts`]:
          "export default { id: 'zz-lms', family: 'lti13', names: { text: 'ZZ Vendor Portal', label: 'ZZ Label' } };\n",
      });
      try {
        const afterId = await f1Text(CORE_TS, dynamicIdProbe);
        const afterStr = await f1Text(CORE_TS, 'export const id = "zz-lms";\n');
        const afterName = await f1Text(CORE_TS, dynamicNameProbe);
        const afterSinglePart = await f1Text(CORE_TS, 'export const zz = "zz";\nexport const lms = "lms";\n');
        log.push(
          `## DYNAMIC CHANNEL (${DYNAMIC_CHANNEL_DIR})\n${afterId.output.trim()}\n${afterName.output.trim()}\n${afterSinglePart.output.trim()}`,
        );
        expect.soft(afterId.code, 'zzLms fails when packages/channels/zz-lms exists').not.toBe(0);
        expect.soft(hitFor(afterId, CORE_TS, 'zz-lms', /^zzLms$/)).toBeDefined();
        expect.soft(afterStr.code, '"zz-lms" fails when packages/channels/zz-lms exists').not.toBe(0);
        expect.soft(afterName.code, 'manifest names.text ("ZZ Vendor Portal") is also banned').not.toBe(0);
        expect.soft(hitFor(afterName, CORE_TS, 'zz vendor portal', /^zzVendorPortal$/)).toBeDefined();
        expect.soft(afterSinglePart.code, 'single parts "zz" and "lms" alone still pass (BD-A1-09)').toBe(0);
      } finally {
        removeScratchDir(DYNAMIC_CHANNEL_DIR);
      }
    } finally {
      writeAcEvidence('e7-04-ac02-f1-probes.log', `${log.join('\n\n')}\n`);
    }
  });

  it('AC-LA-E7-04-03: F3 probes of TEST-STRATEGY §3.4 fail with eslint --stdin --stdin-filename, controls pass, and root test typecheck fails on error', async () => {
    const failingProbes: Array<[string, string, string]> = [
      ['(1) core static import of a channel folder', 'services/cogniate-app/src/zz-qa-probe.ts',
        "import manifest from '../../../packages/channels/canvas/manifest';\nexport default manifest;\n"],
      ['(2) channel file imports another channel folder', 'packages/channels/canvas/app/zz-qa-probe.ts',
        "import manifest from '../../moodle/manifest';\nexport default manifest;\n"],
      ['(3a) manifest.ts imports value from @cogniate/shared', 'packages/channels/canvas/manifest.ts',
        "import { loadConfig } from '@cogniate/shared';\nexport default { id: 'canvas', loadConfig };\n"],
      ['(3b) manifest.ts imports value from @cogniate/channel-kernel', 'packages/channels/canvas/manifest.ts',
        "import { buildChannelRegistry } from '@cogniate/channel-kernel';\nexport default buildChannelRegistry;\n"],
      ['(3c) lti-profiles.ts imports @cogniate/lti-service', 'packages/channels/canvas/lti-profiles.ts',
        "import type { ProfileDefinition } from '@cogniate/lti-service';\nexport type Probe = ProfileDefinition;\n"],
      ['(4a) app.ts imports services/**/domain/**', 'packages/channels/canvas/app.ts',
        "import * as connections from '../../../services/cogniate-app/src/domain/connections';\nexport default connections;\n"],
      ['(4b) channel app/** imports services/**/domain/**', 'packages/channels/moodle/app/zz-qa-probe.ts',
        "import * as attempts from '../../../../services/cogniate-app/src/domain/attempts';\nexport default attempts;\n"],
      ['(4c) channel app/** value-imports kernel/ports.ts', 'packages/channels/moodle/app/zz-qa-probe.ts',
        "import { something } from '../../../../services/cogniate-app/src/kernel/ports.ts';\nexport default something;\n"],
      ['(5a) channel portal/** imports portal code outside apps/portal/src/sdk/', 'packages/channels/canvas/portal/index.tsx',
        "import { Integrations } from '../../../../apps/portal/src/Integrations';\nexport default Integrations;\n"],
      ['(5b) channel portal/** imports @cogniate/shared value', 'packages/channels/canvas/portal/index.tsx',
        "import { canonicalOrigin } from '@cogniate/shared/channel';\nexport default canonicalOrigin;\n"],
      ['(6a) BD-A1-16: dynamic import() literal in channel file', 'packages/channels/canvas/app/zz-qa-probe.ts',
        "export const load = () => import('@cogniate/shared/channel');\n"],
      ['(6b) BD-A1-16: dynamic import() variable in channel file', 'packages/channels/canvas/app/zz-qa-probe.ts',
        "export const load = (pkg: string) => import(pkg);\n"],
      ['(6c) BD-A1-16: require() call in channel file', 'packages/channels/canvas/app/zz-qa-probe.ts',
        "export const shared = require('@cogniate/shared');\n"],
      ['(6d) BD-A1-16: import x = require() in channel file', 'packages/channels/canvas/app/zz-qa-probe.ts',
        "import shared = require('@cogniate/shared');\nexport default shared;\n"],
      ['(6e) BD-A1-16: createRequire in channel file', 'packages/channels/canvas/app/zz-qa-probe.ts',
        "import { createRequire } from 'node:module';\nexport const req = createRequire(import.meta.url);\n"],
      ['(6f) BD-A1-16: dynamic import() in channel root test', 'packages/channels/canvas/probe.test.ts',
        "export const load = () => import('./manifest.ts');\n"],
      ['(7a) BD-A1-16: channel file outside closed D1 kinds (helpers.ts)', 'packages/channels/canvas/helpers.ts',
        "export const helper = 1;\n"],
      ['(7b) BD-A1-16: channel file outside closed D1 kinds (lib/x.ts)', 'packages/channels/canvas/lib/x.ts',
        "export const x = 1;\n"],
      ['(7c) BD-A1-16: app/** importing non-D1 file ../helpers', 'packages/channels/canvas/app/zz-qa-probe.ts',
        "import * as reexported from '../helpers';\nexport default reexported;\n"],
      ['(7d) BD-A1-16: non-test channel file importing *.test.ts', 'packages/channels/canvas/app.ts',
        "import * as t from './probe.test.ts';\nexport default t;\n"],
      ['(8) BD-A1-16: core file dynamic import() with template literal naming channel path', 'services/cogniate-app/src/zz-qa-probe.ts',
        'export const load = () => import(`../../../packages/channels/canvas/manifest`);\n'],
      ['(9a) BD-A2-11: value import from @cogniate/shared root in app/**', 'packages/channels/moodle/app/zz-qa-probe.ts',
        "import { openSqlite } from '@cogniate/shared';\nexport default openSqlite;\n"],
      ['(9b) BD-A2-11: namespace import from @cogniate/shared root in app/**', 'packages/channels/moodle/app/zz-qa-probe.ts',
        "import * as shared from '@cogniate/shared';\nexport default shared;\n"],
      ['(9c) BD-A2-11: export * from @cogniate/shared root in app.ts', 'packages/channels/moodle/app.ts',
        "export * from '@cogniate/shared';\n"],
      ['(9d) BD-A2-11: fetch(...) in channel app/**', 'packages/channels/moodle/app/zz-qa-probe.ts',
        "export const call = (url: string) => fetch(url);\n"],
      ['(9e) BD-A2-11: WebSocket in channel app/**', 'packages/channels/moodle/app/zz-qa-probe.ts',
        "export const ws = (url: string) => new WebSocket(url);\n"],
      ['(9f) BD-A2-11: process global in channel app.ts', 'packages/channels/moodle/app.ts',
        "export const envVal = process.env.NODE_ENV;\n"],
    ];

    const passingControls: Array<[string, string, string]> = [
      ['(control 1) manifest.ts imports kernel type', 'packages/channels/canvas/manifest.ts',
        "import type { ChannelManifest } from '@cogniate/channel-kernel';\nexport default { id: 'canvas' } as unknown as ChannelManifest;\n"],
      ['(control 2) BD-A1-21: lti-profiles.ts imports ProfileSource type from kernel and ./manifest.ts', 'packages/channels/canvas/lti-profiles.ts',
        "import type { ProfileSource } from '@cogniate/channel-kernel';\nimport manifest from './manifest.ts';\nexport const profiles: readonly ProfileSource[] = [];\nexport default manifest;\n"],
      ['(control 3) BD-A1-16/18: app.ts imports ./manifest.ts, ./app/x.ts, kernel/ports.ts types, and @cogniate/shared/channel values', 'packages/channels/canvas/app.ts',
        "import type { ConnectionSetup } from '../../../services/cogniate-app/src/kernel/ports.ts';\nimport { canonicalOrigin } from '@cogniate/shared/channel';\nimport manifest from './manifest.ts';\nimport * as helper from './app/x.ts';\nexport type ProbeSetup = ConnectionSetup;\nexport default { manifest, helper, canonicalOrigin };\n"],
      ['(control 4) BD-A2-11: channel app/** uses import type from @cogniate/shared root and value from @cogniate/shared/channel', 'packages/channels/moodle/app/zz-qa-probe.ts',
        "import type { Logger } from '@cogniate/shared';\nimport { canonicalOrigin } from '@cogniate/shared/channel';\nexport type ProbeLogger = Logger;\nexport const norm = (u: string) => canonicalOrigin(u);\n"],
    ];

    const log: string[] = [];
    try {
      for (const [name, asPath, text] of failingProbes) {
        const results = await eslintText(asPath, text);
        const errs = importErrors(results);
        log.push(`## FAIL PROBE ${name} (${asPath})\n${JSON.stringify(errs, null, 2)}`);
        expect.soft(errs.length, `${name}: expected F3 error at ${asPath}; messages: ${JSON.stringify(results.flatMap((r) => r.messages))}`).toBeGreaterThan(0);
      }

      for (const [name, asPath, text] of passingControls) {
        const results = await eslintText(asPath, text);
        const errs = importErrors(results);
        log.push(`## PASS CONTROL ${name} (${asPath})\n${JSON.stringify(errs, null, 2)}`);
        expect.soft(errs, `${name}: expected 0 F3 errors at ${asPath}`).toEqual([]);
      }

      // BD-A1-16 / LA-E1-03 AC-06: root channel test typecheck probe
      scratch({
        [`${PROBE_CHANNEL_DIR}/probe.test.ts`]: "export const qaRootTestTypeError: number = 'not a number';\n",
      });
      try {
        const types = await run('npm', ['run', 'typecheck']);
        log.push(`## ROOT CHANNEL TEST TYPECHECK (${PROBE_CHANNEL_DIR}/probe.test.ts)\n-> exit ${types.code}\n${types.output.trim()}`);
        expect.soft(types.code, 'npm run typecheck fails on a type error in packages/channels/zz-probe/probe.test.ts').not.toBe(0);
        expect.soft(types.output).toMatch(/zz-probe\/probe\.test\.ts/);
      } finally {
        removeScratchDir(PROBE_CHANNEL_DIR);
      }
    } finally {
      writeAcEvidence('e7-04-ac03-f3-probes.log', `${log.join('\n\n')}\n`);
    }
  });

  it('AC-LA-E7-04-04: F2 probes (--paths-from core, shared-build, another-channel fail; channel-only and channel+sim+tests+docs pass; --no-renames catches core rename and restores start ref)', async () => {
    const dir = fs.mkdtempSync(path.join(runDir, 'e7-04-f2-'));
    const cases: Array<[string, string[], number, string[]]> = [
      ['core-path', ['services/cogniate-app/src/app/connections.ts'], 1, ['core']],
      ['shared-build-path', ['package.json', 'infra/compose.yaml'], 1, ['core', 'core']],
      ['other-channel-path', ['packages/channels/moodle/manifest.ts'], 1, ['core']],
      ['channel-only', ['packages/channels/canvas/manifest.ts', 'packages/channels/canvas/lti-profiles.ts'], 0, ['channel:canvas', 'channel:canvas']],
      [
        'channel-sim-tests-docs',
        [
          'packages/channels/canvas/manifest.ts',
          'tests/sim/canvas/provider.mjs',
          'tests/acceptance/M1/common/00-profiles.test.ts',
          'docs/architecture/ltiaas/README.md',
        ],
        0,
        ['channel:canvas', 'sim', 'tests', 'docs'],
      ],
    ];

    const log: string[] = [];
    try {
      for (const [name, paths, expectedCode, expectedClasses] of cases) {
        const file = path.join(dir, `${name}.txt`);
        fs.writeFileSync(file, `${paths.join('\n')}\n`, { mode: 0o600 });
        const r = await channelDiff(['--channel', 'canvas', '--paths-from', file]);
        log.push(`## ${name} (exit ${r.code})\n${r.output.trim()}`);
        expect.soft(r.code, `${name}: expected exit ${expectedCode}; output:\n${r.output}`).toBe(expectedCode);
        paths.forEach((p, idx) => {
          const line = r.output.split('\n').find((l) => l.includes(p));
          expect.soft(line, `${name}: output lists ${p}`).toBeDefined();
          if (line) {
            expect.soft(line.split(/\s+/), `${name}: ${p} classed as ${expectedClasses[idx]}`).toContain(expectedClasses[idx]);
          }
        });
      }

      // Scratch branch rename probe (--no-renames), restoring exact start ref (branch or detached SHA, A-LA-E7-04-01)
      const from = 'services/cogniate-app/src/app/connections.ts';
      const to = 'packages/channels/canvas/zz-qa-moved.ts';
      let startBranch: string | null = null;
      try {
        startBranch = git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
      } catch {
        startBranch = null;
      }
      const startSha = git(['rev-parse', 'HEAD']);
      git(['switch', '--quiet', '-c', 'zz-qa-e7-04-f2-rename']);
      try {
        git(['mv', from, to]);
        git(['-c', 'user.name=qa', '-c', 'user.email=qa@invalid', 'commit', '--quiet', '--no-verify', '-m', 'QA F2 rename probe']);
        const r = await channelDiff(['--base', startSha, '--channel', 'canvas']);
        log.push(`## scratch-branch-rename (exit ${r.code})\n${r.output.trim()}`);
        expect.soft(r.code, 'renaming a core file into a channel folder exits 1').toBe(1);
        const line = r.output.split('\n').find((l) => l.includes(from));
        expect.soft(line, `report lists old core path ${from}`).toBeDefined();
        if (line) {
          expect.soft(line.split(/\s+/)).toContain('core');
        }
      } finally {
        if (startBranch) {
          git(['switch', '--quiet', startBranch]);
        } else {
          git(['switch', '--quiet', '--detach', startSha]);
        }
        git(['branch', '--quiet', '-D', 'zz-qa-e7-04-f2-rename']);
      }
      expect.soft(git(['rev-parse', 'HEAD']), 'HEAD SHA restored after F2 scratch branch').toBe(startSha);
      if (startBranch) {
        expect.soft(git(['symbolic-ref', '--quiet', '--short', 'HEAD']), 'start branch restored after F2 scratch branch').toBe(startBranch);
      }
      expect.soft(git(['status', '--porcelain']), 'clone is clean after F2 scratch branch').toBe('');
    } finally {
      writeAcEvidence('e7-04-ac04-f2-probes.log', `${log.join('\n\n')}\n`);
    }
  });

  it('AC-LA-E7-04-05: F5 rules (sql-portability incl. BD-A2-13/22, connection-lms, audit-event-delete) fail on probes and pass on controls', async () => {
    const log: string[] = [];
    try {
      // 1. sql-portability: all 9 statement patterns + 4 BD-A2-13 SQLite forms in new migrations
      const migrationProbes: Array<[string, string, string, RegExp]> = [
        ['PRAGMA', NEW_APP_MIGRATION, 'PRAGMA foreign_keys = ON;\n', TOOL_OUTPUT_CONTRACT.f5SqlPortability.pragma],
        ['INSERT OR REPLACE', NEW_APP_MIGRATION, "INSERT OR REPLACE INTO t (id) VALUES ('1');\n", TOOL_OUTPUT_CONTRACT.f5SqlPortability.insertOrReplace],
        ['UPDATE OR IGNORE', NEW_APP_MIGRATION, "UPDATE OR IGNORE t SET id = '2';\n", TOOL_OUTPUT_CONTRACT.f5SqlPortability.updateOrIgnore],
        ['REPLACE INTO', NEW_APP_MIGRATION, "REPLACE INTO t (id) VALUES ('1');\n", TOOL_OUTPUT_CONTRACT.f5SqlPortability.replaceInto],
        ['AUTOINCREMENT', NEW_APP_MIGRATION, 'CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT);\n', TOOL_OUTPUT_CONTRACT.f5SqlPortability.autoincrement],
        ['WITHOUT ROWID', NEW_APP_MIGRATION, 'CREATE TABLE t (id TEXT PRIMARY KEY) WITHOUT ROWID;\n', TOOL_OUTPUT_CONTRACT.f5SqlPortability.withoutRowid],
        ['STRICT table', NEW_APP_MIGRATION, 'CREATE TABLE t (id TEXT PRIMARY KEY) STRICT;\n', TOOL_OUTPUT_CONTRACT.f5SqlPortability.strictTable],
        ['CREATE VIRTUAL TABLE', NEW_APP_MIGRATION, 'CREATE VIRTUAL TABLE t USING fts5(body);\n', TOOL_OUTPUT_CONTRACT.f5SqlPortability.virtualTable],
        ['ATTACH DATABASE', NEW_APP_MIGRATION, "ATTACH DATABASE 'other.db' AS other;\n", TOOL_OUTPUT_CONTRACT.f5SqlPortability.attachDatabase],
        ['BD-A2-13 blob-literal X\'...\'', NEW_LTI_MIGRATION, "UPDATE tool_key SET private_jwk_encrypted = X'' WHERE kid = 'k1';\n", TOOL_OUTPUT_CONTRACT.f5SqlPortability.blobLiteral],
        ['BD-A2-13 date-function unixepoch', NEW_LTI_MIGRATION, "SELECT unixepoch('subsec');\n", TOOL_OUTPUT_CONTRACT.f5SqlPortability.dateFunction],
        ['BD-A2-13 randomblob', NEW_LTI_MIGRATION, 'SELECT randomblob(16);\n', TOOL_OUTPUT_CONTRACT.f5SqlPortability.randomblob],
        ['BD-A2-13 rowid', NEW_APP_MIGRATION, 'SELECT rowid, id FROM connection;\n', TOOL_OUTPUT_CONTRACT.f5SqlPortability.rowid],
      ];

      for (const [label, asPath, sql, expectedRe] of migrationProbes) {
        const r = await f5Text(asPath, sql);
        log.push(`## sql-portability FAIL PROBE (${label} at ${asPath})\n${sql.trim()}\n-> exit ${r.code}\n${r.output.trim()}`);
        expect.soft(r.code, `sql-portability (${label}) must exit 1`).toBe(1);
        expect.soft(r.output).toMatch(expectedRe);
      }

      // sql-portability controls: applied migration and ADAPTER_ALLOW_LIST (009 date-function, 011 randomblob)
      const appliedPass = await f5Text(APPLIED_APP_MIGRATION, "INSERT OR REPLACE INTO t (id) VALUES ('1');\n");
      log.push(`## sql-portability PASS CONTROL (applied migration ${APPLIED_APP_MIGRATION})\n${appliedPass.output.trim()}`);
      expect.soft(appliedPass.code).toBe(0);

      const m009Pass = await f5Text(
        'services/lti-service/src/db/migrations/009_signing_key_lifecycle.sql',
        git(['show', 'HEAD:services/lti-service/src/db/migrations/009_signing_key_lifecycle.sql']),
      );
      expect.soft(m009Pass.code, '009_signing_key_lifecycle.sql passes via ADAPTER_ALLOW_LIST').toBe(0);

      const m011Pass = await f5Text(
        'services/lti-service/src/db/migrations/011_api_key.sql',
        git(['show', 'HEAD:services/lti-service/src/db/migrations/011_api_key.sql']),
      );
      expect.soft(m011Pass.code, '011_api_key.sql passes via ADAPTER_ALLOW_LIST').toBe(0);

      // Inline TypeScript SQL probes (BD-A2-13 / BD-A2-22)
      const inlineTsPath = 'services/cogniate-app/src/domain/zz-qa-probe.ts';
      const inlineProbes: Array<[string, string, RegExp]> = [
        ['inline blob-literal X\'\'', "export const q = \"UPDATE t SET b = X'' WHERE id = ?\";\n", TOOL_OUTPUT_CONTRACT.f5SqlPortability.blobLiteral],
        ['inline date-function', "export const q = `SELECT datetime('now') FROM t`;\n", TOOL_OUTPUT_CONTRACT.f5SqlPortability.dateFunction],
        ['inline randomblob', 'export const q = "SELECT hex(randomblob(16))";\n', TOOL_OUTPUT_CONTRACT.f5SqlPortability.randomblob],
        ['inline new rowid (BD-A2-22)', 'export const q = "SELECT * FROM attempt ORDER BY created_at, rowid";\n', TOOL_OUTPUT_CONTRACT.f5SqlPortability.rowid],
      ];
      for (const [label, code, expectedRe] of inlineProbes) {
        const r = await f5Text(inlineTsPath, code);
        log.push(`## sql-portability INLINE FAIL PROBE (${label})\n${code.trim()}\n-> exit ${r.code}\n${r.output.trim()}`);
        expect.soft(r.code, `inline ${label} must exit 1`).toBe(1);
        expect.soft(r.output).toMatch(expectedRe);
      }

      // BD-A2-22 / BD-A2-40 / BD-A2-46: unchanged attempts.ts passes, but adding a second rowid query in attempts.ts fails.
      // After LA-E4-02 (db7333f, BD-A2-40), INLINE_BASELINE has 7 frozen legacy rowid statements (results.ts:49 and
      // score-syncs.ts:147 removed; results.ts:33 replaced 1:1) and 014_learning_records.sql is in ADAPTER_ALLOW_LIST.
      // When LA-E1-08 lands (BD-A2-46), the 3 mbz_build entries move 1:1 to packages/channels/moodle/app/builds.ts (count stays 7).
      const attemptsPath = 'services/cogniate-app/src/domain/attempts.ts';
      const attemptsText = git(['show', `HEAD:${attemptsPath}`]);
      expect.soft((await f5Text(attemptsPath, attemptsText)).code, 'unchanged attempts.ts with frozen legacy rowid passes').toBe(0);
      const attemptsExtraRowid = await f5Text(
        attemptsPath,
        `${attemptsText}\nexport const extraRowidProbe = "SELECT * FROM attempt ORDER BY created_at, rowid";\n`,
      );
      log.push(`## BD-A2-22 extra rowid in ${attemptsPath}\n${attemptsExtraRowid.output.trim()}`);
      expect.soft(attemptsExtraRowid.code, 'extra rowid in attempts.ts fails').toBe(1);
      expect.soft(attemptsExtraRowid.output).toMatch(TOOL_OUTPUT_CONTRACT.f5SqlPortability.rowid);

      const m014Path = 'services/cogniate-app/src/domain/migrations/014_learning_records.sql';
      if (fs.existsSync(path.join(ROOT, m014Path))) {
        const m014Pass = await f5Text(m014Path, git(['show', `HEAD:${m014Path}`]));
        log.push(`## sql-portability + no-score-sync PASS CONTROL (${m014Path})\n${m014Pass.output.trim()}`);
        expect.soft(m014Pass.code, '014_learning_records.sql passes via ADAPTER_ALLOW_LIST (BD-A2-40) and no-score-sync backfill allow').toBe(0);
        const sqlPortabilitySrc = fs.readFileSync(path.join(ROOT, 'infra/scripts/fitness/rules/sql-portability.mjs'), 'utf8');
        const allRowidFiles = [...sqlPortabilitySrc.matchAll(/file:\s*['"]([^'"]+)['"],\s*form:\s*['"]rowid['"]/g)].map((m) => m[1]);
        const sqlRowidEntries = allRowidFiles.filter((f) => f.endsWith('.sql'));
        const tsRowidEntries = allRowidFiles.filter((f) => f.endsWith('.ts'));
        expect.soft(sqlRowidEntries, 'one adapter allow entry for 014_learning_records.sql (BD-A2-40)').toEqual([m014Path]);
        expect.soft(tsRowidEntries.length, 'seven frozen legacy rowid entries in INLINE_BASELINE (BD-A2-40, BD-A2-46)').toBe(7);
        expect.soft(tsRowidEntries.filter((f) => f === 'services/cogniate-app/src/domain/attempts.ts').length).toBe(1);
        expect.soft(tsRowidEntries.filter((f) => f === 'services/cogniate-app/src/domain/bindings.ts').length).toBe(2);
        expect.soft(tsRowidEntries.filter((f) => f === 'services/cogniate-app/src/domain/results.ts').length).toBe(1);
        expect.soft(tsRowidEntries.filter((f) => f === 'services/cogniate-app/src/domain/score-syncs.ts').length).toBe(0);
        expect.soft(
          tsRowidEntries.filter(
            (f) => f === 'services/cogniate-app/src/domain/mbz-builds.ts' || f === 'packages/channels/moodle/app/builds.ts',
          ).length,
        ).toBe(3);
      }

      // 2. connection-lms (LA-E1-06, rule N7)
      const connLmsProbes: Array<[string, string]> = [
        ['services/cogniate-app/src/app/connections.ts', 'export const q = "SELECT id, lms FROM connection WHERE id = ?";\n'],
        ['services/cogniate-app/src/domain/launch.ts', 'export const q = `SELECT c.lms FROM connection c WHERE c.id = ?`;\n'],
        ['packages/channels/moodle/app/zz-qa-probe.ts', "export const q = \"UPDATE connection SET lms = 'moodle' WHERE id = ?\";\n"],
      ];
      for (const [asPath, code] of connLmsProbes) {
        const r = await f5Text(asPath, code);
        log.push(`## connection-lms FAIL PROBE (${asPath})\n${code.trim()}\n-> exit ${r.code}\n${r.output.trim()}`);
        expect.soft(r.code, `connection-lms probe at ${asPath} must exit 1`).toBe(1);
        expect.soft(r.output).toMatch(TOOL_OUTPUT_CONTRACT.f5ConnectionLms);
      }

      // connection-lms controls: repository file and channel/binding_authority queries pass
      const repoPass = await f5Text(
        'services/cogniate-app/src/domain/connections.ts',
        git(['show', 'HEAD:services/cogniate-app/src/domain/connections.ts']),
      );
      expect.soft(repoPass.code, 'services/cogniate-app/src/domain/connections.ts passes connection-lms').toBe(0);
      const channelColPass = await f5Text(
        'services/cogniate-app/src/app/connections.ts',
        'export const q = "SELECT id, channel, binding_authority FROM connection WHERE id = ?";\n',
      );
      expect.soft(channelColPass.code, 'reading connection.channel and binding_authority passes').toBe(0);

      // 3. audit-event-delete (LA-E5-02, A2 rule)
      const auditProbes: Array<[string, string]> = [
        ['services/lti-service/src/store/audit.ts', 'export const q = "DELETE FROM audit_event WHERE ts < ?";\n'],
        ['services/lti-service/src/store/audit.ts', 'export const q = "INSERT OR REPLACE INTO audit_event (id) VALUES (?)";\n'],
        ['services/lti-service/src/store/audit-retention.ts', 'export const q = "REPLACE INTO audit_event (id) VALUES (?)";\n'],
        ['services/cogniate-app/src/domain/zz-qa-probe.ts', 'export const q = \'DELETE FROM "main"."audit_event" WHERE id = ?\';\n'],
      ];
      for (const [asPath, code] of auditProbes) {
        const r = await f5Text(asPath, code);
        log.push(`## audit-event-delete FAIL PROBE (${asPath})\n${code.trim()}\n-> exit ${r.code}\n${r.output.trim()}`);
        expect.soft(r.code, `audit-event-delete probe at ${asPath} must exit 1`).toBe(1);
        expect.soft(r.output).toMatch(TOOL_OUTPUT_CONTRACT.f5AuditEventDelete);
      }

      const retentionPass = await f5Text(
        'services/lti-service/src/store/audit-retention.ts',
        'export const q = "DELETE FROM audit_event WHERE ts < ?";\n',
      );
      log.push(`## audit-event-delete PASS CONTROL (store/audit-retention.ts)\n${retentionPass.output.trim()}`);
      expect.soft(retentionPass.code, 'DELETE FROM audit_event in store/audit-retention.ts passes').toBe(0);
    } finally {
      writeAcEvidence('e7-04-ac05-f5-probes.log', `${log.join('\n\n')}\n`);
    }
  });

  // Pending F5 rule probes (run automatically once LA-E1-08, LA-E4-02 and LA-E5-06 land their rule files)
  it.runIf(ruleExists(TOOL_OUTPUT_CONTRACT.f5ChannelSqlTables))(
    'AC-LA-E7-04-05 (channel-sql-tables, LA-E1-08): probe in channel app/ naming an unlisted table fails',
    async () => {
      const r = await f5Text(
        'packages/channels/moodle/app/zz-qa-probe.ts',
        'export const q = "SELECT * FROM connection WHERE library_id = :library_id";\n',
      );
      expect(r.code).toBe(1);
      expect(r.output).toContain(TOOL_OUTPUT_CONTRACT.f5ChannelSqlTables);
    },
  );

  it.runIf(ruleExists(TOOL_OUTPUT_CONTRACT.f5NoScoreSync))(
    'AC-LA-E7-04-05 (no-score-sync, LA-E4-02): probe naming score_sync outside an applied migration fails',
    async () => {
      const r = await f5Text(
        'services/cogniate-app/src/domain/results.ts',
        'export const q = "SELECT * FROM score_sync WHERE id = ?";\n',
      );
      expect(r.code).toBe(1);
      expect(r.output).toContain(TOOL_OUTPUT_CONTRACT.f5NoScoreSync);
    },
  );

  it.runIf(findLaunchLiteralRuleId() !== null)(
    'AC-LA-E7-04-05 (/lti/launch/ literal rule, LA-E5-06): probe with /lti/launch/ outside the resolver fails',
    async () => {
      const r = await f5Text(
        'services/lti-service/src/http/routes/protocol.ts',
        "export const p = '/lti/launch/cogniate';\n",
      );
      expect(r.code).toBe(1);
      expect(r.output).toContain(findLaunchLiteralRuleId()!);
    },
  );

  it('AC-LA-E7-04-06: the core globs inside fitness-scope.json, README §4, TEST-STRATEGY §3.1 and the checks are equal', () => {
    const scope = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'packages/channel-kernel/fitness-scope.json'), 'utf8'),
    ) as {
      precedence: string[];
      classes: Record<string, { globs: string[] }>;
    };
    const readme = fs.readFileSync(path.join(ROOT, 'docs/architecture/ltiaas/README.md'), 'utf8');
    const strategy = fs.readFileSync(path.join(ROOT, 'tests/ltiaas/TEST-STRATEGY.md'), 'utf8');
    const commonMjs = fs.readFileSync(path.join(ROOT, 'infra/scripts/fitness/common.mjs'), 'utf8');
    const eslintConfig = fs.readFileSync(path.join(ROOT, 'eslint.config.js'), 'utf8');

    let readmeTable: ReturnType<typeof parseDocScopeTable> | null = null;
    let strategyTable: ReturnType<typeof parseDocScopeTable> | null = null;
    try {
      readmeTable = parseDocScopeTable(readme);
      strategyTable = parseDocScopeTable(strategy);
      expect.soft(scope.classes.channel.globs).toEqual(['packages/channels/*/**']);
      expect.soft(scope.classes.core.globs).toEqual(['services/*/src/**', 'packages/*/src/**', 'apps/*/src/**']);
      expect.soft(scope.classes.coreExceptions.globs).toEqual([
        'packages/channel-kernel/src/legacy-wire.ts',
        'services/cogniate-app/src/domain/migrations/*.sql',
        'services/lti-service/src/db/migrations/*.sql',
      ]);
      expect.soft(scope.classes.sharedBuild.globs).toEqual([
        'package.json',
        'package-lock.json',
        'tsconfig*.json',
        'eslint.config.js',
        'vitest.config.ts',
        'infra/**',
      ]);
      expect.soft(scope.classes.notCore.globs).toEqual(['tests/**', 'docs/**']);

      // B-LA-E7-04-02: compare parsed "| Class | Paths |" tables from README §4 and TEST-STRATEGY §3.1 against fitness-scope.json
      for (const [docLabel, parsed] of [
        ['README §4', readmeTable],
        ['TEST-STRATEGY §3.1', strategyTable],
      ] as const) {
        expect.soft(parsed.channel, `${docLabel} channel globs equal fitness-scope.json`).toEqual(scope.classes.channel.globs);
        expect.soft(parsed.core, `${docLabel} core globs equal fitness-scope.json`).toEqual(scope.classes.core.globs);
        expect.soft(parsed.coreExceptionsHasLegacyWire, `${docLabel} coreExceptions lists legacy-wire.ts`).toBe(true);
        expect.soft(parsed.coreExceptionsHasMigrations, `${docLabel} coreExceptions lists applied SQL migrations`).toBe(true);
        expect.soft(parsed.sharedBuild, `${docLabel} sharedBuild globs equal fitness-scope.json`).toEqual(scope.classes.sharedBuild.globs);
        expect.soft(parsed.notCore, `${docLabel} notCore globs equal fitness-scope.json`).toEqual(scope.classes.notCore.globs);
      }

      // Both infra/scripts/fitness/common.mjs and eslint.config.js read packages/channel-kernel/fitness-scope.json directly
      expect.soft(commonMjs).toContain('packages/channel-kernel/fitness-scope.json');
      expect.soft(eslintConfig).toContain('packages/channel-kernel/fitness-scope.json');
      expect.soft(eslintConfig).toContain('scope.classes.core.globs');
      expect.soft(eslintConfig).toContain('scope.classes.channel.globs');
    } finally {
      writeAcEvidence(
        'e7-04-ac06-scope.json',
        `${JSON.stringify({ scope, readmeTable, strategyTable }, null, 2)}\n`,
      );
    }
  });

  it('AC-LA-E7-04-07: (Could) F1 kit-neutrality check over tests/ltiaas/kit/suites/** gives 0 hits when present (and catches a planted hit)', async () => {
    const scanned: string[] = [];
    try {
      const neutralSample = "import { describe, it, expect } from 'vitest';\ndescribe('K1-LAUNCH', () => { it('launches via fixture', () => expect(true).toBe(true)); });\n";
      const plantedSample = "export const badSuiteBranch = 'moodle';\n";
      expect.soft((await f1Text(CORE_TS, neutralSample)).code).toBe(0);
      expect.soft((await f1Text(CORE_TS, plantedSample)).code).toBe(1);

      const suitesDir = path.join(ROOT, 'tests/ltiaas/kit/suites');
      if (fs.existsSync(suitesDir)) {
        const files = git(['ls-files', 'tests/ltiaas/kit/suites']).split('\n').filter(Boolean);
        for (const file of files) {
          const ext = path.extname(file) || '.ts';
          const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
          const r = await f1Text(`services/cogniate-app/src/zz-kit-suite-check${ext}`, text);
          scanned.push(`${file}: exit ${r.code}, hits ${f1Hits(r.output).length}`);
          expect.soft(f1Hits(r.output), `${file} in tests/ltiaas/kit/suites/** must have 0 F1 hits`).toEqual([]);
        }
      } else {
        scanned.push('pending: LA-E7-06 (tests/ltiaas/kit/suites/** not yet in tree)');
      }
    } finally {
      writeAcEvidence('e7-04-ac07-kit-neutrality.log', `${scanned.join('\n')}\n`);
    }
  });
});
