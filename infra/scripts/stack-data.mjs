// Upgrade and rollback maintenance (ADR-011 §14, M1 scope): backup and restore of the two service databases.
//   node infra/scripts/stack-data.mjs backup  --out  <folder> --data <infra/.data> --project <name> --revision <sha> --repo <root>
//   node infra/scripts/stack-data.mjs restore --from <folder> --data <infra/.data> --project <name>
// Called by infra/scripts/stack-data.sh, which first refuses to run while cogniate-app or lti-service runs.
// Rules: a backup copies both databases and their present -wal / -shm sidecars, records the schema_migration names of
// each database, and writes a manifest (backup id, time, compose project, source revision, per-file name, size,
// SHA-256); it verifies the copies before it exits 0. A restore validates the WHOLE backup before it changes any file,
// replaces exactly the two databases and their listed sidecars, and deletes a target sidecar that the backup does not
// list. No command edits or deletes a migration ledger row. The backup contains secrets: keep it outside the checkout.
import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const DATABASES = ['lti-service/lti.db', 'cogniate-app/cogniate.db'];
const SIDECARS = ['-wal', '-shm'];
const ALLOWED = new Set(DATABASES.flatMap((d) => [d, ...SIDECARS.map((s) => `${d}${s}`)]));
const MANIFEST = 'manifest.json';

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

class Refused extends Error {}

/** The schema_migration names of a database (read from a scratch copy, so the source and the backup never change). */
function migrationNames(dataDir, db) {
  const scratch = mkdtempSync(join(tmpdir(), 'cogniate-backup-'));
  try {
    for (const name of [db, ...SIDECARS.map((s) => `${db}${s}`)]) {
      if (existsSync(join(dataDir, name))) {
        mkdirSync(dirname(join(scratch, name)), { recursive: true });
        copyFileSync(join(dataDir, name), join(scratch, name));
      }
    }
    const conn = new DatabaseSync(join(scratch, db));
    try {
      return conn.prepare('SELECT name FROM schema_migration ORDER BY name').all().map((r) => String(r.name));
    } finally {
      conn.close();
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

export function backup({ out, data, project, revision, repo }) {
  const outDir = resolve(out);
  if (repo && (outDir === resolve(repo) || outDir.startsWith(`${resolve(repo)}${sep}`))) throw new Refused('The backup folder must be outside the checkout (it contains secrets).');
  if (existsSync(outDir) && readdirSync(outDir).length > 0) throw new Refused(`The backup folder ${outDir} is not empty.`);
  for (const db of DATABASES) if (!existsSync(join(data, db))) throw new Refused(`Missing database ${db}. Nothing was copied.`);
  const migrations = Object.fromEntries(DATABASES.map((db) => [db, migrationNames(data, db)]));
  mkdirSync(outDir, { recursive: true });
  const files = [];
  for (const db of DATABASES) {
    for (const name of [db, ...SIDECARS.map((s) => `${db}${s}`)]) {
      const src = join(data, name);
      if (!existsSync(src)) continue;
      mkdirSync(dirname(join(outDir, name)), { recursive: true });
      copyFileSync(src, join(outDir, name));
      files.push({ name, size: statSync(src).size, sha256: sha256(src) });
    }
  }
  const manifest = { formatVersion: 1, backupId: randomUUID(), createdAt: new Date().toISOString(), composeProject: project, sourceRevision: revision, files, migrations };
  writeFileSync(join(outDir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  // Verify the copies against the manifest before success.
  validate(outDir, project);
  return manifest;
}

/** Validate the whole backup (form, id, project, every listed file with size and SHA-256). Throws Refused. */
export function validate(fromDir, project) {
  let m;
  try {
    m = JSON.parse(readFileSync(join(fromDir, MANIFEST), 'utf8'));
  } catch {
    throw new Refused('The manifest is missing or is not JSON.');
  }
  if (!m || m.formatVersion !== 1 || typeof m.createdAt !== 'string' || typeof m.sourceRevision !== 'string' || !Array.isArray(m.files)
    || typeof m.migrations !== 'object' || m.migrations === null) throw new Refused('The manifest has another form.');
  if (typeof m.backupId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(m.backupId)) throw new Refused('The backup id is not valid.');
  if (m.composeProject !== project) throw new Refused(`The backup is of compose project ${String(m.composeProject)}, not ${project}.`);
  const names = new Set();
  for (const f of m.files) {
    if (!f || typeof f.name !== 'string' || !ALLOWED.has(f.name) || names.has(f.name) || !Number.isInteger(f.size) || typeof f.sha256 !== 'string') {
      throw new Refused('The manifest lists a file that is not allowed, twice, or without size and SHA-256.');
    }
    names.add(f.name);
    const file = join(fromDir, f.name);
    if (!existsSync(file)) throw new Refused(`Missing backup file ${f.name}.`);
    if (statSync(file).size !== f.size || sha256(file) !== f.sha256) throw new Refused(`The backup file ${f.name} does not match the manifest.`);
  }
  for (const db of DATABASES) if (!names.has(db)) throw new Refused(`The backup does not list ${db}.`);
  return m;
}

export function restore({ from, data, project }) {
  const fromDir = resolve(from);
  const m = validate(fromDir, project); // nothing changes before this passes
  const listed = new Set(m.files.map((f) => f.name));
  for (const f of m.files) {
    const target = join(data, f.name);
    mkdirSync(dirname(target), { recursive: true });
    const tmp = `${target}.restore-tmp`;
    copyFileSync(join(fromDir, f.name), tmp);
    renameSync(tmp, target);
  }
  // A target -wal or -shm that the backup does not list is deleted (it belongs to the later state).
  for (const db of DATABASES) {
    for (const s of SIDECARS) {
      const name = `${db}${s}`;
      if (!listed.has(name) && existsSync(join(data, name))) rmSync(join(data, name));
    }
  }
  return m;
}

// Real paths on both sides: Node runs the main module from its real path, so a checkout under a symlink (macOS /tmp,
// /var) must not look like an import (that would exit 0 without a backup).
const isMain = process.argv[1] !== undefined && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  const [command, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({ args: rest, options: { out: { type: 'string' }, from: { type: 'string' }, data: { type: 'string' }, project: { type: 'string' }, revision: { type: 'string' }, repo: { type: 'string' } } });
  try {
    if (command === 'backup' && values.out && values.data && values.project) {
      const m = backup({ out: values.out, data: values.data, project: values.project, revision: values.revision ?? 'unknown', repo: values.repo });
      console.log(`Backup ${m.backupId} written to ${resolve(values.out)}: ${m.files.map((f) => f.name).join(', ')}. Keep it outside the checkout; it contains secrets.`);
    } else if (command === 'restore' && values.from && values.data && values.project) {
      const m = restore({ from: values.from, data: values.data, project: values.project });
      console.log(`Restored backup ${m.backupId}. Writes after ${m.createdAt} are lost.`);
    } else {
      console.error('Usage: stack:data-backup -- --out <folder> | stack:data-restore -- --from <folder>');
      process.exit(2);
    }
  } catch (err) {
    console.error(err instanceof Refused ? err.message : `Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
