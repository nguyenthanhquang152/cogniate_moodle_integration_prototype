// T3a negative and security cases. Source: tasks/T3a.md AC-T3-10, -16, -17, -18, -23; contract §3.2, §3.4, §1.3;
// security §8, §9. Uses the "QA DL" activity of 1-deep-linking.spec.ts and its service key (2-scores.spec.ts).
//
// AC-T3-10 "two items when acceptMultiple is false": Moodle 5.2.4 always sends accept_multiple = true for
// "Select content" (mod/lti/locallib.php:1057 default $multiple = true; contentitem.php:61 and auth.php:141-142 use it).
// So QA makes that launch with the QA platform (deep_linking_settings.accept_multiple = false).
import crypto from 'node:crypto';
import { publicUrls } from '../lib/env';
import {
  ACCOUNT,
  apiKey,
  auth,
  errorCode,
  eventsSince,
  hasErrorShape,
  hostIs,
  loadState,
  ltiApi,
  ltiSeed,
  SECOND_ACCOUNT,
  sinkHitsSince,
} from '../lib/lti';
import { addToolActivity, createManualTool } from '../lib/moodle-dl';
import { launchActivity, newStackContext } from '../lib/moodle-launch';
import { gradeItems } from '../lib/moodle-ws';
import { expect, test } from '../lib/pw';
import { deepLinkingClaims, qaLaunchLtik, setupQaPlatform } from '../lib/qa-platform';
import { seed } from '../lib/seed';

const urls = publicUrls();
const enc = encodeURIComponent;
const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;

interface IdToken {
  services: { assignmentAndGrades: { lineItemId?: string }; serviceKey?: string };
}

const score = (userId: number | string, scoreGiven = 50) => ({ userId: String(userId), activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven, scoreMaximum: 100 });

async function settle() {
  await new Promise((r) => setTimeout(r, 1_500));
}

