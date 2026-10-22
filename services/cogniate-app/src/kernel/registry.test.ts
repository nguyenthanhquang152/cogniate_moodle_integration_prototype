import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LogLine } from '@cogniate/shared';
import { PUBLIC_URL_ENV, createLogger, startService } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as kernel from '@cogniate/channel-kernel';
import { TEST_URLS } from '../testkit.ts';
import { CHANNEL_ROOT, buildAppChannelRegistry, loadAppChannelRegistry } from './registry.ts';

vi.mock('@cogniate/channel-kernel', async (importOriginal) => {
  const original = await importOriginal<typeof kernel>();
  return { ...original, loadChannelFolders: vi.fn(original.loadChannelFolders) };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(kernel.loadChannelFolders).mockClear();
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
    const sink = logSink();
    // The same listener shape as main.ts: the registry loads inside the app listener build, before it listens.
    const start = startService('cogniate-app', [{
      name: 'cogniate-app', port: 0, publicUrl: (u) => u.app,
      build: async (deps) => {
        await buildAppChannelRegistry([CHANNEL_ROOT, root], deps.logger);
        throw new Error('the start must stop at the registry');
      },
    }], { env: serviceEnv, handleSignals: false, write: sink.write });
    await expect(start).rejects.toMatchObject({ name: 'RegistryError', check, reason });
    expect(sink.lines.filter((l) => l.event === 'channel_registry_invalid')).toEqual([
      expect.objectContaining({ level: 'error', service: 'cogniate-app', channel: 'zz-test', reason, check }),
    ]);
    expect(sink.lines.some((l) => l.event === 'service_started')).toBe(false);
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
  const registry = await loadAppChannelRegistry(createLogger({ service: 'cogniate-app', write: () => undefined }));
  expect(registry.channels().map((m) => m.id)).toEqual(['moodle', 'canvas', 'blackboard']);
  expect(vi.mocked(kernel.loadChannelFolders).mock.calls).toEqual([[[CHANNEL_ROOT], 'app']]);
});
