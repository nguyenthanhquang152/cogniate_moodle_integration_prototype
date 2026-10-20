// Canvas grades, roles, disconnect, texts, self-hosted and split origins:
// AC-M1-09, -14 (runtime), -16, -18, -22, -26, -32, -33 (Canvas parts).
import fs from 'node:fs';
import path from 'node:path';
import { exportJWK, generateKeyPair } from 'jose';
import gradeCases from '../../../fixtures/multi-lms/grade-cases.json';
import { LAUNCH_URL } from '../../lib/lti';
import { QA_DEPLOYMENT, QA_FIXTURE_DIR, QA_ISSUER, postLaunch, qaLogin, resourceLinkClaims, signRs256 } from '../../lib/qa-platform';
import {
  AGS, APP, LTI, admin, app, assert, connPath, deploymentPath, expectStatus, host, httpsRequest, idToken,
  logEvents, m1Test, parseForm, pause, poll, records, service, session, unique, type Json,
} from '../common/client';
import { commitGrade, newVersion, pick, publication, results, waitSync } from '../common/course';
import {
  CANVAS_SCORE, CLOUD, PATHS, ROLE, SELF, addGrant, appPage, canvasBound, canvasDeepLink, canvasLaunch, canvasPicker,
  canvasPlay, grantState, refused, scoreRecords, verifyToolJwt, type CanvasBinding,
} from './canvas';

const SCOPE = ['https://purl.imsglobal.org/spec/lti-ags/scope/lineitem', 'https://purl.imsglobal.org/spec/lti-ags/scope/score'];