test.describe.serial('T3a negative cases', () => {
  let serviceKey = '';
  let lineItemId = '';
  let studentLtik = '';

  test.beforeAll(() => {
    const state = loadState('T3a');
    serviceKey = String(state.serviceKey ?? '');
    lineItemId = String(state.lineItemId ?? '');
    studentLtik = String(state.studentLtik ?? '');
    expect(serviceKey && lineItemId && studentLtik, 'AC-T3-11 stored the service key, line item and a student ltik').toBeTruthy();
  });

  test('AC-T3-10 content item on evil.test, two items with acceptMultiple=false → 400 INVALID_CONTENT_ITEM; resource-link ltik → 403', async () => {
    const key = apiKey(ACCOUNT);
    const p = await setupQaPlatform(key, 't3a-dl');
    const item = (n: number, url = `${urls.lti}/lti/launch/${ACCOUNT}?resource=qa-${n}`) => ({ type: 'ltiResourceLink', title: `QA item ${n}`, url, lineItem: { scoreMaximum: 100, label: `QA item ${n}` } });

    const multiLtik = await qaLaunchLtik(p, (login) => deepLinkingClaims(p, login, true));
    const evil = await ltiApi('POST', '/api/deeplinking', { authorization: auth.ltik(key, multiLtik), body: { contentItems: [item(1, 'https://evil.test/x')] } });
    expect(evil.status, evil.body).toBe(400);
    expect(errorCode(evil)).toBe('INVALID_CONTENT_ITEM');
    expect(hasErrorShape(evil)).toBe(true);

    const singleLtik = await qaLaunchLtik(p, (login) => deepLinkingClaims(p, login, false));
    const control = await ltiApi('POST', '/api/deeplinking', { authorization: auth.ltik(key, singleLtik), body: { contentItems: [item(1)] } });
    expect(control.status, `control: one item with acceptMultiple=false: ${control.body}`).toBe(200);
    const two = await ltiApi('POST', '/api/deeplinking', { authorization: auth.ltik(key, singleLtik), body: { contentItems: [item(1), item(2)] } });
    expect(two.status, two.body).toBe(400);
    expect(errorCode(two)).toBe('INVALID_CONTENT_ITEM');

    const rl = await ltiApi('POST', '/api/deeplinking', { authorization: auth.ltik(key, studentLtik), body: { contentItems: [item(1)] } });
    expect(rl.status, rl.body).toBe(403);
    expect(errorCode(rl)).toBe('SERVICE_NOT_AVAILABLE');
  });

  test('AC-T3-16 a line item on evil.test, and the line item of another course → 400 INVALID_LINE_ITEM_ID, no outbound request', async ({ browser }) => {
    const key = apiKey(ACCOUNT);
    const authz = auth.service(key, serviceKey);
    const since = Date.now() - 1_000;
    const evilId = 'https%3A%2F%2Fevil.test%2Fx';
    const reads = await ltiApi('GET', `/api/lineitems/${evilId}`, { authorization: authz });
    const posts = await ltiApi('POST', `/api/lineitems/${evilId}/scores`, { authorization: authz, body: score(seed().users.cg_student.id) });
    for (const [label, res] of [['GET', reads], ['POST scores', posts]] as const) {
      expect(res.status, `${label}: ${res.body}`).toBe(400);
      expect(errorCode(res), label).toBe('INVALID_LINE_ITEM_ID');
    }
    await settle();
    expect(sinkHitsSince(since), 'sink hits').toEqual([]);
    expect(eventsSince('lti-service', since, (e) => /^outbound_/.test(String(e.event)) && hostIs(e, 'evil.test')), 'outbound_* for evil.test').toEqual([]);

    // The line item URL of "Seed activity 102" (COGNIATE-DEV-102), from a cg_student launch there.
    const context = await newStackContext(browser);
    try {
      const launch = await launchActivity(context, seed().users.cg_student, ltiSeed().cmids['COGNIATE-DEV-102']);
      const t = await ltiApi<IdToken>('GET', '/api/idtoken', { authorization: auth.ltik(key, launch.ltik!) });
      const other = String(t.json.services.assignmentAndGrades.lineItemId ?? '');
      expect(other, 'Seed activity 102 has a line item').toMatch(/\/mod\/lti\/services\.php\//);
      const res = await ltiApi('POST', `/api/lineitems/${enc(other)}/scores`, { authorization: authz, body: score(seed().users.cg_student.id) });
      expect(res.status, res.body).toBe(400);
      expect(errorCode(res)).toBe('INVALID_LINE_ITEM_ID');
      await settle();
      expect(eventsSince('lti-service', 0, (e) => e.event === 'outbound_request' && e.trace_id === res.traceId), 'outbound_request for that call').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('AC-T3-23 same course, another tool: the "QA DL" service key cannot write tool B line items (with and without type_id)', async ({ browser }) => {
    test.setTimeout(240_000);
    const key = apiKey(ACCOUNT);
    const s = seed();
    const course = s.courses['COGNIATE-DEV-101'];
    const context = await newStackContext(browser);
    try {
      const page = await context.newPage();
      const tool = await createManualTool(page, s.users.admin, `QA tool B ${runId}`);
      const reg = await ltiApi('POST', '/api/platforms', {
        authorization: auth.bearer(key),
        body: {
          url: urls.moodle,
          clientId: tool.clientId,
          name: `QA tool B ${runId}`,
          authenticationEndpoint: `${urls.moodle}/mod/lti/auth.php`,
          accesstokenEndpoint: `${urls.moodle}/mod/lti/token.php`,
          authConfig: { method: 'JWK_SET', key: `${urls.moodle}/mod/lti/certs.php` },
          deploymentIds: [String(tool.typeId)],
        },
      });
      expect(reg.status, reg.body).toBe(201);
      const activity = `QA tool B activity ${runId}`;
      const cmid = await addToolActivity(page, s.users.cg_teacher, course, tool.typeId, activity);
      const launch = await launchActivity(context, s.users.cg_student, cmid);
      const t = await ltiApi<IdToken>('GET', '/api/idtoken', { authorization: auth.ltik(key, launch.ltik!) });
      const bItem = String(t.json.services.assignmentAndGrades.lineItemId ?? '');
      expect(bItem, 'tool B activity has a line item with type_id').toMatch(/[?&]type_id=/);
      const before = (await gradeItems(s.oracleToken, course, s.users.cg_student.id)).find((i) => i.itemname === activity)?.graderaw ?? null;

      const withoutType = (() => {
        const u = new URL(bItem);
        u.searchParams.delete('type_id');
        return u.toString();
      })();
      const authz = auth.service(key, serviceKey);
      for (const [label, id] of [['with type_id of tool B', bItem], ['without type_id', withoutType]] as const) {
        const res = await ltiApi('POST', `/api/lineitems/${enc(id)}/scores`, { authorization: authz, body: score(s.users.cg_student.id, 77) });
        expect(res.status, `${label}: ${res.body}`).toBe(400);
        expect(errorCode(res), label).toBe('INVALID_LINE_ITEM_ID');
        await settle();
        expect(eventsSince('lti-service', 0, (e) => e.event === 'outbound_request' && e.trace_id === res.traceId), `${label}: outbound_request`).toEqual([]);
      }
      const after = (await gradeItems(s.oracleToken, course, s.users.cg_student.id)).find((i) => i.itemname === activity)?.graderaw ?? null;
      expect(after, "tool B's grade does not change").toBe(before);
    } finally {
      await context.close();
    }
  });

  test('AC-T3-17 a score for cg_teacher, and for a user who is not in the course → 400 PLATFORM_REJECTED_REQUEST', async () => {
    const authz = auth.service(apiKey(ACCOUNT), serviceKey);
    for (const [label, user] of [['cg_teacher', seed().users.cg_teacher.id], ['admin (not enrolled)', seed().users.admin.id]] as const) {
      const res = await ltiApi('POST', `/api/lineitems/${enc(lineItemId)}/scores`, { authorization: authz, body: score(user) });
      expect(res.status, `${label}: ${res.body}`).toBe(400);
      expect(errorCode(res), label).toBe('PLATFORM_REJECTED_REQUEST');
    }
  });

  test('AC-T3-18 a service key with the qa-second API key → 401; SERVICE-AUTH-V1 on /api/idtoken → 401 INVALID_AUTHORIZATION_HEADER', async () => {
    const other = await ltiApi('GET', '/api/lineitems', { authorization: auth.service(apiKey(SECOND_ACCOUNT), serviceKey) });
    expect(other.status).toBe(401);
    expect(errorCode(other)).toBe('INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');
    const idt = await ltiApi('GET', '/api/idtoken', { authorization: auth.service(apiKey(ACCOUNT), serviceKey) });
    expect(idt.status).toBe(401);
    expect(errorCode(idt)).toBe('INVALID_AUTHORIZATION_HEADER');
  });
});
