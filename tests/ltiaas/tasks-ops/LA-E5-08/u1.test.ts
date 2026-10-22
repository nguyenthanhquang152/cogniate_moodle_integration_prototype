// LA-E5-08 acceptance (K1-SIM) on the upgrade route U1 (TEST-STRATEGY §4.5): the host runner (run.mjs) runs this
// file twice in the e2e container. QA_LA_PHASE=old runs on the old build (before the key provider): it makes
// generation-0 data. QA_LA_PHASE=new runs on the candidate build with the same volumes: it checks AC-01 and AC-02.
// Source: docs/architecture/ltiaas/tasks/LA-E5-08.md; LA-ADR-06 D6 (AP-06-23); contract §2.4, §3.6, §3.8.
// Host rows of the same task: the start of the candidate build with only LTI_MASTER_KEY (AC-01 host part).
//
// Phase state: tests/.tmp/qa2-LA-E5-08/ (a writable mount in e2e; the host runner never copies it into evidence).
// `state.json` holds ids and hashes only. `secret.raw.json` (mode 0600) holds the one old service key that AC-02
// sends after the upgrade. No secret goes into an assertion message.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import { apiKey, auth, errorCode, eventsSince, ltiApi } from '../../../acceptance/lib/lti';
import { TESTS_DIR } from '../../../acceptance/lib/paths';
import { bound, expectStatus, httpsRequest, records, service, session, urls, type Json } from '../../../acceptance/M1/common/client';
import { gradeWorks, openPlay, pick, picker, publication, returnDeepLink } from '../../../acceptance/M1/common/course';
import { startRegistrationSession } from './moodle-dr';

const PHASE = process.env.QA_LA_PHASE;
if (PHASE !== 'old' && PHASE !== 'new') throw new Error('QA_LA_PHASE must be "old" or "new" (set by run.mjs)');
const DIR = path.join(TESTS_DIR, '.tmp', 'qa2-LA-E5-08');
const STATE = path.join(DIR, 'state.json');
const SECRET = path.join(DIR, 'secret.raw.json');
const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

interface U1State {
  connection: { id: string; siteUrl: string; lms: string; name: string };
  deploymentId: string;
  platformId: string;
  pub: { id: string; format: 'html' | 'scorm12'; courseId: string };
  lineItemId: string;
  userId: string;
  /** Launch values of the old service key (the derivation input stays the same). */
  link: { resourceLinkId: string; contextId: string; subject: string };
  serviceKeySha256: string;
  activeKid: string;
  kids: string[];
  registrationId?: string;
}

function saveState(patch: Partial<U1State>) {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const next = { ...(fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {}), ...patch };
  fs.writeFileSync(STATE, JSON.stringify(next, null, 2));
}
const loadState = (): U1State => JSON.parse(fs.readFileSync(STATE, 'utf8')) as U1State;

async function toolKids(): Promise<string[]> {
  const res = await httpsRequest(`${urls.lti}/lti/keys/cogniate`);
  expectStatus(res, 200);
  return ((JSON.parse(res.body) as { keys?: { kid?: string }[] }).keys ?? []).map((k) => String(k.kid));
}

/** A binding of the old phase, again usable: a new app session of library A, the same connection and deployment. */
async function oldBinding(s: U1State) {
  return { s: await session('A'), connection: s.connection, deploymentId: s.deploymentId, platformId: s.platformId };
}

const scoreBody = (userId: string, given: number) => ({ userId, scoreGiven: given, scoreMaximum: 10, activityProgress: 'Completed', gradingProgress: 'FullyGraded' });

// ---------------------------------------------------------------- phase old (old build)

it.runIf(PHASE === 'old')('LA-E5-08-U1OLD old build: a Blackboard-sim binding, a Deep Linking response, a launch and a score POST work; save generation-0 state', async () => {
  fs.rmSync(DIR, { recursive: true, force: true });
  const b = await bound();
  const pub = await publication(b);
  const chooser = await picker(b);
  const selected = await pick(chooser.url, pub.id);
  expectStatus(selected, 200);
  await returnDeepLink(selected);
  const tag = crypto.randomBytes(4).toString('hex');
  const link = { resourceLinkId: pub.id, contextId: `qa2-u1-context-${tag}`, subject: `qa2-u1-user-${tag}` };
  const play = await openPlay(b, pub, link);
  const key = String(play.token.services?.serviceKey ?? '');
  const lineItemId = String(play.token.services?.assignmentAndGrades?.lineItemId ?? '');
  const userId = String(play.token.user?.id ?? '');
  assert.ok(key && lineItemId && userId, 'the launch gives a service key, a line item and a user id');
  const cursor = (await records()).cursor;
  expectStatus(await service(key, 'POST', `/api/lineitems/${encodeURIComponent(lineItemId)}/scores`, scoreBody(userId, 6)), 204);
  assert.equal((await records(cursor)).records.filter((r: Json) => r.kind === 'score' && r.resource === pub.id).length, 1, 'the simulator got one score');
  const kids = await toolKids();
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(SECRET, JSON.stringify({ serviceKey: key }), { mode: 0o600 });
  saveState({
    connection: { id: b.connection.id, siteUrl: b.connection.siteUrl, lms: b.connection.lms, name: b.connection.name },
    deploymentId: b.deploymentId, platformId: b.platformId,
    pub: { id: pub.id, format: pub.format, courseId: pub.courseId },
    lineItemId, userId, link, serviceKeySha256: sha256(key), activeKid: kids[0], kids,
  });
});

