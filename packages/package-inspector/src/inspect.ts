import { stat } from 'node:fs/promises';
import type { ZipFile } from 'yauzl';
import type { Limits, RejectReason } from './codes.ts';
import { DEFAULT_LIMITS, reasonPath } from './codes.ts';
import type { HtmlScan } from './html.ts';
import { cssUrls, externalHost, scanHtml } from './html.ts';
import { MAX_PAGES, MAX_QUESTIONS, idProblem, pageKeyProblem, titleProblem } from './identifiers.ts';
import { parseManifest, resolveHref } from './manifest.ts';
import type { ZipFileEntry, ZipScan } from './zip.ts';
import { ZipReadError, openZip, readEntries, readEntryBuffer, scanEntries } from './zip.ts';

export type PackageFormat = 'scorm12' | 'html';

/** report of a CourseVersion (contract cogniate-app-api §3). */
export interface PackageReport {
  format: PackageFormat;
  entryPath: string;
  totalBytes: number;
  fileCount: number;
  scorm: { schemaVersion: string; identifier: string; title: string; masteryScore: number | null; scoCount: number } | null;
  html: { pages: string[]; menuPage: string | null; questionIds: string[] } | null;
  externalHosts: string[];
  warnings: Array<{ code: 'EXTERNAL_ASSETS'; detail: string }>;
}

/** trackingProfile of a CourseVersion (data-model §2). */
export interface TrackingProfile {
  format: PackageFormat;
  launchPath: string;
  pages: string[];
  menuPage: string | null;
  questionIds: string[];
  masteryScore: number | null;
  minDwellMs: number;
  /** SCORM: the manifest adlcp:datafromlms (cmi.launch_data), else "" (A-T5a-05). Absent in versions made before T7. */
  launchData?: string;
}

export interface Inspection {
  format: PackageFormat;
  report: PackageReport;
  trackingProfile: TrackingProfile;
}

export type InspectResult = { ok: true; inspection: Inspection } | { ok: false; reasons: RejectReason[] };

export interface InspectOptions {
  limits?: Partial<Limits>;
  /** Upload field `masteryScore` (0-100). HTML only; a SCORM package uses the manifest value. */
  masteryScore?: number;
}

export const MIN_DWELL_MS = 10_000;
export const DEFAULT_HTML_MASTERY = 70;

const reject = (...reasons: RejectReason[]): InspectResult => ({ ok: false, reasons });

/**
 * Inspect an uploaded zip without writing any file (security §7, contract §3.1 and §3.2).
 * Order: file size, zip structure, entry count, entry checks (central directory only), detection,
 * manifest or entry page, then the HTML and CSS profile.
 */
export async function inspectPackage(zipPath: string, options: InspectOptions = {}): Promise<InspectResult> {
  const limits: Limits = { ...DEFAULT_LIMITS, ...options.limits };
  const { size } = await stat(zipPath);
  if (size > limits.maxUploadBytes) {
    return reject({ code: 'ZIP_TOO_LARGE', detail: `The file is larger than ${limits.maxUploadBytes / 1_000_000} MB.` });
  }
  let zip: ZipFile;
  try {
    zip = await openZip(zipPath);
  } catch {
    return reject({ code: 'ZIP_INVALID', detail: 'The file is not a readable zip.' });
  }
  try {
    if (zip.entryCount > limits.maxEntries) {
      return reject({ code: 'ZIP_TOO_MANY_ENTRIES', detail: `The zip has ${zip.entryCount} entries. The limit is ${limits.maxEntries}.` });
    }
    const scanned = scanEntries(await readEntries(zip), limits);
    if (!scanned.ok) return reject(...scanned.reasons);
    return await profile(zip, scanned.scan, limits, options);
  } catch (err) {
    if (err instanceof ZipReadError) {
      return reject({ code: 'ZIP_INVALID', ...(err.path ? { path: reasonPath(err.path) } : {}), detail: 'The zip data cannot be read.' });
    }
    throw err;
  } finally {
    zip.close();
  }
}

