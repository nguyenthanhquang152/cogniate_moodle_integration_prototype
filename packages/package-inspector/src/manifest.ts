import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { RejectCode } from './codes.ts';

export interface ScormSco {
  identifier: string;
  /** href attribute as written in the manifest (may be missing). */
  href: string | null;
}

export interface ScormManifest {
  schemaVersion: string;
  identifier: string;
  title: string;
  masteryScore: number | null;
  scos: ScormSco[];
}

export type ManifestResult =
  | { ok: true; manifest: ScormManifest }
  | { ok: false; code: Extract<RejectCode, 'MANIFEST_DTD_FORBIDDEN' | 'MANIFEST_INVALID_XML' | 'SCORM_VERSION_UNSUPPORTED'>; detail: string };

type XNode = Record<string, unknown>;

const utf8 = new TextDecoder('utf-8', { fatal: true });
const ADLCP_12_NS = 'http://www.adlnet.org/xsd/adlcp_rootv1p2';

/** Bytes to text: a UTF-16 byte order mark gives UTF-16, else strict UTF-8 (BOM removed). null if not decodable. */
export function decodeXml(bytes: Uint8Array): string | null {
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2));
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be', { fatal: true }).decode(bytes.subarray(2));
    const text = utf8.decode(bytes);
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  } catch {
    return null;
  }
}

/** Only the five predefined XML entities and character references. No DTD entity is ever expanded. */
export function decodeXmlText(value: string): string {
  return value.replace(/&(lt|gt|amp|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6});/g, (all, name: string) => {
    switch (name) {
      case 'lt': return '<';
      case 'gt': return '>';
      case 'amp': return '&';
      case 'quot': return '"';
      case 'apos': return "'";
      default: {
        const cp = name[1] === 'x' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
        return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : all;
      }
    }
  });
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  alwaysCreateTextNode: true,
  processEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  removeNSPrefix: true,
  // Every element is an array, so one and many look the same.
  isArray: (_name, _path, _leaf, isAttribute) => !isAttribute,
});

const kids = (node: XNode | undefined, name: string): XNode[] => {
  const v = node?.[name];
  return Array.isArray(v) ? (v as XNode[]) : [];
};
const first = (node: XNode | undefined, name: string): XNode | undefined => kids(node, name)[0];
const text = (node: XNode | undefined): string => {
  const v = node?.['#text'];
  return typeof v === 'string' ? decodeXmlText(v).trim() : '';
};
/** Attribute by local name, case-insensitive (adlcp:scormtype and adlcp:scormType both occur). */
const attr = (node: XNode | undefined, name: string): string | null => {
  if (!node) return null;
  const want = `@_${name.toLowerCase()}`;
  for (const [k, v] of Object.entries(node)) if (k.toLowerCase() === want && typeof v === 'string') return decodeXmlText(v);
  return null;
};

function* walkItems(items: XNode[]): Generator<XNode> {
  for (const item of items) {
    yield item;
    yield* walkItems(kids(item, 'item'));
  }
}

/**
 * Parse imsmanifest.xml (security §7): reject `<!DOCTYPE` and `<!ENTITY` on the raw text first, then validate
 * and parse with entity processing off. Checks the SCORM version: metadata/schemaversion must be "1.2"; if there is
 * no schemaversion, the adlcp 1.2 namespace must be declared.
 */
export function parseManifest(bytes: Uint8Array): ManifestResult {
  const xml = decodeXml(bytes);
  if (xml === null) return { ok: false, code: 'MANIFEST_INVALID_XML', detail: 'The manifest is not valid UTF-8 or UTF-16 text.' };
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) {
    return { ok: false, code: 'MANIFEST_DTD_FORBIDDEN', detail: 'The manifest has a <!DOCTYPE> or <!ENTITY> declaration.' };
  }
  const valid = XMLValidator.validate(xml);
  if (valid !== true) {
    return { ok: false, code: 'MANIFEST_INVALID_XML', detail: `The manifest is not well-formed XML (line ${valid.err.line}).` };
  }
  let doc: XNode;
  try {
    doc = parser.parse(xml) as XNode;
  } catch {
    return { ok: false, code: 'MANIFEST_INVALID_XML', detail: 'The manifest is not well-formed XML.' };
  }
  const manifest = first(doc, 'manifest');
  if (!manifest) return { ok: false, code: 'MANIFEST_INVALID_XML', detail: 'The root element is not <manifest>.' };

  const schemaVersionNode = first(first(manifest, 'metadata'), 'schemaversion');
  const schemaVersion = schemaVersionNode ? text(schemaVersionNode) : null;
  if (schemaVersion !== null ? schemaVersion !== '1.2' : !xml.includes(ADLCP_12_NS)) {
    return {
      ok: false,
      code: 'SCORM_VERSION_UNSUPPORTED',
      detail: schemaVersion !== null ? `The manifest is SCORM "${schemaVersion.slice(0, 40)}". Only SCORM 1.2 is supported.` : 'The manifest does not say SCORM 1.2.',
    };
  }

  const organizations = first(manifest, 'organizations');
  const orgList = kids(organizations, 'organization');
  const defaultOrg = attr(organizations, 'default');
  const org = orgList.find((o) => defaultOrg !== null && attr(o, 'identifier') === defaultOrg) ?? orgList[0];

  const scos: ScormSco[] = [];
  for (const res of kids(first(manifest, 'resources'), 'resource')) {
    if ((attr(res, 'scormtype') ?? '').trim().toLowerCase() !== 'sco') continue;
    const href = attr(res, 'href');
    scos.push({ identifier: attr(res, 'identifier') ?? '', href: href === null || href.trim() === '' ? null : href.trim() });
  }

  // Mastery score of the item that refers to the SCO (in the default organisation, else in any organisation).
  let masteryScore: number | null = null;
  const sco = scos[0];
  if (sco) {
    const items = [...walkItems(kids(org, 'item')), ...orgList.filter((o) => o !== org).flatMap((o) => [...walkItems(kids(o, 'item'))])];
    const item = items.find((i) => attr(i, 'identifierref') === sco.identifier);
    const raw = item ? text(first(item, 'masteryscore')) : '';
    if (/^\d{1,3}(\.\d+)?$/.test(raw)) {
      const n = Number(raw);
      if (n >= 0 && n <= 100) masteryScore = n;
    }
  }

  return {
    ok: true,
    manifest: {
      schemaVersion: '1.2',
      identifier: attr(manifest, 'identifier') ?? '',
      title: text(first(org, 'title')),
      masteryScore,
      scos,
    },
  };
}

/**
 * Resolve a SCO href against the folder of the manifest. Drops the query and the fragment and decodes %XX.
 * Returns null for an absolute URL, an absolute path or a path that leaves the package.
 */
export function resolveHref(root: string, href: string): string | null {
  const bare = href.split(/[?#]/, 1)[0] ?? '';
  if (bare === '' || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(bare) || bare.startsWith('/') || bare.includes('\\')) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(bare);
  } catch {
    decoded = bare;
  }
  const out = root === '' ? [] : root.replace(/\/$/, '').split('/');
  const base = out.length;
  for (const seg of decoded.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (out.length <= base) return null;
      out.pop();
    } else {
      out.push(seg);
    }
  }
  return out.length > base ? out.join('/') : null;
}
