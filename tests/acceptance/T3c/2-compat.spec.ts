// T3c: AC-T3-27, the independent client. Source: tasks/T3c.md AC-T3-27 and "Compat container" (infra/README.md,
// "Compat runner"); contract lti-service-api.md §8 (differences from the public LTIAAS API).
// QA captures one real cg_student launch ltik and one real cg_teacher deep-linking ltik, writes them with the expected
// values into an input file, and asks the host runner (tests/host/run-t3c.mjs) to run `npm run test:compat` with that
// file. The compat container runs tests/compat/run.py: the ltiaas 0.0.4 Python SDK against PUBLIC_LTI_URL with the
// cogniate API key. This test reads the run's result line (QA_COMPAT_RESULT) and lists each check.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CONTROL_DIR, hostAction } from '../lib/host-control';
import { publicUrls } from '../lib/env';
import { loadState, ltiSeed } from '../lib/lti';
import { deepLinkActivity } from '../lib/moodle-dl';
import { launchActivity, newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();

interface CompatCheck {
  check: string;
  ok: boolean;
  detail: string;
}

test('AC-T3-27 independent client: the ltiaas 0.0.4 SDK reads the ID token, builds a deep-linking form and message, posts and reads a score, lists memberships; every call 2xx and every field it reads exists', async ({ browser }) => {
  test.setTimeout(900_000);
  const cmid = Number(loadState('T3a').cmid ?? 0);
  expect(cmid, 'T3a made the activity "QA DL"').toBeGreaterThan(0);
  const s = seed();
  const course = s.courses['COGNIATE-DEV-101'];
  const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
  const context = await newStackContext(browser);
  let input = '';
  try {
    const launch = await launchActivity(context, s.users.cg_student, cmid);
    const studentLtik = String(launch.ltik ?? '');
    expect(studentLtik, 'cg_student launch ltik').toMatch(/^[A-Za-z0-9_-]{43}$/);
    const title = `QA compat DL ${runId}`;
    const dl = await deepLinkActivity(context, s.users.cg_teacher, course, ltiSeed().typeId, [{ type: 'ltiResourceLink', title, url: `${urls.lti}/lti/launch/cogniate?resource=qa-compat` }], { save: false });
    const deepLinkLtik = String(dl.ltik ?? '');
    expect(deepLinkLtik, 'cg_teacher deep-linking ltik').toMatch(/^[A-Za-z0-9_-]{43}$/);

    const dir = CONTROL_DIR();
    fs.mkdirSync(dir, { recursive: true });
    input = `compat-input-${runId}.json`;
    fs.writeFileSync(
      path.join(dir, input),
      JSON.stringify({
        format: 'qa-compat-input/1',
        runId,
        studentLtik,
        deepLinkLtik,
        expect: {
          userId: String(s.users.cg_student.id),
          platformUrl: urls.moodle,
          contextId: String(course),
          memberIds: [s.users.cg_teacher.id, s.users.cg_student.id, s.users.cg_student2.id].map(String),
          learnerIds: [s.users.cg_student.id, s.users.cg_student2.id].map(String),
        },
      }),
      { mode: 0o600 },
    );

    const answer = await hostAction('compat-run', 840_000, { payload: { input }, allowFail: true });
    const out = answer.out ? fs.readFileSync(path.join(dir, answer.out), 'utf8') : '';
    await test.info().attach('test:compat output (redacted)', { body: out, contentType: 'text/plain' });
    const line = out.split('\n').reverse().find((l) => l.startsWith('QA_COMPAT_RESULT '));
    expect(line, `the compat run printed its result line (exit ${answer.code}); output tail: ${out.slice(-800)}`).toBeDefined();
    const result = JSON.parse(line!.slice('QA_COMPAT_RESULT '.length)) as { ok: boolean; sdk?: string; inputError?: string; checks?: CompatCheck[]; calls?: { method: string; path: string; status: number }[] };
    for (const c of result.checks ?? []) test.info().annotations.push({ type: `${c.ok ? 'PASS' : 'FAIL'} ${c.check}`, description: c.detail.slice(0, 1200) });
    test.info().annotations.push({ type: 'calls', description: (result.calls ?? []).map((c) => `${c.method} ${c.path} → ${c.status}`).join('; ').slice(0, 2000) });
    expect(result.inputError ?? null, 'input error').toBeNull();
    const failed = (result.checks ?? []).filter((c) => !c.ok).map((c) => `${c.check}: ${c.detail.slice(0, 400)}`);
    expect(failed, `${result.sdk ?? 'SDK'}: failed checks`).toEqual([]);
    expect(result.ok && answer.code === 0, `compat run exit ${answer.code}`).toBe(true);
  } finally {
    if (input) fs.rmSync(path.join(CONTROL_DIR(), input), { force: true });
    await context.close();
  }
});
