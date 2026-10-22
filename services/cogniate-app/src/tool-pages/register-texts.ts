// The texts of the /tool/register error pages (app contract §6), in ONE place: the register pages show them, and the
// connection JSON gives the same title and action line for a stored lastError, so the portal can show them after a
// reload (T6 round 2). They speak to the LMS admin. `{LMS}` is the text name of the connection's channel (LA-ADR-01
// D12); with Moodle every text is byte for byte the text before LA.
import { TOOL_MAY_EXIST_CODE, pendingToolText } from '@cogniate/channel-kernel';
import { withLms } from './page.ts';

export type RegisterErrorCode = 'REF_INVALID' | 'REF_EXPIRED' | 'SITE_MISMATCH' | 'UPDATE_NOT_ALLOWED' | 'ORIGIN_NOT_ALLOWED' | 'REGISTRATION_FAILED' | typeof TOOL_MAY_EXIST_CODE;

/** Status and the one action line of each page (they speak to the LMS admin who sees the frame). */
export const REGISTER_ERRORS: Record<RegisterErrorCode, { status: number; action: string }> = {
  REF_INVALID: { status: 400, action: 'This registration link is not valid or was already used. In Cogniate, open the connection and copy a new registration URL.' },
  REF_EXPIRED: { status: 400, action: 'This registration link expired. In Cogniate, open the connection and make a new registration URL.' },
  SITE_MISMATCH: { status: 400, action: 'This registration link is for another {LMS} site. Use the link on the {LMS} site that the Cogniate connection names.' },
  UPDATE_NOT_ALLOWED: { status: 409, action: 'Go back in {LMS} and choose Register as a new external tool.' },
  ORIGIN_NOT_ALLOWED: { status: 403, action: 'Open the registration again from {LMS} and press Connect on the Cogniate page.' },
  // App contract §6 texts. In both cases the connection stays pending and the ref still works until it expires.
  REGISTRATION_FAILED: { status: 502, action: 'The connection failed. Go back to {LMS} and try again.' },
  // A-T3b-01: the LTI service does not know if the platform saved the tool. No automatic clean-up. The frozen text of
  // this frozen code (BD-A1-30) gets the tool name.
  [TOOL_MAY_EXIST_CODE]: { status: 502, action: pendingToolText('<tool>') },
};

/** The heading of every register error page. */
export const REGISTER_HEADING = 'Cogniate could not connect this {LMS} site';

/** Title and action line of a code, with `{LMS}` and the tool name filled in. */
export function registerErrorText(code: string, toolName: string, lms: string): { title: string; action: string } | null {
  const e = (REGISTER_ERRORS as Record<string, { action: string } | undefined>)[code];
  if (!e) return null;
  // Each value goes once into its own template, and an inserted value is never read again as a placeholder
  // (B-LA-E1-09-01, -02): the frozen tool-may-exist text takes the tool name, every other action takes `{LMS}`.
  return { title: withLms(REGISTER_HEADING, lms), action: code === TOOL_MAY_EXIST_CODE ? pendingToolText(toolName) : withLms(e.action, lms) };
}
