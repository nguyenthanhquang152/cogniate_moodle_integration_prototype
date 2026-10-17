import { describe, expect, it } from 'vitest';
import { decodeXml, decodeXmlText, hasIllegalXmlChar, parseManifest, resolveHref } from './manifest.ts';
import { checkEntryName, decodeEntryName, foldKey } from './names.ts';
import { scormManifest } from './testing.ts';

const enc = (s: string) => Buffer.from(s, 'utf8');

describe('parseManifest', () => {
  it('reads version, identifier, title, SCOs and mastery', () => {
    const r = parseManifest(enc(scormManifest({ mastery: '75.5', title: 'A &lt;b&gt; &#233;' })));
    expect(r).toMatchObject({
      ok: true,
      manifest: { schemaVersion: '1.2', identifier: 'com.example.test', title: 'A <b> é', masteryScore: 75.5, scos: [{ identifier: 'res-0', href: 'index.html' }] },
    });
  });

  it('characters that XML 1.0 does not allow: MANIFEST_INVALID_XML before the identifier rules (Q-T4a-02)', () => {
    for (const bad of ['\u0007', '&#7;', '&#x7;', '\u0000', '\u001f', '\ufffe', '\uffff', '&#xFFFE;', '&#xD800;', '&#0;']) {
      const r = parseManifest(enc(scormManifest({ title: `Bad ${bad} title` })));
      expect(r, JSON.stringify(bad)).toMatchObject({ ok: false, code: 'MANIFEST_INVALID_XML' });
    }
    // A lone surrogate in the file bytes (CESU ED A0 80) is not UTF-8: MANIFEST_INVALID_XML too.
    const [head, tail] = scormManifest({ title: 'SPLIT' }).split('SPLIT');
    expect(parseManifest(Buffer.concat([enc(head!), Buffer.from([0xed, 0xa0, 0x80]), enc(tail!)]))).toMatchObject({ ok: false, code: 'MANIFEST_INVALID_XML' });
    // Legal XML 1.0: tab, LF, CR, U+0085 (C1, banned later by the title rule), astral characters.
    expect(hasIllegalXmlChar('a\tb\nc\rd\u0085e\u{1F600}&#x85;&#x1F600;&#9;')).toBe(false);
    expect(parseManifest(enc(scormManifest({ title: 'C1 \u0085 title' })))).toMatchObject({ ok: true });
    // DOCTYPE still comes first.
    expect(parseManifest(enc(`<!DOCTYPE m>${scormManifest({ title: '\u0007' })}`))).toMatchObject({ code: 'MANIFEST_DTD_FORBIDDEN' });
  });

  it('collects every identifier and title for the identifier rules', () => {
    const r = parseManifest(enc(scormManifest()));
    expect(r.ok && r.manifest.identifiers).toEqual([
      { field: 'manifest identifier', value: 'com.example.test' },
      { field: 'organization identifier', value: 'org-1' },
      { field: 'item identifier', value: 'item-1' },
      { field: 'resource identifier', value: 'res-0' },
    ]);
    expect(r.ok && r.manifest.titles).toEqual([{ field: 'organization title', value: 'Test course' }, { field: 'item title', value: 'Item' }]);
  });

  it('a mastery score that is not 0-100 is null', () => {
    for (const m of ['abc', '101', '-1', '']) {
      const r = parseManifest(enc(scormManifest({ mastery: m })));
      expect(r.ok && r.manifest.masteryScore).toBeNull();
    }
  });

  it('rejects DOCTYPE and ENTITY in any case before parsing, also in UTF-16', () => {
    expect(parseManifest(enc(`<!doctype manifest>${scormManifest()}`))).toMatchObject({ ok: false, code: 'MANIFEST_DTD_FORBIDDEN' });
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`<!DOCTYPE x [<!ENTITY e "y">]><manifest/>`, 'utf16le')]);
    expect(parseManifest(utf16)).toMatchObject({ ok: false, code: 'MANIFEST_DTD_FORBIDDEN' });
  });

  it('invalid bytes and nesting deeper than the parser limit are MANIFEST_INVALID_XML', () => {
    expect(parseManifest(Buffer.from([0x3c, 0xff, 0xfe, 0x3e]))).toMatchObject({ ok: false, code: 'MANIFEST_INVALID_XML' });
    const deep = `<manifest><metadata><schemaversion>1.2</schemaversion></metadata>${'<item>'.repeat(500)}${'</item>'.repeat(500)}</manifest>`;
    expect(parseManifest(enc(deep))).toMatchObject({ ok: false, code: 'MANIFEST_INVALID_XML' });
  });

  it('accepts adlcp:scormType (camel case) and a BOM', () => {
    const xml = `\ufeff${scormManifest().replace('adlcp:scormtype', 'adlcp:scormType')}`;
    const r = parseManifest(enc(xml));
    expect(r.ok && r.manifest.scos).toHaveLength(1);
  });

  it('decodeXml and decodeXmlText', () => {
    expect(decodeXml(Buffer.from([0xef, 0xbb, 0xbf, 0x61]))).toBe('a');
    expect(decodeXmlText('&amp;lt; &#x41; &#0; &unknown;')).toBe('&lt; A &#0; &unknown;');
  });
});

