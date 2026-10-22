import { createLogger, type JobContext, type LogLine } from '@cogniate/shared';
import { dispatchResult } from '@cogniate/tracking';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDb } from '../../domain/db.ts';
import { beginSend } from './dispatch-store.ts';
import { createDispatchQueue, type DispatchItem } from './outbox.ts';
import { recordReporters, registerRecordReporters, writeFinalRecord } from './records.ts';
import { recordsFixture, testReporter } from './records.testkit.ts';
import type { RecordReporter } from './types.ts';

const fixtures: ReturnType<typeof recordsFixture>[] = [];
afterEach(async () => { for (const f of fixtures.splice(0)) await f.close(); vi.useRealTimers(); });
function fixture() {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(100_000);
  const f = recordsFixture(); fixtures.push(f);
  const logs: LogLine[] = [];
  const ctx: JobContext = { instanceId: 'a', bootId: 'boot', leaseOwner: 'a/boot', now: Date.now,
    signal: new AbortController().signal, traceId: 'trace', logger: createLogger({ service: 'test', write: (line) => logs.push(JSON.parse(line) as LogLine) }) };
  const sent: string[] = [];
  const job = registerRecordReporters(f.db, [testReporter(async (row, c) => {
    if (c.beginSend() !== 'started') return null;
    sent.push(row.id);
    return { kind: 'throttled', text: 'Wait', retryAt: Date.now() + 30_000 };
  }, 'A')]);
  const run = async (item: DispatchItem) => {
    expect(await job.lease(item, ctx.leaseOwner, Date.now() + 60_000, Date.now())).toBe(true);
    await job.run(item, ctx); await job.release(item, ctx.leaseOwner);
  };
  return { ...f, ctx, logs, job, sent, run };
}

