// LA-E2-06 K0 + UNIT suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E2-06.md and LA-ADR-02 D2a, D4, D5 item 10, D6).
//
// Host-only checks (NO DOCKER):
// - AC-LA-E2-06-01 (K0): F2 on the LA-E2-06 commit (1b298d9):
//   git diff --name-status 1b298d9^ 1b298d9 | node infra/scripts/fitness/channel-diff.mjs --paths-from /dev/stdin --channel brightspace
//   reports core = 0, paths = 4 (all channel:brightspace).
// - AC-LA-E2-06-04 (K0): The brightspace legacy flag dynamicRegistration becomes true, and registration lists dynamic
//   (authority self) and manual (authority operatorGrant); profile trait dynamicRegistration is { issuerRule: 'path-prefix',
//   registrationToken: 'opaque-bearer' }; setup.bindingFields includes the three dynamic staged fields (clientId,
//   deploymentId, grantCode); README marks the token format UNVERIFIED.
// - Host-only unit & in-memory API check for AC-LA-E2-06-02 / AC-LA-E2-06-03: brightspace dynamic connection stages
//   to authority operatorGrant / status pending, and app:grant issue --accept-staged --confirm-foreign-hosts +
//   PUT /app-api/connections/:id/platform { clientId, deploymentId, grantCode } activates the staged platform.

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
  lti?: {
    guardedFamilies: Array<{ family: string; level: 'launch' | 'registration' }>;
    toolConfiguration: 'channel' | 'none';
  };
  setup: {
    bindingFields: FieldSpecLike[];
  };
}

interface ProfileSourceLike {
  id: string;
  dynamicRegistration?: {
    issuerRule: string;
    registrationToken: string;
  } | null;
}

