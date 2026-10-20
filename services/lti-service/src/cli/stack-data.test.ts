// The maintenance commands of ADR-011 §14 (infra/scripts/stack-data.mjs), run as a child process on temp folders.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../infra/scripts/stack-data.mjs');
const temps: string[] = [];
afterEach(() => { for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true }); });
const temp = () => { const d = mkdtempSync(join(tmpdir(), 'stack-data-')); temps.push(d); return d; };
const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');

function makeData(): string {
  const data = temp();
  for (const [dir, file, names] of [['lti-service', 'lti.db', ['001_init.sql', '004_provider_profiles.sql']], ['cogniate-app', 'cogniate.db', ['001_init.sql']]] as const) {
    mkdirSync(join(data, dir));
    const db = new DatabaseSync(join(data, dir, file));
    db.exec('CREATE TABLE schema_migration (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at INTEGER NOT NULL)');
    for (const n of names) db.prepare('INSERT INTO schema_migration VALUES (?, ?, 0)').run(n, 'x');
    db.close();
  }
  writeFileSync(join(data, 'lti-service', 'lti.db-wal'), 'wal-bytes');
  return data;
}

const run = (args: string[]): { code: number; out: string } => {
  try {
    return { code: 0, out: execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (err) {
    const e = err as { status: number; stderr: string };
    return { code: e.status, out: e.stderr };
  }
};

describe('stack:data-backup and stack:data-restore (ADR-011 §14)', () => {
  it('backup: both databases and present sidecars, migration names, verified manifest; outside the checkout only', () => {
    const data = makeData();
    const out = join(temp(), 'b');
    expect(run(['backup', '--out', out, '--data', data, '--project', 'qa-p', '--revision', 'abc', '--repo', '/nonexistent-repo']).code).toBe(0);
    const m = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    expect(m).toMatchObject({ formatVersion: 1, composeProject: 'qa-p', sourceRevision: 'abc', migrations: { 'lti-service/lti.db': ['001_init.sql', '004_provider_profiles.sql'], 'cogniate-app/cogniate.db': ['001_init.sql'] } });
    expect(m.files.map((f: { name: string }) => f.name)).toEqual(['lti-service/lti.db', 'lti-service/lti.db-wal', 'cogniate-app/cogniate.db']);
    expect(m.files[0].sha256).toBe(sha(join(data, 'lti-service/lti.db')));
    expect(run(['backup', '--out', join(data, 'inside'), '--data', data, '--project', 'qa-p', '--repo', data]).code).toBe(1);
    expect(run(['backup', '--out', out, '--data', data, '--project', 'qa-p']).code).toBe(1); // not empty
  });

  it('restore validates everything before a change, replaces the files and deletes an unlisted target sidecar', () => {
    const data = makeData();
    const out = join(temp(), 'b');
    run(['backup', '--out', out, '--data', data, '--project', 'qa-p']);
    const original = sha(join(data, 'cogniate-app/cogniate.db'));
    // A write after the backup, and a target sidecar that the backup does not list.
    const db = new DatabaseSync(join(data, 'cogniate-app/cogniate.db'));
    db.exec('CREATE TABLE later (x)');
    db.close();
    writeFileSync(join(data, 'cogniate-app/cogniate.db-shm'), 'later-shm');
    const changed = sha(join(data, 'cogniate-app/cogniate.db'));
    // Damaged copies: changed bytes, a missing file, another id, another project: exit 1, no target change.
    const damage = (fn: (dir: string) => void) => {
      const copy = join(temp(), 'copy');
      execFileSync('cp', ['-R', out, copy]);
      fn(copy);
      return copy;
    };
    const cases = [
      damage((d) => writeFileSync(join(d, 'lti-service/lti.db-wal'), 'other')),
      damage((d) => rmSync(join(d, 'cogniate-app/cogniate.db'))),
      damage((d) => { const p = join(d, 'manifest.json'); const m = JSON.parse(readFileSync(p, 'utf8')); m.backupId = 'nope'; writeFileSync(p, JSON.stringify(m)); }),
    ];
    for (const c of cases) expect(run(['restore', '--from', c, '--data', data, '--project', 'qa-p']).code).toBe(1);
    expect(run(['restore', '--from', out, '--data', data, '--project', 'other-project']).code).toBe(1);
    expect(sha(join(data, 'cogniate-app/cogniate.db'))).toBe(changed);
    expect(existsSync(join(data, 'cogniate-app/cogniate.db-shm'))).toBe(true);
    expect(run(['restore', '--from', out, '--data', data, '--project', 'qa-p']).code).toBe(0);
    expect(sha(join(data, 'cogniate-app/cogniate.db'))).toBe(original);
    expect(existsSync(join(data, 'cogniate-app/cogniate.db-shm'))).toBe(false);
    expect(readFileSync(join(data, 'lti-service/lti.db-wal'), 'utf8')).toBe('wal-bytes');
  });
});
