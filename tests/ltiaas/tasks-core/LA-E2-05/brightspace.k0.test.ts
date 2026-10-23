// LA-E2-05 K0, UNIT-row, and DOC-row acceptance tests (no Docker):
// - AC-LA-E2-05-01: `npm run fitness:channel-diff -- --base <E2-K-done SHA> --channel brightspace` reports `core` = 0;
//   the report lists only `channel:brightspace`, `sim`, `tests` and `docs` paths.
// - AC-LA-E2-05-02: The D2L defaults are constants: auth `{siteUrl}/d2l/lti/authenticate`, JWKS `{siteUrl}/d2l/.well-known/jwks`,
//   token `https://auth.brightspace.com/core/connect/token`, audience `https://api.brightspace.com/auth/token`; the profile
//   has `endpoints: admin`, `per-tenant`, `any-https`, `{platformValue}`, sharing `exclusive`, `privacyFloor: allowlist`.
// - AC-LA-E2-05-03: K0 passes for `brightspace` with no kernel edit; its legacy flags are `operatorApproval` true,
//   `addDeployment` true, all others false.
// - AC-LA-E2-05-06 (host unit/manifest check): `setup.toolRows` and `GET .../tool-configuration` give the 9 D2L rows
//   `tool_name`, `domain`, `redirect_urls`, `openid_connect_login_url`, `target_link_uri`, `keyset_url`, `extensions`,
//   `roles`, `privacy` in this order (app API delta §3.3, BD-A1-78, BD-A1-94).
// - AC-LA-E2-05-08: `packages/channels/brightspace/README.md` lists each fact of LA-ADR-02 D4 with its source and status;
//   the family and the frame name are marked UNVERIFIED.
// - AC-LA-E2-05-09: `capabilities('brightspace')` has `registration.scopes` equal to the four AGS scopes `lineitem`,
//   `lineitem.readonly`, `result.readonly`, `score`, and no NRPS scope.
// Source: docs/architecture/ltiaas/tasks/LA-E2-05.md; LA-ADR-01 D2, D5, D6; LA-ADR-02 D1, D4, D8; LA-ADR-05 D4;
// cogniate-app-api-delta.md §3.3; build-decisions-A1.md BD-A1-78, BD-A1-80, BD-A1-94, BD-A1-95.
// QA-3 wrote these tests from the spec, contracts and ADRs only (test-first).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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
  scriptEchoes,
  type RunResult,
} from '../LA-E1-04/fitness';

const FOUR_AGS_SCOPES = [
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/score',
] as const;

const D2L_TOOL_ROW_KEYS = [
  'tool_name',
  'domain',
  'redirect_urls',
  'openid_connect_login_url',
  'target_link_uri',
  'keyset_url',
  'extensions',
  'roles',
  'privacy',
] as const;

interface FieldSpecLike {
  key: string;
  label: string;
  kind: string;
  required: boolean;
  method?: string;
  default?: string;
}

interface ToolRowSpecLike {
  key: string;
  label: string;
  value: string;
}

interface ChannelManifest {
  id: string;
  family: string;
  names: { text: string; label: string };
  card: { title: string; description: string; mark: string; color: string; category: string; order: number };
  availability: 'ga' | 'preview' | 'simulation-only';
  registration: Array<{
    method: 'dynamic' | 'manual';
    authority: 'self' | 'operatorGrant';
    profiles: string[];
    defaultProfile: string;
  }>;
  capabilities: Record<string, unknown>;
  lti?: {
    guardedFamilies: Array<{ family: string; level: 'launch' | 'registration' }>;
    toolConfiguration: 'channel' | 'none';
  };
  setup: {
    createFields: FieldSpecLike[];
    bindingFields: FieldSpecLike[];
    toolRows?: ToolRowSpecLike[];
    connectionCheck?: boolean;
  };
}

interface ProfileSourceLike {
  id: string;
  listOrder: number;
  endpoints: 'admin' | 'fixed';
  sharing?: 'exclusive' | 'shared';
  issuerKind?: 'per-tenant' | 'fixed';
  endpointOrigins?: 'issuer' | 'any-https' | null;
  clientAssertionAud?: { value: string; form: string } | unknown;
  dynamicRegistration?: {
    issuerRule: string;
    configurationPath?: string;
    registrationToken: string;
  } | null;
  privacyFloor: 'allowlist' | 'none';
  platformStorage?: { targetFrame: string; origin: string } | null;
  simulation?: boolean;
}