/** The one top-level folder that holds every entry, or null. */
function singleTopFolder(scan: ZipScan): string | null {
  const tops = new Set<string>();
  for (const f of scan.files) tops.add(f.path.includes('/') ? f.path.split('/')[0]! : `\0${f.path}`);
  for (const d of scan.dirs) tops.add(d.split('/')[0]!);
  if (tops.size !== 1) return null;
  const top = [...tops][0]!;
  return top.startsWith('\0') ? null : top;
}

const isHtml = (p: string): boolean => /\.html$/i.test(p);
const isHtmlLike = (p: string): boolean => /\.html?$/i.test(p);
const isCss = (p: string): boolean => /\.css$/i.test(p);
const isSvg = (p: string): boolean => /\.svg$/i.test(p);
const fileName = (p: string): string => p.slice(p.lastIndexOf('/') + 1);

async function profile(zip: ZipFile, scan: ZipScan, limits: Limits, options: InspectOptions): Promise<InspectResult> {
  const byPath = new Map<string, ZipFileEntry>(scan.files.map((f) => [f.path, f]));
  const top = singleTopFolder(scan);
  let format: PackageFormat;
  let root: string;
  if (byPath.has('imsmanifest.xml')) [format, root] = ['scorm12', ''];
  else if (top && byPath.has(`${top}/imsmanifest.xml`)) [format, root] = ['scorm12', `${top}/`];
  else if (byPath.has('index.html')) [format, root] = ['html', ''];
  else if (top && byPath.has(`${top}/index.html`)) [format, root] = ['html', `${top}/`];
  else {
    return reject({ code: 'NO_ENTRY_PAGE', detail: 'The package has no imsmanifest.xml and no index.html at the root or in one top-level folder.' });
  }

  let entryPath = `${root}index.html`;
  let scorm: PackageReport['scorm'] = null;
  let launchData = '';
  if (format === 'scorm12') {
    const manifestFile = byPath.get(`${root}imsmanifest.xml`)!;
    if (manifestFile.size > limits.maxManifestBytes) {
      return reject({ code: 'MANIFEST_INVALID_XML', path: manifestFile.path, detail: `The manifest is larger than ${limits.maxManifestBytes / 1_000_000} MB.` });
    }
    const parsed = parseManifest(await readEntryBuffer(zip, manifestFile));
    if (!parsed.ok) return reject({ code: parsed.code, path: manifestFile.path, detail: parsed.detail });
    const { manifest } = parsed;
    // App contract §3.3: every identifier and title passes the rules before anything is stored.
    for (const { field, value } of manifest.identifiers) {
      const problem = value === null ? 'is missing' : idProblem(value);
      if (problem) return reject({ code: 'INVALID_PACKAGE_IDENTIFIER', path: manifestFile.path, detail: `The ${field} ${problem}.` });
    }
    for (const { field, value } of manifest.titles) {
      const problem = titleProblem(value);
      if (problem) return reject({ code: 'INVALID_PACKAGE_IDENTIFIER', path: manifestFile.path, detail: `The ${field} ${problem}.` });
    }
    if (manifest.scos.length > 1) {
      return reject({ code: 'MULTI_SCO_UNSUPPORTED', detail: `The manifest has ${manifest.scos.length} SCO resources. Only one is supported.` });
    }
    const sco = manifest.scos[0];
    if (!sco) return reject({ code: 'LAUNCH_FILE_MISSING', detail: 'The manifest has no resource with adlcp:scormtype="sco".' });
    if (sco.href === null) return reject({ code: 'LAUNCH_FILE_MISSING', detail: 'The SCO resource has no href.' });
    const resolved = resolveHref(root, sco.href);
    if (resolved === null || !byPath.has(resolved)) {
      return reject({ code: 'LAUNCH_FILE_MISSING', path: reasonPath(sco.href), detail: 'The SCO href is not a file in the zip.' });
    }
    entryPath = resolved;
    scorm = { schemaVersion: manifest.schemaVersion, identifier: manifest.identifier, title: manifest.title, masteryScore: manifest.masteryScore, scoCount: 1 };
    launchData = manifest.launchData;
  }

  // Pages: the .html files directly in the root folder (the manifest folder or the entry folder), sorted by file name.
  const pageFiles = scan.files
    .filter((f) => f.path.startsWith(root) && !f.path.slice(root.length).includes('/') && isHtml(f.path))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (pageFiles.length > MAX_PAGES) {
    return reject({ code: 'INVALID_PACKAGE_IDENTIFIER', detail: `The package has ${pageFiles.length} pages. The limit is ${MAX_PAGES}.` });
  }

  // One pass over every HTML, SVG and CSS file: page keys and question ids (pages), external hosts (all files).
  const scans = new Map<string, HtmlScan>();
  const hosts = new Set<string>();
  for (const f of scan.files) {
    const markup = isHtmlLike(f.path) || isSvg(f.path);
    if ((!markup && !isCss(f.path)) || f.size > limits.maxTextBytes) continue;
    const source = (await readEntryBuffer(zip, f)).toString('utf8');
    const result: HtmlScan = markup ? scanHtml(source) : { questionIds: [], lessonId: null, resourceUrls: cssUrls(source) };
    scans.set(f.path, result);
    for (const u of result.resourceUrls) {
      const host = externalHost(u);
      if (host) hosts.add(host);
    }
  }

  // Page key = body[data-lesson-id], else the file name without .html (app contract §3.3). Keys are unique.
  const pages: string[] = [];
  const keyOfPath = new Map<string, string>();
  const pathOfKey = new Map<string, string>();
  for (const f of pageFiles) {
    const lessonId = scans.get(f.path)?.lessonId ?? null;
    const key = lessonId ?? fileName(f.path).slice(0, -'.html'.length);
    const problem = pageKeyProblem(key);
    if (problem) return reject({ code: 'INVALID_PACKAGE_IDENTIFIER', path: reasonPath(f.path), detail: `The page key ${problem}.` });
    if (pathOfKey.has(key)) return reject({ code: 'INVALID_PACKAGE_IDENTIFIER', path: reasonPath(f.path), detail: 'The page key is the same as the key of another page.' });
    pathOfKey.set(key, f.path);
    keyOfPath.set(f.path, key);
    pages.push(key);
  }
  const indexKey = keyOfPath.get(`${root}index.html`);
  const menuPage = pages.length > 1 && indexKey !== undefined ? indexKey : null;

  // Question ids: unique data-cog-quiz values in document order, pages sorted by file name.
  const questionIds: string[] = [];
  const seenQuestions = new Set<string>();
  for (const f of pageFiles) {
    for (const q of scans.get(f.path)?.questionIds ?? []) {
      const problem = idProblem(q);
      if (problem) return reject({ code: 'INVALID_PACKAGE_IDENTIFIER', path: reasonPath(f.path), detail: `A question id (data-cog-quiz) ${problem}.` });
      if (!seenQuestions.has(q)) {
        seenQuestions.add(q);
        questionIds.push(q);
      }
    }
  }
  if (questionIds.length > MAX_QUESTIONS) {
    return reject({ code: 'INVALID_PACKAGE_IDENTIFIER', detail: `The package has ${questionIds.length} question ids. The limit is ${MAX_QUESTIONS}.` });
  }
  const externalHosts = [...hosts].sort();

  const masteryScore = format === 'scorm12'
    ? scorm!.masteryScore
    : options.masteryScore ?? (questionIds.length > 0 ? DEFAULT_HTML_MASTERY : null);

  const warnings: PackageReport['warnings'] = externalHosts.length === 0 ? [] : [{
    code: 'EXTERNAL_ASSETS',
    detail: `The package loads files from ${externalHosts.length} external host${externalHosts.length === 1 ? '' : 's'}.`,
  }];

  const report: PackageReport = {
    format,
    entryPath,
    totalBytes: scan.totalBytes,
    fileCount: scan.files.length,
    scorm,
    html: format === 'html' ? { pages, menuPage, questionIds } : null,
    externalHosts,
    warnings,
  };
  const trackingProfile: TrackingProfile = { format, launchPath: entryPath, pages, menuPage, questionIds, masteryScore, minDwellMs: MIN_DWELL_MS, ...(format === 'scorm12' ? { launchData } : {}) };
  return { ok: true, inspection: { format, report, trackingProfile } };
}
