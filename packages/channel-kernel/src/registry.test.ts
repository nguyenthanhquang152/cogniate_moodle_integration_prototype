import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { LoadedChannel } from './registry.ts';
import { RegistryError, buildChannelRegistry, loadChannelFolders } from './registry.ts';

/** The product root (packages/channels/). */
const PRODUCT_ROOT = fileURLToPath(new URL('../../channels/', import.meta.url));

type Json = Record<string, unknown>;

/** A valid test channel `zz-test` (not a baseline channel): manual with an operator grant, a registration-level guard. */
function testManifest(over: Json = {}): Json {
  return {
    id: 'zz-test', family: 'lti13', names: { text: 'ZZ', label: 'ZZ test' },
    card: { title: 'ZZ', description: 'A test channel.', mark: 'Z', color: 'gray', category: 'LMS Publishing', order: 90 },
    availability: 'ga',
    registration: [{ method: 'manual', authority: 'operatorGrant', profiles: ['zz-test'], defaultProfile: 'zz-test' }],
    capabilities: { 'deployments.multiple': true },
    lti: { guardedFamilies: [{ family: 'zz', level: 'registration' }], toolConfiguration: 'channel' },
    setup: { createFields: [{ key: 'siteUrl', label: 'Site URL', kind: 'origin', required: true }], bindingFields: [] },
    texts: { adminSteps: ['Open {LMS} as {tool} on {site}.'], teacherSteps: [], disconnect: 'Cogniate stops in {LMS}.', notReady: null },
    ...over,
  };
}

const channel = (manifest: unknown, folder = '/x/zz-test', extra: Partial<LoadedChannel> = {}): LoadedChannel => ({ folder, manifest, ...extra });

it('carries app adapters through discovery without exposing hidden channels', () => {
  const adapter = { channel: 'zz-test', checkCreate: () => ({ ok: true }) };
  const loaded = [channel(testManifest({ availability: 'simulation-only' }), '/x/zz-test', { appAdapter: adapter })];
  expect(buildChannelRegistry(loaded, { simulations: true }).appAdapter('zz-test')).toBe(adapter);
  expect(buildChannelRegistry(loaded, { simulations: false }).appAdapter('zz-test')).toBeNull();
  expect(buildChannelRegistry(loaded, { simulations: true }).appAdapter('unknown')).toBeNull();
  expect(buildChannelRegistry([channel(testManifest())], { simulations: true }).appAdapter('zz-test')).toBeNull();
});

/** The error of a registry build, or a test failure when the build passes. */
function failure(channels: LoadedChannel[]): RegistryError {
  try {
    buildChannelRegistry(channels, { simulations: false });
  } catch (err) {
    if (err instanceof RegistryError) return err;
    throw err;
  }
  throw new Error('the registry build passed');
}

it('accepts only the closed card icon name and keeps mark required', () => {
  const original = testManifest();
  const card = original.card as Json;
  const valid = buildChannelRegistry([channel({ ...original, card: { ...card, icon: 'graduation-cap' } })], { simulations: false });
  expect(valid.channel('zz-test')!.card.icon).toBe('graduation-cap');
  expect(valid.channel('zz-test')!.card.mark).toBe('Z');
  for (const icon of ['unknown', 'https://example.test/icon.svg', '<svg/>', () => null]) {
    expect(failure([channel({ ...original, card: { ...card, icon } })]).message).toContain('card.icon');
  }
  const withoutMark = { ...card };
  delete withoutMark.mark;
  expect(failure([channel({ ...original, card: { ...withoutMark, icon: 'graduation-cap' } })]).message).toContain('card.mark');
});

