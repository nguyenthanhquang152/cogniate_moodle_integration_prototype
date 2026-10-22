import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LogLine } from '@cogniate/shared';
import type * as Shared from '@cogniate/shared';
import { PUBLIC_URL_ENV, createLogger, createOutboundClient, startService } from '@cogniate/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as kernel from '@cogniate/channel-kernel';
import type { AppConfig } from '../config.ts';
import type * as PackageStore from '../domain/package-store.ts';
import { TEST_URLS } from '../testkit.ts';
import { CHANNEL_ROOT, buildAppChannelRegistry } from './registry.ts';

// Execute main.ts and its real listener builder. Only the external resources are replaced.
// Stop after the entire app builder returns, before a socket opens. Registry checks do not depend on
// the order of client/worker construction in that builder, and all config fields have valid values.
vi.mock('../config.ts', () => ({ loadConfig: () => config }));
vi.mock('../domain/db.ts', () => ({ openDb: vi.fn() }));
vi.mock('../domain/package-store.ts', async (importOriginal) => {
  const original = await importOriginal<typeof PackageStore>();
  return { ...original, prepareStore: vi.fn(async (dir: string) => original.storePaths(dir)) };
});
vi.mock('../app/server.ts', () => ({
  buildAppApi: vi.fn(async () => ({ ready: async () => undefined, server: createServer() })),
}));
vi.mock('../worker/score-sync.ts', () => ({
  createScoreSyncWorker: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), kick: vi.fn() })),
}));
vi.mock('@cogniate/shared', async (importOriginal) => {
  const original = await importOriginal<typeof Shared>();
  return {
    ...original,
    startService: vi.fn((service: Parameters<typeof original.startService>[0], listeners: Shared.ServiceListener[]) => original.startService(service,
      listeners.map((listener): Shared.ServiceListener => ({ ...listener, build: async (deps) => {
        await listener.build(deps);
        throw new Error('app listener built');
      } })), {
      env: serviceEnv, handleSignals: false, write: (line) => startLines.push(JSON.parse(line) as LogLine),
    })),
    createOutboundClient: vi.fn(() => ({ request: vi.fn(async () => { throw new Error('unexpected outbound request'); }) })),
    startRetention: vi.fn(),
  };
});

vi.mock('@cogniate/channel-kernel', async (importOriginal) => {
  const original = await importOriginal<typeof kernel>();
  return { ...original, loadChannelFolders: vi.fn(original.loadChannelFolders) };
});

const tempRoots: string[] = [];
const startLines: LogLine[] = [];
const config: AppConfig = {
  jobInstanceId: 'app-1', jobRunner: true,
  urls: TEST_URLS, dataDir: tmpdir(), profile: 'default', masterKey: Buffer.alloc(32, 5),
  ltiApiKeyFile: join(tmpdir(), 'app-registry-test-key'), ltiApiUrl: null,
  playerDir: join(tmpdir(), 'app-registry-test-player'), buildQueueDir: join(tmpdir(), 'app-registry-test-builds'),
};
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.mocked(kernel.loadChannelFolders).mockReset();
  startLines.length = 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

type Json = Record<string, unknown>;

/** A valid test channel `zz-test` (manual with an operator grant, a registration-level guard). */
function testManifest(over: Json = {}): Json {
  return {
    id: 'zz-test', family: 'lti13', names: { text: 'ZZ', label: 'ZZ test' },
    card: { title: 'ZZ', description: 'A test channel.', mark: 'Z', color: 'gray', category: 'LMS Publishing', order: 90 },
    availability: 'ga',
    registration: [{ method: 'manual', authority: 'operatorGrant', profiles: ['zz-test'], defaultProfile: 'zz-test' }],
    capabilities: {},
    lti: { guardedFamilies: [{ family: 'zz', level: 'registration' }], toolConfiguration: 'channel' },
    setup: { createFields: [], bindingFields: [] },
    texts: { adminSteps: [], teacherSteps: [], disconnect: 'Cogniate stops in {LMS}.', notReady: null },
    ...over,
  };
}

/** A temporary root with one channel folder `zz-test`. */
function testRoot(manifest: Json): string {
  const root = mkdtempSync(join(tmpdir(), 'app-channel-root-'));
  tempRoots.push(root);
  mkdirSync(join(root, 'zz-test'));
  writeFileSync(join(root, 'zz-test', 'manifest.ts'), `export default ${JSON.stringify(manifest)};\n`);
  return root;
}

