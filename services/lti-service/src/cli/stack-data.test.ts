// The maintenance program of ADR-011 §14 and ADR-012 §8–§10 (infra/scripts/stack-data.mjs), run as a child process
// and through its library API on temp folders, and the shell entry infra/scripts/stack-data.sh (B-M1-02: only a
// positively observed stop permits maintenance). Host-only unit evidence: a fake `docker` stands in for the Docker CLI,
// and its `compose run … maintenance <args>` runs the real program on a temp volume-layout root (the /check of the
// maintenance container). Real Docker acceptance is separate (AC-M1-41).
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPTS = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../infra/scripts');
const SCRIPT = join(SCRIPTS, 'stack-data.mjs');
const PROBE = join(SCRIPTS, 'sqlite-lock-probe.mjs');
const temps: string[] = [];
afterEach(() => { for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true }); });
const temp = () => { const d = mkdtempSync(join(tmpdir(), 'stack-data-')); temps.push(d); return d; };
const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');

function makeData(data = temp()): string {
  for (const [dir, file, names] of [['lti-service', 'lti.db', ['001_init.sql', '004_provider_profiles.sql']], ['cogniate-app', 'cogniate.db', ['001_init.sql']]] as const) {
    mkdirSync(join(data, dir), { recursive: true });
    const db = new DatabaseSync(join(data, dir, file));
    db.exec('CREATE TABLE schema_migration (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at INTEGER NOT NULL)');
    for (const n of names) db.prepare('INSERT INTO schema_migration VALUES (?, ?, 0)').run(n, 'x');
    db.close();
  }
  writeFileSync(join(data, 'lti-service', 'lti.db-wal'), 'wal-bytes');
  return data;
}

// ------------------------------------------------------------------------------------------------ volume fixtures

const IDENTITY = '.storage-identity.json';
const JOURNAL = '.storage-journal.json';
type Role = 'lti' | 'app';
const ROLES: Role[] = ['lti', 'app'];
const FOLDER: Record<Role, string> = { lti: 'lti-service', app: 'cogniate-app' };
const DB: Record<Role, string> = { lti: 'lti.db', app: 'cogniate.db' };
type Line = Record<string, unknown>;

const identity = (project: string, role: Role, pairId: string, over: Record<string, unknown> = {}) => ({
  formatVersion: 1, composeProject: project, pairId, role, generation: 0, createdAt: new Date().toISOString(), firstStart: 'completed',
  provenance: { kind: 'fresh', opId: null, backupId: null, manifestSha256: null, restoredFromPairId: null, restoredFromGeneration: null },
  legacySources: [], ...over,
});

/**
 * A volume-layout root, the stand-in for /check of the maintenance container: the databases of makeData, the §4
 * preparation (mode 0700, the empty appdb mountpoints) and a valid identity pair, so the §6 state is OK.
 */
function makeVolumes(project = 'qa-p', root = temp()): string {
  makeData(root);
  const pairId = randomBytes(16).toString('hex');
  for (const role of ROLES) {
    chmodSync(join(root, FOLDER[role]), 0o700);
    writeFileSync(join(root, FOLDER[role], IDENTITY), JSON.stringify(identity(project, role, pairId)));
  }
  for (const m of ['packages', 'uploads']) mkdirSync(join(root, 'cogniate-app', m), { mode: 0o700 });
  return root;
}
/** Two empty volume roots: the §6 state FRESH (a new lane, or a lane after quarantine). */
function makeFresh(): string {
  const root = temp();
  for (const role of ROLES) mkdirSync(join(root, FOLDER[role]), { mode: 0o700 });
  return root;
}

const vol = (root: string, role: Role) => join(root, FOLDER[role]);
const readJson = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const journalOf = (root: string, role: Role) => (existsSync(join(vol(root, role), JOURNAL)) ? readJson(join(vol(root, role), JOURNAL)) : null);
const journalStates = (root: string) => ROLES.map((r) => journalOf(root, r)?.state ?? null);
const idOf = (root: string, role: Role) => readJson(join(vol(root, role), IDENTITY));
/** The database file set of a volume: [name, SHA-256] of each present <db>, <db>-wal, <db>-shm. */
const fileSet = (root: string, role: Role) => [DB[role], `${DB[role]}-wal`, `${DB[role]}-shm`]
  .filter((n) => existsSync(join(vol(root, role), n))).map((n) => [n, sha(join(vol(root, role), n))]);
const fileSets = (root: string) => ({ lti: fileSet(root, 'lti'), app: fileSet(root, 'app') });
/** The file set of one volume in a backup, from its manifest. */
const manifestSet = (backup: string, role: Role) => (readJson(join(backup, 'manifest.json')).files as Array<{ name: string; sha256: string }>)
  .filter((f) => f.name.startsWith(`${FOLDER[role]}/`)).map((f) => [f.name.slice(FOLDER[role].length + 1), f.sha256]);
/** Every entry under a folder (directories; files with SHA-256), for "nothing written" and "nothing deleted". */
function tree(dir: string, rel = ''): string[] {
  return readdirSync(join(dir, rel)).sort().flatMap((n) => {
    const r = rel ? `${rel}/${n}` : n;
    const st = lstatSync(join(dir, r));
    return st.isDirectory() ? [`${r}/`, ...tree(dir, r)] : [`${r} ${st.isFile() ? sha(join(dir, r)) : 'other'}`];
  });
}
const withoutJournals = (entries: string[]) => entries.filter((e) => !e.includes(`${JOURNAL} `));

// The CLI. The log folder is never created, so the program logs to stdout only; drill variables come only from a test.
const NO_LOG_DIR = join(tmpdir(), `stack-data-test-no-logs-${process.pid}`);
const CLI_ENV: Record<string, string> = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k, v]) => !k.startsWith('STORAGE_') && v !== undefined)) as Record<string, string>,
  STORAGE_LOG_DIR: NO_LOG_DIR,
};
const parseLines = (text: string): Line[] => text.split('\n').flatMap((l) => { try { const v = JSON.parse(l); return v && typeof v === 'object' ? [v as Line] : []; } catch { return []; } });

const run = (args: string[]): { code: number; out: string } => {
  try {
    return { code: 0, out: execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: CLI_ENV }) };
  } catch (err) {
    const e = err as { status: number; stderr: string };
    return { code: e.status, out: e.stderr };
  }
};
const cli = (args: string[], env: Record<string, string> = {}) => {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...CLI_ENV, ...env } });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, lines: parseLines(r.stdout) };
};
/** The §6 state of a volume root, as the preflight `report` reads it (the real probe program). */
const report = (root: string, project = 'qa-p') => {
  const r = spawnSync(process.execPath, [PROBE, 'report', '--run-id', '0123456789abcdef', '--project', project, '--folder', `lti=${vol(root, 'lti')}`, '--folder', `app=${vol(root, 'app')}`], { encoding: 'utf8', env: CLI_ENV });
  return parseLines(r.stdout);
};
const stateOf = (root: string, project = 'qa-p') => report(root, project).find((l) => l.event === 'storage_preflight' && l.folder === 'lti')?.state;

