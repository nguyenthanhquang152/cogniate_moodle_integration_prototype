/**
 * Login and launch error codes (security §2.1, §2.2) with their HTTP status and the action line of the page. ONE text
 * table with the LMS name as a parameter (security §12): `{LMS}` is the manifest text name of the channel (D12). With
 * the standard channel (`Moodle`) every text is byte for byte the text before M1.
 */
import type { LmsName, ProfileOptions } from '../profiles/index.ts';
import { lmsNameOf, reservedIssuerLmsNames } from '../profiles/index.ts';

export type ProtocolErrorCode =
  | 'UNKNOWN_TOOL_ACCOUNT' | 'UNKNOWN_PLATFORM' | 'PLATFORM_NOT_ACTIVE' | 'UNKNOWN_DEPLOYMENT' | 'INVALID_TARGET_LINK_URI'
  | 'INVALID_REQUEST' | 'INVALID_STATE' | 'STATE_COOKIE_MISSING' | 'INVALID_ID_TOKEN' | 'INVALID_ISSUER_OR_AUDIENCE'
  | 'INVALID_SIGNATURE' | 'TOKEN_EXPIRED' | 'INVALID_NONCE' | 'UNSUPPORTED_MESSAGE_TYPE' | 'MISSING_CLAIM' | 'PLATFORM_ERROR'
  | 'METHOD_NOT_ALLOWED'
  // Dynamic registration pages (contract §2.4, T3b; E2: a configuration host that no profile allows, LA-ADR-02 D5 item 2)
  | 'INVALID_OPENID_CONFIGURATION' | 'ISSUER_MISMATCH' | 'FETCH_FAILED' | 'PLATFORM_URL_NOT_IN_PROFILE'
  // M1 (contract §9.2)
  | 'DEPLOYMENT_NOT_ACTIVE' | 'PROVIDER_PROFILE_MISMATCH' | 'SERVICE_ORIGIN_MISMATCH' | 'ISSUER_RESERVED'
  // LA (contract delta §1.3)
  | 'RATE_LIMITED' | 'TOOL_ACCOUNT_SUSPENDED' | 'REGISTRATION_SESSION_LIMIT';

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
  INVALID_OPENID_CONFIGURATION: { status: 400, action: '{LMS} sent a registration that Cogniate cannot use. Start the registration again from {LMS}. If it happens again, give the trace id to your Cogniate admin.' },
  // BD-A1-68: no menu path here; the registration page shows the manifest sentence (texts.registration.ISSUER_MISMATCH).
  ISSUER_MISMATCH: { status: 400, action: 'The platform configuration is not from the site that started the registration. Start the registration again from {LMS}.' },
  FETCH_FAILED: { status: 400, action: 'Cogniate could not read the platform configuration. Check that the {LMS} site can be reached, then start the registration again.' },
  PLATFORM_URL_NOT_IN_PROFILE: { status: 400, action: 'The platform configuration uses an address that Cogniate does not accept for {LMS}. Check the {LMS} site address, then start the registration again. If it happens again, give the trace id to your Cogniate contact.' },
  DEPLOYMENT_NOT_ACTIVE: { status: 403, action: 'The connection to this {LMS} site is switched off. Ask your Cogniate admin to check the connection in the Cogniate portal.' },
  PROVIDER_PROFILE_MISMATCH: { status: 400, action: 'This {LMS} site is connected to Cogniate in the wrong way. Ask your Cogniate admin to connect it as {LMS} in the Cogniate portal.' },
  SERVICE_ORIGIN_MISMATCH: { status: 400, action: 'The {LMS} address in this launch is not the address saved in Cogniate. Ask your Cogniate admin to check the site URL.' },
  ISSUER_RESERVED: { status: 400, action: 'This address belongs to a hosted LMS. Connect it as {LMS} in the Cogniate portal.' },
  RATE_LIMITED: { status: 429, action: 'Too many requests. Wait one minute, then open the activity again from {LMS}.' },
  TOOL_ACCOUNT_SUSPENDED: { status: 403, action: 'This Cogniate tool is switched off. Ask your Cogniate admin.' },
  REGISTRATION_SESSION_LIMIT: { status: 409, action: 'Too many registrations are open. Wait one hour, or finish the open registration in {LMS}.' },
};

/** Fill `{LMS}` in a text template. A function replacer keeps `$` patterns in a name literal (for example `$&`). */
export const withLms = (text: string, lms: LmsName): string => text.replaceAll('{LMS}', () => lms);

/**
 * The name that fills `{LMS}` in the texts of a code. For ISSUER_RESERVED it is the owners of the reserved issuers
 * (BD-A1-31), and `lms` is ignored. Without `lms`, it is the standard channel of `profiles`.
 */
export function lmsNameFor(code: ProtocolErrorCode, lms: LmsName | undefined, profiles: ProfileOptions): LmsName {
  if (code === 'ISSUER_RESERVED') return reservedIssuerLmsNames(profiles);
  return lms ?? lmsNameOf(null, profiles);
}

/**
 * The action line of a code for an LMS (lmsNameFor). Default: the product standard channel (Moodle: the texts before
 * M1). A test with its own profile registry must give `lms` or `profiles`.
 */
export function protocolAction(code: ProtocolErrorCode, lms?: LmsName, profiles: ProfileOptions = { simulation: true }): string {
  return withLms(PROTOCOL_ERRORS[code].action, lmsNameFor(code, lms, profiles));
}

/** Help texts for STATE_COOKIE_MISSING (security §2.2, "Other launch cases"), as templates. */
const COOKIE_HELP_TEMPLATES = {
  resourceLink: 'Your browser blocked a cookie in an embedded frame. Ask your {LMS} admin to set the Cogniate tool to open in a new window.',
  deepLinking: "Your browser blocks cookies in {LMS}'s content dialog. Use Chrome, Edge or Firefox, or allow cookies for this site.",
  other: 'Start again from {LMS}.',
} as const;

export type CookieHelpKind = keyof typeof COOKIE_HELP_TEMPLATES;

/** Default `lms`: the product standard channel. A test with its own profile registry must give `lms`. */
export function cookieHelp(kind: CookieHelpKind, lms: LmsName = lmsNameOf(null)): string {
  return withLms(COOKIE_HELP_TEMPLATES[kind], lms);
}

/** The Moodle texts (unchanged names for callers and tests from before M1). */
export const COOKIE_HELP = {
  resourceLink: cookieHelp('resourceLink'),
  deepLinking: cookieHelp('deepLinking'),
  other: cookieHelp('other'),
} as const;