describe('baseline channels (product root)', () => {
  it('loads moodle, canvas and blackboard in this order, with the M1 capability objects; lti-generic follows (LA-E2-03)', async () => {
    const registry = buildChannelRegistry(await loadChannelFolders([PRODUCT_ROOT], 'app'), { simulations: false });
    expect(registry.channels().map((m) => m.id)).toEqual(['moodle', 'canvas', 'blackboard', 'lti-generic']);
    expect(JSON.stringify(registry.legacyCapabilities('moodle'))).toBe(JSON.stringify(
      { dynamicRegistration: true, operatorApproval: false, webServices: true, courseShell: true, addDeployment: false, canvasConfiguration: false }));
    expect(JSON.stringify(registry.legacyCapabilities('canvas'))).toBe(JSON.stringify(
      { dynamicRegistration: false, operatorApproval: true, webServices: false, courseShell: false, addDeployment: true, canvasConfiguration: true }));
    expect(JSON.stringify(registry.legacyCapabilities('blackboard'))).toBe(JSON.stringify(
      { dynamicRegistration: false, operatorApproval: true, webServices: false, courseShell: false, addDeployment: false, canvasConfiguration: false }));
  });

  it('lookups: family owners, text names, profile owners; the manifests are frozen', async () => {
    const registry = buildChannelRegistry(await loadChannelFolders([PRODUCT_ROOT], 'app'), { simulations: false });
    expect([registry.ownerOfFamily('canvas'), registry.ownerOfFamily('BlackboardLearn'), registry.ownerOfFamily('moodle')]).toEqual(['canvas', 'blackboard', null]);
    expect([registry.textName(null), registry.textName('canvas'), registry.textName('blackboard')]).toEqual(['Moodle', 'Canvas', 'Blackboard']);
    expect([registry.channelOfProfile('standard'), registry.channelOfProfile('canvas-sim-cloud'), registry.channelOfProfile('blackboard'), registry.channelOfProfile('zz')])
      .toEqual(['moodle', 'canvas', 'blackboard', null]);
    expect(registry.channel('zz')).toBeNull();
    expect(Object.isFrozen(registry.channel('canvas')!.registration[0]!.profiles)).toBe(true);
  });

  it('uses neutral text for an unknown non-null id, and the manifest name for a known id', async () => {
    const registry = buildChannelRegistry([
      ...await loadChannelFolders([PRODUCT_ROOT], 'app'), channel(testManifest()),
    ], { simulations: false });
    expect(registry.textName('zz-unknown')).toBe('your LMS');
    expect(registry.textName('zz-test')).toBe('ZZ');
    expect(registry.textName(null)).toBe('Moodle');
  });
});

describe('load checks (each failing case throws RegistryError with its check number)', () => {
  // The baseline channels come from the product root, so a test channel can collide with them.
  const baseline = async () => loadChannelFolders([PRODUCT_ROOT], 'app');
  const cases: Array<[number, string, Json | (() => LoadedChannel[]), string?]> = [
    [1, 'manifest_schema', testManifest({ registration: [{ method: 'manual', authority: 'verifiedAdminLaunch', profiles: ['zz-test'], defaultProfile: 'zz-test' }] }), 'registration.0.authority'],
    [1, 'manifest_schema', testManifest({ family: 'xapi' }), 'family'],
    [1, 'manifest_schema', testManifest({ setup: { createFields: [], bindingFields: [], verify: 'x' } }), 'setup'],
    [1, 'manifest_schema', testManifest({ setup: { createFields: [], bindingFields: [{ key: 'issuer', label: 'Issuer', kind: 'url', required: true, default: '{LMS}/x' }] } }), 'setup.bindingFields.0.default'],
    [1, 'manifest_schema', testManifest({ texts: { adminSteps: ['Open {library}.'], teacherSteps: [], disconnect: 'x', notReady: null } }), 'texts.adminSteps.0'],
    [1, 'manifest_schema', testManifest({ registration: [{ method: 'manual', authority: 'operatorGrant', profiles: ['zz-test'], defaultProfile: 'zz-other' }] }), 'registration.0.defaultProfile'],
    [1, 'manifest_id_not_folder', testManifest({ id: 'zz-other' })],
    [1, 'manifest_missing', () => [channel(undefined)]],
    [1, 'channel_id_duplicate', () => [channel(testManifest(), '/a/zz-test'), channel(testManifest(), '/b/zz-test')]],
    [2, 'profile_in_two_channels', testManifest({ registration: [{ method: 'manual', authority: 'operatorGrant', profiles: ['standard'], defaultProfile: 'standard' }] })],
    [2, 'profile_id_duplicate', () => [channel(testManifest(), '/x/zz-test', { ltiProfiles: [{ id: 'zz-test' }, { id: 'zz-test' }] })]],
    [3, 'family_guarded_twice', testManifest({ lti: { guardedFamilies: [{ family: 'canvas', level: 'registration' }], toolConfiguration: 'none' } })],
    [4, 'capability_unknown', testManifest({ capabilities: { 'export.catalog': true } })],
    [4, 'capability_not_manifest', testManifest({ capabilities: { 'registration.dynamic': true } })],
    [4, 'capability_value', testManifest({ capabilities: { 'records.reporters': 'lti-ags' } })],
    [4, 'create_course_needs_site_api_token', testManifest({ capabilities: { 'publish.createCourse': true } })],
    [5, 'profile_not_in_lti_profiles', () => [channel(testManifest(), '/x/zz-test', { ltiProfiles: [{ id: 'zz-other' }] })]],
    [6, 'shared_platform_self_authority', () => [channel(testManifest({ registration: [{ method: 'dynamic', authority: 'self', profiles: ['zz-test'], defaultProfile: 'zz-test' }] }),
      '/x/zz-test', { ltiProfiles: [{ id: 'zz-test', sharing: 'shared' }] })]],
    [6, 'manual_self_authority', testManifest({ registration: [{ method: 'manual', authority: 'self', profiles: ['zz-test'], defaultProfile: 'zz-test' }] })],
    [8, 'launch_guard_not_allowed', testManifest({ lti: { guardedFamilies: [{ family: 'zz', level: 'launch' }], toolConfiguration: 'channel' } })],
  ];
  it.each(cases)('check %i: %s', async (check, reason, input, detail) => {
    const channels = typeof input === 'function' ? input() : [...await baseline(), channel(input)];
    const err = failure(channels);
    expect({ check: err.check, reason: err.reason }).toEqual({ check, reason });
    if (detail !== undefined) expect(err.detail).toContain(detail);
    expect(err.message).toContain(`load check ${check}`);
  });

  it('AC-LA-E1-02-11: the baseline moodle manifest (manual with self) loads; the same rule refuses a test channel', async () => {
    expect(buildChannelRegistry(await baseline(), { simulations: false }).channel('moodle')?.registration.map((r) => r.authority)).toEqual(['self', 'self']);
    expect(failure([channel(testManifest({ registration: [{ method: 'manual', authority: 'self', profiles: ['zz-test'], defaultProfile: 'zz-test' }] }))]).reason)
      .toBe('manual_self_authority');
  });

  it('every channel is checked, also a simulation-only channel that the options leave out', async () => {
    const sim = testManifest({ availability: 'simulation-only', capabilities: { 'publish.createCourse': true } });
    expect(failure([...await baseline(), channel(sim)]).check).toBe(4);
  });
});

