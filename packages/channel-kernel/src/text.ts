// Text fill (LA-ADR-01 D12): every text that names an LMS uses `{LMS}` with the manifest text name. Manifest texts may
// use only these placeholders (registry load check 1).

export const TEXT_PLACEHOLDERS = ['LMS', 'tool', 'site'] as const;
export type TextPlaceholder = (typeof TEXT_PLACEHOLDERS)[number];

/** Replace each `{LMS}`, `{tool}` and `{site}` that has a value. A placeholder without a value stays as it is. */
export function fillText(text: string, values: Partial<Record<TextPlaceholder, string>>): string {
  return text.replace(/\{(LMS|tool|site)\}/g, (whole, name: TextPlaceholder) => values[name] ?? whole);
}

/**
 * BD-A1-59 (LA-ADR-01 D12): the keys of the optional manifest field `texts.registration`. Each value is a full Dynamic
 * Registration help sentence with `{LMS}` that names LMS menu paths: five LTI service codes (INVALID_OPENID_CONFIGURATION
 * by BD-A1-68), the app register page code `UPDATE_NOT_ALLOWED`, the pending-tool recovery sentence `TOOL_MAY_EXIST`
 * (BD-A1-87; `{LMS}` and `{tool}`, the tool name that was sent to the platform), and the `409 PLATFORM_IN_USE`
 * description of a grant redemption collision (BD-A1-101).
 */
export const REGISTRATION_TEXT_KEYS = [
  'UNKNOWN_TOOL_ACCOUNT', 'INVALID_REQUEST', 'ISSUER_MISMATCH', 'INVALID_OPENID_CONFIGURATION', 'REGISTRATION_UPDATE_NOT_ALLOWED', 'UPDATE_NOT_ALLOWED',
  'TOOL_MAY_EXIST', 'PLATFORM_IN_USE',
] as const;
export type RegistrationTextKey = (typeof REGISTRATION_TEXT_KEYS)[number];

/**
 * The core default of each key, for a channel without its own sentence: no LMS menu path. PLATFORM_IN_USE names no
 * LMS at all (BD-A1-101), so it reads well for every text name.
 */
export const DEFAULT_REGISTRATION_TEXTS: Readonly<Record<RegistrationTextKey, string>> = Object.freeze({
  UNKNOWN_TOOL_ACCOUNT: 'This registration URL is not valid. Copy it again in Cogniate and paste it in {LMS}.',
  INVALID_REQUEST: 'Start the registration again from {LMS}.',
  ISSUER_MISMATCH: 'The platform configuration is not from this {LMS} site. Start the registration again from the site itself.',
  INVALID_OPENID_CONFIGURATION: '{LMS} sent a registration that Cogniate cannot use. Start the registration again from {LMS}. If it happens again, give the trace id to your Cogniate contact.',
  REGISTRATION_UPDATE_NOT_ALLOWED: 'This registration updates a tool that is not this connection. Register the tool again as a new tool in {LMS}.',
  UPDATE_NOT_ALLOWED: 'Go back in {LMS} and register the tool again as a new tool.',
  TOOL_MAY_EXIST: "{LMS} may have saved the Cogniate tool already. If {LMS} shows the tool '{tool}', delete it there, then connect again.",
  PLATFORM_IN_USE: 'This LMS tool registration is already connected to Cogniate. Make a new tool registration for this library, or ask your Cogniate operator.',
});

/**
 * The help sentence of a key, `{LMS}` not filled: the channel's own sentence, else the core default. When the channel
 * is not known yet, pass the no-context channel (the channel of the standard profile, whose name `textName(null)`
 * gives), so its sentences apply.
 */
export function registrationText(channel: { texts: { registration?: Partial<Record<RegistrationTextKey, string>> } } | null, key: RegistrationTextKey): string {
  return channel?.texts.registration?.[key] ?? DEFAULT_REGISTRATION_TEXTS[key];
}
