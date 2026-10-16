// T4b2 setup: "T4b1 state. Thanh's tool activated and edited to New window and Show in activity chooser; both Thanh
// courses and library B's course published" (tasks/T4b2.md), plus the data that AC-T4-26 and AC-T4-28 need.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appApi, createCourse, QA_B, signIn, THANH, uploadVersion } from '../lib/app';
import { loadState, saveState } from '../lib/lti';
import { newStackContext } from '../lib/moodle-launch';
import { activateTool, openManageTools, setToolOptions } from '../lib/moodle-reg';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';
import { zipBuffer } from '../lib/zip';

const XSS_MANIFEST_TITLE = '<img src=x onerror="window.__xss=1">';
const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function zipFile(name: string, buf: Buffer): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-t4b2-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, buf);
  return file;
}

function xssScormZip(): string {
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="qa.xss" version="1" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
<metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
<organizations default="org"><organization identifier="org"><title>${xmlEscape(XSS_MANIFEST_TITLE)}</title>
<item identifier="i1" identifierref="r1"><title>${xmlEscape(XSS_MANIFEST_TITLE)}</title><adlcp:masteryscore>70</adlcp:masteryscore></item></organization></organizations>
<resources><resource identifier="r1" type="webcontent" adlcp:scormtype="sco" href="index.html"><file href="index.html"/></resource></resources></manifest>`;
  return zipFile('xss-scorm.zip', zipBuffer([{ name: 'imsmanifest.xml', data: manifest }, { name: 'index.html', data: '<!doctype html><html><body><p>QA</p></body></html>' }]));
}

const tinyHtml = () => zipFile('tiny.zip', zipBuffer([{ name: 'index.html', data: '<!doctype html><html><body data-lesson-id="index"><p>QA</p></body></html>' }]));

test('SETUP-T4b2 Thanh\'s tool active (activity chooser, New window); Thanh\'s and library B\'s courses published; AC-T4-26/-28 data', async ({ browser }) => {
  test.setTimeout(240_000);
  const st = loadState('T4b') as Record<string, never> & {
    runId: string; thanhTypeId: number; thanhConnectionId: string; bManualConnectionId: string;
    thanhScorm: { courseId: string }; thanhHtml: { courseId: string }; bHtml: { courseId: string }; t4b2Ready?: boolean;
  };
  expect(st.thanhTypeId && st.thanhConnectionId && st.bManualConnectionId, 'T4b1 state').toBeTruthy();
  if (st.t4b2Ready) return;

  const context = await newStackContext(browser);
  try {
    const page = await context.newPage();
    await openManageTools(page, seed().users.admin);
    await activateTool(page, st.thanhTypeId);
    await setToolOptions(page, st.thanhTypeId, { coursevisible: '2', launchcontainer: '4' });
  } finally {
    await context.close();
  }

  const thanh = await signIn(THANH);
  const b = await signIn(QA_B);
  const publish = async (cookie: string, connectionId: string, courseId: string) => {
    const r = await appApi<{ id: string; status: string }>('POST', '/app-api/publications', { cookie, body: { connectionId, courseId } });
    expect([200, 201], r.body).toContain(r.status);
    return r.json.id;
  };
  const scormPub = await publish(thanh.cookie, st.thanhConnectionId, st.thanhScorm.courseId);
  const htmlPub = await publish(thanh.cookie, st.thanhConnectionId, st.thanhHtml.courseId);
  const bPub = await publish(b.cookie, st.bManualConnectionId, st.bHtml.courseId);

  const gone = await createCourse(thanh, `QA withdrawn ${st.runId}`);
  expect((await uploadVersion(thanh, gone.id, tinyHtml())).status).toBe(201);
  const withdrawnPub = await publish(thanh.cookie, st.thanhConnectionId, gone.id);
  expect((await appApi('POST', `/app-api/publications/${withdrawnPub}/withdraw`, { cookie: thanh.cookie })).status).toBe(200);

  const xss = await createCourse(thanh, '<b>x</b>');
  const xssUp = await uploadVersion(thanh, xss.id, xssScormZip());
  expect(xssUp.status, xssUp.body.slice(0, 300)).toBe(201);
  const xssPub = await publish(thanh.cookie, st.thanhConnectionId, xss.id);

  saveState('T4b', {
    t4b2Ready: true,
    thanhScormPublicationId: scormPub,
    thanhHtmlPublicationId: htmlPub,
    bHtmlPublicationId: bPub,
    withdrawnPublicationId: withdrawnPub,
    xssCourseId: xss.id,
    xssPublicationId: xssPub,
  });
});
