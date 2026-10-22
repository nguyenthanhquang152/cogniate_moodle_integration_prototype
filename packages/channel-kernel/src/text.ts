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
 * Registration help sentence with `{LMS}` that names LMS menu paths: four LTI service codes and the app register page
 * code `UPDATE_NOT_ALLOWED`.
 */
export const REGISTRATION_TEXT_KEYS = ['UNKNOWN_TOOL_ACCOUNT', 'INVALID_REQUEST', 'ISSUER_MISMATCH', 'REGISTRATION_UPDATE_NOT_ALLOWED', 'UPDATE_NOT_ALLOWED'] as const;
export type RegistrationTextKey = (typeof REGISTRATION_TEXT_KEYS)[number];

/** The core default of each key, for a channel without its own sentence: no LMS menu path. */
export const DEFAULT_REGISTRATION_TEXTS: Readonly<Record<RegistrationTextKey, string>> = Object.freeze({
  UNKNOWN_TOOL_ACCOUNT: 'This registration URL is not valid. Copy it again in Cogniate and paste it in {LMS}.',
  INVALID_REQUEST: 'Start the registration again from {LMS}.',
  ISSUER_MISMATCH: 'The platform configuration is not from this {LMS} site. Start the registration again from the site itself.',
  REGISTRATION_UPDATE_NOT_ALLOWED: 'This registration updates a tool that is not this connection. Register the tool again as a new tool in {LMS}.',
  UPDATE_NOT_ALLOWED: 'Go back in {LMS} and register the tool again as a new tool.',
});

/**
 * The help sentence of a key, `{LMS}` not filled: the channel's own sentence, else the core default. When the channel
 * is not known yet, pass the no-context channel (the channel of the standard profile, whose name `textName(null)`
 * gives), so its sentences apply.
 */
export function registrationText(channel: { texts: { registration?: Partial<Record<RegistrationTextKey, string>> } } | null, key: RegistrationTextKey): string {
  return channel?.texts.registration?.[key] ?? DEFAULT_REGISTRATION_TEXTS[key];
}
