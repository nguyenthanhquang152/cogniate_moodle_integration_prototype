// LA-E1-08 K0 acceptance tests:
// - AC-LA-E1-08-04: F5 channel-sql-tables rule refuses a probe statement in packages/channels/moodle/app/ that names a
//   table or column not in the Moodle manifest storage list; allows a statement naming only declared storage tables and
//   columns; and passes on the clean tree. Also checks that the baseline app.ts adapters expose the P5-P7 ports
//   (BD-A1-20, BD-A1-28) and that Canvas canvas-configuration extensionRoute matches G1.canvasConfiguration.
// - AC-LA-E1-08-09: The six removed core files no longer exist on disk or in git, and the F1 counts of every core file
//   changed by this task go down or stay (RQ-3).
// Source: docs/architecture/ltiaas/tasks/LA-E1-08.md; LA-ADR-01 D5, D6, D10; LA-ADR-07 D2; build-decisions-A1.md
// BD-A1-20, BD-A1-28. QA-3 wrote these tests from the spec and design only (test-first).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT, artifact, f1Hits, f1Text, f5Text, git, isF1Core, npmCheck, requireRunDir, requireScratchClone, run,
  scriptEchoes, type RunResult,
} from '../LA-E1-04/fitness';

const PORTS_REL = 'services/cogniate-app/src/kernel/ports.ts';
const RULE_REL = 'infra/scripts/fitness/rules/channel-sql-tables.mjs';
const BASE_SHA = process.env.LA_BASE_SHA ?? 'HEAD~1';
const GOLDEN_G1_PATH = path.join(
  ROOT,
  'tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/G1.json',
);

const REMOVED_CORE_FILES = [
  'services/cogniate-app/src/app/canvas-configuration.ts',
  'services/cogniate-app/src/app/canvas-deployments.ts',
  'services/cogniate-app/src/app/web-services.ts',
  'services/cogniate-app/src/app/mbz.ts',
  'services/cogniate-app/src/domain/mbz-builds.ts',
  'services/cogniate-app/src/clients/moodle-ws.ts',
] as const;

interface ExtensionRouteLike {
  method: 'GET' | 'PUT' | 'POST';
  path: string;
  capability: string;
  legacyCapabilityName?: string;
  handle: (
    input: { body: unknown; query: Record<string, string> },
    ctx: Record<string, unknown>,
  ) => Promise<{ status: number; body: unknown; headers?: Record<string, string> }>;
}

interface PublishHookLike {
  option: string;
  capability: string;
  afterPublish: (publication: Record<string, unknown>, ctx: Record<string, unknown>) => Promise<void>;
  dtoFields: (publication: Record<string, unknown>, ctx: Record<string, unknown>) => Record<string, unknown>;
}

interface PackageExporterLike {
  id: string;
  formats: readonly string[];
  start: (version: Record<string, unknown>, ctx: Record<string, unknown>) => Promise<Record<string, unknown>>;
  latest: (version: Record<string, unknown>, ctx: Record<string, unknown>) => Record<string, unknown> | null;
  download: (
    version: Record<string, unknown>,
    ctx: Record<string, unknown>,
  ) => Promise<{ path: string; mediaType: string; filename: string } | null>;
}

interface ConnectionSetupWithExtensions {
  channel: string;
  extensionRoutes?: readonly ExtensionRouteLike[];
  publishHooks?: readonly PublishHookLike[];
  packageExporters?: readonly PackageExporterLike[];
}

interface LoadedChannel {
  folder: string;
  manifest: Record<string, unknown> & { id: string };
  appAdapter?: unknown;
}

interface KernelSurface {
  loadChannelFolders(roots: readonly string[], side: 'lti' | 'app'): Promise<LoadedChannel[]>;
}

let clean: RunResult;
let loadedById: Map<string, LoadedChannel>;

function unwrapSetup(appAdapter: unknown): ConnectionSetupWithExtensions {
  expect(appAdapter && typeof appAdapter === 'object', 'appAdapter is an object').toBe(true);
  const obj = appAdapter as Record<string, unknown>;
  if (typeof obj.parseBindingBody === 'function') {
    return obj as unknown as ConnectionSetupWithExtensions;
  }
  if (obj.setup && typeof obj.setup === 'object') {
    return obj.setup as unknown as ConnectionSetupWithExtensions;
  }
  if (obj.default && typeof obj.default === 'object') {
    return unwrapSetup(obj.default);
  }
  return obj as unknown as ConnectionSetupWithExtensions;
}

function readBaselineCounts(ref: string): Record<string, number> | null {
  try {
    const text = git(['show', `${ref}:infra/scripts/fitness/f1-baseline.json`]);
    const raw = JSON.parse(text) as Record<string, unknown>;
    const isCounts = (o: unknown): o is Record<string, number> =>
      typeof o === 'object' && o !== null && !Array.isArray(o) && Object.values(o).every((v) => typeof v === 'number');
    if (isCounts(raw)) return raw;
    return Object.values(raw).find(isCounts) ?? null;
  } catch {
    return null;
  }
}

