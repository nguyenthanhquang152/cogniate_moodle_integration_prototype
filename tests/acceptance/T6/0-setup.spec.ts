// T6 setup. T6 runs after T5a and T5b on the same stack (AC-T6-08 and AC-T6-14 read the T5 result rows), so Thanh's
// connection, publications and activities exist (lib/t5.ts state "T5"). QA adds:
// - a pending Thanh connection (AC-T6-07: the Publish dialog lists only registered or connected connections);
// - the AC-T6-13 course: title `<b>x</b>`, a SCORM package whose manifest title is `<img src=x onerror="window.__xss=1">`,
//   published to Thanh's connection.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appApi, createCourse, signIn, THANH, uploadVersion } from '../lib/app';
import { publicUrls } from '../lib/env';
import { loadState, saveState } from '../lib/lti';
import { expect, test } from '../lib/pw';
import { t5 } from '../lib/t5';
import { zipBuffer } from '../lib/zip';

const urls = publicUrls();
export const XSS_COURSE_TITLE = '<b>x</b>';
export const XSS_MANIFEST_TITLE = '<img src=x onerror="window.__xss=1">';
const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function xssScormZip(): string {
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="qa.t6.xss" version="1" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
<metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
<organizations default="org"><organization identifier="org"><title>${xmlEscape(XSS_MANIFEST_TITLE)}</title>
<item identifier="i1" identifierref="r1"><title>${xmlEscape(XSS_MANIFEST_TITLE)}</title><adlcp:masteryscore>70</adlcp:masteryscore></item></organization></organizations>
<resources><resource identifier="r1" type="webcontent" adlcp:scormtype="sco" href="index.html"><file href="index.html"/></resource></resources></manifest>`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-t6-'));
  const file = path.join(dir, 'xss-scorm.zip');
  fs.writeFileSync(file, zipBuffer([{ name: 'imsmanifest.xml', data: manifest }, { name: 'index.html', data: '<!doctype html><html><body><p>QA</p></body></html>' }]));
  return file;
}

test('SETUP-T6 a pending Thanh connection and the AC-T6-13 course (published)', async () => {
  test.setTimeout(180_000);
  if (loadState('T6').xssPublicationId) return;
  const st = t5();
  expect(st.connectionId && st.scormPublicationId, 'T5 state (run T5a and T5b first on this stack)').toBeTruthy();
  const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
  const thanh = await signIn(THANH);
  const pendingName = `QA pending ${runId}`;
  const pending = await appApi<{ id: string; status: string }>('POST', '/app-api/connections', { cookie: thanh.cookie, body: { name: pendingName, siteUrl: urls.moodle, method: 'dynamic' } });
  expect(pending.status, pending.body).toBe(201);
  expect(pending.json.status).toBe('pending');

  const xss = await createCourse(thanh, XSS_COURSE_TITLE);
  const up = await uploadVersion(thanh, xss.id, xssScormZip());
  expect(up.status, up.body.slice(0, 300)).toBe(201);
  const pub = await appApi<{ id: string }>('POST', '/app-api/publications', { cookie: thanh.cookie, body: { connectionId: st.connectionId, courseId: xss.id } });
  expect([200, 201], pub.body).toContain(pub.status);
  saveState('T6', { runId, pendingConnectionId: pending.json.id, pendingConnectionName: pendingName, xssCourseId: xss.id, xssPublicationId: pub.json.id });
});
