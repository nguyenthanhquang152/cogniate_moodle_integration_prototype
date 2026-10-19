// .mbz builds (T8 stretch, ADR-007, app contract §11):
//   POST /app-api/courses/:courseId/versions/:versionId/mbz   -> 202 (a build is queued)
//   GET  /app-api/courses/:courseId/versions/:versionId/mbz   -> 200 the newest build (404 if none)
// The app writes ONE small request file into the Build Runner queue (infra/.data/build-queue/requests, the only
// folder it may write) and reads the runner's status file. The runner runs on the host (Docker never in this container).
import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getCourse, getVersion } from '../domain/courses.ts';
import type { Db } from '../domain/db.ts';
import type { BuildStatus, MbzBuild } from '../domain/mbz-builds.ts';
import { activeBuildCount, activeBuilds, applyRunnerStatus, createBuild, latestBuild, newBuildId } from '../domain/mbz-builds.ts';
import { ApiError } from './api-errors.ts';

export interface MbzRouteDeps {
  db: Db;
  now: () => number;
  /** BUILD_QUEUE_DIR (compose: /build-queue): requests/ (read-write), status/ and out/ (read-only). */
  buildQueueDir: string;
  /** Knobs BUILD_RUNNER_HOLD and BUILD_RUNNER_FAIL_AT (tasks README §3): passed to the runner in each request. */
  buildKnobs: { hold: boolean; failAt: string };
}

type VersionParams = { Params: { courseId: string; versionId: string } };
const STATUSES: ReadonlySet<string> = new Set(['queued', 'running', 'ready', 'failed']);
/** A request that the runner has not taken after this time: the portal says why (from the runner heartbeat). */
const RUNNER_WAIT_MS = 60_000;
/** B-T8-01: a build with no progress for this long is failed, so a new request starts a fresh build. */
export const STALE_BUILD_MS = 10 * 60_000;
/** The runner writes status/runner.json every few seconds; older than this = not running. */
const HEARTBEAT_MS = 30_000;
/** A-T8 NIT: one library cannot fill the single build queue. */
export const MAX_ACTIVE_BUILDS_PER_LIBRARY = 2;

const iso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString());

export function buildJson(b: MbzBuild) {
  return {
    buildId: b.id, courseId: b.courseId, versionId: b.versionId, status: b.status, step: b.step, reason: b.reason, bytes: b.bytes,
    createdAt: iso(b.createdAt), updatedAt: iso(b.updatedAt), finishedAt: iso(b.finishedAt),
    downloadUrl: b.status === 'ready' ? `/app-api/courses/${b.courseId}/versions/${b.versionId}/download?kind=mbz` : null,
  };
}

/** The .mbz file of a ready build (out/ is written only by the runner). */
export const mbzPath = (buildQueueDir: string, buildId: string): string => join(buildQueueDir, 'out', `${buildId}.mbz`);

