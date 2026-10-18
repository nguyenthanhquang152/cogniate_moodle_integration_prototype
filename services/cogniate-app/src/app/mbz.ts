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
import { applyRunnerStatus, createBuild, latestBuild, newBuildId } from '../domain/mbz-builds.ts';
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
/** A request that the runner has not taken after this time: the portal says how to start the runner. */
const RUNNER_WAIT_MS = 60_000;

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

  /** Read the runner's status file into the row; a request that waits too long gets a hint. */
  async function refresh(b: MbzBuild): Promise<MbzBuild> {
    if (b.status === 'ready' || b.status === 'failed') return b;
    try {
      const s = JSON.parse(await readFile(join(buildQueueDir, 'status', `${b.id}.json`), 'utf8')) as Record<string, unknown>;
      if (typeof s.status === 'string' && STATUSES.has(s.status)) {
        applyRunnerStatus(db, b.id, {
          status: s.status as BuildStatus, step: typeof s.step === 'string' ? s.step.slice(0, 32) : null,
          reason: typeof s.reason === 'string' && s.reason !== '' ? s.reason.slice(0, 300) : null, bytes: typeof s.bytes === 'number' ? s.bytes : null,
          finishedAt: typeof s.finishedAt === 'string' ? Date.parse(s.finishedAt) || now() : null,
        }, now());
      }
    } catch {
      // No status yet: still queued.
      if (now() - b.createdAt > RUNNER_WAIT_MS && existsSync(join(buildQueueDir, 'requests', `${b.id}.json`))) {
        return { ...b, reason: 'Waiting for the Build Runner. It starts with npm run stack:up, or run npm run build-runner.' };
      }
    }
    return latestBuild(db, b.libraryId, b.versionId) ?? b;
  }

  api.post<VersionParams>('/courses/:courseId/versions/:versionId/mbz', async (req, reply) => {
    const { course, version, lib } = versionOf(req);
    if (version.format !== 'scorm12') throw new ApiError('MBZ_NOT_SUPPORTED', 'Only a SCORM 1.2 version can be built as a Moodle backup (.mbz).');
    const current = latestBuild(db, lib, version.id);
    if (current && (current.status === 'queued' || current.status === 'running')) return reply.code(202).send(buildJson(await refresh(current)));
    const pkg = db.prepare('SELECT sha256 FROM package WHERE id = ? AND library_id = ?').get(version.packageId, lib);
    if (!pkg || !/^[0-9a-f]{64}$/.test(String(pkg.sha256))) throw new ApiError('NOT_FOUND', 'The package of this version is missing.');
    const id = newBuildId();
    const request = {
      buildId: id, courseId: course.id, versionId: version.id, packageSha256: String(pkg.sha256), variant: course.variant || 'default',
      lang: course.lang || 'en', title: [...course.title].map((ch) => (ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f ? ' ' : ch)).join('').slice(0, 255),
      hold: deps.buildKnobs.hold, failAt: deps.buildKnobs.failAt,
    };
    // Atomic: the runner only takes complete files (bld_<hex>.json).
    const file = join(buildQueueDir, 'requests', `${id}.json`);
    await writeFile(`${file}.tmp`, JSON.stringify(request), { mode: 0o600 });
    await rename(`${file}.tmp`, file);
    const b = createBuild(db, { id, libraryId: lib, courseId: course.id, versionId: version.id }, now());
    return reply.code(202).send(buildJson(b));
  });

  api.get<VersionParams>('/courses/:courseId/versions/:versionId/mbz', async (req) => {
    const { version, lib } = versionOf(req);
    const b = latestBuild(db, lib, version.id);
    if (!b) throw new ApiError('NOT_FOUND', 'No .mbz build for this version yet.');
    return buildJson(await refresh(b));
  });
}
