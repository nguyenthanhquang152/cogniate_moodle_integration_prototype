// T5b: results refresh and the log check over the whole T5 run. Runs last (file name order).
// Source: tasks/T5b.md AC-T5-18, AC-T5-19; contract cogniate-app-api.md §5 (refresh: gradebook per row), §12 ("No
// secret in any field").
// AC-T5-18: "the rows of AC-T5-07 and AC-T5-08 have resultScore 100 and 0 (or the override value where AC-T5-33 ran)".
// In this run AC-T5-23 raised cg_student2's "Cogniate SCORM" grade to 100, and AC-T5-33 ran on its own activity, so
// QA expects 100 for cg_student2 when AC-T5-23 ran (spec note to the Architect).
import fs from 'node:fs';
import { capturedSecrets } from '../lib/lti';
import { logFile } from '../lib/logs';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import { ACT, refreshResults, rowsFor, t5 } from '../lib/t5';

test('AC-T5-18 Refresh from Moodle: the rows of AC-T5-07 and AC-T5-08 have gradebook.resultScore (100 and the current Moodle value) and resultMaximum 100', async () => {
  test.setTimeout(120_000);
  const st = t5();
  const res = await refreshResults(String(st.scormPublicationId));
  expect(res.status, res.body.slice(0, 200)).toBe(200);
  const r07 = rowsFor(res.rows, seed().users.cg_student, ACT.scorm)[0];
  const r08 = rowsFor(res.rows, seed().users.cg_student2, ACT.scorm)[0];
  expect(r07?.gradebook, JSON.stringify(r07)).toMatchObject({ resultScore: 100, resultMaximum: 100 });
  const want08 = st.ran?.['AC-T5-23'] ? 100 : 0;
  expect(r08?.gradebook, JSON.stringify(r08)).toMatchObject({ resultScore: want08, resultMaximum: 100 });
  test.info().annotations.push({ type: 'expected', description: `cg_student 100; cg_student2 ${want08} (AC-T5-23 ran: ${Boolean(st.ran?.['AC-T5-23'])})` });
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
