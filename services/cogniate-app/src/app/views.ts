// JSON shapes of contract cogniate-app-api §3.
import type { Course, CourseVersion } from '../domain/courses.ts';

const iso = (ms: number): string => new Date(ms).toISOString();

export interface CourseJson {
  id: string;
  title: string;
  summary: string;
  variant: string;
  lang: string;
  createdAt: string;
  /** Short form of the newest version, or null before the first upload. */
  latestVersion: { id: string; version: number; format: string; createdAt: string } | null;
  publications: Array<{ id: string; connectionId: string; status: string }>;
}

export function courseJson(course: Course, latest: CourseVersion | undefined): CourseJson {
  return {
    id: course.id,
    title: course.title,
    summary: course.summary,
    variant: course.variant,
    lang: course.lang,
    createdAt: iso(course.createdAt),
    latestVersion: latest ? { id: latest.id, version: latest.version, format: latest.format, createdAt: iso(latest.createdAt) } : null,
    publications: [], // T4b1
  };
}

export function versionJson(v: CourseVersion) {
  return {
    id: v.id,
    courseId: v.courseId,
    version: v.version,
    format: v.format,
    packageId: v.packageId,
    report: v.report,
    trackingProfile: v.trackingProfile,
    createdAt: iso(v.createdAt),
  };
}
