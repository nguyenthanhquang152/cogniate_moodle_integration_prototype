// LA-E3-07 K0 + UNIT suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E3-07.md, LA-ADR-05 D4,
// LA-ADR-01 D3, and cogniate-app-api-delta.md §3.3, §5).
//
// Host-only checks (NO DOCKER):
// - AC-LA-E3-07-01 (K0): The registry's registration.scopes of moodle, canvas and blackboard (and every loaded channel)
//   equals the four AGS scope URLs in the order lineitem, lineitem.readonly, result.readonly, score, with no NRPS scope.
// - AC-LA-E3-07-02 (host API + UNIT check): GET /app-api/connections/:id/canvas-configuration (jwk=url and jwk=inline)
//   has exactly the four AGS scopes in scopes.
// - AC-LA-E3-07-03 (host API + UNIT check): GET /app-api/connections/:id/tool-configuration for a Moodle manual
//   connection has 16 rows and row 13 (key 'nrps') has value 'Do not use this service'.
// - Author unit tests for LA-E3-07 pass (packages/channels/canvas/app/configuration.test.ts,
//   packages/channels/moodle/app.test.ts, services/cogniate-app/src/app/canvas-configuration.test.ts,
//   services/cogniate-app/src/app/connect.test.ts).

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

const FOUR_AGS_SCOPES = [
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/score',
] as const;

interface ChannelManifest {
  id: string;
}

interface LoadedChannel {
  folder: string;
  manifest: ChannelManifest;
  appAdapter?: unknown;
}

interface ExtensionRouteLike {
  method: 'GET' | 'PUT' | 'POST';
  path: string;
  handle: (
    input: { body: unknown; query: Record<string, string> },
    ctx: Record<string, unknown>,
  ) => Promise<
    | { status: number; body: Record<string, unknown>; headers?: Record<string, string> }
    | { error: { status: number; code: string; message: string; details?: Record<string, unknown> } }
  >;
}

interface ConnectionSetupWithExtensions {
  channel: string;
  extensionRoutes?: readonly ExtensionRouteLike[];
}

