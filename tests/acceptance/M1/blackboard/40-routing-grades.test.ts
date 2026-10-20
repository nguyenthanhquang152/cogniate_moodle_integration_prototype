import gradeCases from '../../../fixtures/multi-lms/grade-cases.json';
import {
  APP, LTI, admin, app, assert, bound, cli, connPath, createConnection, denied, deploymentPath,
  expectStatus, host, httpsRequest, idToken, issueGrant, launch, logEvents, m1Test, pause,
  poll, records, redeem, remote, service,
} from '../common/client';
import { commitGrade, gradeWorks, newVersion, openPlay, pick, picker, publication, results, returnDeepLink, waitSync } from '../common/course';

m1Test('M1-10.blackboard.deep-link-isolation', 'signed Deep Linking isolates libraries and verifies its return at Learn', async () => {
  const a = await bound(), b = await bound('B', 'https://learn-b.blackboard.sim.test');
  const pa = await publication(a), pb = await publication(b);
  const pickerA = await picker(a), pickerB = await picker(b);
  assert.ok(pickerA.page.body.includes(pa.id)); assert.equal(pickerA.page.body.includes(pb.id), false);
  assert.ok(pickerB.page.body.includes(pb.id)); assert.equal(pickerB.page.body.includes(pa.id), false);
  denied(await pick(pickerA.url, pb.id), 'PUBLICATION_NOT_AVAILABLE');
  const selected = await pick(pickerA.url, pa.id); expectStatus(selected, 200);
  const verified = await returnDeepLink(selected);
  assert.equal(new URL(verified.action).hostname, 'learn-a.blackboard.sim.test');
  const entries = (await records()).records;
  assert.ok(entries.some((r) => r.kind === 'jwks' && r.path === '/api/v1/management/applications/qa-bb-app/jwks.json'));
  const returned = entries.filter((r) => r.kind === 'deep-link').at(-1)!;
  assert.equal(returned.audience, 'https://blackboard.sim.test'); assert.equal(returned.sub, 'qa-bb-app');
  assert.equal(returned.deploymentId, a.deploymentId); assert.equal(returned.dataMode, 'claim');
  const playA = await openPlay(a, pa, { resourceLinkId: 'same-resource', contextId: 'same-context', subject: 'same-user' });
  const playB = await openPlay(b, pb, { resourceLinkId: 'same-resource', contextId: 'same-context', subject: 'same-user' });
  assert.notEqual(playA.playId, playB.playId); assert.notEqual(playA.token.services.serviceKey, playB.token.services.serviceKey);
  const foreign = await app(a.s, 'GET', `/app-api/publications/${pb.id}/results`);
  expectStatus(foreign, 404, 'NOT_FOUND');
});

