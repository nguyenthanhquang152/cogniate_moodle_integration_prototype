// T4a: every reject code of the package inspector, with zips that QA makes at run time (lib/zip.ts).
// Source: tasks/T4a.md AC-T4-05, AC-T4-35 (265c96d); contract cogniate-app-api.md §3.2 (details.action), §3.3
// (package-derived identifiers); security §7. AC-T4-35 runs after AC-T4-05 in this file (tests in a file run in
// order) and also checks the details.action of every AC-T4-05 answer.
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

function manifest({
  resources,
  schemaversion = '1.2',
  doctype = '',
  ns = 'http://www.adlnet.org/xsd/adlcp_rootv1p2',
  typeAttr = 'adlcp:scormtype',
  identifier = 'qa.manifest',
  title = 'QA',
}: {
  resources: { id: string; href: string; files: string[] }[];
  schemaversion?: string;
  doctype?: string;
  ns?: string;
  typeAttr?: string;
  identifier?: string;
  title?: string;
}): string {
  const items = resources.map((r) => `<item identifier="i-${r.id}" identifierref="${r.id}"><title>QA ${r.id}</title></item>`).join('');
  const res = resources
    .map((r) => `<resource identifier="${r.id}" type="webcontent" ${typeAttr}="sco" href="${r.href}">${r.files.map((f) => `<file href="${f}"/>`).join('')}</resource>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${doctype}<manifest identifier="${identifier}" version="1" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="${ns}">
<metadata><schema>ADL SCORM</schema><schemaversion>${schemaversion}</schemaversion></metadata>
<organizations default="org"><organization identifier="org"><title>${title}</title>${items}</organization></organizations>
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

const SCORM_R1 = [{ id: 'r1', href: 'index.html', files: ['index.html'] }];

/** AC-T4-35: one crafted package per identifier rule of contract §3.3, plus the XML-illegal title case. */
const IDENTIFIER_CASES: Case[] = [
  {
    code: 'INVALID_PACKAGE_IDENTIFIER',
    label: 'manifest identifier of 129 characters',
    make: write([INDEX, { name: 'imsmanifest.xml', data: manifest({ resources: SCORM_R1, identifier: 'a'.repeat(129) }) }]),
  },
  {
    code: 'INVALID_PACKAGE_IDENTIFIER',
    label: 'data-cog-quiz="__proto__"',
    make: write([
      {
        name: 'index.html',
        data: '<!doctype html><html><body data-lesson-id="index"><div data-cog-quiz="__proto__"><input type="radio" name="q" data-cog-correct="true"><input type="radio" name="q" data-cog-correct="false"></div></body></html>',
      },
    ]),
  },
  {
    code: 'INVALID_PACKAGE_IDENTIFIER',
    label: 'page key "bad key" (file bad key.html, no data-lesson-id)',
    make: write([INDEX, { name: 'bad key.html', data: '<!doctype html><html><body><p>QA</p></body></html>' }]),
  },
  {
    code: 'INVALID_PACKAGE_IDENTIFIER',
    label: 'manifest title with the C1 control U+0085 (valid XML 1.0, banned by §3.3)',
    make: write([INDEX, { name: 'imsmanifest.xml', data: manifest({ resources: SCORM_R1, title: 'QA\u0085title' }) }]),
  },
  {
    // 265c96d: U+0007 is illegal in XML 1.0, so the manifest does not parse; the first failing check gives the code.
    code: 'MANIFEST_INVALID_XML',
    label: 'manifest title with U+0007 (illegal in XML 1.0)',
    make: write([INDEX, { name: 'imsmanifest.xml', data: manifest({ resources: SCORM_R1, title: 'QA\u0007title' }) }]),
  },
  {
    // The AC: "raw or as &#7;". A character reference to an XML-illegal character is also not well-formed.
    code: 'MANIFEST_INVALID_XML',
    label: 'manifest title with &#7; (character reference, illegal in XML 1.0)',
    make: write([INDEX, { name: 'imsmanifest.xml', data: manifest({ resources: SCORM_R1, title: 'QA&#7;title' }) }]),
  },
];

/** details.action of every AC-T4-05 answer (AC-T4-35 checks that each one is non-empty). */
const actions05: { label: string; action: string }[] = [];

type RejectDetails = { message?: string; action?: unknown; reasons?: { code?: string; path?: string; detail?: string }[] };

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
        const details = (res.json as { details?: RejectDetails } | null)?.details;
        const codes = (details?.reasons ?? []).map((r) => String(r.code));
        actions05.push({ label: c.label, action: typeof details?.action === 'string' ? details.action : '' });
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

  it('AC-T4-35 package identifiers (129-char id, __proto__ quiz id, page key with a space, title with U+0085) → 422 INVALID_PACKAGE_IDENTIFIER, title with U+0007 (raw or &#7;) → MANIFEST_INVALID_XML; details.action, nothing stored; every AC-T4-05 answer has details.action', { timeout: 300_000 }, async () => {
    const s = await signIn(THANH);
    const course = await createCourse(s, `QA identifiers ${runId}`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-identifiers-'));
    const problems: string[] = [];
    const seen: string[] = [];
    try {
      for (const [i, c] of IDENTIFIER_CASES.entries()) {
        const file = path.join(dir, `${String(i).padStart(2, '0')}-identifier.zip`);
        await c.make(file);
        const res = await uploadVersion(s, course.id, file);
        const details = (res.json as { details?: RejectDetails } | null)?.details;
        const reasons = details?.reasons ?? [];
        const codes = reasons.map((r) => String(r.code));
        const action = typeof details?.action === 'string' ? details.action.trim() : '';
        seen.push(`${c.label}: ${res.status} [${reasons.map((r) => `${r.code}${r.path ? ` ${r.path}` : ''}${r.detail ? ` (${r.detail})` : ''}`).join('; ')}]`);
        if (res.status !== 422 || details?.message !== 'PACKAGE_REJECTED' || !codes.includes(c.code)) {
          problems.push(`${c.label}: HTTP ${res.status}, message ${details?.message ?? '-'}, codes [${codes.join(', ')}], want 422 PACKAGE_REJECTED with ${c.code}`);
        }
        if (!action) problems.push(`${c.label}: no details.action`);
        fs.rmSync(file, { force: true });
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    const after = await appApi<{ versions?: unknown[]; latestVersion?: unknown }>('GET', `/app-api/courses/${course.id}`, { cookie: s.cookie });
    expect(after.status).toBe(200);
    expect(after.json.versions ?? [], 'nothing stored: no version').toHaveLength(0);
    expect(after.json.latestVersion ?? null, 'nothing stored: no latestVersion').toBeNull();

    // "Every 422 of AC-T4-05 also has a non-empty details.action."
    if (actions05.length !== CASES.length) problems.push(`AC-T4-05 answers recorded: ${actions05.length} of ${CASES.length} (run AC-T4-05 in the same pass)`);
    for (const a of actions05) if (!a.action.trim()) problems.push(`AC-T4-05 ${a.label}: details.action is missing or empty`);
    console.log(`AC-T4-35 answers: ${seen.join(' | ')}`);
    expect(problems).toEqual([]);
  });

  // Not an AC (Author note, T4a round 2: "bidi/zero-width file names are now rejected"). The contract (§3.2
  // INVALID_ENTRY_NAME = NUL or control characters, or a backslash) does not name these format characters, so QA only
  // records the answers for the report. This probe never fails the suite.
  it('PROBE (not an AC) file names with U+202E (bidi override) and U+200B (zero width space): record the answer', { timeout: 120_000 }, async () => {
    const s = await signIn(THANH);
    const course = await createCourse(s, `QA probe names ${runId}`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-probe-'));
    const seenProbe: string[] = [];
    try {
      for (const [label, name] of [
        ['U+202E', 'lesson\u202Elmth.html'],
        ['U+200B', 'less\u200Bon.html'],
      ] as const) {
        const file = path.join(dir, `${label}.zip`);
        fs.writeFileSync(file, zipBuffer([INDEX, { name, data: '<p>QA</p>' }]));
        const res = await uploadVersion(s, course.id, file).catch((e: Error) => ({ status: 0, json: null, body: e.message }));
        const details = (res.json as { details?: RejectDetails } | null)?.details;
        seenProbe.push(`${label}: HTTP ${res.status} ${details?.message ?? ''} [${(details?.reasons ?? []).map((r) => r.code).join(', ')}] action ${typeof details?.action === 'string' && details.action ? 'yes' : 'no'}`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    console.log(`PROBE file names: ${seenProbe.join(' | ')}`);
    expect(seenProbe).toHaveLength(2);
  });
});
