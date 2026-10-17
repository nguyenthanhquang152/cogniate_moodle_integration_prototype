// Courses and course versions (contract cogniate-app-api §3). Every lookup uses the session user's library:
// a course of another library gives 404 NOT_FOUND, for reads and writes.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Course } from '../domain/courses.ts';
import { createCourse, getCourse, getVersion, latestVersion, listCourses, listVersions } from '../domain/courses.ts';
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

export function registerCourseRoutes(api: FastifyInstance, deps: UploadDeps): void {
  const { db, now } = deps;
  const libraryOf = (req: FastifyRequest): string => req.auth!.signedIn.library.id;
  const courseOf = (req: FastifyRequest<CourseParams>): Course => {
    const course = getCourse(db, libraryOf(req), req.params.courseId);
    if (!course) throw notFound();
    return course;
  };

  api.get('/courses', async (req) => {
    const lib = libraryOf(req);
    return { courses: listCourses(db, lib).map((c) => courseJson(c, latestVersion(db, lib, c.id))) };
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
    return { ...courseJson(course, versions.at(-1)), versions: versions.map(versionJson) };
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
}
