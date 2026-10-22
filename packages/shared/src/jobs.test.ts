import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobContext, JobRunner, JobStore, QueueJob } from './jobs.ts';
import { JOB_LEASE_MS, JOB_PARALLEL, JOB_POLL_MS, createJobRunner } from './jobs.ts';
import type { QueueStoreFixture } from './jobs.testkit.ts';
import { describeJobStoreContract, describeQueueStoreContract } from './jobs.testkit.ts';
import type { Logger, LogLine } from './logger.ts';
import { createLogger } from './logger.ts';
import { transaction } from './migrations.ts';

// Reference store on a temporary SQLite file: the job tables of data-model §3 and a small outbox table with the
// columns that the runner rules need. The services implement the same statements on their own tables (LA-E4-02,
// LA-E5-19) and run the same contract suite on them.
const SCHEMA = `
CREATE TABLE job_instance (
  instance_id TEXT PRIMARY KEY, boot_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'web' CHECK (role IN ('web', 'worker')),
  started_at INTEGER NOT NULL, heartbeat_at INTEGER NOT NULL);
CREATE TABLE job_lease (name TEXT PRIMARY KEY, owner TEXT, lease_until INTEGER, last_run_at INTEGER, last_result TEXT);
CREATE TABLE dispatch (
  id TEXT PRIMARY KEY, key TEXT NOT NULL, partition_key TEXT NOT NULL, score REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', tries INTEGER NOT NULL DEFAULT 0, next_try_at INTEGER,
  send_started_at INTEGER, delivery_uncertain INTEGER NOT NULL DEFAULT 0, confirmation_after INTEGER,
  lease_owner TEXT, lease_until INTEGER);`;

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function sqliteJobStore(db: DatabaseSync): JobStore {
  return {
    readInstance(instanceId) {
      const r = db.prepare('SELECT instance_id, boot_id, role, started_at, heartbeat_at FROM job_instance WHERE instance_id = ?').get(instanceId);
      return r ? { instanceId: String(r.instance_id), bootId: String(r.boot_id), role: r.role === 'worker' ? 'worker' : 'web', startedAt: Number(r.started_at), heartbeatAt: Number(r.heartbeat_at) } : null;
    },
    claimInstance(row, staleBefore) {
      return db.prepare(`INSERT INTO job_instance (instance_id, boot_id, role, started_at, heartbeat_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (instance_id) DO UPDATE SET boot_id = excluded.boot_id, role = excluded.role, started_at = excluded.started_at,
          heartbeat_at = excluded.heartbeat_at WHERE job_instance.heartbeat_at <= ?`).run(row.instanceId, row.bootId, row.role, row.now, row.now, staleBefore).changes > 0;
    },
    heartbeat(instanceId, bootId, now) {
      return db.prepare('UPDATE job_instance SET heartbeat_at = ? WHERE instance_id = ? AND boot_id = ?').run(now, instanceId, bootId).changes > 0;
    },
    removeInstance(instanceId, bootId) {
      db.prepare('DELETE FROM job_instance WHERE instance_id = ? AND boot_id = ?').run(instanceId, bootId);
    },
    readJobLease(name) {
      const r = db.prepare('SELECT name, owner, lease_until, last_run_at, last_result FROM job_lease WHERE name = ?').get(name);
      return r ? { name: String(r.name), owner: r.owner === null ? null : String(r.owner), leaseUntil: num(r.lease_until), lastRunAt: num(r.last_run_at), lastResult: r.last_result === null ? null : String(r.last_result) } : null;
    },
    takeJobLease(name, owner, now, until) {
      return db.prepare(`INSERT INTO job_lease (name, owner, lease_until) VALUES (?, ?, ?)
        ON CONFLICT (name) DO UPDATE SET owner = excluded.owner, lease_until = excluded.lease_until
        WHERE job_lease.owner IS NULL OR job_lease.lease_until IS NULL OR job_lease.lease_until <= ?`).run(name, owner, until, now).changes > 0;
    },
    endJobLease(name, owner, at, result) {
      db.prepare('UPDATE job_lease SET owner = NULL, lease_until = NULL, last_run_at = ?, last_result = ? WHERE name = ? AND owner = ?').run(at, result, name, owner);
    },
  };
}

interface DispatchItem {
  id: string;
  partition: string;
}