it.runIf(PHASE === 'old')('LA-E5-08-U1REG old build: a Moodle Dynamic Registration start stores one registration session', async () => {
  const registrationId = await startRegistrationSession(`${urls.lti}/lti/register/cogniate`);
  const read = await ltiApi<Json>('GET', `/api/registrations/${encodeURIComponent(registrationId)}`, { authorization: auth.bearer(apiKey('cogniate')) });
  expectStatus(read, 200);
  saveState({ registrationId });
});

// ---------------------------------------------------------------- phase new (candidate build, same volumes)

it.runIf(PHASE === 'new')('AC-LA-E5-08-01 (registration session) a registration session of the old build opens: complete gives 200 with a platformId', async () => {
  const s = loadState();
  assert.ok(s.registrationId, 'the old phase saved a registration id (row LA-E5-08-U1REG)');
  const res = await ltiApi<Json>('POST', `/api/registrations/${encodeURIComponent(s.registrationId)}/complete`, {
    authorization: auth.bearer(apiKey('cogniate')), body: {},
  });
  assert.equal(res.status, 200, `complete: status ${res.status}, code ${errorCode(res) ?? 'none'}, trace ${res.traceId}`);
  assert.match(String(res.json?.platformId ?? ''), /^plt_/, 'the answer has the new platformId');
  assert.deepEqual(eventsSince('lti-service', 0, (e) => e.event === 'key_open_failed').map((e) => e.table), [], 'no key_open_failed event in the run');
});

it.runIf(PHASE === 'new')('AC-LA-E5-08-01 (tool key) existing tool keys open: the old active key signs a Deep Linking response; a launch and a score POST work', async () => {
  const s = loadState();
  const kids = await toolKids();
  assert.equal(kids[0], s.activeKid, 'the active tool key is the key of the old build');
  for (const kid of s.kids) assert.ok(kids.includes(kid), `old kid ${kid} is still published`);
  const b = await oldBinding(s);
  const chooser = await picker(b);
  const selected = await pick(chooser.url, s.pub.id);
  expectStatus(selected, 200);
  const cursor = (await records()).cursor;
  const returned = await returnDeepLink(selected); // the simulator verifies the signature with the tool JWKS: 200
  const header = JSON.parse(Buffer.from(returned.jwt.split('.')[0], 'base64url').toString('utf8')) as { kid?: string };
  assert.equal(header.kid, s.activeKid, 'the Deep Linking response JWT is signed with the old active key');
  assert.equal((await records(cursor)).records.filter((r: Json) => r.kind === 'deep-link').length, 1, 'the simulator recorded the Deep Linking response');
  // A launch and a score POST end to end (the token request after the restart signs with the old key).
  const graded = await gradeWorks(b);
  assert.equal(graded.hits.length, 1, 'one score at the simulator');
  // The whole log: the start of the candidate build (before this pass) counts too.
  assert.deepEqual(eventsSince('lti-service', 0, (e) => e.event === 'key_open_failed' || e.event === 'key_provider_not_ready').map((e) => e.event), [],
    'no key_open_failed or key_provider_not_ready event in the run');
});

it.runIf(PHASE === 'new')('AC-LA-E5-08-02 U1: the generation-0 service key keeps its exact value; a score POST with the old service key passes', async () => {
  const s = loadState();
  const old = String((JSON.parse(fs.readFileSync(SECRET, 'utf8')) as { serviceKey?: string }).serviceKey ?? '');
  assert.equal(sha256(old), s.serviceKeySha256, 'the saved old key is the key of the old phase');
  const b = await oldBinding(s);
  // The same resource link, context and user as the old launch: the service key derivation gives the same value.
  const again = await openPlay(b, { id: s.pub.id, format: s.pub.format }, s.link);
  const now = String(again.token.services?.serviceKey ?? '');
  assert.ok(now, 'the new launch gives a service key');
  assert.equal(sha256(now), s.serviceKeySha256, 'the service key after the upgrade equals the old value (byte for byte)');
  const cursor = (await records()).cursor;
  expectStatus(await service(old, 'POST', `/api/lineitems/${encodeURIComponent(s.lineItemId)}/scores`, scoreBody(s.userId, 8)), 204);
  const hits = (await records(cursor)).records.filter((r: Json) => r.kind === 'score' && r.resource === s.pub.id);
  assert.equal(hits.length, 1, 'the simulator got the score');
  assert.equal(hits[0].body?.scoreGiven, 8, 'the score value');
  // Negative control: one changed character gives 401, so the 204 depends on the exact old value.
  const changed = old.slice(0, -1) + (old.endsWith('A') ? 'B' : 'A');
  const refused = await service(changed, 'POST', `/api/lineitems/${encodeURIComponent(s.lineItemId)}/scores`, scoreBody(s.userId, 9));
  assert.equal(refused.status, 401, 'a changed service key: status');
  assert.equal(errorCode(refused), 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER', 'a changed service key: code');
});
