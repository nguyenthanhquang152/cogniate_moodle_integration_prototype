// LA-E5-22: app:keys status and rewrap (operability §6.3 for the app; A2 BD-A2-91 point 4). Unit level on a temporary
// database; the command function is the one that the CLI entry runs.
import { createLocalKeyProvider, encrypt } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listAuditEvents } from '../app/audit.ts';
import { WS_TOKEN_COLUMN, appAad } from '../app/sealing.ts';
import { createConnection } from '../domain/connections.ts';
import { ensureLibrary } from '../domain/libraries.ts';
import type { TestApp } from '../testkit.ts';
import { TEST_CHANNELS, TEST_MASTER_KEY, testApp, testSetupOf } from '../testkit.ts';
import { runKeysCommand } from './keys.ts';

let t: TestApp | undefined;
afterEach(async () => { await t?.app.close(); t = undefined; });
const rewrapEvents = (db: TestApp['db']) => listAuditEvents(db, { action: 'key_provider.rewrap', limit: 10 }).events;
const ring = (active: string) => createLocalKeyProvider({ active, keys: new Map([['legacy', TEST_MASTER_KEY], ['k1', Buffer.alloc(32, 1)], ['k2', Buffer.alloc(32, 2)]]) });

async function world() {
  t = await testApp();
  const db = t.db;
  const connection = (name: string) => {
    const library = ensureLibrary(db, name, t!.clock.now);
    return createConnection(db, library.id, { name: 'School', siteUrl: 'https://moodle.test', method: 'manual', channel: 'moodle', profile: 'standard' },
      null, t!.clock.now, TEST_CHANNELS, testSetupOf('moodle')!.sharingOf);
  };
  const a = connection('Library A');
  const b = connection('Library B');
  db.prepare('UPDATE connection SET ws_token_encrypted = ? WHERE id = ?').run(encrypt(TEST_MASTER_KEY, 'token-a'), a.id);
  db.prepare('UPDATE connection SET ws_token_encrypted = ? WHERE id = ?').run(ring('k1').sealSync(Buffer.from('token-b'), appAad(WS_TOKEN_COLUMN, b.libraryId, b.id)).bytes, b.id);
  const warn = vi.fn();
  const run = (keys: ReturnType<typeof ring>, argv: string[], env: NodeJS.ProcessEnv = { STACK_PROFILE: 'default' }) =>
    runKeysCommand({ db, keys, logger: { warn }, now: () => 1_000, env }, argv, 'trace-keys');
  return { db, run, warn };
}

describe('app:keys (LA-E5-22)', () => {
  it('status prints the active version and the sealed values of each version, also a version that the ring does not have', async () => {
    const { run } = await world();
    expect(run(ring('k2'), ['status'])).toEqual({ exitCode: 0, lines: [
      'Key provider: local-keyring', 'Active version: k2',
      'Version k2 (active): 0 sealed values', 'Version legacy (decrypt-only): 1 sealed values', 'Version k1 (decrypt-only): 1 sealed values',
    ] });
    const legacyOnly = createLocalKeyProvider({ active: 'legacy', keys: new Map([['legacy', TEST_MASTER_KEY]]) });
    expect(run(legacyOnly, ['status']).lines.at(-1)).toBe('Version k1 (not in the key ring): 1 sealed values');
  });

  it('rewrap re-seals with the active version, writes one key_provider.rewrap audit event (operator actor, no connection), and is idempotent', async () => {
    const { db, run } = await world();
    const done = run(ring('k2'), ['rewrap', '--operator', 'qa-op']);
    expect(done.exitCode).toBe(0);
    expect(done.lines.slice(0, 3)).toEqual(['Re-wrap: complete. Examined 2, re-wrapped 2, skipped because changed 0, unreadable 0.',
      'Picker sessions keep their old form until they expire.', 'Trace id: trace-keys']);
    expect(done.lines).toContain('Version k2 (active): 2 sealed values');
    const events = rewrapEvents(db);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actor: { type: 'operator', id: 'qa-op' }, libraryId: null, connectionId: null, traceId: 'trace-keys', result: 'ok',
      target: { type: 'key_provider', id: null },
      details: { outcome: 'complete', activeVersion: 'k2', examined: 2, rewrapped: 2, skippedChanged: 0, unreadable: 0, note_present: false } });
    expect(run(ring('k2'), ['rewrap', '--operator', 'qa-op']).lines[0]).toBe('Re-wrap: complete. Examined 2, re-wrapped 0, skipped because changed 0, unreadable 0.');
  });

  it('a version missing from the ring makes the run failed (exit 1) and names the version', async () => {
    const { db, run } = await world();
    const noK1 = createLocalKeyProvider({ active: 'k2', keys: new Map([['legacy', TEST_MASTER_KEY], ['k2', Buffer.alloc(32, 2)]]) });
    const r = run(noK1, ['rewrap']);
    expect(r.exitCode).toBe(1);
    expect(r.lines.slice(0, 2)).toEqual(['Re-wrap: failed. Examined 2, re-wrapped 1, skipped because changed 0, unreadable 1.',
      'Unreadable versions: k1. Put each version back into the app key ring, restart the app, and run app:keys rewrap again.']);
    expect(rewrapEvents(db)[0]).toMatchObject({ details: { outcome: 'failed', unreadable: 1, unreadableVersions: ['k1'] } });
  });

  it('the operator policy runs without evidence: production needs a listed --operator; a refusal changes nothing', async () => {
    const { db, run, warn } = await world();
    const production = { STACK_PROFILE: 'production', OPERATORS: 'qa-op' };
    const refused = run(ring('k2'), ['rewrap'], production);
    expect(refused.exitCode).toBe(1);
    expect(JSON.parse(refused.lines[0]!)).toMatchObject({ event: 'operator_refused', reason: 'operator_missing' });
    expect(warn).toHaveBeenCalledWith('operator_refused', { trace_id: 'trace-keys', reason: 'operator_missing' });
    expect(rewrapEvents(db)).toEqual([]);
    expect(run(ring('k2'), ['status'], production).exitCode).toBe(1);
    expect(run(ring('k2'), ['rewrap', '--operator', 'qa-op'], production).exitCode).toBe(0);
    expect(run(ring('k2'), ['status', '--operator', 'qa-op'], production).exitCode).toBe(0);
  });

  it.each([[[]], [['list']], [['status', 'extra']], [['rewrap', '--evidence-ref', 'x']]])('usage for %j', async (argv) => {
    const { run } = await world();
    expect(run(ring('k2'), argv)).toEqual({ exitCode: 1, lines: ['Usage: app:keys status [--operator O] | rewrap [--operator O]'] });
  });
});