interface LoadedChannel {
  folder: string;
  manifest: ChannelManifest;
  ltiProfiles?: ProfileSourceLike[];
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

let clean: RunResult;
let kernel: KernelSurface;
let ltiLoaded: LoadedChannel[];
let appLoaded: LoadedChannel[];
let reg: ChannelRegistry;

beforeAll(async () => {
  requireScratchClone();
  requireRunDir();
  clean = await npmCheck('e2-06-check-clean');
  const kernelEntry = pathToFileURL(path.join(ROOT, 'packages/channel-kernel/src/index.ts')).href;
  kernel = (await import(kernelEntry)) as KernelSurface;
  const channelsRoot = path.join(ROOT, 'packages/channels');
  ltiLoaded = await kernel.loadChannelFolders([channelsRoot], 'lti');
  appLoaded = await kernel.loadChannelFolders([channelsRoot], 'app');
  reg = kernel.buildChannelRegistry(appLoaded, { simulations: true });
});

describe('LA-E2-06 brightspace Dynamic Registration, staged with a grant (K0 + UNIT)', () => {
  it('AC-LA-E2-06-01: F2 on the LA-E2-06 commit (1b298d9) reports core = 0, paths = 4 (all channel:brightspace), and R0 npm run check exits 0', () => {
    expect(clean.code, `npm run check exits 0:\n${clean.output}`).toBe(0);

    const taskCommit = (process.env.LA_E2_06_SHA ?? '1b298d9').trim();
    const diffRes = spawnSync('git', ['diff', '--name-status', `${taskCommit}^`, taskCommit], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(diffRes.status, `git diff ${taskCommit}^ ${taskCommit} exits 0`).toBe(0);

    const f2Res = spawnSync(
      'node',
      [
        path.join(ROOT, 'infra/scripts/fitness/channel-diff.mjs'),
        '--paths-from',
        '/dev/stdin',
        '--channel',
        'brightspace',
      ],
      {
        cwd: ROOT,
        input: diffRes.stdout,
        encoding: 'utf8',
      },
    );
    const f2Out = `${f2Res.stdout ?? ''}${f2Res.stderr ?? ''}`;
    artifact('e2-06-ac01-f2.log', f2Out);

    expect(f2Res.status, `F2 on ${taskCommit} exits 0:\n${f2Out}`).toBe(0);
    expect(f2Out).toContain('F2 PASS: core = 0, paths = 4');
    const pathLines = f2Out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('F2 '));
    expect(pathLines).toHaveLength(4);
    for (const line of pathLines) {
      expect(line).toMatch(/^channel:brightspace\tpackages\/channels\/brightspace\//);
    }
  });

  it('AC-LA-E2-06-04: brightspace legacy flag dynamicRegistration is true, registration lists dynamic and manual, profile trait dynamicRegistration is { issuerRule: path-prefix, registrationToken: opaque-bearer }, and K0 + brightspace unit tests pass', async () => {
    const manifest = reg.channel('brightspace');
    expect(manifest).not.toBeNull();

    // AC-LA-E2-06-04: registration lists dynamic (authority self) and manual (authority operatorGrant)
    expect(manifest!.registration).toEqual([
      {
        method: 'dynamic',
        authority: 'self',
        profiles: ['brightspace'],
        defaultProfile: 'brightspace',
      },
      {
        method: 'manual',
        authority: 'operatorGrant',
        profiles: ['brightspace'],
        defaultProfile: 'brightspace',
      },
    ]);

    // AC-LA-E2-06-04: legacy flag dynamicRegistration is true
    const legacy = reg.legacyCapabilities('brightspace');
    expect(legacy).toEqual({
      dynamicRegistration: true,
      operatorApproval: true,
      addDeployment: true,
      webServices: false,
      courseShell: false,
      canvasConfiguration: false,
    });

    const caps = reg.capabilities('brightspace');
    expect(caps['registration.dynamic']).toBe(true);
    expect(caps['binding.authority']).toEqual({ dynamic: 'self', manual: 'operatorGrant' });

    // Staged dynamic bindingFields on brightspace match lti-generic: clientId, deploymentId, grantCode
    const dynamicBindingFields = manifest!.setup.bindingFields.filter((f) => f.method === 'dynamic');
    expect(dynamicBindingFields.map((f) => [f.key, f.required])).toEqual([
      ['clientId', true],
      ['deploymentId', true],
      ['grantCode', true],
    ]);

    // Profile trait dynamicRegistration: { issuerRule: 'path-prefix', registrationToken: 'opaque-bearer' }
    const bsLti = ltiLoaded.find((c) => c.manifest.id === 'brightspace');
    expect(bsLti).toBeDefined();
    const profile = bsLti!.ltiProfiles?.find((p) => p.id === 'brightspace');
    expect(profile?.dynamicRegistration).toEqual({
      issuerRule: 'path-prefix',
      registrationToken: 'opaque-bearer',
    });

    // README marks D2L registration token format UNVERIFIED
    const readme = fs.readFileSync(path.join(ROOT, 'packages/channels/brightspace/README.md'), 'utf8');
    expect(readme).toContain('opaque-bearer');
    expect(readme).toContain('path-prefix');
    expect(readme).toMatch(/UNVERIFIED/);

    artifact(
      'e2-06-ac04-manifest-profile.json',
      `${JSON.stringify({ manifest, profile, caps, legacy }, null, 2)}\n`,
    );

    // Run K0 and brightspace unit tests
    const k0Run = hasScript('test:k0')
      ? await run('npm', ['run', 'test:k0'])
      : await run('npx', ['--no-install', 'vitest', 'run', '--config', 'tests/ltiaas/k0/vitest.config.mts']);
    artifact('e2-06-k0.log', k0Run.output);
    expect(k0Run.code, `test:k0 exits 0:\n${k0Run.output}`).toBe(0);

    const unitRun = await run('npx', [
      '--no-install',
      'vitest',
      'run',
      '--reporter=verbose',
      'packages/channels/brightspace/channel.test.ts',
    ]);
    artifact('e2-06-unit.log', unitRun.output);
    expect(unitRun.code, `brightspace channel.test.ts exits 0:\n${unitRun.output}`).toBe(0);
  });

  it('Host-only API check for AC-LA-E2-06-02 & AC-LA-E2-06-03: brightspace dynamic connection stages to operatorGrant/pending, and --accept-staged --confirm-foreign-hosts + {clientId, deploymentId, grantCode} activates the staged platform', async () => {
    const sharedUrl = pathToFileURL(path.join(ROOT, 'packages/shared/src/index.ts')).href;
    const testkitUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/testkit.ts')).href;
    const operatorUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/operator.ts')).href;
    const cleanupUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/binding-cleanup.ts')).href;
    const connectionsDomUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/domain/connections.ts')).href;

    const { createLogger } = (await import(sharedUrl)) as {
      createLogger: (opts: { service: string; level: string; write: (line: string) => void }) => unknown;
    };
    const { THANH, ltiPlatform, testApp } = (await import(testkitUrl)) as {
      THANH: { library: string };
      ltiPlatform: (over: Record<string, unknown>) => Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
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
    const { stageRegistration } = (await import(connectionsDomUrl)) as {
      stageRegistration: (
        db: unknown,
        connectionId: string,
        profile: string,
        platform: Record<string, unknown>,
        now: number,
      ) => boolean;
    };

    const t = await testApp({ channels: reg });
    try {
      if (!t.lti.providers.some((p: Record<string, unknown>) => p.id === 'brightspace')) {
        t.lti.providers.push({
          id: 'brightspace',
          lms: 'brightspace',
          label: 'D2L Brightspace',
          sharing: 'exclusive',
          issuer: null,
          authenticationEndpoint: null,
          accesstokenEndpoint: null,
          jwksUrl: null,
          siteUrlOn: null,
          serviceUrl: false,
          simulation: false,
          sharedPlatform: null,
          endpoints: 'admin',
        });
      }

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

      const siteUrl = 'https://school.brightspace.com';
      const createRes = await call('POST', '/app-api/connections', {
        name: 'D2L Dynamic Staged',
        siteUrl,
        method: 'dynamic',
        lms: 'brightspace',
      });
      expect(createRes.statusCode).toBe(201);
      const created = createRes.json();
      expect(created).toMatchObject({
        channel: 'brightspace',
        method: 'dynamic',
        bindingAuthority: 'self',
        status: 'pending',
      });

      // Stage the registration (D2L token endpoint on auth.brightspace.com is off the issuer origin -> active: false)
      const plt = ltiPlatform({
        id: 'plt_bs_staged',
        url: siteUrl,
        clientId: 'd2l-dr-client-1',
        active: false,
        deploymentIds: ['550e8400-e29b-41d4-a716-446655440000'],
        profile: 'brightspace',
        bindingRef: `ref_${String(created.id)}`,
        authenticationEndpoint: `${siteUrl}/d2l/lti/authenticate`,
        accesstokenEndpoint: 'https://auth.brightspace.com/core/connect/token',
        authConfig: { method: 'JWK_SET', key: `${siteUrl}/d2l/.well-known/jwks` },
        clientAssertionAud: 'https://api.brightspace.com/auth/token',
      });
      t.lti.platforms.set(plt.id, plt);
      expect(
        stageRegistration(
          t.db,
          String(created.id),
          'brightspace',
          {
            id: plt.id,
            issuer: plt.url,
            clientId: plt.clientId,
            deploymentIds: plt.deploymentIds,
            productFamilyCode: 'desire2learn',
          },
          t.clock.now,
        ),
      ).toBe(true);

      const stagedDto = (await call('GET', `/app-api/connections/${String(created.id)}`)).json();
      expect(stagedDto).toMatchObject({
        status: 'pending',
        bindingAuthority: 'operatorGrant',
      });

      const libId = String(t.db.prepare('SELECT id FROM library WHERE name = ?').get(THANH.library)!.id);
      const issued = await op.issue({
        library: libId,
        connection: String(created.id),
        site: siteUrl,
        clientId: plt.clientId,
        deploymentId: plt.deploymentIds[0],
        acceptStaged: true,
        confirmForeignHosts: true,
        note: 'qa3-bs-staged',
        traceId: 't-bs-staged',
      });
      expect(issued.exitCode, issued.lines.join('\n')).toBe(0);
      const grantCode = issued.lines.find((l: string) => l.startsWith('Approval code'))!.split(': ')[1]!;

      const redeemRes = await call('PUT', `/app-api/connections/${String(created.id)}/platform`, {
        clientId: plt.clientId,
        deploymentId: plt.deploymentIds[0],
        grantCode,
      });
      expect(redeemRes.statusCode).toBe(200);
      expect(redeemRes.json()).toMatchObject({
        status: 'registered',
        bindingAuthority: 'operatorGrant',
      });
      expect(t.lti.platforms.get(plt.id)?.active).toBe(true);
    } finally {
      await t.app.close();
    }
  });
});
