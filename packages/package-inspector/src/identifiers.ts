// Package-derived identifiers (app contract §3.3, security §7). Values from the package are untrusted: they must
// pass these rules before anything is stored, else the upload is rejected with INVALID_PACKAGE_IDENTIFIER.
// Code keeps id-keyed data in Map objects or Object.create(null) objects.

export const MAX_ID_CHARS = 128;
export const MAX_PAGE_KEY_CHARS = 64;
export const MAX_TITLE_CHARS = 255;
export const MAX_QUESTIONS = 1000;
export const MAX_PAGES = 500;

const ID = /^[A-Za-z0-9._:-]+$/;
const PAGE_KEY = /^[A-Za-z0-9._-]+$/;
// U+0000-U+001F except tab, and U+007F-U+009F.
// eslint-disable-next-line no-control-regex
const TITLE_CONTROL = /[\u0000-\u0008\u000a-\u001f\u007f-\u009f]/;
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);

/** Why a manifest identifier or question id breaks the rule, or null. The value itself is never echoed. */
export function idProblem(value: string): string | null {
  if (value.length < 1 || value.length > MAX_ID_CHARS) return `must have 1 to ${MAX_ID_CHARS} characters`;
  if (!ID.test(value)) return 'may contain only A-Z, a-z, 0-9, ".", "_", ":" and "-"';
  if (FORBIDDEN.has(value.toLowerCase())) return 'is a reserved name';
  return null;
}

/** Why a page key breaks the rule, or null. */
export function pageKeyProblem(value: string): string | null {
  if (value.length < 1 || value.length > MAX_PAGE_KEY_CHARS) return `must have 1 to ${MAX_PAGE_KEY_CHARS} characters`;
  if (!PAGE_KEY.test(value)) return 'may contain only A-Z, a-z, 0-9, ".", "_" and "-"';
  if (FORBIDDEN.has(value.toLowerCase())) return 'is a reserved name';
  return null;
}

/** Why a title (already trimmed) breaks the rule, or null. */
export function titleProblem(value: string): string | null {
  if (value.length < 1 || value.length > MAX_TITLE_CHARS) return `must have 1 to ${MAX_TITLE_CHARS} characters`;
  if (TITLE_CONTROL.test(value)) return 'has a control character';
  return null;
}
