// T5b: results refresh and the log check over the whole T5 run. Runs last (file name order).
// Source: tasks/T5b.md AC-T5-18, AC-T5-19; contract cogniate-app-api.md §5 (refresh: gradebook per row), §12 ("No
// secret in any field").
// AC-T5-18 (d7a88ec): every row's gradebook.resultScore equals the Moodle grade (QA oracle), resultMaximum 100.
// Expected for "Cogniate SCORM": cg_student 100, cg_student2 100; for "Cogniate SCORM AC-T5-33": 50 with gradebookDiffers.
import fs from 'node:fs';
import { capturedSecrets } from '../lib/lti';
import { logFile } from '../lib/logs';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import { newStackContext } from '../lib/moodle-launch';
import { ACT, addPickedActivity, course101, driveCourse, moodleGrade, moodleShown, openPlayer, packageFrame, refreshResults, rowsFor, runtimeState, saveT5, t5, waitForMoodle } from '../lib/t5';

// B-T5b-01 (Reviewer-B): a scores[0] fallback could store another learner's grade. QA's own activity: cg_student has a
// Moodle grade, cg_student2 has a row (in_progress) but no Moodle grade; after Refresh, cg_student2 must keep null.
test('AC-T5-18 (B-T5b-01) Refresh from Moodle never stores another learner\'s grade: a learner without a Moodle grade keeps resultScore null; every HTML row = the Moodle grade', async ({ browser }) => {
  test.setTimeout(360_000);
  const st = t5();
  const name = 'Cogniate HTML B-T5b-01';
  const s1 = seed().users.cg_student;
  const s2 = seed().users.cg_student2;
  const context = await newStackContext(browser);
  try {
    const cmid = st.cmids?.[name] ?? (await addPickedActivity(context, seed().users.cg_teacher, course101(), Number(st.typeId), String(st.html?.title), name));
    saveT5({ cmids: { ...(t5().cmids ?? {}), [name]: cmid } });
    const a = await openPlayer(context, s1, cmid);
    await driveCourse(a, { answer: 'correct' });
    expect((await waitForMoodle(course101(), s1, name, 100)).grade, 'cg_student has 100 in Moodle').toBe(100);
    await a.popup.close({ runBeforeUnload: true });
    const b = await openPlayer(context, s2, cmid);
    await packageFrame(b, 'index.html');
    await expect.poll(async () => (await runtimeState(b.token)).json?.lastSeq ?? 0, { timeout: 20_000 }).toBeGreaterThan(0);
    await b.popup.close({ runBeforeUnload: true });
    expect((await moodleGrade(course101(), s2, name)) ?? null, 'cg_student2 has no Moodle grade').toBeNull();

    const res = await refreshResults(String(st.htmlPublicationId));
    expect(res.status, res.body.slice(0, 200)).toBe(200);
    const rowA = rowsFor(res.rows, s1, name)[0];
    const rowB = rowsFor(res.rows, s2, name)[0];
    expect(rowB, 'cg_student2 has a row (in_progress)').toBeDefined();
    expect(rowA?.gradebook?.resultScore, 'cg_student: 100').toBe(100);
    expect(rowB?.gradebook?.resultScore ?? null, "cg_student2: null, not cg_student's grade").toBeNull();

    // Every row of the HTML publication equals that learner's Moodle grade (the right course per activity).
    const c102 = seed().courses['COGNIATE-DEV-102'];
    const problems: string[] = [];
    for (const row of res.rows.filter((r) => !r.preview)) {
      const user = [s1, s2].find((u) => String(u.id) === row.learner.sub);
      if (!user) continue;
      const courseId = row.activity.title === ACT.html102 || /AC-T6-14/.test(row.activity.title) ? c102 : course101();
      const want = (await moodleShown(courseId, user, row.activity.title))?.shown ?? null;
      const got = row.gradebook?.resultScore ?? null;
      if (got !== want) problems.push(`${user.username} / ${row.activity.title}: gradebook ${got}, Moodle ${want}`);
    }
    test.info().annotations.push({ type: 'rows', description: res.rows.map((r) => `${r.learner.sub}/${r.activity.title}: ${r.gradebook?.resultScore ?? 'null'}`).join('; ').slice(0, 2000) });
    expect(problems).toEqual([]);
  } finally {
    await context.close();
  }
});

test('AC-T5-18 Refresh from Moodle: every row of the SCORM publication has gradebook.resultScore = the Moodle grade (resultMaximum 100); Cogniate SCORM 100/100; AC-T5-33 activity 50 with gradebookDiffers', async () => {
  test.setTimeout(180_000);
  const st = t5();
  const res = await refreshResults(String(st.scormPublicationId));
  expect(res.status, res.body.slice(0, 200)).toBe(200);
  const learners = [seed().users.cg_student, seed().users.cg_student2];
  const problems: string[] = [];
  let checked = 0;
  for (const row of res.rows.filter((r) => !r.preview)) {
    const user = learners.find((u) => String(u.id) === row.learner.sub);
    if (!user) continue;
    const moodle = await moodleShown(course101(), user, row.activity.title);
    const want = moodle?.shown ?? null;
    const got = row.gradebook?.resultScore ?? null;
    checked++;
    if (got !== want) problems.push(`${user.username} / ${row.activity.title}: gradebook.resultScore ${got}, Moodle ${want}`);
    if (want !== null && row.gradebook?.resultMaximum !== 100) problems.push(`${user.username} / ${row.activity.title}: resultMaximum ${row.gradebook?.resultMaximum}`);
  }
  expect(checked, 'learner rows checked').toBeGreaterThan(0);
  const named = (u: (typeof learners)[number], title: string) => rowsFor(res.rows, u, title)[0];
  expect(named(learners[0], ACT.scorm)?.gradebook?.resultScore, 'cg_student, Cogniate SCORM').toBe(100);
  expect(named(learners[1], ACT.scorm)?.gradebook?.resultScore, 'cg_student2, Cogniate SCORM (AC-T5-23 raised it from 0)').toBe(100);
  if (st.ran?.['AC-T5-33']) {
    const o = named(learners[1], ACT.scormOverride);
    expect(o?.gradebook?.resultScore, `cg_student2, ${ACT.scormOverride}`).toBe(50);
    expect(o?.gradebookDiffers).toBe(true);
  }
  test.info().annotations.push({ type: 'rows', description: res.rows.map((r) => `${r.learner.sub}/${r.activity.title}: ${r.gradebook?.resultScore ?? 'null'}${r.gradebookDiffers ? ' (differs)' : ''}`).join('; ') });
  expect(problems).toEqual([]);
});

test('AC-T5-19 cogniate-app.jsonl and cogniate-content.jsonl contain no runtime token, ltik or service key captured in this run', () => {
  const secrets = capturedSecrets().filter((s) => ['runtime_token', 'ltik', 'service_key'].includes(s.kind));
  const kinds = new Set(secrets.map((s) => s.kind));
  expect([...kinds].sort(), 'kinds of captured values').toEqual(expect.arrayContaining(['ltik', 'runtime_token']));
  const leaks: string[] = [];
  for (const service of ['cogniate-app', 'cogniate-content']) {
    const file = logFile(service);
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    expect(text.length, `${service} log exists`).toBeGreaterThan(0);
    for (const s of secrets) if (text.includes(s.value)) leaks.push(`${service}: a ${s.kind} (${s.value.slice(0, 6)}…, ${s.value.length} chars)`);
  }
  test.info().annotations.push({ type: 'checked', description: `${secrets.length} values (${[...kinds].join(', ')})` });
  expect(leaks).toEqual([]);
});
