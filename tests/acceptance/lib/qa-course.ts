// A QA-owned course for one test: a blank SCO course (lib/t5.ts blankScoZip), published to Thanh's connection, and a
// deep-linked activity in COGNIATE-DEV-101 (cg_teacher, the content picker). Commits are QA's own (lib/t5.ts).
import crypto from 'node:crypto';
import type { BrowserContext } from '@playwright/test';
import { appApi, createCourse, uploadVersion } from './app';
import { seed } from './seed';
import { addPickedActivity, blankScoZip, course101, t5, thanhSession } from './t5';

export interface QaCourse {
  courseId: string;
  title: string;
  versionId: string;
  publicationId: string;
  activity: string;
  cmid: number;
}

export async function qaBlankActivity(context: BrowserContext, label: string, moodleCourseId = course101()): Promise<QaCourse> {
  const st = t5();
  const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
  const thanh = await thanhSession();
  const title = `QA ${label} ${runId}`;
  const course = await createCourse(thanh, title);
  const up = await uploadVersion(thanh, course.id, blankScoZip());
  if (up.status !== 201) throw new Error(`upload: HTTP ${up.status} ${up.body.slice(0, 200)}`);
  const pub = await appApi<{ id: string }>('POST', '/app-api/publications', { cookie: thanh.cookie, body: { connectionId: st.connectionId, courseId: course.id } });
  if (pub.status !== 201) throw new Error(`publish: HTTP ${pub.status} ${pub.body.slice(0, 200)}`);
  const activity = `Cogniate SCORM ${label} ${runId}`;
  const cmid = await addPickedActivity(context, seed().users.cg_teacher, moodleCourseId, Number(st.typeId), title, activity);
  return { courseId: course.id, title, versionId: String((up.json as { id?: string }).id ?? ''), publicationId: pub.json.id, activity, cmid };
}

/** A new version (blank SCO again) of the QA course, published: the next launch starts a new attempt on it. */
export async function publishNewVersion(c: QaCourse): Promise<string> {
  const thanh = await thanhSession();
  const up = await uploadVersion(thanh, c.courseId, blankScoZip());
  if (up.status !== 201) throw new Error(`upload v2: HTTP ${up.status} ${up.body.slice(0, 200)}`);
  const versionId = String((up.json as { id?: string }).id ?? '');
  const pub = await appApi<{ versionId: string }>('POST', '/app-api/publications', { cookie: thanh.cookie, body: { connectionId: t5().connectionId, courseId: c.courseId, versionId } });
  if (pub.status !== 200 || pub.json.versionId !== versionId) throw new Error(`publish v2: HTTP ${pub.status} ${pub.body.slice(0, 200)}`);
  return versionId;
}
