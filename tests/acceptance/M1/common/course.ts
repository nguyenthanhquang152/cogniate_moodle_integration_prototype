import fs from 'node:fs';
import path from 'node:path';
import { createCourse, uploadVersion } from '../../lib/app';
import { artifactsDir } from '../../lib/paths';
import { zipBuffer } from '../../lib/zip';
import { scormCommit } from '../../lib/t5';
import {
  APP, app, assert, expectStatus, httpsRequest, idToken, launch, parseForm, poll,
  records, rememberSecret, unique, urls, type Json,
} from './client';

export function fixtureZip(format: 'html' | 'scorm12') {
  const title = unique('M1 fixture');
  const questions = Array.from({ length: 10 }, (_, n) => `<fieldset data-cog-quiz="q${n}"><input type="radio" data-cog-correct="true"><input type="radio" data-cog-correct="false"></fieldset>`).join('');
  const entries = [{ name: 'index.html', data: `<!doctype html><meta charset="utf-8"><title>${title}</title><body data-lesson-id="index">${questions}</body>` }];
  if (format === 'scorm12') entries.push({ name: 'imsmanifest.xml', data: `<?xml version="1.0"?>
<manifest identifier="qa.m1" version="1" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
<metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
<organizations default="org"><organization identifier="org"><title>M1 QA</title><item identifier="item" identifierref="sco"><title>M1 QA</title><adlcp:masteryscore>70</adlcp:masteryscore></item></organization></organizations>
<resources><resource identifier="sco" type="webcontent" adlcp:scormtype="sco" href="index.html"><file href="index.html"/></resource></resources></manifest>` });
  const file = path.join(artifactsDir('acceptance'), unique(format) + '.zip');
  fs.writeFileSync(file, zipBuffer(entries));
  return file;
}
export async function publication(binding: Json, format: 'html' | 'scorm12' = 'scorm12'): Promise<Json> {
  const course = await createCourse(binding.s, unique('M1 course'));
  const file = fixtureZip(format), upload = await uploadVersion(binding.s, course.id, file);
  expectStatus(upload, 201);
  const response = await app(binding.s, 'POST', '/app-api/publications', { connectionId: binding.connection.id, courseId: course.id });
  expectStatus(response, 201);
  assert.equal(response.json.lms, binding.connection.lms); assert.equal(response.json.connectionName, binding.connection.name);
  return { ...response.json, file, format, courseId: course.id };
}
export async function newVersion(binding: Json, pub: Json) {
  const upload = await uploadVersion(binding.s, pub.courseId, pub.file); expectStatus(upload, 201);
  const response = await app(binding.s, 'POST', '/app-api/publications', {
    connectionId: binding.connection.id, courseId: pub.courseId, versionId: upload.json.id,
  });
  expectStatus(response, 200); return response.json;
}
export async function openPlay(binding: Json, pub: Json, patch: Json = {}) {
  const result = await launch({ deploymentId: binding.deploymentId, siteHost: new URL(binding.connection.siteUrl).hostname,
    resource: pub.id, resourceLinkId: pub.id, ...patch });
  assert.equal(result.response.status, 303);
  const token = await idToken(result.ltik); expectStatus(token, 200);
  const handoff = await httpsRequest(String(result.response.headers.location));
  assert.equal(handoff.status, 303, 'Tool handoff opens a player');
  const playUrl = new URL(String(handoff.headers.location), APP);
  assert.match(playUrl.pathname, /^\/play\/ply_/);
  const playId = playUrl.pathname.split('/')[2];
  const shell = await httpsRequest(`${APP}/play/${playId}`); expectStatus(shell, 200);
  const runtimeUrl = shell.body.match(/src="(https:[^"]+\/rt\/[^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
  assert.ok(runtimeUrl, 'Player contains runtime iframe');
  const runtimeToken = new URL(runtimeUrl).pathname.split('/')[2]; rememberSecret(runtimeToken);
  const state = await httpsRequest(`${urls.content}/rt/${runtimeToken}/state`); expectStatus(state, 200);
  return { result, token: token.json, playId, shell, runtimeToken, state: JSON.parse(state.body) };
}
export async function commitGrade(play: Json, format: string, raw: number, maximum: number, complete = true) {
  const body = format === 'scorm12'
    ? scormCommit(play.state.sessionId, play.state.lastSeq + 1, complete ? 'finish' : 'commit', {
      lesson_status: complete ? 'completed' : 'incomplete', score: { raw: String(raw), min: '0', max: String(maximum) },
    })
    : { kind: 'html', event: 'progress', sessionId: play.state.sessionId, seq: play.state.lastSeq + 1,
      progress: { seenPages: complete ? ['index'] : [],
        answers: Object.fromEntries(Array.from({ length: 10 }, (_, n) => ['q' + n, n < raw ? '1' : '0'])) } };
  const response = await httpsRequest(`${urls.content}/rt/${play.runtimeToken}/commit`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  expectStatus(response, 200);
}
export async function results(binding: Json, pub: Json) {
  const r = await app(binding.s, 'GET', `/app-api/publications/${pub.id}/results`); expectStatus(r, 200); return r.json.rows as Json[];
}
export async function waitSync(binding: Json, pub: Json, status: string, tries?: number, timeout = 20_000) {
  const rows = await poll(() => results(binding, pub), (rows) =>
    rows.some((row) => row.scoreSyncs.some((s: Json) => s.status === status && (tries === undefined || s.tries === tries))), timeout, 250);
  return rows.flatMap((r) => r.scoreSyncs).find((s: Json) => s.status === status && (tries === undefined || s.tries === tries));
}
export async function gradeWorks(binding: Json, format: 'html' | 'scorm12' = 'scorm12') {
  const pub = await publication(binding, format), cursor = (await records()).cursor;
  const play = await openPlay(binding, pub);
  await commitGrade(play, format, format === 'html' ? 7 : 7, format === 'html' ? 10 : 10);
  await waitSync(binding, pub, 'sent');
  const hits = (await records(cursor)).records.filter((r) => r.kind === 'score' && r.resource === pub.id);
  assert.equal(hits.length, 1);
  assert.deepEqual([hits[0].body.scoreGiven, hits[0].body.scoreMaximum], format === 'html' ? [70, 100] : [7, 10]);
  return { pub, play, hits };
}
export async function picker(binding: Json) {
  const result = await launch({ deploymentId: binding.deploymentId, siteHost: new URL(binding.connection.siteUrl).hostname,
    messageType: 'LtiDeepLinkingRequest', roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'] });
  assert.equal(result.response.status, 303);
  const handoff = await httpsRequest(String(result.response.headers.location)); assert.equal(handoff.status, 303);
  const url = new URL(String(handoff.headers.location), APP).href;
  assert.match(new URL(url).pathname, /^\/tool\/picker\/pck_/);
  const page = await httpsRequest(url); expectStatus(page, 200);
  assert.ok(String(page.headers['content-security-policy']).includes(`frame-ancestors ${binding.connection.siteUrl}`));
  return { url, page, result };
}
export async function pick(pickerUrl: string, publicationId: string) {
  const response = await httpsRequest(pickerUrl, { method: 'POST', headers: {
    origin: APP, 'content-type': 'application/x-www-form-urlencoded',
  }, body: new URLSearchParams({ publicationId }).toString() });
  return response;
}
export async function returnDeepLink(page: { body: string }) {
  const { action, fields } = parseForm(page.body);
  rememberSecret(fields.JWT);
  const response = await httpsRequest(action, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString() });
  expectStatus(response, 200);
  return { action, response, jwt: fields.JWT };
}
