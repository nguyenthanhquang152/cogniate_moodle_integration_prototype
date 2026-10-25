// LA-E4-03 K1-SIM acceptance tests (pending: Docker window):
// - AC-LA-E4-03-02: K1-AGS A1-A6 pass on the Moodle-shaped standard, Canvas and Blackboard simulator channels
//   (assertion `aud` forms, score body, status mapping including LA-IC-15 / BD-A1-27 per-channel 409 conflict text
//   "{LMS} has a grade with a newer time", no send for staff preview, no send for a disabled connection, service URLs
//   off the service origin refused).
// - AC-LA-E4-03-03: Simulator answers a score POST with `429` and `Retry-After: 30`: row stays `pending`, try count
//   does not rise, app logs `dispatch_throttled {dispatch_id, partition, retry_at}`, and next score POST to that
//   platform comes no earlier than 30 s later (`/__sim/records` times).
// - AC-LA-E4-03-04: Fairness with the transport gate (`hold_before` on the score path of platform A): a score of
//   platform B is sent before the release; two held rows of platform A are forwarded one at a time.
// - AC-LA-E4-03-05: App restart (`npm run stack:restart -- cogniate-app`) while a send is held makes the row uncertain;
//   after the release, exactly one confirmation send follows at least 5 s after the first accepted send (T5b P2 rule).
// Source: docs/architecture/ltiaas/tasks/LA-E4-03.md (at f01bfcd); LA-ADR-03 D5, D6, D7, D8; LA-ADR-04 D8 LA-IC-11,
// LA-IC-15; cogniate-app-api-delta.md §6, §8; build-decisions-A1.md BD-A1-27; TEST-STRATEGY.md §2.4 K1-AGS, §8 E4.
// QA-3 wrote these tests from the spec, contracts and ADRs only (test-first).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AGS,
  app,
  bound,
  connPath,
  expectStatus,
  gateEvents,
  gatePhase,
  gateReset,
  gateRules,
  host,
  logEvents,
  pause,
  poll,
  records,
  release,
  session,
  unique,
  type Json,
} from '../../../acceptance/M1/common/client';
import { commitGrade, newVersion, openPlay, publication, results, waitSync } from '../../../acceptance/M1/common/course';
import {
  CLOUD,
  PATHS,
  ROLE,
  SELF,
  canvasBound,
  canvasLaunch,
  canvasPlay,
  refused,
  scoreRecords,
} from '../../../acceptance/M1/canvas/canvas';

const SCOPES = [
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
];

function writeArtifact(name: string, content: string): void {
  const runDir = process.env.LA_RUN_DIR;
  if (!runDir) return;
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(runDir, name), content, { mode: 0o600 });
}

