import { loadChannelFolders } from '@cogniate/channel-kernel';
import type { ChannelManifest, ProfileSource } from '@cogniate/channel-kernel';
import { expect, it } from 'vitest';
import type { ConnectionSetup } from './ports.ts';
import { CHANNEL_ROOT } from './registry.ts';

function assertProfiles(setup: ConnectionSetup, manifest: ChannelManifest, profiles: readonly ProfileSource[]) {
  for (const [id, data] of Object.entries(setup.profiles)) {
    const label = `${manifest.id}/${id}`;
    const source = profiles.find((profile) => profile.id === id);
    expect(source, label).toBeDefined();
    expect(data.sharing, label).toBe(source!.sharing);
    expect(data.serviceUrl, label).toBe(source!.serviceUrl);
    expect(data.refusedHostSuffixes, label).toEqual(source!.refusedHostSuffixes);
    expect(setup.sharingOf(id), label).toBe(source!.sharing);
  }
  for (const registration of manifest.registration) {
    for (const id of registration.profiles) expect(setup.profiles[id], `${manifest.id}/${id}`).toBeDefined();
  }
}

it('AC-10: every discovered app profile matches its LTI traits and covers every registration profile', async () => {
  const [app, lti] = await Promise.all([loadChannelFolders([CHANNEL_ROOT], 'app'), loadChannelFolders([CHANNEL_ROOT], 'lti')]);
  expect(app.length).toBeGreaterThan(0);
  for (const channel of app) {
    if (!channel.appAdapter) continue;
    const manifest = channel.manifest as ChannelManifest;
    const setup = channel.appAdapter as ConnectionSetup;
    const profiles = lti.find((entry) => entry.folder === channel.folder)!.ltiProfiles as ProfileSource[];
    assertProfiles(setup, manifest, profiles);
    const [id, data] = Object.entries(setup.profiles)[0]!;
    // Negative controls prove that the invariant detects drift without a test in a channel folder.
    for (const change of [
      { sharing: data.sharing === 'shared' ? 'exclusive' as const : 'shared' as const },
      { serviceUrl: !data.serviceUrl },
      { refusedHostSuffixes: ['changed.invalid'] },
    ]) {
      const changed = { ...setup, profiles: { ...setup.profiles, [id]: { ...data, ...change } } };
      expect(() => assertProfiles(changed, manifest, profiles)).toThrow();
    }
    expect(() => assertProfiles({ ...setup, profiles: {} }, manifest, profiles)).toThrow();
    expect(() => assertProfiles(setup, manifest, [])).toThrow();
  }
});
