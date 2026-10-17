// Package inspector (ADR-008): zip checks, manifest parsing, HTML profile. Security §7, contract cogniate-app-api §3.
export { DEFAULT_LIMITS, PackageRejectedError, REJECT_CODES } from './codes.ts';
export type { Limits, RejectCode, RejectReason } from './codes.ts';
export { extractPackage, safeTarget } from './extract.ts';
export type { ExtractResult } from './extract.ts';
export { cssUrls, externalHost, scanHtml, srcsetUrls } from './html.ts';
export { DEFAULT_HTML_MASTERY, MIN_DWELL_MS, inspectPackage } from './inspect.ts';
export type { InspectOptions, InspectResult, Inspection, PackageFormat, PackageReport, TrackingProfile } from './inspect.ts';
export { parseManifest, resolveHref } from './manifest.ts';
export { MAX_ID_CHARS, MAX_PAGES, MAX_PAGE_KEY_CHARS, MAX_QUESTIONS, MAX_TITLE_CHARS, idProblem, pageKeyProblem, titleProblem } from './identifiers.ts';
export { checkEntryName, foldKey } from './names.ts';
