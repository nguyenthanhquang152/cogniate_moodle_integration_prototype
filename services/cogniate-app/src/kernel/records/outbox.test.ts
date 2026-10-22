import { describeJobStoreContract, describeQueueStoreContract } from '@cogniate/shared/jobs.testkit';
import { createJobRunner, createLogger, type JobContext } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginSend, recordSend } from './dispatch-store.ts';
import { createDispatchQueue } from './outbox.ts';
import { ltiAgsPolicy } from '../../drivers/lti-ags/index.ts';
import { recordsFixture } from './records.testkit.ts';

describeJobStoreContract('AC-LA-E4-02-04 app migration 014', recordsFixture);
describeQueueStoreContract('AC-LA-E4-02-04 shipped app outbox', recordsFixture);

const logger = createLogger({ service: 'outbox-test', dir: '', write: () => {} });
const settle = async () => { for (let n = 0; n < 8; n++) await new Promise<void>((r) => setImmediate(r)); };
const context = (owner: string): JobContext => ({ instanceId: owner.split('/')[0]!, bootId: owner.split('/')[1]!, leaseOwner: owner,
  logger, now: Date.now, signal: new AbortController().signal, traceId: 'trace' });
afterEach(() => vi.useRealTimers());

describe('outbox row safety', () => {
  it('AC-LA-E4-02-04: a copied in-flight confirmation with no lease sends once after its original bound', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(100_000);
    const f = recordsFixture();
    try {
      const id = await f.addRow({ key: 'copy', partition: 'p', score: 0.8, nextTryAt: 100_000, sendStartedAt: 99_000 });
      f.db.prepare('UPDATE record_dispatch SET confirmation_after = 110000, tries = 1 WHERE id = ?').run(id);
      const sends: number[] = [];
      const job = f.queueJob(async () => { sends.push(Date.now()); });
      await job.recover({ mode: 'start', instanceId: 'a', leaseOwner: 'a/boot', now: Date.now() });
      expect(await f.readRow(id)).toMatchObject({ nextTryAt: 110_000, confirmationAfter: 110_000, deliveryUncertain: true });
      expect(await job.due(109_999, 10)).toEqual([]);
      vi.setSystemTime(110_000);
      const [item] = await job.due(Date.now(), 10);
      await job.lease(item, 'a/boot', Date.now() + 60_000, Date.now());
      await job.run(item, context('a/boot')); await job.release(item, 'a/boot');
      expect(sends).toEqual([110_000]);
      expect(await f.readRow(id)).toMatchObject({ status: 'sent', tries: 2, deliveryUncertain: false });
      expect(f.db.prepare('SELECT created_at, resent_at FROM record_dispatch WHERE id = ?').get(id)).toEqual({ created_at: 100_000, resent_at: null });
      expect(await job.due(120_000, 10)).toEqual([]);
    } finally { await f.close(); }
  });

  it('AC-LA-E4-02-12: a superseded send marker requires exactly one successful confirmation', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(100_000);
    const f = recordsFixture();
    try {
      const old = await f.addRow({ key: 'one', partition: 'p', score: 0.4, nextTryAt: 0 });
      const high = await f.addRow({ key: 'one', partition: 'p', score: 0.8, nextTryAt: 0 });
      f.db.prepare("UPDATE record_dispatch SET status = 'superseded', send_started_at = ? WHERE id = ?").run(Date.now(), old);
      const job = f.queueJob(async () => {});
      const item = (await job.due(Date.now(), 10)).find((r) => f.itemId(r) === high)!;
      expect(await job.lease(item, 'a/boot', 200_000, Date.now())).toBe(false);
      // Crash-state defence in recordResult itself: simulate an already accepted higher POST.
      f.db.prepare('UPDATE record_dispatch SET lease_owner = ?, send_started_at = ?, tries = 1 WHERE id = ?').run('a/boot', Date.now(), high);
      const row = { id: high, placementId: 'rl_one', learnerSubject: 'one', confirmationAfter: null, retryFrom: Date.now() };
      const accepted = { status: 'sent' as const, nextTryAt: null, lastError: null, uncertain: false };
      recordSend(f.db, row, accepted, Date.now(), 'a/boot');
      expect(await f.readRow(high)).toMatchObject({ status: 'pending', confirmationAfter: 105_000 });
      // Recovery clears the old marker; a premature send is still refused.
      await job.recover({ mode: 'running', instanceId: 'b', leaseOwner: 'b/boot', now: Date.now() });
      expect(beginSend(f.db, high, 104_999, 'a/boot')).toBe('skipped');
      vi.setSystemTime(105_000);
      expect(beginSend(f.db, high, Date.now(), 'a/boot')).toBe('started');
      recordSend(f.db, { ...row, confirmationAfter: 105_000 }, accepted, Date.now(), 'a/boot');
      expect(await f.readRow(high)).toMatchObject({ status: 'sent', tries: 2 });
      expect((await f.readRow(old)).deliveryUncertain).toBe(false);
    } finally { await f.close(); }
  });

  it('AC-LA-E4-02-13: corrupt payload moves one row, sends its neighbour, and expires inside the original window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(100_000);
    const f = recordsFixture();
    try {
      const bad = await f.addRow({ key: 'bad', partition: 'p', score: 0.5, nextTryAt: 0 });
      const good = await f.addRow({ key: 'good', partition: 'p', score: 0.5, nextTryAt: 1 });
      f.db.prepare('UPDATE record_dispatch SET payload = ? WHERE id = ?').run('{bad', bad);
      const sends: string[] = [];
      const job = f.queueJob(async (id) => { sends.push(id); });
      for (const item of await job.due(Date.now(), 20)) {
        await job.lease(item, 'a/boot', Date.now() + 60_000, Date.now());
        await job.run(item, context('a/boot')); await job.release(item, 'a/boot');
      }
      expect(sends).toEqual([good]);
      expect(await f.readRow(bad)).toMatchObject({ status: 'pending', tries: 1, nextTryAt: 105_000 });
      vi.setSystemTime(100_000 + 86_400_000);
      const [item] = await job.due(Date.now(), 10);
      await job.lease(item, 'a/boot', Date.now() + 60_000, Date.now());
      await job.run(item, context('a/boot'));
      expect(await f.readRow(bad)).toMatchObject({ status: 'failed', tries: 2, nextTryAt: null });
    } finally { await f.close(); }
  });

  it('stop waits for a POST to record its result before removing the heartbeat', async () => {
    const f = recordsFixture();
    let finish!: () => void;
    const wait = new Promise<void>((r) => { finish = r; });
    const id = await f.addRow({ key: 'one', partition: 'p', score: 0.5, nextTryAt: 0 });
    const runner = createJobRunner({ store: f.store(), logger, instanceId: 'a', bootId: 'boot' });
    runner.addQueue(createDispatchQueue(f.db, [{ ...ltiAgsPolicy, async deliver(_, ctx) {
      expect(ctx.beginSend()).toBe('started'); await wait; return { kind: 'accepted' };
    } }]));
    try {
      runner.start(); await settle();
      const stopping = runner.stop(); await settle();
      expect(runner.state()).toBe('stopping');
      expect((await f.readRow(id)).sendStartedAt).not.toBeNull();
      finish(); await stopping;
      expect(await f.readRow(id)).toMatchObject({ status: 'sent', sendStartedAt: null, deliveryUncertain: false });
      expect(await f.store().readInstance('a')).toBeNull();
    } finally { finish(); await runner.stop(); await f.close(); }
  });
});