function fileExistsAt(ref: string, relPath: string): boolean {
  try {
    git(['cat-file', '-e', `${ref}:${relPath}`]);
    return true;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  requireScratchClone();
  requireRunDir();
  clean = await npmCheck('e1-08-check-clean');
  const kernelEntry = pathToFileURL(path.join(ROOT, 'packages/channel-kernel/src/index.ts')).href;
  const kernel = (await import(kernelEntry)) as KernelSurface;
  const loaded = await kernel.loadChannelFolders([path.join(ROOT, 'packages/channels')], 'app');
  loadedById = new Map(loaded.map((c) => [c.manifest.id, c]));
});

describe('LA-E1-08 extension ports P5-P7, PortContext and Moodle/Canvas channel features (K0)', () => {
  it('AC-LA-E1-08-04: F5 channel-sql-tables refuses undeclared table/column in packages/channels/moodle/app/, allows declared storage tables/columns, passes on clean tree, and baseline P5-P7 ports match BD-A1-20/BD-A1-28', async () => {
    // 1. Rule file exists and clean tree passes `npm run fitness:rules`.
    expect(fs.existsSync(path.join(ROOT, RULE_REL)), `${RULE_REL} exists`).toBe(true);
    const rulesClean = await run('npm', ['run', '--silent', 'fitness:rules']);
    expect(rulesClean.code, `fitness:rules exits 0 on clean tree:\n${rulesClean.output}`).toBe(0);

    // 2. Negative probe 1: undeclared table (e.g., `lms_connections` or `courses`) in packages/channels/moodle/app/probe.ts fails F5.
    const moodleProbePath = 'packages/channels/moodle/app/zz-probe-sql.ts';
    const undeclaredTableCode = [
      'export function badQuery(sql: { get: (s: string, p: Record<string, unknown>) => unknown }) {',
      "  return sql.get('SELECT id, name FROM lms_connections WHERE library_id = :library_id', { library_id: 'lib_1' });",
      '}',
      '',
    ].join('\n');
    const badTableRes = await f5Text(moodleProbePath, undeclaredTableCode);
    expect(badTableRes.code !== 0, `undeclared table lms_connections in ${moodleProbePath} fails F5:\n${badTableRes.output}`).toBe(true);
    expect(badTableRes.output, 'F5 output mentions channel-sql-tables or undeclared table').toMatch(
      /channel-sql-tables|lms_connections/i,
    );

    // 3. Negative probe 2: declared table `moodle_credentials` with an undeclared column `zz_secret_col` fails F5.
    const undeclaredColCode = [
      'export function badColQuery(sql: { get: (s: string, p: Record<string, unknown>) => unknown }) {',
      "  return sql.get('SELECT connection_id, zz_secret_col FROM moodle_credentials WHERE library_id = :library_id', { library_id: 'lib_1' });",
      '}',
      '',
    ].join('\n');
    const badColRes = await f5Text(moodleProbePath, undeclaredColCode);
    expect(badColRes.code !== 0, `undeclared column zz_secret_col in ${moodleProbePath} fails F5:\n${badColRes.output}`).toBe(true);
    expect(badColRes.output, 'F5 output mentions channel-sql-tables or zz_secret_col').toMatch(
      /channel-sql-tables|zz_secret_col/i,
    );

    // 4. Positive probe: declared tables (`moodle_credentials`, `mbz_builds`) and declared columns pass F5.
    const declaredSqlCode = [
      'export function allowedQuery(sql: { get: (s: string, p: Record<string, unknown>) => unknown }) {',
      "  return sql.get('SELECT connection_id, token_ciphertext, status FROM moodle_credentials WHERE library_id = :library_id', { library_id: 'lib_1' });",
      '}',
      '',
    ].join('\n');
    const goodSqlRes = await f5Text(moodleProbePath, declaredSqlCode);
    expect(goodSqlRes.code, `declared table and columns in ${moodleProbePath} pass F5:\n${goodSqlRes.output}`).toBe(0);

    // 5. Verify baseline P5-P7 ports on loaded adapters (BD-A1-20, BD-A1-28) and ports.ts remains types-only.
    const portsAbs = path.join(ROOT, PORTS_REL);
    const sourceText = fs.readFileSync(portsAbs, 'utf8');
    const sf = ts.createSourceFile(portsAbs, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const stmt of sf.statements) {
      const isTypeOnly =
        ts.isInterfaceDeclaration(stmt) ||
        ts.isTypeAliasDeclaration(stmt) ||
        (ts.isImportDeclaration(stmt) && Boolean(stmt.importClause?.isTypeOnly)) ||
        (ts.isExportDeclaration(stmt) && Boolean(stmt.isTypeOnly));
      expect(isTypeOnly, `${PORTS_REL} statement is type-only: ${stmt.getText(sf).slice(0, 80)}`).toBe(true);
    }

    const canvasSetup = unwrapSetup(loadedById.get('canvas')?.appAdapter);
    const moodleSetup = unwrapSetup(loadedById.get('moodle')?.appAdapter);
    const blackboardSetup = unwrapSetup(loadedById.get('blackboard')?.appAdapter);

    // Canvas P5 extensionRoutes: GET canvas-configuration and POST deployments
    expect(Array.isArray(canvasSetup.extensionRoutes), 'canvas has extensionRoutes').toBe(true);
    const canvasConfigRoute = canvasSetup.extensionRoutes!.find(
      (r) => r.method === 'GET' && r.path === 'canvas-configuration',
    );
    const canvasDeplRoute = canvasSetup.extensionRoutes!.find(
      (r) => r.method === 'POST' && r.path === 'deployments',
    );
    expect(canvasConfigRoute, 'canvas has GET canvas-configuration extensionRoute').toBeDefined();
    expect(canvasConfigRoute!.capability).toBe('app.canvasConfiguration');
    expect(canvasConfigRoute!.legacyCapabilityName).toBe('canvasConfiguration');
    expect(canvasDeplRoute, 'canvas has POST deployments extensionRoute').toBeDefined();
    expect(canvasDeplRoute!.capability).toBe('app.addDeployment');
    expect(canvasDeplRoute!.legacyCapabilityName).toBe('addDeployment');

    // Moodle P5-P7: PUT web-services, publishHooks (createMoodleCourse), packageExporters (mbz)
    expect(Array.isArray(moodleSetup.extensionRoutes), 'moodle has extensionRoutes').toBe(true);
    const moodleWsRoute = moodleSetup.extensionRoutes!.find(
      (r) => r.method === 'PUT' && r.path === 'web-services',
    );
    expect(moodleWsRoute, 'moodle has PUT web-services extensionRoute').toBeDefined();
    expect(moodleWsRoute!.capability).toBe('app.webServices');
    expect(moodleWsRoute!.legacyCapabilityName).toBe('webServices');

    expect(Array.isArray(moodleSetup.publishHooks), 'moodle has publishHooks').toBe(true);
    const moodleShellHook = moodleSetup.publishHooks!.find((h) => h.option === 'createMoodleCourse');
    expect(moodleShellHook, 'moodle has createMoodleCourse publishHook').toBeDefined();
    expect(moodleShellHook!.capability).toBe('app.courseShell');

    expect(Array.isArray(moodleSetup.packageExporters), 'moodle has packageExporters').toBe(true);
    const mbzExporter = moodleSetup.packageExporters!.find((e) => e.id === 'mbz');
    expect(mbzExporter, 'moodle has mbz packageExporter').toBeDefined();
    expect(mbzExporter!.formats).toEqual(expect.arrayContaining(['mbz', 'moodle_backup']));

    // Blackboard has no extension routes, publish hooks, or package exporters.
    expect(blackboardSetup.extensionRoutes ?? []).toEqual([]);
    expect(blackboardSetup.publishHooks ?? []).toEqual([]);
    expect(blackboardSetup.packageExporters ?? []).toEqual([]);

    // Compare Canvas canvas-configuration route output against G1.canvasConfiguration if PortContext stub has the JWK fixture.
    expect(fs.existsSync(GOLDEN_G1_PATH), 'G1.json exists').toBe(true);
    const g1 = JSON.parse(fs.readFileSync(GOLDEN_G1_PATH, 'utf8')) as {
      canvasConfiguration: {
        'jwk=url': Record<string, unknown>;
        'jwk=inline': Record<string, unknown>;
      };
    };

    const inlineJwk = (
      (g1.canvasConfiguration['jwk=inline'].public_jwk as Record<string, unknown> | undefined) ?? {}
    );
    const stubCtx: Record<string, unknown> = {
      libraryId: 'acc-1',
      connectionId: 'con-canvas-1',
      publicAppOrigin: 'https://app.cogniate.test:9443',
      publicLtiOrigin: 'https://lti.cogniate.test:9443',
      outbound: {
        getJson: async (url: string) => {
          if (url.includes('jwks')) return { keys: [inlineJwk] };
          throw new Error(`Unexpected outbound.getJson(${url})`);
        },
        postJson: async () => {
          throw new Error('Unexpected outbound.postJson');
        },
        postForm: async () => {
          throw new Error('Unexpected outbound.postForm');
        },
      },
      sql: {
        get: () => undefined,
        all: () => [],
        run: () => ({ changes: 0 }),
      },
      seal: async () => new Uint8Array(),
      unseal: async () => '',
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      traceId: 'trace-e1-08',
      now: () => 1700000000000,
    };

    const urlOut = await canvasConfigRoute!.handle({ body: undefined, query: { jwk: 'url' } }, stubCtx);
    expect(urlOut.status).toBe(200);
    expect(urlOut.body).toEqual(g1.canvasConfiguration['jwk=url']);

    const inlineOut = await canvasConfigRoute!.handle({ body: undefined, query: { jwk: 'inline' } }, stubCtx);
    expect(inlineOut.status).toBe(200);
    expect(inlineOut.body).toEqual(g1.canvasConfiguration['jwk=inline']);

    artifact(
      'e1-08-ac04-f5-and-ports.json',
      `${JSON.stringify(
        {
          badTableCode: badTableRes.code,
          badColCode: badColRes.code,
          goodSqlCode: goodSqlRes.code,
          canvasExtensionRoutes: canvasSetup.extensionRoutes!.map((r) => `${r.method} ${r.path}`),
          moodleExtensionRoutes: moodleSetup.extensionRoutes!.map((r) => `${r.method} ${r.path}`),
          moodlePublishHooks: moodleSetup.publishHooks!.map((h) => h.option),
          moodlePackageExporters: moodleSetup.packageExporters!.map((e) => e.id),
        },
        null,
        2,
      )}\n`,
    );
  });

  it('AC-LA-E1-08-09: the six removed core files no longer exist, and F1 counts of every core file changed by this task go down or stay (RQ-3)', async () => {
    expect(clean.code, 'npm run check exits 0 on the clean tree').toBe(0);
    const echoes = scriptEchoes(clean.output);
    expect(echoes.some((s) => /fitness:lms-names|lms-names/.test(s)), 'npm run check ran F1').toBe(true);

    // 1. The six removed core files do not exist on disk or in git.
    for (const rel of REMOVED_CORE_FILES) {
      expect(fs.existsSync(path.join(ROOT, rel)), `${rel} does not exist on disk`).toBe(false);
      const tracked = git(['ls-files', rel]).trim();
      expect(tracked, `${rel} is not tracked in git`).toBe('');
    }

    // 2. F1 counts of every core file changed between BASE_SHA and HEAD go down or stay (RQ-3).
    const baseSha = git(['rev-parse', BASE_SHA]);
    const headSha = git(['rev-parse', 'HEAD']);
    const changedFiles = git(['diff', '--name-only', baseSha, headSha]).split('\n').filter(Boolean);
    const changedCore = changedFiles.filter(isF1Core);
    expect(changedCore.length, `changed core files between ${baseSha} and ${headSha}`).toBeGreaterThan(0);

    const deltas: Array<{ file: string; baseHits: number | null; headHits: number }> = [];
    for (const rel of changedCore) {
      if (!fileExistsAt(headSha, rel)) {
        deltas.push({ file: rel, baseHits: null, headHits: 0 });
        continue;
      }
      const headRes = await f1Text(rel, git(['show', `${headSha}:${rel}`]));
      expect(headRes.code, `${rel}: passes F1 ratchet at HEAD; output:\n${headRes.output}`).toBe(0);
      const headHits = f1Hits(headRes.output).filter((h) => h.path === rel).length;

      let baseHits: number | null = null;
      if (fileExistsAt(baseSha, rel)) {
        const baseRes = await f1Text(rel, git(['show', `${baseSha}:${rel}`]));
        baseHits = f1Hits(baseRes.output).filter((h) => h.path === rel).length;
        expect(
          headHits,
          `${rel}: F1 hit count at HEAD (${headHits}) <= at ${baseSha.slice(0, 7)} (${baseHits})`,
        ).toBeLessThanOrEqual(baseHits);
      } else {
        expect(headHits, `new core file ${rel} has 0 F1 hits`).toBe(0);
      }
      deltas.push({ file: rel, baseHits, headHits });
    }

    const baseBaseline = readBaselineCounts(baseSha);
    const headBaseline = readBaselineCounts(headSha);
    expect(headBaseline !== null, 'f1-baseline.json exists at HEAD').toBe(true);
    if (baseBaseline && headBaseline) {
      for (const [file, headCount] of Object.entries(headBaseline)) {
        const prev = baseBaseline[file] ?? 0;
        expect(headCount, `f1-baseline.json ${file}: ${headCount} <= ${prev} (RQ-3)`).toBeLessThanOrEqual(prev);
      }
      for (const removed of REMOVED_CORE_FILES) {
        expect(headBaseline[removed] ?? 0, `${removed} is 0 or absent in f1-baseline.json`).toBe(0);
      }
    }

    artifact('e1-08-ac09-f1-deltas.json', `${JSON.stringify({ baseSha, headSha, deltas }, null, 2)}\n`);
  });
});