describe('partition throttling (LA-ADR-03 D7)', () => {
  it('keeps tries, uncertainty and confirmation; pauses only its partition, including new rows and stale due snapshots', async () => {
    const f = fixture();
    const id = await f.addRow({ key: 'a', partition: 'A', score: 0.8, nextTryAt: 0 });
    const other = await f.addRow({ key: 'a2', partition: 'A', score: 0.8, nextTryAt: 1 });
    const outside = await f.addRow({ key: 'b', partition: 'B', score: 0.8, nextTryAt: 2 });
    f.db.prepare('UPDATE record_dispatch SET tries = 2, confirmation_after = 99000, delivery_uncertain = 1 WHERE id = ?').run(id);
    const due = await f.job.due(Date.now(), 20);
    await f.run(due.find((r) => r.id === id)!);
    expect(await f.readRow(id)).toMatchObject({ status: 'pending', tries: 2, nextTryAt: 130_000, deliveryUncertain: true, confirmationAfter: 99_000, sendStartedAt: null });
    expect(f.db.prepare('SELECT id, not_before FROM record_dispatch WHERE partition_key = ? ORDER BY seq').all('A'))
      .toEqual([{ id, not_before: 130_000 }, { id: other, not_before: 130_000 }]);
    expect(f.logs).toContainEqual(expect.objectContaining({ event: 'dispatch_throttled', level: 'warn', dispatch_id: id, partition: 'A', retry_at: 130_000 }));
    const added = await f.addRow({ key: 'new', partition: 'A', score: 0.8, nextTryAt: 3 });
    expect((await f.job.due(129_999, 20)).map((r) => r.id)).toEqual([outside]);
    expect(await f.job.lease(due.find((r) => r.id === other)!, 'b/boot', 200_000, 129_999)).toBe(false);
    // A runner that already leased before the pause must recheck immediately before POST too.
    f.db.prepare('UPDATE record_dispatch SET lease_owner = ? WHERE id = ?').run('b/boot', added);
    expect(beginSend(f.db, added, 129_999, 'b/boot')).toBe('skipped');
    await f.job.release({ id: added, partitionKey: 'A' }, 'b/boot');
    expect((await f.job.due(130_000, 20)).map((r) => r.id)).toEqual(expect.arrayContaining([id, other, added, outside]));
    const reopened = f.queueJob(async () => {});
    expect((await reopened.due(129_999, 20)).map((r) => f.itemId(r))).toEqual([outside]);
    expect(f.sent).toEqual([id]);
  });
  it('first throttle counts zero tries and does not introduce uncertainty; a short wait respects normal backoff', async () => {
    const f = fixture();
    const id = await f.addRow({ key: 'a', partition: 'A', score: 0.8, nextTryAt: 0 });
    await f.run((await f.job.due(Date.now(), 10))[0]!);
    expect(await f.readRow(id)).toMatchObject({ status: 'pending', tries: 0, nextTryAt: 130_000, deliveryUncertain: false, sendStartedAt: null });
    expect(dispatchResult({ kind: 'throttled', text: '', retryAt: 101_000 }, 0, 100_000, 100_000)).toEqual({ status: 'pending', nextTryAt: 105_000 });
    expect(dispatchResult({ kind: 'throttled', text: '', retryAt: 130_000 }, 3, 100_000, 100_000)).toEqual({ status: 'pending', nextTryAt: 220_000 });
  });
  it('keeps the original retry window, even when Retry-After ends beyond it', async () => {
    const f = fixture();
    const id = await f.addRow({ key: 'a', partition: 'A', score: 0.8, nextTryAt: 0 });
    vi.setSystemTime(100_000 + 86_400_000 - 20_000);
    await f.run((await f.job.due(Date.now(), 10))[0]!);
    expect(await f.readRow(id)).toMatchObject({ status: 'failed', tries: 0, nextTryAt: null, deliveryUncertain: false });
    expect(f.db.prepare('SELECT created_at, resent_at FROM record_dispatch WHERE id = ?').get(id)).toEqual({ created_at: 100_000, resent_at: null });
  });
  it('A-LA-E4-03-01: a new better row keeps the pause of the row that it supersedes', async () => {
    const f = fixture();
    const id = await f.addRow({ key: 'a', partition: 'A', score: 0.4, nextTryAt: 0 });
    await f.run((await f.job.due(Date.now(), 10))[0]!);
    expect(f.db.prepare('SELECT status, not_before FROM record_dispatch WHERE id = ?').get(id)).toEqual({ status: 'pending', not_before: 130_000 });
    const better = writeFinalRecord(f.db, { attemptId: 'att_a', placementId: 'rl_a', learnerSubject: 'a', outcome: 'passed',
      scoreGiven: 0.9, scoreMaximum: 1 }, { startedAt: 0, submittedAt: 0 }, ['lti-ags'], Date.now());
    expect(f.db.prepare('SELECT id, status, not_before FROM record_dispatch ORDER BY seq').all())
      .toEqual([{ id, status: 'superseded', not_before: 130_000 }, { id: better, status: 'pending', not_before: 130_000 }]);
    expect(await f.job.due(129_999, 10)).toEqual([]);
    expect((await f.job.due(130_000, 10)).map((r) => r.id)).toEqual([better]);
  });
  it('A-LA-E4-03-01: the pause check reads only pending rows through the record_dispatch_due index', async () => {
    const f = fixture();
    const statements: string[] = [];
    const db = new Proxy(f.db, { get(target, key) {
      if (key === 'prepare') return (sql: string) => { statements.push(sql); return target.prepare(sql); };
      const value = Reflect.get(target, key) as unknown;
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    } });
    const job = createDispatchQueue(db, [testReporter(async () => null)]);
    const id = await f.addRow({ key: 'a', partition: 'A', score: 0.8, nextTryAt: 0 });
    const [item] = await job.due(Date.now(), 10);
    await job.lease(item!, 'a/boot', Date.now() + 60_000, Date.now());
    beginSend(db, id, Date.now(), 'a/boot');
    const checked = statements.filter((sql) => sql.includes('record_dispatch paused'));
    expect(checked).toHaveLength(3);
    for (const sql of checked) {
      const plan = f.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((r) => String(r.detail));
      expect(plan).toContain('SEARCH paused USING INDEX record_dispatch_due (status=?)');
      expect(plan.filter((line) => line.startsWith('SCAN paused'))).toEqual([]);
    }
  });
  it('A-LA-E4-03-02: a run that lost its lease during the POST neither takes back the try nor pauses the partition', async () => {
    const f = fixture();
    const id = await f.addRow({ key: 'a', partition: 'A', score: 0.8, nextTryAt: 0 });
    const other = await f.addRow({ key: 'b', partition: 'A', score: 0.8, nextTryAt: 1 });
    const job = createDispatchQueue(f.db, [testReporter(async (row, c) => {
      if (c.beginSend() !== 'started') return null;
      // Another instance takes the row over while the POST waits (running recovery after an expired lease).
      f.db.prepare('UPDATE record_dispatch SET lease_owner = ? WHERE id = ?').run('b/boot', row.id);
      return { kind: 'throttled', text: 'Wait', retryAt: Date.now() + 30_000 };
    }, 'A')]);
    const item = (await job.due(Date.now(), 10)).find((r) => r.id === id)!;
    expect(await job.lease(item, f.ctx.leaseOwner, Date.now() + 60_000, Date.now())).toBe(true);
    await job.run(item, f.ctx);
    expect(await f.readRow(id)).toMatchObject({ status: 'pending', tries: 1, leaseOwner: 'b/boot', sendStartedAt: 100_000 });
    expect(f.db.prepare('SELECT not_before FROM record_dispatch WHERE id IN (?, ?)').all(id, other)).toEqual([{ not_before: null }, { not_before: null }]);
    expect(f.logs.filter((l) => l.event === 'dispatch_throttled' || l.event === 'score_sync')).toEqual([]);
  });
  it('AC-LA-E4-03-08: refuses everyRecord at outbox registration and registers nothing', () => {
    const db = openDb(':memory:');
    try {
      const reporter = { ...testReporter(async () => ({ kind: 'accepted' })), policy: 'everyRecord' } as unknown as RecordReporter;
      expect(() => registerRecordReporters(db, [reporter])).toThrow('Unsupported record reporter policy: lti-ags/everyRecord');
      expect(() => recordReporters(db)).toThrow('Record reporters are not configured');
    } finally { db.close(); }
  });
});
