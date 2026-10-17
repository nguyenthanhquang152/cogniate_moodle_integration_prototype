// Test helper (not used by services): write small zips with exact control of names, flags, modes and CRC,
// so unit tests can craft each bad package of AC-T4-05.
import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

export interface TestEntry {
  /** Entry name. A Buffer is written as is (for bad encodings). A name that ends with "/" is a folder. */
  name: string | Buffer;
  data?: Buffer | string;
  /** 0 = stored (default), 8 = deflate, any other number is written as is (the data stays raw). */
  method?: number;
  /** General purpose flags. Bit 11 (UTF-8) is added for non-ASCII string names. */
  flags?: number;
  /** Unix mode (for example 0o120777 for a symbolic link). Sets "made by Unix". */
  unixMode?: number;
  /** Write this CRC-32 instead of the real one. */
  crc?: number;
}

export function makeZip(entries: TestEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = typeof e.name === 'string' ? Buffer.from(e.name, 'utf8') : e.name;
    const raw = e.data === undefined ? Buffer.alloc(0) : Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    const method = e.method ?? 0;
    const body = method === 8 ? deflateRawSync(raw) : raw;
    const utf8Flag = typeof e.name === 'string' && [...e.name].some((c) => c.codePointAt(0)! > 0x7f) ? 0x800 : 0;
    const flags = (e.flags ?? 0) | utf8Flag;
    const crc = e.crc ?? crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0x5b4f, 12); // date 2025-10-15
    local.writeUInt32LE(crc >>> 0, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(e.unixMode === undefined ? 20 : (3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x5b4f, 14);
    central.writeUInt32LE(crc >>> 0, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(e.unixMode === undefined ? 0 : (e.unixMode << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

/** A new empty temp folder. */
export function newTempDir(prefix = 'inspector-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Write a crafted zip into a new temp folder and return its path. */
export function writeTestZip(entries: TestEntry[], name = 'test.zip'): string {
  const file = join(newTempDir(), name);
  writeFileSync(file, makeZip(entries));
  return file;
}

/** Copy a fixture zip into a new, empty temp folder (fixtures are untrusted input) and return the copy. */
export function copyFixture(file: string): string {
  const copy = join(newTempDir('fixture-'), basename(file));
  copyFileSync(file, copy);
  return copy;
}

/** A minimal SCORM 1.2 manifest with the given resources (scormtype "sco" unless `asset`). */
export function scormManifest(opts: { schemaVersion?: string | null; scos?: Array<{ href?: string; id?: string }>; mastery?: string; title?: string } = {}): string {
  const scos = opts.scos ?? [{ href: 'index.html' }];
  const version = opts.schemaVersion === undefined ? '1.2' : opts.schemaVersion;
  const resources = scos.map((s, i) => `<resource identifier="${s.id ?? `res-${i}`}" type="webcontent" adlcp:scormtype="sco"${s.href === undefined ? '' : ` href="${s.href}"`}><file href="index.html"/></resource>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.example.test" version="1" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema>${version === null ? '' : `<schemaversion>${version}</schemaversion>`}</metadata>
  <organizations default="org-1"><organization identifier="org-1"><title>${opts.title ?? 'Test course'}</title>
    <item identifier="item-1" identifierref="${scos[0]?.id ?? 'res-0'}"><title>Item</title>${opts.mastery === undefined ? '' : `<adlcp:masteryscore>${opts.mastery}</adlcp:masteryscore>`}</item>
  </organization></organizations>
  <resources>${resources}</resources>
</manifest>`;
}
