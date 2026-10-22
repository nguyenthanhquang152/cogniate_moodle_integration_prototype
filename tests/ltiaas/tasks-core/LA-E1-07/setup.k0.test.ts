// LA-E1-07 K0 acceptance tests:
// - AC-LA-E1-07-01: K-ADAPTER for each baseline channel (toolConfiguration rows equal G1 golden rows, strict body
//   refuses one unknown field and one missing field, initialTarget target kind is exclusive_platform or
//   shared_deployment, only Moodle has selfCreate).
// - AC-LA-E1-07-02: Each app.ts runs with throwing database and LTI client stubs and every ConnectionSetup port call
//   succeeds with no database and no LTI call.
// - AC-LA-E1-07-03: services/cogniate-app/src/kernel/ports.ts exists, contains only types, and a QA file that
//   type-imports ConnectionSetup, PortContext and ChannelSql compiles.
// - AC-LA-E1-07-09: services/cogniate-app/src/providers/ no longer exists, and F1 counts of every core file changed by
//   this task go down or stay (RQ-3).
// Source: docs/architecture/ltiaas/tasks/LA-E1-07.md; LA-ADR-01 D1, D5, D6, D7, D9; contracts/cogniate-app-api-delta.md
// §2, §7; TEST-STRATEGY §2.3, §2.7, §3.2. QA-3 wrote these tests from the spec and design only (test-first).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT, artifact, f1Hits, f1Text, git, isF1Core, npmCheck, requireRunDir, requireScratchClone, run, scriptEchoes,
  type RunResult,
} from '../LA-E1-04/fitness';

const BASELINE_IDS = ['moodle', 'canvas', 'blackboard'] as const;
type BaselineId = (typeof BASELINE_IDS)[number];

const PORTS_REL = 'services/cogniate-app/src/kernel/ports.ts';
const PROVIDERS_DIR_REL = 'services/cogniate-app/src/providers';
const BASE_SHA = process.env.LA_BASE_SHA ?? 'HEAD~1';
const GOLDEN_G1_PATH = path.join(
  ROOT,
  'tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/G1.json',
);

interface ToolConfigRow {
  key: string;
  label: string;
  value: string;
}

interface ConnectionSetupLike {
  checkCreate?: (ctx: Record<string, unknown>) => unknown;
  toolConfiguration?: (ctx: Record<string, unknown>) => ToolConfigRow[] | { rows: ToolConfigRow[] };
  parseBindingBody: (body: unknown, ctx: Record<string, unknown>) => unknown;
  selfCreate?: (body: unknown, ctx: Record<string, unknown>) => unknown;
  initialTarget?: (ctx: Record<string, unknown>) => unknown;
  createRequest?: (target: unknown, ctx: Record<string, unknown>, ref?: string) => unknown;
}

interface LoadedChannel {
  folder: string;
  manifest: Record<string, unknown> & { id: string };
  appAdapter?: unknown;
}

interface KernelSurface {
  loadChannelFolders(roots: readonly string[], side: 'lti' | 'app'): Promise<LoadedChannel[]>;
  buildChannelRegistry(
    channels: readonly LoadedChannel[],
    options?: { side?: 'lti' | 'app'; simulations?: boolean },
  ): unknown;
  familyGuardVerdict?: (
    registry: unknown,
    family: string | null | undefined,
    profileChannel: string | null | undefined,
    phase: 'registration' | 'launch',
  ) => { kind: 'pass' } | { kind: 'refuse' | 'log'; family: string; guardChannel: string };
}

let clean: RunResult;
let kernel: KernelSurface;
let loadedById: Map<string, LoadedChannel>;

function makeThrowingStub(label: string): unknown {
  const fail = (op: string): never => {
    throw new Error(`Forbidden ${label} access in ConnectionSetup port (${op})`);
  };
  return new Proxy(function () {
    return fail('call');
  }, {
    get(_target, prop) {
      if (prop === 'then') return undefined;
      return fail(`get:${String(prop)}`);
    },
    apply() {
      return fail('apply');
    },
  });
}

