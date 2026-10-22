// Setup adapters come from folder discovery, never a closed channel list (BD-A1-17).
import type { ChannelRegistry } from '@cogniate/channel-kernel';
import type { Logger } from '@cogniate/shared';
import type { ConnectionSetup } from './ports.ts';
import type { LtiProviderProfile } from '../clients/lti-client.ts';

export function setupOf(channels: ChannelRegistry, channel: string): ConnectionSetup | null {
  return channels.appAdapter(channel) as ConnectionSetup | null;
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