// ---------------------------------------------------------------- AC-M1-09 grade return
for (const fixture of gradeCases) {
  m1Test(`M1-09.canvas.${fixture.id}`, `Canvas grade fixture ${fixture.id}: cold token at the account domain and ADR-010 score`, async () => {
    const b = await canvasBound(), pub = await publication(b, fixture.format as 'html' | 'scorm12');
    assert.equal((await host('m1-restart', { service: 'lti-service' })).code, 0, 'Cold access token cache');
    const cursor = (await records()).cursor, play = await canvasPlay(b, pub);
    assert.match(play.location.pathname, /\/embedded$/, 'Canvas iframe target opens the embedded page first');
    await commitGrade(play, fixture.format, fixture.raw, fixture.maximum, fixture.complete);
    if (fixture.expected) {
      const sync = await waitSync(b, pub, 'sent');
      const entries = (await records(cursor)).records, score = entries.filter((r) => r.kind === 'score' && r.resource === pub.id);
      assert.equal(score.length, 1);
      assert.deepEqual([score[0].body.scoreGiven, score[0].body.scoreMaximum], fixture.expected);
      assert.equal(score[0].body.userId, 'learner-1');
      assert.equal(score[0].body.activityProgress, 'Completed'); assert.equal(score[0].body.gradingProgress, 'FullyGraded');
      assert.equal(score[0].host, 'school-a.canvas.sim.test');
      assert.equal(score[0].path, `${PATHS.lineitems}/${encodeURIComponent(pub.id)}/scores`);
      assert.equal(String(score[0].contentType).split(';')[0], 'application/vnd.ims.lis.v1.score+json');
      const token = entries.find((r) => r.kind === 'token' && r.tokenRef === score[0].tokenRef);
      assert.ok(token, 'Cold-cache score uses a verified client assertion');
      assert.equal(token.host, 'school-a.canvas.sim.test'); assert.equal(token.path, PATHS.token);
      assert.equal(token.audience, `${CLOUD.siteA}${PATHS.token}`, 'Assertion aud is the token URL as a string');
      assert.equal(token.clientId, b.clientId);
      assert.equal(entries.some((r) => r.host === 'school-b.canvas.sim.test'), false);
      const rows = await results(b, pub);
      assert.equal(rows[0].learner.label, 'Learner learner-1 @ school-a.canvas.sim.test');
      assert.equal(sync.status, 'sent');
    } else {
      await pause(5000);
      const rows = await results(b, pub);
      assert.equal(rows.length, 1); assert.deepEqual(rows[0].scoreSyncs, []);
      assert.deepEqual(await scoreRecords(cursor, pub.id), []);
    }
  });
}
for (const format of ['scorm12', 'html'] as const) {
  m1Test(`M1-09.canvas.best-${format}`, `Canvas 80, 60, 90 sends 80 and 90 only (${format})`, async () => {
    const b = await canvasBound(), pub = await publication(b, format), cursor = (await records()).cursor;
    for (const [index, score] of [80, 60, 90].entries()) {
      if (index) await newVersion(b, pub);
      const play = await canvasPlay(b, pub, { resourceLinkId: 'best-' + pub.id });
      await commitGrade(play, format, format === 'html' ? score / 10 : score, format === 'html' ? 10 : 100);
      if (score !== 60) await poll(() => scoreRecords(cursor, pub.id), (rows) => rows.some((r) => r.body.scoreGiven === score), 20_000);
      else { await pause(5000); assert.equal((await results(b, pub))[0].best?.scoreGiven, 80); }
    }
    assert.deepEqual((await scoreRecords(cursor, pub.id)).map((r) => [r.body.scoreGiven, r.body.scoreMaximum]), [[80, 100], [90, 100]]);
  });
}
m1Test('M1-09.canvas.embedded-page', 'the Canvas embedded page has a nonce script, site framing and no form action', async () => {
  const b = await canvasBound(), pub = await publication(b), play = await canvasPlay(b, pub);
  const page = await httpsRequest(`${APP}/play/${play.playId}/embedded`); expectStatus(page, 200);
  const csp = String(page.headers['content-security-policy']);
  assert.ok(csp.includes(`frame-ancestors ${CLOUD.siteA}`), csp);
  assert.ok(/form-action 'none'/.test(csp), csp);
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce, 'script-src uses a nonce');
  assert.ok(page.body.includes(`nonce="${nonce}"`), 'The script carries the CSP nonce');
  assert.ok(page.body.includes('Open in a new window'));
  assert.ok(page.body.includes(`/play/${play.playId}`));
});
m1Test('M1-09.canvas.moodle-static-control', 'a standard (Moodle) iframe launch keeps the static embedded page without script', async () => {
  const s = await session(), id = unique('cvstd'), kid = `qa-${id}`, file = `jwks-${id}.json`;
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  fs.mkdirSync(QA_FIXTURE_DIR, { recursive: true });
  fs.writeFileSync(path.join(QA_FIXTURE_DIR, file), JSON.stringify({ keys: [{ ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' }] }));
  try {
    const clientId = `qa-client-${id}`;
    const c = await app(s, 'POST', '/app-api/connections', { name: unique('QA standard'), siteUrl: QA_ISSUER, method: 'manual' }); expectStatus(c, 201);
    const reg = await app(s, 'PUT', connPath(c.json.id) + '/platform', { issuer: QA_ISSUER, clientId, deploymentId: QA_DEPLOYMENT,
      authenticationEndpoint: `${QA_ISSUER}/auth`, accessTokenEndpoint: `${QA_ISSUER}/token`, jwksUrl: `${QA_ISSUER}/${file}` });
    expectStatus(reg, 200); assert.equal(reg.json.lms, 'moodle');
    const pub = await publication({ s, connection: reg.json }, 'html');
    const login = await qaLogin({ clientId }, `${LAUNCH_URL}?resource=${pub.id}`); assert.equal(login.status, 302);
    const claims = { ...resourceLinkClaims({ clientId }, login), [LTI + 'launch_presentation']: { document_target: 'iframe' } };
    const launched = await postLaunch({ id_token: await signRs256(claims, privateKey, kid), state: login.state }, login.cookie);
    assert.equal(launched.status, 303, launched.body.slice(0, 200));
    const handoff = await httpsRequest(launched.location); assert.equal(handoff.status, 303);
    const embedded = new URL(String(handoff.headers.location), APP); assert.match(embedded.pathname, /^\/play\/ply_[^/]+\/embedded$/);
    const page = await httpsRequest(embedded.href); expectStatus(page, 200);
    assert.equal(/<script\b/i.test(page.body), false, 'Moodle embedded page has no script');
    assert.ok(String(page.headers['content-security-policy']).includes(`frame-ancestors ${QA_ISSUER}`));
    assert.ok(page.body.includes('Open in a new window'));
  } finally { fs.rmSync(path.join(QA_FIXTURE_DIR, file), { force: true }); }
});

// ---------------------------------------------------------------- AC-M1-14 runtime identity (API part)
m1Test('M1-14.canvas.runtime-identity', 'the SCORM runtime state of a Canvas launch has an empty learner name', async () => {
  const b = await canvasBound(), pub = await publication(b);
  const play = await canvasPlay(b, pub, { claims: { name: 'Private Canvas learner', email: 'private@canvas.example' } });
  assert.equal(play.state.learner?.name, '');
  assert.equal(JSON.stringify(play.state).includes('Private Canvas learner'), false);
});

// ---------------------------------------------------------------- AC-M1-16 roles
const roleRows: [string, string[], boolean][] = [
  ['learner-institution-instructor', [ROLE.learner, ROLE.institutionInstructor], false],
  ['learner', [ROLE.learner], false],
  ['student-view', [ROLE.learner, ROLE.testUser], false],
  ['simple-learner', ['Learner'], false],
  ['instructor', [ROLE.instructor], true],
  ['teaching-assistant', [ROLE.teachingAssistant], true],
  ['simple-instructor', ['Instructor'], true],
  ['institution-admin', [ROLE.institutionAdmin], true],
  ['learner-and-instructor', [ROLE.learner, ROLE.instructor], true],
];
let roleSetup: Promise<{ b: CanvasBinding; pub: Json }> | undefined;
const roleBinding = () => roleSetup ??= (async () => { const b = await canvasBound(); return { b, pub: await publication(b) }; })();
for (const [variant, roles, staff] of roleRows) {
  m1Test(`M1-16.canvas.${variant}`, `Canvas roles ${variant}: preview ${staff} and Deep Linking ${staff ? 'picker' : 'refused'}`, async () => {
    const { b, pub } = await roleBinding();
    const play = await canvasPlay(b, pub, { roles });
    const status = await httpsRequest(`${APP}/app-api/play/${play.playId}/status`); expectStatus(status, 200);
    assert.equal(JSON.parse(status.body).preview, staff);
    const dl = await canvasDeepLink(b, { roles }); assert.equal(dl.response.status, 303);
    const handoff = await appPage(dl.response);
    if (staff) {
      assert.equal(handoff.status, 303);
      assert.match(new URL(String(handoff.headers.location), APP).pathname, /^\/tool\/picker\/pck_/);
    } else {
      refused(handoff, 'ROLE_NOT_ALLOWED', [403]);
    }
  });
}
m1Test('M1-16.canvas.graded-vs-preview', 'a graded Canvas learner sends a score; an instructor preview makes no row and no POST', async () => {
  const b = await canvasBound(), graded = await publication(b), preview = await publication(b), cursor = (await records()).cursor;
  const learner = await canvasPlay(b, graded, { roles: [ROLE.learner, ROLE.institutionInstructor] });
  await commitGrade(learner, 'scorm12', 7, 10); await waitSync(b, graded, 'sent');
  assert.equal((await scoreRecords(cursor, graded.id)).length, 1);
  const teacher = await canvasPlay(b, preview, { roles: [ROLE.instructor] });
  await commitGrade(teacher, 'scorm12', 7, 10); await pause(5000);
  const rows = await results(b, preview);
  assert.ok(rows.every((r) => r.preview === true && r.scoreSyncs.length === 0), 'Preview has no score sync row');
  assert.deepEqual(await scoreRecords(cursor, preview.id), []);
});

// ---------------------------------------------------------------- AC-M1-18 disconnect
m1Test('M1-18.canvas.disconnect', 'a Canvas DELETE switches its platform off, as Moodle does', async () => {
  const b = await canvasBound();
  expectStatus(await app(b.s, 'DELETE', connPath(b.connection.id)), 204);
  const remote = await admin('GET', `/api/platforms/${b.platformId}`); expectStatus(remote, 200);
  assert.equal(remote.json.active, false);
  assert.equal((await app(b.s, 'GET', connPath(b.connection.id))).json.status, 'disabled');
  refused((await canvasLaunch(b)).login, 'PLATFORM_NOT_ACTIVE', [403]);
});
m1Test('M1-18.canvas.pending-score', 'a pending Canvas score row fails with CONNECTION_DISABLED at its due time after disconnect', async () => {
  const b = await canvasBound(), pub = await publication(b), cursor = (await records()).cursor;
  const play = await canvasPlay(b, pub, { scoreAnswers: [503, 503] });
  await commitGrade(play, 'scorm12', 7, 10);
  const pending = await waitSync(b, pub, 'pending', 2, 30_000);
  const disabledAt = Date.now();
  expectStatus(await app(b.s, 'DELETE', connPath(b.connection.id)), 204);
  const after = (await records()).cursor;
  const failed = await waitSync(b, pub, 'failed', 2, 30_000 + 2 * 2000 + 5000 + 10_000);
  assert.equal(failed.id, pending.id); assert.equal(failed.lastError, 'CONNECTION_DISABLED'); assert.equal(failed.tries, 2);
  assert.ok(Date.now() - disabledAt >= 20_000, 'The row did not fail at the disable; it waited for its due time');
  assert.deepEqual(await scoreRecords(after, pub.id), [], 'No score POST after the disable');
  assert.equal((await scoreRecords(cursor, pub.id)).length, 2);
  expectStatus(await app(b.s, 'POST', `/app-api/score-syncs/${failed.id}/resend`), 409, 'CONNECTION_NOT_READY');
  expectStatus(await app(b.s, 'POST', `/app-api/publications/${pub.id}/results/refresh`), 409, 'CONNECTION_NOT_READY');
}, 240_000);
m1Test('M1-18.canvas.grant-revoked', 'a Canvas disconnect revokes its unredeemed grants', async () => {
  const b = await canvasBound(), grant = await addGrant(b, unique('d2'));
  expectStatus(await app(b.s, 'DELETE', connPath(b.connection.id)), 204);
  await grantState(grant, b.connection.id, 'revoked');
});

// ---------------------------------------------------------------- AC-M1-22 texts
m1Test('M1-22.canvas.unknown-deployment-text', 'an unknown Canvas deployment page names Canvas, not Moodle', async () => {
  const b = await canvasBound();
  const l = await canvasLaunch(b, { claims: { [LTI + 'deployment_id']: 'unknown-deployment' } });
  refused(l.response, 'UNKNOWN_DEPLOYMENT');
  assert.ok(l.response.body.includes('Canvas')); assert.equal(l.response.body.includes('Moodle'), false);
});
m1Test('M1-22.canvas.inactive-text', 'the DEPLOYMENT_NOT_ACTIVE page of Canvas names Canvas', async () => {
  const b = await canvasBound();
  expectStatus(await admin('PATCH', deploymentPath(b.platformId, b.deploymentId), { active: false }), 200);
  try {
    const l = await canvasLaunch(b); refused(l.login, 'DEPLOYMENT_NOT_ACTIVE', [403]);
    assert.ok(l.login.body.includes('Canvas')); assert.equal(l.login.body.includes('Moodle'), false);
  } finally { expectStatus(await admin('PATCH', deploymentPath(b.platformId, b.deploymentId), { active: true }), 200); }
});
m1Test('M1-22.canvas.back-to-canvas', 'the Canvas player shows Back to Canvas', async () => {
  const b = await canvasBound(), pub = await publication(b), play = await canvasPlay(b, pub);
  assert.ok(play.shell.body.includes('Back to Canvas')); assert.equal(play.shell.body.includes('Back to Moodle'), false);
});
m1Test('M1-22.canvas.role-text', 'the ROLE_NOT_ALLOWED page of a Canvas learner names Canvas', async () => {
  const b = await canvasBound(), dl = await canvasDeepLink(b, { roles: [ROLE.learner] });
  const page = await appPage(dl.response); refused(page, 'ROLE_NOT_ALLOWED', [403]);
  assert.ok(page.body.includes('Canvas')); assert.equal(page.body.includes('Moodle'), false);
});

// ---------------------------------------------------------------- AC-M1-26 self-hosted Canvas through the app
const selfBound = () => canvasBound('A', { profile: SELF.profile, siteUrl: SELF.site, serviceUrl: SELF.service });
m1Test('M1-26.canvas.register', 'a self-hosted Canvas grant for site and service registers its own issuer', async () => {
  const b = await selfBound();
  assert.equal(b.connection.platform.issuer, SELF.site);
  assert.equal(b.connection.platform.siteUrl, SELF.site); assert.equal(b.connection.platform.serviceUrl, SELF.service);
});
m1Test('M1-26.canvas.deep-link', 'self-hosted Deep Linking verifies with the site JWKS and returns to the site', async () => {
  const b = await selfBound(), pub = await publication(b, 'html');
  assert.equal((await host('m1-restart', { service: 'lti-service' })).code, 0, 'Cold JWKS cache');
  const cursor = (await records()).cursor, picker = await canvasPicker(b);
  const selected = await pick(picker.url, pub.id); expectStatus(selected, 200);
  const form = parseForm(selected.body); assert.equal(new URL(form.action).host, 'canvas-self.sim.test');
  expectStatus(await httpsRequest(form.action, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form.fields).toString() }), 200);
  const claims = await verifyToolJwt(form.fields.JWT); assert.equal(claims.aud, SELF.site);
  const entries = (await records(cursor)).records;
  assert.ok(entries.some((r) => r.kind === 'jwks' && r.host === 'canvas-self.sim.test' && r.path === '/api/lti/security/jwks'));
  assert.equal(entries.some((r) => ['sso.canvas.sim.test', 'school-a.canvas.sim.test', 'school-b.canvas.sim.test'].includes(r.host)), false);
});
m1Test('M1-26.canvas.grade', 'self-hosted score uses the service host token URL and AGS', async () => {
  const b = await selfBound(), pub = await publication(b);
  assert.equal((await host('m1-restart', { service: 'lti-service' })).code, 0, 'Cold access token cache');
  const cursor = (await records()).cursor, play = await canvasPlay(b, pub);
  await commitGrade(play, 'scorm12', 7, 10); await waitSync(b, pub, 'sent');
  const entries = (await records(cursor)).records, score = entries.filter((r) => r.kind === 'score' && r.resource === pub.id);
  assert.equal(score.length, 1); assert.equal(score[0].host, 'api.canvas-self.sim.test');
  const token = entries.find((r) => r.kind === 'token' && r.tokenRef === score[0].tokenRef);
  assert.equal(token?.host, 'api.canvas-self.sim.test'); assert.equal(token?.audience, `${SELF.service}${PATHS.token}`);
  assert.equal(entries.some((r) => ['canvas-self.sim.test', 'sso.canvas.sim.test'].includes(r.host) && ['token', 'ags', 'score', 'nrps'].includes(r.kind)), false);
});
m1Test('M1-26.canvas.page-host-ags', 'self-hosted AGS on the page host is refused by check 13', async () => {
  const b = await selfBound(), since = Date.now();
  const url = `${SELF.site}${PATHS.lineitems}`;
  const l = await canvasLaunch(b, { claims: { [AGS]: { lineitems: url, lineitem: url + '/x', scope: SCOPE } } });
  refused(l.response, 'SERVICE_ORIGIN_MISMATCH', [400]);
  assert.ok(logEvents('launch_check_failed', since, { check: '13' }, 'lti-service')
    .some((e) => /^claim=ags_lineitems? host=https:\/\/canvas-self\.sim\.test$/.test(String(e.detail))));
});
m1Test('M1-26.canvas.no-cloud-hosts', 'a self-hosted launch, Deep Linking and grade never call a cloud issuer or SSO host', async () => {
  const b = await selfBound(), pub = await publication(b), cursor = (await records()).cursor;
  const play = await canvasPlay(b, pub); await commitGrade(play, 'scorm12', 7, 10); await waitSync(b, pub, 'sent');
  await canvasPicker(b);
  const entries = (await records(cursor)).records;
  assert.ok(entries.length > 0);
  assert.equal(entries.some((r) => r.provider === CLOUD.provider), false);
});

// ---------------------------------------------------------------- AC-M1-32 page and service origins
const splitBound = () => canvasBound('A', { siteUrl: CLOUD.pageA, serviceUrl: CLOUD.siteA });
m1Test('M1-32.canvas.deep-link', 'split Canvas Deep Linking frames on the page host and returns there', async () => {
  const b = await splitBound(), pub = await publication(b, 'html'), cursor = (await records()).cursor;
  assert.equal(b.pageHost, 'canvas.school-a.sim.test'); assert.equal(b.serviceHost, 'school-a.canvas.sim.test');
  const picker = await canvasPicker(b);
  assert.ok(String(picker.page.headers['content-security-policy']).includes(`frame-ancestors ${CLOUD.pageA}`));
  const selected = await pick(picker.url, pub.id); expectStatus(selected, 200);
  const form = parseForm(selected.body); assert.equal(new URL(form.action).host, 'canvas.school-a.sim.test');
  assert.equal(form.action, picker.settings.deep_link_return_url);
  expectStatus(await httpsRequest(form.action, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form.fields).toString() }), 200);
  assert.ok((await records(cursor)).records.some((r) => r.kind === 'deep-link' && r.host === 'canvas.school-a.sim.test'));
});
m1Test('M1-32.canvas.grade', 'split Canvas score uses the service host and the player link stays on the page host', async () => {
  const b = await splitBound(), pub = await publication(b);
  assert.equal((await host('m1-restart', { service: 'lti-service' })).code, 0, 'Cold access token cache');
  const cursor = (await records()).cursor, play = await canvasPlay(b, pub);
  await commitGrade(play, 'scorm12', 7, 10); await waitSync(b, pub, 'sent');
  const entries = (await records(cursor)).records, score = entries.filter((r) => r.kind === 'score' && r.resource === pub.id);
  assert.equal(score[0]?.host, 'school-a.canvas.sim.test');
  const token = entries.find((r) => r.kind === 'token' && r.tokenRef === score[0].tokenRef);
  assert.equal(token?.audience, `${CLOUD.siteA}${PATHS.token}`);
  const back = play.shell.body.match(/<a\b[^>]*href="([^"]+)"[^>]*>[^<]*Back to Canvas/i)?.[1]?.replaceAll('&amp;', '&');
  assert.ok(back, 'Back to Canvas link'); assert.equal(new URL(back).host, 'canvas.school-a.sim.test');
});
m1Test('M1-32.canvas.dl-on-service-host', 'split Deep Linking return on the service host is refused', async () => {
  const b = await splitBound(), since = Date.now();
  refused((await canvasDeepLink(b, { pageHost: 'school-a.canvas.sim.test' })).response, 'SERVICE_ORIGIN_MISMATCH', [400]);
  assert.ok(logEvents('launch_check_failed', since, { check: '13' }, 'lti-service')
    .some((e) => e.detail === 'claim=dl_return host=https://school-a.canvas.sim.test'));
});
m1Test('M1-32.canvas.ags-on-page-host', 'split AGS line items on the page host are refused', async () => {
  const b = await splitBound(), since = Date.now();
  const l = await canvasLaunch(b, { claims: { [AGS]: { lineitems: `${CLOUD.pageA}${PATHS.lineitems}`, scope: SCOPE } } });
  refused(l.response, 'SERVICE_ORIGIN_MISMATCH', [400]);
  assert.ok(logEvents('launch_check_failed', since, { check: '13' }, 'lti-service')
    .some((e) => e.detail === 'claim=ags_lineitems host=https://canvas.school-a.sim.test'));
});
m1Test('M1-32.canvas.idtoken', 'split Canvas idtoken shows both origins', async () => {
  const b = await splitBound(), l = await canvasLaunch(b); assert.equal(l.response.status, 303);
  const token = await idToken(l.ltik); expectStatus(token, 200);
  assert.equal(token.json.platform.siteUrl, CLOUD.pageA); assert.equal(token.json.platform.serviceUrl, CLOUD.siteA);
});

