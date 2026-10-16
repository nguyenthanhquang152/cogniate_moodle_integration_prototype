/** Login and launch error codes (security §2.1, §2.2) with their HTTP status and the action line of the page. */
export type ProtocolErrorCode =
  | 'UNKNOWN_TOOL_ACCOUNT' | 'UNKNOWN_PLATFORM' | 'PLATFORM_NOT_ACTIVE' | 'UNKNOWN_DEPLOYMENT' | 'INVALID_TARGET_LINK_URI'
  | 'INVALID_REQUEST' | 'INVALID_STATE' | 'STATE_COOKIE_MISSING' | 'INVALID_ID_TOKEN' | 'INVALID_ISSUER_OR_AUDIENCE'
  | 'INVALID_SIGNATURE' | 'TOKEN_EXPIRED' | 'INVALID_NONCE' | 'UNSUPPORTED_MESSAGE_TYPE' | 'MISSING_CLAIM' | 'PLATFORM_ERROR'
  | 'METHOD_NOT_ALLOWED';

const RESTART = 'Start again from Moodle. If it happens again, give the trace id to your Cogniate admin.';

export const PROTOCOL_ERRORS: Record<ProtocolErrorCode, { status: number; action: string }> = {
  UNKNOWN_TOOL_ACCOUNT: { status: 404, action: 'The tool URL in Moodle names an unknown Cogniate tool account. Ask your Moodle admin to check the tool settings.' },
  UNKNOWN_PLATFORM: { status: 400, action: 'This Moodle site is not connected to Cogniate. Ask your Moodle admin to connect it first.' },
  PLATFORM_NOT_ACTIVE: { status: 403, action: 'The connection to this Moodle site is switched off. Ask your Cogniate admin to switch it on.' },
  UNKNOWN_DEPLOYMENT: { status: 400, action: 'This tool deployment is not known to Cogniate. Ask your Moodle admin to connect the tool again.' },
  INVALID_TARGET_LINK_URI: { status: 400, action: 'The activity link does not point to the Cogniate LTI service. Ask your teacher to add the activity again.' },
  INVALID_REQUEST: { status: 400, action: RESTART },
  INVALID_STATE: { status: 401, action: 'This launch was already used or is too old. Start again from Moodle.' },
  STATE_COOKIE_MISSING: { status: 401, action: 'Start again from Moodle.' },
  INVALID_ID_TOKEN: { status: 401, action: RESTART },
  INVALID_ISSUER_OR_AUDIENCE: { status: 401, action: RESTART },
  INVALID_SIGNATURE: { status: 401, action: RESTART },
  TOKEN_EXPIRED: { status: 401, action: 'The launch took too long. Start again from Moodle. If it happens again, check the clock of the Moodle server.' },
  INVALID_NONCE: { status: 401, action: RESTART },
  UNSUPPORTED_MESSAGE_TYPE: { status: 400, action: 'Cogniate does not support this kind of launch. Start again from Moodle.' },
  MISSING_CLAIM: { status: 400, action: RESTART },
  PLATFORM_ERROR: { status: 400, action: 'Moodle stopped the launch. Start again from Moodle, or ask your Moodle admin.' },
  METHOD_NOT_ALLOWED: { status: 405, action: 'Open the activity from Moodle.' },
};

/** Help texts for STATE_COOKIE_MISSING (security §2.2, "Other launch cases"). */
export const COOKIE_HELP = {
  resourceLink: 'Your browser blocked a cookie in an embedded frame. Ask your Moodle admin to set the Cogniate tool to open in a new window.',
  deepLinking: "Your browser blocks cookies in Moodle's content dialog. Use Chrome, Edge or Firefox, or allow cookies for this site.",
  other: 'Start again from Moodle.',
} as const;