interface LoadedChannel {
  folder: string;
  manifest: ChannelManifest;
  ltiProfiles?: ProfileSourceLike[];
  appAdapter?: unknown;
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
  channels(): readonly ChannelManifest[];
  channel(id: string): ChannelManifest | null;
  capabilities(channelId: string, profile?: unknown): Record<string, unknown>;
  legacyCapabilities(channelId: string, profile?: unknown): LegacyCapabilities;
}

interface KernelSurface {
  loadChannelFolders(roots: readonly string[], side: 'lti' | 'app'): Promise<LoadedChannel[]>;
  buildChannelRegistry(channels: readonly LoadedChannel[], opts: { simulations: boolean }): ChannelRegistry;
  parseManifest?: (raw: unknown) => ChannelManifest;
}

let clean: RunResult;
let kernel: KernelSurface;
let ltiLoaded: LoadedChannel[];
let appLoaded: LoadedChannel[];
let reg: ChannelRegistry;

beforeAll(async () => {
  requireScratchClone();
  requireRunDir();
  clean = await npmCheck('e2-05-check-clean');
  const kernelEntry = pathToFileURL(path.join(ROOT, 'packages/channel-kernel/src/index.ts')).href;
  kernel = (await import(kernelEntry)) as KernelSurface;
  const channelsRoot = path.join(ROOT, 'packages/channels');
  ltiLoaded = await kernel.loadChannelFolders([channelsRoot], 'lti');
  appLoaded = await kernel.loadChannelFolders([channelsRoot], 'app');
  reg = kernel.buildChannelRegistry(appLoaded, { simulations: true });
});

