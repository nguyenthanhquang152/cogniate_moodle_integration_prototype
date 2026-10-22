import { randomToken, sha256Hex } from '@cogniate/shared/channel';
import type { PortContext } from '../../../../services/cogniate-app/src/kernel/ports.ts';

export type BuildStatus = 'queued' | 'running' | 'ready' | 'failed';
export interface MbzBuild {
  id: string; libraryId: string; courseId: string; versionId: string; status: BuildStatus;
  step: string | null; reason: string | null; bytes: number | null;
  createdAt: number; updatedAt: number; finishedAt: number | null;
}
const toBuild = (r: Record<string, unknown>): MbzBuild => ({
  id: String(r.id), libraryId: String(r.library_id), courseId: String(r.course_id), versionId: String(r.version_id), status: r.status as BuildStatus,
  step: r.step === null ? null : String(r.step), reason: r.reason === null ? null : String(r.reason), bytes: r.bytes === null ? null : Number(r.bytes),
  createdAt: Number(r.created_at), updatedAt: Number(r.updated_at), finishedAt: r.finished_at === null ? null : Number(r.finished_at),
});
// The runner needs 24 hex characters, not the base64url ids used by the app repositories.
export const newBuildId = (): string => `bld_${sha256Hex(randomToken()).slice(0, 24)}`;
export function latestBuild(ctx: PortContext, versionId: string): MbzBuild | undefined {
  const r = ctx.sql.get<Record<string, unknown>>('SELECT * FROM mbz_build WHERE library_id = :library_id AND version_id = :version_id ORDER BY created_at DESC, rowid DESC LIMIT 1', { version_id: versionId });
  return r ? toBuild(r) : undefined;
}
export function latestReadyBuild(ctx: PortContext, versionId: string): MbzBuild | undefined {
  const r = ctx.sql.get<Record<string, unknown>>("SELECT * FROM mbz_build WHERE library_id = :library_id AND version_id = :version_id AND status = 'ready' ORDER BY created_at DESC, rowid DESC LIMIT 1", { version_id: versionId });
  return r ? toBuild(r) : undefined;
}
export function createBuild(ctx: PortContext, b: { id: string; courseId: string; versionId: string }): MbzBuild {
  ctx.sql.run(`INSERT INTO mbz_build (id, library_id, course_id, version_id, status, created_at, updated_at)
    VALUES (:id, :library_id, :course_id, :version_id, 'queued', :now, :now)`, { id: b.id, course_id: b.courseId, version_id: b.versionId, now: ctx.now() });
  return latestBuild(ctx, b.versionId)!;
}
export function applyRunnerStatus(ctx: PortContext, id: string, s: { status: BuildStatus; step: string | null; reason: string | null; bytes: number | null; finishedAt: number | null }): void {
  ctx.sql.run(`UPDATE mbz_build SET status = :status, step = :step, reason = :reason, bytes = :bytes, finished_at = :finished_at, updated_at = :now
    WHERE id = :id AND library_id = :library_id AND status NOT IN ('ready', 'failed')`, {
    id, status: s.status, step: s.step, reason: s.reason, bytes: s.bytes, finished_at: s.finishedAt, now: ctx.now(),
  });
}
export function activeBuilds(ctx: PortContext): MbzBuild[] {
  return ctx.sql.all<Record<string, unknown>>("SELECT * FROM mbz_build WHERE library_id = :library_id AND status IN ('queued', 'running') ORDER BY created_at, rowid").map(toBuild);
}
export function activeBuildCount(ctx: PortContext): number {
  return Number(ctx.sql.get<{ n: number }>("SELECT COUNT(*) AS n FROM mbz_build WHERE library_id = :library_id AND status IN ('queued', 'running')")?.n ?? 0);
}