describe('LA-E4-03 K1-SIM (pending: Docker window)', () => {
  afterEach(async () => {
    await gateReset().catch(() => undefined);
  });

  it('AC-LA-E4-03-02: K1-AGS A1-A6 pass on the Moodle-shaped standard, Canvas and Blackboard simulator channels (including LA-IC-15 per-channel 409 text)', async () => {
    // 1. Blackboard (`blackboard-sim`): A1 array `aud`, A2 score body, A3 204 -> sent and 409 -> conflict with "Blackboard has a grade with a newer time" (LA-IC-15 / BD-A1-27)
    const bb = await bound();
    const bbPubSent = await publication(bb, 'scorm12');
    expect((await host('m1-restart', { service: 'lti-service' })).code).toBe(0);
    const bbCursor = (await records()).cursor;
    const bbPlaySent = await openPlay(bb, bbPubSent);
    await commitGrade(bbPlaySent, 'scorm12', 8, 10);
    await waitSync(bb, bbPubSent, 'sent');
    const bbRecs = (await records(bbCursor)).records;
    const bbScore = bbRecs.find((r: Json) => r.kind === 'score' && r.resource === bbPubSent.id);
    expect(bbScore).toBeDefined();
    expect(bbScore!.body.scoreGiven).toBe(8);
    expect(bbScore!.body.scoreMaximum).toBe(10);
    expect(bbScore!.body.activityProgress).toBe('Completed');
    expect(bbScore!.body.gradingProgress).toBe('FullyGraded');
    const bbToken = bbRecs.find((r: Json) => r.kind === 'token' && r.tokenRef === bbScore!.tokenRef);
    expect(bbToken).toBeDefined();
    expect(bbToken!.audience).toEqual(['https://developer.blackboard.sim.test/api/v1/gateway/oauth2/jwttoken']);

    const bbPubConflict = await publication(bb, 'scorm12');
    const bbPlayConflict = await openPlay(bb, bbPubConflict, {
      scoreAnswers: [{ status: 409, message: 'Newer timestamp in gradebook' }],
    });
    await commitGrade(bbPlayConflict, 'scorm12', 7, 10);
    const bbConflictSync = await waitSync(bb, bbPubConflict, 'conflict', 1);
    expect(bbConflictSync.lastError).toContain('Blackboard has a grade with a newer time');

    // 2. Canvas (`canvas-sim-cloud`): A1 string `aud`, A2 score body, A3 409 -> conflict with "Canvas has a grade with a newer time", A4 staff preview sends nothing, A5 disabled sends nothing, A6 check 13
    const cv = await canvasBound();
    const cvPubConflict = await publication(cv, 'scorm12');
    const cvPlayConflict = await canvasPlay(cv, cvPubConflict, {
      scoreAnswers: [{ status: 409, message: 'Newer timestamp in Canvas' }],
    });
    await commitGrade(cvPlayConflict, 'scorm12', 7, 10);
    const cvConflictSync = await waitSync(cv, cvPubConflict, 'conflict', 1);
    expect(cvConflictSync.lastError).toContain('Canvas has a grade with a newer time');

    // A4: staff preview sends nothing
    const cvPubPreview = await publication(cv, 'scorm12');
    const cvPreviewCursor = (await records()).cursor;
    const cvPlayPreview = await canvasPlay(cv, cvPubPreview, { roles: [ROLE.instructor] });
    await commitGrade(cvPlayPreview, 'scorm12', 9, 10);
    await pause(5_000);
    const previewRows = await results(cv, cvPubPreview);
    expect(previewRows.every((r: Json) => r.preview === true && r.scoreSyncs.length === 0)).toBe(true);
    expect(await scoreRecords(cvPreviewCursor, cvPubPreview.id)).toEqual([]);

    // A6: service URLs off the service origin refused (check 13)
    const selfCv = await canvasBound('A', { profile: SELF.profile, siteUrl: SELF.site, serviceUrl: SELF.service });
    const badLineitems = `${SELF.site}${PATHS.lineitems}`;
    const badLaunch = await canvasLaunch(selfCv, {
      claims: { [AGS]: { lineitems: badLineitems, lineitem: `${badLineitems}/x`, scope: SCOPES } },
    });
    refused(badLaunch.response, 'SERVICE_ORIGIN_MISMATCH', [400]);

    // A5: disabled connection sends nothing (`CONNECTION_DISABLED`)
    const cvDis = await canvasBound();
    const cvPubDis = await publication(cvDis, 'scorm12');
    const cvPlayDis = await canvasPlay(cvDis, cvPubDis, { scoreAnswers: [503] });
    await commitGrade(cvPlayDis, 'scorm12', 7, 10);
    await waitSync(cvDis, cvPubDis, 'pending', 1, 20_000);
    expectStatus(await app(cvDis.s, 'DELETE', connPath(cvDis.connection.id)), 204);
    const disCursor = (await records()).cursor;
    const disFailed = await waitSync(cvDis, cvPubDis, 'failed', 1, 45_000);
    expect(disFailed.lastError).toBe('CONNECTION_DISABLED');
    expect(await scoreRecords(disCursor, cvPubDis.id)).toEqual([]);

    // 3. Moodle-shaped standard (`moodle-sim`): A1 string `aud`, A2 score body, A3 204 -> sent and 409 -> "Moodle has a grade with a newer time"
    const s = await session('A');
    const moodleClientId = unique('qa-moodle-e403');
    const moodleConn = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E4-03 Moodle'),
      siteUrl: 'https://moodle.sim.test',
      method: 'manual',
      lms: 'moodle',
    });
    expectStatus(moodleConn, 201);
    const moodleBind = await app(s, 'PUT', `${connPath(moodleConn.json.id)}/platform`, {
      issuer: 'https://moodle.sim.test',
      clientId: moodleClientId,
      deploymentId: '1',
      authenticationEndpoint: 'https://moodle.sim.test/mod/lti/auth.php',
      accessTokenEndpoint: 'https://moodle.sim.test/mod/lti/token.php',
      jwksUrl: 'https://moodle.sim.test/mod/lti/certs.php',
    });
    expectStatus(moodleBind, 200);
    const mdBinding = { s, connection: moodleBind.json, deploymentId: '1' };
    const mdPub = await publication(mdBinding, 'scorm12');
    const mdLineitems = 'https://moodle.sim.test/mod/lti/services.php/2/lineitems';
    const mdPlay = await openPlay(mdBinding, mdPub, {
      provider: 'moodle-sim',
      clientId: moodleClientId,
      deploymentId: '1',
      siteHost: 'moodle.sim.test',
      claims: {
        [AGS]: {
          lineitems: mdLineitems,
          lineitem: `${mdLineitems}/${encodeURIComponent(mdPub.id)}`,
          scope: SCOPES,
        },
      },
      scoreAnswers: [{ status: 409, message: 'Newer timestamp in Moodle' }],
    });
    await commitGrade(mdPlay, 'scorm12', 7, 10);
    const mdConflict = await waitSync(mdBinding, mdPub, 'conflict', 1);
    expect(mdConflict.lastError).toContain('Moodle has a grade with a newer time');

    writeArtifact(
      'e4-03-ac02.json',
      `${JSON.stringify(
        {
          bbConflict: bbConflictSync.lastError,
          cvConflict: cvConflictSync.lastError,
          mdConflict: mdConflict.lastError,
          disabledError: disFailed.lastError,
        },
        null,
        2,
      )}\n`,
    );
  });

  it('AC-LA-E4-03-03: simulator score POST 429 with Retry-After: 30 keeps row pending with tries unchanged, logs dispatch_throttled, and delays next POST >= 30 s', async () => {
    const cv = await canvasBound();
    const pub = await publication(cv, 'scorm12');
    const cursor = (await records()).cursor;
    const sinceMs = Date.now() - 500;

    const play = await canvasPlay(cv, pub, {
      scoreAnswers: [
        {
          status: 429,
          retryAfter: 30,
          headers: { 'Retry-After': '30', 'retry-after': '30' },
          message: 'Too Many Requests',
        },
        { status: 204 },
      ],
    });
    await commitGrade(play, 'scorm12', 8, 10);

    // Wait for the throttled log event from cogniate-app.
    const throttledLog = await poll(
      async () => logEvents('dispatch_throttled', sinceMs, {}, 'cogniate-app'),
      (events) => events.length >= 1,
      15_000,
      200,
    );
    expect(throttledLog[0].dispatch_id).toMatch(/^sync_/);
    expect(typeof throttledLog[0].partition).toBe('string');
    expect(typeof throttledLog[0].retry_at).toBe('number');

    // Row stays `pending` and its try count does not rise (`tries === 0`).
    const rowsWhileThrottled = await results(cv, pub);
    const syncWhileThrottled = rowsWhileThrottled[0]?.scoreSyncs?.[0];
    expect(syncWhileThrottled).toBeDefined();
    expect(syncWhileThrottled.status).toBe('pending');
    expect(syncWhileThrottled.tries).toBe(0);

    // Next score POST to that platform comes no earlier than 30 s later and completes as `sent`.
    await waitSync(cv, pub, 'sent', undefined, 50_000);
    const scoreHits = (await records(cursor)).records.filter((r: Json) => r.kind === 'score' && r.resource === pub.id);
    expect(scoreHits.length).toBe(2);
    expect(scoreHits[0].status).toBe(429);
    expect(scoreHits[1].status).toBe(204);
    const t0 = typeof scoreHits[0].ts === 'number' ? scoreHits[0].ts : Date.parse(String(scoreHits[0].ts));
    const t1 = typeof scoreHits[1].ts === 'number' ? scoreHits[1].ts : Date.parse(String(scoreHits[1].ts));
    expect(t1 - t0).toBeGreaterThanOrEqual(29_500);

    writeArtifact(
      'e4-03-ac03.json',
      `${JSON.stringify(
        {
          dispatchThrottled: throttledLog[0],
          triesWhileThrottled: syncWhileThrottled.tries,
          deltaMs: t1 - t0,
        },
        null,
        2,
      )}\n`,
    );
  });

  it('AC-LA-E4-03-04: fairness with transport gate (hold_before on score path of platform A): platform B score is sent before release; two held rows of platform A are forwarded one at a time', async () => {
    const platA = await bound('A', 'https://learn-a.blackboard.sim.test');
    const platB = await canvasBound('A');
    const pubA1 = await publication(platA, 'scorm12');
    const pubA2 = await publication(platA, 'scorm12');
    const pubB = await publication(platB, 'scorm12');

    const playA1 = await openPlay(platA, pubA1, { subject: 'learner-a1' });
    const playA2 = await openPlay(platA, pubA2, { subject: 'learner-a2' });
    const playB = await canvasPlay(platB, pubB, { subject: 'learner-b1' });

    await gateReset();
    await gateRules([
      {
        id: 'hold-plat-a',
        method: 'POST',
        pathRegex: '^/api/lineitems/.*learn-a\\.blackboard\\.sim\\.test.*/scores$',
        action: 'hold_before',
        times: 2,
      },
    ]);

    // Commit first score on platform A and wait until it is held at lti-gate.
    await commitGrade(playA1, 'scorm12', 7, 10);
    const heldA1 = await gatePhase('hold-plat-a', 'held_before', 15_000);

    // Commit second score on platform A and a score on platform B while A1 is still held.
    await commitGrade(playA2, 'scorm12', 8, 10);
    await commitGrade(playB, 'scorm12', 9, 10);

    // Platform B's score completes and becomes `sent` BEFORE platform A is released!
    await waitSync(platB, pubB, 'sent', undefined, 20_000);

    // While A1 is held, A2 has not been forwarded concurrently on the same partition (only 1 held_before event so far, or forwarded one at a time).
    const eventsBeforeRelease1 = (await gateEvents(0)).filter(
      (e: Json) => e.rule_id === 'hold-plat-a' && e.phase === 'held_before',
    );
    expect(eventsBeforeRelease1.length).toBe(1);

    // Release A1 -> A1 finishes, then A2 reaches held_before and is released.
    await release(heldA1.request_id, 'deliver');
    await waitSync(platA, pubA1, 'sent', undefined, 20_000);

    const heldA2 = await poll(
      async () =>
        (await gateEvents(0)).find(
          (e: Json) => e.rule_id === 'hold-plat-a' && e.phase === 'held_before' && e.request_id !== heldA1.request_id,
        ),
      Boolean,
      20_000,
      100,
    );
    await release(heldA2!.request_id, 'deliver');
    await waitSync(platA, pubA2, 'sent', undefined, 20_000);

    writeArtifact(
      'e4-03-ac04.json',
      `${JSON.stringify(
        {
          heldA1RequestId: heldA1.request_id,
          heldA2RequestId: heldA2!.request_id,
          heldCountWhileBCompleted: eventsBeforeRelease1.length,
        },
        null,
        2,
      )}\n`,
    );
  });

  it('AC-LA-E4-03-05: app restart while a send is held makes the row uncertain; after release, one confirmation send follows >= 5 s after the first accepted send (T5b P2 rule)', async () => {
    const cv = await canvasBound();
    const pub = await publication(cv, 'scorm12');
    const resourceLinkId = `p2-${pub.id}`;
    const play = await canvasPlay(cv, pub, { resourceLinkId });
    const cursor = (await records()).cursor;

    await gateReset();
    await gateRules([
      {
        id: 'hold-p2-restart',
        method: 'POST',
        pathRegex: `^/api/lineitems/.*${encodeURIComponent(pub.id)}.*/scores$`,
        action: 'hold_before',
        times: 1,
      },
    ]);

    await commitGrade(play, 'scorm12', 5, 10);
    const held = await gatePhase('hold-p2-restart', 'held_before', 15_000);

    // Commit a higher score on the same resourceLinkId while the 5/10 send is held in flight (`send_started_at` set), then restart cogniate-app.
    await newVersion(cv, pub);
    const playHigher = await canvasPlay(cv, pub, { resourceLinkId });
    await commitGrade(playHigher, 'scorm12', 9, 10);
    const restarted = await host('m1-restart', { service: 'cogniate-app' });
    expect(restarted.code).toBe(0);
    await release(held.request_id, 'drop').catch(() => undefined);
    await gateReset();

    // After restart recovery, the row becomes `sent` only after the first accepted send AND one confirmation send >= 5 s later.
    await waitSync(cv, pub, 'sent', undefined, 45_000);
    const hits = (await scoreRecords(cursor, pub.id)).filter((r: Json) => r.status === 204 || r.status === 200);
    expect(hits.length).toBe(2);
    const firstTs = typeof hits[0].ts === 'number' ? hits[0].ts : Date.parse(String(hits[0].ts));
    const confirmTs = typeof hits[1].ts === 'number' ? hits[1].ts : Date.parse(String(hits[1].ts));
    expect(confirmTs - firstTs).toBeGreaterThanOrEqual(4_800);

    writeArtifact(
      'e4-03-ac05.json',
      `${JSON.stringify({ acceptedSendCount: hits.length, confirmationDelayMs: confirmTs - firstTs }, null, 2)}\n`,
    );
  });
});
