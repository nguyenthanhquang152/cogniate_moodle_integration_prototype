// Text fill (LA-ADR-01 D12): every text that names an LMS uses `{LMS}` with the manifest text name. Manifest texts may
// use only these placeholders (registry load check 1).

export const TEXT_PLACEHOLDERS = ['LMS', 'tool', 'site'] as const;
export type TextPlaceholder = (typeof TEXT_PLACEHOLDERS)[number];

/** Replace each `{LMS}`, `{tool}` and `{site}` that has a value. A placeholder without a value stays as it is. */
export function fillText(text: string, values: Partial<Record<TextPlaceholder, string>>): string {
  return text.replace(/\{(LMS|tool|site)\}/g, (whole, name: TextPlaceholder) => values[name] ?? whole);
}
