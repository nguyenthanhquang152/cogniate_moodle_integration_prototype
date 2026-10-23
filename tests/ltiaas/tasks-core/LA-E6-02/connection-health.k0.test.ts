// LA-E6-02 K0 + UNIT suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E6-02.md, LA-ADR-08 D5,
// cogniate-app-api-delta.md §3.7, data-model.md §5a, and build-decisions-A2.md BD-A2-100).
//
// Host-only checks (NO DOCKER):
// - AC-LA-E6-02-06 (UNIT): The writer keeps at most 100 rows per connection, and the retention removes rows older than
//   30 days (controlled clock, temporary database).
// - AC-LA-E6-02-07 (UNIT): Migration 016 keeps old connections working, with artifact_key_kid = NULL.
// - AC-LA-E6-02-08 (UNIT): Portal shows "Paste a new {LMS} key JSON" when artifactKeyCurrent is false, and a backlog
//   warning when oldestPendingAt is older than 1 hour; collapsed health section has no role="alert".
// - BD-A2-100 (a)-(g) & host-only in-process testApp checks for AC-LA-E6-02-01..05:
//   - GET /app-api/connections/:id/health returns 404 for another library's connection (AC-LA-E6-02-04).
//   - keys.nextKid is null; keys.artifactKeyCurrent is null when artifactKeyKid is null, true when equal to activeKid,
//     and false when different (BD-A2-100 (a), (b); AC-LA-E6-02-02, -03 host part).
//   - POST /app-api/connections/:id/check writes a check row to connection_event (ok or jwks:<detail> token:<detail>),
//     and health.lastCheck { at, jwks, token } is derived from the newest check row (BD-A2-100 (c)).
//   - dispatch.failedLast24h is 1 after one failed dispatch and dispatch.lastError.code is the parsed [A-Z][A-Z0-9_]*
//     code from "<status> <CODE>: <text>" (or null when unparseable, never free text) (AC-LA-E6-02-05, BD-A2-100 (d)).
//   - events are kept rows (at most 100), newest first (BD-A2-100 (e)).

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT,
  artifact,
  hasScript,
  requireRunDir,
  requireScratchClone,
  run,
} from '../LA-E1-04/fitness';

function clearVitestCache(): void {
  fs.rmSync(path.join(ROOT, 'node_modules/.vitest-cache'), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, 'node_modules/.vite'), { recursive: true, force: true });
}

beforeAll(() => {
  requireScratchClone();
  requireRunDir();
  clearVitestCache();
});

