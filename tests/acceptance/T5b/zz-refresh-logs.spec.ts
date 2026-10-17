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
import { ACT, course101, moodleShown, refreshResults, rowsFor, t5 } from '../lib/t5';

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
