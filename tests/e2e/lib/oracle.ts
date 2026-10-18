// Moodle QA oracle (web service cogniate_qa_oracle, dev/test only; infra/README.md "Moodle provisioning").
// Read-only use: grade items, activity completion, course contents.
import { callWs, gradeItems } from '../../acceptance/lib/moodle-ws';
import { type MoodleUser, seed } from '../../acceptance/lib/seed';

export const course101 = () => seed().courses['COGNIATE-DEV-101'];
export const course102 = () => seed().courses['COGNIATE-DEV-102'];
export const users = () => seed().users;

interface Module {
  id: number;
  name: string;
  modname: string;
}

export async function ltiModules(courseId: number): Promise<Module[]> {
  const sections = await callWs<{ modules: Module[] }[]>(seed().oracleToken, 'core_course_get_contents', { courseid: courseId });
  return sections.flatMap((s) => s.modules).filter((m) => m.modname === 'lti');
}

/** The newest LTI activity with this exact name. */
export async function cmidByName(courseId: number, name: string): Promise<number | undefined> {
  const mods = (await ltiModules(courseId)).filter((m) => m.name === name);
  return mods.length ? Math.max(...mods.map((m) => m.id)) : undefined;
}

export interface GradeView {
  /** Raw grade (null = no grade). */
  raw: number | null;
  /** The grade text that Moodle shows, for example "100.00" or "-". */
  shown: string;
  max: number;
}

/** The learner's grade for the activity's grade item (matched by cmid, else by name). undefined = no such item. */
export async function grade(courseId: number, user: MoodleUser, activity: { name: string; cmid?: number }): Promise<GradeView | undefined> {
  const items = await gradeItems(seed().oracleToken, courseId, user.id);
  const item = items.find((i) => i.itemmodule === 'lti' && activity.cmid !== undefined && i.cmid === activity.cmid) ?? items.find((i) => i.itemmodule === 'lti' && i.itemname === activity.name);
  if (!item) return undefined;
  return { raw: item.graderaw, shown: item.gradeformatted ?? '', max: item.grademax };
}

/** Activity completion state: 0 incomplete, 1 complete, 2 complete pass, 3 complete fail. */
export async function completion(courseId: number, user: MoodleUser, cmid: number): Promise<number | undefined> {
  const res = await callWs<{ statuses: { cmid: number; state: number }[] }>(seed().oracleToken, 'core_completion_get_activities_completion_status', {
    courseid: courseId,
    userid: user.id,
  });
  return res.statuses.find((s) => s.cmid === cmid)?.state;
}
