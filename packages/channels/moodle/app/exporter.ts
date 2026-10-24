// The exporter handles build state; the kernel alone handles queue files and downloads.
import type { ExportBuildView, ExporterContext, PackageExporter } from '../../../../services/cogniate-app/src/kernel/ports.ts';
import type { BuildStatus, MbzBuild } from './builds.ts';
import { activeBuildCount, activeBuilds, applyRunnerStatus, createBuild, latestBuild, latestReadyBuild, newBuildId } from './builds.ts';
import { ExportError } from './errors.ts';

const STATUSES = new Set(['queued', 'running', 'ready', 'failed']);
const RUNNER_WAIT_MS = 60_000;
export const STALE_BUILD_MS = 10 * 60_000;
const HEARTBEAT_MS = 30_000;
export const MAX_ACTIVE_BUILDS_PER_LIBRARY = 2;
const iso = (ms: number | null): string | null => ms === null ? null : new Date(ms).toISOString();
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
function buildJson(b: MbzBuild): ExportBuildView {
  return {
    buildId: b.id, courseId: b.courseId, versionId: b.versionId, status: b.status, step: b.step, reason: b.reason, bytes: b.bytes,
    createdAt: iso(b.createdAt), updatedAt: iso(b.updatedAt), finishedAt: iso(b.finishedAt),
    downloadUrl: b.status === 'ready' ? `/app-api/courses/${b.courseId}/versions/${b.versionId}/download?kind=mbz` : null,
  };
}
async function waitingReason(ctx: ExporterContext): Promise<string> {
  const hb = await ctx.buildQueue.runner();
  if (!record(hb) || typeof hb.lastSeenAt !== 'string' || ctx.now() - Date.parse(hb.lastSeenAt) > HEARTBEAT_MS) {
    return 'The Build Runner is not running. Start it with npm run stack:up, or run npm run build-runner.';
  }
  if (hb.image === 'failed') return 'The Build Runner cannot make its build image. See infra/.logs/build-runner.jsonl, then run npm run build-runner image.';
  if (hb.image === 'building' || hb.image === 'missing') return 'The Build Runner is making its build image (once, about 20 s).';
  return 'Waiting in the build queue.';
}
function stale(ctx: ExporterContext, b: MbzBuild, reason: string): MbzBuild {
  applyRunnerStatus(ctx, b.id, { status: 'failed', step: b.step, reason, bytes: null, finishedAt: ctx.now() });
  return latestBuild(ctx, b.versionId) ?? b;
}
async function refresh(ctx: ExporterContext, b: MbzBuild): Promise<MbzBuild> {
  if (b.status === 'ready' || b.status === 'failed') return b;
  const s = await ctx.buildQueue.status(b.id);
  if (record(s) && typeof s.status === 'string' && STATUSES.has(s.status)) {
    applyRunnerStatus(ctx, b.id, {
      status: s.status as BuildStatus, step: typeof s.step === 'string' ? s.step.slice(0, 32) : null,
      reason: typeof s.reason === 'string' && s.reason !== '' ? s.reason.slice(0, 300) : null,
      bytes: typeof s.bytes === 'number' ? s.bytes : null,
      finishedAt: typeof s.finishedAt === 'string' ? Date.parse(s.finishedAt) || ctx.now() : null,
    });
    const current = latestBuild(ctx, b.versionId) ?? b;
    // A parallel retry may reserve a newer build while status is read. Do not time it out with the old status.
    if (current.id !== b.id) return current;
    const lastProgress = typeof s.updatedAt === 'string' ? Date.parse(s.updatedAt) : current.createdAt;
    if ((current.status === 'running' || current.status === 'queued') && ctx.now() - lastProgress > STALE_BUILD_MS) {
      return stale(ctx, current, 'The Build Runner did not finish this build (no progress for 10 min). Build again.');
    }
    return current;
  }
  if (ctx.now() - b.createdAt > STALE_BUILD_MS) return stale(ctx, b, `The Build Runner did not take this build in 10 min. ${await waitingReason(ctx)}`);
  if (ctx.now() - b.createdAt > RUNNER_WAIT_MS && await ctx.buildQueue.pending(b.id)) return { ...b, reason: await waitingReason(ctx) };
  return b;
}

export const mbzExporter: PackageExporter = {
  id: 'mbz', formats: ['scorm12'],
  async start(version, ctx) {
    if (version.format !== 'scorm12') throw new ExportError('MBZ_NOT_SUPPORTED');
    const latest = latestBuild(ctx, version.id);
    if (latest) await refresh(ctx, latest);
    // Refresh every active build before counting. A held build reports progress and still owns its slot.
    for (const other of activeBuilds(ctx)) await refresh(ctx, other);
    // Reserve synchronously after the awaits; a concurrent request cannot reserve the same slot.
    const current = latestBuild(ctx, version.id);
    if (current && (current.status === 'queued' || current.status === 'running')) return buildJson(current);
    if (activeBuildCount(ctx) >= MAX_ACTIVE_BUILDS_PER_LIBRARY) {
      throw new ExportError('MBZ_BUILD_LIMIT', `${MAX_ACTIVE_BUILDS_PER_LIBRARY} builds of your library wait or run. Build again when one has ended.`);
    }
    if (!/^[0-9a-f]{64}$/.test(version.packageSha256)) throw new ExportError('NOT_FOUND', 'The package of this version is missing.');
    const id = newBuildId();
    const b = createBuild(ctx, { id, courseId: version.courseId, versionId: version.id });
    try {
      await ctx.buildQueue.submit(id, {
        courseId: version.courseId, versionId: version.id, packageSha256: version.packageSha256, variant: version.variant || 'default', lang: version.lang || 'en',
        title: [...version.title].map((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f ? ' ' : ch).join('').slice(0, 255),
      });
    } catch (error) {
      stale(ctx, b, 'The build request could not be written. Build again.');
      throw error;
    }
    return buildJson(b);
  },
  async latest(version, ctx) {
    const b = latestBuild(ctx, version.id);
    return b ? buildJson(await refresh(ctx, b)) : null;
  },
  async download(version, ctx) {
    const b = latestReadyBuild(ctx, version.id);
    return b ? { artifact: b.id, mediaType: 'application/vnd.moodle.backup', filename: `cogniate-course-v${version.version}.mbz` } : null;
  },
};
