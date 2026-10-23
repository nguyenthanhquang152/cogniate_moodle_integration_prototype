// LA-E5-22 acceptance (K1-SIM) on the upgrade route U1 (TEST-STRATEGY §4.5).
// Runs in the e2e container twice via tests/ltiaas/tasks-ops/LA-E5-22/run.mjs:
// - QA_LA_PHASE=old on the pre-LA-E5-22 build: creates a Blackboard-sim binding, publication, Deep Linking pick,
//   learner launch and score dispatch (sealing legacy blobs in connection, picker_session, resource_link), plus a
//   pending Moodle Dynamic Registration connection (ref_token_encrypted) and an open picker session (ltik_encrypted).
// - QA_LA_PHASE=new on the candidate build with the same volumes and only APP_MASTER_KEY (no app keyring file):
//   verifies AC-LA-E5-22-01 (stack starts, old sealed values still work: a launch, a pick and a score dispatch succeed).
//
// Source: docs/architecture/ltiaas/tasks/LA-E5-22.md; LA-ADR-06 D6 ("Scope in LA"), D12; operability §2, §6.3;
// security-delta §10; BD-A2-91.
// Secret rule: never put a key, token, ltik or JWT into an assertion message.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import { SECRETS_DIR, TESTS_DIR } from '../../../acceptance/lib/paths';
import { bound, expectStatus, httpsRequest, records, session, sim, urls, type Json } from '../../../acceptance/M1/common/client';
import { gradeWorks, openPlay, pick, picker, publication, returnDeepLink } from '../../../acceptance/M1/common/course';

const PHASE = process.env.QA_LA_PHASE;
if (PHASE !== 'old' && PHASE !== 'new' && PHASE !== 'ring-before-rewrap' && PHASE !== 'ring-after-rewrap') {
  throw new Error(
    'QA_LA_PHASE must be "old", "new", "ring-before-rewrap", or "ring-after-rewrap" (set by tests/ltiaas/tasks-ops/LA-E5-22/run.mjs)',
  );
}

const DIR = path.join(TESTS_DIR, '.tmp', 'qa2-LA-E5-22');
const STATE = path.join(DIR, 'state.json');

interface U1AppState {
  connection: { id: string; siteUrl: string; lms: string; name: string };
  deploymentId: string;
  platformId: string;
  pub: { id: string; format: 'html' | 'scorm12'; courseId: string };
  openPickerUrl: string;
  openPickerUrlRing: string;
  pickerScenario: Json;
  pickerScenarioRing: Json;
  link: { resourceLinkId: string; contextId: string; subject: string };
}

function saveState(patch: Partial<U1AppState>): void {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const prev = fs.existsSync(STATE) ? (JSON.parse(fs.readFileSync(STATE, 'utf8')) as Partial<U1AppState>) : {};
  fs.writeFileSync(STATE, JSON.stringify({ ...prev, ...patch }, null, 2), { mode: 0o600 });
}

function loadState(): U1AppState {
  return JSON.parse(fs.readFileSync(STATE, 'utf8')) as U1AppState;
}

async function oldBinding(s: U1AppState) {
  return {
    s: await session('A'),
    connection: s.connection,
    deploymentId: s.deploymentId,
    platformId: s.platformId,
  };
}

it.runIf(PHASE === 'old')(
  'LA-E5-22-U1OLD old build: create binding, publication, Deep Linking pick, learner launch, score dispatch, and an open picker session with generation-0 APP_MASTER_KEY blobs',
  async () => {
    fs.rmSync(DIR, { recursive: true, force: true });
    const b = await bound();
    const pub = await publication(b);

    // 1. Deep Linking pick on the old build.
    const chooser1 = await picker(b);
    const selected1 = await pick(chooser1.url, pub.id);
    expectStatus(selected1, 200);
    await returnDeepLink(selected1);

    // 2. Learner launch + score dispatch on the old build (stores legacy service_key_encrypted on resource_link).
    const tag = crypto.randomBytes(4).toString('hex');
    const link = {
      resourceLinkId: pub.id,
      contextId: `qa2-e522-ctx-${tag}`,
      subject: `qa2-e522-user-${tag}`,
    };
    const playOld = await openPlay(b, pub, link);
    assert.ok(playOld.token.services?.serviceKey, 'old build: learner launch produced service key');
    const graded = await gradeWorks(b);
    assert.equal(graded.hits.length, 1, 'old build: learner launch and score dispatch succeeded');

    // 3. Open two more picker sessions on the old build (stores legacy ltik_encrypted on picker_session):
    //    one for the APP_MASTER_KEY-only start and one for the key-ring start before app:keys rewrap.
    const chooser2 = await picker(b);
    const chooser3 = await picker(b);

    saveState({
      connection: {
        id: b.connection.id,
        siteUrl: b.connection.siteUrl,
        lms: b.connection.lms,
        name: b.connection.name,
      },
      deploymentId: b.deploymentId,
      platformId: b.platformId,
      pub: { id: pub.id, format: pub.format, courseId: pub.courseId },
      openPickerUrl: chooser2.url,
      openPickerUrlRing: chooser3.url,
      pickerScenario: chooser2.result.scenario,
      pickerScenarioRing: chooser3.result.scenario,
      link,
    });
  },
);

