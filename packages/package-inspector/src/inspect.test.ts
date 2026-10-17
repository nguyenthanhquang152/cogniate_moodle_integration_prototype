import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { RejectCode } from './codes.ts';
import { PackageRejectedError, REJECT_CODES, REJECT_INFO } from './codes.ts';
import { extractPackage } from './extract.ts';
import { inspectPackage } from './inspect.ts';
import type { TestEntry } from './testing.ts';
import { copyFixture, newTempDir, scormManifest, writeTestZip } from './testing.ts';

const FIXTURES = process.env.COURSE_FIXTURES_DIR ?? fileURLToPath(new URL('../../../docs/raw/data/courses/', import.meta.url));
const SCORM_ZIP = join(FIXTURES, 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip');
const HTML_ZIP = join(FIXTURES, 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip');
const S3 = 'cogniate-prod-ai-course-creation.s3.ap-southeast-1.amazonaws.com';
const QUIZ = '01M2M36Y89M9KPPZENF1ZW4AWJ';
const INDEX: TestEntry = { name: 'index.html', data: '<html><body>Hi</body></html>' };

async function codesOf(entries: TestEntry[]): Promise<RejectCode[]> {
  const result = await inspectPackage(writeTestZip(entries));
  if (result.ok) throw new Error('expected a rejection');
  return result.reasons.map((r) => r.code);
}

describe('fixtures (copied to a new temp folder)', () => {
  it.skipIf(!existsSync(SCORM_ZIP))('SCORM fixture: AC-T4-03 report values', async () => {
    const result = await inspectPackage(copyFixture(SCORM_ZIP));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { report, trackingProfile } = result.inspection;
    expect(report).toEqual({
      format: 'scorm12',
      entryPath: 'index.html',
      totalBytes: 12723159,
      fileCount: 7,
      scorm: { schemaVersion: '1.2', identifier: 'com.cogniate.01M2M36B46JZVWKZDB6ETGA9R6', title: 'Build Your First Website with AI: The Zero-to-Hero Micro-Sprint', masteryScore: 70, scoCount: 1 },
      html: null,
      externalHosts: [S3],
      warnings: [{ code: 'EXTERNAL_ASSETS', detail: 'The package loads files from 1 external host.' }],
    });
    expect(trackingProfile).toEqual({
      format: 'scorm12', launchPath: 'index.html', pages: ['index', 'lesson-ai-web-sprint'], menuPage: 'index', questionIds: [QUIZ], masteryScore: 70, minDwellMs: 10000,
    });
  });

  it.skipIf(!existsSync(HTML_ZIP))('HTML fixture: AC-T4-04 report values', async () => {
    const result = await inspectPackage(copyFixture(HTML_ZIP));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { report, trackingProfile } = result.inspection;
    expect(report.format).toBe('html');
    expect(report.fileCount).toBe(7);
    expect(report.totalBytes).toBe(12103306);
    expect(report.html).toEqual({ pages: ['index', 'lesson-ai-web-sprint'], menuPage: 'index', questionIds: [QUIZ] });
    expect(report.scorm).toBeNull();
    expect(report.externalHosts).toEqual([S3, 'fonts.gstatic.com']);
    expect(report.warnings).toEqual([{ code: 'EXTERNAL_ASSETS', detail: 'The package loads files from 2 external hosts.' }]);
    expect(trackingProfile.masteryScore).toBe(70);
    expect(trackingProfile.launchPath).toBe('index.html');
  });

  it.skipIf(!existsSync(SCORM_ZIP))('extracts the SCORM fixture into a new folder', async () => {
    const dest = join(newTempDir(), 'pkg_test');
    expect(await extractPackage(copyFixture(SCORM_ZIP), dest)).toEqual({ fileCount: 7, totalBytes: 12723159 });
    expect(readdirSync(dest).sort()).toEqual(['assets', 'imsmanifest.xml', 'index.html', 'lesson-ai-web-sprint.html', 'scorm-api.js', 'style.css']);
  });
});

describe('reject codes (contract §3.2, AC-T4-05)', () => {
  it('PATH_TRAVERSAL for ../evil.html and a/../../evil.html', async () => {
    expect(await codesOf([INDEX, { name: '../evil.html', data: 'x' }])).toEqual(['PATH_TRAVERSAL']);
    expect(await codesOf([INDEX, { name: 'a/../../evil.html', data: 'x' }])).toEqual(['PATH_TRAVERSAL']);
    expect(await codesOf([INDEX, { name: 'a/b/../c.html', data: 'x' }])).toEqual(['PATH_TRAVERSAL']);
  });

  it('ABSOLUTE_PATH for /abs.html, a backslash start and a drive letter', async () => {
    expect(await codesOf([INDEX, { name: '/abs.html', data: 'x' }])).toEqual(['ABSOLUTE_PATH']);
    expect(await codesOf([INDEX, { name: '\\abs.html', data: 'x' }])).toEqual(['ABSOLUTE_PATH']);
    expect(await codesOf([INDEX, { name: 'C:/abs.html', data: 'x' }])).toEqual(['ABSOLUTE_PATH']);
  });

  it('SYMLINK_ENTRY for a Unix symbolic link', async () => {
    expect(await codesOf([INDEX, { name: 'link.html', data: '/etc/passwd', unixMode: 0o120777 }])).toEqual(['SYMLINK_ENTRY']);
  });

  it('ZIP_BOMB for an entry with a ratio > 100', async () => {
    expect(await codesOf([INDEX, { name: 'zeros.bin', data: Buffer.alloc(1_000_000), method: 8 }])).toEqual(['ZIP_BOMB']);
    // A normal deflated text entry passes.
    const ok = await inspectPackage(writeTestZip([{ ...INDEX, method: 8 }]));
    expect(ok.ok).toBe(true);
  });

  it('MANIFEST_DTD_FORBIDDEN for a DOCTYPE with an external entity, and for an ENTITY alone', async () => {
    const xxe = `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>${scormManifest().replace(/^<\?xml[^>]*\?>/, '')}`;
    expect(await codesOf([INDEX, { name: 'imsmanifest.xml', data: xxe }])).toEqual(['MANIFEST_DTD_FORBIDDEN']);
    expect(await codesOf([INDEX, { name: 'imsmanifest.xml', data: `<!entity e "x">${scormManifest()}` }])).toEqual(['MANIFEST_DTD_FORBIDDEN']);
  });

  it('MANIFEST_INVALID_XML for text that is not XML, and for a root that is not <manifest>', async () => {
    expect(await codesOf([INDEX, { name: 'imsmanifest.xml', data: 'this is <not xml' }])).toEqual(['MANIFEST_INVALID_XML']);
    expect(await codesOf([INDEX, { name: 'imsmanifest.xml', data: '<?xml version="1.0"?><other/>' }])).toEqual(['MANIFEST_INVALID_XML']);
  });

  it('SCORM_VERSION_UNSUPPORTED for SCORM 2004, and for no version and no 1.2 namespace', async () => {
    expect(await codesOf([INDEX, { name: 'imsmanifest.xml', data: scormManifest({ schemaVersion: '2004 4th Edition' }) }])).toEqual(['SCORM_VERSION_UNSUPPORTED']);
    const noVersion = scormManifest({ schemaVersion: null }).replace('http://www.adlnet.org/xsd/adlcp_rootv1p2', 'http://www.adlnet.org/xsd/adlcp_v1p3');
    expect(await codesOf([INDEX, { name: 'imsmanifest.xml', data: noVersion }])).toEqual(['SCORM_VERSION_UNSUPPORTED']);
  });

  it('accepts a SCORM 1.2 manifest without schemaversion when the adlcp 1.2 namespace is declared', async () => {
    const result = await inspectPackage(writeTestZip([INDEX, { name: 'imsmanifest.xml', data: scormManifest({ schemaVersion: null }) }]));
    expect(result.ok && result.inspection.report.scorm?.schemaVersion).toBe('1.2');
  });

  it('MULTI_SCO_UNSUPPORTED for two SCOs', async () => {
    const two = scormManifest({ scos: [{ href: 'index.html', id: 'r1' }, { href: 'index.html', id: 'r2' }] });
    expect(await codesOf([INDEX, { name: 'imsmanifest.xml', data: two }])).toEqual(['MULTI_SCO_UNSUPPORTED']);
  });

  it('LAUNCH_FILE_MISSING for no href, a missing file, a path out of the package, a URL, and no SCO', async () => {
    for (const sco of [{}, { href: 'missing.html' }, { href: '../index.html' }, { href: 'https://example.com/index.html' }]) {
      expect(await codesOf([INDEX, { name: 'imsmanifest.xml', data: scormManifest({ scos: [sco] }) }])).toEqual(['LAUNCH_FILE_MISSING']);
    }
    const noSco = scormManifest().replace('adlcp:scormtype="sco"', 'adlcp:scormtype="asset"');
    expect(await codesOf([INDEX, { name: 'imsmanifest.xml', data: noSco }])).toEqual(['LAUNCH_FILE_MISSING']);
  });

  it('NO_ENTRY_PAGE for an HTML zip without index.html (also index.html two folders down)', async () => {
    expect(await codesOf([{ name: 'page.html', data: 'x' }])).toEqual(['NO_ENTRY_PAGE']);
    expect(await codesOf([{ name: 'a/b/index.html', data: 'x' }])).toEqual(['NO_ENTRY_PAGE']);
    expect(await codesOf([{ name: 'a/index.html', data: 'x' }, { name: 'b/x.css', data: 'x' }])).toEqual(['NO_ENTRY_PAGE']);
    expect(await codesOf([])).toEqual(['NO_ENTRY_PAGE']);
  });

  it('ZIP_INVALID for a text file, an encrypted entry, an unknown method and a bad CRC', async () => {
    const text = join(newTempDir(), 'notes.zip');
    (await import('node:fs')).writeFileSync(text, 'just some text\n');
    const r = await inspectPackage(text);
    expect(!r.ok && r.reasons).toEqual([{ code: 'ZIP_INVALID', detail: 'The file is not a readable zip.' }]);
    expect(await codesOf([INDEX, { name: 'secret.html', data: 'x', flags: 0x1 }])).toEqual(['ZIP_INVALID']);
    expect(await codesOf([INDEX, { name: 'x.bin', data: 'x', method: 99 }])).toEqual(['ZIP_INVALID']);
    expect(await codesOf([{ ...INDEX, crc: 1234 }])).toEqual(['ZIP_INVALID']);
  });

  it('DUPLICATE_ENTRY after case folding, after NFC, and for a file that is also a folder', async () => {
    expect(await codesOf([INDEX, { name: 'A.html', data: 'x' }, { name: 'a.html', data: 'y' }])).toEqual(['DUPLICATE_ENTRY']);
    expect(await codesOf([INDEX, { name: 'caf\u00e9.html', data: 'x' }, { name: 'cafe\u0301.html', data: 'y' }])).toEqual(['DUPLICATE_ENTRY']);
    expect(await codesOf([INDEX, { name: 'a', data: 'x' }, { name: 'a/b.html', data: 'y' }])).toEqual(['DUPLICATE_ENTRY']);
    expect(await codesOf([INDEX, { name: 'img/a.png', data: 'x' }, { name: 'IMG/b.png', data: 'y' }])).toEqual(['DUPLICATE_ENTRY']);
  });

  it('INVALID_ENTRY_NAME for a control character, a backslash and bad UTF-8', async () => {
    expect(await codesOf([INDEX, { name: 'a\u0001.html', data: 'x' }])).toEqual(['INVALID_ENTRY_NAME']);
    expect(await codesOf([INDEX, { name: 'a\u0000.html', data: 'x' }])).toEqual(['INVALID_ENTRY_NAME']);
    expect(await codesOf([INDEX, { name: 'dir\\a.html', data: 'x' }])).toEqual(['INVALID_ENTRY_NAME']);
    expect(await codesOf([INDEX, { name: Buffer.from([0x61, 0xff, 0x2e, 0x68]), data: 'x', flags: 0x800 }])).toEqual(['INVALID_ENTRY_NAME']);
  });

  it('ZIP_TOO_MANY_ENTRIES for 5,001 entries (5,000 pass the count rule)', async () => {
    const many = (n: number): TestEntry[] => [INDEX, ...Array.from({ length: n - 1 }, (_, i) => ({ name: `f/${i}.txt`, data: '' }))];
    expect(await codesOf(many(5001))).toEqual(['ZIP_TOO_MANY_ENTRIES']);
    expect((await inspectPackage(writeTestZip(many(5000)))).ok).toBe(true);
  });

  it('ZIP_TOO_LARGE for a file over the upload limit and for an uncompressed total over the limit', async () => {
    const zip = writeTestZip([INDEX, { name: 'big.bin', data: Buffer.alloc(2000, 7) }]);
    const a = await inspectPackage(zip, { limits: { maxUploadBytes: 1000 } });
    expect(!a.ok && a.reasons.map((r) => r.code)).toEqual(['ZIP_TOO_LARGE']);
    const b = await inspectPackage(zip, { limits: { maxTotalBytes: 1500 } });
    expect(!b.ok && b.reasons.map((r) => r.code)).toEqual(['ZIP_TOO_LARGE']);
  });

  it('lists every bad entry, with the path', async () => {
    const r = await inspectPackage(writeTestZip([INDEX, { name: '../a.html', data: 'x' }, { name: '/b.html', data: 'x' }]));
    expect(!r.ok && r.reasons).toEqual([
      { code: 'PATH_TRAVERSAL', path: '../a.html', detail: 'The entry name has a ".." segment.' },
      { code: 'ABSOLUTE_PATH', path: '/b.html', detail: 'The entry name is an absolute path.' },
    ]);
  });
});

describe('package identifiers (app contract §3.3, AC-T4-35)', () => {
  const html = (body: string): TestEntry => ({ name: 'index.html', data: `<html><body>${body}</body></html>` });
  const reasonOf = async (entries: TestEntry[]) => {
    const r = await inspectPackage(writeTestZip(entries));
    if (r.ok) throw new Error('expected a rejection');
    return r.reasons[0]!;
  };

  it('a manifest identifier of 129 characters, or with a bad character, or missing', async () => {
    const long = scormManifest().replace('identifier="com.example.test"', `identifier="${'a'.repeat(129)}"`);
    expect(await reasonOf([INDEX, { name: 'imsmanifest.xml', data: long }])).toEqual({
      code: 'INVALID_PACKAGE_IDENTIFIER', path: 'imsmanifest.xml', detail: 'The manifest identifier must have 1 to 128 characters.',
    });
    const ok128 = scormManifest().replace('identifier="com.example.test"', `identifier="${'a'.repeat(128)}"`);
    expect((await inspectPackage(writeTestZip([INDEX, { name: 'imsmanifest.xml', data: ok128 }]))).ok).toBe(true);
    const space = scormManifest().replace('identifier="item-1"', 'identifier="item 1"');
    expect((await reasonOf([INDEX, { name: 'imsmanifest.xml', data: space }])).detail).toBe('The item identifier may contain only A-Z, a-z, 0-9, ".", "_", ":" and "-".');
    const proto = scormManifest().replace('identifier="org-1"', 'identifier="Constructor"');
    expect((await reasonOf([INDEX, { name: 'imsmanifest.xml', data: proto }])).detail).toBe('The organization identifier is a reserved name.');
    const missing = scormManifest().replace('<resource identifier="res-0"', '<resource');
    expect((await reasonOf([INDEX, { name: 'imsmanifest.xml', data: missing }])).detail).toBe('The resource identifier is missing.');
  });

  it('a manifest title with U+0007 (raw or &#7;), an empty title, a title over 255 characters', async () => {
    for (const title of ['Bad\u0007title', 'Bad&#7;title', '   ', 'x'.repeat(256)]) {
      const r = await reasonOf([INDEX, { name: 'imsmanifest.xml', data: scormManifest({ title }) }]);
      expect(r.code, JSON.stringify(title)).toBe('INVALID_PACKAGE_IDENTIFIER');
      expect(r.detail).toMatch(/^The organization title /);
    }
    const ok = await inspectPackage(writeTestZip([INDEX, { name: 'imsmanifest.xml', data: scormManifest({ title: `Tab\there ${'x'.repeat(240)}` }) }]));
    expect(ok.ok).toBe(true);
  });

  it('data-cog-quiz="__proto__", an empty id, an id over 128 characters, a bad character', async () => {
    for (const q of ['__proto__', 'PROTOTYPE', '', 'q'.repeat(129), 'a b', 'a/b']) {
      const r = await reasonOf([html(`<div data-cog-quiz="${q}"></div>`)]);
      expect(r, q).toMatchObject({ code: 'INVALID_PACKAGE_IDENTIFIER', path: 'index.html' });
      expect(r.detail).toMatch(/^A question id \(data-cog-quiz\) /);
    }
  });

  it('a page key "bad key" (file name with a space), a bad data-lesson-id, a duplicate key', async () => {
    expect(await reasonOf([INDEX, { name: 'bad key.html', data: '<p>x</p>' }])).toEqual({
      code: 'INVALID_PACKAGE_IDENTIFIER', path: 'bad key.html', detail: 'The page key may contain only A-Z, a-z, 0-9, ".", "_" and "-".',
    });
    expect((await reasonOf([html(''), { name: 'b.html', data: '<body data-lesson-id="__proto__"></body>' }])).detail).toBe('The page key is a reserved name.');
    expect((await reasonOf([html(''), { name: `${'p'.repeat(65)}.html`, data: 'x' }])).detail).toBe('The page key must have 1 to 64 characters.');
    expect((await reasonOf([html(''), { name: 'b.html', data: '<body data-lesson-id="index"></body>' }])).detail).toBe('The page key is the same as the key of another page.');
  });

  it('page key = data-lesson-id when present, else the file name; menu page = the key of index.html', async () => {
    const r = await inspectPackage(writeTestZip([
      { name: 'index.html', data: '<body data-lesson-id="home"></body>' },
      { name: 'b.html', data: '<body><div data-cog-quiz="Q1"></div></body>' },
    ]));
    expect(r.ok && r.inspection.report.html).toEqual({ pages: ['b', 'home'], menuPage: 'home', questionIds: ['Q1'] });
  });

  it('more than 1,000 question ids, more than 500 pages', async () => {
    const quizzes = Array.from({ length: 1001 }, (_, i) => `<div data-cog-quiz="q${i}"></div>`).join('');
    expect((await reasonOf([html(quizzes)])).detail).toBe('The package has 1001 question ids. The limit is 1000.');
    const pages = Array.from({ length: 500 }, (_, i) => ({ name: `p${i}.html`, data: 'x' }));
    expect((await reasonOf([html(''), ...pages])).detail).toBe('The package has 501 pages. The limit is 500.');
  });

  it('every reject code has a title and an action sentence (B-T4a-02)', () => {
    expect(Object.keys(REJECT_INFO).sort()).toEqual([...REJECT_CODES].sort());
    for (const code of REJECT_CODES) {
      expect(REJECT_INFO[code].title.length, code).toBeGreaterThan(5);
      expect(REJECT_INFO[code].action, code).toMatch(/^[A-Z].*\.$/);
    }
  });
});

describe('detection and profile (contract §3.1)', () => {
  it('HTML in one top-level folder; pages sorted; questions unique in page order', async () => {
    const r = await inspectPackage(writeTestZip([
      { name: 'course/', data: '' },
      { name: 'course/index.html', data: '<body data-lesson-id="index"><div data-cog-quiz="Q2"></div></body>' },
      { name: 'course/b-lesson.html', data: '<div data-cog-quiz="Q1"></div><div data-cog-quiz="Q2"></div><div data-cog-quiz="Q3"></div>' },
      { name: 'course/sub/deep.html', data: '<div data-cog-quiz="Q9"></div>' },
    ]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.inspection.report.entryPath).toBe('course/index.html');
    expect(r.inspection.report.html).toEqual({ pages: ['b-lesson', 'index'], menuPage: 'index', questionIds: ['Q1', 'Q2', 'Q3'] });
    expect(r.inspection.report.fileCount).toBe(3);
    expect(r.inspection.trackingProfile.masteryScore).toBe(70);
  });

  it('HTML mastery: the upload value, else 70 with questions, else null; one page has no menu page', async () => {
    const withQuiz = writeTestZip([{ name: 'index.html', data: '<div data-cog-quiz="Q1"></div>' }]);
    const a = await inspectPackage(withQuiz, { masteryScore: 85 });
    expect(a.ok && a.inspection.trackingProfile.masteryScore).toBe(85);
    const b = await inspectPackage(writeTestZip([INDEX]));
    expect(b.ok && b.inspection.trackingProfile).toMatchObject({ masteryScore: null, menuPage: null, pages: ['index'], questionIds: [] });
  });

  it('SCORM in one top-level folder; the manifest mastery wins over the upload value', async () => {
    const r = await inspectPackage(writeTestZip([
      { name: 'pkg/imsmanifest.xml', data: scormManifest({ scos: [{ href: 'content/start.html?x=1' }], mastery: '80', title: 'Q&amp;A' }) },
      { name: 'pkg/content/start.html', data: 'x' },
      { name: 'pkg/index.html', data: 'x' },
    ]), { masteryScore: 10 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.inspection.report.entryPath).toBe('pkg/content/start.html');
    expect(r.inspection.report.scorm).toMatchObject({ title: 'Q&A', masteryScore: 80, scoCount: 1 });
    expect(r.inspection.trackingProfile).toMatchObject({ launchPath: 'pkg/content/start.html', masteryScore: 80, pages: ['index'] });
  });

  it('a manifest wins over index.html (a SCORM zip has both)', async () => {
    const r = await inspectPackage(writeTestZip([INDEX, { name: 'imsmanifest.xml', data: scormManifest() }]));
    expect(r.ok && r.inspection.format).toBe('scorm12');
  });

  it('external hosts come from HTML and CSS files anywhere in the package, sorted', async () => {
    const r = await inspectPackage(writeTestZip([
      { name: 'index.html', data: '<img src="https://img.example.com/a.png"><a href="https://link.example.com/">x</a><script>fetch("https://script.example.com")</script>' },
      { name: 'css/site.css', data: '@import "https://css.example.com/x.css"; /* url(https://comment.example.com/x) */' },
      { name: 'data.json', data: '{"u":"https://json.example.com"}' },
    ]));
    expect(r.ok && r.inspection.report.externalHosts).toEqual(['css.example.com', 'img.example.com']);
  });
});

describe('extraction', () => {
  it('writes only after the checks: a rejected zip leaves no folder', async () => {
    const parent = newTempDir();
    const dest = join(parent, 'pkg_bad');
    await expect(extractPackage(writeTestZip([INDEX, { name: '../evil.html', data: 'x' }]), dest)).rejects.toBeInstanceOf(PackageRejectedError);
    expect(readdirSync(parent)).toEqual([]);
  });

  it('a bad CRC in a binary file is found while writing; the folder is removed', async () => {
    const parent = newTempDir();
    const zip = writeTestZip([INDEX, { name: 'img/a.png', data: Buffer.alloc(100, 1), crc: 42 }]);
    expect((await inspectPackage(zip)).ok).toBe(true); // binary files are not read by the inspector
    const err = await extractPackage(zip, join(parent, 'pkg_crc')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PackageRejectedError);
    expect((err as PackageRejectedError).reasons[0]?.code).toBe('ZIP_INVALID');
    expect(readdirSync(parent)).toEqual([]);
  });

  it('bad deflate data is ZIP_INVALID', async () => {
    const parent = newTempDir();
    const good = deflateRawSync(Buffer.from('hello hello hello'));
    const zip = writeTestZip([INDEX, { name: 'x.bin', data: Buffer.from('hello hello hello'), method: 8 }]);
    // Corrupt the deflate stream in place (first data byte of the second entry).
    const fs = await import('node:fs');
    const bytes = fs.readFileSync(zip);
    const at = bytes.indexOf(good);
    bytes.fill(0xff, at, at + good.length);
    fs.writeFileSync(zip, bytes);
    const err = await extractPackage(zip, join(parent, 'pkg_inflate')).catch((e: unknown) => e);
    expect((err as PackageRejectedError).reasons?.[0]?.code).toBe('ZIP_INVALID');
    expect(readdirSync(parent)).toEqual([]);
  });

  it('refuses a folder that exists', async () => {
    const dest = newTempDir();
    await expect(extractPackage(writeTestZip([INDEX]), dest)).rejects.toMatchObject({ code: 'EEXIST' });
  });
});