describe('registry contents', () => {
  it('a simulation-only channel loads only with simulations on; order is card.order, then id', async () => {
    const extra = [
      channel(testManifest({ id: 'zz-sim', availability: 'simulation-only', registration: [{ method: 'manual', authority: 'operatorGrant', profiles: ['zz-sim'], defaultProfile: 'zz-sim' }], lti: undefined }), '/x/zz-sim'),
      channel(testManifest({ card: { title: 'ZZ', description: 'A test channel.', mark: 'Z', color: 'gray', category: 'LMS Publishing', order: 0 } }), '/x/zz-test'),
    ];
    const off = buildChannelRegistry([...await loadChannelFolders([PRODUCT_ROOT], 'app'), ...extra], { simulations: false });
    const on = buildChannelRegistry([...await loadChannelFolders([PRODUCT_ROOT], 'app'), ...extra], { simulations: true });
    expect(off.channels().map((m) => m.id)).toEqual(['zz-test', 'moodle', 'canvas', 'blackboard', 'lti-generic']);
    expect(on.channels().map((m) => m.id)).toEqual(['zz-test', 'moodle', 'canvas', 'blackboard', 'lti-generic', 'zz-sim']);
    expect([off.channelOfProfile('zz-sim'), on.channelOfProfile('zz-sim')]).toEqual([null, 'zz-sim']);
    expect(off.ownerOfFamily('zz')).toBe('zz-test');
  });

  it('an unknown channel gets the empty capability set; a registry without the standard profile names "your LMS"', () => {
    const registry = buildChannelRegistry([channel(testManifest())], { simulations: false });
    expect(registry.capabilities('zz-unknown')).toMatchObject({ 'registration.dynamic': false, 'binding.authority': {}, 'deployments.multiple': false });
    expect(registry.legacyCapabilities('zz-unknown')).toEqual({
      dynamicRegistration: false, operatorApproval: false, webServices: false, courseShell: false, addDeployment: false, canvasConfiguration: false,
    });
    expect([registry.textName(null), registry.textName('zz-test')]).toEqual(['your LMS', 'ZZ']);
  });
});