describe('LA-E2-05 E2-N channel brightspace (manual) and add-channel gate F2 (K0 + UNIT + DOC)', () => {
  it('AC-LA-E2-05-01: npm run fitness:channel-diff -- --base <E2-K-done SHA> --channel brightspace reports core = 0 and lists only channel:brightspace, sim, tests and docs paths', async () => {
    expect(clean.code, `npm run check exits 0 on clean tree:\n${clean.output}`).toBe(0);
    const echoes = scriptEchoes(clean.output);
    expect(echoes.some((s) => /fitness:lms-names|lms-names/.test(s)), 'npm run check ran F1').toBe(true);
    expect(echoes.some((s) => /fitness:rules|rules\.mjs/.test(s)), 'npm run check ran F5').toBe(true);

    const baseSha = (process.env.LA_E2_K_DONE_SHA ?? '678eb72').trim();
    const taskSha = (process.env.LA_E2_05_SHA ?? 'a3d9434').trim();

    // 1. Run F2 from a detached checkout of the LA-E2-05 commit (a3d9434) against E2-K-done (678eb72), as the spec states.
    const wtDir = fs.mkdtempSync(path.join(os.tmpdir(), 'la-e2-05-wt-'));
    try {
      const wtAdd = await run('git', ['worktree', 'add', '--detach', wtDir, taskSha]);
      expect(wtAdd.code, `git worktree add ${taskSha} exits 0:\n${wtAdd.output}`).toBe(0);

      const f2Task = await run(
        'node',
        [path.join(wtDir, 'infra/scripts/fitness/channel-diff.mjs'), '--base', baseSha, '--channel', 'brightspace'],
        { cwd: wtDir },
      );
      artifact('e2-05-ac01-f2-task-sha.log', f2Task.output);
      expect(f2Task.code, `F2 on ${taskSha} against ${baseSha} exits 0:\n${f2Task.output}`).toBe(0);
      expect(f2Task.output, 'F2 reports core = 0').toMatch(/core\s*=\s*0\b/);

      const lines = f2Task.output
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('F2 ') && !l.startsWith('>'));
      expect(lines.length, 'F2 lists changed paths for brightspace').toBeGreaterThan(0);
      for (const line of lines) {
        expect(
          line,
          `every classified path is channel:brightspace, sim, tests, or docs (got: ${line})`,
        ).toMatch(/^(channel:brightspace|sim|tests|docs)\t/);
      }
      expect(
        lines.some((l) => l.startsWith('channel:brightspace\tpackages/channels/brightspace/')),
        'F2 lists packages/channels/brightspace/** under channel:brightspace',
      ).toBe(true);
    } finally {
      await run('git', ['worktree', 'remove', '--force', wtDir]);
      fs.rmSync(wtDir, { recursive: true, force: true });
    }

    // 2. Also run F2 on the LA-E2-05 task commit (a3d9434) via --paths-from /dev/stdin at ROOT.
    const diffTask = await run('git', ['diff', '--name-status', `${taskSha}^`, taskSha]);
    expect(diffTask.code).toBe(0);
    const f2HeadRes = spawnSync(
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
        input: diffTask.output,
        encoding: 'utf8',
      },
    );
    const f2HeadOut = `${f2HeadRes.stdout ?? ''}${f2HeadRes.stderr ?? ''}`;
    artifact('e2-05-ac01-f2-head.log', f2HeadOut);
    expect(f2HeadRes.status, `F2 on ${taskSha} exits 0:\n${f2HeadOut}`).toBe(0);
    expect(f2HeadOut, 'F2 reports core = 0').toMatch(/core\s*=\s*0\b/);
  });

  it('AC-LA-E2-05-02, AC-LA-E2-05-03, AC-LA-E2-05-09 (and Round 2 BD-A1-85 lti.toolConfiguration = channel): brightspace folder layout, D2L FieldSpec.default constants, profile traits, legacy flags, 4 AGS scopes (no NRPS), and K0 pass', async () => {
    // 1. Folder layout: manifest.ts, lti-profiles.ts, README.md; no app.ts (LA-ADR-02 D4).
    const bsDir = path.join(ROOT, 'packages/channels/brightspace');
    expect(fs.existsSync(path.join(bsDir, 'manifest.ts')), 'brightspace/manifest.ts exists').toBe(true);
    expect(fs.existsSync(path.join(bsDir, 'lti-profiles.ts')), 'brightspace/lti-profiles.ts exists').toBe(true);
    expect(fs.existsSync(path.join(bsDir, 'README.md')), 'brightspace/README.md exists').toBe(true);
    expect(fs.existsSync(path.join(bsDir, 'app.ts')), 'brightspace has no app.ts (kernel admin-value adapter)').toBe(
      false,
    );

    const manifest = reg.channel('brightspace');
    expect(manifest, 'brightspace is registered in ChannelRegistry').not.toBeNull();
    if (typeof kernel.parseManifest === 'function') {
      expect(() => kernel.parseManifest!(manifest)).not.toThrow();
    }

    // Round 2 (BD-A1-85, 6bfb150): lti.toolConfiguration is 'channel' for both brightspace and lti-generic.
    expect(manifest!.lti?.toolConfiguration, 'brightspace lti.toolConfiguration is channel (BD-A1-85)').toBe('channel');
    expect(
      reg.channel('lti-generic')?.lti?.toolConfiguration,
      'lti-generic lti.toolConfiguration is channel (BD-A1-85)',
    ).toBe('channel');

    // Registration: manual -> operatorGrant, profile brightspace (and dynamic -> self after LA-E2-06).
    expect(manifest!.registration).toContainEqual({
      method: 'manual',
      authority: 'operatorGrant',
      profiles: ['brightspace'],
      defaultProfile: 'brightspace',
    });

    // Guarded family: desire2learn at registration level (LA-ADR-02 D1, D4).
    expect(manifest!.lti?.guardedFamilies).toEqual([{ family: 'desire2learn', level: 'registration' }]);

    // AC-LA-E2-05-02: The four D2L defaults in manifest.setup.bindingFields.
    const bindingByKey = new Map(
      manifest!.setup.bindingFields.filter((f) => f.method !== 'dynamic').map((f) => [f.key, f]),
    );
    expect(bindingByKey.get('authenticationEndpoint')?.default, 'D2L auth default').toBe(
      '{siteUrl}/d2l/lti/authenticate',
    );
    expect(bindingByKey.get('jwksUrl')?.default, 'D2L JWKS default').toBe('{siteUrl}/d2l/.well-known/jwks');
    expect(bindingByKey.get('accessTokenEndpoint')?.default, 'D2L token default').toBe(
      'https://auth.brightspace.com/core/connect/token',
    );
    expect(bindingByKey.get('tokenAudience')?.default, 'D2L audience default').toBe(
      'https://api.brightspace.com/auth/token',
    );

    // AC-LA-E2-05-02: Profile traits.
    const bsLti = ltiLoaded.find((c) => c.manifest.id === 'brightspace');
    expect(bsLti, 'brightspace loaded on lti side').toBeDefined();
    const profile = bsLti!.ltiProfiles?.find((p) => p.id === 'brightspace');
    expect(profile, 'brightspace profile exists').toBeDefined();
    expect(profile!.endpoints).toBe('admin');
    expect(profile!.issuerKind).toBe('per-tenant');
    expect(profile!.endpointOrigins).toBe('any-https');
    expect(profile!.clientAssertionAud).toEqual({ value: '{platformValue}', form: 'string' });
    expect(profile!.sharing).toBe('exclusive');
    expect(profile!.privacyFloor).toBe('allowlist');
    expect(profile!.platformStorage ?? null).toBeNull();

    // AC-LA-E2-05-03 & Scope: capabilities and legacy flags.
    const caps = reg.capabilities('brightspace');
    expect((caps['binding.authority'] as Record<string, unknown>).manual).toBe('operatorGrant');
    expect(caps['deployments.multiple']).toBe(true);
    expect(caps['launch.windowHint']).toBe(true);
    expect(caps['launch.topLevelContinue']).toBe(false);
    expect(caps['records.reporters']).toEqual(['lti-ags']);
    expect(caps['records.readBack']).toBe(true);

    // AC-LA-E2-05-09: registration.scopes equals the four AGS scopes and no NRPS scope.
    expect(caps['registration.scopes'], 'AC-LA-E2-05-09: four AGS scopes and no NRPS').toEqual([...FOUR_AGS_SCOPES]);
    expect(
      (caps['registration.scopes'] as string[]).some((s) => s.includes('nrps') || s.includes('contextmembership')),
      'no NRPS scope in brightspace registration.scopes',
    ).toBe(false);

    // AC-LA-E2-05-03: legacy flags: operatorApproval true, addDeployment true, webServices/courseShell/canvasConfiguration false
    // (dynamicRegistration is false at LA-E2-05 commit a3d9434 and becomes true in LA-E2-06 1b298d9).
    const legacy = reg.legacyCapabilities('brightspace');
    expect(legacy).toMatchObject({
      operatorApproval: true,
      addDeployment: true,
      webServices: false,
      courseShell: false,
      canvasConfiguration: false,
    });

    artifact('e2-05-ac02-03-09-manifest-profile.json', `${JSON.stringify({ manifest, profile, caps, legacy }, null, 2)}\n`);

    // AC-LA-E2-05-03: K0 passes with brightspace loaded.
    const k0Run = hasScript('test:k0')
      ? await run('npm', ['run', 'test:k0'])
      : await run('npx', ['--no-install', 'vitest', 'run', '--config', 'tests/ltiaas/k0/vitest.config.mts']);
    artifact('e2-05-ac03-k0.log', k0Run.output);
    expect(k0Run.code, `test:k0 exits 0 with brightspace:\n${k0Run.output}`).toBe(0);
  });

  it('AC-LA-E2-05-06 (host API/unit check) & AC-LA-E2-05-02 FieldSpec.default fills & manifest load checks: GET .../tool-configuration returns the 9 D2L rows in order, FieldSpec.default fills all 5 defaults, and load checks pass', async () => {
    const manifest = reg.channel('brightspace');
    expect(manifest).not.toBeNull();
    const toolRows = manifest!.setup.toolRows;
    expect(toolRows, 'brightspace manifest defines setup.toolRows (BD-A1-78, BD-A1-94)').toBeDefined();
    expect(toolRows!.map((r) => r.key), '9 D2L tool row keys in app API delta §3.3 order').toEqual([
      ...D2L_TOOL_ROW_KEYS,
    ]);

    const rowByKey = new Map(toolRows!.map((r) => [r.key, r]));
    expect(rowByKey.get('tool_name')?.value).toContain('{toolName}');
    expect(rowByKey.get('domain')?.value).toContain('{ltiHost}');
    expect(rowByKey.get('redirect_urls')?.value).toContain('{launchUrl}');
    expect(rowByKey.get('openid_connect_login_url')?.value).toContain('{loginUrl}');
    expect(rowByKey.get('target_link_uri')?.value).toContain('{launchUrl}');
    expect(rowByKey.get('keyset_url')?.value).toContain('{keysUrl}');
    expect(rowByKey.get('extensions')?.value).toBe('Assignment and Grade Services, Deep Linking');
    expect(rowByKey.get('roles')?.value).toBe('Send institution role');
    expect(rowByKey.get('privacy')?.value).toBe('Do not send name or e-mail.');

    // 1. Direct kernel setup adapter + FieldSpec.default fill check + HTTP GET .../tool-configuration via testApp.
    const setupModuleUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/kernel/setup.ts')).href;
    const testkitModuleUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/testkit.ts')).href;
    const { servedByKernel, setupOf } = (await import(setupModuleUrl)) as {
      servedByKernel: (r: unknown, id: string) => boolean;
      setupOf: (r: unknown, id: string) => {
        parseBindingBody: (body: unknown, ctx: unknown) => { ok: boolean; values?: Record<string, unknown> };
      } | null;
    };
    const { TEST_URLS, THANH, testApp } = (await import(testkitModuleUrl)) as {
      TEST_URLS: { lti: string; app: string };
      THANH: unknown;
      testApp: (opts?: unknown) => Promise<{
        app: {
          inject: (req: unknown) => Promise<{ statusCode: number; json: () => Record<string, unknown> }>;
          close: () => Promise<void>;
        };
        lti: {
          providers: Array<Record<string, unknown>>;
        };
        login: (user: unknown) => Promise<string>;
        writeHeaders: (cookie: string) => Record<string, string>;
      }>;
    };

    expect(servedByKernel(reg, 'brightspace'), 'brightspace is served by the kernel admin-value adapter').toBe(true);
    const bsSetup = setupOf(reg, 'brightspace');
    expect(bsSetup).not.toBeNull();

    const d2lSite = 'https://school.brightspace.com';
    const grantCode = 'B'.repeat(43);
    const filled = bsSetup!.parseBindingBody(
      { clientId: 'd2l-client-1', deploymentId: '550e8400-e29b-41d4-a716-446655440000', grantCode },
      { siteUrl: d2lSite, sharedClientId: null, purpose: 'initial' },
    );
    expect(filled, 'FieldSpec.default fills issuer, auth, jwks, token, and audience when omitted').toEqual({
      ok: true,
      values: {
        clientId: 'd2l-client-1',
        deploymentId: '550e8400-e29b-41d4-a716-446655440000',
        grantCode,
        adminValues: {
          issuer: d2lSite,
          authenticationEndpoint: `${d2lSite}/d2l/lti/authenticate`,
          accessTokenEndpoint: 'https://auth.brightspace.com/core/connect/token',
          jwksUrl: `${d2lSite}/d2l/.well-known/jwks`,
          tokenAudience: 'https://api.brightspace.com/auth/token',
        },
      },
    });

    const overridden = bsSetup!.parseBindingBody(
      {
        issuer: `${d2lSite}/org`,
        clientId: 'd2l-client-1',
        deploymentId: '550e8400-e29b-41d4-a716-446655440000',
        authenticationEndpoint: `${d2lSite}/custom/auth`,
        accessTokenEndpoint: 'https://custom-auth.brightspace.com/token',
        jwksUrl: `${d2lSite}/custom/jwks`,
        tokenAudience: 'https://custom-api.brightspace.com/aud',
        grantCode,
      },
      { siteUrl: d2lSite, sharedClientId: null, purpose: 'initial' },
    );
    expect(overridden, 'Posted values override FieldSpec.default constants').toEqual({
      ok: true,
      values: {
        clientId: 'd2l-client-1',
        deploymentId: '550e8400-e29b-41d4-a716-446655440000',
        grantCode,
        adminValues: {
          issuer: `${d2lSite}/org`,
          authenticationEndpoint: `${d2lSite}/custom/auth`,
          accessTokenEndpoint: 'https://custom-auth.brightspace.com/token',
          jwksUrl: `${d2lSite}/custom/jwks`,
          tokenAudience: 'https://custom-api.brightspace.com/aud',
        },
      },
    });

    // HTTP API check for GET /app-api/connections/:id/tool-configuration on a brightspace connection (AC-LA-E2-05-06).
    const t = await testApp({ channels: reg });
    try {
      if (!t.lti.providers.some((p) => p.id === 'brightspace')) {
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
      const cookie = await t.login(THANH);
      const createRes = await t.app.inject({
        method: 'POST',
        url: '/app-api/connections',
        headers: t.writeHeaders(cookie),
        payload: { name: 'D2L Uni', siteUrl: d2lSite, method: 'manual', lms: 'brightspace' },
      });
      expect(createRes.statusCode).toBe(201);
      const created = createRes.json();
      expect(created).toMatchObject({
        channel: 'brightspace',
        lms: 'brightspace',
        profile: 'brightspace',
        bindingAuthority: 'operatorGrant',
      });

      const cfgRes = await t.app.inject({
        method: 'GET',
        url: `/app-api/connections/${String(created.id)}/tool-configuration`,
        headers: { cookie },
      });
      expect(cfgRes.statusCode).toBe(200);
      const cfgJson = cfgRes.json() as unknown;
      const apiRows = (
        Array.isArray(cfgJson)
          ? cfgJson
          : ((cfgJson as { rows?: unknown[]; fields?: unknown[] }).rows ??
            (cfgJson as { rows?: unknown[]; fields?: unknown[] }).fields ??
            [])
      ) as Array<{ key: string; label: string; value: string }>;
      expect(apiRows.map((r) => [r.key, r.value])).toEqual([
        ['tool_name', "Cogniate (Thanh's Library)"],
        ['domain', new URL(TEST_URLS.lti).host],
        ['redirect_urls', `${TEST_URLS.lti}/lti/launch/cogniate`],
        ['openid_connect_login_url', `${TEST_URLS.lti}/lti/login/cogniate`],
        ['target_link_uri', `${TEST_URLS.lti}/lti/launch/cogniate`],
        ['keyset_url', `${TEST_URLS.lti}/lti/keys/cogniate`],
        ['extensions', 'Assignment and Grade Services, Deep Linking'],
        ['roles', 'Send institution role'],
        ['privacy', 'Do not send name or e-mail.'],
      ]);
      artifact('e2-05-ac06-tool-config.json', `${JSON.stringify(apiRows, null, 2)}\n`);
    } finally {
      await t.app.close();
    }

    // 2. Manifest load check 6: brightspace with manual -> self is refused at registry build (not in MANUAL_SELF_LEGACY_CHANNELS).
    const bsLoaded = appLoaded.find((c) => c.manifest.id === 'brightspace');
    expect(bsLoaded).toBeDefined();
    const badVariant: LoadedChannel = {
      ...bsLoaded!,
      manifest: {
        ...bsLoaded!.manifest,
        registration: bsLoaded!.manifest.registration.map((r) =>
          r.method === 'manual' ? { ...r, authority: 'self' as const } : r,
        ),
      },
    };
    expect(
      () => kernel.buildChannelRegistry(appLoaded.map((c) => (c.manifest.id === 'brightspace' ? badVariant : c)), {
        simulations: true,
      }),
      'Load check 6 refuses brightspace with manual -> self',
    ).toThrow();

    // 3. Run unit tests in packages/channels/brightspace, services/cogniate-app/src/kernel/setup/admin-value.test.ts, and apps/portal/src/channels/shell.test.tsx.
    const unitRes = await run(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'packages/channels/brightspace',
        'services/cogniate-app/src/kernel/setup/admin-value.test.ts',
        'apps/portal/src/channels/shell.test.tsx',
      ],
      { timeoutMs: 5 * 60_000 },
    );
    artifact('e2-05-unit.log', unitRes.output);
    expect(unitRes.code, `brightspace unit tests exit 0:\n${unitRes.output}`).toBe(0);
  });

  it('AC-LA-E2-05-08: packages/channels/brightspace/README.md lists each fact of LA-ADR-02 D4 with its source and status, and marks family and frame name UNVERIFIED', () => {
    const readmePath = path.join(ROOT, 'packages/channels/brightspace/README.md');
    expect(fs.existsSync(readmePath), 'packages/channels/brightspace/README.md exists').toBe(true);
    const readme = fs.readFileSync(readmePath, 'utf8');
    artifact('e2-05-ac08-readme.md', readme);

    // Must mention the four D2L defaults, profile traits, family desire2learn, frame name / platformStorage, and UNVERIFIED markers.
    expect(readme).toContain('/d2l/lti/authenticate');
    expect(readme).toContain('/d2l/.well-known/jwks');
    expect(readme).toContain('https://auth.brightspace.com/core/connect/token');
    expect(readme).toContain('https://api.brightspace.com/auth/token');
    expect(readme).toContain('desire2learn');
    expect(readme).toMatch(/UNVERIFIED/);
    // Both the family (desire2learn) and the frame name / platformStorage are marked UNVERIFIED.
    const unverifiedMatches = readme.match(/UNVERIFIED/g) ?? [];
    expect(
      unverifiedMatches.length,
      'README marks both product family and frame name / platformStorage UNVERIFIED',
    ).toBeGreaterThanOrEqual(2);
    expect(readme).toMatch(/R2|LA-ADR-02/);
  });
});
