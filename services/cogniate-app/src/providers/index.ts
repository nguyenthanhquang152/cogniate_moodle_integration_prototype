// The ONE provider registry of the app. Adapter data lives in one file per LMS (moodle.ts, canvas.ts, blackboard.ts).
import { blackboardProvider } from './blackboard.ts';
import { canvasProvider } from './canvas.ts';
import { moodleProvider } from './moodle.ts';
import type { Capabilities, LmsName, LmsType, ProviderAdapter } from './types.ts';

export type * from './types.ts';
export { LMS_TYPES } from './types.ts';
export { GRANT_CODE, PRINTABLE_ID, TOOL_ACCOUNT, parseStrictBody, toolName, toolUrls } from './common.ts';
export type { StrictBodyResult } from './common.ts';

/** The adapters that exist, in LMS order (moodle, canvas, blackboard). */
export function providerAdapters(): ProviderAdapter[] {
  return [moodleProvider, canvasProvider, blackboardProvider].filter((p): p is ProviderAdapter => p !== null);
}

/** The adapter of an LMS type, or null when the LMS type is not offered. */
export function providerOf(lms: string): ProviderAdapter | null {
  return providerAdapters().find((p) => p.lms === lms) ?? null;
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
export function capabilitiesOf(lms: LmsType): Capabilities {
  return providerOf(lms)?.capabilities ?? NO_CAPABILITIES;
}