function unwrapSetup(appAdapter: unknown): ConnectionSetupLike {
  expect(appAdapter && typeof appAdapter === 'object', 'appAdapter is an object').toBe(true);
  const obj = appAdapter as Record<string, unknown>;
  if (typeof obj.parseBindingBody === 'function') {
    return obj as unknown as ConnectionSetupLike;
  }
  if (obj.setup && typeof obj.setup === 'object' && typeof (obj.setup as Record<string, unknown>).parseBindingBody === 'function') {
    return obj.setup as unknown as ConnectionSetupLike;
  }
  if (obj.default && typeof obj.default === 'object') {
    return unwrapSetup(obj.default);
  }
  return obj as unknown as ConnectionSetupLike;
}

function normalizeRows(res: ToolConfigRow[] | { rows: ToolConfigRow[] }): ToolConfigRow[] {
  return Array.isArray(res) ? res : res.rows;
}

function isProblemLike(val: unknown): val is { status?: number; code?: string; details?: Record<string, unknown> } {
  if (!val || typeof val !== 'object') return false;
  const o = val as Record<string, unknown>;
  return (
    typeof o.code === 'string' &&
    (typeof o.status === 'number' || typeof o.title === 'string' || typeof o.detail === 'string' || o.ok === false)
  );
}

function invokeExpectingRefusal(fn: () => unknown): { refused: boolean; detailText: string } {
  try {
    const out = fn();
    if (isProblemLike(out)) {
      return { refused: true, detailText: JSON.stringify(out) };
    }
    if (out && typeof out === 'object' && 'ok' in (out as Record<string, unknown>) && (out as Record<string, unknown>).ok === false) {
      return { refused: true, detailText: JSON.stringify(out) };
    }
    return { refused: false, detailText: JSON.stringify(out) };
  } catch (err) {
    return { refused: true, detailText: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
}

function buildPortContext(channelId: BaselineId, manifest: Record<string, unknown>): Record<string, unknown> {
  const siteByChannel: Record<BaselineId, string> = {
    moodle: 'https://moodle.test:9443',
    canvas: 'https://school-a.canvas.sim.test',
    blackboard: 'https://learn-a.blackboard.sim.test',
  };
  const profileByChannel: Record<BaselineId, string> = {
    moodle: 'standard',
    canvas: 'canvas-sim-cloud',
    blackboard: 'blackboard-sim',
  };
  const siteUrl = siteByChannel[channelId];
  const connection: Record<string, unknown> = {
    id: `con-${channelId}-1`,
    libraryId: 'acc-1',
    name: `Golden ${channelId}`,
    lms: channelId,
    channel: channelId,
    channelName: (manifest.names as { label?: string } | undefined)?.label ?? channelId,
    profile: profileByChannel[channelId],
    method: 'manual',
    status: 'pending',
    siteUrl,
    serviceUrl: siteUrl,
    ltiPlatformId: null,
    targetIssuer: channelId === 'canvas' ? 'https://canvas.sim.test' : channelId === 'blackboard' ? 'https://blackboard.sim.test' : null,
    targetPlatformId: channelId === 'blackboard' ? 'plt-bb-shared-1' : null,
    targetClientId: channelId === 'blackboard' ? 'qa-bb-app' : null,
    platform: channelId === 'blackboard'
      ? {
          id: 'plt-bb-shared-1',
          issuer: 'https://blackboard.sim.test',
          clientId: 'qa-bb-app',
          deploymentIds: ['golden-bb-1'],
          productFamilyCode: null,
          siteUrl,
          serviceUrl: siteUrl,
        }
      : null,
  };
  const dbStub = makeThrowingStub('db');
  const ltiStub = makeThrowingStub('lti');
  return {
    account: { id: 'acc-1', slug: 'cogniate', name: "Thanh's Library" },
    libraryName: "Thanh's Library",
    toolAccountId: 'cogniate',
    urls: {
      app: 'https://app.cogniate.test:9443',
      lti: 'https://lti.cogniate.test:9443',
      player: 'https://player.cogniate.test:9443',
    },
    toolUrls: {
      login: 'https://lti.cogniate.test:9443/lti/login/cogniate',
      launch: 'https://lti.cogniate.test:9443/lti/launch/cogniate',
      keys: 'https://lti.cogniate.test:9443/lti/keys/cogniate',
      register: 'https://lti.cogniate.test:9443/lti/register/cogniate',
      ltiOrigin: 'https://lti.cogniate.test:9443',
    },
    siteUrl,
    serviceUrl: siteUrl,
    sharedClientId: channelId === 'blackboard' ? 'qa-bb-app' : null,
    purpose: 'initial',
    connection,
    channel: manifest,
    publicAppUrl: 'https://app.cogniate.test:9443',
    publicLtiUrl: 'https://lti.cogniate.test:9443',
    publicAppOrigin: 'https://app.cogniate.test:9443',
    publicLtiOrigin: 'https://lti.cogniate.test:9443',
    profile: {
      id: profileByChannel[channelId],
      issuer: channelId === 'canvas' ? 'https://canvas.sim.test' : channelId === 'blackboard' ? 'https://blackboard.sim.test' : siteUrl,
      sharing: channelId === 'blackboard' ? 'shared' : 'exclusive',
      serviceUrl: channelId === 'canvas',
    },
    sharedPlatform: channelId === 'blackboard' ? { id: 'plt-bb-shared-1', clientId: 'qa-bb-app' } : null,
    targetClientId: channelId === 'blackboard' ? 'qa-bb-app' : null,
    snapshot: {
      targetIssuer: connection.targetIssuer,
      targetPlatformId: connection.targetPlatformId,
      targetClientId: connection.targetClientId,
    },
    db: dbStub,
    sql: dbStub,
    lti: ltiStub,
    ltiClient: ltiStub,
  };
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
  clean = await npmCheck('e1-07-check-clean');
  const kernelEntry = pathToFileURL(path.join(ROOT, 'packages/channel-kernel/src/index.ts')).href;
  kernel = (await import(kernelEntry)) as KernelSurface;
  const loaded = await kernel.loadChannelFolders([path.join(ROOT, 'packages/channels')], 'app');
  loadedById = new Map(loaded.map((c) => [c.manifest.id, c]));
});

describe('LA-E1-07 ConnectionSetup port, authority strategies and baseline channel app.ts (K0)', () => {
  it('AC-LA-E1-07-01: K-ADAPTER for each baseline channel: toolConfiguration rows equal G1 golden, strict body refuses unknown and missing fields, initialTarget kind matches, only Moodle has selfCreate', () => {
    expect(fs.existsSync(GOLDEN_G1_PATH), `golden G1 exists at ${GOLDEN_G1_PATH}`).toBe(true);
    const rawG1 = JSON.parse(fs.readFileSync(GOLDEN_G1_PATH, 'utf8')) as {
      toolConfiguration?: Record<BaselineId, ToolConfigRow[]>;
      acceptance?: { toolConfiguration: Record<BaselineId, ToolConfigRow[]> };
    };
    const g1ToolConfig = rawG1.toolConfiguration ?? rawG1.acceptance!.toolConfiguration;

    const validBodies: Record<BaselineId, Record<string, unknown>> = {
      moodle: {
        issuer: 'https://moodle.test:9443',
        clientId: 'moodle-client-1',
        deploymentId: '1',
        authenticationEndpoint: 'https://moodle.test:9443/mod/lti/auth.php',
        accessTokenEndpoint: 'https://moodle.test:9443/mod/lti/token.php',
        jwksUrl: 'https://moodle.test:9443/mod/lti/certs.php',
      },
      canvas: {
        clientId: '10000000000042',
        deploymentId: '7:42',
        grantCode: 'A'.repeat(43),
      },
      blackboard: {
        deploymentId: 'golden-bb-1',
        grantCode: 'B'.repeat(43),
        clientId: 'qa-bb-app',
      },
    };

    const missingFieldKey: Record<BaselineId, string> = {
      moodle: 'jwksUrl',
      canvas: 'grantCode',
      blackboard: 'deploymentId',
    };

    const report: Record<string, unknown> = {};

    for (const id of BASELINE_IDS) {
      const entry = loadedById.get(id);
      expect(entry, `channel ${id} loaded by loadChannelFolders(..., 'app')`).toBeDefined();
      expect(entry!.appAdapter, `${id}: appAdapter is defined`).toBeDefined();
      const setup = unwrapSetup(entry!.appAdapter);
      const ctx = buildPortContext(id, entry!.manifest);

      // 1. toolConfiguration rows equal G1 golden rows.
      expect(typeof setup.toolConfiguration, `${id}: toolConfiguration is a function`).toBe('function');
      const rows = normalizeRows(setup.toolConfiguration!(ctx));
      expect(rows, `${id}: toolConfiguration rows equal G1.toolConfiguration.${id}`).toEqual(g1ToolConfig[id]);

      // 2. Strict body: valid body succeeds; one missing field and one unknown field are refused.
      expect(typeof setup.parseBindingBody, `${id}: parseBindingBody is a function`).toBe('function');
      const validOut = setup.parseBindingBody(validBodies[id], ctx) as Record<string, unknown>;
      expect(isProblemLike(validOut) || validOut.ok === false, `${id}: valid binding body is accepted`).toBe(false);

      const missingBody = { ...validBodies[id] };
      delete missingBody[missingFieldKey[id]];
      const missingRes = invokeExpectingRefusal(() => setup.parseBindingBody(missingBody, ctx));
      expect(missingRes.refused, `${id}: missing field ${missingFieldKey[id]} is refused (${missingRes.detailText})`).toBe(true);
      expect(missingRes.detailText, `${id}: missing-field refusal names ${missingFieldKey[id]}`).toContain(missingFieldKey[id]);

      const unknownBody = { ...validBodies[id], zzUnknownField: 'unexpected' };
      const unknownRes = invokeExpectingRefusal(() => setup.parseBindingBody(unknownBody, ctx));
      expect(unknownRes.refused, `${id}: unknown field zzUnknownField is refused (${unknownRes.detailText})`).toBe(true);
      expect(unknownRes.detailText, `${id}: unknown-field refusal names zzUnknownField`).toContain('zzUnknownField');

      // 3. Only Moodle has selfCreate; Canvas and Blackboard have initialTarget with exclusive_platform / shared_deployment.
      if (id === 'moodle') {
        expect(typeof setup.selfCreate, 'moodle: has selfCreate').toBe('function');
      } else {
        expect(setup.selfCreate, `${id}: does not have selfCreate`).toBeUndefined();
        expect(typeof setup.initialTarget, `${id}: has initialTarget`).toBe('function');
        const values = (validOut && typeof validOut === 'object' && 'values' in validOut)
          ? (validOut.values as Record<string, unknown>)
          : validOut;
        const target = setup.initialTarget!({
          connection: ctx.connection,
          values,
          profile: ctx.profile,
          sharedPlatform: ctx.sharedPlatform,
          db: ctx.db,
          lti: ctx.lti,
        }) as Record<string, unknown>;
        expect(isProblemLike(target), `${id}: initialTarget succeeds on valid snapshot`).toBe(false);
        const kind = target.kind ?? target.targetKind;
        const expectedKind = id === 'canvas' ? 'exclusive_platform' : 'shared_deployment';
        expect(kind, `${id}: initialTarget kind is ${expectedKind}`).toBe(expectedKind);
      }

      report[id] = {
        toolConfigRowCount: rows.length,
        hasSelfCreate: typeof setup.selfCreate === 'function',
        hasInitialTarget: typeof setup.initialTarget === 'function',
      };
    }

    artifact('e1-07-ac01-k-adapter.json', `${JSON.stringify(report, null, 2)}\n`);
  });

  it('AC-LA-E1-07-02: each baseline app.ts runs with a database stub and an LTI client stub that throw on any access, and every ConnectionSetup port call succeeds', () => {
    const validBodies: Record<BaselineId, Record<string, unknown>> = {
      moodle: {
        issuer: 'https://moodle.test:9443',
        clientId: 'moodle-client-1',
        deploymentId: '1',
        authenticationEndpoint: 'https://moodle.test:9443/mod/lti/auth.php',
        accessTokenEndpoint: 'https://moodle.test:9443/mod/lti/token.php',
        jwksUrl: 'https://moodle.test:9443/mod/lti/certs.php',
      },
      canvas: {
        clientId: '10000000000042',
        deploymentId: '7:42',
        grantCode: 'A'.repeat(43),
      },
      blackboard: {
        deploymentId: 'golden-bb-1',
        grantCode: 'B'.repeat(43),
        clientId: 'qa-bb-app',
      },
    };

    const log: string[] = [];

    for (const id of BASELINE_IDS) {
      const entry = loadedById.get(id)!;
      const setup = unwrapSetup(entry.appAdapter);
      const ctx = buildPortContext(id, entry.manifest);

      if (typeof setup.checkCreate === 'function') {
        const res = setup.checkCreate({
          profile: {
            id: ctx.connection && (ctx.connection as Record<string, unknown>).profile,
            channel: id,
            lms: id === 'moodle' ? null : id,
            sharing: id === 'blackboard' ? 'shared' : 'exclusive',
            serviceUrl: id === 'canvas',
            siteUrlOn: id === 'canvas' ? 'platform' : id === 'blackboard' ? 'deployment' : null,
            ready: true,
            sharedPlatform: id === 'blackboard' ? { id: 'plt-bb-shared-1', clientId: 'qa-bb-app', active: true } : null,
          },
          siteUrl: (ctx.connection as Record<string, unknown>).siteUrl as string,
          serviceUrl: id === 'canvas' ? ((ctx.connection as Record<string, unknown>).serviceUrl as string) : undefined,
          db: ctx.db,
          lti: ctx.lti,
        }) as Record<string, unknown> | undefined;
        expect(res == null || (!isProblemLike(res) && res.ok !== false), `${id}: checkCreate succeeds without db/lti`).toBe(true);
        log.push(`${id}: checkCreate -> ok`);
      }

      if (typeof setup.toolConfiguration === 'function') {
        const rows = normalizeRows(setup.toolConfiguration(ctx));
        expect(rows.length, `${id}: toolConfiguration returns rows without db/lti`).toBeGreaterThan(0);
        log.push(`${id}: toolConfiguration -> ${rows.length} rows`);
      }

      const parsedOut = setup.parseBindingBody(validBodies[id], ctx) as Record<string, unknown>;
      expect(isProblemLike(parsedOut) || parsedOut.ok === false, `${id}: parseBindingBody succeeds without db/lti`).toBe(false);
      const values = (parsedOut && typeof parsedOut === 'object' && 'values' in parsedOut)
        ? (parsedOut.values as Record<string, unknown>)
        : parsedOut;
      log.push(`${id}: parseBindingBody -> ok`);

      if (typeof setup.selfCreate === 'function') {
        const selfVals = {
          ...(values.adminValues && typeof values.adminValues === 'object' ? (values.adminValues as Record<string, unknown>) : {}),
          ...values,
        };
        const req = setup.selfCreate(selfVals, ctx);
        expect(isProblemLike(req), `${id}: selfCreate succeeds without db/lti`).toBe(false);
        expect(req && typeof req === 'object', `${id}: selfCreate returns StagedCreate object`).toBe(true);
        log.push(`${id}: selfCreate -> ok`);
      }

      if (typeof setup.initialTarget === 'function') {
        const target = setup.initialTarget({
          connection: ctx.connection,
          values,
          profile: ctx.profile,
          sharedPlatform: ctx.sharedPlatform,
          db: ctx.db,
          lti: ctx.lti,
        });
        expect(isProblemLike(target), `${id}: initialTarget succeeds without db/lti`).toBe(false);
        log.push(`${id}: initialTarget -> ok`);

        if (typeof setup.createRequest === 'function') {
          const action = setup.createRequest(target, ctx, 'ref-123');
          expect(action && typeof action === 'object', `${id}: createRequest succeeds without db/lti`).toBe(true);
          log.push(`${id}: createRequest -> ok`);
        }
      }
    }

    artifact('e1-07-ac02-no-db-no-lti.log', `${log.join('\n')}\n`);
  });

  it('AC-LA-E1-07-03: services/cogniate-app/src/kernel/ports.ts exists, contains only types, and a QA file that type-imports ConnectionSetup, PortContext and ChannelSql compiles', async () => {
    const portsAbs = path.join(ROOT, PORTS_REL);
    expect(fs.existsSync(portsAbs), `${PORTS_REL} exists`).toBe(true);

    // 1. AST check: every top-level statement in ports.ts is type-only.
    const sourceText = fs.readFileSync(portsAbs, 'utf8');
    const sf = ts.createSourceFile(portsAbs, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const valueStatements: string[] = [];
    for (const stmt of sf.statements) {
      if (ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt)) continue;
      if (ts.isImportDeclaration(stmt)) {
        if (stmt.importClause?.isTypeOnly) continue;
        const bindings = stmt.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every((e) => e.isTypeOnly)) {
          continue;
        }
      }
      if (ts.isExportDeclaration(stmt)) {
        if (stmt.isTypeOnly) continue;
        const clause = stmt.exportClause;
        if (clause && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every((e) => e.isTypeOnly)) {
          continue;
        }
      }
      valueStatements.push(stmt.getText(sf).slice(0, 120));
    }
    expect(valueStatements, `${PORTS_REL} contains only type declarations and type-only imports/exports`).toEqual([]);

    // 2. Runtime import has 0 value exports.
    const runtimeMod = (await import(pathToFileURL(portsAbs).href)) as Record<string, unknown>;
    const runtimeKeys = Object.keys(runtimeMod).filter((k) => k !== '__esModule' && runtimeMod[k] !== undefined);
    expect(runtimeKeys, `${PORTS_REL} has 0 runtime exports`).toEqual([]);

    // 3. Scratch QA file under packages/channels/zz-qa-ports-probe/app.ts type-importing ConnectionSetup, PortContext and ChannelSql compiles.
    const probeDir = path.join(ROOT, 'packages/channels/zz-qa-ports-probe');
    const probeFile = path.join(probeDir, 'app.ts');
    try {
      fs.mkdirSync(probeDir, { recursive: true, mode: 0o700 });
      fs.writeFileSync(
        probeFile,
        [
          "import type { ConnectionSetup, PortContext, ChannelSql } from '../../../services/cogniate-app/src/kernel/ports.js';",
          'export type QaProbeTuple = [ConnectionSetup, PortContext, ChannelSql];',
          '',
        ].join('\n'),
        { mode: 0o600 },
      );
      const tc = await run('npx', ['--no-install', 'tsc', '--noEmit', '-p', 'packages/channels/tsconfig.node.json']);
      artifact('e1-07-ac03-ports-typecheck.log', tc.output);
      expect(tc.code, `type-importing ConnectionSetup, PortContext and ChannelSql compiles; output:\n${tc.output}`).toBe(0);
    } finally {
      fs.rmSync(probeDir, { recursive: true, force: true });
    }
  });

  it('AC-LA-E1-07-09: services/cogniate-app/src/providers/ no longer exists, and F1 counts of every core file changed by this task go down or stay (RQ-3)', async () => {
    expect(clean.code, 'npm run check exits 0 on the clean tree').toBe(0);
    const echoes = scriptEchoes(clean.output);
    expect(echoes.some((s) => /fitness:lms-names|lms-names/.test(s)), 'npm run check ran F1').toBe(true);

    // 1. services/cogniate-app/src/providers/ no longer exists on disk or in git.
    const providersAbs = path.join(ROOT, PROVIDERS_DIR_REL);
    expect(fs.existsSync(providersAbs), `${PROVIDERS_DIR_REL} does not exist on disk`).toBe(false);
    const trackedProviders = git(['ls-files', `${PROVIDERS_DIR_REL}/`]).split('\n').filter(Boolean);
    expect(trackedProviders, `no tracked files under ${PROVIDERS_DIR_REL}/`).toEqual([]);

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
        expect(headHits, `${rel}: F1 hit count at HEAD (${headHits}) <= at ${baseSha.slice(0, 7)} (${baseHits})`).toBeLessThanOrEqual(baseHits);
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
    }

    artifact('e1-07-ac09-f1-deltas.json', `${JSON.stringify({ baseSha, headSha, deltas }, null, 2)}\n`);
  });

  it('BD-A1-40, BD-A1-54, BD-A1-55: kernel contexts supply toolAccountId/toolUrls, @cogniate/channel-kernel/setup pins pure helpers, and familyGuardVerdict implements the two-phase registration/launch table', async () => {
    // 1. BD-A1-40: @cogniate/channel-kernel/setup exports the 4 pure setup helpers and P2 toolConfiguration reads ctx.toolUrls.
    const setupHelperEntry = pathToFileURL(path.join(ROOT, 'packages/channel-kernel/src/setup.ts')).href;
    const setupHelpers = (await import(setupHelperEntry)) as Record<string, unknown>;
    expect(typeof setupHelpers.toolName, 'toolName exported from @cogniate/channel-kernel/setup').toBe('function');
    expect(setupHelpers.PRINTABLE_ID instanceof RegExp, 'PRINTABLE_ID exported').toBe(true);
    expect(setupHelpers.GRANT_CODE instanceof RegExp, 'GRANT_CODE exported').toBe(true);
    expect(typeof setupHelpers.parseStrictBody, 'parseStrictBody exported').toBe('function');

    const customToolUrls = {
      login: 'https://lti-custom.example.test/lti/login/custom-acct',
      launch: 'https://lti-custom.example.test/lti/launch/custom-acct',
      keys: 'https://lti-custom.example.test/lti/keys/custom-acct',
      register: 'https://lti-custom.example.test/lti/register/custom-acct',
      ltiOrigin: 'https://lti-custom.example.test',
    };
    for (const id of BASELINE_IDS) {
      const entry = loadedById.get(id)!;
      const setup = unwrapSetup(entry.appAdapter);
      const ctx = {
        ...buildPortContext(id, entry.manifest),
        toolAccountId: 'custom-acct',
        toolUrls: customToolUrls,
      };
      const rows = normalizeRows(setup.toolConfiguration!(ctx));
      const allValues = rows.map((r) => r.value).join('\n');
      expect(allValues, `${id}: toolConfiguration uses injected toolUrls.launch`).toContain(customToolUrls.launch);
      if (id !== 'canvas') {
        expect(allValues, `${id}: toolConfiguration uses injected toolUrls.login`).toContain(customToolUrls.login);
        expect(allValues, `${id}: toolConfiguration uses injected toolUrls.keys`).toContain(customToolUrls.keys);
      }
    }

    // 2. BD-A1-54 / BD-A1-55: familyGuardVerdict two-phase table ('registration' vs 'launch').
    expect(typeof kernel.familyGuardVerdict, 'familyGuardVerdict is exported from @cogniate/channel-kernel').toBe(
      'function',
    );
    const verdictFn = kernel.familyGuardVerdict!;
    const moodleManifest = loadedById.get('moodle')!.manifest as Record<string, unknown>;
    const regGuardChannel: LoadedChannel = {
      folder: '/tmp/zz-reg-guard',
      manifest: {
        ...moodleManifest,
        id: 'zz-reg-guard',
        names: { label: 'ZZ Reg', text: 'ZZ Reg' },
        card: { ...(moodleManifest.card as Record<string, unknown>), order: 99 },
        lti: {
          ...(moodleManifest.lti as Record<string, unknown>),
          guardedFamilies: [{ family: 'zz-family', level: 'registration' }],
        },
        registration: [
          {
            method: 'dynamic',
            profiles: ['zz-reg-profile'],
            defaultProfile: 'zz-reg-profile',
            authority: 'operatorGrant',
          },
        ],
      },
    };
    const testRegistry = kernel.buildChannelRegistry(
      [...loadedById.values(), regGuardChannel],
      { side: 'app', simulations: true },
    );

    // Pass: absent, empty, unguarded, or own channel.
    expect(verdictFn(testRegistry, undefined, 'moodle', 'registration')).toEqual({ kind: 'pass' });
    expect(verdictFn(testRegistry, '', 'moodle', 'launch')).toEqual({ kind: 'pass' });
    expect(verdictFn(testRegistry, 'moodle', 'moodle', 'registration')).toEqual({ kind: 'pass' });
    expect(verdictFn(testRegistry, 'canvas', 'canvas', 'registration')).toEqual({ kind: 'pass' });
    expect(verdictFn(testRegistry, 'canvas', 'canvas', 'launch')).toEqual({ kind: 'pass' });
    expect(verdictFn(testRegistry, 'zz-family', 'zz-reg-guard', 'registration')).toEqual({ kind: 'pass' });
    expect(verdictFn(testRegistry, 'zz-family', 'zz-reg-guard', 'launch')).toEqual({ kind: 'pass' });

    // Registration phase: any guard of another channel refuses (both 'launch'-level and 'registration'-level).
    expect(verdictFn(testRegistry, 'canvas', 'moodle', 'registration')).toEqual({
      kind: 'refuse',
      family: 'canvas',
      guardChannel: 'canvas',
    });
    expect(verdictFn(testRegistry, 'zz-family', 'moodle', 'registration')).toEqual({
      kind: 'refuse',
      family: 'zz-family',
      guardChannel: 'zz-reg-guard',
    });
    expect(verdictFn(testRegistry, 'zz-family', 'canvas', 'registration')).toEqual({
      kind: 'refuse',
      family: 'zz-family',
      guardChannel: 'zz-reg-guard',
    });

    // Launch phase: 'launch'-level guard of another channel refuses; 'registration'-level guard refuses only on
    // MANUAL_SELF_LEGACY_CHANNELS ('moodle'), else logs ('log').
    expect(verdictFn(testRegistry, 'canvas', 'moodle', 'launch')).toEqual({
      kind: 'refuse',
      family: 'canvas',
      guardChannel: 'canvas',
    });
    expect(verdictFn(testRegistry, 'blackboardlearn', 'canvas', 'launch')).toEqual({
      kind: 'refuse',
      family: 'blackboardlearn',
      guardChannel: 'blackboard',
    });
    expect(verdictFn(testRegistry, 'zz-family', 'moodle', 'launch')).toEqual({
      kind: 'refuse',
      family: 'zz-family',
      guardChannel: 'zz-reg-guard',
    });
    expect(verdictFn(testRegistry, 'zz-family', 'canvas', 'launch')).toEqual({
      kind: 'log',
      family: 'zz-family',
      guardChannel: 'zz-reg-guard',
    });
  });
});