/** The service environment of the start tests: the public URLs only. */
const serviceEnv = Object.fromEntries(Object.entries(PUBLIC_URL_ENV).map(([key, name]) => [name, TEST_URLS[key as keyof typeof TEST_URLS]]));

const logSink = () => {
  const lines: LogLine[] = [];
  return { lines, write: (line: string) => lines.push(JSON.parse(line) as LogLine) };
};

it('the product root is the repository folder packages/channels', () => {
  expect(realpathSync(CHANNEL_ROOT)).toBe(realpathSync(fileURLToPath(new URL('../../../../packages/channels', import.meta.url))));
});

describe('AC-LA-E1-02-05: a failing load check stops the app start with one channel_registry_invalid line', () => {
  // One failing case per load check that the app runs (5 and 7 need the LTI profiles).
  const cases: Array<[number, string, Json]> = [
    [1, 'manifest_id_not_folder', testManifest({ id: 'zz-other' })],
    [2, 'profile_in_two_channels', testManifest({ registration: [{ method: 'manual', authority: 'operatorGrant', profiles: ['standard'], defaultProfile: 'standard' }] })],
    [3, 'family_guarded_twice', testManifest({ lti: { guardedFamilies: [{ family: 'canvas', level: 'registration' }], toolConfiguration: 'channel' } })],
    [4, 'create_course_needs_site_api_token', testManifest({ capabilities: { 'publish.createCourse': true } })],
    [6, 'manual_self_authority', testManifest({ registration: [{ method: 'manual', authority: 'self', profiles: ['zz-test'], defaultProfile: 'zz-test' }] })],
    [8, 'launch_guard_not_allowed', testManifest({ lti: { guardedFamilies: [{ family: 'zz', level: 'launch' }], toolConfiguration: 'channel' } })],
  ];

  it.each(cases)('check %i (%s)', async (check, reason, manifest) => {
    const root = testRoot(manifest);
    const original = await vi.importActual<typeof kernel>('@cogniate/channel-kernel');
    // Inject an invalid discovered channel, without changing the product start's roots or registry call.
    vi.mocked(kernel.loadChannelFolders).mockImplementationOnce((roots, side) => original.loadChannelFolders([...roots, root], side));
    await expect(import('../main.ts')).rejects.toMatchObject({ name: 'RegistryError', check, reason });
    expect(startService).toHaveBeenCalledOnce();
    expect(startLines.filter((l) => l.event === 'channel_registry_invalid')).toEqual([
      expect.objectContaining({ level: 'error', service: 'cogniate-app', channel: 'zz-test', reason, check }),
    ]);
    expect(startLines.some((l) => l.event === 'service_started')).toBe(false);
  });

  it('a valid extra root loads next to the product channels, and nothing is logged', async () => {
    const sink = logSink();
    const registry = await buildAppChannelRegistry([CHANNEL_ROOT, testRoot(testManifest())], createLogger({ service: 'cogniate-app', write: sink.write }));
    expect(registry.channels().map((m) => m.id)).toEqual(['moodle', 'canvas', 'blackboard', 'zz-test']);
    expect(sink.lines).toEqual([]);
  });
});

it('AC-LA-E1-02-06: the app start loads one constant root; no environment variable adds a root', async () => {
  const extra = testRoot(testManifest());
  // Names that a root setting could plausibly use: none of them is read.
  for (const name of ['CHANNEL_ROOT', 'CHANNEL_ROOTS', 'CHANNELS_ROOT', 'CHANNELS_DIR', 'CHANNEL_DIR', 'CHANNEL_PATH', 'CHANNEL_PATHS',
    'EXTRA_CHANNEL_ROOT', 'EXTRA_CHANNEL_ROOTS', 'COGNIATE_CHANNEL_ROOT', 'APP_CHANNEL_ROOTS', 'LTIAAS_CHANNEL_ROOTS', 'TEST_CHANNEL_ROOT', 'CANARY_CHANNEL_ROOT']) {
    vi.stubEnv(name, extra);
  }
  await expect(import('../main.ts')).rejects.toThrow('app listener built');
  expect(startService).toHaveBeenCalledOnce();
  expect(createOutboundClient).toHaveBeenCalledOnce();
  expect(vi.mocked(kernel.loadChannelFolders).mock.calls).toEqual([[[CHANNEL_ROOT], 'app']]);
  const loaded = await vi.mocked(kernel.loadChannelFolders).mock.results[0]!.value;
  expect(kernel.buildChannelRegistry(loaded, { simulations: true }).channels().map((m) => m.id)).toEqual(['moodle', 'canvas', 'blackboard']);
});