function unwrapSetup(appAdapter: unknown): ConnectionSetupWithExtensions {
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

interface ChannelRegistry {
  channels(): readonly ChannelManifest[];
  capabilities(channelId: string): Record<string, unknown>;
}

interface KernelSurface {
  loadChannelFolders(roots: readonly string[], side: 'lti' | 'app'): Promise<LoadedChannel[]>;
  buildChannelRegistry(channels: readonly LoadedChannel[], opts: { simulations: boolean }): ChannelRegistry;
}

let clean: RunResult;
let kernel: KernelSurface;
let appLoaded: LoadedChannel[];
let reg: ChannelRegistry;

beforeAll(async () => {
  requireScratchClone();
  requireRunDir();
  clean = await npmCheck('e3-07-check-clean');
  const kernelEntry = pathToFileURL(path.join(ROOT, 'packages/channel-kernel/src/index.ts')).href;
  kernel = (await import(kernelEntry)) as KernelSurface;
  const channelsRoot = path.join(ROOT, 'packages/channels');
  appLoaded = await kernel.loadChannelFolders([channelsRoot], 'app');
  reg = kernel.buildChannelRegistry(appLoaded, { simulations: true });
});

describe('LA-E3-07 NRPS scope: channel values, Canvas JSON, Moodle row 13 (K0 + UNIT rows)', () => {
  it('AC-LA-E3-07-01: registration.scopes of moodle, canvas, blackboard (and all loaded channels) equals the 4 AGS scopes in order and contains no NRPS scope', async () => {
    expect(clean.code, `npm run check exits 0:\n${clean.output}`).toBe(0);

    const scopesByChannel: Record<string, unknown> = {};
    for (const chId of ['moodle', 'canvas', 'blackboard', 'lti-generic', 'brightspace']) {
      const caps = reg.capabilities(chId);
      const scopes = caps['registration.scopes'] as string[];
      scopesByChannel[chId] = scopes;
      expect(scopes, `${chId} registration.scopes equals the 4 AGS scopes in order`).toEqual([...FOUR_AGS_SCOPES]);
      expect(
        scopes.some((s) => s.includes('nrps') || s.includes('contextmembership')),
        `${chId} has no NRPS scope`,
      ).toBe(false);
    }

    artifact('e3-07-ac01-scopes.json', `${JSON.stringify(scopesByChannel, null, 2)}\n`);

    const k0Run = hasScript('test:k0')
      ? await run('npm', ['run', 'test:k0'])
      : await run('npx', ['--no-install', 'vitest', 'run', '--config', 'tests/ltiaas/k0/vitest.config.mts']);
    artifact('e3-07-k0.log', k0Run.output);
    expect(k0Run.code, `test:k0 exits 0:\n${k0Run.output}`).toBe(0);
  });

  it('Host-only API & UNIT checks for AC-LA-E3-07-02 (Canvas JSON jwk=url & jwk=inline scopes) and AC-LA-E3-07-03 (Moodle manual row 13 nrps = "Do not use this service")', async () => {
    // 1. AC-LA-E3-07-02 (Canvas P5 extension route): developer key JSON for jwk=url and jwk=inline
    const canvasChannel = appLoaded.find((c) => c.manifest.id === 'canvas');
    expect(canvasChannel, 'canvas channel loaded').toBeDefined();
    const canvasSetup = unwrapSetup(canvasChannel!.appAdapter);
    const canvasConfigRoute = canvasSetup.extensionRoutes?.find(
      (r) => r.method === 'GET' && r.path === 'canvas-configuration',
    );
    expect(canvasConfigRoute, 'canvas GET canvas-configuration extensionRoute exists').toBeDefined();

    const stubCtx: Record<string, unknown> = {
      libraryId: 'acc-1',
      libraryName: "Thanh's Library",
      connectionId: 'con-canvas-1',
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
      publicToolKeys: async () => ({
        ok: true as const,
        keys: [{ kty: 'RSA', kid: 'kid-1', use: 'sig', alg: 'RS256', n: 'abc', e: 'AQAB' }],
      }),
      outbound: {
        getJson: async (url: string) => {
          if (url.includes('jwks') || url.includes('keys')) {
            return { keys: [{ kty: 'RSA', kid: 'kid-1', use: 'sig', alg: 'RS256', n: 'abc', e: 'AQAB' }] };
          }
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
      traceId: 'trace-e3-07',
      now: () => 1700000000000,
    };

    const urlOut = await canvasConfigRoute!.handle({ body: undefined, query: { jwk: 'url' } }, stubCtx);
    expect('status' in urlOut && urlOut.status).toBe(200);
    const jwkUrlBody = ('body' in urlOut ? urlOut.body : {}) as Record<string, unknown>;
    const jwkUrlScopes = jwkUrlBody.scopes as string[];
    expect(jwkUrlScopes, 'Canvas JSON (jwk=url) scopes equals 4 AGS scopes').toEqual([...FOUR_AGS_SCOPES]);
    expect(
      jwkUrlScopes.some((s) => s.includes('nrps') || s.includes('contextmembership')),
      'Canvas JSON (jwk=url) contains no NRPS scope',
    ).toBe(false);

    const inlineOut = await canvasConfigRoute!.handle({ body: undefined, query: { jwk: 'inline' } }, stubCtx);
    expect('status' in inlineOut && inlineOut.status).toBe(200);
    const jwkInlineBody = ('body' in inlineOut ? inlineOut.body : {}) as Record<string, unknown>;
    const jwkInlineScopes = jwkInlineBody.scopes as string[];
    expect(jwkInlineScopes, 'Canvas JSON (jwk=inline) scopes equals 4 AGS scopes').toEqual([...FOUR_AGS_SCOPES]);
    expect(
      jwkInlineScopes.some((s) => s.includes('nrps') || s.includes('contextmembership')),
      'Canvas JSON (jwk=inline) contains no NRPS scope',
    ).toBe(false);

    // 2. AC-LA-E3-07-03 (host API): Moodle manual tool configuration row 13 (nrps) = "Do not use this service"
    const testkitUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/testkit.ts')).href;
    const { THANH, testApp } = (await import(testkitUrl)) as {
      THANH: unknown;
      testApp: (opts?: unknown) => Promise<{
        app: {
          inject: (req: unknown) => Promise<{ statusCode: number; json: () => Record<string, any> }>; // eslint-disable-line @typescript-eslint/no-explicit-any
          close: () => Promise<void>;
        };
        login: (user: unknown) => Promise<string>;
        writeHeaders: (cookie: string) => Record<string, string>;
      }>;
    };

    const t = await testApp();
    try {
      const cookie = await t.login(THANH);
      const call = (method: 'GET' | 'POST', url: string, payload?: unknown) =>
        t.app.inject({
          method,
          url,
          headers: method === 'GET' ? { cookie } : t.writeHeaders(cookie),
          ...(payload !== undefined ? { payload } : {}),
        });

      const moodleCreate = await call('POST', '/app-api/connections', {
        name: 'Moodle NRPS Check',
        siteUrl: 'https://moodle.school.edu',
        method: 'manual',
        lms: 'moodle',
      });
      expect(moodleCreate.statusCode).toBe(201);
      const moodleId = String(moodleCreate.json().id);

      const moodleCfgRes = await call('GET', `/app-api/connections/${moodleId}/tool-configuration`);
      expect(moodleCfgRes.statusCode).toBe(200);
      const moodleCfgBody = moodleCfgRes.json();
      const rows = (Array.isArray(moodleCfgBody) ? moodleCfgBody : moodleCfgBody.rows ?? moodleCfgBody.fields) as Array<{
        key: string;
        label: string;
        value: string;
      }>;
      expect(rows).toHaveLength(16);
      const row12 = rows[11]!;
      expect(row12.key).toBe('ags');
      expect(row12.value).toBe('Use this service for grade sync and column management');
      const row13 = rows[12]!;
      expect(row13.key).toBe('nrps');
      expect(row13.label).toBe('IMS LTI Names and Role Provisioning');
      expect(row13.value).toBe('Do not use this service');

      artifact(
        'e3-07-api-checks.json',
        `${JSON.stringify(
          {
            canvasJwkUrlScopes: jwkUrlScopes,
            canvasJwkInlineScopes: jwkInlineScopes,
            moodleRowCount: rows.length,
            moodleRow12: row12,
            moodleRow13: row13,
          },
          null,
          2,
        )}\n`,
      );
    } finally {
      await t.app.close();
    }

    // 3. Run unit tests covering LA-E3-07
    const unitRun = await run('npx', [
      '--no-install',
      'vitest',
      'run',
      '--reporter=verbose',
      'packages/channels/canvas/app/configuration.test.ts',
      'packages/channels/moodle/app.test.ts',
      'services/cogniate-app/src/app/canvas-configuration.test.ts',
      'services/cogniate-app/src/app/connect.test.ts',
    ]);
    artifact('e3-07-unit.log', unitRun.output);
    expect(unitRun.code, `LA-E3-07 unit tests exit 0:\n${unitRun.output}`).toBe(0);
  });
});
