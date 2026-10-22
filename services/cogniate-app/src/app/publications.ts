import type { ChannelRegistry } from '@cogniate/channel-kernel';
import { PUBLICATION_OPTION } from '@cogniate/channel-kernel';
// Publications (app contract §5, without results): offer a course to a connected site. One publication per
// connection + course. Every id is checked against the session user's library (404 NOT_FOUND).
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getConnection } from '../domain/connections.ts';
import { getCourse, getVersion, latestVersion } from '../domain/courses.ts';
import type { Db } from '../domain/db.ts';
import { launchStats } from '../domain/launch.ts';
import { outcomeStats } from '../domain/results.ts';
import type { Publication } from '../domain/publications.ts';
import { getPublication, listPublications, upsertPublication, withdrawPublication } from '../domain/publications.ts';
import { ApiError } from './api-errors.ts';
import type { ExtensionDeps } from '../kernel/extensions.ts';
import { guardExtension, portContextOf, publicationExtensionFields } from '../kernel/extensions.ts';
import type { PortContext } from '../kernel/ports.ts';
import { setupOf } from '../kernel/setup.ts';

const iso = (ms: number): string => new Date(ms).toISOString();

export function publicationJson(db: Db, p: Publication, channels: ChannelRegistry, ctx: PortContext) {
  const { activities, learners } = launchStats(db, p);
  const { inProgress, completed, passed, failed, lastScoreSync } = outcomeStats(db, p, channels);
  return {
    id: p.id, connectionId: p.connectionId, courseId: p.courseId, courseTitle: p.courseTitle, versionId: p.versionId, version: p.version,
    format: p.format, status: p.status,
    // M1 (§5.1)
    lms: p.channel, connectionName: p.connectionName,
    // activities and learners (T4b2); outcome counts by each learner's best outcome and the last sent sync (T5a).
    stats: { activities, learners, inProgress, completed, passed, failed, lastScoreSync },
    createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt),
    ...publicationExtensionFields(channels, p, ctx),
  };
}

const PublicationCreate = z.object({
  connectionId: z.string().min(1).max(64), courseId: z.string().min(1).max(64), versionId: z.string().min(1).max(64).optional(),
  [PUBLICATION_OPTION]: z.unknown().optional(),
});
const PublicationQuery = z.object({ connectionId: z.string().max(64).optional(), courseId: z.string().max(64).optional() });

type IdParams = { Params: { id: string } };

export function registerPublicationRoutes(api: FastifyInstance, deps: ExtensionDeps): void {
  const { db, now } = deps;
  const libraryId = (req: FastifyRequest): string => req.auth!.signedIn.library.id;
  const notFound = (what: string) => new ApiError('NOT_FOUND', `The ${what} does not exist in your library.`);

  api.post('/publications', async (req, reply) => {
    const body = PublicationCreate.safeParse(req.body ?? {});
    if (!body.success) throw new ApiError('INVALID_REQUEST', `Invalid field: ${body.error.issues[0]?.path.join('.') || 'body'}.`);
    const option = body.data[PUBLICATION_OPTION];
    const parser = deps.channels.channels().flatMap((m) => setupOf(deps.channels, m.id)?.publishHooks ?? []).find((h) => h.option === PUBLICATION_OPTION);
    const parsed = option !== undefined ? parser?.parseOptions(option) : undefined;
    if (parsed && !parsed.ok) throw new ApiError('INVALID_REQUEST', `Invalid field: ${parsed.fields[0] || 'body'}.`);
    const lib = libraryId(req);
    const connection = getConnection(db, lib, body.data.connectionId);
    if (!connection) throw notFound('connection');
    const course = getCourse(db, lib, body.data.courseId);
    if (!course) throw notFound('course');
    const hook = setupOf(deps.channels, connection.channel)?.publishHooks?.find((h) => h.option === PUBLICATION_OPTION);
    if (option !== undefined) {
      guardExtension(deps, connection.channel, parser?.capability ?? 'publish.createCourse', PUBLICATION_OPTION);
      if (!hook || !parsed?.ok) throw new ApiError('CAPABILITY_NOT_SUPPORTED');
    }
    if (connection.status !== 'registered' && connection.status !== 'connected') {
      throw new ApiError('CONNECTION_NOT_READY', `The connection is not registered yet. Finish the registration in ${deps.channels.textName(connection.channel)} first.`);
    }
    const version = body.data.versionId !== undefined ? getVersion(db, lib, course.id, body.data.versionId) : latestVersion(db, lib, course.id);
    if (body.data.versionId !== undefined && !version) throw notFound('course version');
    if (!version) throw new ApiError('VERSION_NOT_READY', 'The course has no uploaded version yet.');
    const { publication, created } = upsertPublication(db, lib, { connectionId: connection.id, courseId: course.id, versionId: version.id }, now());
    if (option !== undefined && hook && parsed?.ok) await hook.afterPublish(publication, parsed.options, portContextOf(deps, req, connection.id));
    return reply.code(created ? 201 : 200).send(publicationJson(db, getPublication(db, lib, publication.id) ?? publication, deps.channels, portContextOf(deps, req, connection.id)));
  });

  api.get('/publications', async (req) => {
    const q = PublicationQuery.safeParse(req.query ?? {});
    if (!q.success) throw new ApiError('INVALID_REQUEST', 'Invalid query.');
    const filter = Object.fromEntries(Object.entries(q.data).filter(([, v]) => v !== undefined)) as { connectionId?: string; courseId?: string };
    return { publications: listPublications(db, libraryId(req), filter).map((x) => publicationJson(db, x, deps.channels, portContextOf(deps, req, x.connectionId))) };
  });

  api.get<IdParams>('/publications/:id', async (req) => {
    const p = getPublication(db, libraryId(req), req.params.id);
    if (!p) throw notFound('publication');
    return publicationJson(db, p, deps.channels, portContextOf(deps, req, p.connectionId));
  });

  api.post<IdParams>('/publications/:id/withdraw', async (req) => {
    const p = withdrawPublication(db, libraryId(req), req.params.id, now());
    if (!p) throw notFound('publication');
    return publicationJson(db, p, deps.channels, portContextOf(deps, req, p.connectionId));
  });
}
