// The texts of the /tool/register error pages (app contract §6), in ONE place: the register pages show them, and the
// connection JSON gives the same title and action line for a stored lastError, so the portal can show them after a
// reload (T6 round 2). They speak to the Moodle admin.
import { pendingToolText } from '@cogniate/shared';

export type RegisterErrorCode = 'REF_INVALID' | 'REF_EXPIRED' | 'SITE_MISMATCH' | 'UPDATE_NOT_ALLOWED' | 'ORIGIN_NOT_ALLOWED' | 'REGISTRATION_FAILED' | 'MOODLE_TOOL_MAY_EXIST';

/** Status and the one action line of each page (they speak to the Moodle admin who sees the frame). */
export const REGISTER_ERRORS: Record<RegisterErrorCode, { status: number; action: string }> = {
  REF_INVALID: { status: 400, action: 'This registration link is not valid or was already used. In Cogniate, open the connection and copy a new registration URL.' },
  REF_EXPIRED: { status: 400, action: 'This registration link expired. In Cogniate, open the connection and make a new registration URL.' },
  SITE_MISMATCH: { status: 400, action: 'This registration link is for another Moodle site. Use the link on the Moodle site that the Cogniate connection names.' },
  UPDATE_NOT_ALLOWED: { status: 409, action: 'Go back in Moodle and choose Register as a new external tool.' },
  ORIGIN_NOT_ALLOWED: { status: 403, action: 'Open the registration again from Moodle and press Connect on the Cogniate page.' },
  // App contract §6 texts. In both cases the connection stays pending and the ref still works until it expires.
  REGISTRATION_FAILED: { status: 502, action: 'The connection failed. Go back to Moodle and try again.' },
  // A-T3b-01: the LTI service does not know if Moodle saved the tool. No automatic clean-up. The shared text gets the tool name.
  MOODLE_TOOL_MAY_EXIST: { status: 502, action: pendingToolText('<tool>') },
};

/** The heading of every register error page. */
export const REGISTER_HEADING = 'Cogniate could not connect this Moodle site';

/** Title and action line of a code, with the tool name filled in (`<tool>` in MOODLE_TOOL_MAY_EXIST). */
export function registerErrorText(code: string, toolName: string): { title: string; action: string } | null {
  const e = (REGISTER_ERRORS as Record<string, { action: string } | undefined>)[code];
  return e ? { title: REGISTER_HEADING, action: e.action.replace('<tool>', toolName) } : null;
}
