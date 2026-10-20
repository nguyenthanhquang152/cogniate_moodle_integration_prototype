import fs from 'node:fs';
import path from 'node:path';
import { artifactsDir } from '../../lib/paths';
import { loadState } from '../../lib/lti';
import { seed } from '../../lib/seed';
import { moodleGrade } from '../../lib/t5';
import { admin, app, assert, expectStatus, m1Test, poll, service, session, type Json } from './client';
import { commitGrade } from './course';
import { moodleHttpPlay } from './moodle-http';

const stage = process.env.QA_M1_MIGRATION_STAGE;
const stateFile = () => path.join(artifactsDir('acceptance'), 'm1-migration.raw.json');
async function snapshot() {
  const s = await session(), t5 = loadState('T5') as Json;
  const c = await app(s, 'GET', '/app-api/connections/' + t5.connectionId); expectStatus(c, 200);
  const p = await admin('GET', '/api/platforms/' + c.json.platform.id); expectStatus(p, 200);
  const pubs = await app(s, 'GET', '/app-api/publications?connectionId=' + t5.connectionId); expectStatus(pubs, 200);
  const rows = await app(s, 'GET', `/app-api/publications/${t5.scormPublicationId}/results`); expectStatus(rows, 200);
  return { s, t5, connection: c.json, platform: p.json, publications: pubs.json.publications, rows: rows.json.rows };
}
function stableRows(rows: Json[]) {
  return rows.map((row) => ({ learner: row.learner, activity: row.activity, preview: row.preview, best: row.best,
    attempts: row.attempts, scoreSyncs: row.scoreSyncs }));
}
if (stage === 'baseline') m1Test('M1-23.common.baseline', 'old revision has a real Moodle grade and captures its stable service key', async () => {
  const play = await moodleHttpPlay(), old = await snapshot();
  assert.ok(old.rows.some((r: Json) => r.scoreSyncs.some((s: Json) => s.status === 'sent')));
  const K0 = play.token.services.serviceKey; assert.ok(K0);
  expectStatus(await service(K0, 'GET', '/api/lineitems'), 200);
  assert.equal(await moodleGrade(seed().courses['COGNIATE-DEV-101'], seed().users.cg_student, 'Cogniate SCORM'), 100);
  fs.writeFileSync(stateFile(), JSON.stringify({ K0, platformId: old.platform.id, connection: old.connection,
    publications: old.publications, rows: stableRows(old.rows), t5: old.t5 }, null, 2), { mode: 0o600 });
}, 180_000, 'MOODLE-LIVE');
if (stage === 'upgrade') m1Test('M1-23.common.upgrade', 'migrated Moodle metadata and history remain valid with K0', async () => {
  const old = JSON.parse(fs.readFileSync(stateFile(), 'utf8')), current = await snapshot();
  assert.equal(current.platform.profile, 'standard'); assert.equal(current.platform.siteUrl, null);
  assert.ok(current.platform.deployments.every((d: Json) => d.active === true && d.bindingGeneration === 0));
  assert.equal(current.connection.lms, 'moodle'); assert.equal(current.connection.profile, 'standard');
  assert.equal(current.connection.id, old.connection.id);
  assert.deepEqual(current.publications.map(({ lms, connectionName, ...p }: Json) => p), old.publications);
  assert.deepEqual(stableRows(current.rows), old.rows);
  expectStatus(await service(old.K0, 'GET', '/api/lineitems'), 200);
  const play = await moodleHttpPlay(); assert.equal(play.token.services.serviceKey, old.K0);
  // Same version retains the existing final result; its accepted grade remains sent.
  assert.ok((await snapshot()).rows.some((r: Json) => r.scoreSyncs.some((s: Json) => s.status === 'sent')));
}, 180_000, 'MOODLE-LIVE');
if (stage === 'postwrite') m1Test('M1-30.common.postwrite', 'new revision writes an accepted Moodle score after the backup', async () => {
  const old = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  const play = await moodleHttpPlay(seed().users.cg_student2);
  await commitGrade(play, 'scorm12', 60, 100);
  await poll(async () => (await snapshot()).rows, (rows) =>
    rows.some((r: Json) => r.learner.sub === String(seed().users.cg_student2.id) && r.scoreSyncs.some((s: Json) => s.status === 'sent')), 60_000, 1000);
  await poll(() => moodleGrade(seed().courses['COGNIATE-DEV-101'], seed().users.cg_student2, 'Cogniate SCORM'),
    (grade) => grade === 60, 60_000, 1000);
  old.lostLearner = String(seed().users.cg_student2.id);
  fs.writeFileSync(stateFile(), JSON.stringify(old, null, 2), { mode: 0o600 });
}, 180_000, 'MOODLE-LIVE');
if (stage === 'rollback') m1Test('M1-30.common.rollback', 'old build launches with K0; restored portal loses the new write while Moodle keeps its grade', async () => {
  const old = JSON.parse(fs.readFileSync(stateFile(), 'utf8')), current = await snapshot();
  assert.deepEqual(stableRows(current.rows), old.rows);
  assert.equal(current.rows.some((r: Json) => r.learner.sub === old.lostLearner), false);
  expectStatus(await service(old.K0, 'GET', '/api/lineitems'), 200);
  const play = await moodleHttpPlay(); assert.equal(play.token.services.serviceKey, old.K0);
  assert.equal(await moodleGrade(seed().courses['COGNIATE-DEV-101'], seed().users.cg_student2, 'Cogniate SCORM'), 60);
}, 180_000, 'MOODLE-LIVE');
if (stage?.startsWith('snapshot-')) await import('./snapshot-migration.probe');
else if (!['baseline', 'upgrade', 'postwrite', 'rollback'].includes(stage ?? '')) throw new Error('Explicit migration stage required');
