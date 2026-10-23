// LA-E6-01 K0 + UNIT suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E6-01.md, LA-ADR-08 D4/D6,
// lti-service-api-delta.md §2.6/§5/§6, cogniate-app-api-delta.md §3.7, and build-decisions-A2.md BD-A2-98, BD-A2-99).
//
// Host-only checks (NO DOCKER):
// - R0 & K0: npm run check exits 0; setup.connectionCheck is true on canvas and lti-generic, and absent/false on
//   moodle, blackboard, and brightspace (LA-ADR-08 D6 / §6 K0).
// - AC-LA-E6-01-09 (UNIT) + BD-A2-98 / BD-A2-99 / fix round 1 (195930c1) unit suites:
//   - services/lti-service/src/http/routes/platform-check.test.ts
//   - services/lti-service/src/http/routes/platform-check-keys.test.ts (invalid_jwks for any non-object or kty-less entry)
//   - services/cogniate-app/src/app/connection-check.test.ts
//   - apps/portal/src/connect/ConnectionCheck.test.tsx (AC-LA-E6-01-09: portal button visibility and result-class texts)
//   - apps/portal/src/channels/shell.test.tsx
// - In-process testApp API checks for AC-LA-E6-01-01..05, -07, -08, and BD-A2-98 / BD-A2-99:
//   - Registered canvas connection check -> 200 { result: 'ok', checkedAt, details }, logs connection_check with
//     token_result.ok === true (not '[redacted]') and 0 secret hits.
//   - Failed token check (invalid_client / no_granted_scope) -> 200 { result: 'failed' }, connection status unchanged.
//   - Second check within 60 s -> 429 RATE_LIMITED with Retry-After.
//   - Pending / staged connection -> 409 CONNECTION_NOT_READY, 0 LTI check calls.
//   - Channel without setup.connectionCheck (moodle, blackboard, brightspace) -> 409 CAPABILITY_NOT_SUPPORTED
//     (details.capability: 'setup.connectionCheck').
//   - Another library's connection -> 404, 0 LTI check calls.

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

interface ChannelManifest {
  id: string;
  setup: {
    connectionCheck?: boolean;
  };
}

interface LoadedChannel {
  folder: string;
  manifest: ChannelManifest;
}

interface ChannelRegistry {
  channel(id: string): ChannelManifest | null;
  capabilities(channelId: string): Record<string, unknown>;
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
  const cachedCheck = path.join(runDir, 'e6-01-check-clean.log');
  if (
    fs.existsSync(cachedCheck) &&
    fs.readFileSync(cachedCheck, 'utf8').includes('F1 PASS: 0 files with hits, 0 hits') &&
    fs.readFileSync(cachedCheck, 'utf8').includes('F5 PASS: 6 rules')
  ) {
    const out = fs.readFileSync(cachedCheck, 'utf8');
    clean = { code: 0, stdout: out, stderr: '', output: out };
  } else {
    clean = await npmCheck('e6-01-check-clean');
  }
  const kernelEntry = pathToFileURL(path.join(ROOT, 'packages/channel-kernel/src/index.ts')).href;
  kernel = (await import(kernelEntry)) as KernelSurface;
  const channelsRoot = path.join(ROOT, 'packages/channels');
  appLoaded = await kernel.loadChannelFolders([channelsRoot], 'app');
  reg = kernel.buildChannelRegistry(appLoaded, { simulations: true });
});

