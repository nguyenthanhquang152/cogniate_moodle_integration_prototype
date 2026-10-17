// Courses, course versions and packages (contract cogniate-app-api §3). Every function takes the library id
// (data-model §2): a course of another library is not found.
import type { PackageFormat, PackageReport, TrackingProfile } from '@cogniate/package-inspector';
import { randomId } from '@cogniate/shared';
import type { Db } from './db.ts';
import { transaction } from './db.ts';

export interface Course {
  id: string;
  libraryId: string;
  title: string;
  summary: string;
  variant: string;
  lang: string;
  createdAt: number;
}

export interface CourseVersion {
  id: string;
  courseId: string;
  version: number;
  format: PackageFormat;
  packageId: string;
  report: PackageReport;
  trackingProfile: TrackingProfile;
  createdAt: number;
}

export interface NewPackage {
  id: string;
  sha256: string;
  totalBytes: number;
  fileCount: number;
  storagePath: string;
}

const toCourse = (r: Record<string, unknown>): Course => ({
  id: String(r.id), libraryId: String(r.library_id), title: String(r.title), summary: String(r.summary),
  variant: String(r.variant), lang: String(r.lang), createdAt: Number(r.created_at),
});

const toVersion = (r: Record<string, unknown>): CourseVersion => ({
  id: String(r.id), courseId: String(r.course_id), version: Number(r.version), format: String(r.format) as PackageFormat,
  packageId: String(r.package_id), report: JSON.parse(String(r.validation_report)) as PackageReport,
  trackingProfile: JSON.parse(String(r.tracking_profile)) as TrackingProfile, createdAt: Number(r.created_at),
});

export function createCourse(db: Db, libraryId: string, input: { title: string; summary: string; variant: string; lang: string }, now: number): Course {
  const course: Course = { id: randomId('crs_'), libraryId, ...input, createdAt: now };
  db.prepare('INSERT INTO course (id, library_id, title, summary, variant, lang, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(course.id, libraryId, course.title, course.summary, course.variant, course.lang, now);
  return course;
}

/** Newest first. */
export function listCourses(db: Db, libraryId: string): Course[] {
  return db.prepare('SELECT * FROM course WHERE library_id = ? ORDER BY created_at DESC, id').all(libraryId).map(toCourse);
}

export function getCourse(db: Db, libraryId: string, courseId: string): Course | undefined {
  const row = db.prepare('SELECT * FROM course WHERE id = ? AND library_id = ?').get(courseId, libraryId);
  return row ? toCourse(row) : undefined;
}

/** Oldest first (version 1, 2, ...). */
export function listVersions(db: Db, libraryId: string, courseId: string): CourseVersion[] {
  return db.prepare(`
    SELECT v.* FROM course_version v JOIN course c ON c.id = v.course_id
    WHERE v.course_id = ? AND c.library_id = ? ORDER BY v.version`).all(courseId, libraryId).map(toVersion);
}

export function latestVersion(db: Db, libraryId: string, courseId: string): CourseVersion | undefined {
  const row = db.prepare(`
    SELECT v.* FROM course_version v JOIN course c ON c.id = v.course_id
    WHERE v.course_id = ? AND c.library_id = ? ORDER BY v.version DESC LIMIT 1`).get(courseId, libraryId);
  return row ? toVersion(row) : undefined;
}

export function getVersion(db: Db, libraryId: string, courseId: string, versionId: string): CourseVersion | undefined {
  const row = db.prepare(`
    SELECT v.* FROM course_version v JOIN course c ON c.id = v.course_id
    WHERE v.id = ? AND v.course_id = ? AND c.library_id = ?`).get(versionId, courseId, libraryId);
  return row ? toVersion(row) : undefined;
}

/** Store the package row and the next version of the course in one transaction. */
export function addVersion(
  db: Db,
  libraryId: string,
  input: { courseId: string; format: PackageFormat; pkg: NewPackage; report: PackageReport; trackingProfile: TrackingProfile },
  now: number,
): CourseVersion {
  return transaction(db, () => {
    const course = db.prepare('SELECT id FROM course WHERE id = ? AND library_id = ?').get(input.courseId, libraryId);
    if (!course) throw new Error('course not found in library');
    const next = Number(db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS n FROM course_version WHERE course_id = ?').get(input.courseId)?.n ?? 1);
    db.prepare('INSERT INTO package (id, library_id, sha256, total_bytes, file_count, storage_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(input.pkg.id, libraryId, input.pkg.sha256, input.pkg.totalBytes, input.pkg.fileCount, input.pkg.storagePath, now);
    const version: CourseVersion = {
      id: randomId('ver_'), courseId: input.courseId, version: next, format: input.format, packageId: input.pkg.id,
      report: input.report, trackingProfile: input.trackingProfile, createdAt: now,
    };
    db.prepare(`INSERT INTO course_version (id, course_id, version, format, package_id, validation_report, tracking_profile, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(version.id, version.courseId, version.version, version.format, version.packageId,
      JSON.stringify(version.report), JSON.stringify(version.trackingProfile), now);
    return version;
  });
}
