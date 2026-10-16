// T4a: every reject code of the package inspector, with zips that QA makes at run time (lib/zip.ts).
// Source: tasks/T4a.md AC-T4-05; contract cogniate-app-api.md §3.2; security §7.
// Host part (run-t4a.mjs): the package store folder count before and after this test is the same, and
// `find / -name evil.html -o -name abs.html` in the cogniate-app container finds nothing.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { appApi, createCourse, signIn, THANH, uploadVersion } from '../lib/app';
import { writeLargeZip, type ZipEntry, zipBuffer } from '../lib/zip';

const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const INDEX: ZipEntry = { name: 'index.html', data: '<!doctype html><html><body data-lesson-id="index"><p>QA</p></body></html>' };

function manifest({ resources, schemaversion = '1.2', doctype = '', ns = 'http://www.adlnet.org/xsd/adlcp_rootv1p2', typeAttr = 'adlcp:scormtype' }: {
  resources: { id: string; href: string; files: string[] }[];
  schemaversion?: string;
  doctype?: string;
  ns?: string;
  typeAttr?: string;
}): string {
  const items = resources.map((r) => `<item identifier="i-${r.id}" identifierref="${r.id}"><title>QA ${r.id}</title></item>`).join('');
  const res = resources
    .map((r) => `<resource identifier="${r.id}" type="webcontent" ${typeAttr}="sco" href="${r.href}">${r.files.map((f) => `<file href="${f}"/>`).join('')}</resource>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${doctype}<manifest identifier="qa.manifest" version="1" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="${ns}">
<metadata><schema>ADL SCORM</schema><schemaversion>${schemaversion}</schemaversion></metadata>
<organizations default="org"><organization identifier="org"><title>QA</title>${items}</organization></organizations>
<resources>${res}</resources></manifest>`;
}

interface Case {
  code: string;
  label: string;
  make: (file: string) => Promise<void> | void;
}

const write = (entries: ZipEntry[]) => (file: string) => fs.writeFileSync(file, zipBuffer(entries));

const CASES: Case[] = [
  { code: 'PATH_TRAVERSAL', label: '../evil.html', make: write([INDEX, { name: '../evil.html', data: 'qa' }]) },
  { code: 'PATH_TRAVERSAL', label: 'a/../../evil.html', make: write([INDEX, { name: 'a/../../evil.html', data: 'qa' }]) },
  { code: 'ABSOLUTE_PATH', label: '/abs.html', make: write([INDEX, { name: '/abs.html', data: 'qa' }]) },
  { code: 'SYMLINK_ENTRY', label: 'symlink entry', make: write([INDEX, { name: 'link.html', data: '/etc/passwd', unixMode: 0o120777 }]) },
  { code: 'ZIP_BOMB', label: 'entry with ratio > 100 (10 MB of zeros)', make: write([INDEX, { name: 'bomb.txt', data: Buffer.alloc(10 * 1024 * 1024), deflate: true }]) },
  {
    code: 'MANIFEST_DTD_FORBIDDEN',
    label: 'manifest with DOCTYPE and ENTITY',
    make: write([INDEX, { name: 'imsmanifest.xml', data: manifest({ resources: [{ id: 'r1', href: 'index.html', files: ['index.html'] }], doctype: '<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>\n' }) }]),
  },
  { code: 'MANIFEST_INVALID_XML', label: 'manifest that is not XML', make: write([INDEX, { name: 'imsmanifest.xml', data: '<manifest><organizations><unclosed></manifest' }]) },
  {
    code: 'SCORM_VERSION_UNSUPPORTED',
    label: 'SCORM 2004 manifest',
    make: write([INDEX, { name: 'imsmanifest.xml', data: manifest({ resources: [{ id: 'r1', href: 'index.html', files: ['index.html'] }], schemaversion: '2004 4th Edition', ns: 'http://www.adlnet.org/xsd/adlcp_v1p3', typeAttr: 'adlcp:scormType' }) }]),
  },
  {
    code: 'MULTI_SCO_UNSUPPORTED',
    label: 'two SCOs',
    make: write([
      INDEX,
      { name: 'page2.html', data: '<p>2</p>' },
      { name: 'imsmanifest.xml', data: manifest({ resources: [{ id: 'r1', href: 'index.html', files: ['index.html'] }, { id: 'r2', href: 'page2.html', files: ['page2.html'] }] }) },
    ]),
  },
  {
    code: 'LAUNCH_FILE_MISSING',
    label: 'SCO href not in the zip',
    make: write([INDEX, { name: 'imsmanifest.xml', data: manifest({ resources: [{ id: 'r1', href: 'missing.html', files: ['missing.html'] }] }) }]),
  },
  { code: 'NO_ENTRY_PAGE', label: 'HTML zip without index.html', make: write([{ name: 'lesson.html', data: '<p>QA</p>' }, { name: 'style.css', data: 'p{}' }]) },
  { code: 'ZIP_INVALID', label: 'a text file', make: (file) => fs.writeFileSync(file, 'This is a text file, not a zip.\n') },
  { code: 'DUPLICATE_ENTRY', label: 'A.html and a.html', make: write([INDEX, { name: 'A.html', data: 'A' }, { name: 'a.html', data: 'a' }]) },
  { code: 'INVALID_ENTRY_NAME', label: 'entry name with a control character', make: write([INDEX, { name: 'bad\x01name.html', data: 'qa' }]) },
  {
    code: 'ZIP_TOO_MANY_ENTRIES',
    label: '5,001 entries',
    make: write([INDEX, ...Array.from({ length: 5000 }, (_, i) => ({ name: `files/f${String(i).padStart(4, '0')}.txt`, data: 'x' }))]),
  },
  { code: 'ZIP_TOO_LARGE', label: '201 MB of random data', make: (file) => writeLargeZip(file, [INDEX], { name: 'random.bin', bytes: 201 * 1024 * 1024 }) },
];

describe('T4a package rejects', () => {
  it('AC-T4-05 every crafted zip → 422 PACKAGE_REJECTED with its reason code; the course gets no version', { timeout: 600_000 }, async () => {
    const s = await signIn(THANH);
    const course = await createCourse(s, `QA rejects ${runId}`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-rejects-'));
    const problems: string[] = [];
    try {
      for (const [i, c] of CASES.entries()) {
        const file = path.join(dir, `${String(i).padStart(2, '0')}-${c.code.toLowerCase()}.zip`);
        await c.make(file);
        const res = await uploadVersion(s, course.id, file, { timeoutMs: 300_000 });
        const details = (res.json as { details?: { message?: string; reasons?: { code?: string }[] } } | null)?.details;
        const codes = (details?.reasons ?? []).map((r) => String(r.code));
        if (res.status !== 422 || details?.message !== 'PACKAGE_REJECTED' || !codes.includes(c.code)) {
          problems.push(`${c.label}: HTTP ${res.status}, message ${details?.message ?? '-'}, codes [${codes.join(', ')}], want 422 PACKAGE_REJECTED with ${c.code}`);
        }
        fs.rmSync(file, { force: true });
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    const after = await appApi<{ versions?: unknown[]; latestVersion?: unknown }>('GET', `/app-api/courses/${course.id}`, { cookie: s.cookie });
    expect(after.status).toBe(200);
    expect(after.json.versions ?? [], 'no version was made').toHaveLength(0);
    expect(problems).toEqual([]);
  });
});
