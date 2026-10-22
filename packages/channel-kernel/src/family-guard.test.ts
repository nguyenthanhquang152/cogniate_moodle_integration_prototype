import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildChannelRegistry, familyGuardVerdict, loadChannelFolders } from './index.ts';
import type { ChannelManifest } from './manifest.ts';

const baseline = await loadChannelFolders([fileURLToPath(new URL('../../channels/', import.meta.url))], 'app');
const canvas = buildChannelRegistry(baseline, { simulations: true }).channel('canvas')!;
const named: ChannelManifest = {
  ...canvas, id: 'zz-named',
  registration: [{ method: 'manual', authority: 'operatorGrant', profiles: ['zz-named'], defaultProfile: 'zz-named' }],
  lti: { guardedFamilies: [{ family: 'zz-family', level: 'registration' }], toolConfiguration: 'none' },
};
const registry = buildChannelRegistry([...baseline, { folder: '/test/zz-named', manifest: named }], { simulations: true });

describe.each(['registration', 'launch'] as const)('D6 family guard during %s', (phase) => {
  it.each([undefined, null, '', 'unclaimed'])('passes absent or unclaimed family %s', (family) => {
    expect(familyGuardVerdict(registry, family, 'moodle', phase)).toEqual({ kind: 'pass' });
  });
  it.each([['canvas', 'canvas'], ['zz-family', 'zz-named']] as const)('passes family %s on its own channel', (family, channel) => {
    expect(familyGuardVerdict(registry, family, channel, phase)).toEqual({ kind: 'pass' });
  });
  it.each(['moodle', 'zz-named', null])('refuses a foreign launch-level guard on channel %s', (channel) => {
    expect(familyGuardVerdict(registry, 'CaNvAs', channel, phase)).toEqual({ kind: 'refuse', family: 'canvas', guardChannel: 'canvas' });
  });
  it('refuses a foreign registration-level guard on a manual self legacy channel', () => {
    expect(familyGuardVerdict(registry, 'ZZ-FAMILY', 'moodle', phase)).toEqual({ kind: 'refuse', family: 'zz-family', guardChannel: 'zz-named' });
  });
  it.each(['canvas', 'zz-other', null])('refuses at registration but only logs at launch on channel %s', (channel) => {
    expect(familyGuardVerdict(registry, 'ZZ-FAMILY', channel, phase)).toEqual({ kind: phase === 'registration' ? 'refuse' : 'log', family: 'zz-family', guardChannel: 'zz-named' });
  });
});
