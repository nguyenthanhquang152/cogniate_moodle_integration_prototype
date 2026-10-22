import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { insertAuditEvent } from '../app/audit.ts';
import type { AuditEventInput } from '../app/audit.ts';
import { openDb } from '../domain/db.ts';
import { runAuditCli } from './audit.ts';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const temp = () => { const dir = mkdtempSync(join(tmpdir(), 'app-audit-cli-')); dirs.push(dir); return dir; };
const cli = fileURLToPath(new URL('./audit.ts', import.meta.url));
const event = (connectionId: string, action = 'grant.issue'): AuditEventInput => ({
  actor: { type: 'operator', id: 'qa-op' }, libraryId: 'lib_1', connectionId, traceId: 'write-trace', clientIp: null,
  action, target: { type: 'grant', id: 'grant_1' }, result: 'ok', details: { note: 'private institution note', note_present: true },
});
const invoke = (dir: string, args: string[], path = cli) => spawnSync(process.execPath, [path, ...args], {
  env: { ...process.env, DATA_DIR: dir, NODE_NO_WARNINGS: '1', STACK_PROFILE: 'production', APP_MASTER_KEY: '' },
  encoding: 'utf8', timeout: 10_000,
});

describe('app:audit list (AC-LA-E5-11-07)', () => {
  it('prints only the newest two events of a connection and leaves the database bytes and ledger unchanged', () => {
    const dir = temp();
    const file = join(dir, 'cogniate.db');
    const db = openDb(file);
    for (const ts of [100, 200, 300]) insertAuditEvent(db, event('con_1'), ts);
    insertAuditEvent(db, event('con_2'), 400);
    db.close();
    const before = readFileSync(file);
    const result = invoke(dir, ['list', '--connection', 'con_1', '--limit', '2']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    const rows = result.stdout.trim().split('\n').map((line) => JSON.parse(line));
    expect(rows).toMatchObject([
      { ts: 300, connectionId: 'con_1', target: { type: 'grant', id: 'grant_1' } },
      { ts: 200, connectionId: 'con_1' },
    ]);
    expect(result.stdout).not.toContain('private institution note');
    expect(readFileSync(file)).toEqual(before);
    const after = new DatabaseSync(file, { readOnly: true });
    try { expect(after.prepare('SELECT COUNT(*) AS n FROM audit_event').get()!.n).toBe(4); }
    finally { after.close(); }
  });

  it('combines action and ISO since filters inclusively', () => {
    const dir = temp();
    const db = openDb(join(dir, 'cogniate.db'));
    const ts = Date.parse('2026-10-22T12:00:00Z');
    insertAuditEvent(db, event('con_1'), ts - 1);
    insertAuditEvent(db, event('con_1'), ts);
    insertAuditEvent(db, event('con_1', 'grant.revoke'), ts + 1);
    db.close();
    const result = runAuditCli(['list', '--action', 'grant.issue', '--since', '2026-10-22T19:00:00+07:00'], { DATA_DIR: dir });
    expect(result.exitCode).toBe(0);
    expect(result.lines.map((line) => JSON.parse(line).ts)).toEqual([ts]);
    expect(runAuditCli(['list', '--connection', 'missing'], { DATA_DIR: dir })).toEqual({ exitCode: 0, lines: [] });
  });

  it('returns no lines for an initialized empty database, including through a symlinked entry path', () => {
    const dir = temp();
    openDb(join(dir, 'cogniate.db')).close();
    const link = join(dir, 'audit.ts');
    symlinkSync(cli, link);
    for (const path of [cli, link]) {
      const result = invoke(dir, ['list'], path);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    }
    // A non-empty response also proves that the symlink runs the command.
    expect(invoke(dir, ['list', '--limit', '0'], link).status).toBe(1);
  });

  it.each([
    [], ['delete'], ['list', 'extra'], ['list', '--unknown', 'x'], ['list', '--limit'],
    ['list', '--limit', '0'], ['list', '--limit', '501'], ['list', '--limit', '-1'], ['list', '--limit', '1.5'],
    ['list', '--limit', '2oops'], ['list', '--since', 'yesterday'], ['list', '--since', '2026-02-31T00:00:00Z'],
    ['list', '--connection', ''], ['list', '--action', ''],
  ])('refuses invalid arguments %j before creating or opening a database', (...args) => {
    const dir = temp();
    const result = runAuditCli(args, { DATA_DIR: dir });
    expect(result.exitCode).toBe(1);
    expect(result.lines).toHaveLength(1);
    expect(JSON.parse(result.lines[0]!)).toMatchObject({ event: 'audit_list_refused', traceId: expect.stringMatching(/^[a-f0-9]{32}$/) });
    expect(existsSync(join(dir, 'cogniate.db'))).toBe(false);
  });

  it('never creates a missing database and uses a fresh trace id per invocation', () => {
    const dir = temp();
    const first = runAuditCli(['list'], { DATA_DIR: dir });
    const second = runAuditCli(['list'], { DATA_DIR: dir });
    expect(first.exitCode).toBe(1);
    expect(JSON.parse(first.lines[0]!)).toMatchObject({ event: 'audit_list_refused', reason: 'audit_read_failed' });
    expect(JSON.parse(first.lines[0]!).traceId).not.toBe(JSON.parse(second.lines[0]!).traceId);
    expect(existsSync(join(dir, 'cogniate.db'))).toBe(false);
  });

  it('does not migrate an old database during a read', () => {
    const dir = temp();
    const old = join(dir, 'old');
    mkdirSync(old);
    const migrations = fileURLToPath(new URL('../domain/migrations', import.meta.url));
    for (const file of readdirSync(migrations).filter((name) => name < '015')) copyFileSync(join(migrations, file), join(old, file));
    const path = join(dir, 'cogniate.db');
    openDb(path, old).close();
    const before = readFileSync(path);
    expect(runAuditCli(['list'], { DATA_DIR: dir }).exitCode).toBe(1);
    expect(readFileSync(path)).toEqual(before);
  });
});
