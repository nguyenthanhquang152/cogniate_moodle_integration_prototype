/** Reject codes of an upload (contract cogniate-app-api §3.2). */
export const REJECT_CODES = [
  'ZIP_INVALID',
  'ZIP_TOO_LARGE',
  'ZIP_TOO_MANY_ENTRIES',
  'ZIP_BOMB',
  'PATH_TRAVERSAL',
  'ABSOLUTE_PATH',
  'SYMLINK_ENTRY',
  'INVALID_ENTRY_NAME',
  'DUPLICATE_ENTRY',
  'MANIFEST_INVALID_XML',
  'MANIFEST_DTD_FORBIDDEN',
  'SCORM_VERSION_UNSUPPORTED',
  'MULTI_SCO_UNSUPPORTED',
  'LAUNCH_FILE_MISSING',
  'NO_ENTRY_PAGE',
  'INVALID_PACKAGE_IDENTIFIER',
] as const;

export type RejectCode = (typeof REJECT_CODES)[number];

/** One reason in details.reasons. `path` is the entry name (or the manifest href) when the reason is about one entry. */
export interface RejectReason {
  code: RejectCode;
  path?: string;
  detail: string;
}

/** Limits of security §7. Tests can make them smaller. Sizes are decimal: 200 MB = 200,000,000 bytes. */
export interface Limits {
  /** Size of the zip file (the upload). */
  maxUploadBytes: number;
  /** Sum of the uncompressed sizes of all files. */
  maxTotalBytes: number;
  maxEntries: number;
  /** Uncompressed size / compressed size, per entry. */
  maxRatio: number;
  /** Largest imsmanifest.xml that is read. */
  maxManifestBytes: number;
  /** Largest .html or .css file that is read for the profile. Larger files are not scanned. */
  maxTextBytes: number;
}

export const DEFAULT_LIMITS: Limits = Object.freeze({
  maxUploadBytes: 200_000_000,
  maxTotalBytes: 500_000_000,
  maxEntries: 5000,
  maxRatio: 100,
  maxManifestBytes: 2_000_000,
  maxTextBytes: 8_000_000,
});

/** Thrown by extractPackage when the zip fails a check (the caller reports the reasons as 422). */
export class PackageRejectedError extends Error {
  readonly reasons: RejectReason[];
  constructor(reasons: RejectReason[]) {
    super(`package rejected: ${reasons.map((r) => r.code).join(', ')}`);
    this.name = 'PackageRejectedError';
    this.reasons = reasons;
  }
}

/** Keep a path short and printable in a reason (the JSON encoder escapes control characters). */
export function reasonPath(name: string): string {
  return name.length > 300 ? `${name.slice(0, 300)}...` : name;
}