// ---------------------------------------------------------------- AC-M1-33 platform score errors
for (const status of [422, 400] as const) {
  m1Test(`M1-33.canvas.mapping-${status}`, `the LTI score API keeps the Canvas HTTP ${status} as PLATFORM_REJECTED_REQUEST`, async () => {
    const b = await canvasBound(), pub = await publication(b);
    const message = status === 400 ? CANVAS_SCORE.olderTimestamp : CANVAS_SCORE.attemptLimit;
    const play = await canvasPlay(b, pub, { scoreAnswers: [{ status, message }] });
    const lineitem = play.token.services.assignmentAndGrades.lineItemId;
    const response = await service(play.token.services.serviceKey, 'POST', '/api/lineitems/' + encodeURIComponent(lineitem) + '/scores', {
      userId: play.token.user.id, scoreGiven: 7, scoreMaximum: 10, activityProgress: 'Completed', gradingProgress: 'FullyGraded',
    });
    expectStatus(response, status, 'PLATFORM_REJECTED_REQUEST');
  });
  m1Test(`M1-33.canvas.status-${status}`, `Canvas score HTTP ${status} fails at once, never retries, and Resend follows rule 10`, async () => {
    const b = await canvasBound(), pub = await publication(b), cursor = (await records()).cursor;
    const message = status === 400 ? CANVAS_SCORE.olderTimestamp : CANVAS_SCORE.attemptLimit;
    const play = await canvasPlay(b, pub, { scoreAnswers: [{ status, message }] });
    await commitGrade(play, 'scorm12', 7, 10);
    const sync = await waitSync(b, pub, 'failed', 1);
    assert.ok(String(sync.lastError).includes(message)); assert.notEqual(sync.status, 'conflict');
    await pause(60_000);
    assert.equal((await scoreRecords(cursor, pub.id)).length, 1, 'No automatic retry within 60 s');
    expectStatus(await app(b.s, 'POST', `/app-api/score-syncs/${sync.id}/resend`), 200);
    await waitSync(b, pub, 'sent');
    assert.equal((await scoreRecords(cursor, pub.id)).length, 2);
  }, 240_000);
}
