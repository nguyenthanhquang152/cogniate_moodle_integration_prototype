// Setup adapters come from folder discovery, never a closed channel list (BD-A1-17).
import type { ChannelRegistry } from '@cogniate/channel-kernel';
import type { Logger } from '@cogniate/shared';
import type { ConnectionSetup } from './ports.ts';
import type { LtiProviderProfile } from '../clients/lti-client.ts';
import { adminValueSetup } from './setup/admin-value.ts';

const kernelAdapters = new WeakMap<ChannelRegistry, Map<string, ConnectionSetup>>();

/**
 * The setup adapter of a channel: its app.ts, else the kernel admin-value adapter (LA-ADR-01 D5; A1 BD-A1-79: every
 * channel without app.ts). Null for an id that is not in the registry. The kernel adapter is made once per registry.
 */
export function setupOf(channels: ChannelRegistry, channel: string): ConnectionSetup | null {
  const own = channels.appAdapter(channel);
  if (own !== null) return own as ConnectionSetup;
  const manifest = channels.channel(channel);
  if (manifest === null) return null;
  let made = kernelAdapters.get(channels);
  if (!made) kernelAdapters.set(channels, made = new Map());
  let adapter = made.get(channel);
  if (!adapter) made.set(channel, adapter = adminValueSetup(manifest, channels.capabilities(channel)));
  return adapter;
}

/** True when the kernel admin-value adapter serves the channel (no app.ts): then the kernel create rules apply. */
export function servedByKernel(channels: ChannelRegistry, channel: string): boolean {
  return channels.channel(channel) !== null && channels.appAdapter(channel) === null;
}

const unknownProfilesLogged = new Set<string>();
/** Keep only manifest-owned profiles offered by that channel's app adapter (app API delta §2). */
export function ownedProfiles(rows: readonly LtiProviderProfile[], logger: Logger, traceId: string, channels: ChannelRegistry): LtiProviderProfile[] {
  return rows.filter((row) => {
    const channel = channels.channelOfProfile(row.id);
    if (channel !== null && setupOf(channels, channel)?.profiles[row.id]) return true;
    if (!unknownProfilesLogged.has(row.id)) {
      unknownProfilesLogged.add(row.id);
      logger.warn('channel_profile_unknown', { trace_id: traceId, profile: row.id });
    }
    return false;
  });
}
