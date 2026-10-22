import type { PortContext, PublicationView, PublishHook } from '../../../../services/cogniate-app/src/kernel/ports.ts';
import { createMoodleWsClient, MoodleWsError } from './web-service-client.ts';

const shellIdnumber = (p: PublicationView): string => `cogniate:${p.courseId}:${p.courseVariant || 'default'}:${p.courseLang || 'en'}`;
function setShell(ctx: PortContext, id: string, shell: { courseId: number | null; idnumber: string; status: string; error: string | null }): void {
  ctx.sql.run(`UPDATE publication SET moodle_course_id = :course_id, moodle_course_idnumber = :idnumber,
    shell_status = :status, shell_error = :error, updated_at = :now
    WHERE publication.id = :id AND publication.connection_id IN
      (SELECT connection.id FROM connection WHERE connection.library_id = :library_id AND connection.id = :connection_id)`, {
    id, course_id: shell.courseId, idnumber: shell.idnumber, status: shell.status, error: shell.error, now: ctx.now(),
  });
}

export const courseShellHook: PublishHook = {
  option: 'createMoodleCourse', capability: 'publish.createCourse',
  parseOptions(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, fields: ['createMoodleCourse'] };
    const { categoryId } = value as { categoryId?: unknown };
    if (categoryId !== undefined && (typeof categoryId !== 'number' || !Number.isInteger(categoryId) || categoryId <= 0)) {
      return { ok: false, fields: ['createMoodleCourse.categoryId'] };
    }
    return { ok: true, options: { categoryId: categoryId ?? 1 } };
  },
  async afterPublish(p, options, ctx) {
    const idnumber = shellIdnumber(p);
    const ws = ctx.sql.get<{ ws_token_encrypted: Uint8Array | null }>(
      'SELECT ws_token_encrypted FROM connection WHERE library_id = :library_id AND id = :connection_id');
    if (!ws?.ws_token_encrypted) {
      setShell(ctx, p.id, { courseId: null, idnumber, status: 'failed', error: 'The connection has no web services token.' });
      return;
    }
    try {
      const token = await ctx.unseal(ws.ws_token_encrypted);
      const client = createMoodleWsClient({ outbound: ctx.outbound });
      const found = await client.courseByIdnumber(p.siteUrl, token, idnumber, ctx.traceId);
      if (found) return setShell(ctx, p.id, { courseId: found.id, idnumber, status: 'exists', error: null });
      const { categoryId } = options as { categoryId: number };
      const id = await client.createCourse(p.siteUrl, token, { fullname: p.courseTitle.slice(0, 254), shortname: idnumber, idnumber, categoryId }, ctx.traceId);
      setShell(ctx, p.id, { courseId: id, idnumber, status: 'created', error: null });
    } catch (err) {
      const reason = err instanceof MoodleWsError ? `Moodle web services: ${err.errorcode}` : `Internal error (${(err as Error).name})`;
      setShell(ctx, p.id, { courseId: null, idnumber, status: 'failed', error: reason });
    }
  },
  dtoFields(p, ctx) {
    const row = ctx.sql.get<{ moodle_course_id: number | null; moodle_course_idnumber: string | null; shell_status: string | null; shell_error: string | null }>(
      `SELECT p.moodle_course_id, p.moodle_course_idnumber, p.shell_status, p.shell_error FROM publication p
       JOIN connection c ON c.id = p.connection_id WHERE c.library_id = :library_id AND c.id = :connection_id AND p.id = :id`, { id: p.id });
    return {
      moodleCourse: row !== undefined && row.moodle_course_id !== null ? { id: row.moodle_course_id, idnumber: row.moodle_course_idnumber, url: `${p.siteUrl}/course/view.php?id=${row.moodle_course_id}` } : null,
      shellStatus: row?.shell_status ?? null, shellError: row?.shell_error ?? null,
    };
  },
};
