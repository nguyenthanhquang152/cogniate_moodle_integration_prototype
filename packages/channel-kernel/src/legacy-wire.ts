// Frozen wire names and values (LA-ADR-04 D2). This file is the ONE core file that may hold LMS words in code tokens
// (LA-ADR-01 D10; README §4 "Allowed exceptions"). Each entry is frozen: a change needs an ADR revision. Later tasks add
// the other frozen names of D2 here when they move them out of core code.
import type { CapabilitySet } from './capabilities.ts';

/**
 * Load check 6 (A2 LA-ADR-07 D2 rule A3): a `manual` method may use authority `self` only on these channels (the typed
 * six-value path of M1). One entry; a new entry needs an ADR revision and a security review.
 */
export const MANUAL_SELF_LEGACY_CHANNELS: readonly string[] = ['moodle'];

/**
 * Load check 8 (LA-ADR-01 D6): a `launch`-level guarded family is allowed only on these channels. New channels guard at
 * the `registration` level; a move to `launch` needs an ADR revision with a move plan for the live connections.
 */
export const LAUNCH_GUARD_CHANNELS: readonly string[] = ['canvas', 'blackboard'];

/** The setup artifact behind the legacy flag `canvasConfiguration` (`setup.artifacts`, D3). */
export const DEVELOPER_KEY_JSON_ARTIFACT = 'developer-key-json';

/** The six M1 capability flags (ADR-011 §11), in their wire order. The connection DTO and the provider list keep them. */
export interface LegacyCapabilities {
  dynamicRegistration: boolean;
  operatorApproval: boolean;
  webServices: boolean;
  courseShell: boolean;
  addDeployment: boolean;
  canvasConfiguration: boolean;
}

/** The legacy projection (LA-ADR-01 D3): the six M1 flags from a capability set, byte for byte in M1 key order. */
export function legacyProjection(set: CapabilitySet): LegacyCapabilities {
  return {
    dynamicRegistration: set['registration.dynamic'],
    operatorApproval: Object.values(set['binding.authority']).includes('operatorGrant'),
    webServices: set['siteApi.token'],
    courseShell: set['publish.createCourse'],
    addDeployment: set['deployments.multiple'],
    canvasConfiguration: set['setup.artifacts'].includes(DEVELOPER_KEY_JSON_ARTIFACT),
  };
}
