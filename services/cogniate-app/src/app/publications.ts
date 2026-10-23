// Publications (app contract §5, without results): offer a course to a connected Moodle site. One publication per
// connection + course. Every id is checked against the session user's library (404 NOT_FOUND).
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { decrypt } from '@cogniate/shared';
import { z } from 'zod';
import type { MoodleWsClient } from '../clients/moodle-ws.ts';
import { MoodleWsError } from '../clients/moodle-ws.ts';
import { getConnection, webServicesOf } from '../domain/connections.ts';
import { getCourse, getVersion, latestVersion } from '../domain/courses.ts';
import type { Db } from '../domain/db.ts';
import { launchStats } from '../domain/launch.ts';
import { outcomeStats } from '../domain/results.ts';
import type { Publication } from '../domain/publications.ts';
import { getPublication, listPublications, setShell, upsertPublication, withdrawPublication } from '../domain/publications.ts';
import { capabilitiesOf, lmsNameOf } from '../providers/index.ts';
import { ApiError } from './api-errors.ts';

const iso = (ms: number): string => new Date(ms).toISOString();

export function publicationJson(db: Db, p: Publication) {
  const { activities, learners } = launchStats(db, p);
  const { inProgress, completed, passed, failed, lastScoreSync } = outcomeStats(db, p);
  return {
    id: p.id, connectionId: p.connectionId, courseId: p.courseId, courseTitle: p.courseTitle, versionId: p.versionId, version: p.version,
    format: p.format, status: p.status,
    // M1 (§5.1)
    lms: p.lms, connectionName: p.connectionName,
    // activities and learners (T4b2); outcome counts by each learner's best outcome and the last sent sync (T5a).
    stats: { activities, learners, inProgress, completed, passed, failed, lastScoreSync },
    createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt),
    // T8 course shell: set when the publish asked for createMoodleCourse.
    moodleCourse: p.moodleCourseId !== null ? { id: p.moodleCourseId, idnumber: p.moodleCourseIdnumber, url: `${p.siteUrl}/course/view.php?id=${p.moodleCourseId}` } : null,
    shellStatus: p.shellStatus, shellError: p.shellError,
  };
}

/** The course shell idnumber (app contract §11): cogniate:{courseId}:{variant}:{lang}. */
export const shellIdnumber = (p: { courseId: string; courseVariant: string; courseLang: string }): string => `cogniate:${p.courseId}:${p.courseVariant || 'default'}:${p.courseLang || 'en'}`;

const PublicationCreate = z.object({
  connectionId: z.string().min(1).max(64), courseId: z.string().min(1).max(64), versionId: z.string().min(1).max(64).optional(),
  // T8: also make an empty, hidden Moodle course (needs the connection's web services token).
  createMoodleCourse: z.object({ categoryId: z.number().int().positive().optional() }).optional(),
});
const PublicationQuery = z.object({ connectionId: z.string().max(64).optional(), courseId: z.string().max(64).optional() });

type IdParams = { Params: { id: string } };

export function registerPublicationRoutes(api: FastifyInstance, deps: { db: Db; now: () => number; masterKey?: Buffer; moodleWs?: MoodleWsClient }): void {
  const { db, now } = deps;

  /**
   * T8 course shell: find the course by idnumber (exists) or make it hidden (created). A failure does not stop the
   * publish: the publication shows shellStatus failed with the reason.
   */
  async function makeShell(lib: string, p: Publication, categoryId: number, traceId: string): Promise<void> {
    const idnumber = shellIdnumber(p);
    const ws = webServicesOf(db, lib, p.connectionId);
    if (!ws || !deps.masterKey || !deps.moodleWs) {
      setShell(db, p.id, { moodleCourseId: null, idnumber, status: 'failed', error: 'The connection has no web services token.' }, now());
      return;
    }
    try {
      const token = decrypt(deps.masterKey, ws.tokenEncrypted);
      const found = await deps.moodleWs.courseByIdnumber(p.siteUrl, token, idnumber, traceId);
      if (found) return setShell(db, p.id, { moodleCourseId: found.id, idnumber, status: 'exists', error: null }, now());
      const id = await deps.moodleWs.createCourse(p.siteUrl, token, { fullname: p.courseTitle.slice(0, 254), shortname: idnumber, idnumber, categoryId }, traceId);
      setShell(db, p.id, { moodleCourseId: id, idnumber, status: 'created', error: null }, now());
    } catch (err) {
      const reason = err instanceof MoodleWsError ? `Moodle web services: ${err.errorcode}` : `Internal error (${(err as Error).name})`;
      setShell(db, p.id, { moodleCourseId: null, idnumber, status: 'failed', error: reason }, now());
    }
  }
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
    // M1 (§4.7.2): the course shell is a Moodle capability; nothing is stored when it is missing.
    if (body.data.createMoodleCourse && !capabilitiesOf(connection.lms).courseShell) {
      throw new ApiError('CAPABILITY_NOT_SUPPORTED', 'Only a Moodle connection can create a Moodle course.', { details: { capability: 'courseShell' } });
    }
    if (connection.status !== 'registered' && connection.status !== 'connected') {
      throw new ApiError('CONNECTION_NOT_READY', `The connection is not registered yet. Finish the registration in ${lmsNameOf(connection.lms)} first.`);
    }
    const version = body.data.versionId !== undefined ? getVersion(db, lib, course.id, body.data.versionId) : latestVersion(db, lib, course.id);
    if (body.data.versionId !== undefined && !version) throw notFound('course version');
    if (!version) throw new ApiError('VERSION_NOT_READY', 'The course has no uploaded version yet.');
    const { publication, created } = upsertPublication(db, lib, { connectionId: connection.id, courseId: course.id, versionId: version.id }, now());
    if (body.data.createMoodleCourse) await makeShell(lib, publication, body.data.createMoodleCourse.categoryId ?? 1, req.traceId);
    return reply.code(created ? 201 : 200).send(publicationJson(db, getPublication(db, lib, publication.id) ?? publication));
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

  api.post<IdParams>('/publications/:id/withdraw', async (req) => {
    const p = withdrawPublication(db, libraryId(req), req.params.id, now());
    if (!p) throw notFound('publication');
    return publicationJson(db, p);
  });
}
