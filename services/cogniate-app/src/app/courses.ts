// Courses and course versions (contract cogniate-app-api §3). Every lookup uses the session user's library:
// a course of another library gives 404 NOT_FOUND, for reads and writes.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { Course } from '../domain/courses.ts';
import { createCourse, getCourse, getVersion, latestVersion, listCourses, listVersions } from '../domain/courses.ts';
import { listPublications } from '../domain/publications.ts';
import { ApiError } from './api-errors.ts';
import { DOWNLOAD_KIND_DESCRIPTION, PACKAGE_EXPORT_WIRE } from '@cogniate/channel-kernel';
import type { ExtensionDeps } from '../kernel/extensions.ts';
import { exporterOf, exporterContextOf, exportVersionView } from '../kernel/extensions.ts';
import { openExportArtifact } from '../kernel/port-context.ts';
import type { UploadDeps } from './upload.ts';
import { uploadVersion } from './upload.ts';
import { courseJson, versionJson } from './views.ts';

const CourseCreate = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(2000).optional(),
  variant: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/).optional(),
  lang: z.string().regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8}){0,3}$/).optional(),
});

type CourseParams = { Params: { courseId: string } };
type VersionParams = { Params: { courseId: string; versionId: string } };

const notFound = () => new ApiError('NOT_FOUND', 'The course or version does not exist in your library.');

/** Export downloads use the registered course-version exporters. */
export function registerCourseRoutes(api: FastifyInstance, deps: UploadDeps & { extensions: ExtensionDeps }): void {
  const { db, now } = deps;
  const libraryOf = (req: FastifyRequest): string => req.auth!.signedIn.library.id;
  const courseOf = (req: FastifyRequest<CourseParams>): Course => {
    const course = getCourse(db, libraryOf(req), req.params.courseId);
    if (!course) throw notFound();
    return course;
  };
  const withPublications = (course: Course, latest: ReturnType<typeof latestVersion>) => ({
    ...courseJson(course, latest),
    publications: listPublications(db, course.libraryId, { courseId: course.id })
      .map(({ id, connectionId, status }) => ({ id, connectionId, status })),
  });

  api.get('/courses', async (req) => {
    const lib = libraryOf(req);
    return { courses: listCourses(db, lib).map((c) => withPublications(c, latestVersion(db, lib, c.id))) };
  });

  api.post('/courses', async (req, reply) => {
    const body = CourseCreate.safeParse(req.body ?? {});
    if (!body.success) {
      const field = body.error.issues[0]?.path.join('.') || 'body';
      throw new ApiError('INVALID_REQUEST', `Invalid field: ${field}.`, { details: { field } });
    }
    const course = createCourse(db, libraryOf(req), {
      title: body.data.title, summary: body.data.summary ?? '', variant: body.data.variant ?? 'default', lang: body.data.lang ?? 'en',
    }, now());
    return reply.code(201).send(courseJson(course, undefined));
  });

  api.get<CourseParams>('/courses/:courseId', async (req) => {
    const course = courseOf(req);
    const versions = listVersions(db, course.libraryId, course.id);
    return { ...withPublications(course, versions.at(-1)), versions: versions.map(versionJson) };
  });

  // The course is checked before the body is read, so a foreign course id costs no upload.
  api.post<CourseParams>('/courses/:courseId/versions', async (req, reply) => {
    const course = courseOf(req);
    const version = await uploadVersion(req, course, deps);
    return reply.code(201).send(versionJson(version));
  });

  api.get<VersionParams>('/courses/:courseId/versions/:versionId', async (req) => {
    const course = courseOf(req);
    const version = getVersion(db, course.libraryId, course.id, req.params.versionId);
    if (!version) throw notFound();
    return versionJson(version);
  });

  api.get<VersionParams & { Querystring: { kind?: string } }>('/courses/:courseId/versions/:versionId/download', async (req, reply) => {
    const course = courseOf(req);
    const version = getVersion(db, course.libraryId, course.id, req.params.versionId);
    if (!version) throw notFound();
    if (req.query.kind !== 'original') {
      const id = req.query.kind ?? '';
      const exporter = exporterOf(deps.extensions.channels, id);
      const wire = PACKAGE_EXPORT_WIRE[id];
      if (!exporter || !wire) throw new ApiError('INVALID_REQUEST', DOWNLOAD_KIND_DESCRIPTION);
      if (!deps.extensions.buildQueueDir) throw new ApiError('NOT_FOUND', wire.missing);
      const result = await exporter.download(exportVersionView(db, course, version), exporterContextOf(deps.extensions, req));
      if (!result) throw new ApiError('NOT_FOUND', wire.missing);
      try {
        const file = await openExportArtifact(db, course.libraryId, deps.extensions.buildQueueDir, result.artifact, id);
        return reply.type(wire.mediaType).header('content-disposition', `attachment; filename="${wire.filename(version.version)}"`)
          .send(file.createReadStream());
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw notFound();
        throw error;
      }
    }
    const pkg = db.prepare('SELECT sha256 FROM package WHERE id = ? AND library_id = ?').get(version.packageId, course.libraryId);
    if (!pkg || typeof pkg.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(pkg.sha256)) throw notFound();
    try {
      const file = await open(join(deps.store.uploads, `${pkg.sha256}.zip`), 'r');
      return reply.type('application/zip').header('content-disposition', `attachment; filename="course-v${version.version}.zip"`)
        .send(file.createReadStream());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw notFound();
      throw error;
    }
  });
}
