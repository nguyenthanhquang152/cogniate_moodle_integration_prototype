import type { ChannelRegistry, LoadedChannel } from '@cogniate/channel-kernel';
import { BASELINE_PROFILE_WIRE_LMS, RegistryError, buildChannelRegistry } from '@cogniate/channel-kernel';
import { parseProfileSource } from './schema.ts';
import type { ProviderProfile } from './types.ts';

export interface ProfileRegistry {
  channels(simulation: boolean): ChannelRegistry;
  listProfiles(simulation: boolean): readonly ProviderProfile[];
}

/** Pure load checks for the LTI side. Check every source, including disabled simulation profiles. */
export function buildProfileRegistry(loaded: readonly LoadedChannel[]): ProfileRegistry {
  const channels = loaded.map((entry) => ({ ...entry, ltiProfiles: entry.ltiProfiles ?? [] }));
  const all = buildChannelRegistry(channels, { simulations: true });
  const live = buildChannelRegistry(channels, { simulations: false });
  const profiles = channels.flatMap((entry) => entry.ltiProfiles.map((value) => {
    // The channel kernel checked the manifest, folder and profile ownership first.
    const channel = (entry.manifest as { id: string }).id;
    const source = parseProfileSource(value, channel);
    Object.freeze(source.flags);
    Object.freeze(source.sources);
    if (source.refusedHostSuffixes) Object.freeze(source.refusedHostSuffixes);
    return Object.freeze({ ...source, channel, lms: source.wireLms === undefined ? channel : source.wireLms });
  })).sort((a, b) => Number(a.simulation) - Number(b.simulation) || a.listOrder - b.listOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const baselineOrder = Math.max(-1, ...profiles.filter((profile) => Object.hasOwn(BASELINE_PROFILE_WIRE_LMS, profile.id)).map((profile) => profile.listOrder));
  for (const profile of profiles) {
    if (!Object.hasOwn(BASELINE_PROFILE_WIRE_LMS, profile.id) && profile.listOrder <= baselineOrder) {
      throw new RegistryError(profile.channel, 7, { reason: 'profile_list_order_invalid', detail: `profile "${profile.id}": listOrder must be greater than baseline maximum ${baselineOrder}` });
    }
  }
  const realProfiles = Object.freeze(profiles.filter((profile) => !profile.simulation && live.channel(profile.channel) !== null));
  const allProfiles = Object.freeze(profiles);
  return Object.freeze({
    channels: (simulation: boolean) => simulation ? all : live,
    listProfiles: (simulation: boolean) => simulation ? allProfiles : realProfiles,
  });
}