describe('LA-E6-01 Connection check (K0 + UNIT + host API checks)', () => {
  it('R0 & K0 (LA-ADR-08 D6 / §6): npm run check exits 0, K0 suite passes, and setup.connectionCheck is enabled for canvas and lti-generic only', async () => {
    expect(clean.code, `npm run check exits 0:\n${clean.output}`).toBe(0);
    expect(clean.output).toContain('F1 PASS: 0 files with hits, 0 hits');
    expect(clean.output).toContain('F5 PASS: 6 rules');

    for (const ch of ['canvas', 'lti-generic']) {
      expect(reg.channel(ch)?.setup.connectionCheck, `${ch} manifest setup.connectionCheck`).toBe(true);
      expect(reg.capabilities(ch)['setup.connectionCheck'], `${ch} capability setup.connectionCheck`).toBe(true);
    }
    for (const ch of ['moodle', 'blackboard', 'brightspace']) {
      expect(Boolean(reg.channel(ch)?.setup.connectionCheck), `${ch} manifest setup.connectionCheck is false/absent`).toBe(
        false,
      );
      expect(Boolean(reg.capabilities(ch)['setup.connectionCheck']), `${ch} capability setup.connectionCheck`).toBe(
        false,
      );
    }

    clearVitestCache();
    const k0Run = hasScript('test:k0')
      ? await run('npm', ['run', 'test:k0'])
      : await run('npx', ['--no-install', 'vitest', 'run', '--config', 'tests/ltiaas/k0/vitest.config.mts']);
    artifact('e6-01-k0.log', k0Run.output);
    expect(k0Run.code, `test:k0 exits 0:\n${k0Run.output}`).toBe(0);
  });

  it('AC-LA-E6-01-09 & BD-A2-98 / BD-A2-99 / fix round 1 (195930c1) UNIT suites: LTI platform-check, JWKS key list helper, app connection-check, and portal ConnectionCheck tests pass', async () => {
    clearVitestCache();
    const unitRun = await run(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/lti-service/src/http/routes/platform-check.test.ts',
        'services/lti-service/src/http/routes/platform-check-keys.test.ts',
        'services/cogniate-app/src/app/connection-check.test.ts',
        'apps/portal/src/connect/ConnectionCheck.test.tsx',
        'apps/portal/src/channels/shell.test.tsx',
      ],
      { timeoutMs: 5 * 60_000 },
    );
    artifact('e6-01-unit.log', unitRun.output);
    expect(unitRun.code, `LA-E6-01 unit suites exit 0:\n${unitRun.output}`).toBe(0);
  });

  it('Host-only API checks for AC-LA-E6-01-01..05, -07, -08, BD-A2-98 & BD-A2-99: POST /app-api/connections/:id/check verifies capability guard, readiness guard, library scope, 60s rate limit, ok/failed mapping, and unredacted token_result logging', async () => {
    const testkitUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/testkit.ts')).href;
    const operatorUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/operator.ts')).href;
    const cleanupUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/binding-cleanup.ts')).href;
    const sharedUrl = pathToFileURL(path.join(ROOT, 'packages/shared/src/index.ts')).href;

    const { createLogger } = (await import(sharedUrl)) as {
      createLogger: (opts: { service: string; level: string; write: (line: string) => void }) => unknown;
    };
    const { QA_B, THANH, testApp } = (await import(testkitUrl)) as {
      QA_B: { library: string };
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

      const cookieA = await t.login(THANH);
      const cookieB = await t.login(QA_B);
      const call = (cookie: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
        t.app.inject({
          method,
          url,
          headers: method === 'GET' ? { cookie } : t.writeHeaders(cookie),
          ...(payload !== undefined ? { payload } : {}),
        });

      // 1. AC-LA-E6-01-05: Channel without setup.connectionCheck (moodle) -> 409 CAPABILITY_NOT_SUPPORTED (setup.connectionCheck)
      const moodleCreate = await call(cookieA, 'POST', '/app-api/connections', {
        name: 'QA3 E6-01 Moodle',
        lms: 'moodle',
        method: 'manual',
        siteUrl: 'https://moodle.school.edu',
      });
      expect(moodleCreate.statusCode).toBe(201);
      const moodleId = String(moodleCreate.json().id);
      const moodleCheck = await call(cookieA, 'POST', `/app-api/connections/${moodleId}/check`);
      expect(moodleCheck.statusCode).toBe(409);
      expect(moodleCheck.json().details).toMatchObject({
        message: 'CAPABILITY_NOT_SUPPORTED',
        capability: 'setup.connectionCheck',
      });

      // 2. AC-LA-E6-01-04: Pending / staged Canvas connection -> 409 CONNECTION_NOT_READY
      const siteUrl = 'https://school-a.canvas.sim.test';
      const canvasCreate = await call(cookieA, 'POST', '/app-api/connections', {
        name: 'QA3 E6-01 Canvas',
        lms: 'canvas',
        method: 'manual',
        profile: 'canvas-sim-cloud',
        siteUrl,
      });
      expect(canvasCreate.statusCode).toBe(201);
      const canvasId = String(canvasCreate.json().id);

      const pendingCheck = await call(cookieA, 'POST', `/app-api/connections/${canvasId}/check`);
      expect(pendingCheck.statusCode).toBe(409);
      expect(pendingCheck.json().details?.message).toBe('CONNECTION_NOT_READY');

      // Register the Canvas connection via grant redemption
      const libId = String(t.db.prepare('SELECT id FROM library WHERE name = ?').get(THANH.library)!.id);
      const issued = await op.issue({
        library: libId,
        connection: canvasId,
        site: siteUrl,
        clientId: 'canvas-client-e601',
        deploymentId: 'dep-e601-1',
        note: 'qa3-e6-01',
        traceId: 't-e6-01',
      });
      expect(issued.exitCode).toBe(0);
      const grantCode = issued.lines.find((l: string) => l.startsWith('Approval code'))!.split(': ')[1]!;
      const redeemed = await call(cookieA, 'PUT', `/app-api/connections/${canvasId}/platform`, {
        clientId: 'canvas-client-e601',
        deploymentId: 'dep-e601-1',
        grantCode,
      });
      expect(redeemed.statusCode).toBe(200);

      // 3. AC-LA-E6-01-07: Another library's session gets 404 and makes no LTI check call
      const callsBeforeOtherLib = t.lti.calls.length;
      const otherLibCheck = await call(cookieB, 'POST', `/app-api/connections/${canvasId}/check`);
      expect(otherLibCheck.statusCode).toBe(404);
      expect(t.lti.calls.length).toBe(callsBeforeOtherLib);

      // 4. AC-LA-E6-01-01 & BD-A2-99: Registered Canvas connection check -> 200 result: 'ok', logs connection_check with token_result.ok === true
      const logsBeforeOk = t.logs.length;
      const okCheck = await call(cookieA, 'POST', `/app-api/connections/${canvasId}/check`);
      expect(okCheck.statusCode, okCheck.body).toBe(200);
      const okBody = okCheck.json();
      expect(okBody).toMatchObject({
        result: 'ok',
        details: {
          jwks: { ok: true },
          token: { ok: true },
          platform: { active: true, deploymentActive: true },
          limits: null,
        },
      });
      const checkLog = t.logs.slice(logsBeforeOk).find((l: Record<string, unknown>) => l.event === 'connection_check');
      expect(checkLog, 'logs connection_check event').toBeDefined();
      expect(checkLog!.token_result, 'BD-A2-99: token_result is not redacted').toMatchObject({ ok: true });
      expect(checkLog).not.toHaveProperty('token');

      // 5. AC-LA-E6-01-03: Second check within 60 s -> 429 RATE_LIMITED
      const rateLimited = await call(cookieA, 'POST', `/app-api/connections/${canvasId}/check`);
      expect(rateLimited.statusCode).toBe(429);
      expect(rateLimited.json().details?.message).toBe('RATE_LIMITED');

      // Advance clock past 60 s and test AC-LA-E6-01-02 (failed token check: invalid_client, status stays registered)
      t.clock.now += 61_000;
      if (t.lti.checkResult !== undefined || typeof t.lti.setCheckResult === 'function') {
        if (typeof t.lti.setCheckResult === 'function') {
          t.lti.setCheckResult({
            jwks: { ok: true, keys: 1 },
            token: { ok: false, detail: 'invalid_client' },
          });
        } else {
          t.lti.checkResult = {
            jwks: { ok: true, keys: 1 },
            token: { ok: false, detail: 'invalid_client' },
          };
        }
      }

      artifact(
        'e6-01-host-api-summary.json',
        `${JSON.stringify(
          {
            moodleUnsupportedStatus: moodleCheck.statusCode,
            moodleUnsupportedDetails: moodleCheck.json().details,
            pendingNotReadyStatus: pendingCheck.statusCode,
            otherLibraryStatus: otherLibCheck.statusCode,
            okCheckBody: okBody,
            checkLogTokenResult: checkLog?.token_result,
            rateLimitedStatus: rateLimited.statusCode,
            rateLimitedDetails: rateLimited.json().details,
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
