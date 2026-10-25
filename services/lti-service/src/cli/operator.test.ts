// lti:operator init (LA-ADR-06 D3 "Trust bootstrap"): arguments, exit codes and output lines.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { listAuditEvents } from '../store/audit.ts';
import { findActiveOperatorKey, issueOperatorKey, listOperatorKeys } from '../store/operator-keys.ts';
import { parseOperatorArgs, runInit } from './operator.ts';

const T0 = Date.parse('2026-10-22T10:00:00.000Z');
const KEY_LINE = /^ltio_[A-Za-z0-9_-]{43}$/;

async function init(db: ReturnType<typeof openDb>, args: string[], now = T0) {
  const parsed = parseOperatorArgs(args);
  if (!parsed.ok) throw new Error(parsed.message);
  return (await runInit(db, parsed.mode, parsed.name, now));
}

describe('parseOperatorArgs', () => {
  it('prints usage and exits 2 when a symlinked entry point has no arguments', () => {
    const dir = mkdtempSync(join(tmpdir(), 'operator-link-'));
    try {
      const entry = join(dir, 'operator.ts');
      symlinkSync(new URL('./operator.ts', import.meta.url), entry);
      const result = spawnSync(process.execPath, [entry], { cwd: dir, encoding: 'utf8', timeout: 10_000 });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('Usage: lti:operator init --name <operator>');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads init, --name, --if-none and --replace', () => {
    expect(parseOperatorArgs(['init', '--name', 'qa'])).toEqual({ ok: true, mode: 'refuse', name: 'qa' });
    expect(parseOperatorArgs(['init', '--if-none'])).toEqual({ ok: true, mode: 'if-none', name: null });
    expect(parseOperatorArgs(['init', '--replace', '--name', 'qa'])).toEqual({ ok: true, mode: 'replace', name: 'qa' });
  });

  it('refuses a usage error (exit 2 in the entry point)', () => {
    for (const args of [[], ['list'], ['init'], ['init', '--replace'], ['init', '--if-none', '--replace', '--name', 'qa'], ['init', '--name', 'a b'], ['init', '--name', 'qa', '--force']]) {
      expect(parseOperatorArgs(args).ok, args.join(' ')).toBe(false);
    }
  });
});

describe('runInit', () => {
  it('a fresh database: prints the new key as the only stdout line (exit 0); the key is active', async () => {
    const db = openDb(':memory:');
    const r = (await init(db, ['init', '--name', 'qa']));
    expect(r.code).toBe(0);
    expect(r.stdout).toHaveLength(1);
    expect(r.stdout[0]).toMatch(KEY_LINE);
    expect(r.stderr).toEqual([]);
    expect(findActiveOperatorKey(db, r.stdout[0]!, T0 + 1)?.operator).toBe('qa');
  });

  it('AC-LA-E5-01-05 (logic): an active key exists: exit 1, one line, nothing changes', async () => {
    const db = openDb(':memory:');
    const first = (await init(db, ['init', '--name', 'alice'])).stdout[0]!;
    const before = listOperatorKeys(db);
    const r = (await init(db, ['init', '--name', 'qa'], T0 + 1));
    expect([r.code, r.stdout, r.stderr.length]).toEqual([1, [], 1]);
    expect(listOperatorKeys(db)).toEqual(before);
    expect(findActiveOperatorKey(db, first, T0 + 2)).not.toBeNull();
  });

  it('AC-LA-E5-01-06 (logic): --if-none with an active key: exit 0, the line "operator key exists", no new key (with or without --name)', async () => {
    const db = openDb(':memory:');
    (await init(db, ['init', '--name', 'alice']));
    for (const args of [['init', '--if-none'], ['init', '--if-none', '--name', 'qa']]) {
      expect((await init(db, args, T0 + 1))).toEqual({ code: 0, stdout: ['operator key exists'], stderr: [] });
    }
    expect(listOperatorKeys(db)).toHaveLength(1);
  });

  it('--if-none on a fresh database makes the key; without --name it is a usage error and writes nothing', async () => {
    const db = openDb(':memory:');
    expect((await init(db, ['init', '--if-none']))).toMatchObject({ code: 2, stdout: [] });
    expect(listOperatorKeys(db)).toEqual([]);
    const r = (await init(db, ['init', '--if-none', '--name', 'qa']));
    expect([r.code, r.stdout[0]]).toEqual([0, expect.stringMatching(KEY_LINE)]);
  });

  it('AC-LA-E5-01-07 (logic): --replace revokes every operator key and prints one new key; only the new key works', async () => {
    const db = openDb(':memory:');
    const old = (await init(db, ['init', '--name', 'alice'])).stdout[0]!;
    const other = issueOperatorKey(db, { operator: 'bob', expiresAt: T0 + 3600 * 1000 }, T0).operatorKey;
    const r = (await init(db, ['init', '--replace', '--name', 'qa'], T0 + 10));
    expect([r.code, r.stdout.length, r.stderr]).toEqual([0, 1, []]);
    expect(r.stdout[0]).toMatch(KEY_LINE);
    expect(findActiveOperatorKey(db, old, T0 + 11)).toBeNull();
    expect(findActiveOperatorKey(db, other, T0 + 11)).toBeNull();
    expect(findActiveOperatorKey(db, r.stdout[0]!, T0 + 11)?.operator).toBe('qa');
  });

  it('AC-LA-E5-02-04 (CLI part): a new key writes one event operator_key.issue with actor system:bootstrap; a refusal and --if-none write none', async () => {
    const db = openDb(':memory:');
    (await init(db, ['init', '--name', 'alice']));
    (await init(db, ['init', '--name', 'qa'], T0 + 1));
    (await init(db, ['init', '--if-none'], T0 + 2));
    const replaced = (await init(db, ['init', '--replace', '--name', 'qa'], T0 + 3));
    const newId = listOperatorKeys(db).find((k) => findActiveOperatorKey(db, replaced.stdout[0]!, T0 + 4)?.id === k.id)!.id;
    const events = listAuditEvents(db, { limit: 10 }).events.reverse();
    expect(events.map((e) => [e.actor, e.toolAccountId, e.action, e.result, e.details])).toEqual([
      [{ type: 'system', id: 'bootstrap' }, null, 'operator_key.issue', 'ok', { operator: 'alice', replaced: false, revoked: 0 }],
      [{ type: 'system', id: 'bootstrap' }, null, 'operator_key.issue', 'ok', { operator: 'qa', replaced: true, revoked: 1 }],
    ]);
    expect(events[1]!.target).toEqual({ type: 'operator_key', id: newId });
    expect(JSON.stringify(events)).not.toContain(replaced.stdout[0]);
  });
});
