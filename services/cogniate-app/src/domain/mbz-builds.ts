// .mbz builds (T8, ADR-007; app contract §11). The app never runs Docker: it writes one request file into the
// Build Runner queue and reads the runner's status file (infra/scripts/build-runner.sh, host side).
import { randomBytes } from 'node:crypto';
import type { Db } from './db.ts';

export type BuildStatus = 'queued' | 'running' | 'ready' | 'failed';

export interface MbzBuild {
  id: string;
  libraryId: string;
  courseId: string;
  versionId: string;
  status: BuildStatus;
  step: string | null;
  reason: string | null;
  bytes: number | null;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
}

const toBuild = (r: Record<string, unknown>): MbzBuild => ({
  id: String(r.id), libraryId: String(r.library_id), courseId: String(r.course_id), versionId: String(r.version_id), status: r.status as BuildStatus,
  step: r.step === null ? null : String(r.step), reason: r.reason === null ? null : String(r.reason), bytes: r.bytes === null ? null : Number(r.bytes),
  createdAt: Number(r.created_at), updatedAt: Number(r.updated_at), finishedAt: r.finished_at === null ? null : Number(r.finished_at),
});

/** A new build id: bld_ + 24 lowercase hex (the runner uses the hex in its compose project name). */
export const newBuildId = (): string => `bld_${randomBytes(12).toString('hex')}`;

export function createBuild(db: Db, b: { id: string; libraryId: string; courseId: string; versionId: string }, now: number): MbzBuild {
  db.prepare(`INSERT INTO mbz_build (id, library_id, course_id, version_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'queued', ?, ?)`)
    .run(b.id, b.libraryId, b.courseId, b.versionId, now, now);
  return latestBuild(db, b.libraryId, b.versionId)!;
}

/** The newest build of a version in this library. */
export function latestBuild(db: Db, libraryId: string, versionId: string): MbzBuild | undefined {
  const r = db.prepare('SELECT * FROM mbz_build WHERE library_id = ? AND version_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(libraryId, versionId);
  return r ? toBuild(r) : undefined;
}

/** The newest READY build of a version (download). */
export function latestReadyBuild(db: Db, libraryId: string, versionId: string): MbzBuild | undefined {
  const r = db.prepare("SELECT * FROM mbz_build WHERE library_id = ? AND version_id = ? AND status = 'ready' ORDER BY created_at DESC, rowid DESC LIMIT 1").get(libraryId, versionId);
  return r ? toBuild(r) : undefined;
}

/** Copy the runner's status into the row (only forward: a finished build does not change any more). */
export function applyRunnerStatus(db: Db, id: string, s: { status: BuildStatus; step: string | null; reason: string | null; bytes: number | null; finishedAt: number | null }, now: number): void {
  db.prepare(`UPDATE mbz_build SET status = ?, step = ?, reason = ?, bytes = ?, finished_at = ?, updated_at = ? WHERE id = ? AND status NOT IN ('ready', 'failed')`)
    .run(s.status, s.step, s.reason, s.bytes, s.finishedAt, now, id);
}

/** Builds of a library that wait or run (the per-library limit, A-T8 NIT). */
export function activeBuildCount(db: Db, libraryId: string): number {
  return Number(db.prepare("SELECT COUNT(*) AS n FROM mbz_build WHERE library_id = ? AND status IN ('queued', 'running')").get(libraryId)?.n ?? 0);
}
