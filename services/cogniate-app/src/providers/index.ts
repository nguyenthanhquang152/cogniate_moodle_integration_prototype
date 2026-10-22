// Transitional channel-to-adapter lookup (BD-A1-17). LA-E1-07 moves these pure adapters into channel folders.
import type { ChannelRegistry } from '@cogniate/channel-kernel';
import type { Logger } from '@cogniate/shared';
import { blackboardProvider } from './blackboard.ts';
import { canvasProvider } from './canvas.ts';
import { moodleProvider } from './moodle.ts';
import type { Capabilities, LmsName, LmsType, LtiProviderProfile, ProviderAdapter } from './types.ts';

export type * from './types.ts';
export { LMS_TYPES } from './types.ts';
export { GRANT_CODE, PRINTABLE_ID, TOOL_ACCOUNT, parseStrictBody, toolName, toolUrls } from './common.ts';
export type { StrictBodyResult } from './common.ts';

/** The adapters that exist, in LMS order (moodle, canvas, blackboard). */
export function providerAdapters(): ProviderAdapter[] {
  return [moodleProvider, canvasProvider, blackboardProvider].filter((p): p is ProviderAdapter => p !== null);
}

/** The adapter of a channel id, or null when no adapter is offered. */
export function providerOf(channel: string): ProviderAdapter | null {
  return providerAdapters().find((p) => p.lms === channel) ?? null;
}

/** Profile ids that `channel_profile_unknown` named in this process (app API delta §8: at most once per profile id). */
const unknownProfilesLogged = new Set<string>();

/**
 * The rows of `GET /api/providers` that the channel registry owns, in the answer order (app API delta §2).
 * Profile ownership comes from the manifest, including the standard profile. The app ignores other rows and logs
 * `channel_profile_unknown {profile}` at most once per process and profile id.
 */
export function ownedProfiles(rows: readonly LtiProviderProfile[], logger: Logger, traceId: string, channels: ChannelRegistry): LtiProviderProfile[] {
  return rows.filter((p) => {
    if (channels.channelOfProfile(p.id) !== null) return true;
    if (!unknownProfilesLogged.has(p.id)) {
      unknownProfilesLogged.add(p.id);
      logger.warn('channel_profile_unknown', { trace_id: traceId, profile: p.id });
    }
    return false;
  });
}

/** The LMS type of an LTI profile id (app contract §6.1 LMS check): `canvas-*` → canvas, `blackboard*` → blackboard, else moodle. */
export function lmsOfProfile(profileId: string): LmsType {
  if (profileId.startsWith('canvas-')) return 'canvas';
  if (profileId.startsWith('blackboard')) return 'blackboard';
  return 'moodle';
}

const NAMES: Readonly<Record<LmsType, LmsName>> = { moodle: 'Moodle', canvas: 'Canvas', blackboard: 'Blackboard' };

export function lmsNameOf(lms: LmsType): LmsName {
  return NAMES[lms];
}

/** The LMS type of a signed product family (check 14 second line), or null for any other or a missing value. */
export function lmsOfFamily(family: string | null | undefined): LmsType | null {
  const f = (family ?? '').toLowerCase();
  return f === 'canvas' ? 'canvas' : f === 'blackboardlearn' ? 'blackboard' : null;
}

export const NO_CAPABILITIES: Capabilities = {
  dynamicRegistration: false, operatorApproval: false, webServices: false, courseShell: false, addDeployment: false, canvasConfiguration: false,
};

/** ADR-011 §11 capabilities of an LMS type. */
export function capabilitiesOf(channel: string): Capabilities {
  return providerOf(channel)?.capabilities ?? NO_CAPABILITIES;
}
