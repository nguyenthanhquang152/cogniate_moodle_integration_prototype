// Courses and course versions (contract cogniate-app-api §3). Every lookup uses the session user's library:
// a course of another library gives 404 NOT_FOUND, for reads and writes.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { Course } from '../domain/courses.ts';
import { createCourse, getCourse, getVersion, latestVersion, listCourses, listVersions } from '../domain/courses.ts';
import { latestReadyBuild } from '../domain/mbz-builds.ts';
import { listPublications } from '../domain/publications.ts';
import { mbzPath } from './mbz.ts';
import { ApiError } from './api-errors.ts';
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

/** buildQueueDir (T8): the Build Runner queue, for download?kind=mbz. */
export function registerCourseRoutes(api: FastifyInstance, deps: UploadDeps & { buildQueueDir?: string }): void {
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
    if (req.query.kind === 'mbz') {
      // T8: the newest ready Moodle backup of this version (built by the host-side Build Runner).
      const build = latestReadyBuild(db, course.libraryId, version.id);
      if (!build || !deps.buildQueueDir) throw new ApiError('NOT_FOUND', 'No ready .mbz for this version. Build it first.');
      try {
        const file = await open(mbzPath(deps.buildQueueDir, build.id), 'r');
        return reply.type('application/vnd.moodle.backup').header('content-disposition', `attachment; filename="cogniate-course-v${version.version}.mbz"`)
          .send(file.createReadStream());
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw notFound();
        throw error;
      }
    }
    if (req.query.kind !== 'original') throw new ApiError('INVALID_REQUEST', 'Use kind=original (the uploaded zip) or kind=mbz (the Moodle backup).');
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
