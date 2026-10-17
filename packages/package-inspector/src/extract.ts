import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { ZipFile } from 'yauzl';
import type { Limits } from './codes.ts';
import { DEFAULT_LIMITS, PackageRejectedError, reasonPath } from './codes.ts';
import { ZipReadError, crcCheck, openRawStream, openZip, readEntries, scanEntries } from './zip.ts';

export interface ExtractResult {
  fileCount: number;
  totalBytes: number;
}

/** Target file inside the package folder, or null if the path would leave it (never true after scanEntries). */
export function safeTarget(destDir: string, path: string): string | null {
  const target = resolve(destDir, ...path.split('/'));
  return target.startsWith(destDir + sep) ? target : null;
}

/**
 * Extract a zip that inspectPackage accepted into `destDir`, a NEW folder (it must not exist).
 * The entry checks run again here, so this function is safe alone. Files are created with O_EXCL ("wx"),
 * the data must match the CRC-32 and the size of the central directory. On any error the folder is deleted
 * and the error is thrown (PackageRejectedError for a bad zip).
 */
export async function extractPackage(zipPath: string, destDir: string, limits: Partial<Limits> = {}): Promise<ExtractResult> {
  if (!isAbsolute(destDir)) throw new Error('destDir must be an absolute path');
  const dest = resolve(destDir);
  await mkdir(dirname(dest), { recursive: true });
  await mkdir(dest); // EEXIST if the folder is there: a package folder is always new
  let zip: ZipFile | undefined;
  try {
    zip = await openZip(zipPath);
    const scanned = scanEntries(await readEntries(zip), { ...DEFAULT_LIMITS, ...limits });
    if (!scanned.ok) throw new PackageRejectedError(scanned.reasons);
    for (const dir of scanned.scan.dirs) {
      const target = safeTarget(dest, dir);
      if (!target) throw new PackageRejectedError([{ code: 'PATH_TRAVERSAL', path: reasonPath(dir), detail: 'The folder is outside the package.' }]);
      await mkdir(target, { recursive: true });
    }
    for (const file of scanned.scan.files) {
      const target = safeTarget(dest, file.path);
      if (!target) throw new PackageRejectedError([{ code: 'PATH_TRAVERSAL', path: reasonPath(file.path), detail: 'The file is outside the package.' }]);
      await mkdir(dirname(target), { recursive: true });
      const raw = await openRawStream(zip, file);
      try {
        await pipeline(raw, crcCheck(file.entry, file.path), createWriteStream(target, { flags: 'wx', mode: 0o644 }));
      } catch (err) {
        if (err instanceof ZipReadError) throw err;
        // yauzl reports a size mismatch or bad deflate data as a stream error.
        if (err instanceof Error && !('code' in err && typeof err.code === 'string' && err.code.startsWith('E'))) {
          throw new ZipReadError(err.message, file.path);
        }
        throw err;
      }
    }
    return { fileCount: scanned.scan.files.length, totalBytes: scanned.scan.totalBytes };
  } catch (err) {
    await rm(dest, { recursive: true, force: true });
    if (err instanceof ZipReadError) {
      throw new PackageRejectedError([{ code: 'ZIP_INVALID', ...(err.path ? { path: reasonPath(err.path) } : {}), detail: 'The zip data cannot be read.' }]);
    }
    throw err;
  } finally {
    zip?.close();
  }
}
