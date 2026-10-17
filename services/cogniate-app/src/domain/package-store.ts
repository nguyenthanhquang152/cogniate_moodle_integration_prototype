// Package store on disk (ADR-006): packages/{packageId}/ (extracted) and uploads/{sha256}.zip (original).
// Upload temp files: uploads/.tmp/ (same file system, so the final rename is atomic).
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

export interface StorePaths {
  packages: string;
  uploads: string;
  tmp: string;
}

export function storePaths(dataDir: string): StorePaths {
  return { packages: join(dataDir, 'packages'), uploads: join(dataDir, 'uploads'), tmp: join(dataDir, 'uploads', '.tmp') };
}

/** Make the folders and delete temp files left by a stopped process. */
export async function prepareStore(dataDir: string): Promise<StorePaths> {
  const paths = storePaths(dataDir);
  for (const dir of [paths.packages, paths.uploads, paths.tmp]) await mkdir(dir, { recursive: true, mode: 0o700 });
  for (const name of await readdir(paths.tmp)) await rm(join(paths.tmp, name), { recursive: true, force: true });
  return paths;
}
