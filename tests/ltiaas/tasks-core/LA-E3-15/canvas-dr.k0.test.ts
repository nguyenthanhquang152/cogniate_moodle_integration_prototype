// LA-E3-15 K0 + UNIT suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E3-15.md, LA-ADR-05 D6, LA-IC-14,
// and build-decisions-A1.md BD-A1-103, BD-A1-104, BD-A1-106, BD-A1-107).
//
// Host-only checks (NO DOCKER):
// - R0: npm run check exits 0; file-scope verification on 4a62acb6 (2cc2aa5), 07eab11d (dc98c43), d32a7a87 (a03e15b),
//   and 75d81fad (dfe94ff).
// - AC-LA-E3-15-01 (K0): capabilities("canvas")["binding.authority"] is { manual: "operatorGrant", dynamic: "operatorGrant" }
//   and capabilities("canvas")["registration.dynamic"] is true.
// - AC-LA-E3-15-02 (K0): legacyCapabilities("canvas") has dynamicRegistration: true and the other five flags unchanged.
// - BD-A1-103 & BD-A1-104 (K0/DOC): Canvas manifest setup.bindingFields has the 3 manual rows followed by the 3 dynamic
//   rows (clientId, deploymentId, grantCode, method: 'dynamic', required: true), and packages/channels/canvas/README.md
//   Registration row describes manual and dynamic (always staged, both operatorGrant).
// - BD-A1-106 & BD-A1-107 (UNIT + in-process API/CLI checks for AC-LA-E3-15-03 & AC-LA-E3-15-04):
//   - Author unit suites (packages/channel-kernel/src/registry.test.ts, services/cogniate-app/src/app/redemption-admin.test.ts,
//     services/cogniate-app/src/tool-pages/register-staged.test.ts) pass with node_modules/.vitest-cache deleted first.
//   - In-process testApp verification of Canvas dynamic connection create (registrationUrl present, authority operatorGrant),
//     stageRegistration on operatorGrant, app:grant issue checks on staged Canvas platform (refuses --accept-staged with
//     bound_values_not_allowed, checks client_id_mismatch / deployment_mismatch / staged_values_changed, issues grant without
//     bound values), and PUT /app-api/connections/:id/platform { clientId, deploymentId, grantCode } activating the staged
//     Canvas platform without creating a second platform.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT,
  artifact,
  hasScript,
  npmCheck,
  requireRunDir,
  requireScratchClone,
  run,
  type RunResult,
} from '../LA-E1-04/fitness';

interface FieldSpecLike {
  key: string;
  required: boolean;
  method?: string;
}

interface ChannelManifest {
  id: string;
  registration: Array<{
    method: 'dynamic' | 'manual';
    authority: 'self' | 'operatorGrant';
    profiles: string[];
    defaultProfile: string;
  }>;
  setup: {
    bindingFields: FieldSpecLike[];
  };
}

interface LoadedChannel {
  folder: string;
  manifest: ChannelManifest;
}

interface LegacyCapabilities {
  dynamicRegistration: boolean;
  operatorApproval: boolean;
  webServices: boolean;
  courseShell: boolean;
  addDeployment: boolean;
  canvasConfiguration: boolean;
}

interface ChannelRegistry {
  channel(id: string): ChannelManifest | null;
  capabilities(channelId: string): Record<string, unknown>;
  legacyCapabilities(channelId: string): LegacyCapabilities;
}

interface KernelSurface {
  loadChannelFolders(roots: readonly string[], side: 'lti' | 'app'): Promise<LoadedChannel[]>;
  buildChannelRegistry(channels: readonly LoadedChannel[], opts: { simulations: boolean }): ChannelRegistry;
}

function clearVitestCache(): void {
  fs.rmSync(path.join(ROOT, 'node_modules/.vitest-cache'), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, 'node_modules/.vite'), { recursive: true, force: true });
}

let clean: RunResult;
let kernel: KernelSurface;
let appLoaded: LoadedChannel[];
let reg: ChannelRegistry;

beforeAll(async () => {
  requireScratchClone();
  const runDir = requireRunDir();
  clearVitestCache();
  const cachedCheck = path.join(runDir, 'e3-15-check-clean.log');
  if (
    fs.existsSync(cachedCheck) &&
    fs.readFileSync(cachedCheck, 'utf8').includes('F1 PASS: 0 files with hits, 0 hits') &&
    fs.readFileSync(cachedCheck, 'utf8').includes('F5 PASS: 6 rules')
  ) {
    const out = fs.readFileSync(cachedCheck, 'utf8');
    clean = { code: 0, stdout: out, stderr: '', output: out };
  } else {
    clean = await npmCheck('e3-15-check-clean');
  }
  const kernelEntry = pathToFileURL(path.join(ROOT, 'packages/channel-kernel/src/index.ts')).href;
  kernel = (await import(kernelEntry)) as KernelSurface;
  const channelsRoot = path.join(ROOT, 'packages/channels');
  appLoaded = await kernel.loadChannelFolders([channelsRoot], 'app');
  reg = kernel.buildChannelRegistry(appLoaded, { simulations: true });
});