export function registerMbzRoutes(api: FastifyInstance, deps: MbzRouteDeps): void {
  const { db, now, buildQueueDir } = deps;
  const libraryId = (req: FastifyRequest): string => req.auth!.signedIn.library.id;
  const versionOf = (req: FastifyRequest<VersionParams>) => {
    const lib = libraryId(req);
    const course = getCourse(db, lib, req.params.courseId);
    const version = course ? getVersion(db, lib, course.id, req.params.versionId) : undefined;
    if (!course || !version) throw new ApiError('NOT_FOUND', 'The course version does not exist in your library.');
    return { course, version, lib };
  };

  /** Why a queued build waits, from the runner heartbeat (status/runner.json, B-T8-02). */
  async function waitingReason(): Promise<string> {
    try {
      const hb = JSON.parse(await readFile(join(buildQueueDir, 'status', 'runner.json'), 'utf8')) as { lastSeenAt?: string; image?: string };
      if (typeof hb.lastSeenAt !== 'string' || now() - Date.parse(hb.lastSeenAt) > HEARTBEAT_MS) throw new Error('stale');
      if (hb.image === 'failed') return 'The Build Runner cannot make its build image. See infra/.logs/build-runner.jsonl, then run npm run build-runner image.';
      if (hb.image === 'building' || hb.image === 'missing') return 'The Build Runner is making its build image (once, about 20 s).';
      return 'Waiting in the build queue.';
    } catch {
      return 'The Build Runner is not running. Start it with npm run stack:up, or run npm run build-runner.';
    }
  }

  const stale = (b: MbzBuild, reason: string): MbzBuild => {
    applyRunnerStatus(db, b.id, { status: 'failed', step: b.step, reason, bytes: null, finishedAt: now() }, now());
    return latestBuild(db, b.libraryId, b.versionId) ?? b;
  };

  /**
   * Read the runner's status file into the row. B-T8-01: a build with no progress for STALE_BUILD_MS is failed (the
   * runner stopped or the request was never taken), so a new request starts a fresh build.
   */
  async function refresh(b: MbzBuild): Promise<MbzBuild> {
    if (b.status === 'ready' || b.status === 'failed') return b;
    let s: Record<string, unknown> | null;
    try {
      s = JSON.parse(await readFile(join(buildQueueDir, 'status', `${b.id}.json`), 'utf8')) as Record<string, unknown>;
    } catch {
      s = null;
    }
    if (s && typeof s.status === 'string' && STATUSES.has(s.status)) {
      applyRunnerStatus(db, b.id, {
        status: s.status as BuildStatus, step: typeof s.step === 'string' ? s.step.slice(0, 32) : null,
        reason: typeof s.reason === 'string' && s.reason !== '' ? s.reason.slice(0, 300) : null, bytes: typeof s.bytes === 'number' ? s.bytes : null,
        finishedAt: typeof s.finishedAt === 'string' ? Date.parse(s.finishedAt) || now() : null,
      }, now());
      const current = latestBuild(db, b.libraryId, b.versionId) ?? b;
      // A parallel retry may have reserved a newer build during readFile. The old status cannot time it out.
      if (current.id !== b.id) return current;
      const lastProgress = typeof s.updatedAt === 'string' ? Date.parse(s.updatedAt) : current.createdAt;
      if ((current.status === 'running' || current.status === 'queued') && now() - lastProgress > STALE_BUILD_MS) {
        return stale(current, 'The Build Runner did not finish this build (no progress for 10 min). Build again.');
      }
      return current;
    }
    // No status yet: still queued (the runner has not taken the request).
    if (now() - b.createdAt > STALE_BUILD_MS) return stale(b, `The Build Runner did not take this build in 10 min. ${await waitingReason()}`);
    if (now() - b.createdAt > RUNNER_WAIT_MS && existsSync(join(buildQueueDir, 'requests', `${b.id}.json`))) return { ...b, reason: await waitingReason() };
    return b;
  }

  api.post<VersionParams>('/courses/:courseId/versions/:versionId/mbz', async (req, reply) => {
    const { course, version, lib } = versionOf(req);
    if (version.format !== 'scorm12') throw new ApiError('MBZ_NOT_SUPPORTED', 'Only a SCORM 1.2 version can be built as a Moodle backup (.mbz).');
    const latest = latestBuild(db, lib, version.id);
    if (latest) await refresh(latest);
    // A-T8-04 (contract §11): a timed-out build does not count. The time-out runs only when a build is read, so apply it
    // (and any runner status) to every active build of the library first; a held build stays active (the runner
    // updates its status every 30 s).
    for (const other of activeBuilds(db, lib)) await refresh(other);
    // C-T8-01: re-check and reserve synchronously, with no await until createBuild. Another request may have
    // reserved a build while refresh read its status; the queue file is written only after this slot is held.
    const current = latestBuild(db, lib, version.id);
    if (current && (current.status === 'queued' || current.status === 'running')) return reply.code(202).send(buildJson(current));
    if (activeBuildCount(db, lib) >= MAX_ACTIVE_BUILDS_PER_LIBRARY) {
      throw new ApiError('MBZ_BUILD_LIMIT', `${MAX_ACTIVE_BUILDS_PER_LIBRARY} builds of your library wait or run. Build again when one has ended.`);
    }
    const pkg = db.prepare('SELECT sha256 FROM package WHERE id = ? AND library_id = ?').get(version.packageId, lib);
    if (!pkg || !/^[0-9a-f]{64}$/.test(String(pkg.sha256))) throw new ApiError('NOT_FOUND', 'The package of this version is missing.');
    const id = newBuildId();
    const b = createBuild(db, { id, libraryId: lib, courseId: course.id, versionId: version.id }, now());
    const request = {
      buildId: id, courseId: course.id, versionId: version.id, packageSha256: String(pkg.sha256), variant: course.variant || 'default',
      lang: course.lang || 'en', title: [...course.title].map((ch) => (ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f ? ' ' : ch)).join('').slice(0, 255),
      hold: deps.buildKnobs.hold, failAt: deps.buildKnobs.failAt,
    };
    // Atomic: the runner only takes complete files (bld_<hex>.json).
    const file = join(buildQueueDir, 'requests', `${id}.json`);
    try {
      await writeFile(`${file}.tmp`, JSON.stringify(request), { mode: 0o600 });
      await rename(`${file}.tmp`, file);
    } catch (error) {
      stale(b, 'The build request could not be written. Build again.');
      throw error;
    }
    return reply.code(202).send(buildJson(b));
  });

  api.get<VersionParams>('/courses/:courseId/versions/:versionId/mbz', async (req) => {
    const { version, lib } = versionOf(req);
    const b = latestBuild(db, lib, version.id);
    if (!b) throw new ApiError('NOT_FOUND', 'No .mbz build for this version yet.');
    return buildJson(await refresh(b));
  });
}
