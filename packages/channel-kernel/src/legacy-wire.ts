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

/** Frozen provider-list values of the eight baseline profiles. A change needs an ADR revision (BD-A1-06). */
export const BASELINE_PROFILE_WIRE_LMS: Readonly<Record<string, string | null>> = Object.freeze({
  standard: null,
  'canvas-cloud-production': 'canvas',
  'canvas-cloud-beta': 'canvas',
  'canvas-cloud-test': 'canvas',
  'canvas-self-hosted': 'canvas',
  'canvas-sim-cloud': 'canvas',
  blackboard: 'blackboard',
  'blackboard-sim': 'blackboard',
});

/** Load check 7 (BD-A2-21): only these profiles may keep every claim. New entries need an ADR and security review. */
export const PRIVACY_FLOOR_NONE_PROFILES: readonly string[] = Object.freeze(['standard']);

/** The setup artifact behind the legacy flag `canvasConfiguration` (`setup.artifacts`, D3). */
export const DEVELOPER_KEY_JSON_ARTIFACT = 'developer-key-json';

/** Frozen extension request and response fields (LA-ADR-01 D5, D8). */
export const PUBLICATION_OPTION = 'createMoodleCourse';
export const PUBLICATION_EXTENSION_FIELDS: readonly string[] = Object.freeze(['moodleCourse', 'shellStatus', 'shellError']);
export const EMPTY_PUBLICATION_EXTENSION_FIELDS: Readonly<Record<string, unknown>> = Object.freeze({ moodleCourse: null, shellStatus: null, shellError: null });

/** Error text and legacy capability names stay byte for byte for the baseline routes. */
export const EXTENSION_GUARDS = {
  'canvas-configuration': { capability: 'canvasConfiguration', description: 'This connection has no Canvas configuration.' },
  'web-services': { capability: 'webServices', description: 'Only a Moodle connection has web services.' },
  createMoodleCourse: { capability: 'courseShell', description: 'Only a Moodle connection can create a Moodle course.' },
} as const;

/** Frozen exporter wire data and its tenant lookup (ADR-007, LA-ADR-01 D8). */
export const PACKAGE_EXPORT_WIRE: Readonly<Record<string, { extension: string; mediaType: string; filename: (version: number) => string; missing: string; latestMissing: string }>> = Object.freeze({
  mbz: { extension: 'mbz', mediaType: 'application/vnd.moodle.backup', filename: (version: number) => `cogniate-course-v${version}.mbz`, missing: 'No ready .mbz for this version. Build it first.', latestMissing: 'No .mbz build for this version yet.' },
});
export const EXPORT_BUILD_SCOPE_SQL = 'SELECT id FROM mbz_build WHERE id = ? AND library_id = ?';
export const DOWNLOAD_KIND_DESCRIPTION = 'Use kind=original (the uploaded zip) or kind=mbz (the Moodle backup).';

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

/** Frozen database behaviour classes (LA-ADR-04 D4). Channel identity is stored separately. */
export function connectionBehaviourClass(channel: string, authority: 'self' | 'operatorGrant', sharing: 'exclusive' | 'shared'): 'moodle' | 'canvas' | 'blackboard' {
  if (channel === 'moodle' || channel === 'canvas' || channel === 'blackboard') return channel;
  return authority === 'self' ? 'moodle' : sharing === 'shared' ? 'blackboard' : 'canvas';
}

/** Frozen grade conflict text (BD-A1-27); per-channel copy moves in LA-IC-15. */
export const LEGACY_GRADE_CONFLICT = '(Moodle has a grade with a newer time)';

/** Frozen learner label fallback (BD-A1-27); per-channel copy moves in LA-IC-15. */
export const LEGACY_LEARNER_HOST = 'Moodle';

/** Frozen manual binding errors (security §2.6, app contract §4). */
export const LEGACY_SELF_BINDING_TEXT = {
  collision: 'This Moodle tool is already registered with Cogniate. In Moodle, make a new tool for this library and use its values.',
  reserved: 'This address belongs to a hosted LMS. Connect it as Canvas or Blackboard.',
} as const;

/** Frozen clean-up text of MOODLE_TOOL_MAY_EXIST (LA-ADR-01 D12, BD-A1-30). Keep its UI words byte for byte. */
export function pendingToolText(toolName: string): string {
  return `Moodle may have saved a Pending tool. In Manage tools, delete the Pending tool '${toolName}', then connect again.`;
}

/** Array capability member required by each frozen setup route. */
export const EXTENSION_CAPABILITY_MEMBERS: Readonly<Record<string, string>> = Object.freeze({ 'canvas-configuration': 'developer-key-json' });