describe('loadChannelFolders (folder discovery)', () => {
  /** A temporary root with channel folders: name → files (file name → text). */
  function root(folders: Record<string, Record<string, string>>): string {
    const dir = mkdtempSync(join(tmpdir(), 'channel-root-'));
    for (const [name, files] of Object.entries(folders)) {
      mkdirSync(join(dir, name));
      for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, name, file), text);
    }
    return dir;
  }
  const manifestFile = (m: Json) => `export default ${JSON.stringify(m)};\n`;

  it('reads every root in order: directories only, no hidden folder, in name order; each side imports its own entry files', async () => {
    const extra = root({
      'zz-test': { 'manifest.ts': manifestFile(testManifest()), 'lti-profiles.ts': 'export default [{ id: "zz-test", sharing: "exclusive" }];\n', 'app.ts': 'export default { kind: "app" };\n' },
      '.hidden': { 'manifest.ts': 'throw new Error("never imported");\n' },
    });
    writeFileSync(join(extra, 'notes.txt'), 'not a channel');
    const app = await loadChannelFolders([PRODUCT_ROOT, extra], 'app');
    expect(app.map((c) => c.folder.split(/[\\/]/).pop())).toEqual(['blackboard', 'canvas', 'lti-generic', 'moodle', 'zz-test']);
    expect(app[4]).toMatchObject({ folder: join(extra, 'zz-test'), manifest: { id: 'zz-test' }, appAdapter: { kind: 'app' } });
    expect(app[4]).not.toHaveProperty('ltiProfiles');
    const lti = await loadChannelFolders([extra], 'lti');
    expect(lti).toEqual([{ folder: join(extra, 'zz-test'), manifest: expect.objectContaining({ id: 'zz-test' }), ltiProfiles: [{ id: 'zz-test', sharing: 'exclusive' }] }]);
    expect(buildChannelRegistry(lti, { simulations: false }).channelOfProfile('zz-test')).toBe('zz-test');
  });

  it('a folder without lti-profiles.ts has no profiles on the LTI side, so load check 5 refuses it', async () => {
    const extra = root({ 'zz-test': { 'manifest.ts': manifestFile(testManifest()) } });
    const lti = await loadChannelFolders([extra], 'lti');
    expect(lti[0]!.ltiProfiles).toEqual([]);
    expect(failure(lti)).toMatchObject({ check: 5, reason: 'profile_not_in_lti_profiles' });
  });

  it('a broken folder or root stops the load (fail closed)', async () => {
    await expect(loadChannelFolders([root({ 'zz-test': { 'manifest.ts': 'export default {;\n' } })], 'app'))
      .rejects.toMatchObject({ name: 'RegistryError', channel: 'zz-test', check: 1, reason: 'entry_import_failed' });
    await expect(loadChannelFolders([root({ 'zz-test': { 'manifest.ts': manifestFile(testManifest()), 'lti-profiles.ts': 'export default { id: "x" };\n' } })], 'lti'))
      .rejects.toMatchObject({ channel: 'zz-test', check: 7, reason: 'lti_profiles_not_list' });
    await expect(loadChannelFolders([join(tmpdir(), 'channel-root-missing-zz')], 'app')).rejects.toMatchObject({ channel: null, check: 1, reason: 'channel_root_unreadable' });
    const noManifest = await loadChannelFolders([root({ 'zz-test': { 'README.md': '# no manifest' } })], 'app');
    expect(failure(noManifest)).toMatchObject({ channel: 'zz-test', check: 1, reason: 'manifest_missing' });
  });
});

describe('lti-generic (LA-E2-03)', () => {
  type Json = Record<string, unknown>;
  const generic = (loaded: LoadedChannel[]) => loaded.find((c) => (c.manifest as Json).id === 'lti-generic')!;

  it('AC-LA-E2-03-08: load check 6 stops the start for an lti-generic variant with manual -> self', async () => {
    for (const side of ['app', 'lti'] as const) {
      const loaded = await loadChannelFolders([PRODUCT_ROOT], side);
      expect(() => buildChannelRegistry(loaded, { simulations: false })).not.toThrow();
      const entry = generic(loaded);
      const manifest = entry.manifest as { registration: Array<{ method: string; authority: string }> };
      const variant = { ...entry, manifest: { ...manifest, registration: manifest.registration.map((r) => (r.method === 'manual' ? { ...r, authority: 'self' } : r)) } };
      const err = failure(loaded.map((c) => (c === entry ? variant : c)));
      expect([side, err.check, err.reason, err.channel]).toEqual([side, 6, 'manual_self_authority', 'lti-generic']);
    }
  });

  it('loads with no app.ts, after the baseline channels, with the D3 capabilities and legacy flags', async () => {
    const app = await loadChannelFolders([PRODUCT_ROOT], 'app');
    expect(generic(app).appAdapter).toBeUndefined();
    const registry = buildChannelRegistry(app, { simulations: false });
    expect(registry.textName('lti-generic')).toBe('your LMS');
    expect(registry.legacyCapabilities('lti-generic')).toEqual({ dynamicRegistration: true, operatorApproval: true, webServices: false, courseShell: false, addDeployment: true, canvasConfiguration: false });
    expect(registry.capabilities('lti-generic')).toMatchObject({
      'registration.dynamic': true, 'binding.authority': { dynamic: 'self', manual: 'operatorGrant' }, 'deployments.multiple': true, 'content.multiple': true,
      'launch.windowHint': true, 'records.reporters': ['lti-ags'], 'records.readBack': true, 'siteApi.token': false, 'publish.createCourse': false,
      'setup.artifacts': [], 'export.packages': [], 'registration.scopes': [
        'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem', 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
        'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly', 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
      ],
    });
    const lti = buildChannelRegistry(await loadChannelFolders([PRODUCT_ROOT], 'lti'), { simulations: false });
    expect([lti.channelOfProfile('lti-generic'), lti.ownerOfFamily('sakai')]).toEqual(['lti-generic', null]);
  });
});
