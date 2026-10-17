import { describe, expect, it } from 'vitest';
import { decodeXml, decodeXmlText, parseManifest, resolveHref } from './manifest.ts';
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
    for (const bidi of ['gpj.\u202eexe.html', 'a\u200bb.html', 'a\u2066b.html', '\ufeffindex.html']) {
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
