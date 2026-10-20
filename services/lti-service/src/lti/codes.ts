/**
 * Login and launch error codes (security §2.1, §2.2) with their HTTP status and the action line of the page. ONE text
 * table with the LMS name as a parameter (security §12): `{LMS}` is `Moodle`, `Canvas` or `Blackboard`. With
 * `Moodle` every text is byte for byte the text before M1.
 */
import type { LmsName } from '../profiles/index.ts';

export type ProtocolErrorCode =
  | 'UNKNOWN_TOOL_ACCOUNT' | 'UNKNOWN_PLATFORM' | 'PLATFORM_NOT_ACTIVE' | 'UNKNOWN_DEPLOYMENT' | 'INVALID_TARGET_LINK_URI'
  | 'INVALID_REQUEST' | 'INVALID_STATE' | 'STATE_COOKIE_MISSING' | 'INVALID_ID_TOKEN' | 'INVALID_ISSUER_OR_AUDIENCE'
  | 'INVALID_SIGNATURE' | 'TOKEN_EXPIRED' | 'INVALID_NONCE' | 'UNSUPPORTED_MESSAGE_TYPE' | 'MISSING_CLAIM' | 'PLATFORM_ERROR'
  | 'METHOD_NOT_ALLOWED'
  // Dynamic registration pages (contract §2.4, T3b)
  | 'INVALID_OPENID_CONFIGURATION' | 'ISSUER_MISMATCH' | 'FETCH_FAILED'
  // M1 (contract §9.2)
  | 'DEPLOYMENT_NOT_ACTIVE' | 'PROVIDER_PROFILE_MISMATCH' | 'SERVICE_ORIGIN_MISMATCH' | 'ISSUER_RESERVED';

const RESTART = 'Start again from {LMS}. If it happens again, give the trace id to your Cogniate admin.';

/** Status and action template of every code. Use protocolAction() for the text. */
export const PROTOCOL_ERRORS: Record<ProtocolErrorCode, { status: number; action: string }> = {
  UNKNOWN_TOOL_ACCOUNT: { status: 404, action: 'The tool URL in {LMS} names an unknown Cogniate tool account. Ask your {LMS} admin to check the tool settings.' },
  UNKNOWN_PLATFORM: { status: 400, action: 'This {LMS} site is not connected to Cogniate. Ask your {LMS} admin to connect it first.' },
  PLATFORM_NOT_ACTIVE: { status: 403, action: 'The connection to this {LMS} site is switched off. Ask your Cogniate admin to switch it on.' },
  UNKNOWN_DEPLOYMENT: { status: 400, action: 'This tool deployment is not known to Cogniate. Ask your {LMS} admin to connect the tool again.' },
  INVALID_TARGET_LINK_URI: { status: 400, action: 'The activity link does not point to the Cogniate LTI service. Ask your teacher to add the activity again.' },
  INVALID_REQUEST: { status: 400, action: RESTART },
  INVALID_STATE: { status: 401, action: 'This launch was already used or is too old. Start again from {LMS}.' },
  STATE_COOKIE_MISSING: { status: 401, action: 'Start again from {LMS}.' },
  INVALID_ID_TOKEN: { status: 401, action: RESTART },
  INVALID_ISSUER_OR_AUDIENCE: { status: 401, action: RESTART },
  INVALID_SIGNATURE: { status: 401, action: RESTART },
  TOKEN_EXPIRED: { status: 401, action: 'The launch took too long. Start again from {LMS}. If it happens again, check the clock of the {LMS} server.' },
  INVALID_NONCE: { status: 401, action: RESTART },
  UNSUPPORTED_MESSAGE_TYPE: { status: 400, action: 'Cogniate does not support this kind of launch. Start again from {LMS}.' },
  MISSING_CLAIM: { status: 400, action: RESTART },
  PLATFORM_ERROR: { status: 400, action: '{LMS} stopped the launch. Start again from {LMS}, or ask your {LMS} admin.' },
  METHOD_NOT_ALLOWED: { status: 405, action: 'Open the activity from {LMS}.' },
  INVALID_OPENID_CONFIGURATION: { status: 400, action: 'Moodle sent a registration that Cogniate cannot use. Start the registration again from Moodle. If it happens again, give the trace id to your Cogniate admin.' },
  ISSUER_MISMATCH: { status: 400, action: 'The platform configuration is not from the site that started the registration. Start the registration again from Moodle (Site administration > Manage tools).' },
  FETCH_FAILED: { status: 400, action: 'Cogniate could not read the platform configuration. Check that the Moodle site can be reached, then start the registration again.' },
  DEPLOYMENT_NOT_ACTIVE: { status: 403, action: 'The connection to this {LMS} site is switched off. Ask your Cogniate admin to check the connection in the Cogniate portal.' },
  PROVIDER_PROFILE_MISMATCH: { status: 400, action: 'This {LMS} site is connected to Cogniate in the wrong way. Ask your Cogniate admin to connect it as {LMS} in the Cogniate portal.' },
  SERVICE_ORIGIN_MISMATCH: { status: 400, action: 'The {LMS} address in this launch is not the address saved in Cogniate. Ask your Cogniate admin to check the site URL.' },
  ISSUER_RESERVED: { status: 400, action: 'This address belongs to a hosted LMS. Connect it as Canvas or Blackboard in the Cogniate portal.' },
};

/** Fill `{LMS}` in a text template. */
export const withLms = (text: string, lms: LmsName): string => text.replaceAll('{LMS}', lms);

/** The action line of a code for an LMS (default Moodle: the texts before M1). */
export function protocolAction(code: ProtocolErrorCode, lms: LmsName = 'Moodle'): string {
  return withLms(PROTOCOL_ERRORS[code].action, lms);
}

/** Help texts for STATE_COOKIE_MISSING (security §2.2, "Other launch cases"), as templates. */
const COOKIE_HELP_TEMPLATES = {
  resourceLink: 'Your browser blocked a cookie in an embedded frame. Ask your {LMS} admin to set the Cogniate tool to open in a new window.',
  deepLinking: "Your browser blocks cookies in {LMS}'s content dialog. Use Chrome, Edge or Firefox, or allow cookies for this site.",
  other: 'Start again from {LMS}.',
} as const;

export type CookieHelpKind = keyof typeof COOKIE_HELP_TEMPLATES;

export function cookieHelp(kind: CookieHelpKind, lms: LmsName = 'Moodle'): string {
  return withLms(COOKIE_HELP_TEMPLATES[kind], lms);
}

/** The Moodle texts (unchanged names for callers and tests from before M1). */
export const COOKIE_HELP = {
  resourceLink: cookieHelp('resourceLink'),
  deepLinking: cookieHelp('deepLinking'),
  other: cookieHelp('other'),
} as const;