for (const fixture of gradeCases) {
  m1Test(`M1-11.blackboard.${fixture.id}`, `grade fixture ${fixture.id} preserves ADR-010 values and routing`, async () => {
    const a = await bound(), pub = await publication(a, fixture.format as 'html' | 'scorm12');
    // Restart clears the tool's process-local token cache, making audience evidence mandatory.
    const restarted = await host('m1-restart', { service: 'lti-service' }); assert.equal(restarted.code, 0);
    const cursor = (await records()).cursor, play = await openPlay(a, pub);
    await commitGrade(play, fixture.format, fixture.raw, fixture.maximum, fixture.complete);
    if (fixture.expected) {
      await waitSync(a, pub, 'sent');
      const entries = (await records(cursor)).records;
      const score = entries.filter((r) => r.kind === 'score' && r.resource === pub.id);
      assert.equal(score.length, 1);
      assert.deepEqual([score[0].body.scoreGiven, score[0].body.scoreMaximum], fixture.expected);
      assert.equal(score[0].body.userId, 'learner-1');
      assert.equal(score[0].host, 'learn-a.blackboard.sim.test');
      assert.equal(score[0].contentType, 'application/vnd.ims.lis.v1.score+json');
      const token = entries.find((r) => r.kind === 'token' && r.tokenRef === score[0].tokenRef);
      assert.ok(token, 'Cold-cache score has a recorded verified token assertion');
      assert.deepEqual(token.audience, ['https://developer.blackboard.sim.test/api/v1/gateway/oauth2/jwttoken']);
      assert.equal(entries.some((r) => r.host === 'learn-b.blackboard.sim.test' && r.tokenRef === score[0].tokenRef), false);
      assert.equal((await results(a, pub))[0].learner.label, 'Learner learner-1 @ learn-a.blackboard.sim.test');
    } else {
      await pause(5000); // More than two normal worker polls; the result row must exist without a score.
      const rows = await results(a, pub);
      assert.equal(rows.length, 1); assert.deepEqual(rows[0].scoreSyncs, []);
      assert.deepEqual((await records(cursor)).records.filter((r) => r.kind === 'score' && r.resource === pub.id), []);
    }
  });
}
for (const format of ['scorm12', 'html'] as const) {
  m1Test(`M1-11.blackboard.best-${format}`, '80, 60, 90 sends only the best final scores: ' + format, async () => {
    const a = await bound(), pub = await publication(a, format), cursor = (await records()).cursor;
    for (const [index, score] of [80, 60, 90].entries()) {
      if (index) await newVersion(a, pub);
      const play = await openPlay(a, pub);
      await commitGrade(play, format, format === 'html' ? score / 10 : score, format === 'html' ? 10 : 100);
      if (score !== 60) await poll(async () => (await records(cursor)).records.filter((r) => r.kind === 'score' && r.resource === pub.id),
        (rows) => rows.some((r) => r.body.scoreGiven === score), 20_000);
      else {
        await pause(5000);
        const rows = await results(a, pub); assert.equal(rows[0].best?.scoreGiven, 80);
      }
    }
    const scoreRows = (await records(cursor)).records.filter((r) => r.kind === 'score' && r.resource === pub.id);
    assert.deepEqual(scoreRows.map((r) => [r.body.scoreGiven, r.body.scoreMaximum]), [[80, 100], [90, 100]]);
  });
}
m1Test('M1-11.blackboard.second-site', 'library B grade goes only to Learn B with the shared application', async () => {
  const b = await bound('B', 'https://learn-b.blackboard.sim.test');
  const result = await gradeWorks(b);
  assert.equal(result.hits[0].host, 'learn-b.blackboard.sim.test');
});
m1Test('M1-14.blackboard.runtime-identity', 'SCORM runtime identity has an empty learner name after claim minimization', async () => {
  const a = await bound(), pub = await publication(a);
  const play = await openPlay(a, pub, { claims: { name: 'Private learner name', email: 'private@example.test' } });
  assert.equal(play.state.learner.name, '');
  assert.equal(JSON.stringify(play.state).includes('Private learner name'), false);
});
m1Test('M1-22.blackboard.site-check', 'app rejects a changed deployment site after valid LTI origin checks', async () => {
  const b = await bound('B', 'https://learn-b.blackboard.sim.test');
  const pub = await publication(b), target = deploymentPath(b.platformId, b.deploymentId), since = Date.now();
  expectStatus(await admin('PATCH', target, { active: false }), 200);
  expectStatus(await admin('PATCH', target, { active: true, siteUrl: 'https://learn-a.blackboard.sim.test' }), 200);
  try {
    const l = await launch({ deploymentId: b.deploymentId, siteHost: 'learn-a.blackboard.sim.test', resource: pub.id });
    assert.equal(l.response.status, 303);
    denied(await httpsRequest(String(l.response.headers.location)), 'UNKNOWN_PLATFORM', 404);
    const rejected = logEvents('launch_rejected', since, { reason: 'site_mismatch' });
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].expected_site, 'https://learn-b.blackboard.sim.test');
    assert.equal(rejected[0].launch_site, 'https://learn-a.blackboard.sim.test');
    assert.deepEqual(await results(b, pub), []);
  } finally {
    expectStatus(await admin('PATCH', target, { active: false }), 200);
    expectStatus(await admin('PATCH', target, { active: true, siteUrl: b.connection.siteUrl }), 200);
  }
});
m1Test('M1-22.blackboard.text', 'Blackboard deployment errors identify Blackboard', async () => {
  const a = await bound();
  const l = await launch({ deploymentId: a.deploymentId, claims: { [LTI + 'deployment_id']: 'unknown' } });
  denied(l.response, 'UNKNOWN_DEPLOYMENT'); assert.ok(l.response.body.includes('Blackboard'));
});
m1Test('M1-27.blackboard.rebind', 'disconnect and same-library rebind revoke old keys and old publications across restart', async () => {
  const a = await bound(), old = await gradeWorks(a), before = await remote(a.platformId, a.deploymentId);
  expectStatus(await app(a.s, 'DELETE', connPath(a.connection.id)), 204);
  expectStatus(await service(old.play.token.services.serviceKey, 'GET', '/api/lineitems'), 403, 'DEPLOYMENT_NOT_ACTIVE');
  const connection = await createConnection(a.s), grant = await issueGrant(a.s, connection, a.deploymentId);
  const registered = await redeem(a.s, connection, a.deploymentId, grant); expectStatus(registered, 200);
  const newer = { ...a, connection: registered.json, grant };
  assert.equal((await remote(a.platformId, a.deploymentId))?.bindingGeneration, before!.bindingGeneration + 1);
  for (const restart of [false, true]) {
    if (restart) assert.equal((await host('m1-restart', { service: 'lti-service' })).code, 0);
    expectStatus(await service(old.play.token.services.serviceKey, 'GET', '/api/lineitems'), 401, 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');
    expectStatus(await idToken(old.play.result.ltik), 401, 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER');
  }
  const oldLink = await launch({ deploymentId: a.deploymentId, resource: old.pub.id });
  assert.equal(oldLink.response.status, 303);
  denied(await httpsRequest(String(oldLink.response.headers.location)), 'PUBLICATION_NOT_IN_CONNECTION', 404);
  const fresh = await gradeWorks(newer);
  assert.notEqual(fresh.play.token.services.serviceKey, old.play.token.services.serviceKey);
  const other = await createConnection(a.s);
  expectStatus(await redeem(a.s, other, a.deploymentId, a.grant), 403, 'GRANT_INVALID');
});
for (const status of [422, 400]) {
  m1Test(`M1-33.blackboard.mapping-${status}`, `LTI score API preserves permanent platform HTTP ${status}`, async () => {
    const a = await bound(), pub = await publication(a), play = await openPlay(a, pub, { scoreAnswers: [status] });
    const lineitem = play.token.services.assignmentAndGrades.lineItemId;
    const response = await service(play.token.services.serviceKey, 'POST',
      '/api/lineitems/' + encodeURIComponent(lineitem) + '/scores', {
        userId: play.token.user.id, scoreGiven: 7, scoreMaximum: 10,
        activityProgress: 'Completed', gradingProgress: 'FullyGraded',
      });
    expectStatus(response, status, 'PLATFORM_REJECTED_REQUEST');
  });
  m1Test(`M1-33.blackboard.status-${status}`, `score HTTP ${status} is permanent, with explicit resend of the best result`, async () => {
    const a = await bound(), pub = await publication(a), cursor = (await records()).cursor;
    const message = status === 400 ? 'timestamp older than the result' : 'assignment attempt limit reached';
    const play = await openPlay(a, pub, { scoreAnswers: [{ status, message }] });
    await commitGrade(play, 'scorm12', 7, 10);
    const sync = await waitSync(a, pub, 'failed', 1);
    assert.ok(sync.lastError.includes(message)); assert.notEqual(sync.status, 'conflict');
    await pause(60_000);
    const hits = (await records(cursor)).records.filter((r) => r.kind === 'score' && r.resource === pub.id);
    assert.equal(hits.length, 1);
    expectStatus(await app(a.s, 'POST', `/app-api/score-syncs/${sync.id}/resend`), 200);
    await waitSync(a, pub, 'sent');
    assert.equal((await records(cursor)).records.filter((r) => r.kind === 'score' && r.resource === pub.id).length, 2);
  });
}
m1Test('M1-31.blackboard.publication-fields', 'publication create, list and replacement return LMS and connection name', async () => {
  const a = await bound(), pub = await publication(a);
  const list = await app(a.s, 'GET', '/app-api/publications?connectionId=' + a.connection.id); expectStatus(list, 200);
  for (const row of [...list.json.publications, await newVersion(a, pub)]) {
    assert.equal(row.lms, 'blackboard'); assert.equal(row.connectionName, a.connection.name);
  }
});