/** A small outbox: best result per key, send marker and result by the lease owner only, P2 confirmation (ADR-010). */
function dispatchJob(db: DatabaseSync, send: (id: string) => Promise<void>): QueueJob<DispatchItem> {
  const isCurrent = (id: string): boolean => db.prepare(`SELECT 1 FROM dispatch s WHERE s.id = ? AND s.status = 'pending'
    AND NOT EXISTS (SELECT 1 FROM dispatch o WHERE o.key = s.key AND o.status <> 'superseded' AND o.score > s.score)`).get(id) !== undefined;
  const needsConfirmation = (id: string): boolean => db.prepare(`SELECT 1 FROM dispatch s JOIN dispatch o ON o.key = s.key AND o.id <> s.id
    WHERE s.id = ? AND o.score < s.score AND (o.delivery_uncertain = 1 OR (o.status = 'superseded' AND o.send_started_at IS NOT NULL))`).get(id) !== undefined;
  return {
    name: 'contract-dispatch',
    due: (now, limit) => db.prepare(`SELECT id, partition_key FROM (
        SELECT id, partition_key, next_try_at, ROW_NUMBER() OVER (PARTITION BY partition_key ORDER BY next_try_at, id) AS turn FROM dispatch
        WHERE status = 'pending' AND next_try_at <= ? AND (lease_until IS NULL OR lease_until <= ?))
      ORDER BY turn, next_try_at, id LIMIT ?`).all(now, now, limit).map((r) => ({ id: String(r.id), partition: String(r.partition_key) })),
    partition: (item) => item.partition,
    lease: (item, owner, until, now) => db.prepare(`UPDATE dispatch SET lease_owner = ?, lease_until = ?
      WHERE id = ? AND status = 'pending' AND send_started_at IS NULL AND (lease_until IS NULL OR lease_until <= ?)
        AND NOT EXISTS (SELECT 1 FROM dispatch o WHERE o.key = dispatch.key AND o.id <> dispatch.id AND (o.lease_until > ? OR o.send_started_at IS NOT NULL))`)
      .run(owner, until, item.id, now, now).changes > 0,
    release: (item, owner) => {
      db.prepare('UPDATE dispatch SET lease_owner = NULL, lease_until = NULL WHERE id = ? AND lease_owner = ?').run(item.id, owner);
    },
    recover: ({ mode, instanceId, leaseOwner, now }) => {
      const set = `UPDATE dispatch SET delivery_uncertain = 1, send_started_at = NULL, lease_owner = NULL, lease_until = NULL,
        next_try_at = CASE WHEN status = 'pending' THEN ? ELSE next_try_at END WHERE send_started_at IS NOT NULL AND`;
      const changes = mode === 'start'
        ? db.prepare(`${set} (lease_owner IS NULL OR lease_until IS NULL OR lease_until <= ? OR substr(lease_owner, 1, length(?)) = ?)`).run(now + 5000, now, `${instanceId}/`, `${instanceId}/`).changes
        : db.prepare(`${set} (lease_owner IS NULL OR lease_until IS NULL OR lease_until <= ?) AND (lease_owner IS NULL OR lease_owner <> ?)`).run(now + 5000, now, leaseOwner).changes;
      return Number(changes);
    },
    async run(item, ctx) {
      const owner = ctx.leaseOwner;
      const began = transaction(db, () => {
        if (!isCurrent(item.id)) {
          db.prepare(`UPDATE dispatch SET status = 'superseded', next_try_at = NULL WHERE id = ? AND status = 'pending' AND lease_owner = ? AND send_started_at IS NULL`).run(item.id, owner);
          return false;
        }
        return db.prepare(`UPDATE dispatch SET send_started_at = ?, tries = tries + 1 WHERE id = ? AND status = 'pending' AND lease_owner = ? AND send_started_at IS NULL`)
          .run(ctx.now(), item.id, owner).changes > 0;
      });
      if (!began) return;
      await send(item.id);
      const now = ctx.now();
      transaction(db, () => {
        const row = db.prepare('SELECT key, score, confirmation_after FROM dispatch WHERE id = ? AND lease_owner = ? AND send_started_at IS NOT NULL').get(item.id, owner);
        if (!row) return; // a late result: another process recovered the row
        db.prepare('UPDATE dispatch SET send_started_at = NULL WHERE id = ?').run(item.id);
        if (!isCurrent(item.id)) {
          db.prepare("UPDATE dispatch SET status = 'superseded', next_try_at = NULL WHERE id = ?").run(item.id);
        } else if (row.confirmation_after === null && needsConfirmation(item.id)) {
          db.prepare('UPDATE dispatch SET confirmation_after = ?, next_try_at = ? WHERE id = ?').run(now + 5000, now + 5000, item.id);
        } else {
          if (row.confirmation_after !== null) db.prepare('UPDATE dispatch SET delivery_uncertain = 0 WHERE key = ? AND score <= ?').run(String(row.key), Number(row.score));
          db.prepare("UPDATE dispatch SET status = 'sent', next_try_at = NULL WHERE id = ?").run(item.id);
        }
      });
    },
  };
}

