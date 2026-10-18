// T3c: compatibility endpoints. Source: tasks/T3c.md AC-T3-09, -15, -20, -21; contract lti-service-api.md §1.3 (error
// shape), §3.2 (/api/deeplinking/form and /message), §3.5 (line item writes need the AGS lineitem scope), §3.7
// (memberships, no personal fields), §3.10 (OAuth stubs). T3c runs in the same pass after T3a (tests/host/run-t3c.mjs):
// it uses the T3a activity "QA DL" (state "T3a") and the seed tool. AC-T3-19 deletes the seed platform, so it is in
// 9-delete-platform.spec.ts (last file).
import crypto from 'node:crypto';
import type { BrowserContext } from '@playwright/test';
import { createLocalJWKSet, type JWTPayload, jwtVerify } from 'jose';
import { publicUrls } from '../lib/env';
import { httpsRequest } from '../lib/https';
import {
  ACCOUNT,
  apiKey,
  auth,
  errorCode,
  eventsSince,
  hasErrorShape,
  hostIs,
  LTI_CLAIM,
  loadState,
  ltiApi,
  ltiSeed,
  saveState,
  sinkHitsSince,
} from '../lib/lti';
import { deepLinkActivity } from '../lib/moodle-dl';
import { launchActivity, newStackContext } from '../lib/moodle-launch';
import { gradeItems } from '../lib/moodle-ws';
import { expect, test } from '../lib/pw';
import { QA_ISSUER, qaLaunchLtik, resourceLinkClaims, setupQaPlatform } from '../lib/qa-platform';
import { seed } from '../lib/seed';

const urls = publicUrls();
const enc = encodeURIComponent;
const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const AGS_CLAIM = 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint';
const SUBMIT_SCRIPT = '<script>document.getElementById("lti_dl_submit").submit()</script>';
const unescapeHtml = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 1_500));
}

async function verifyDl(jwt: string): Promise<JWTPayload> {
  const jwks = JSON.parse((await httpsRequest(`${urls.lti}/lti/keys/${ACCOUNT}`)).body) as Parameters<typeof createLocalJWKSet>[0];
  return (await jwtVerify(jwt, createLocalJWKSet(jwks), { algorithms: ['RS256'] })).payload;
}

/** The claims without the ones that change per JWT (AC-T3-09: "except nonce, iat, exp"). */
function stable(p: JWTPayload): Record<string, unknown> {
  const { nonce: _n, iat: _i, exp: _e, ...rest } = p as Record<string, unknown>;
  return rest;
}

