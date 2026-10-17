import { Transform } from 'node:stream';
import type { Readable } from 'node:stream';
import { crc32 } from 'node:zlib';
import yauzl from 'yauzl';
import type { Entry, ZipFile } from 'yauzl';
import type { Limits, RejectReason } from './codes.ts';
import { reasonPath } from './codes.ts';
import { checkEntryName, decodeEntryName, foldKey } from './names.ts';

/** A file of the zip that passed every entry check. `path` is the safe, normalised path. */
export interface ZipFileEntry {
  path: string;
  size: number;
  entry: Entry;
}

export interface ZipScan {
  files: ZipFileEntry[];
  /** Folders: explicit folder entries and the parent folders of files (normalised paths, no trailing slash). */
  dirs: string[];
  totalBytes: number;
}

/** Any read problem of the zip structure or of the entry data (the caller reports ZIP_INVALID). */
export class ZipReadError extends Error {
  readonly path: string | undefined;
  constructor(message: string, path?: string) {
    super(message);
    this.name = 'ZipReadError';
    this.path = path;
  }
}

const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;
const S_IFDIR = 0o040000;
const MAX_REASONS = 50;

/**
 * Open the zip with yauzl. Names stay raw bytes (decodeStrings false) so our own name rules apply;
 * yauzl checks that each entry's data has the size of the central directory (validateEntrySizes).
 */
export async function openZip(file: string): Promise<ZipFile> {
  try {
    return await yauzl.openPromise(file, { lazyEntries: true, autoClose: false, decodeStrings: false, validateEntrySizes: true, strictFileNames: false });
  } catch (err) {
    throw new ZipReadError(err instanceof Error ? err.message : 'unreadable zip');
  }
}

/** Read the whole central directory (no file data). */
export function readEntries(zip: ZipFile): Promise<Entry[]> {
  return new Promise((resolve, reject) => {
    const entries: Entry[] = [];
    const onError = (err: Error) => {
      cleanup();
      reject(new ZipReadError(err.message));
    };
    const onEntry = (entry: Entry) => {
      entries.push(entry);
      zip.readEntry();
    };
    const onEnd = () => {
      cleanup();
      resolve(entries);
    };
    const cleanup = () => {
      zip.off('error', onError);
      zip.off('entry', onEntry);
      zip.off('end', onEnd);
    };
    zip.on('error', onError);
    zip.on('entry', onEntry);
    zip.on('end', onEnd);
    zip.readEntry();
  });
}

/**
 * The entry checks of security §7 on the central directory, before any file data is read:
 * name rules, encryption, compression method, symbolic links, ratio, duplicates, total size.
 * Returns the safe file list, or the reasons (at most 50, the total size reason first).
 */
