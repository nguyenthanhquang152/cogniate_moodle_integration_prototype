// The maintenance commands of ADR-011 §14 (infra/scripts/stack-data.mjs), run as a child process on temp folders, and
// the shell entry infra/scripts/stack-data.sh (B-M1-02: only a positively observed stop permits maintenance).
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPTS = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../infra/scripts');
const SCRIPT = join(SCRIPTS, 'stack-data.mjs');
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

/**
 * The shell entry in a temp copy of the repo (infra/scripts: stack-data.sh, lib.sh, stack-data.mjs), so its
 * infra/.data is a temp folder and no test can touch the checkout's data. A fake `docker` answers by mode; a `node`
 * wrapper writes one line to calls.log, then runs the real Node, so a test sees whether the database program ran.
 */
function shellRepo() {
  const root = temp();
  mkdirSync(join(root, 'infra/scripts'), { recursive: true });
  for (const f of ['stack-data.sh', 'lib.sh', 'stack-data.mjs']) copyFileSync(join(SCRIPTS, f), join(root, 'infra/scripts', f));
  const data = makeData(join(root, 'infra/.data'));
  const bin = join(root, 'fake-bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'docker'), `#!/bin/sh
echo "docker $*" >> "$CALLS"
case "$1" in
  info) [ "$FAKE_DOCKER" = info-fails ] && exit 1; exit 0 ;;
  compose) case " $* " in *" ps "*) ;; *) exit 3 ;; esac ;;
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
`);
  writeFileSync(join(bin, 'node'), `#!/bin/sh\necho "node $*" >> "$CALLS"\nexec "$REAL_NODE" "$@"\n`);
  for (const f of ['docker', 'node']) chmodSync(join(bin, f), 0o755);
  const calls = join(root, 'calls.log');
  const sh = (mode: string, args: string[], opts: { noDocker?: boolean } = {}) => {
    writeFileSync(calls, '');
    if (opts.noDocker) rmSync(join(bin, 'docker'), { force: true });
    const r = spawnSync('bash', [join(root, 'infra/scripts/stack-data.sh'), ...args], {
      encoding: 'utf8',
      env: {
        PATH: opts.noDocker ? `${bin}:/usr/bin:/bin` : `${bin}:${process.env.PATH}`, HOME: root, CALLS: calls, REAL_NODE: process.execPath, FAKE_DOCKER: mode,
        COMPOSE_PROJECT_NAME: 'stackdata-unit',
      },
    });
    const log = readFileSync(calls, 'utf8');
    return { code: r.status, stderr: r.stderr, stdout: r.stdout, nodeRan: /^node /m.test(log), dockerCalls: log.split('\n').filter((l) => l.startsWith('docker ')) };
  };
  const dbs = () => [sha(join(data, 'lti-service/lti.db')), sha(join(data, 'cogniate-app/cogniate.db'))];
  return { root, data, sh, dbs };
}

describe('stack-data.sh: only a positively observed stop permits maintenance (B-M1-02)', () => {
  const UNKNOWN: Array<[string, RegExp]> = [
    ['info-fails', /Docker does not answer/],
    ['ps-fails', /docker compose ps failed/],
    ['running', /Stop the services first: cogniate-app \(running\) is not stopped/],
    ['restarting', /Stop the services first: lti-service \(restarting\) is not stopped/],
    ['paused', /Stop the services first: cogniate-app \(paused\) is not stopped/],
  ];

  it.each(UNKNOWN)('backup with docker %s: exit 1, the Node program never runs, no backup folder', (mode, message) => {
    const r = shellRepo();
    const out = join(temp(), 'backup');
    const res = r.sh(mode, ['backup', '--out', out]);
    expect([res.code, res.nodeRan, existsSync(out)]).toEqual([1, false, false]);
    expect(res.stderr).toMatch(message);
    expect(res.stderr).toContain('Nothing was changed.');
  });

  it.each(UNKNOWN)('restore with docker %s: exit 1, the Node program never runs, the target databases do not change', (mode, message) => {
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

  it('no docker command: refused before the Node program', () => {
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
});