test.describe.serial('T3c compatibility endpoints', () => {
  let context: BrowserContext;
  let studentLtik = '';
  let serviceKey = '';

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    const cmid = Number(loadState('T3a').cmid ?? 0);
    expect(cmid, 'T3a made the activity "QA DL" (run T3a first in the same pass)').toBeGreaterThan(0);
    context = await newStackContext(browser);
    const a = await launchActivity(context, seed().users.cg_student, cmid);
    studentLtik = String(a.ltik ?? '');
    const t = await ltiApi<{ services: { serviceKey?: string } }>('GET', '/api/idtoken', { authorization: auth.ltik(apiKey(ACCOUNT), studentLtik) });
    expect(t.status, t.body.slice(0, 200)).toBe(200);
    serviceKey = String(t.json.services.serviceKey ?? '');
    expect(serviceKey, 'service key of "QA DL"').toMatch(/^[A-Za-z0-9_-]{43}$/);
    saveState('T3c', { runId });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T3-09 POST /api/deeplinking/form with the AC-T3-07 body → one <form> (action = target of /api/deeplinking), one hidden JWT that verifies with the AC-T3-08 claims (except nonce, iat, exp), the fixed submit script; /message → {message, target} like /api/deeplinking', async () => {
    test.setTimeout(150_000);
    const key = apiKey(ACCOUNT);
    const title = `QA DL form ${runId}`;
    const item = { type: 'ltiResourceLink', title, url: `${urls.lti}/lti/launch/${ACCOUNT}?resource=qa-dl`, lineItem: { scoreMaximum: 100, label: title } };
    const body = { contentItems: [item] };
    // A real cg_teacher deep-linking launch; QA's page calls /api/deeplinking (the AC-T3-07 body); not saved in Moodle.
    const run = await deepLinkActivity(context, seed().users.cg_teacher, seed().courses['COGNIATE-DEV-101'], ltiSeed().typeId, [item], { save: false });
    expect(run.dl.status, run.dl.body.slice(0, 200)).toBe(200);
    const target = String(run.dl.json.target ?? '');
    const base = stable(await verifyDl(String(run.dl.json.message)));
    expect(base[`${LTI_CLAIM}message_type`]).toBe('LtiDeepLinkingResponse');

    const form = await ltiApi<{ form?: string }>('POST', '/api/deeplinking/form', { authorization: auth.ltik(key, run.ltik), body });
    expect(form.status, form.body.slice(0, 300)).toBe(200);
    const html = String(form.json.form ?? '');
    const forms = html.match(/<form\b[^>]*>/g) ?? [];
    expect(forms, 'one <form>').toHaveLength(1);
    const formTag = forms[0] ?? '';
    const action = unescapeHtml(formTag.match(/\baction="([^"]*)"/)?.[1] ?? '');
    expect(action, 'form action = target of /api/deeplinking').toBe(target);
    expect(formTag).toMatch(/\bmethod="POST"/i);
    const inputs = html.match(/<input\b[^>]*>/g) ?? [];
    expect(inputs, 'one input').toHaveLength(1);
    const input = inputs[0] ?? '';
    expect(input).toMatch(/\btype="hidden"/);
    expect(input).toMatch(/\bname="JWT"/);
    const jwt = unescapeHtml(input.match(/\bvalue="([^"]*)"/)?.[1] ?? '');
    expect(stable(await verifyDl(jwt)), 'the form JWT has the same claims as the /api/deeplinking JWT (except nonce, iat, exp)').toEqual(base);
    expect(html, 'the fixed submit script').toContain(SUBMIT_SCRIPT);
    expect(formTag).toMatch(/\bid="lti_dl_submit"/);

    const msg = await ltiApi<{ message?: string; target?: string }>('POST', '/api/deeplinking/message', { authorization: auth.ltik(key, run.ltik), body });
    expect(msg.status, msg.body.slice(0, 300)).toBe(200);
    expect(msg.json.target, '/message target = /api/deeplinking target').toBe(target);
    expect(stable(await verifyDl(String(msg.json.message))), 'the /message JWT has the same claims (except nonce, iat, exp)').toEqual(base);
  });

  test('AC-T3-15 POST /api/lineitems → 201 with id; PUT "QA extra 2" → 201 and Moodle shows the new name; DELETE → 204 and the column is gone; a launch with only lineitem.readonly → 403 SERVICE_NOT_AVAILABLE', async () => {
    test.setTimeout(150_000);
    const key = apiKey(ACCOUNT);
    const authz = auth.service(key, serviceKey);
    const course = seed().courses['COGNIATE-DEV-101'];
    const student = seed().users.cg_student;
    const names = async () => (await gradeItems(seed().oracleToken, course, student.id)).map((i) => String(i.itemname ?? ''));
    const label = `QA extra ${runId}`;

    const created = await ltiApi<{ id?: string; label?: string; scoreMaximum?: number }>('POST', '/api/lineitems', { authorization: authz, body: { label, scoreMaximum: 10 } });
    expect(created.status, created.body.slice(0, 300)).toBe(201);
    const id = String(created.json.id ?? '');
    expect(id, 'line item id (platform URL)').toMatch(/^https:\/\//);
    await expect.poll(names, { timeout: 15_000, message: 'Moodle gradebook has the new column' }).toContain(label);

    const put = await ltiApi<{ label?: string }>('PUT', `/api/lineitems/${enc(id)}`, { authorization: authz, body: { label: 'QA extra 2', scoreMaximum: 10 } });
    expect(put.status, put.body.slice(0, 300)).toBe(201);
    await expect.poll(names, { timeout: 15_000, message: 'Moodle shows the new name' }).toContain('QA extra 2');
    expect(await names(), 'the old name is gone').not.toContain(label);

    const del = await ltiApi('DELETE', `/api/lineitems/${enc(id)}`, { authorization: authz });
    expect(del.status, del.body.slice(0, 300)).toBe(204);
    await expect.poll(names, { timeout: 15_000, message: 'the column is gone' }).not.toContain('QA extra 2');

    // A launch whose AGS scope is only lineitem.readonly (QA platform, signed by QA): writes → 403, no platform call.
    const p = await setupQaPlatform(key, 't3c-ro');
    const ro = await qaLaunchLtik(p, (login) => ({
      ...resourceLinkClaims(p, login),
      [AGS_CLAIM]: { scope: ['https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly'], lineitems: `${QA_ISSUER}/ags/lineitems` },
    }));
    const since = Date.now() - 1_000;
    const denied = await ltiApi('POST', '/api/lineitems', { authorization: auth.ltik(key, ro), body: { label: `QA ro ${runId}`, scoreMaximum: 10 } });
    expect(denied.status, denied.body.slice(0, 300)).toBe(403);
    expect(errorCode(denied)).toBe('SERVICE_NOT_AVAILABLE');
    expect(hasErrorShape(denied)).toBe(true);
    await settle();
    expect(eventsSince('lti-service', since, (e) => e.event === 'outbound_request' && e.trace_id === denied.traceId), 'no platform call for the refused write').toEqual([]);
  });

  test('AC-T3-20 GET /api/memberships (cg_student ltik) → context id = course id, members cg_teacher, cg_student, cg_student2 with roles and no email or name; role=Learner (short and URI) → only the two students; url on evil.test → 400 INVALID_URL_PARAMETER, zero sink hits', async () => {
    test.setTimeout(90_000);
    const key = apiKey(ACCOUNT);
    const authz = auth.ltik(key, studentLtik);
    const s = seed();
    const course = s.courses['COGNIATE-DEV-101'];
    const ids = { teacher: String(s.users.cg_teacher.id), student: String(s.users.cg_student.id), student2: String(s.users.cg_student2.id) };
    type Members = { id?: string; context?: { id?: string }; members?: Record<string, unknown>[] };

    const all = await ltiApi<Members>('GET', '/api/memberships', { authorization: authz });
    expect(all.status, all.body.slice(0, 300)).toBe(200);
    expect(String(all.json.context?.id), 'context.id = course id').toBe(String(course));
    const members = all.json.members ?? [];
    const byId = new Map(members.map((m) => [String(m.userId), m]));
    for (const [who, id] of Object.entries(ids)) {
      const m = byId.get(id);
      expect(m, `${who} (${id}) is a member`).toBeDefined();
      expect(Array.isArray(m!.roles) && (m!.roles as unknown[]).length > 0, `${who} has roles`).toBe(true);
    }
    const personal = members.filter((m) => ['email', 'name', 'givenName', 'familyName', 'picture'].some((k) => k in m));
    expect(personal, 'no member has personal fields').toEqual([]);
    test.info().annotations.push({ type: 'members', description: members.map((m) => `${String(m.userId)}: ${JSON.stringify(m.roles)}`).join('; ') });

    for (const role of ['Learner', 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner']) {
      const res = await ltiApi<Members>('GET', `/api/memberships?role=${enc(role)}`, { authorization: authz });
      expect(res.status, `role=${role}: ${res.body.slice(0, 200)}`).toBe(200);
      const got = (res.json.members ?? []).map((m) => String(m.userId)).sort();
      expect(got, `role=${role}: only the two students`).toEqual([ids.student, ids.student2].sort());
    }

    // Network negative, three oracles: the answer, the evil.test sink, the outbound log of the LTI service.
    const since = Date.now() - 1_000;
    const evil = await ltiApi('GET', `/api/memberships?url=${enc('https://evil.test/memberships')}`, { authorization: authz });
    expect(evil.status, evil.body.slice(0, 200)).toBe(400);
    expect(errorCode(evil)).toBe('INVALID_URL_PARAMETER');
    await settle();
    expect(sinkHitsSince(since), 'sink hits').toEqual([]);
    expect(eventsSince('lti-service', since, (e) => /^outbound_/.test(String(e.event)) && hostIs(e, 'evil.test')), 'outbound_* for evil.test').toEqual([]);
  });

  test('AC-T3-21 POST /api/oauth/x/access_token (and …/refresh) with the API key → 501 NOT_IMPLEMENTED with the error shape; without auth → 401', async () => {
    const key = apiKey(ACCOUNT);
    for (const p of ['/api/oauth/x/access_token', '/api/oauth/x/access_token/refresh']) {
      const res = await ltiApi('POST', p, { authorization: auth.bearer(key), body: {} });
      expect(res.status, `${p}: ${res.body.slice(0, 200)}`).toBe(501);
      expect(errorCode(res), p).toBe('NOT_IMPLEMENTED');
      expect(hasErrorShape(res), `${p}: error shape`).toBe(true);
    }
    const anon = await ltiApi('POST', '/api/oauth/x/access_token', { body: {} });
    expect(anon.status, `no auth: ${anon.body.slice(0, 200)}`).toBe(401);
  });
});