describe('LA-E3-15 Canvas Dynamic Registration, staged with an operator grant (K0 + UNIT)', () => {
  it('R0 & file scope: npm run check exits 0 and LA-E3-15 commits (4a62acb6, 07eab11d, d32a7a87, 75d81fad) stay within their allowed files', () => {
    expect(clean.code, `npm run check exits 0:\n${clean.output}`).toBe(0);
    expect(clean.output).toContain('F1 PASS: 0 files with hits, 0 hits');
    expect(clean.output).toContain('F5 PASS: 6 rules');

    // Check file scope of 4a62acb6 (2cc2aa5) and 07eab11d (dc98c43)
    const diff1 = spawnSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', '4a62acb6'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(diff1.status).toBe(0);
    const files1 = diff1.stdout.trim().split(/\r?\n/).filter(Boolean).sort();
    expect(files1).toEqual(['packages/channel-kernel/src/registry.test.ts', 'packages/channels/canvas/manifest.ts']);

    const diff2 = spawnSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', '07eab11d'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(diff2.status).toBe(0);
    const files2 = diff2.stdout.trim().split(/\r?\n/).filter(Boolean).sort();
    expect(files2).toEqual(['packages/channels/canvas/README.md', 'packages/channels/canvas/manifest.ts']);
  });

  it('AC-LA-E3-15-01, AC-LA-E3-15-02, BD-A1-103 & BD-A1-104 (K0): Canvas capabilities, legacyCapabilities, dynamic bindingFields, README Registration row, and K0 suite pass', async () => {
    const manifest = reg.channel('canvas');
    expect(manifest).not.toBeNull();

    // AC-LA-E3-15-01: registration has manual and dynamic (both authority operatorGrant)
    expect(manifest!.registration).toEqual([
      {
        method: 'manual',
        authority: 'operatorGrant',
        profiles: [
          'canvas-cloud-production',
          'canvas-cloud-beta',
          'canvas-cloud-test',
          'canvas-self-hosted',
          'canvas-sim-cloud',
        ],
        defaultProfile: 'canvas-cloud-production',
      },
      {
        method: 'dynamic',
        authority: 'operatorGrant',
        profiles: [
          'canvas-cloud-production',
          'canvas-cloud-beta',
          'canvas-cloud-test',
          'canvas-self-hosted',
          'canvas-sim-cloud',
        ],
        defaultProfile: 'canvas-cloud-production',
      },
    ]);

    const caps = reg.capabilities('canvas');
    expect(caps['binding.authority']).toEqual({
      manual: 'operatorGrant',
      dynamic: 'operatorGrant',
    });
    expect(caps['registration.dynamic']).toBe(true);

    // AC-LA-E3-15-02: legacyCapabilities("canvas") has dynamicRegistration: true and other 5 flags unchanged
    const legacy = reg.legacyCapabilities('canvas');
    expect(legacy).toEqual({
      dynamicRegistration: true,
      operatorApproval: true,
      addDeployment: true,
      canvasConfiguration: true,
      webServices: false,
      courseShell: false,
    });

    // BD-A1-104: Canvas setup.bindingFields has the 3 manual rows followed by the 3 dynamic rows
    expect(manifest!.setup.bindingFields.map((f) => [f.key, f.method, f.required])).toEqual([
      ['clientId', 'manual', true],
      ['deploymentId', 'manual', true],
      ['grantCode', 'manual', true],
      ['clientId', 'dynamic', true],
      ['deploymentId', 'dynamic', true],
      ['grantCode', 'dynamic', true],
    ]);

    // BD-A1-103: packages/channels/canvas/README.md Registration row describes manual and dynamic (always staged, both operatorGrant)
    const readme = fs.readFileSync(path.join(ROOT, 'packages/channels/canvas/README.md'), 'utf8');
    expect(readme).toMatch(
      /\|\s*Registration\s*\|\s*`manual`[^|]*`dynamic`[^|]*always staged[^|]*Both methods bind with authority `operatorGrant`\s*\|/,
    );

    artifact(
      'e3-15-ac01-02-manifest.json',
      `${JSON.stringify({ manifest, caps, legacy }, null, 2)}\n`,
    );

    clearVitestCache();
    const k0Run = hasScript('test:k0')
      ? await run('npm', ['run', 'test:k0'])
      : await run('npx', ['--no-install', 'vitest', 'run', '--config', 'tests/ltiaas/k0/vitest.config.mts']);
    artifact('e3-15-k0.log', k0Run.output);
    expect(k0Run.code, `test:k0 exits 0:\n${k0Run.output}`).toBe(0);
  });

  it('BD-A1-106 & BD-A1-107 UNIT + in-process API/CLI checks for AC-LA-E3-15-03 & AC-LA-E3-15-04: Author unit suites and Canvas staged dynamic flow pass', async () => {
    clearVitestCache();
    const unitRun = await run('npx', [
      '--no-install',
      'vitest',
      'run',
      '--reporter=verbose',
      'packages/channel-kernel/src/registry.test.ts',
      'services/cogniate-app/src/app/redemption-admin.test.ts',
      'services/cogniate-app/src/tool-pages/register-staged.test.ts',
    ]);
    artifact('e3-15-unit.log', unitRun.output);
    expect(unitRun.code, `LA-E3-15 unit suites exit 0:\n${unitRun.output}`).toBe(0);

    // In-process API & CLI verification of Canvas dynamic staged flow (BD-A1-106 & BD-A1-107)
    const sharedUrl = pathToFileURL(path.join(ROOT, 'packages/shared/src/index.ts')).href;
    const testkitUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/testkit.ts')).href;
    const operatorUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/operator.ts')).href;
    const cleanupUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/binding-cleanup.ts')).href;
    const auditUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/audit.ts')).href;

    const { createLogger } = (await import(sharedUrl)) as {
      createLogger: (opts: { service: string; level: string; write: (line: string) => void }) => unknown;
    };
    const { TEST_URLS, THANH, testApp } = (await import(testkitUrl)) as {
      TEST_URLS: { app: string };
      THANH: { library: string };
      testApp: (opts?: unknown) => Promise<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
    };
    const { createOperator } = (await import(operatorUrl)) as {
      createOperator: (deps: unknown) => {
        issue: (args: Record<string, unknown>) => Promise<{ exitCode: number; lines: string[] }>;
      };
    };
    const { createBindingCleanup } = (await import(cleanupUrl)) as {
      createBindingCleanup: (deps: unknown) => unknown;
    };
    const { listAuditEvents } = (await import(auditUrl)) as {
      listAuditEvents: (
        db: unknown,
        opts: { limit: number; connection?: string },
      ) => { events: Array<{ result: string; code?: string; connectionId?: string }> };
    };

    const t = await testApp({ channels: reg });
    try {
      const logger = createLogger({
        service: 'cogniate-app',
        level: 'debug',
        write: (l) => t.logs.push(JSON.parse(l)),
      });
      const cleanup = createBindingCleanup({ db: t.db, lti: t.lti.client, logger, now: () => t.clock.now });
      const op = createOperator({
        channels: reg,
        db: t.db,
        lti: t.lti.client,
        logger,
        cleanup,
        now: () => t.clock.now,
        env: {},
      });

      const cookie = await t.login(THANH);
      const call = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
        t.app.inject({
          method,
          url,
          headers: method === 'GET' ? { cookie } : t.writeHeaders(cookie),
          ...(payload !== undefined ? { payload } : {}),
        });

      // 1. GET /app-api/lms-providers lists Canvas with methods: ['manual', 'dynamic'] and dynamicRegistration: true
      const providersRes = await call('GET', '/app-api/lms-providers');
      expect(providersRes.statusCode).toBe(200);
      const canvasProvider = (providersRes.json().lms as Array<Record<string, any>>).find( // eslint-disable-line @typescript-eslint/no-explicit-any
        (p) => p.lms === 'canvas',
      );
      expect(canvasProvider).toBeDefined();
      expect(canvasProvider!.methods).toEqual(['manual', 'dynamic']);
      expect(canvasProvider!.capabilities.dynamicRegistration).toBe(true);

      // 2. POST /app-api/connections with lms: 'canvas', method: 'dynamic' returns 201, authority operatorGrant, non-null registrationUrl (BD-A1-106)
      const siteUrl = 'https://school-a.canvas.sim.test';
      const canvasIssuer = 'https://canvas.sim.test';
      const createRes = await call('POST', '/app-api/connections', {
        name: 'QA3 Canvas DR Staged',
        lms: 'canvas',
        method: 'dynamic',
        profile: 'canvas-sim-cloud',
        siteUrl,
      });
      expect(createRes.statusCode, createRes.body).toBe(201);
      const created = createRes.json();
      expect(created).toMatchObject({
        channel: 'canvas',
        lms: 'canvas',
        method: 'dynamic',
        bindingAuthority: 'operatorGrant',
        status: 'pending',
      });
      expect(typeof created.registrationUrl).toBe('string');
      expect(created.registrationUrl).toContain('/lti/register/cogniate?ref=');

      // 3. Stage the Canvas registration via /tool/register (BD-A1-106 & BD-A1-107)
      const ref = new URL(created.registrationUrl).searchParams.get('ref')!;
      const regId = t.lti.addRegistration({
        url: canvasIssuer,
        familyCode: 'canvas',
        stage: {
          url: canvasIssuer,
          profile: 'canvas-sim-cloud',
          siteUrl,
          serviceUrl: siteUrl,
        },
      });
      const regPost = await t.app.inject({
        method: 'POST',
        url: '/tool/register',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin: TEST_URLS.app,
        },
        payload: new URLSearchParams({ registrationId: regId, ref }).toString(),
      });
      expect(regPost.statusCode).toBe(200);
      expect(regPost.body).toContain('data-connection-status="pending"');
      const plt = [...t.lti.platforms.values()].at(-1)!;
      expect(plt.active).toBe(false);

      const stagedDto = (await call('GET', `/app-api/connections/${String(created.id)}`)).json();
      expect(stagedDto).toMatchObject({
        status: 'pending',
        bindingAuthority: 'operatorGrant',
        platform: {
          id: plt.id,
          issuer: canvasIssuer,
          clientId: plt.clientId,
          deploymentIds: plt.deploymentIds,
        },
      });

      // 4. BD-A1-107: app:grant issue on a staged Canvas connection:
      //    - refuses --accept-staged with bound_values_not_allowed (Canvas has fixed endpoints)
      //    - checks staged platform client_id_mismatch and deployment_mismatch
      //    - succeeds without --accept-staged and stores bound_values_json = null
      const libId = String(t.db.prepare('SELECT id FROM library WHERE name = ?').get(THANH.library)!.id);
      const baseIssue = {
        library: libId,
        connection: String(created.id),
        site: siteUrl,
        clientId: plt.clientId,
        deploymentId: plt.deploymentIds[0],
        note: 'qa3-e3-15',
        traceId: 't-e3-15',
      };

      t.db.prepare('DELETE FROM audit_event').run();
      expect((await op.issue({ ...baseIssue, acceptStaged: true })).exitCode).toBe(1);
      expect((await op.issue({ ...baseIssue, clientId: 'wrong-client' })).exitCode).toBe(1);
      expect((await op.issue({ ...baseIssue, deploymentId: 'wrong-dep' })).exitCode).toBe(1);
      const refusedCodes = listAuditEvents(t.db, { limit: 50 })
        .events.filter((e) => e.result === 'refused')
        .map((e) => String(e.code))
        .sort();
      expect(refusedCodes).toEqual(['bound_values_not_allowed', 'client_id_mismatch', 'deployment_mismatch']);

      const issued = await op.issue(baseIssue);
      expect(issued.exitCode, issued.lines.join('\n')).toBe(0);
      const grantCode = issued.lines.find((l: string) => l.startsWith('Approval code'))!.split(': ')[1]!;

      // 5. BD-A1-107: PUT /app-api/connections/:id/platform { clientId, deploymentId, grantCode } activates the
      //    existing staged Canvas platform without creating a second platform
      const platformsBefore = t.lti.platforms.size;
      const redeemRes = await call('PUT', `/app-api/connections/${String(created.id)}/platform`, {
        clientId: plt.clientId,
        deploymentId: plt.deploymentIds[0],
        grantCode,
      });
      expect(redeemRes.statusCode).toBe(200);
      expect(redeemRes.json()).toMatchObject({
        status: 'registered',
        bindingAuthority: 'operatorGrant',
        platform: {
          id: plt.id,
          clientId: plt.clientId,
          deploymentIds: plt.deploymentIds,
        },
      });
      expect(t.lti.platforms.size, 'no second platform created').toBe(platformsBefore);
      expect(t.lti.platforms.get(plt.id)?.active, 'staged Canvas platform activated').toBe(true);

      artifact(
        'e3-15-host-api-summary.json',
        `${JSON.stringify(
          {
            canvasMethods: canvasProvider!.methods,
            createdRegistrationUrlPresent: Boolean(created.registrationUrl),
            createdBindingAuthority: created.bindingAuthority,
            stagedStatus: stagedDto.status,
            stagedPlatformId: stagedDto.platform?.id,
            refusedCodes,
            redeemedStatus: redeemRes.json().status,
            redeemedPlatformId: redeemRes.json().platform?.id,
            platformActivated: t.lti.platforms.get(plt.id)?.active,
            platformsCountBeforeAndAfter: [platformsBefore, t.lti.platforms.size],
          },
          null,
          2,
        )}\n`,
      );
    } finally {
      await t.app.close();
    }
  });
});