describe('resolveHref', () => {
  it('resolves against the manifest folder and keeps inside it', () => {
    expect(resolveHref('', 'index.html')).toBe('index.html');
    expect(resolveHref('pkg/', 'a/./b.html?x=1#y')).toBe('pkg/a/b.html');
    expect(resolveHref('pkg/', 'a/../b.html')).toBe('pkg/b.html');
    expect(resolveHref('', 'my%20page.html')).toBe('my page.html');
    for (const bad of ['../x.html', 'https://x.example/a.html', '/x.html', 'a\\b.html', '', '?x']) expect(resolveHref('', bad)).toBeNull();
    expect(resolveHref('pkg/', '../x.html')).toBeNull();
  });
});

describe('entry names', () => {
  it('check order and normalised path', () => {
    expect(checkEntryName('a/./b//c.html')).toEqual({ ok: true, path: 'a/b/c.html', isDir: false });
    expect(checkEntryName('assets/')).toEqual({ ok: true, path: 'assets', isDir: true });
    expect(checkEntryName('\\..\\x')).toMatchObject({ code: 'ABSOLUTE_PATH' });
    expect(checkEntryName('a\\..\\x')).toMatchObject({ code: 'PATH_TRAVERSAL' });
    expect(checkEntryName('/\u0000')).toMatchObject({ code: 'INVALID_ENTRY_NAME' });
    expect(checkEntryName('a\u0085b')).toMatchObject({ code: 'INVALID_ENTRY_NAME' });
    expect(checkEntryName('./')).toMatchObject({ code: 'INVALID_ENTRY_NAME' });
    expect(checkEntryName(`${'x'.repeat(256)}.html`)).toMatchObject({ code: 'INVALID_ENTRY_NAME' });
    expect(checkEntryName('...html')).toMatchObject({ ok: true }); // three dots in a name are not a ".." segment
    for (const bidi of ['gpj.\u202eexe.html', 'a\u200bb.html', 'a\u2066b.html', '\ufeffindex.html', 'assets/a\u061cb.png', 'deep/er/a\u2028b.png',
      'a\u2029b.html', 'a\u2060b.html', 'x/a\u2064b.css', 'a\u00adb.html', 'a\u180eb.html']) {
      expect(checkEntryName(bidi)).toMatchObject({ code: 'INVALID_ENTRY_NAME' });
    }
  });

  it('foldKey and decodeEntryName', () => {
    expect(foldKey('Straße/CAFÉ')).toBe(foldKey('STRASSE/café'));
    expect(decodeEntryName(Buffer.from('café', 'utf8'), 0)).toBe('café');
    expect(decodeEntryName(Buffer.from([0x63, 0xe9]), 0)).toBe('cé'); // Latin-1 fallback without the flag
    expect(decodeEntryName(Buffer.from([0x63, 0xe9]), 0x800)).toBeNull();
  });
});