export function scanEntries(entries: Entry[], limits: Limits): { ok: true; scan: ZipScan } | { ok: false; reasons: RejectReason[] } {
  const reasons: RejectReason[] = [];
  const files: ZipFileEntry[] = [];
  const explicitDirs = new Set<string>();
  /** fold key -> 'file' | the first spelling of a folder */
  const seen = new Map<string, { kind: 'file' | 'dir'; path: string; explicit: boolean }>();
  let totalBytes = 0;
  const add = (r: RejectReason) => {
    if (reasons.length < MAX_REASONS) reasons.push(r);
  };

  for (const entry of entries) {
    const raw = entry.fileName as unknown as Buffer;
    const name = decodeEntryName(raw, entry.generalPurposeBitFlag);
    if (name === null) {
      add({ code: 'INVALID_ENTRY_NAME', path: reasonPath(raw.toString('latin1')), detail: 'The entry name is not valid UTF-8.' });
      continue;
    }
    const checked = checkEntryName(name);
    if (!checked.ok) {
      add({ code: checked.code, path: reasonPath(name), detail: checked.detail });
      continue;
    }
    const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
    if ((mode & S_IFMT) === S_IFLNK) {
      add({ code: 'SYMLINK_ENTRY', path: reasonPath(name), detail: 'The entry is a symbolic link.' });
      continue;
    }
    if ((entry.generalPurposeBitFlag & 0x41) !== 0) {
      add({ code: 'ZIP_INVALID', path: reasonPath(name), detail: 'The entry is encrypted.' });
      continue;
    }
    const isDir = checked.isDir || (mode & S_IFMT) === S_IFDIR;
    if (!isDir && entry.compressionMethod !== 0 && entry.compressionMethod !== 8) {
      add({ code: 'ZIP_INVALID', path: reasonPath(name), detail: `The entry uses compression method ${entry.compressionMethod}. Only stored (0) and deflate (8) are supported.` });
      continue;
    }
    if (!isDir) {
      const ratio = entry.compressedSize === 0 ? (entry.uncompressedSize === 0 ? 0 : Infinity) : entry.uncompressedSize / entry.compressedSize;
      if (ratio > limits.maxRatio) {
        add({ code: 'ZIP_BOMB', path: reasonPath(name), detail: `The compression ratio of the entry is more than ${limits.maxRatio}:1.` });
        continue;
      }
    }

    // Duplicates after NFC + case fold: two files, a file and a folder, or two spellings of one folder.
    const parents = checked.path.split('/').slice(0, -1).map((_, i, all) => all.slice(0, i + 1).join('/'));
    let duplicate: string | undefined;
    for (const dir of parents) {
      const prev = seen.get(foldKey(dir));
      if (prev && (prev.kind === 'file' || prev.path !== dir)) {
        duplicate = prev.path;
        break;
      }
      if (!prev) seen.set(foldKey(dir), { kind: 'dir', path: dir, explicit: false });
    }
    if (duplicate === undefined) {
      const key = foldKey(checked.path);
      const prev = seen.get(key);
      if (isDir) {
        if (prev && (prev.kind === 'file' || prev.path !== checked.path || prev.explicit)) duplicate = prev.path;
        else seen.set(key, { kind: 'dir', path: checked.path, explicit: true });
      } else if (prev) {
        duplicate = prev.path;
      } else {
        seen.set(key, { kind: 'file', path: checked.path, explicit: true });
      }
    }
    if (duplicate !== undefined) {
      add({ code: 'DUPLICATE_ENTRY', path: reasonPath(name), detail: `The entry has the same name as "${reasonPath(duplicate)}" after Unicode normalisation and case folding.` });
      continue;
    }

    if (isDir) {
      explicitDirs.add(checked.path);
    } else {
      files.push({ path: checked.path, size: entry.uncompressedSize, entry });
      totalBytes += entry.uncompressedSize;
    }
  }

  if (totalBytes > limits.maxTotalBytes) {
    reasons.unshift({ code: 'ZIP_TOO_LARGE', detail: `The uncompressed size is more than ${limits.maxTotalBytes / 1_000_000} MB.` });
    if (reasons.length > MAX_REASONS) reasons.pop();
  }
  if (reasons.length > 0) return { ok: false, reasons };

  const dirs = new Set(explicitDirs);
  for (const f of files) {
    const parts = f.path.split('/');
    for (let i = 1; i < parts.length; i += 1) dirs.add(parts.slice(0, i).join('/'));
  }
  return { ok: true, scan: { files, dirs: [...dirs].sort(), totalBytes } };
}

/** A Transform that checks the CRC-32 of the entry data at the end (yauzl checks only the size). */
export function crcCheck(entry: Entry, path: string): Transform {
  let crc = 0;
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      crc = crc32(chunk, crc);
      cb(null, chunk);
    },
    flush(cb) {
      cb((crc >>> 0) === (entry.crc32 >>> 0) ? null : new ZipReadError('CRC-32 of the entry data does not match.', path));
    },
  });
}

/** The raw (inflated) data stream of one entry. Use it in a pipeline with crcCheck(). */
export async function openRawStream(zip: ZipFile, file: ZipFileEntry): Promise<Readable> {
  try {
    return await zip.openReadStreamPromise(file.entry);
  } catch (err) {
    throw new ZipReadError(err instanceof Error ? err.message : 'unreadable entry', file.path);
  }
}

/** Read one entry into memory (manifest, HTML, CSS). The caller checks the size limit first. */
export async function readEntryBuffer(zip: ZipFile, file: ZipFileEntry): Promise<Buffer> {
  const raw = await openRawStream(zip, file);
  const chunks: Buffer[] = [];
  let crc = 0;
  try {
    for await (const chunk of raw as AsyncIterable<Buffer>) {
      crc = crc32(chunk, crc);
      chunks.push(chunk);
    }
  } catch (err) {
    throw new ZipReadError(err instanceof Error ? err.message : 'unreadable entry', file.path);
  }
  if ((crc >>> 0) !== (file.entry.crc32 >>> 0)) throw new ZipReadError('CRC-32 of the entry data does not match.', file.path);
  return Buffer.concat(chunks);
}