function referenceFixture(): QueueStoreFixture {
  const dir = mkdtempSync(join(tmpdir(), 'jobs-contract-'));
  const file = join(dir, 'jobs.db');
  const connections: DatabaseSync[] = [];
  const open = (): DatabaseSync => {
    const db = new DatabaseSync(file);
    db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
    connections.push(db);
    return db;
  };
  const main = open();
  main.exec(SCHEMA);
  let next = 0;
  return {
    store: () => sqliteJobStore(open()),
    queueJob: (send) => dispatchJob(open(), send) as QueueJob<unknown>,
    itemId: (item) => (item as DispatchItem).id,
    addRow(row) {
      next += 1;
      const id = `d${String(next).padStart(3, '0')}`;
      main.prepare('INSERT INTO dispatch (id, key, partition_key, score, next_try_at, lease_owner, lease_until, send_started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, row.key, row.partition, row.score, row.nextTryAt, row.leaseOwner ?? null, row.leaseUntil ?? null, row.sendStartedAt ?? null);
      return id;
    },
    readRow(id) {
      const r = main.prepare('SELECT status, lease_owner, lease_until, send_started_at, delivery_uncertain, confirmation_after FROM dispatch WHERE id = ?').get(id)!;
      return {
        status: String(r.status), leaseOwner: r.lease_owner === null ? null : String(r.lease_owner), leaseUntil: num(r.lease_until),
        sendStartedAt: num(r.send_started_at), deliveryUncertain: Number(r.delivery_uncertain) === 1, confirmationAfter: num(r.confirmation_after),
      };
    },
    close() {
      for (const db of connections) db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describeJobStoreContract('reference SQLite store', referenceFixture);
describeQueueStoreContract('reference SQLite store', referenceFixture);

// Runner rules that do not depend on a store: parallelism, the job_run line, schedules and argument checks.
describe('job runner', () => {
  const T0 = Date.UTC(2026, 9, 22, 9, 0, 0);
  let lines: LogLine[];
  let logger: Logger;
  let fixture: QueueStoreFixture;
  let runners: JobRunner[];
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 5; i += 1) await new Promise<void>((resolve) => setImmediate(resolve));
  };
  const advance = async (ms: number): Promise<void> => {
    await vi.advanceTimersByTimeAsync(ms);
    await settle();
  };
  const runner = (instanceId = 'unit-1'): JobRunner => {
    const r = createJobRunner({ store: fixture.store(), logger, instanceId, bootId: 'boot-1', now: () => Date.now() });
    runners.push(r);
    return r;
  };
  const jobRuns = (): LogLine[] => lines.filter((l) => l.event === 'job_run');

  /** An in-memory queue job: each run waits until the test opens it. */
  function memoryQueue(name: string, partitions: string[], perPartition: number) {
    const items = partitions.flatMap((p) => Array.from({ length: perPartition }, (_, i) => ({ id: `${p}-${i}`, partition: p })));
    const leased = new Set<string>();
    const done = new Set<string>();
    const waiting = new Map<string, () => void>();
    const stats = { running: 0, maxRunning: 0, maxPerPartition: 0, contexts: [] as JobContext[] };
    const perPart = new Map<string, number>();
    const job: QueueJob<{ id: string; partition: string }> = {
      name,
      // Round-robin over partitions, as the stores give it.
      due: (_now, limit) => {
        const open = items.filter((i) => !leased.has(i.id) && !done.has(i.id));
        const turn = new Map<string, number>();
        return open.map((i) => {
          const t = turn.get(i.partition) ?? 0;
          turn.set(i.partition, t + 1);
          return { i, t };
        }).sort((a, b) => a.t - b.t).map((x) => x.i).slice(0, limit);
      },
      partition: (i) => i.partition,
      lease: (i) => {
        if (leased.has(i.id) || done.has(i.id)) return false;
        leased.add(i.id);
        return true;
      },
      release: (i) => { leased.delete(i.id); },
      recover: () => 0,
      run: async (i, ctx) => {
        stats.contexts.push(ctx);
        stats.running += 1;
        stats.maxRunning = Math.max(stats.maxRunning, stats.running);
        perPart.set(i.partition, (perPart.get(i.partition) ?? 0) + 1);
        stats.maxPerPartition = Math.max(stats.maxPerPartition, perPart.get(i.partition)!);
        await new Promise<void>((resolve) => waiting.set(i.id, resolve));
        perPart.set(i.partition, perPart.get(i.partition)! - 1);
        stats.running -= 1;
        done.add(i.id);
      },
    };
    const openAll = (): void => {
      for (const [id, resolve] of waiting) {
        waiting.delete(id);
        resolve();
      }
    };
    return { job, stats, done, waiting, openAll, total: items.length };
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: T0, toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    lines = [];
    logger = createLogger({ service: 'job-unit', dir: '', level: 'debug', write: (line) => lines.push(JSON.parse(line) as LogLine) });
    fixture = referenceFixture();
    runners = [];
  });
  afterEach(async () => {
    const stopped = runners.map((r) => r.stop());
    await vi.advanceTimersByTimeAsync(JOB_LEASE_MS);
    await Promise.all(stopped);
    vi.useRealTimers();
    fixture.close();
  });

  it('AC-LA-E4-01-03: at most `parallel` runs at once (default 4), one per partition; perPartition 2 is refused at addQueue', async () => {
    const q = memoryQueue('unit-queue', ['pa', 'pb', 'pc', 'pd', 'pe', 'pf'], 2);
    const r = runner();
    expect(() => r.addQueue({ ...q.job, name: 'unit-pp', limits: { perPartition: 2 } })).toThrow(/perPartition is fixed at 1/);
    expect(() => r.addQueue({ ...q.job, name: 'unit-par', limits: { parallel: 0 } })).toThrow(/parallel/);
    r.addQueue(q.job);
    r.start();
    await settle();
    expect(q.stats.running).toBe(JOB_PARALLEL);
    // The first round takes the first item of each of the four first partitions.
    expect([...q.waiting.keys()]).toEqual(['pa-0', 'pb-0', 'pc-0', 'pd-0']);
    await advance(3 * JOB_POLL_MS);
    expect(q.stats.running).toBe(JOB_PARALLEL);
    for (let round = 0; round < 6 && q.done.size < q.total; round += 1) {
      q.openAll();
      await advance(JOB_POLL_MS);
    }
    expect(q.done.size).toBe(q.total);
    expect(q.stats.maxRunning).toBe(JOB_PARALLEL);
    expect(q.stats.maxPerPartition).toBe(1);

    const q2 = memoryQueue('unit-two', ['pa', 'pb', 'pc'], 1);
    const r2 = runner('unit-2');
    r2.addQueue({ ...q2.job, limits: { parallel: 2 } });
    r2.start();
    await settle();
    expect(q2.stats.running).toBe(2);
  });

  it('AC-LA-E4-01-08: each run has its own trace id and one job_run line; an error logs its class name only', async () => {
    class SecretLeakError extends Error {}
    const q = memoryQueue('unit-queue', ['pa', 'pb'], 1);
    let fail = false;
    const r = runner();
    r.addQueue(q.job);
    r.addInterval({
      name: 'unit-interval', everyMs: null, runAtStart: false,
      run: async (ctx) => {
        expect(ctx.leaseOwner).toBe('unit-1/boot-1');
        if (fail) throw new SecretLeakError('token ltis_abcdefghijklmnop learner jane@example.test');
        return { result: 'ok', counts: { deleted: 3 } };
      },
    });
    r.start();
    await settle();
    await advance(250);
    q.openAll();
    await settle();
    expect(await r.runNow('unit-interval')).toEqual({ result: 'ok', counts: { deleted: 3 } });
    fail = true;
    expect(await r.runNow('unit-interval')).toEqual({ result: 'failed' });

    const runs = jobRuns();
    expect(runs).toHaveLength(4);
    const queueRuns = runs.filter((l) => l.job === 'unit-queue');
    expect(queueRuns.map((l) => l.trace_id).sort()).toEqual(q.stats.contexts.map((c) => c.traceId).sort());
    expect(queueRuns.every((l) => l.result === 'ok' && l.ms === 250 && l.level === 'info')).toBe(true);
    const [ok, failed] = runs.filter((l) => l.job === 'unit-interval');
    expect(ok).toMatchObject({ level: 'info', job: 'unit-interval', ms: 0, result: 'ok', counts: { deleted: 3 } });
    expect(ok).not.toHaveProperty('error');
    expect(failed).toMatchObject({ level: 'warn', job: 'unit-interval', result: 'failed', error: 'SecretLeakError' });
    expect(new Set(runs.map((l) => l.trace_id)).size).toBe(4);
    expect(runs.every((l) => typeof l.trace_id === 'string' && /^[0-9a-f]{32}$/.test(l.trace_id))).toBe(true);
    const text = JSON.stringify(lines);
    expect(text).not.toContain('ltis_');
    expect(text).not.toContain('jane@example.test');

    // A queue run that throws: failed, class name only. Its row stays due, but it runs again only at the next timed poll.
    const q2 = memoryQueue('unit-failing', ['pz'], 1);
    const r2 = runner('unit-2');
    r2.addQueue({ ...q2.job, run: async () => { throw new TypeError('secret detail'); } });
    r2.start();
    await settle();
    const failing = (): LogLine[] => jobRuns().filter((l) => l.job === 'unit-failing');
    expect(failing()).toEqual([expect.objectContaining({ level: 'warn', result: 'failed', error: 'TypeError' })]);
    await advance(JOB_POLL_MS);
    expect(failing()).toHaveLength(2);
    expect(JSON.stringify(lines)).not.toContain('secret detail');
  });

  it('interval jobs run at start and every everyMs, each run with one lease (25 min with 10 min: 3 runs)', async () => {
    let runs = 0;
    const r = runner();
    r.addInterval({ name: 'unit-retention', everyMs: 10 * 60_000, runAtStart: true, run: async () => { runs += 1; return { result: 'ok' }; } });
    r.addInterval({ name: 'unit-on-demand', everyMs: null, runAtStart: false, run: async () => ({ result: 'ok' }) });
    r.start();
    await settle();
    await advance(25 * 60_000);
    expect(runs).toBe(3);
    expect(jobRuns().filter((l) => l.job === 'unit-on-demand')).toEqual([]);
    expect(await fixture.store().readJobLease('unit-retention')).toMatchObject({ owner: null, lastRunAt: T0 + 20 * 60_000, lastResult: 'ok' });
  });

  it('kick polls a queue job at once; stop() aborts the signal of the runs in flight', async () => {
    const q = memoryQueue('unit-queue', ['pa'], 1);
    const r = runner();
    r.addQueue(q.job);
    r.kick('unit-queue');
    expect(q.stats.running).toBe(0);
    r.start();
    await settle();
    expect(q.stats.running).toBe(1);
    const signal = q.stats.contexts[0]!.signal;
    expect(signal.aborted).toBe(false);
    q.openAll();
    await settle();
    const stopped = r.stop();
    expect(signal.aborted).toBe(true);
    await stopped;
    expect(r.state()).toBe('off');
    r.kick('unit-queue');
    expect(await r.runNow('unit-none').catch((err: Error) => err.message)).toMatch(/Unknown interval job/);
  });

  it('checks names, the instance id and the add order', () => {
    expect(() => createJobRunner({ store: fixture.store(), logger, instanceId: 'app/1' })).toThrow(/instance id/);
    expect(() => createJobRunner({ store: fixture.store(), logger, instanceId: '' })).toThrow(/instance id/);
    const r = runner();
    const job = { name: 'unit-a', everyMs: null, runAtStart: false, run: async () => ({ result: 'ok' as const }) };
    r.addInterval(job);
    expect(() => r.addInterval(job)).toThrow(/already added/);
    expect(() => r.addInterval({ ...job, name: 'unit-b', everyMs: 0 })).toThrow(/everyMs/);
    expect(() => r.addInterval({ ...job, name: 'unit-b', everyMs: 30 * 86_400_000 })).toThrow(/everyMs/);
    expect(() => createJobRunner({ store: fixture.store(), logger, instanceId: 'unit-9', pollMs: 0 })).toThrow(/pollMs/);
    expect(() => r.kick('unit-a')).toThrow(/Unknown queue job/);
    expect(r.leaseOwner).toBe('unit-1/boot-1');
    r.start();
    expect(() => r.addInterval({ ...job, name: 'unit-c' })).toThrow(/before start/);
  });
});
