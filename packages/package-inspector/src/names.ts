import type { RejectCode } from './codes.ts';

export type NameCheck =
  | { ok: true; path: string; isDir: boolean }
  | { ok: false; code: RejectCode; detail: string };

// NUL, C0 controls, DEL and C1 controls.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
const DRIVE = /^[A-Za-z]:/;
const MAX_NAME_CHARS = 1024;
const MAX_SEGMENT_BYTES = 255;

/**
 * Path safety of one entry name (security §7). Order: control characters, absolute path (`/`, `\`, drive letter),
 * `..` segment (split on `/` and `\`), backslash, length. On success, `path` is the name without empty and `.`
 * segments and without the trailing `/` of a folder. The caller uses only `path` to write files.
 */
export function checkEntryName(name: string): NameCheck {
  if (name === '') return { ok: false, code: 'INVALID_ENTRY_NAME', detail: 'The entry name is empty.' };
  if (CONTROL.test(name)) return { ok: false, code: 'INVALID_ENTRY_NAME', detail: 'The entry name has a NUL or control character.' };
  if (name.startsWith('/') || name.startsWith('\\') || DRIVE.test(name)) {
    return { ok: false, code: 'ABSOLUTE_PATH', detail: 'The entry name is an absolute path.' };
  }
  const segments = name.split(/[/\\]/);
  if (segments.includes('..')) return { ok: false, code: 'PATH_TRAVERSAL', detail: 'The entry name has a ".." segment.' };
  if (name.includes('\\')) return { ok: false, code: 'INVALID_ENTRY_NAME', detail: 'The entry name has a backslash.' };
  if (name.length > MAX_NAME_CHARS) return { ok: false, code: 'INVALID_ENTRY_NAME', detail: 'The entry name is too long.' };
  const parts = segments.filter((s) => s !== '' && s !== '.');
  if (parts.length === 0) return { ok: false, code: 'INVALID_ENTRY_NAME', detail: 'The entry name has no file or folder name.' };
  if (parts.some((p) => Buffer.byteLength(p, 'utf8') > MAX_SEGMENT_BYTES)) {
    return { ok: false, code: 'INVALID_ENTRY_NAME', detail: 'A part of the entry name is longer than 255 bytes.' };
  }
  return { ok: true, path: parts.join('/'), isDir: name.endsWith('/') };
}

/** Key for the duplicate check: Unicode NFC, then case folding (upper then lower also folds "ß" to "ss"). */
export function foldKey(path: string): string {
  return path.normalize('NFC').toUpperCase().toLowerCase();
}

const utf8 = new TextDecoder('utf-8', { fatal: true });

/**
 * Decode a raw zip entry name. General purpose bit 11 set: UTF-8, invalid bytes give null. Not set: ASCII as is,
 * else UTF-8 if valid (macOS Archive Utility writes UTF-8 without the flag), else Latin-1. The checks and the
 * extraction use the same decoded string.
 */
export function decodeEntryName(raw: Uint8Array, flags: number): string | null {
  if (raw.every((b) => b < 0x80)) return Buffer.from(raw).toString('latin1');
  try {
    return utf8.decode(raw);
  } catch {
    return (flags & 0x800) !== 0 ? null : Buffer.from(raw).toString('latin1');
  }
}
