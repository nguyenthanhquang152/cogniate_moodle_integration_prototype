// T8 audit item C-T8-01 (Lead): parallel POST …/mbz. Source: app contract §11 ("If the newest build of this version
// still waits or runs, 202 with that build (no new build)"; "Two builds of the library already queued or running →
// 409 MBZ_BUILD_LIMIT"). Each test uses its own QA courses with a blank SCO version (fast builds) and waits until its
// builds end, so the library has no active build afterwards. Run by the "races" pass of tests/host/run-t8.mjs.
import crypto from 'node:crypto';
import { signIn, THANH } from '../lib/app';
import { expect, test } from '../lib/pw';
import { type MbzBuild, newBlankVersion, startMbz, waitMbz } from '../lib/t8';

const runId = () => `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const errCode = (json: unknown) => String(((json as { details?: { message?: string } } | null)?.details?.message ?? (json as { error?: string } | null)?.error) ?? '');
const ended = (b: MbzBuild) => b.status === 'ready' || b.status === 'failed';

test('C-T8-01 two parallel POST …/mbz for one version → both 202 with the same buildId (one build)', async () => {
  test.setTimeout(600_000);
  const s = await signIn(THANH);
  const v = await newBlankVersion(s, `QA T8 race one ${runId()}`);
  const [a, b] = await Promise.all([startMbz(s, v.courseId, v.versionId), startMbz(s, v.courseId, v.versionId)]);
  test.info().annotations.push({ type: 'answers', description: `${a.status} ${a.json?.buildId} ${a.json?.status} | ${b.status} ${b.json?.buildId} ${b.json?.status}` });
  const last = await waitMbz(s, v.courseId, v.versionId, ended, 420_000);
  test.info().annotations.push({ type: 'newest build', description: JSON.stringify(last) });
  expect([a.status, b.status], `${a.body.slice(0, 160)} | ${b.body.slice(0, 160)}`).toEqual([202, 202]);
  expect(b.json.buildId, 'one build for both requests').toBe(a.json.buildId);
});

test('C-T8-01 three parallel POST …/mbz for three versions of one library → two 202 and one 409 MBZ_BUILD_LIMIT (at most 2 active builds)', async () => {
  test.setTimeout(900_000);
  const s = await signIn(THANH);
  const id = runId();
  const versions = await Promise.all([1, 2, 3].map((n) => newBlankVersion(s, `QA T8 race limit ${n} ${id}`)));
  const answers = await Promise.all(versions.map((v) => startMbz(s, v.courseId, v.versionId)));
  test.info().annotations.push({ type: 'answers', description: answers.map((x) => `${x.status} ${x.json?.buildId ?? errCode(x.json)}`).join(' | ') });
  // Let every accepted build end, so later tests start with no active build in this library.
  for (const [i, v] of versions.entries()) if (answers[i]!.status === 202) await waitMbz(s, v.courseId, v.versionId, ended, 420_000);
  const accepted = answers.filter((x) => x.status === 202).length;
  const limited = answers.filter((x) => x.status === 409 && errCode(x.json) === 'MBZ_BUILD_LIMIT').length;
  expect({ accepted, limited }, 'two accepted, one refused by the limit').toEqual({ accepted: 2, limited: 1 });
});
