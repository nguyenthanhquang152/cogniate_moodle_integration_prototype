// Minimal zip writer for QA's crafted packages (T4a AC-T4-05). No dependencies: Node zlib only (crc32: Node ≥ 22.2).
// It writes exactly the bytes that a test asks for: any entry name (also "../x", "/x" or control characters),
// any unix mode (symlink entries), STORE or DEFLATE, and large stored entries streamed to disk.
import fs from 'node:fs';
import zlib from 'node:zlib';

export interface ZipEntry {
  name: string;
  data: Buffer | string;
  deflate?: boolean;
  /** Unix mode bits, for example 0o120777 for a symlink. Default 0o100644 (regular file). */
  unixMode?: number;
}

const DOS_TIME = 0x6000; // 12:00:00
const DOS_DATE = 0x5a50; // 2025-02-16

function u16(n: number) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}
function u32(n: number) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}

interface Written {
  nameBytes: Buffer;
  crc: number;
  csize: number;
  usize: number;
  method: number;
  offset: number;
  mode: number;
  flags: number;
}

function localHeader(w: Omit<Written, 'offset' | 'mode'>): Buffer {
  return Buffer.concat([
    u32(0x04034b50), u16(20), u16(w.flags), u16(w.method), u16(DOS_TIME), u16(DOS_DATE),
    u32(w.crc), u32(w.csize), u32(w.usize), u16(w.nameBytes.length), u16(0), w.nameBytes,
  ]);
}

function centralDirectory(entries: Written[], cdOffset: number): Buffer {
  const parts: Buffer[] = [];
  for (const w of entries) {
    parts.push(
      u32(0x02014b50), u16((3 << 8) | 20), u16(20), u16(w.flags), u16(w.method), u16(DOS_TIME), u16(DOS_DATE),
      u32(w.crc), u32(w.csize), u32(w.usize), u16(w.nameBytes.length), u16(0), u16(0), u16(0), u16(0),
      u32((w.mode << 16) >>> 0), u32(w.offset), w.nameBytes,
    );
  }
  const cd = Buffer.concat(parts);
  const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cd.length), u32(cdOffset), u16(0)]);
  return Buffer.concat([cd, end]);
}

/** A whole zip in memory. */
export function zipBuffer(entries: ZipEntry[]): Buffer {
  const chunks: Buffer[] = [];
  const written: Written[] = [];
  let offset = 0;
  for (const e of entries) {
    const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    const body = e.deflate ? zlib.deflateRawSync(raw) : raw;
    const nameBytes = Buffer.from(e.name, 'utf8');
    const w = { nameBytes, crc: zlib.crc32(raw), csize: body.length, usize: raw.length, method: e.deflate ? 8 : 0, flags: /[^\x00-\x7f]/.test(e.name) ? 0x0800 : 0 };
    const header = localHeader(w);
    chunks.push(header, body);
    written.push({ ...w, offset, mode: e.unixMode ?? 0o100644 });
    offset += header.length + body.length;
  }
  chunks.push(centralDirectory(written, offset));
  return Buffer.concat(chunks);
}

/**
 * A zip on disk with small entries and one large STORED entry of random bytes (for the upload size limit).
 * Streams the data, so memory stays small.
 */
export async function writeLargeZip(file: string, small: ZipEntry[], big: { name: string; bytes: number }): Promise<void> {
  const fd = fs.openSync(file, 'w');
  const written: Written[] = [];
  let offset = 0;
  const write = (b: Buffer) => {
    fs.writeSync(fd, b);
    offset += b.length;
  };
  try {
    for (const e of small) {
      const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
      const w = { nameBytes: Buffer.from(e.name, 'utf8'), crc: zlib.crc32(raw), csize: raw.length, usize: raw.length, method: 0, flags: 0 };
      const start = offset;
      write(localHeader(w));
      write(raw);
      written.push({ ...w, offset: start, mode: 0o100644 });
    }
    // Large entry: data descriptor (flag bit 3), CRC computed while writing.
    const nameBytes = Buffer.from(big.name, 'utf8');
    const start = offset;
    write(localHeader({ nameBytes, crc: 0, csize: 0, usize: 0, method: 0, flags: 0x0008 }));
    let crc = 0;
    let left = big.bytes;
    const crypto = await import('node:crypto');
    while (left > 0) {
      const n = Math.min(left, 4 * 1024 * 1024);
      const chunk = crypto.randomBytes(n);
      crc = zlib.crc32(chunk, crc);
      write(chunk);
      left -= n;
    }
    write(Buffer.concat([u32(0x08074b50), u32(crc), u32(big.bytes), u32(big.bytes)]));
    written.push({ nameBytes, crc, csize: big.bytes, usize: big.bytes, method: 0, flags: 0x0008, offset: start, mode: 0o100644 });
    const cdOffset = offset;
    write(centralDirectory(written, cdOffset));
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Minimal zip reader (T5b AC-T5-10): the file entries of a zip from its central directory (STORE and DEFLATE).
 * Directory entries (names ending with "/") are skipped. No ZIP64 (the course fixtures are small zips).
 */
export function readZip(file: string): { name: string; data: Buffer }[] {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`${file}: no end of central directory`);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: { name: string; data: Buffer }[] = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`${file}: bad central directory entry ${n}`);
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error(`${file}: bad local header for ${name}`);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + csize);
    if (method === 0) out.push({ name, data: Buffer.from(raw) });
    else if (method === 8) out.push({ name, data: zlib.inflateRawSync(raw) });
    else throw new Error(`${file}: ${name} uses compression method ${method}`);
  }
  return out;
}