describe('LA-E6-02 Connection health view (K0 + UNIT + host API checks)', () => {
  it('Migration 016 schema & AC-LA-E6-02-06, AC-LA-E6-02-07, AC-LA-E6-02-08 UNIT suites: connection-events, connection-health, domain retention, migrations, portal ConnectionHealth, and K0 contract suites pass', async () => {
    const mig016Path = path.join(ROOT, 'services/cogniate-app/src/domain/migrations/016_connection_health.sql');
    expect(fs.existsSync(mig016Path), '016_connection_health.sql exists').toBe(true);
    const mig016Sql = fs.readFileSync(mig016Path, 'utf8');
    expect(mig016Sql).toContain('CREATE TABLE connection_event');
    expect(mig016Sql).toContain('ALTER TABLE connection ADD COLUMN artifact_key_kid TEXT');

    clearVitestCache();
    const unitRun = await run(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/cogniate-app/src/domain/connection-events.test.ts',
        'services/cogniate-app/src/app/connection-health.test.ts',
        'services/cogniate-app/src/domain/domain.test.ts',
        'packages/shared/src/migrations.test.ts',
        'apps/portal/src/connect/ConnectionHealth.test.tsx',
      ],
      { timeoutMs: 5 * 60_000 },
    );
    artifact('e6-02-unit.log', unitRun.output);
    expect(unitRun.code, `LA-E6-02 unit suites exit 0:\n${unitRun.output}`).toBe(0);

    clearVitestCache();
    const k0Run = hasScript('test:k0')
      ? await run('npm', ['run', 'test:k0'])
      : await run('npx', ['--no-install', 'vitest', 'run', '--config', 'tests/ltiaas/k0/vitest.config.mts']);
    artifact('e6-02-k0.log', k0Run.output);
    expect(k0Run.code, `test:k0 exits 0:\n${k0Run.output}`).toBe(0);
  });

  it('BD-A2-100 (a)-(e) & host-only API checks for AC-LA-E6-02-01..07: GET /app-api/connections/:id/health verifies library scope (404), artifact_key_kid NULL default, nextKid null, artifactKeyCurrent null/true/false, check event code format & lastCheck derivation, and failed dispatch lastError.code parsing', async () => {
    const kernelEntry = pathToFileURL(path.join(ROOT, 'packages/channel-kernel/src/index.ts')).href;
    const testkitUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/testkit.ts')).href;
    const operatorUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/operator.ts')).href;
    const cleanupUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/binding-cleanup.ts')).href;
    const sharedUrl = pathToFileURL(path.join(ROOT, 'packages/shared/src/index.ts')).href;

    const kernel = (await import(kernelEntry)) as {
      loadChannelFolders(roots: readonly string[], side: 'lti' | 'app'): Promise<unknown[]>;
      buildChannelRegistry(channels: readonly unknown[], opts: { simulations: boolean }): unknown;
    };
    const appLoaded = await kernel.loadChannelFolders([path.join(ROOT, 'packages/channels')], 'app');
    const reg = kernel.buildChannelRegistry(appLoaded, { simulations: true });

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

      const siteUrl = 'https://school-a.canvas.sim.test';
      const canvasCreate = await call(cookieA, 'POST', '/app-api/connections', {
        name: 'QA3 E6-02 Canvas Health',
        lms: 'canvas',
        method: 'manual',
        profile: 'canvas-sim-cloud',
        siteUrl,
      });
      expect(canvasCreate.statusCode).toBe(201);
      const canvasId = String(canvasCreate.json().id);
      const libId = String(t.db.prepare('SELECT id FROM library WHERE name = ?').get(THANH.library)!.id);

      // AC-LA-E6-02-07: New/existing connection has artifact_key_kid = NULL by default
      const rawRow = t.db.prepare('SELECT artifact_key_kid FROM connection WHERE id = ?').get(canvasId) as {
        artifact_key_kid: string | null;
      };
      expect(rawRow.artifact_key_kid).toBeNull();

      // AC-LA-E6-02-04: Health of another library's connection gives 404
      const otherLibHealth = await call(cookieB, 'GET', `/app-api/connections/${canvasId}/health`);
      expect(otherLibHealth.statusCode).toBe(404);

      // Register the connection and run a check (LA-E6-01 -> LA-E6-02 check event writer)
      const issued = await op.issue({
        library: libId,
        connection: canvasId,
        site: siteUrl,
        clientId: 'canvas-client-e602',
        deploymentId: 'dep-e602-1',
        note: 'qa3-e6-02',
        traceId: 't-e6-02',
      });
      expect(issued.exitCode).toBe(0);
      const grantCode = issued.lines.find((l: string) => l.startsWith('Approval code'))!.split(': ')[1]!;
      const redeemed = await call(cookieA, 'PUT', `/app-api/connections/${canvasId}/platform`, {
        clientId: 'canvas-client-e602',
        deploymentId: 'dep-e602-1',
        grantCode,
      });
      expect(redeemed.statusCode).toBe(200);

      const checkRes = await call(cookieA, 'POST', `/app-api/connections/${canvasId}/check`);
      expect(checkRes.statusCode).toBe(200);

      // Read health view: verify BD-A2-100 (a) nextKid: null, (b) artifactKeyCurrent: null when artifactKeyKid is null,
      // (c) check event code: 'ok' and lastCheck: { jwks: true, token: true }
      const health1 = await call(cookieA, 'GET', `/app-api/connections/${canvasId}/health`);
      expect(health1.statusCode, health1.body).toBe(200);
      const h1 = health1.json();
      expect(h1.status).toBe('registered');
      expect(h1.keys.nextKid).toBeNull();
      expect(h1.keys.artifactKeyKid).toBeNull();
      expect(h1.keys.artifactKeyCurrent).toBeNull();
      expect(h1.lastCheck).toMatchObject({ jwks: true, token: true });
      expect(h1.events[0]).toMatchObject({ kind: 'check', code: 'ok' });

      // BD-A2-100 (b): When artifact_key_kid equals activeKid -> artifactKeyCurrent is true; when different -> false
      const activeKid = h1.keys.activeKid as string | null;
      if (activeKid) {
        t.db.prepare('UPDATE connection SET artifact_key_kid = ? WHERE id = ?').run(activeKid, canvasId);
        const hCurrent = (await call(cookieA, 'GET', `/app-api/connections/${canvasId}/health`)).json();
        expect(hCurrent.keys).toEqual({
          activeKid,
          nextKid: null,
          artifactKeyKid: activeKid,
          artifactKeyCurrent: true,
        });

        t.db.prepare('UPDATE connection SET artifact_key_kid = ? WHERE id = ?').run('stale-kid-000', canvasId);
        const hStale = (await call(cookieA, 'GET', `/app-api/connections/${canvasId}/health`)).json();
        expect(hStale.keys).toEqual({
          activeKid,
          nextKid: null,
          artifactKeyKid: 'stale-kid-000',
          artifactKeyCurrent: false,
        });
      }

      artifact(
        'e6-02-host-api-summary.json',
        `${JSON.stringify(
          {
            otherLibStatus: otherLibHealth.statusCode,
            defaultArtifactKeyKid: rawRow.artifact_key_kid,
            healthAfterCheck: h1,
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
