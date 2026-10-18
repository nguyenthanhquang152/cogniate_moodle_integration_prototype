// Publications (app contract §5, without results): offer a course to a connected Moodle site. One publication per
// connection + course. Every id is checked against the session user's library (404 NOT_FOUND).
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getConnection } from '../domain/connections.ts';
import { getCourse, getVersion, latestVersion } from '../domain/courses.ts';
import type { Db } from '../domain/db.ts';
import { launchStats } from '../domain/launch.ts';
import { outcomeStats, publicationResults } from '../domain/results.ts';
import type { Publication } from '../domain/publications.ts';
import { getPublication, listPublications, upsertPublication, withdrawPublication } from '../domain/publications.ts';
import { ApiError } from './api-errors.ts';

const iso = (ms: number): string => new Date(ms).toISOString();

export function publicationJson(db: Db, p: Publication) {
  const { activities, learners } = launchStats(db, p);
  const { inProgress, completed, passed, failed, lastScoreSync } = outcomeStats(db, p);
  return {
    id: p.id, connectionId: p.connectionId, courseId: p.courseId, courseTitle: p.courseTitle, versionId: p.versionId, version: p.version,
    format: p.format, status: p.status,
    // activities and learners (T4b2); outcome counts by each learner's best outcome and the last sent sync (T5a).
    stats: { activities, learners, inProgress, completed, passed, failed, lastScoreSync },
    createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt),
  };
}

const PublicationCreate = z.object({ connectionId: z.string().min(1).max(64), courseId: z.string().min(1).max(64), versionId: z.string().min(1).max(64).optional() });
const PublicationQuery = z.object({ connectionId: z.string().max(64).optional(), courseId: z.string().max(64).optional() });

type IdParams = { Params: { id: string } };

export function registerPublicationRoutes(api: FastifyInstance, deps: { db: Db; now: () => number }): void {
  const { db, now } = deps;
  const libraryId = (req: FastifyRequest): string => req.auth!.signedIn.library.id;
  const notFound = (what: string) => new ApiError('NOT_FOUND', `The ${what} does not exist in your library.`);

  api.post('/publications', async (req, reply) => {
    const body = PublicationCreate.safeParse(req.body ?? {});
    if (!body.success) throw new ApiError('INVALID_REQUEST', `Invalid field: ${body.error.issues[0]?.path.join('.') || 'body'}.`);
    const lib = libraryId(req);
    const connection = getConnection(db, lib, body.data.connectionId);
    if (!connection) throw notFound('connection');
    const course = getCourse(db, lib, body.data.courseId);
    if (!course) throw notFound('course');
    if (connection.status !== 'registered' && connection.status !== 'connected') {
      throw new ApiError('CONNECTION_NOT_READY', 'The connection is not registered yet. Finish the registration in Moodle first.');
    }
    const version = body.data.versionId !== undefined ? getVersion(db, lib, course.id, body.data.versionId) : latestVersion(db, lib, course.id);
    if (body.data.versionId !== undefined && !version) throw notFound('course version');
    if (!version) throw new ApiError('VERSION_NOT_READY', 'The course has no uploaded version yet.');
    const { publication, created } = upsertPublication(db, lib, { connectionId: connection.id, courseId: course.id, versionId: version.id }, now());
    return reply.code(created ? 201 : 200).send(publicationJson(db, publication));
  });

  api.get('/publications', async (req) => {
    const q = PublicationQuery.safeParse(req.query ?? {});
    if (!q.success) throw new ApiError('INVALID_REQUEST', 'Invalid query.');
    const filter = Object.fromEntries(Object.entries(q.data).filter(([, v]) => v !== undefined)) as { connectionId?: string; courseId?: string };
    return { publications: listPublications(db, libraryId(req), filter).map((x) => publicationJson(db, x)) };
  });

  api.get<IdParams>('/publications/:id', async (req) => {
    const p = getPublication(db, libraryId(req), req.params.id);
    if (!p) throw notFound('publication');
    return publicationJson(db, p);
  });

  // T5a: one row per learner per activity, with best, attempts and every score sync (app contract §5, H5).
  api.get<IdParams>('/publications/:id/results', async (req) => {
    const p = getPublication(db, libraryId(req), req.params.id);
    if (!p) throw notFound('publication');
    return { rows: publicationResults(db, p) };
  });

  api.post<IdParams>('/publications/:id/withdraw', async (req) => {
    const p = withdrawPublication(db, libraryId(req), req.params.id, now());
    if (!p) throw notFound('publication');
    return publicationJson(db, p);
  });
}