describe('stack:data-backup and stack:data-restore (ADR-011 §14)', () => {
  it('backup: both databases and present sidecars, migration names, verified manifest; outside the checkout only', () => {
    const data = makeData();
    const out = join(temp(), 'b');
    expect(run(['backup', '--source', 'legacy', '--out', out, '--data', data, '--project', 'qa-p', '--revision', 'abc', '--repo', '/nonexistent-repo']).code).toBe(0);
    const m = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    expect(m).toMatchObject({ formatVersion: 1, composeProject: 'qa-p', sourceRevision: 'abc', migrations: { 'lti-service/lti.db': ['001_init.sql', '004_provider_profiles.sql'], 'cogniate-app/cogniate.db': ['001_init.sql'] } });
    expect(m.files.map((f: { name: string }) => f.name)).toEqual(['lti-service/lti.db', 'lti-service/lti.db-wal', 'cogniate-app/cogniate.db']);
    expect(m.files[0].sha256).toBe(sha(join(data, 'lti-service/lti.db')));
    expect(run(['backup', '--source', 'legacy', '--out', join(data, 'inside'), '--data', data, '--project', 'qa-p', '--repo', data]).code).toBe(1);
    expect(run(['backup', '--source', 'legacy', '--out', out, '--data', data, '--project', 'qa-p']).code).toBe(1); // not empty
  });

  it('restore validates everything before a change, replaces the files and moves an unlisted target sidecar out of its place', () => {
    // A volume pair in state OK and a volume backup of it (ADR-012 §8): the old copy-over restore into bind folders is gone.
    const data = makeVolumes();
    const out = join(temp(), 'b');
    run(['backup', '--source', 'volume', '--out', out, '--data', data, '--project', 'qa-p']);
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

// ------------------------------------------------------------------------------------------------ ADR-012 §8 controls

/** A pair in state OK, its volume backup, then a write in both databases after the backup and an unlisted app -shm. */
function restoreSetup(project = 'qa-p') {
  const data = makeVolumes(project);
  const backup = join(temp(), 'b');
  expect(cli(['backup', '--source', 'volume', '--out', backup, '--data', data, '--project', project]).code).toBe(0);
  for (const role of ROLES) {
    const db = new DatabaseSync(join(vol(data, role), DB[role]));
    db.exec('CREATE TABLE later (x)');
    db.close();
  }
  writeFileSync(join(data, 'cogniate-app/cogniate.db-shm'), 'later-shm');
  return { data, backup, before: fileSets(data), ids: ROLES.map((r) => idOf(data, r)) };
}

describe('the journaled paired restore replaces the bind restore (ADR-012 §8, Option C controls)', { timeout: 60_000 }, () => {
  it('positive: a same-pair restore commits: file sets equal the backup, generation + 1, provenance restore, the -shm in .previous-<opId>/', () => {
    const { data, backup, ids } = restoreSetup();
    const m = readJson(join(backup, 'manifest.json'));
    const r = cli(['restore', '--from', backup, '--data', data, '--project', 'qa-p']);
    expect([r.code, r.stderr.trim()]).toEqual([0, 'restore: committed']);
    const [lj, aj] = [journalOf(data, 'lti'), journalOf(data, 'app')];
    expect([lj.state, aj.state, aj.opId]).toEqual(['committed', 'committed', lj.opId]);
    for (const role of ROLES) {
      expect(fileSet(data, role)).toEqual(manifestSet(backup, role));
      expect(idOf(data, role)).toMatchObject({ role, pairId: ids[0].pairId, generation: 1, firstStart: 'completed', legacySources: [],
        provenance: { kind: 'restore', opId: lj.opId, backupId: m.backupId, manifestSha256: sha(join(backup, 'manifest.json')), restoredFromPairId: m.pairId, restoredFromGeneration: 0 } });
      expect(existsSync(join(vol(data, role), `.restore-${lj.opId}`))).toBe(false);
    }
    expect(readFileSync(join(vol(data, 'app'), `.previous-${lj.opId}`, 'cogniate.db-shm'), 'utf8')).toBe('later-shm');
    expect(stateOf(data)).toBe('OK');
  });

  it('negative: a restore into a bind-like folder without identities refuses restore_target_state (db_without_identity); nothing is written', () => {
    const bindLike = makeData(); // the old infra/.data layout: databases, no identity
    const backup = join(temp(), 'b');
    expect(cli(['backup', '--source', 'volume', '--out', backup, '--data', makeVolumes(), '--project', 'qa-p']).code).toBe(0);
    const files = fileSets(bindLike);
    const r = cli(['restore', '--from', backup, '--data', bindLike, '--project', 'qa-p']);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/restore_target_state: the target state is db_without_identity/);
    expect(fileSets(bindLike)).toEqual(files);
    // Only the §4 volume-side step may run (the empty appdb mountpoints); no journal, identity or staged folder.
    const entries = tree(bindLike);
    expect(entries.filter((e) => !/^cogniate-app\/(packages|uploads)\/$/.test(e) && !/^(lti-service|cogniate-app)\/$/.test(e)).map((e) => e.split(' ')[0]).sort())
      .toEqual(['cogniate-app/cogniate.db', 'lti-service/lti.db', 'lti-service/lti.db-wal']);
  });

  it('damaged backups (bytes, missing file, id, project, INCOMPLETE, a volume manifest without pairId, no manifest) write no journal', () => {
    const { data, backup } = restoreSetup();
    const snapshot = tree(data);
    const damage = (fn: (dir: string) => void) => {
      const copy = join(temp(), 'copy');
      execFileSync('cp', ['-R', backup, copy]);
      fn(copy);
      return copy;
    };
    const edit = (d: string, f: (m: Record<string, unknown>) => void) => { const p = join(d, 'manifest.json'); const m = readJson(p); f(m); writeFileSync(p, JSON.stringify(m)); };
    const cases: Array<[string, RegExp]> = [
      [damage((d) => writeFileSync(join(d, 'lti-service/lti.db-wal'), 'other')), /does not match the manifest/],
      [damage((d) => rmSync(join(d, 'cogniate-app/cogniate.db'))), /Missing backup file/],
      [damage((d) => edit(d, (m) => { m.backupId = 'nope'; })), /backup id is not valid/],
      [damage((d) => writeFileSync(join(d, 'INCOMPLETE'), '')), /INCOMPLETE/],
      [damage((d) => edit(d, (m) => { delete m.pairId; })), /without pairId/],
      [damage((d) => rmSync(join(d, 'manifest.json'))), /manifest is missing/],
    ];
    for (const [from, message] of cases) {
      const r = cli(['restore', '--from', from, '--data', data, '--project', 'qa-p']);
      expect([r.code, message.test(r.stderr), /No target changed|Nothing was/.test(r.stderr)]).toEqual([1, true, true]);
      expect(tree(data)).toEqual(snapshot);
    }
    const other = cli(['restore', '--from', backup, '--data', data, '--project', 'other-project']);
    expect([other.code, /compose project qa-p, not other-project/.test(other.stderr)]).toEqual([1, true]);
    expect(journalStates(data)).toEqual([null, null]);
    expect(tree(data)).toEqual(snapshot);
  });

  it('pair rule: a backup of another pair into an OK target refuses pair_mismatch; nothing is written', () => {
    const { backup } = restoreSetup();
    const target = makeVolumes(); // another pairId
    const snapshot = tree(target);
    const r = cli(['restore', '--from', backup, '--data', target, '--project', 'qa-p']);
    expect([r.code, /pair_mismatch/.test(r.stderr)]).toEqual([1, true]);
    expect(tree(target)).toEqual(snapshot);
  });

  it('restore into FRESH takes the backup pairId and generation + 1; import of a legacy backup into FRESH makes a new pair (generation 1, kind import)', () => {
    const { backup, ids } = restoreSetup();
    const fresh = makeFresh();
    expect(stateOf(fresh)).toBe('FRESH');
    expect(cli(['restore', '--from', backup, '--data', fresh, '--project', 'qa-p']).code).toBe(0);
    expect(idOf(fresh, 'app')).toMatchObject({ pairId: ids[0].pairId, generation: 1, provenance: { kind: 'restore' } });
    expect(fileSet(fresh, 'lti')).toEqual(manifestSet(backup, 'lti'));
    expect(stateOf(fresh)).toBe('OK');

    const legacy = makeData();
    const lb = join(temp(), 'legacy');
    expect(cli(['backup', '--source', 'legacy', '--out', lb, '--data', legacy, '--project', 'qa-p']).code).toBe(0);
    const legacyFiles = readJson(join(lb, 'manifest.json')).files;
    const target = makeFresh();
    const r = cli(['import', '--from', lb, '--data', target, '--project', 'qa-p']);
    expect([r.code, r.stderr.trim()]).toEqual([0, 'import: committed']);
    const lti = idOf(target, 'lti');
    expect(lti).toMatchObject({ generation: 1, firstStart: 'completed', provenance: { kind: 'import', restoredFromPairId: null }, legacySources: legacyFiles });
    expect(idOf(target, 'app').pairId).toBe(lti.pairId);
    expect(lti.pairId).not.toBe(ids[0].pairId);
    expect(fileSet(target, 'lti')).toEqual(manifestSet(lb, 'lti'));
    expect(stateOf(target)).toBe('OK');
  });

  it('target states: import only into FRESH, a volume backup is not imported, a legacy backup is not restored, FIRST_START names stack:up', () => {
    const { data, backup } = restoreSetup();
    const lb = join(temp(), 'legacy');
    expect(cli(['backup', '--source', 'legacy', '--out', lb, '--data', makeData(), '--project', 'qa-p']).code).toBe(0);
    const snapshot = tree(data);
    const refusals: Array<[string[], RegExp]> = [
      [['import', '--from', lb, '--data', data], /import_target_not_fresh: the target state is OK/],
      [['import', '--from', backup, '--data', makeFresh()], /restored with `npm run stack:data-restore`, not imported/],
      [['restore', '--from', lb, '--data', makeFresh()], /goes into a FRESH pair with `npm run stack:data-import`/],
      [['restore', '--from', lb, '--data', data], /import_target_not_fresh: a legacy backup needs a FRESH target/],
    ];
    for (const [args, message] of refusals) {
      const r = cli([...args, '--project', 'qa-p']);
      expect([r.code, message.test(r.stderr)]).toEqual([1, true]);
    }
    expect(tree(data)).toEqual(snapshot);
    const first = makeFresh();
    const pairId = randomBytes(16).toString('hex');
    for (const role of ROLES) writeFileSync(join(vol(first, role), IDENTITY), JSON.stringify(identity('qa-p', role, pairId, { firstStart: 'pending' })));
    expect(stateOf(first)).toBe('FIRST_START');
    const r = cli(['restore', '--from', backup, '--data', first, '--project', 'qa-p']);
    expect([r.code, /restore_target_state: the target state is FIRST_START; next: npm run stack:up/.test(r.stderr)]).toEqual([1, true]);
  });

  it('precedence (§8): backup validation, then the target state, then the source kind, then the pair rule; for either source kind', () => {
    const { data: ok, backup: vb } = restoreSetup();
    const lb = join(temp(), 'legacy');
    expect(cli(['backup', '--source', 'legacy', '--out', lb, '--data', makeData(), '--project', 'qa-p']).code).toBe(0);
    const other = join(temp(), 'other');
    expect(cli(['backup', '--source', 'volume', '--out', other, '--data', makeVolumes(), '--project', 'qa-p']).code).toBe(0);
    const broken = (from: string) => { const c = join(temp(), 'broken'); execFileSync('cp', ['-R', from, c]); writeFileSync(join(c, 'cogniate-app/cogniate.db'), 'other'); return c; };
    const first = makeFresh();
    const pairId = randomBytes(16).toString('hex');
    for (const role of ROLES) writeFileSync(join(vol(first, role), IDENTITY), JSON.stringify(identity('qa-p', role, pairId, { firstStart: 'pending' })));
    for (const m of ['packages', 'uploads']) mkdirSync(join(first, 'cogniate-app', m), { mode: 0o700 }); // §4 done: the snapshot covers every write
    const open = restoreSetup();
    expect(cli(['restore', '--from', open.backup, '--data', open.data, '--project', 'qa-p', '--stop-after', 'prepared'], { STORAGE_DRILL: '1' }).code).toBe(3);
    const bind = makeData(); // db_without_identity, already prepared (§4), so the snapshot covers every write
    for (const role of ROLES) chmodSync(vol(bind, role), 0o700);
    for (const m of ['packages', 'uploads']) mkdirSync(join(bind, 'cogniate-app', m), { mode: 0o700 });
    const cases: Array<[string, string, string, RegExp]> = [
      ['restore', broken(lb), first, /does not match the manifest/],
      ['import', broken(vb), ok, /does not match the manifest/],
      ['restore', lb, first, /^restore_target_state: the target state is FIRST_START; next: npm run stack:up/],
      ['restore', vb, first, /^restore_target_state: the target state is FIRST_START/],
      ['import', vb, first, /^import_target_not_fresh: the target state is FIRST_START/],
      ['import', lb, first, /^import_target_not_fresh: the target state is FIRST_START/],
      ['restore', lb, open.data, /^restore_target_state: the target state is journal_open; next: npm run stack:data-restore -- --recover/],
      ['import', vb, open.data, /^import_target_not_fresh: the target state is journal_open\. Import only into a FRESH pair; next: npm run stack:data-restore -- --recover/],
      ['restore', lb, bind, /^restore_target_state: the target state is db_without_identity; next: quarantine/],
      ['import', vb, bind, /^import_target_not_fresh: the target state is db_without_identity/],
      ['import', vb, ok, /^import_target_not_fresh: the target state is OK/],
      ['restore', lb, ok, /^import_target_not_fresh: a legacy backup needs a FRESH target/],
      ['restore', other, ok, /^pair_mismatch/],
    ];
    for (const [op, from, target, message] of cases) {
      const before = tree(target);
      const r = cli([op, '--from', from, '--data', target, '--project', 'qa-p']);
      expect([op, r.code, r.stderr]).toEqual([op, 1, expect.stringMatching(message)]);
      if (!/needs_|pair_mismatch|a legacy backup needs/.test(message.source)) expect(r.stderr).not.toMatch(/import_needs_legacy_backup|restore_needs_volume_backup|pair_mismatch/);
      expect(tree(target)).toEqual(before);
    }
  });

  it('content check: a package.storage_path without its folder cancels (content_missing, verified); with the folder the restore commits', () => {
    const data = makeVolumes();
    const db = new DatabaseSync(join(data, 'cogniate-app/cogniate.db'));
    db.exec("CREATE TABLE package (id TEXT PRIMARY KEY, storage_path TEXT NOT NULL); INSERT INTO package VALUES ('p1', 'packages/p1')");
    db.close();
    const backup = join(temp(), 'b');
    expect(cli(['backup', '--source', 'volume', '--out', backup, '--data', data, '--project', 'qa-p']).code).toBe(0);
    const content = temp();
    const before = fileSets(data);
    const missing = cli(['restore', '--from', backup, '--data', data, '--project', 'qa-p', '--content', content]);
    expect(missing.code).toBe(1);
    expect(missing.lines.find((l) => l.event === 'storage_content_check')).toMatchObject({ result: 'content_missing', checked: 1, missing: ['packages/p1'] });
    expect(journalStates(data)).toEqual(['rolled_back', 'rolled_back']);
    expect(fileSets(data)).toEqual(before);
    mkdirSync(join(content, 'p1'));
    const ok = cli(['restore', '--from', backup, '--data', data, '--project', 'qa-p', '--content', content]);
    expect(ok.code).toBe(0);
    expect(ok.lines.find((l) => l.event === 'storage_content_check')).toMatchObject({ result: 'pass', checked: 1, missing: [] });
  });
});

// ------------------------------------------------------------------------------------------------ drills and recovery

// Each point → the recovery row of the observed journals → the exit of `recover` and the result in place.
const DRILLS: Array<[string, string, number, 'before' | 'backup', [string | null, string | null]]> = [
  ['prepared-lti', 'R1', 1, 'before', ['rolled_back', null]],
  ['prepared', 'R2', 1, 'before', ['rolled_back', 'rolled_back']],
  ['staged', 'R2', 1, 'before', ['rolled_back', 'rolled_back']],
  ['swap-lti-mid', 'R3', 1, 'before', ['rolled_back', 'rolled_back']],
  ['swapped-lti', 'R3', 1, 'before', ['rolled_back', 'rolled_back']],
  ['swap-app-mid', 'R3', 1, 'before', ['rolled_back', 'rolled_back']],
  ['swapped', 'R3', 1, 'before', ['rolled_back', 'rolled_back']],
  ['identity-lti', 'R3', 1, 'before', ['rolled_back', 'rolled_back']],
  ['identity-app', 'R3', 1, 'before', ['rolled_back', 'rolled_back']],
  ['committed-lti', 'R4', 0, 'backup', ['committed', 'committed']],
];

describe('recovery drills (ADR-012 §8: --stop-after with STORAGE_DRILL=1, then recover)', { timeout: 60_000 }, () => {
  it.each(DRILLS)('--stop-after %s (%s): recover exits %i and the targets equal the %s state; the lane is OK again', (point, _row, code, result, states) => {
    const { data, backup, before, ids } = restoreSetup();
    const stop = cli(['restore', '--from', backup, '--data', data, '--project', 'qa-p', '--stop-after', point], { STORAGE_DRILL: '1' });
    expect(stop.code).toBe(3);
    expect(stop.lines.find((l) => l.event === 'storage_drill_stop')).toMatchObject({ point });
    expect(stateOf(data)).toBe('journal_open');
    const rec = cli(['recover', '--data', data, '--project', 'qa-p']);
    expect(rec.code).toBe(code);
    expect(journalStates(data)).toEqual(states);
    if (result === 'before') {
      expect(fileSets(data)).toEqual(before);
      expect(ROLES.map((r) => idOf(data, r))).toEqual(ids);
    } else {
      for (const role of ROLES) expect(fileSet(data, role)).toEqual(manifestSet(backup, role));
      expect(ROLES.map((r) => idOf(data, r).generation)).toEqual([1, 1]);
    }
    expect(cli(['recover', '--data', data, '--project', 'qa-p']).code).toBe(0); // terminal journals: nothing to recover
    expect(stateOf(data)).toBe('OK');
  });

  it('rollback-mid (forced failure after swapped): exit 3 with lti rolling_back; recover rolls back both (exit 1)', () => {
    const { data, backup, before } = restoreSetup();
    const env = { STORAGE_DRILL: '1', STORAGE_DRILL_FAIL: 'after-swapped' };
    expect(cli(['restore', '--from', backup, '--data', data, '--project', 'qa-p', '--stop-after', 'rollback-mid'], env).code).toBe(3);
    expect(journalStates(data)).toEqual(['rolling_back', 'swapped']);
    const rec = cli(['recover', '--data', data, '--project', 'qa-p']);
    expect([rec.code, /rolled back; the targets equal the state before \(verified\)/.test(rec.stderr)]).toEqual([1, true]);
    expect(fileSets(data)).toEqual(before);
  });

  it('a forced failure after swapped runs R3 at once inside the live restore (exit 1, verified)', () => {
    const { data, backup, before } = restoreSetup();
    const r = cli(['restore', '--from', backup, '--data', data, '--project', 'qa-p'], { STORAGE_DRILL: '1', STORAGE_DRILL_FAIL: 'after-swapped' });
    expect([r.code, r.lines.some((l) => l.event === 'storage_restore_rollback')]).toEqual([1, true]);
    expect(journalStates(data)).toEqual(['rolled_back', 'rolled_back']);
    expect(fileSets(data)).toEqual(before);
  });

  it('--pause-after waits, logs pause and resume, then completes', () => {
    const { data, backup } = restoreSetup();
    const r = cli(['restore', '--from', backup, '--data', data, '--project', 'qa-p', '--pause-after', 'staged'], { STORAGE_DRILL: '1', STORAGE_DRILL_PAUSE_SECONDS: '1' });
    expect(r.code).toBe(0);
    expect(r.lines.filter((l) => String(l.event).startsWith('storage_drill_')).map((l) => [l.event, l.point])).toEqual([['storage_drill_pause', 'staged'], ['storage_drill_resume', 'staged']]);
  });

  it('drill options are refused without STORAGE_DRILL=1, for an unknown point, for rollback-mid without the forced failure and without pause seconds', () => {
    const { data, backup } = restoreSetup();
    const snapshot = tree(data);
    const base = ['restore', '--from', backup, '--data', data, '--project', 'qa-p'];
    expect(cli([...base, '--stop-after', 'swapped']).code).toBe(1);
    expect(cli([...base, '--stop-after', 'nowhere'], { STORAGE_DRILL: '1' }).code).toBe(2);
    expect(cli([...base, '--stop-after', 'rollback-mid'], { STORAGE_DRILL: '1' }).code).toBe(1);
    expect(cli([...base, '--pause-after', 'staged'], { STORAGE_DRILL: '1' }).code).toBe(1);
    expect(cli([...base, '--stop-after', 'staged', '--pause-after', 'staged'], { STORAGE_DRILL: '1' }).code).toBe(2);
    expect(cli(['recover', '--data', data, '--project', 'qa-p', '--stop-after', 'staged'], { STORAGE_DRILL: '1' }).code).toBe(2);
    expect(tree(data)).toEqual(snapshot);
  });

  it('R5 and R6 change nothing and exit 2 (never "no target changed")', () => {
    const { data, backup } = restoreSetup();
    expect(cli(['restore', '--from', backup, '--data', data, '--project', 'qa-p', '--stop-after', 'swapped'], { STORAGE_DRILL: '1' }).code).toBe(3);
    const j = journalOf(data, 'app');
    writeFileSync(join(vol(data, 'app'), JOURNAL), JSON.stringify({ ...j, state: 'rollback_failed' }));
    const snapshot = tree(data);
    const r5 = cli(['recover', '--data', data, '--project', 'qa-p']);
    expect([r5.code, /no target changed/i.test(r5.stderr), tree(data)]).toEqual([2, false, snapshot]);
    writeFileSync(join(vol(data, 'app'), JOURNAL), '{"broken');
    const snapshot6 = tree(data);
    const r6 = cli(['recover', '--data', data, '--project', 'qa-p']);
    expect([r6.code, tree(data)]).toEqual([2, snapshot6]);
    expect(stateOf(data)).toBe('journal_inconsistent');
  });
});

// ------------------------------------------------------------------------------------------------ the library API (§8 L451)

interface Io { copyFile(src: string, dst: string): void; fsyncFile(p: string): void; fsyncDir(d: string): void; rename(src: string, dst: string): void }
interface Dirs { lti: string; app: string }
interface Ids { uid: number; gid: number }
interface Lib {
  REAL_IO: Io;
  volumeBackup(o: { dirs: Dirs; out: string; project: string; revision: string; ids: Ids; io?: Io }): unknown;
  volumeRestore(o: { dirs: Dirs; from: string; project: string; operation: 'restore' | 'import'; ids: Ids; log: (l: Line) => void; contentPackages: string;
    io?: Io; opId?: string; drill?: { point(p: string): void } }): number;
  createEngine(o: { dirs: Dirs; log: (l: Line) => void; io?: Io }): { recover(): { code: number; message: string } };
  quarantineCopy(o: { dirs: Dirs; out: string; project: string; io?: Io }): unknown;
}
const lib = async () => (await import(pathToFileURL(SCRIPT).href)) as Lib;
const IDS: Ids = { uid: process.getuid?.() ?? 0, gid: process.getgid?.() ?? 0 };
const OP = 'ab'.repeat(16);
const dirsOf = (root: string): Dirs => ({ lti: vol(root, 'lti'), app: vol(root, 'app') });
const stopAt = (point: string) => ({ point: (p: string) => { if (p === point) throw Object.assign(new Error('drill stop'), { drillStop: true }); } });
const eio = (what: string) => Object.assign(new Error(`EIO: i/o error, ${what}`), { code: 'EIO' });
const partialCopy = (src: string, dst: string) => { const b = readFileSync(src); writeFileSync(dst, b.subarray(0, Math.floor(b.length / 2))); };

describe('fault injection through the library API (ADR-012 §8)', { timeout: 60_000 }, () => {
  it('a partial copy while staging cancels: both journals rolled_back, in place = before, no staged folder', async () => {
    const { volumeRestore, REAL_IO } = await lib();
    const { data, backup, before, ids } = restoreSetup();
    const lines: Line[] = [];
    const code = volumeRestore({ dirs: dirsOf(data), from: backup, project: 'qa-p', operation: 'restore', ids: IDS, log: (l) => lines.push(l), contentPackages: NO_LOG_DIR,
      io: { ...REAL_IO, copyFile: partialCopy }, opId: OP });
    expect(code).toBe(1);
    expect(journalStates(data)).toEqual(['rolled_back', 'rolled_back']);
    expect(fileSets(data)).toEqual(before);
    expect(ROLES.map((r) => idOf(data, r))).toEqual(ids);
    for (const role of ROLES) expect(existsSync(join(vol(data, role), `.restore-${OP}`))).toBe(false);
    expect(lines.some((l) => l.event === 'storage_restore_cancelled')).toBe(true);
  });

  it('a partial copy of a volume backup is found before the manifest: no manifest, so it is not a backup', async () => {
    const { volumeBackup, REAL_IO } = await lib();
    const data = makeVolumes();
    const out = join(temp(), 'b');
    expect(() => volumeBackup({ dirs: dirsOf(data), out, project: 'qa-p', revision: 'x', ids: IDS, io: { ...REAL_IO, copyFile: partialCopy } })).toThrow(/does not match its source/);
    expect(existsSync(join(out, 'manifest.json'))).toBe(false);
    const snapshot = tree(data);
    expect(cli(['restore', '--from', out, '--data', data, '--project', 'qa-p']).code).toBe(1);
    expect(tree(data)).toEqual(snapshot);
  });

  it('an fsync failure while staging cancels (exit 1, verified)', async () => {
    const { volumeRestore, REAL_IO } = await lib();
    const { data, backup, before } = restoreSetup();
    const code = volumeRestore({ dirs: dirsOf(data), from: backup, project: 'qa-p', operation: 'restore', ids: IDS, log: () => {}, contentPackages: NO_LOG_DIR,
      io: { ...REAL_IO, fsyncFile: () => { throw eio('fsync'); } }, opId: OP });
    expect([code, journalStates(data), fileSets(data)]).toEqual([1, ['rolled_back', 'rolled_back'], before]);
  });

  it('an fsync failure after a swap rename starts R3 at once: the before files come back (exit 1, verified)', async () => {
    const { volumeRestore, REAL_IO } = await lib();
    const { data, backup, before } = restoreSetup();
    let failed = false;
    const lines: Line[] = [];
    const code = volumeRestore({ dirs: dirsOf(data), from: backup, project: 'qa-p', operation: 'restore', ids: IDS, log: (l) => lines.push(l), contentPackages: NO_LOG_DIR, opId: OP,
      io: { ...REAL_IO, fsyncDir: (d) => { if (!failed && d.endsWith(`.previous-${OP}`)) { failed = true; throw eio('fsync'); } REAL_IO.fsyncDir(d); } } });
    expect([failed, code]).toEqual([true, 1]);
    expect(lines.some((l) => l.event === 'storage_restore_rollback')).toBe(true);
    expect(journalStates(data)).toEqual(['rolled_back', 'rolled_back']);
    expect(fileSets(data)).toEqual(before);
  });

  it('a collision in the swap moves nothing: the existing target stays byte-identical, and R3 verifies before (exit 1)', async () => {
    const { volumeRestore } = await lib();
    const { data, backup, before } = restoreSetup();
    const planted = join(vol(data, 'lti'), `.previous-${OP}`, 'lti.db');
    mkdirSync(dirname(planted), { mode: 0o700 });
    writeFileSync(planted, 'not mine');
    const code = volumeRestore({ dirs: dirsOf(data), from: backup, project: 'qa-p', operation: 'restore', ids: IDS, log: () => {}, contentPackages: NO_LOG_DIR, opId: OP });
    expect([code, readFileSync(planted, 'utf8'), journalStates(data), fileSets(data)]).toEqual([1, 'not mine', ['rolled_back', 'rolled_back'], before]);
  });

  it('a collision in a rollback move → rollback_failed in both journals, exit 2, nothing moved or deleted', async () => {
    const { volumeRestore, createEngine } = await lib();
    const { data, backup } = restoreSetup();
    expect(() => volumeRestore({ dirs: dirsOf(data), from: backup, project: 'qa-p', operation: 'restore', ids: IDS, log: () => {}, contentPackages: NO_LOG_DIR, opId: OP, drill: stopAt('swapped') })).toThrow('drill stop');
    // R3 must move the in-place lti after-file to .restore-<opId>/lti.db: a file is already there.
    writeFileSync(join(vol(data, 'lti'), `.restore-${OP}`, 'lti.db'), 'not mine');
    const snapshot = withoutJournals(tree(data));
    const r = createEngine({ dirs: dirsOf(data), log: () => {} }).recover();
    expect([r.code, journalStates(data), withoutJournals(tree(data))]).toEqual([2, ['rollback_failed', 'rollback_failed'], snapshot]);
  });

  it('an in-place file with unknown bytes → rollback_failed in both journals, exit 2, nothing moved or deleted', async () => {
    const { volumeRestore, createEngine } = await lib();
    const { data, backup } = restoreSetup();
    expect(() => volumeRestore({ dirs: dirsOf(data), from: backup, project: 'qa-p', operation: 'restore', ids: IDS, log: () => {}, contentPackages: NO_LOG_DIR, opId: OP, drill: stopAt('swapped') })).toThrow('drill stop');
    writeFileSync(join(vol(data, 'lti'), 'lti.db'), 'unknown bytes');
    const snapshot = withoutJournals(tree(data));
    const r = createEngine({ dirs: dirsOf(data), log: () => {} }).recover();
    expect([r.code, journalStates(data), withoutJournals(tree(data))]).toEqual([2, ['rollback_failed', 'rollback_failed'], snapshot]);
    expect(readFileSync(join(vol(data, 'lti'), 'lti.db'), 'utf8')).toBe('unknown bytes');
    expect(stateOf(data)).toBe('rollback_failed');
  });

  it('a partial quarantine copy is refused before its manifest; through the shell, nothing is removed', async () => {
    const { quarantineCopy, REAL_IO } = await lib();
    const data = makeVolumes();
    const out = join(temp(), 'q');
    expect(() => quarantineCopy({ dirs: dirsOf(data), out, project: 'qa-p', io: { ...REAL_IO, copyFile: partialCopy } })).toThrow(/does not match\. No manifest was written/);
    expect(existsSync(join(out, 'manifest.json'))).toBe(false);
    // The shell entry stops at step 1 when the copy fails: no container and no volume is removed.
    const r = shellRepo();
    writeFileSync(r.users, 'c1|stackdata-unit-lti-service-1|stackdata-unit|lti-service||exited\n');
    chmodSync(join(r.data, 'lti-service/lti.db'), 0o000); // the copy cannot read it
    const res = r.sh('stopped', ['quarantine', '--out', join(temp(), 'q2')]);
    chmodSync(join(r.data, 'lti-service/lti.db'), 0o600);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/Quarantine stopped: the copy failed\. Nothing was removed\./);
    expect(res.dockerCalls.filter((l) => /^docker (rm|volume rm) /.test(l))).toEqual([]);
  });

  it('a partial .tmp file of an identity or journal write is never used: kept by a refused restore, ignored by recover, removed after step 1', async () => {
    const { createEngine } = await lib();
    const { data, backup } = restoreSetup();
    for (const role of ROLES) {
      writeFileSync(join(vol(data, role), `${JOURNAL}.tmp`), '{"formatVersion":1,"state":"comm');
      writeFileSync(join(vol(data, role), `${IDENTITY}.tmp`), '{"formatVersion":1,"pairId":"');
    }
    expect(stateOf(data)).toBe('OK');
    expect(createEngine({ dirs: dirsOf(data), log: () => {} }).recover().code).toBe(0);
    expect(cli(['restore', '--from', backup, '--data', data, '--project', 'other-project']).code).toBe(1);
    for (const role of ROLES) expect(existsSync(join(vol(data, role), `${JOURNAL}.tmp`))).toBe(true);
    expect(cli(['restore', '--from', backup, '--data', data, '--project', 'qa-p']).code).toBe(0);
    for (const role of ROLES) {
      expect([existsSync(join(vol(data, role), `${JOURNAL}.tmp`)), existsSync(join(vol(data, role), `${IDENTITY}.tmp`))]).toEqual([false, false]);
      expect(journalOf(data, role).state).toBe('committed');
    }
  });
});

// ------------------------------------------------------------------------------------------------ legacy scan, quarantine copy

const reportFile = (root: string | null, project = 'qa-p') => {
  const f = join(temp(), 'report.jsonl');
  writeFileSync(f, root ? report(root, project).map((l) => JSON.stringify(l)).join('\n') : '');
  return f;
};
const decide = (legacy: string, file: string) => {
  const r = cli(['legacy-decide', '--data', legacy, '--report', file]);
  return { ...(r.lines.find((l) => l.event === 'storage_legacy_scan') ?? {}), exit: r.code, stderr: r.stderr };
};

describe('legacy bind-folder data (ADR-012 §10, rows L1–L7) from real report lines', { timeout: 60_000 }, () => {
  it('L1 journal row first; L2 hot journal or unknown entry; L3 a refusal state or no report; L4 no legacy data', () => {
    const open = restoreSetup();
    expect(cli(['restore', '--from', open.backup, '--data', open.data, '--project', 'qa-p', '--stop-after', 'prepared'], { STORAGE_DRILL: '1' }).code).toBe(3);
    const hot = makeData();
    writeFileSync(join(hot, 'lti-service/lti.db-journal'), 'hot');
    expect(decide(hot, reportFile(open.data))).toMatchObject({ exit: 1, row: 'L1', result: 'refuse', code: 'journal_open' });
    expect(decide(hot, reportFile(makeFresh()))).toMatchObject({ exit: 1, row: 'L2', result: 'refuse', code: 'legacy_hot_journal' });
    expect(decide(hot, reportFile(makeFresh())).stderr).toMatch(/legacy_hot_journal: lti-service\/lti.db-journal/);
    const odd = makeData();
    writeFileSync(join(odd, 'cogniate-app/cogniate.db-old'), 'x');
    expect(decide(odd, reportFile(makeFresh())).stderr).toMatch(/legacy_unknown_entry: cogniate-app\/cogniate.db-old/);
    const unknown = makeVolumes();
    writeFileSync(join(unknown, 'lti-service/stray'), 'x');
    expect(decide(makeData(), reportFile(unknown))).toMatchObject({ exit: 1, row: 'L3', result: 'refuse', code: 'unknown_entry' });
    expect(decide(makeData(), reportFile(null))).toMatchObject({ exit: 1, row: 'L3', result: 'refuse', code: 'report_unavailable' });
    expect(decide(temp(), reportFile(makeVolumes()))).toMatchObject({ exit: 0, row: 'L4', result: 'continue' });
  });

  it('L5 legacy data with FRESH volumes; L6 the same import (continue, warning); L7 any other pair', () => {
    const legacy = makeData();
    expect(decide(legacy, reportFile(makeFresh()))).toMatchObject({ exit: 1, row: 'L5', result: 'refuse', code: 'legacy_present' });
    const lb = join(temp(), 'legacy');
    expect(cli(['backup', '--source', 'legacy', '--out', lb, '--data', legacy, '--project', 'qa-p']).code).toBe(0);
    const imported = makeFresh();
    expect(cli(['import', '--from', lb, '--data', imported, '--project', 'qa-p']).code).toBe(0);
    const same = decide(legacy, reportFile(imported));
    expect(same).toMatchObject({ exit: 0, row: 'L6', result: 'continue' });
    expect(same.stderr).toMatch(/WARNING: legacy files are kept for reference and are not used/);
    writeFileSync(join(legacy, 'cogniate-app/cogniate.db-wal'), 'changed after the import');
    expect(decide(legacy, reportFile(imported))).toMatchObject({ exit: 1, row: 'L7', result: 'refuse', code: 'legacy_conflict' });
    expect(decide(makeData(), reportFile(makeVolumes()))).toMatchObject({ exit: 1, row: 'L7', result: 'refuse', code: 'legacy_conflict' });
  });
});

describe('legacy scan L6/L7 fails closed on identity lines (ADR-012 §10)', { timeout: 60_000 }, () => {
  function importedPair() {
    const legacy = makeData();
    const lb = join(temp(), 'legacy');
    expect(cli(['backup', '--source', 'legacy', '--out', lb, '--data', legacy, '--project', 'qa-p']).code).toBe(0);
    const imported = makeFresh();
    expect(cli(['import', '--from', lb, '--data', imported, '--project', 'qa-p']).code).toBe(0);
    return { legacy, imported };
  }
  const lines = (file: string) => readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Line);
  const rewrite = (file: string, f: (all: Line[]) => Line[]) => { writeFileSync(file, f(lines(file)).map((l) => JSON.stringify(l)).join('\n')); return file; };

  it('the report identity lines: report mode only, before the summary, identity metadata only, never a storage_preflight line', () => {
    const { imported } = importedPair();
    const all = report(imported);
    expect(all.map((l) => l.event)).toEqual(['storage_preflight', 'storage_preflight', 'storage_report_identity', 'storage_report_identity', 'storage_preflight_summary']);
    expect(Object.keys(all[2] ?? {}).sort()).toEqual(['event', 'firstStart', 'folder', 'generation', 'legacySources', 'pairId', 'provenanceKind', 'runId', 'ts']);
    expect(Object.keys((all[2]?.legacySources as Line[])[0] ?? {}).sort()).toEqual(['name', 'sha256', 'size']);
  });

  it('one identity line, a repeated folder, legacySources that are not a list, or an entry without sha256 → L7, never L6 and never a crash', () => {
    const { legacy, imported } = importedPair();
    expect(decide(legacy, reportFile(imported))).toMatchObject({ exit: 0, row: 'L6' });
    const variants: Array<(all: Line[]) => Line[]> = [
      (all) => all.filter((l, i) => !(l.event === 'storage_report_identity' && all.findIndex((x) => x.event === 'storage_report_identity') === i)),
      (all) => all.map((l) => (l.event === 'storage_report_identity' ? { ...l, folder: 'lti' } : l)),
      (all) => all.map((l) => (l.event === 'storage_report_identity' ? { ...l, legacySources: 'all' } : l)),
      (all) => all.map((l) => (l.event === 'storage_report_identity' ? { ...l, legacySources: (l.legacySources as Line[]).map((x) => ({ ...x, sha256: null })) } : l)),
    ];
    for (const v of variants) expect(decide(legacy, rewrite(reportFile(imported), v))).toMatchObject({ exit: 1, row: 'L7', code: 'legacy_conflict' });
    // A real identity file with a damaged legacy entry: the report keeps only name/size/sha256, and the scan refuses.
    const id = idOf(imported, 'app');
    writeFileSync(join(vol(imported, 'app'), IDENTITY), JSON.stringify({ ...id, legacySources: id.legacySources.map((x: Line) => ({ name: x.name, size: x.size, secret: 'x' })) }));
    expect(decide(legacy, reportFile(imported))).toMatchObject({ exit: 1, row: 'L7', code: 'legacy_conflict' });
    expect(readFileSync(reportFile(imported), 'utf8')).not.toContain('secret');
  });
});

describe('quarantine copy (ADR-012 §9 step 1)', () => {
  it('copies every entry of both volumes (manifest last, verified) and changes no volume; a folder that is not empty is refused', () => {
    const { data, backup } = restoreSetup();
    expect(cli(['restore', '--from', backup, '--data', data, '--project', 'qa-p', '--stop-after', 'swapped'], { STORAGE_DRILL: '1' }).code).toBe(3);
    writeFileSync(join(vol(data, 'lti'), 'stray'), 'unknown');
    symlinkSync('/etc/hosts', join(vol(data, 'app'), 'link'));
    const snapshot = tree(data);
    const out = join(temp(), 'q');
    const r = cli(['quarantine-copy', '--out', out, '--data', data, '--project', 'qa-p']);
    expect(r.code).toBe(0);
    const m = readJson(join(out, 'manifest.json'));
    expect(m).toMatchObject({ formatVersion: 1, kind: 'quarantine', composeProject: 'qa-p' });
    const listed = new Map((m.files as Array<{ name: string; type: string; sha256?: string; target?: string }>).map((f) => [f.name, f]));
    const entries = snapshot.filter((e) => e !== 'lti-service/' && e !== 'cogniate-app/');
    for (const e of entries) {
      const name = e.endsWith('/') ? e.slice(0, -1) : e.split(' ')[0] ?? '';
      const hash = e.endsWith('/') ? 'dir' : e.split(' ')[1];
      expect(listed.has(name)).toBe(true);
      if (hash !== 'dir' && hash !== 'other') expect(listed.get(name)?.sha256).toBe(hash);
    }
    expect(listed.size).toBe(entries.length);
    expect(listed.get('cogniate-app/link')).toMatchObject({ type: 'symlink', target: '/etc/hosts' });
    expect(r.lines.find((l) => l.event === 'storage_quarantine_copy')).toMatchObject({ manifestSha256: sha(join(out, 'manifest.json')) });
    expect(tree(data)).toEqual(snapshot);
    expect(cli(['quarantine-copy', '--out', out, '--data', data, '--project', 'qa-p']).code).toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------ the shell entry

// A fake Docker CLI (bash). Every call goes to calls.log. Read-only container queries find nothing, except the
// quarantine volume users (FAKE_USERS lines id|name|project|service|oneoff|state) and, with FAKE_OLD_LAYOUT=1, one
// project container `old1` that mounts the legacy lti bind folder at /data. FAKE_RM_FAIL=<id> and
// FAKE_VOLUME_RM_FAIL=1 make those removals fail (with raw text that must not be repeated). `compose … ps` answers by mode;
// `compose … run … maintenance <args>` runs the REAL database program on the volume stand-in: each `-v host:path`
// and the compose mounts (/check, /content/packages) map a container path back to its host path.
const FAKE_DOCKER = `#!/bin/bash
echo "docker $*" >> "$CALLS"
case "$1" in
  info) [ "$FAKE_DOCKER" = info-fails ] && exit 1; exit 0 ;;
  ps)
    case " $* " in
      *" --filter volume="*) [ -s "$FAKE_USERS" ] && cut -d'|' -f1 "$FAKE_USERS" ;;
      *" -aq --filter label=com.docker.compose.project="*) [ "$FAKE_OLD_LAYOUT" = 1 ] && echo old1 ;;
      *" -aq --filter label=org.cogniate.storage.run="*) [ "$FAKE_COPY_CONTAINER" = 1 ] && echo cc1 ;;
    esac
    exit 0 ;;
  inspect)
    id="\${!#}"
    if [ "$id" = cc1 ]; then echo exited; exit 0; fi
    if [ "$id" = old1 ]; then
      case "$3" in *Mounts*) printf '/data|%s/infra/.data/lti-service\\n' "$FAKE_REPO" ;; *) echo /stackdata-unit-lti-service-1 ;; esac
      exit 0
    fi
    line="$(grep "^$id|" "$FAKE_USERS" 2>/dev/null)" || exit 1
    IFS='|' read -r _ name project service oneoff state <<< "$line"
    printf '/%s|%s|%s|%s|%s\\n' "$name" "$project" "$service" "$oneoff" "$state"
    exit 0 ;;
  rm) [ "$2" = "$FAKE_RM_FAIL" ] && { echo "raw rm text" >&2; exit 1; }; exit 0 ;;
  volume) [ "$FAKE_VOLUME_RM_FAIL" = 1 ] && { echo "Error response from daemon: volume is in use" >&2; exit 1; }; exit 0 ;;
  compose) ;;
  *) exit 3 ;;
esac
case " $* " in
  *" ps "*) ;;
  *" run "*)
    maps=("/check=$FAKE_VOLUMES" "/content/packages=$FAKE_REPO/infra/.data/cogniate-app/packages")
    args=(); service=""
    shift
    while [ $# -gt 0 ]; do
      if [ -n "$service" ]; then args+=("$1"); shift; continue; fi
      case "$1" in
        -v) rest="\${2#*:}"; maps+=("\${rest%%:*}=\${2%%:*}"); shift 2 ;;
        maintenance|storage-preflight) service="$1"; shift ;;
        *) shift ;;
      esac
    done
    [ "$service" = maintenance ] || exit 3
    mapped=()
    for a in "\${args[@]}"; do
      for m in "\${maps[@]}"; do
        c="\${m%%=*}"; h="\${m#*=}"
        case "$a" in "$c"|"$c"/*) a="$h\${a#"$c"}"; break ;; esac
      done
      mapped+=("$a")
    done
    STORAGE_LOG_DIR="$FAKE_REPO/infra/.logs" exec node "$FAKE_REPO/infra/scripts/stack-data.mjs" "\${mapped[@]}"
    ;;
  *) exit 3 ;;
esac
case "$FAKE_DOCKER" in
  ps-fails) echo "error while interpolating" >&2; exit 1 ;;
  running) printf 'proxy running\\ncogniate-app running\\nlti-service exited\\n' ;;
  restarting) printf 'cogniate-app exited\\nlti-service restarting\\n' ;;
  paused) printf 'cogniate-app paused\\nlti-service exited\\n' ;;
  stopped) printf 'proxy running\\nmoodle running\\ncogniate-app exited\\nlti-service exited\\n' ;;
  created) printf 'cogniate-app created\\nlti-service dead\\n' ;;
  absent) ;;
esac
exit 0
`;
// The `node` wrapper logs only the database program (stack-data.mjs), then runs the real Node. The Node lock helper of
// storage-oplock.sh and the small `node -e` helpers are not the database program, so they are not logged.
const FAKE_NODE = `#!/bin/sh
for a in "$@"; do case "$a" in */stack-data.mjs) echo "node $*" >> "$CALLS"; break ;; esac; done
exec "$REAL_NODE" "$@"
`;

/**
 * The shell entry in a temp copy of the repo (infra/scripts: stack-data.sh, lib.sh, stack-data.mjs and the storage
 * helpers it sources or runs), so its infra/.data is a temp folder and no test can touch the checkout's data. That
 * infra/.data holds legacy bind data that no route may write (DS5). The volumes are a separate temp volume-layout
 * root; the fake `docker` runs the real database program on it, and a test sees whether that program ran.
 */
function shellRepo() {
  const root = temp();
  mkdirSync(join(root, 'infra/scripts'), { recursive: true });
  for (const f of ['stack-data.sh', 'lib.sh', 'stack-data.mjs', 'sqlite-lock-probe.mjs', 'storage-oplock.sh', 'storage-compat.sh']) copyFileSync(join(SCRIPTS, f), join(root, 'infra/scripts', f));
  const legacy = makeData(join(root, 'infra/.data'));
  const data = makeVolumes('stackdata-unit');
  const bin = join(root, 'fake-bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'docker'), FAKE_DOCKER);
  writeFileSync(join(bin, 'node'), FAKE_NODE);
  for (const f of ['docker', 'node']) chmodSync(join(bin, f), 0o755);
  const calls = join(root, 'calls.log');
  const users = join(root, 'users.txt');
  const sh = (mode: string, args: string[], opts: { noDocker?: boolean; env?: Record<string, string> } = {}) => {
    writeFileSync(calls, '');
    if (opts.noDocker) rmSync(join(bin, 'docker'), { force: true });
    const r = spawnSync('bash', [join(root, 'infra/scripts/stack-data.sh'), ...args], {
      encoding: 'utf8',
      env: {
        PATH: opts.noDocker ? `${bin}:/usr/bin:/bin` : `${bin}:${process.env.PATH}`, HOME: root, CALLS: calls, REAL_NODE: process.execPath, FAKE_DOCKER: mode,
        COMPOSE_PROJECT_NAME: 'stackdata-unit', FAKE_VOLUMES: data, FAKE_REPO: root, FAKE_USERS: users, ...opts.env,
      },
    });
    const log = readFileSync(calls, 'utf8');
    return { code: r.status, stderr: r.stderr, stdout: r.stdout, nodeRan: /^node /m.test(log), dockerCalls: log.split('\n').filter((l) => l.startsWith('docker ')) };
  };
  const dbs = () => [sha(join(data, 'lti-service/lti.db')), sha(join(data, 'cogniate-app/cogniate.db'))];
  // The legacy bind data: every entry except the content folders that §4 makes on the host.
  const legacyTree = () => tree(legacy).filter((e) => !/^cogniate-app\/(packages|uploads)\/$/.test(e));
  return { root, data, legacy, users, sh, dbs, legacyTree };
}

describe('stack-data.sh: only a positively observed stop permits maintenance (B-M1-02)', { timeout: 60_000 }, () => {
  const UNKNOWN: Array<[string, RegExp]> = [
    ['info-fails', /Docker does not answer/],
    ['ps-fails', /docker compose ps failed/],
    ['running', /Stop the services first: cogniate-app \(running\) is not stopped/],
    ['restarting', /Stop the services first: lti-service \(restarting\) is not stopped/],
    ['paused', /Stop the services first: cogniate-app \(paused\) is not stopped/],
  ];

  it.each(UNKNOWN)('backup with docker %s: exit 1, the database program never runs, no backup folder', (mode, message) => {
    const r = shellRepo();
    const out = join(temp(), 'backup');
    const res = r.sh(mode, ['backup', '--out', out]);
    expect([res.code, res.nodeRan, existsSync(out)]).toEqual([1, false, false]);
    expect(res.stderr).toMatch(message);
    expect(res.stderr).toContain('Nothing was changed.');
  });

  it.each(UNKNOWN)('restore with docker %s: exit 1, the database program never runs, the target databases do not change', (mode, message) => {
    const r = shellRepo();
    const backup = join(temp(), 'backup');
    expect(r.sh('stopped', ['backup', '--out', backup]).code).toBe(0);
    const db = new DatabaseSync(join(r.data, 'cogniate-app/cogniate.db'));
    db.exec('CREATE TABLE later (x)');
    db.close();
    const before = r.dbs();
    const res = r.sh(mode, ['restore', '--from', backup]);
    expect([res.code, res.nodeRan]).toEqual([1, false]);
    expect(res.stderr).toMatch(message);
    expect(r.dbs()).toEqual(before);
  });

  it('no docker command: refused before the database program', () => {
    const r = shellRepo();
    const before = r.dbs();
    const res = r.sh('stopped', ['restore', '--from', join(temp(), 'none')], { noDocker: true });
    // Skip the assertion only on a host that has docker in /usr/bin or /bin (the fake bin is then not the only one).
    if (existsSync('/usr/bin/docker') || existsSync('/bin/docker')) return;
    expect([res.code, res.nodeRan]).toEqual([1, false]);
    expect(res.stderr).toMatch(/docker is not installed/);
    expect(r.dbs()).toEqual(before);
  });

  it.each(['stopped', 'created', 'absent'])('known stopped (%s): backup runs, then restore puts the backup back', (mode) => {
    const r = shellRepo();
    const backup = join(temp(), 'backup');
    const b = r.sh(mode, ['backup', '--out', backup]);
    expect([b.code, b.nodeRan]).toEqual([0, true]);
    expect(b.dockerCalls.some((l) => / ps -a --format /.test(l) && l.includes('-p stackdata-unit'))).toBe(true);
    expect(JSON.parse(readFileSync(join(backup, 'manifest.json'), 'utf8'))).toMatchObject({ composeProject: 'stackdata-unit', sourceRevision: 'unknown' });
    const original = r.dbs();
    const db = new DatabaseSync(join(r.data, 'cogniate-app/cogniate.db'));
    db.exec('CREATE TABLE later (x)');
    db.close();
    expect(r.dbs()).not.toEqual(original);
    const res = r.sh(mode, ['restore', '--from', backup]);
    expect([res.code, res.nodeRan]).toEqual([0, true]);
    expect(r.dbs()).toEqual(original);
  });

  it('each volume command runs in one storage container of its run: lock first, the stop check, then compose run with name and run label', () => {
    const r = shellRepo();
    const backup = join(temp(), 'backup');
    const b = r.sh('stopped', ['backup', '--out', backup]);
    expect(b.code).toBe(0);
    const runs = b.dockerCalls.filter((l) => / compose .* run /.test(l));
    expect(runs).toHaveLength(1);
    const m = /--profile storage run --rm -T --name stackdata-unit-storage-([0-9a-f]{16}) --label org\.cogniate\.storage\.run=([0-9a-f]{16}) -v \S+:\/backup maintenance backup --source volume --data \/check --out \/backup --project stackdata-unit/.exec(runs[0]!);
    expect(m).not.toBeNull();
    expect(m?.[1]).toBe(m?.[2]);
    const order = b.dockerCalls.map((l) => (/^docker ps -a --filter label=com.docker.compose.project=stackdata-unit --filter label=org.cogniate.storage /.test(l) ? 'lock'
      : /^docker info/.test(l) ? 'info' : / ps -a --format /.test(l) ? 'ps' : / run /.test(l) ? 'run' : 'other'));
    expect(order.slice(0, 4)).toEqual(['lock', 'info', 'ps', 'run']);
    const events = parseLines(readFileSync(join(r.root, 'infra/.logs/storage-lock.jsonl'), 'utf8')).map((l) => l.event);
    expect(events).toEqual(['storage_lock_acquired', 'storage_lock_released']);
    expect(readdirSync(join(r.root, '.tmp')).filter((n) => n.startsWith('storage-op.'))).toEqual([]);
  });

  it('DS5: the legacy bind folders stay byte-identical through a volume backup and restore, and get no identity or journal', () => {
    const r = shellRepo();
    const before = r.legacyTree();
    const backup = join(temp(), 'backup');
    expect(r.sh('stopped', ['backup', '--out', backup]).code).toBe(0);
    expect(r.sh('stopped', ['restore', '--from', backup]).code).toBe(0);
    expect(journalStates(r.data)).toEqual(['committed', 'committed']);
    const after = r.legacyTree();
    expect(after).toEqual(before);
    expect(after.some((e) => /storage-(identity|journal)|\.restore-|\.previous-/.test(e))).toBe(false);
  });

  it('legacy positive: --source legacy reads infra/.data on the host (no storage container), manifest source legacy, bind files unchanged', () => {
    const r = shellRepo();
    const before = r.legacyTree();
    const backup = join(temp(), 'legacy');
    const b = r.sh('stopped', ['backup', '--out', backup, '--source', 'legacy']);
    expect([b.code, b.nodeRan, b.dockerCalls.some((l) => / run /.test(l))]).toEqual([0, true, false]);
    const m = readJson(join(backup, 'manifest.json'));
    expect(m).toMatchObject({ source: 'legacy', composeProject: 'stackdata-unit' });
    expect((m.files as Array<{ name: string; sha256: string }>).map((f) => [f.name, f.sha256])).toEqual(
      ['lti-service/lti.db', 'lti-service/lti.db-wal', 'cogniate-app/cogniate.db'].map((n) => [n, sha(join(r.legacy, n))]));
    expect(r.legacyTree()).toEqual(before);
  });

  it('a drill stop through the shell leaves an open journal; restore --recover rolls both volumes back, then finds nothing', () => {
    const r = shellRepo();
    const backup = join(temp(), 'backup');
    expect(r.sh('stopped', ['backup', '--out', backup]).code).toBe(0);
    const db = new DatabaseSync(join(r.data, 'cogniate-app/cogniate.db'));
    db.exec('CREATE TABLE later (x)');
    db.close();
    const before = fileSets(r.data);
    expect(r.sh('stopped', ['restore', '--from', backup, '--stop-after', 'swapped']).code).toBe(1); // no STORAGE_DRILL=1
    expect(journalStates(r.data)).toEqual([null, null]);
    expect(r.sh('stopped', ['restore', '--from', backup, '--stop-after', 'swapped'], { env: { STORAGE_DRILL: '1' } }).code).toBe(3);
    expect(journalStates(r.data)).toEqual(['swapped', 'swapped']);
    expect(r.sh('stopped', ['restore', '--recover', '--from', backup]).code).toBe(2);
    const rec = r.sh('stopped', ['restore', '--recover']);
    expect([rec.code, /rolled back; the targets equal the state before \(verified\)/.test(rec.stderr)]).toEqual([1, true]);
    expect(fileSets(r.data)).toEqual(before);
    expect(r.sh('running', ['restore', '--recover']).code).toBe(1); // the stop check comes first
    expect(r.sh('stopped', ['restore', '--recover']).code).toBe(0);
  });
});

describe('stack-data.sh quarantine: the exact volume-user rule (ADR-012 §9)', { timeout: 60_000 }, () => {
  const ALLOWED = ['c1|stackdata-unit-lti-service-1|stackdata-unit|lti-service||exited', 'c2|stackdata-unit-cogniate-app-1|stackdata-unit|cogniate-app|False|created'];

  it('copy (verified), remove only the allowed users and both volumes, then quarantine.json', () => {
    const r = shellRepo();
    writeFileSync(r.users, `${ALLOWED.join('\n')}\n`);
    const out = join(temp(), 'q');
    const res = r.sh('stopped', ['quarantine', '--out', out]);
    expect(res.code).toBe(0);
    const removed = res.dockerCalls.filter((l) => /^docker (rm|volume rm) /.test(l));
    expect(removed).toEqual(['docker rm c1', 'docker rm c2', 'docker volume rm stackdata-unit_ltidb stackdata-unit_appdb']);
    const q = readJson(join(out, 'quarantine.json'));
    expect(q).toMatchObject({ event: 'storage_quarantine', project: 'stackdata-unit', manifestSha256: sha(join(out, 'manifest.json')),
      removedContainers: [{ name: 'stackdata-unit-lti-service-1', id: 'c1', service: 'lti-service' }, { name: 'stackdata-unit-cogniate-app-1', id: 'c2', service: 'cogniate-app' }],
      removedVolumes: ['stackdata-unit_ltidb', 'stackdata-unit_appdb'] });
    expect(readJson(join(out, 'manifest.json')).files.find((f: { name: string }) => f.name === 'lti-service/lti.db').sha256).toBe(sha(join(r.data, 'lti-service/lti.db')));
  });

  it.each([
    ['a one-off container', 'c3|stackdata-unit-cogniate-app-run-1|stackdata-unit|cogniate-app|True|exited'],
    ['another project', 'c4|other-lti-service-1|other-project|lti-service||exited'],
    ['another service', 'c5|stackdata-unit-moodle-1|stackdata-unit|moodle||exited'],
    ['a running service container', 'c6|stackdata-unit-lti-service-1|stackdata-unit|lti-service||running'],
    ['a container without compose labels', 'c7|adhoc||||exited'],
  ])('%s refuses volume_in_use: no container and no volume removed, the verified copy stays', (_kind, user) => {
    const r = shellRepo();
    writeFileSync(r.users, `${ALLOWED[0]}\n${user}\n`);
    const out = join(temp(), 'q');
    const res = r.sh('stopped', ['quarantine', '--out', out]);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(new RegExp(`volume_in_use: ${user.split('|')[1]} \\(${user.split('|')[0]},`));
    expect(res.dockerCalls.filter((l) => /^docker (rm|volume rm) /.test(l))).toEqual([]);
    expect(existsSync(join(out, 'manifest.json'))).toBe(true);
    expect(existsSync(join(out, 'quarantine.json'))).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------ review round 1 repairs

// QA's rule (tests/host/storage-oracle.mjs namesCode, restated here: no import from tests/**): a JSON line names the code
// when a field value equals it or starts with "<code>:".
const valuesOf = (v: unknown): unknown[] => (v === null || v === undefined ? [] : Array.isArray(v) ? v.flatMap(valuesOf) : typeof v === 'object' ? Object.values(v).flatMap(valuesOf) : [v]);
const namesCode = (lines: Line[], code: string) => lines.some((l) => valuesOf(l).some((v) => typeof v === 'string' && (v === code || v.startsWith(`${code}:`))));
const REFUSAL_KEYS = new Set(['event', 'ts', 'command', 'code', 'state', 'entry', 'reasons', 'runId', 'path', 'container', 'id', 'project', 'service', 'mount', 'reason', 'head']);
const TMP_ROOTS = [tmpdir(), realpathSync(tmpdir())];
/** The one storage_refused line of a command: the code, fixed keys only, no absolute temp path, no message text. */
function refusalOf(res: { stdout: string; stderr: string }, code: string): Line {
  const all = parseLines(`${res.stdout}\n${res.stderr}`);
  const lines = all.filter((l) => l.event === 'storage_refused');
  expect(lines.map((l) => l.code)).toEqual([code]);
  const line = lines[0] ?? {};
  expect(namesCode(all, code)).toBe(true);
  expect(Object.keys(line).filter((k) => !REFUSAL_KEYS.has(k))).toEqual([]);
  const text = JSON.stringify(line);
  for (const root of TMP_ROOTS) expect(text.includes(root)).toBe(false);
  expect(text).not.toMatch(/Nothing was|No target changed|not empty\.|does not match/);
  return line;
}

describe('A-SI-01/B-SI-01: every refusal path writes one storage_refused JSON line with its code; text, exit and precedence stay', { timeout: 120_000 }, () => {
  it('the volume commands (every coded Refused of main): target state, source kind, pair, source state, manifest, drill, folders', () => {
    const { data: ok, backup: vb } = restoreSetup();
    const lb = join(temp(), 'legacy');
    expect(cli(['backup', '--source', 'legacy', '--out', lb, '--data', makeData(), '--project', 'qa-p']).code).toBe(0);
    const other = join(temp(), 'other');
    expect(cli(['backup', '--source', 'volume', '--out', other, '--data', makeVolumes(), '--project', 'qa-p']).code).toBe(0);
    // Targets with the §4 step done (a writer prepares first), so the tree snapshot covers every write.
    const prepared = (root: string) => { for (const m of ['packages', 'uploads']) mkdirSync(join(root, 'cogniate-app', m), { mode: 0o700 }); return root; };
    const first = prepared(makeFresh());
    const pairId = randomBytes(16).toString('hex');
    for (const role of ROLES) writeFileSync(join(vol(first, role), IDENTITY), JSON.stringify(identity('qa-p', role, pairId, { firstStart: 'pending' })));
    const open = restoreSetup();
    expect(cli(['restore', '--from', open.backup, '--data', open.data, '--project', 'qa-p', '--stop-after', 'prepared'], { STORAGE_DRILL: '1' }).code).toBe(3);
    const damage = (fn: (dir: string) => void) => { const c = join(temp(), 'copy'); execFileSync('cp', ['-R', vb, c]); fn(c); return c; };
    const edit = (d: string, f: (m: Record<string, unknown>) => void) => { const p = join(d, 'manifest.json'); const m = readJson(p); f(m); writeFileSync(p, JSON.stringify(m)); };
    const full = temp();
    writeFileSync(join(full, 'x'), 'x');
    const cases: Array<[string[], Record<string, string>, string, RegExp, Line]> = [
      [['restore', '--from', vb, '--data', first], {}, 'restore_target_state', /^restore_target_state: the target state is FIRST_START; next: npm run stack:up/, { state: 'FIRST_START' }],
      [['import', '--from', lb, '--data', first], {}, 'import_target_not_fresh', /^import_target_not_fresh: the target state is FIRST_START\./, { state: 'FIRST_START' }],
      [['import', '--from', vb, '--data', prepared(makeFresh())], {}, 'import_needs_legacy_backup', /^import_needs_legacy_backup: a volume backup is restored/, {}],
      [['restore', '--from', lb, '--data', prepared(makeFresh())], {}, 'restore_needs_volume_backup', /^restore_needs_volume_backup: a legacy backup goes into a FRESH pair/, {}],
      [['restore', '--from', lb, '--data', ok], {}, 'import_target_not_fresh', /^import_target_not_fresh: a legacy backup needs a FRESH target/, { state: 'OK' }],
      [['restore', '--from', other, '--data', ok], {}, 'pair_mismatch', /^pair_mismatch: the backup is of another pair/, {}],
      [['backup', '--source', 'volume', '--out', join(temp(), 'b'), '--data', open.data], {}, 'backup_source_not_ok:journal_open', /^backup_source_not_ok:journal_open\. Nothing was copied\./, { state: 'journal_open' }],
      [['restore', '--from', damage((d) => writeFileSync(join(d, 'lti-service/lti.db-wal'), 'other')), '--data', ok], {}, 'backup_damaged', /does not match the manifest\. No target changed\./, {}],
      [['restore', '--from', damage((d) => rmSync(join(d, 'cogniate-app/cogniate.db'))), '--data', ok], {}, 'backup_damaged', /^Missing backup file cogniate-app\/cogniate.db\. No target changed\./, {}],
      [['restore', '--from', damage((d) => edit(d, (m) => { m.backupId = 'nope'; })), '--data', ok], {}, 'manifest_invalid', /^The backup id is not valid\. No target changed\./, {}],
      [['restore', '--from', vb, '--data', ok, '--project', 'other-project'], {}, 'project_mismatch', /^The backup is of compose project qa-p, not other-project\. No target changed\./, {}],
      [['restore', '--from', damage((d) => writeFileSync(join(d, 'INCOMPLETE'), '')), '--data', ok], {}, 'backup_incomplete', /INCOMPLETE/, {}],
      [['restore', '--from', damage((d) => edit(d, (m) => { delete m.pairId; })), '--data', ok], {}, 'manifest_incomplete', /without pairId, generation or legacySources\. No target changed\./, {}],
      [['restore', '--from', damage((d) => rmSync(join(d, 'manifest.json'))), '--data', ok], {}, 'no_manifest', /^The manifest is missing or is not JSON\. No target changed\./, {}],
      [['restore', '--from', vb, '--data', ok, '--stop-after', 'swapped'], {}, 'drill_not_enabled', /need STORAGE_DRILL=1\. Nothing was changed\./, {}],
      [['backup', '--source', 'volume', '--out', full, '--data', ok], {}, 'backup_folder_not_empty', /^The backup folder is not empty\. Nothing was copied\./, {}],
      [['quarantine-copy', '--out', full, '--data', ok], {}, 'quarantine_folder_not_empty', /^The quarantine folder is not empty\. Nothing was copied\./, {}],
    ];
    for (const [args, env, code, text, extra] of cases) {
      const target = args[args.indexOf('--data') + 1] ?? '';
      const before = tree(target);
      const r = cli(args.includes('--project') ? args : [...args, '--project', 'qa-p'], env);
      expect([code, r.code]).toEqual([code, 1]);
      expect(r.stderr).toMatch(text);
      expect(refusalOf(r, code)).toMatchObject({ command: args[0], ...extra });
      expect(tree(target)).toEqual(before);
    }
    // A usage error (exit 2) and a success write no storage_refused line.
    const usage = cli(['restore', '--from', vb, '--data', ok, '--project', 'qa-p', '--stop-after', 'nowhere'], { STORAGE_DRILL: '1' });
    expect([usage.code, parseLines(usage.stdout + usage.stderr).some((l) => l.event === 'storage_refused')]).toEqual([2, false]);
    const done = cli(['restore', '--from', vb, '--data', ok, '--project', 'qa-p']);
    expect([done.code, done.lines.some((l) => l.event === 'storage_refused')]).toEqual([0, false]);
  });

  it('the legacy backup on the host (its own catch): hot journal, unknown entry, a missing database, a folder in the checkout or not empty', () => {
    const hot = makeData();
    writeFileSync(join(hot, 'lti-service/lti.db-journal'), 'hot');
    const odd = makeData();
    writeFileSync(join(odd, 'cogniate-app/cogniate.db-old'), 'x');
    const half = makeData();
    rmSync(join(half, 'cogniate-app/cogniate.db'));
    const data = makeData();
    const full = temp();
    writeFileSync(join(full, 'x'), 'x');
    const cases: Array<[string[], string, RegExp, Line]> = [
      [['--out', join(temp(), 'b'), '--data', hot], 'legacy_hot_journal', /^legacy_hot_journal: lti-service\/lti.db-journal \(a hot rollback journal/, { entry: 'lti-service/lti.db-journal' }],
      [['--out', join(temp(), 'b'), '--data', odd], 'legacy_unknown_entry', /^legacy_unknown_entry: cogniate-app\/cogniate.db-old/, { entry: 'cogniate-app/cogniate.db-old' }],
      [['--out', join(temp(), 'b'), '--data', half], 'legacy_database_missing', /^Missing database cogniate-app\/cogniate.db\. Nothing was copied\./, { entry: 'cogniate-app/cogniate.db' }],
      [['--out', join(data, 'inside'), '--data', data, '--repo', data], 'backup_folder_in_checkout', /^The backup folder must be outside the checkout/, {}],
      [['--out', full, '--data', data], 'backup_folder_not_empty', /is not empty\.$/m, {}],
    ];
    for (const [args, code, text, extra] of cases) {
      const r = cli(['backup', '--source', 'legacy', ...args, '--project', 'qa-p']);
      expect([code, r.code]).toEqual([code, 1]);
      expect(r.stderr).toMatch(text);
      expect(refusalOf(r, code)).toMatchObject({ command: 'backup', ...extra });
    }
    expect(existsSync(join(temp(), 'b', 'manifest.json'))).toBe(false);
  });

  it('a writer whose root step fails: the fixed state code first, then prepare_failed, after the privilege drop', { skip: process.getuid?.() === 0 }, () => {
    const { data, backup } = restoreSetup();
    const before = tree(data);
    const r = cli(['restore', '--from', backup, '--data', data, '--project', 'qa-p'], { HOST_UID: String((process.getuid?.() ?? 0) + 1) });
    expect(r.code).toBe(1);
    // HOST_UID is another user: row 5 (the mountpoints are not that user's) comes before row 6 (owner_mismatch).
    expect(r.stderr).toMatch(/^mountpoint_unsafe: the target state is mountpoint_unsafe\. prepare_failed: lti: EPERM\. Nothing was changed\./);
    expect(refusalOf(r, 'mountpoint_unsafe')).toMatchObject({ state: 'mountpoint_unsafe', reasons: ['mountpoint_unsafe', 'prepare_failed:lti:EPERM'] });
    expect(tree(data)).toEqual(before);
  });

  it('the shell: content_path_unsafe (lib.sh), old_layout_container (legacy backup) and volume_in_use (quarantine), each with its fields', () => {
    const r = shellRepo();
    const uploads = join(r.root, 'infra/.data/cogniate-app/uploads');
    const elsewhere = temp();
    symlinkSync(elsewhere, uploads);
    const unsafe = r.sh('stopped', ['backup', '--out', join(temp(), 'b')]);
    expect([unsafe.code, unsafe.nodeRan, unsafe.dockerCalls.some((l) => / run /.test(l))]).toEqual([1, false, false]);
    expect(unsafe.stderr).toMatch(new RegExp(`content_path_unsafe: ${uploads.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} is a symbolic link, not a directory, or not owned by `));
    const line = refusalOf(unsafe, 'content_path_unsafe');
    expect(line).toMatchObject({ command: 'stack:data-backup', path: 'infra/.data/cogniate-app/uploads' });
    expect(String(line.runId)).toMatch(/^[0-9a-f]{16}$/);
    rmSync(uploads);
    const old = r.sh('stopped', ['backup', '--out', join(temp(), 'b'), '--source', 'legacy'], { env: { FAKE_OLD_LAYOUT: '1' } });
    expect([old.code, old.nodeRan]).toEqual([1, false]);
    expect(old.stderr).toMatch(/old_layout_container: container stackdata-unit-lti-service-1 \(old1\) still mounts .*infra\/\.data\/lti-service at \/data\. Remove the old containers first/);
    expect(refusalOf(old, 'old_layout_container')).toMatchObject({ command: 'stack:data-backup', container: 'stackdata-unit-lti-service-1', id: 'old1', mount: 'infra/.data/lti-service' });
    writeFileSync(r.users, 'c4|other "lti"|other-project|lti-service||exited\n');
    const q = r.sh('stopped', ['quarantine', '--out', join(temp(), 'q')]);
    expect(q.code).toBe(1);
    expect(refusalOf(q, 'volume_in_use')).toMatchObject({ command: 'stack:data-quarantine', container: 'other "lti"', id: 'c4', project: 'other-project', service: 'lti-service', state: 'exited' });
  });
});

describe('stack-data.sh folder refusals: a coded JSON line on stderr (the folder name is read from stdout)', { timeout: 60_000 }, () => {
  it('a backup folder inside the checkout or not empty, and a restore from a folder that does not exist', () => {
    const r = shellRepo();
    const inside = r.sh('stopped', ['backup', '--out', join(r.root, 'inside')]);
    expect([inside.code, inside.nodeRan]).toEqual([1, false]);
    expect(inside.stderr).toContain('The folder must be outside the checkout (it contains secrets). Nothing was changed.');
    expect(refusalOf(inside, 'backup_folder_in_checkout')).toMatchObject({ command: 'stack:data-backup' });
    const full = temp();
    writeFileSync(join(full, 'x'), 'x');
    const notEmpty = r.sh('stopped', ['quarantine', '--out', full]);
    expect([notEmpty.code, notEmpty.dockerCalls.some((l) => / run /.test(l))]).toEqual([1, false]);
    expect(refusalOf(notEmpty, 'backup_folder_not_empty')).toMatchObject({ command: 'stack:data-quarantine' });
    const missing = r.sh('stopped', ['restore', '--from', join(temp(), 'none')]);
    expect([missing.code, missing.nodeRan]).toEqual([1, false]);
    expect(missing.stderr).toMatch(/No backup folder .*none\. No target changed\./);
    expect(refusalOf(missing, 'backup_folder_missing')).toMatchObject({ command: 'stack:data-restore' });
  });
});

describe('B-SI-05: a quarantine that stops while it removes says what happened; the copy and the volumes stay', { timeout: 60_000 }, () => {
  const USERS = 'c1|stackdata-unit-lti-service-1|stackdata-unit|lti-service||exited\nc2|stackdata-unit-cogniate-app-1|stackdata-unit|cogniate-app||exited\n';
  it('a service container that Docker does not remove: exit 1, the removed ones named, no volume removed, no raw Docker text', () => {
    const r = shellRepo();
    writeFileSync(r.users, USERS);
    const out = join(temp(), 'q');
    const res = r.sh('stopped', ['quarantine', '--out', out], { env: { FAKE_RM_FAIL: 'c2' } });
    expect(res.code).toBe(1);
    expect(res.stderr).toContain(`Quarantine stopped at the container removal: Docker did not remove stackdata-unit-cogniate-app-1 (c2). Removed before: stackdata-unit-lti-service-1 (c1). The verified copy in ${out} and both volumes stay.`);
    expect(res.stderr).not.toContain('raw rm text');
    expect(res.dockerCalls.filter((l) => /^docker (rm|volume rm) /.test(l))).toEqual(['docker rm c1', 'docker rm c2']);
    expect([existsSync(join(out, 'manifest.json')), existsSync(join(out, 'quarantine.json'))]).toEqual([true, false]);
  });
  it('the copy container that Docker does not remove: nothing removed; the volume removal that fails names the removed containers', () => {
    const r = shellRepo();
    writeFileSync(r.users, USERS);
    const copy = r.sh('stopped', ['quarantine', '--out', join(temp(), 'q')], { env: { FAKE_COPY_CONTAINER: '1', FAKE_RM_FAIL: 'cc1' } });
    expect(copy.code).toBe(1);
    expect(copy.stderr).toMatch(/Quarantine stopped: Docker did not remove the copy container cc1\. Nothing was removed; the verified copy is in /);
    expect(copy.stderr).not.toContain('raw rm text');
    expect(copy.dockerCalls.filter((l) => /^docker (rm|volume rm) /.test(l))).toEqual(['docker rm cc1']);
    const vol = r.sh('stopped', ['quarantine', '--out', join(temp(), 'q2')], { env: { FAKE_VOLUME_RM_FAIL: '1' } });
    expect(vol.code).toBe(1);
    expect(vol.stderr).toContain('Quarantine stopped at the volume removal (see the Docker message above). Removed service containers: stackdata-unit-lti-service-1 (c1), stackdata-unit-cogniate-app-1 (c2). The copy and the volumes stay.');
  });
});

describe('A-SI-02: a present journal that is not valid is R6: exit 2 and NOTHING changes; it is never read as absent', { timeout: 120_000 }, () => {
  const INVALID = ['{"broken', 'null', 'false', '0', '""', '[]', '"text"', '{}', '{"formatVersion":1,"operation":"restore","opId":"x","state":"committed"}'];
  const recover = (data: string) => cli(['recover', '--data', data, '--project', 'qa-p']);
  const expectR6 = (data: string) => {
    const before = tree(data);
    const r = recover(data);
    expect([r.code, tree(data)]).toEqual([2, before]);
    expect(r.stderr).toMatch(/the rollback did not finish; do not start; keep both volumes; use stack:data-quarantine/);
    expect(r.stderr).not.toMatch(/no target changed|nothing to recover|cancelled/i);
  };
  it.each(INVALID)('terminal lti journal (committed) and an app journal of %s → R6', (text) => {
    const { data, backup } = restoreSetup();
    expect(cli(['restore', '--from', backup, '--data', data, '--project', 'qa-p']).code).toBe(0);
    writeFileSync(join(vol(data, 'app'), JOURNAL), text);
    expectR6(data);
    expect(stateOf(data)).toBe('journal_inconsistent');
  });
  it.each(['{"broken', 'null', '0', '{}'])('lti prepared (R1 if the app journal were absent) and an app journal of %s → R6, the lti journal stays prepared', (text) => {
    const { data, backup } = restoreSetup();
    expect(cli(['restore', '--from', backup, '--data', data, '--project', 'qa-p', '--stop-after', 'prepared-lti'], { STORAGE_DRILL: '1' }).code).toBe(3);
    writeFileSync(join(vol(data, 'app'), JOURNAL), text);
    expectR6(data);
    expect(journalOf(data, 'lti').state).toBe('prepared');
  });
  it('both journals invalid, a journal that is a folder, and a journal that is a symbolic link → R6', () => {
    const { data, backup } = restoreSetup();
    expect(cli(['restore', '--from', backup, '--data', data, '--project', 'qa-p']).code).toBe(0);
    const committed = readFileSync(join(vol(data, 'lti'), JOURNAL), 'utf8'); // a valid terminal journal
    writeFileSync(join(vol(data, 'lti'), JOURNAL), 'false');
    writeFileSync(join(vol(data, 'app'), JOURNAL), '{"broken');
    expectR6(data);
    // A valid terminal lti journal, so only the app entry decides: a folder, then a link to a valid journal.
    writeFileSync(join(vol(data, 'lti'), JOURNAL), committed);
    rmSync(join(vol(data, 'app'), JOURNAL));
    mkdirSync(join(vol(data, 'app'), JOURNAL));
    expectR6(data);
    rmSync(join(vol(data, 'app'), JOURNAL), { recursive: true });
    const real = join(temp(), 'journal.json');
    writeFileSync(real, committed);
    symlinkSync(real, join(vol(data, 'app'), JOURNAL));
    expectR6(data);
    rmSync(join(vol(data, 'app'), JOURNAL));
    expect(recover(data).code).toBe(0); // control: the same lti journal with no app journal is R0
  });
  it('regression: valid journals still recover (R1 cancels, then R0 finds nothing)', () => {
    const { data, backup, before } = restoreSetup();
    expect(cli(['restore', '--from', backup, '--data', data, '--project', 'qa-p', '--stop-after', 'prepared-lti'], { STORAGE_DRILL: '1' }).code).toBe(3);
    expect(recover(data).code).toBe(1);
    expect([journalStates(data), fileSets(data)]).toEqual([['rolled_back', null], before]);
    expect(recover(data).code).toBe(0);
  });
});

describe('B-SI-07: the read-only modes skip §4 and drop privilege at once; the writers keep the root step', { timeout: 60_000 }, () => {
  function unpreparedVolumes() {
    const data = makeVolumes();
    for (const m of ['packages', 'uploads']) rmSync(join(data, 'cogniate-app', m), { recursive: true });
    for (const role of ROLES) chmodSync(vol(data, role), 0o755);
    return data;
  }
  const modes = (data: string) => ROLES.map((r) => lstatSync(vol(data, r)).mode & 0o777);
  const ITEMS = [{ volume: 'lti', item: '.', issue: 'mode' }, { volume: 'app', item: '.', issue: 'mode' }, { volume: 'app', item: 'packages', issue: 'absent' }, { volume: 'app', item: 'uploads', issue: 'absent' }];
  it('a root that is not 0700 and absent mountpoints: backup and quarantine copy go on, record the items as information, change nothing', () => {
    const data = unpreparedVolumes();
    const before = tree(data);
    const b = cli(['backup', '--source', 'volume', '--out', join(temp(), 'b'), '--data', data, '--project', 'qa-p']);
    expect(b.code).toBe(0);
    expect(b.lines.find((l) => l.event === 'storage_backup')?.unprepared).toEqual(ITEMS);
    expect([tree(data), modes(data)]).toEqual([before, [0o755, 0o755]]);
    const q = cli(['quarantine-copy', '--out', join(temp(), 'q'), '--data', data, '--project', 'qa-p']);
    expect(q.code).toBe(0);
    expect(q.lines.find((l) => l.event === 'storage_quarantine_copy')?.unprepared).toEqual(ITEMS);
    expect([tree(data), modes(data)]).toEqual([before, [0o755, 0o755]]);
    expect(parseLines(b.stdout + q.stdout).some((l) => l.event === 'storage_refused')).toBe(false);
  });
  it('a prepared volume records no item; a writer (restore) still does the §4 step', () => {
    const data = makeVolumes();
    const out = join(temp(), 'b');
    const b = cli(['backup', '--source', 'volume', '--out', out, '--data', data, '--project', 'qa-p']);
    expect(b.lines.find((l) => l.event === 'storage_backup')?.unprepared).toEqual([]);
    const target = unpreparedVolumes();
    const pairOfBackup = readJson(join(out, 'manifest.json')).pairId;
    for (const role of ROLES) writeFileSync(join(vol(target, role), IDENTITY), JSON.stringify({ ...idOf(target, role), pairId: pairOfBackup }));
    expect(cli(['restore', '--from', out, '--data', target, '--project', 'qa-p']).code).toBe(0);
    expect(modes(target)).toEqual([0o700, 0o700]);
    expect(['packages', 'uploads'].map((m) => lstatSync(join(target, 'cogniate-app', m)).mode & 0o777)).toEqual([0o700, 0o700]);
  });
  it('an entry that the host user cannot read: backup and quarantine copy fail closed (no manifest), naming the entry', { skip: process.getuid?.() === 0 }, () => {
    const data = makeVolumes();
    chmodSync(join(data, 'lti-service/lti.db'), 0o000);
    try {
      const out = join(temp(), 'b');
      const b = cli(['backup', '--source', 'volume', '--out', out, '--data', data, '--project', 'qa-p']);
      expect([b.code, existsSync(join(out, 'manifest.json'))]).toEqual([1, false]);
      expect(b.stderr).toMatch(/^Cannot read lti-service\/lti.db as the host user \(EACCES\)/);
      expect(refusalOf(b, 'source_unreadable')).toMatchObject({ command: 'backup', entry: 'lti-service/lti.db' });
      const qo = join(temp(), 'q');
      const q = cli(['quarantine-copy', '--out', qo, '--data', data, '--project', 'qa-p']);
      expect([q.code, existsSync(join(qo, 'manifest.json'))]).toEqual([1, false]);
      expect(refusalOf(q, 'source_unreadable')).toMatchObject({ command: 'quarantine-copy', entry: 'lti-service/lti.db' });
    } finally {
      chmodSync(join(data, 'lti-service/lti.db'), 0o600);
    }
    // A volume root that the host user cannot list: the same fail-closed result, naming that root.
    chmodSync(vol(data, 'app'), 0o000);
    try {
      const out = join(temp(), 'b2');
      const b = cli(['backup', '--source', 'volume', '--out', out, '--data', data, '--project', 'qa-p']);
      expect([b.code, existsSync(join(out, 'manifest.json'))]).toEqual([1, false]);
      const line = refusalOf(b, 'source_unreadable');
      expect([line.command, String(line.entry)]).toEqual(['backup', expect.stringMatching(/^cogniate-app(\/|$)/)]);
      const q = cli(['quarantine-copy', '--out', join(temp(), 'q2'), '--data', data, '--project', 'qa-p']);
      expect(q.code).toBe(1);
      expect(String(refusalOf(q, 'source_unreadable').entry)).toMatch(/^cogniate-app(\/|$)/);
    } finally {
      chmodSync(vol(data, 'app'), 0o700);
    }
  });
});