it.runIf(PHASE === 'new')(
  'AC-LA-E5-22-01 U1: an upgraded stack with only APP_MASTER_KEY starts, hides infra/.secrets/app-keys from e2e, and old sealed values still work (launch, pick and score dispatch succeed)',
  async () => {
    // Visibility rule (security-delta §10, BD-A2-91): e2e container sees an empty tmpfs at /repo/infra/.secrets/app-keys.
    assert.equal(
      fs.existsSync(path.join(SECRETS_DIR, 'app-keys', 'keyring.json')),
      false,
      'e2e container must not see infra/.secrets/app-keys/keyring.json',
    );

    const health = await httpsRequest(`${urls.app}/healthz`);
    expectStatus(health, 200);

    const s = loadState();
    const b = await oldBinding(s);

    // 1. Pick using the pre-upgrade picker session (opens legacy picker_session.ltik_encrypted).
    expectStatus(await sim('/scenarios', 'POST', s.pickerScenario), 201);
    const pickedOldSession = await pick(s.openPickerUrl, s.pub.id);
    expectStatus(pickedOldSession, 200);
    const dlCursor1 = (await records()).cursor;
    await returnDeepLink(pickedOldSession);
    assert.equal(
      (await records(dlCursor1)).records.filter((r: Json) => r.kind === 'deep-link').length,
      1,
      'pick on pre-upgrade picker session succeeded after upgrade',
    );

    // 2. Pick using a new picker session created after upgrade (seals and opens cgk1 picker_session.ltik_encrypted).
    const chooserNew = await picker(b);
    const pickedNewSession = await pick(chooserNew.url, s.pub.id);
    expectStatus(pickedNewSession, 200);
    const dlCursor2 = (await records()).cursor;
    await returnDeepLink(pickedNewSession);
    assert.equal(
      (await records(dlCursor2)).records.filter((r: Json) => r.kind === 'deep-link').length,
      1,
      'pick on post-upgrade picker session succeeded',
    );

    // 3. Launch and score dispatch on the existing resource link / connection after upgrade.
    const play = await openPlay(b, { id: s.pub.id, format: s.pub.format }, s.link);
    assert.ok(play.token.services?.serviceKey, 'launch on upgraded stack succeeded');
    const graded = await gradeWorks(b);
    assert.equal(graded.hits.length, 1, 'score dispatch on upgraded stack succeeded');
  },
);

it.runIf(PHASE === 'ring-before-rewrap')(
  'AC-LA-E5-22-01 U1 (key ring before rewrap): an app with legacy blobs started with a key ring hides infra/.secrets/app-keys from e2e and still opens legacy blobs (pick, launch, score dispatch)',
  async () => {
    assert.equal(
      fs.existsSync(path.join(SECRETS_DIR, 'app-keys', 'keyring.json')),
      false,
      'e2e container must not see infra/.secrets/app-keys/keyring.json even when present on host',
    );

    const s = loadState();
    const b = await oldBinding(s);

    // 1. Pick using the second pre-upgrade picker session while the key ring (active: k2) is loaded before rewrap.
    expectStatus(await sim('/scenarios', 'POST', s.pickerScenarioRing), 201);
    const pickedLegacyWithRing = await pick(s.openPickerUrlRing, s.pub.id);
    expectStatus(pickedLegacyWithRing, 200);
    const dlCursor = (await records()).cursor;
    await returnDeepLink(pickedLegacyWithRing);
    assert.equal(
      (await records(dlCursor)).records.filter((r: Json) => r.kind === 'deep-link').length,
      1,
      'pick on pre-upgrade legacy picker session succeeded with key ring active before rewrap',
    );

    // 2. Launch and score dispatch with key ring active before rewrap.
    const play = await openPlay(b, { id: s.pub.id, format: s.pub.format }, s.link);
    assert.ok(play.token.services?.serviceKey, 'launch with key ring before rewrap succeeded');
    const graded = await gradeWorks(b);
    assert.equal(graded.hits.length, 1, 'score dispatch with key ring before rewrap succeeded');
  },
);

it.runIf(PHASE === 'ring-after-rewrap')(
  'AC-LA-E5-22-01 U1 (after app:keys rewrap): pick, launch and score dispatch succeed after app:keys rewrap moves sealed blobs to the active key ring version',
  async () => {
    const s = loadState();
    const b = await oldBinding(s);

    const chooser = await picker(b);
    const picked = await pick(chooser.url, s.pub.id);
    expectStatus(picked, 200);
    const dlCursor = (await records()).cursor;
    await returnDeepLink(picked);
    assert.equal(
      (await records(dlCursor)).records.filter((r: Json) => r.kind === 'deep-link').length,
      1,
      'pick after app:keys rewrap succeeded',
    );

    const play = await openPlay(b, { id: s.pub.id, format: s.pub.format }, s.link);
    assert.ok(play.token.services?.serviceKey, 'launch after app:keys rewrap succeeded');
    const graded = await gradeWorks(b);
    assert.equal(graded.hits.length, 1, 'score dispatch after app:keys rewrap succeeded');
  },
);
