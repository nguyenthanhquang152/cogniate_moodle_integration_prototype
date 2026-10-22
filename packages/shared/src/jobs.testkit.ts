// Store-contract suite of the job runner (LA-ADR-03 D7; task LA-E4-01; Reviewer-A A-LAB-10). A service runs it on
// the job store that ships, on a temporary database:
// - LA-E4-02: describeJobStoreContract and describeQueueStoreContract on the app tables (job_instance, job_lease, and
//   record_dispatch with the outbox);
// - LA-E5-19: describeJobStoreContract on the LTI tables (the interval-lease part, AC-LA-E4-01-07).
// Test code only: it imports vitest, so index.ts does not export it. Import it by its path, for example
//   import { describeJobStoreContract } from '../../../../packages/shared/src/jobs.testkit.ts';
// The cases use a controlled clock: Vitest fake timers for Date, setTimeout and setInterval.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Awaitable, IntervalJob, JobContext, JobRole, JobRunner, JobStore, QueueJob } from './jobs.ts';
import { JOB_HEARTBEAT_MS, JOB_HEARTBEAT_STALE_MS, JOB_INSTANCE_RECHECK_MS, JOB_LEASE_MS, JOB_POLL_MS, createJobRunner } from './jobs.ts';
import type { Logger, LogLine } from './logger.ts';
import { createLogger } from './logger.ts';

export interface JobStoreFixture {
  /** A store on the test database of this fixture. The suite calls it once per runner (each may open its own connection). */
  store(): JobStore;
  /** Close the connections and remove the temporary files. */
  close(): Awaitable<void>;
}

/** A dispatch row for the queue cases. */
export interface ContractRow {
  /** Rows with the same key are one (placement, learner subject, reporter). */
  key: string;
  partition: string;
  /** The result value (score given / score maximum). A higher value is a better result. */
  score: number;
  nextTryAt: number;
  /** A row as another process left it. Default: no lease and no send marker. */
  leaseOwner?: string;
  leaseUntil?: number;
  sendStartedAt?: number;
}

export interface ContractRowState {
  status: string;
  leaseOwner: string | null;
  leaseUntil: number | null;
  sendStartedAt: number | null;
  deliveryUncertain: boolean;
  confirmationAfter: number | null;
}

export interface QueueStoreFixture extends JobStoreFixture {
  /**
   * The queue job (the outbox) for one runner, with limits at their defaults. Its run follows the outbox steps: a
   * row that is not current (a row of the same key has a higher score) sends nothing and becomes superseded; "send
   * began" is marked by the lease owner only; `send(id)` is the remote call (a resolved promise = accepted); the
   * result is recorded by the lease owner only, with the P2 confirmation rule (ADR-010).
   */
  queueJob(send: (id: string) => Promise<void>): QueueJob<unknown>;
  /** The row id of an item that `due` gave. */
  itemId(item: unknown): string;
  /** Add a pending row. Returns its id. */
  addRow(row: ContractRow): Awaitable<string>;
  readRow(id: string): Awaitable<ContractRowState>;
}

const T0 = Date.UTC(2026, 9, 22, 8, 0, 0);
const STALE = JOB_HEARTBEAT_STALE_MS;
const JOB = 'contract-interval';

interface Gate {
  promise: Promise<void>;
  open(): void;
}

/** Let the runner finish its async steps. The fake timers do not touch setImmediate. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await new Promise<void>((resolve) => setImmediate(resolve));
}

async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await settle();
}

/** Per-test state: the log lines, the runners and the closed gates (all are opened and stopped after the test). */
function harness() {
  const lines: LogLine[] = [];
  const logger: Logger = createLogger({ service: 'job-contract', dir: '', level: 'debug', write: (line) => lines.push(JSON.parse(line) as LogLine) });
  const runners: JobRunner[] = [];
  const gates: Gate[] = [];
  const gate = (): Gate => {
    let open!: () => void;
    const promise = new Promise<void>((resolve) => { open = resolve; });
    const g = { promise, open };
    gates.push(g);
    return g;
  };
  return {
    lines,
    logger,
    gate,
    conflicts: () => lines.filter((l) => l.event === 'job_instance_conflict'),
    runner(store: JobStore, o: { instanceId: string; bootId: string; role?: JobRole; onConflict?: () => void }): JobRunner {
      const r = createJobRunner({ store, logger, now: () => Date.now(), ...o });
      runners.push(r);
      return r;
    },
    /** A JobContext for a run that the test starts by hand (a process that stops later without stop()). */
    context(instanceId: string, bootId: string): JobContext {
      return { instanceId, bootId, leaseOwner: `${instanceId}/${bootId}`, traceId: 'contract-manual', now: () => Date.now(), logger, signal: new AbortController().signal };
    },
    /** An interval job that counts its runs; a set gate holds the next run. */
    probe(name: string, o: { runAtStart?: boolean; everyMs?: number | null } = {}) {
      const p: { runs: number; gate: Gate | null; job: IntervalJob } = { runs: 0, gate: null, job: undefined as unknown as IntervalJob };
      p.job = {
        name, everyMs: o.everyMs ?? null, runAtStart: o.runAtStart ?? false,
        run: async () => {
          p.runs += 1;
          if (p.gate) await p.gate.promise;
          return { result: 'ok', counts: { rows: 2 } };
        },
      };
      return p;
    },
    /** A remote call for a queue job: it records each call; hold(id) holds the next call of that row. */
    sender() {
      const calls: Array<{ id: string; at: number }> = [];
      const holds = new Map<string, Gate>();
      return {
        calls,
        ids: () => calls.map((c) => c.id),
        hold(id: string): Gate {
          const g = gate();
          holds.set(id, g);
          return g;
        },
        send: async (id: string): Promise<void> => {
          calls.push({ id, at: Date.now() });
          const g = holds.get(id);
          if (g) {
            holds.delete(id);
            await g.promise;
          }
        },
      };
    },
    async cleanUp(): Promise<void> {
      for (const g of gates) g.open();
      await settle();
      const stopped = runners.map((r) => r.stop());
      await vi.advanceTimersByTimeAsync(JOB_LEASE_MS);
      await Promise.all(stopped);
    },
  };
}

type Harness = ReturnType<typeof harness>;

function fakeTimers(): void {
  vi.useFakeTimers({ now: T0, toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
}

/** Heartbeat rows, interval leases, restart, conflict and stop rules (AC-LA-E4-01-04 to -07, -09). */
export function describeJobStoreContract(name: string, makeFixture: () => Awaitable<JobStoreFixture>): void {
  describe(`job store contract: ${name}`, () => {
    let f: JobStoreFixture;
    let h: Harness;
    beforeEach(async () => {
      fakeTimers();
      f = await makeFixture();
      h = harness();
    });
    afterEach(async () => {
      await h.cleanUp();
      vi.useRealTimers();
      await f.close();
    });

    it('heartbeat row: a free or 30 s old row can be claimed; heartbeat and delete only by its boot id', async () => {
      const s = f.store();
      expect(await s.claimInstance({ instanceId: 'contract-1', bootId: 'boot-1', role: 'web', now: T0 }, T0 - STALE)).toBe(true);
      expect(await s.readInstance('contract-1')).toEqual({ instanceId: 'contract-1', bootId: 'boot-1', role: 'web', startedAt: T0, heartbeatAt: T0 });
      expect(await s.claimInstance({ instanceId: 'contract-1', bootId: 'boot-2', role: 'worker', now: T0 + 1000 }, T0 + 1000 - STALE)).toBe(false);
      expect(await s.heartbeat('contract-1', 'boot-2', T0 + 2000)).toBe(false);
      expect(await s.heartbeat('contract-1', 'boot-1', T0 + 10_000)).toBe(true);
      expect((await s.readInstance('contract-1'))?.heartbeatAt).toBe(T0 + 10_000);
      const t = T0 + 10_000 + STALE;
      expect(await s.claimInstance({ instanceId: 'contract-1', bootId: 'boot-2', role: 'worker', now: t }, t - STALE)).toBe(true);
      expect(await s.readInstance('contract-1')).toEqual({ instanceId: 'contract-1', bootId: 'boot-2', role: 'worker', startedAt: t, heartbeatAt: t });
      await s.removeInstance('contract-1', 'boot-1');
      expect((await s.readInstance('contract-1'))?.bootId).toBe('boot-2');
      await s.removeInstance('contract-1', 'boot-2');
      expect(await s.readInstance('contract-1')).toBeNull();
    });

    it('AC-LA-E4-01-07: an interval run needs a free or expired single-run lease, else skipped_lease; runNow gives the result', async () => {
      const s = f.store();
      const p1 = h.probe(JOB);
      const p2 = h.probe(JOB);
      const r1 = h.runner(f.store(), { instanceId: 'contract-1', bootId: 'boot-1' });
      r1.addInterval(p1.job);
      const r2 = h.runner(f.store(), { instanceId: 'contract-2', bootId: 'boot-2' });
      r2.addInterval(p2.job);
      r1.start();
      r2.start();
      await settle();
      expect([r1.state(), r2.state()]).toEqual(['active', 'active']);

      p1.gate = h.gate();
      const first = r1.runNow(JOB);
      await settle();
      const held = await s.readJobLease(JOB);
      expect(held).toMatchObject({ name: JOB, owner: 'contract-1/boot-1', leaseUntil: T0 + JOB_LEASE_MS });
      // A second run while the first holds the lease: skipped_lease, and no change.
      expect(await r2.runNow(JOB)).toEqual({ result: 'skipped_lease' });
      expect(await r1.runNow(JOB)).toEqual({ result: 'skipped_lease' });
      expect([p1.runs, p2.runs]).toEqual([1, 0]);
      expect(await s.readJobLease(JOB)).toEqual(held);

      await advance(1000);
      p1.gate.open();
      p1.gate = null;
      expect(await first).toEqual({ result: 'ok', counts: { rows: 2 } });
      expect(await s.readJobLease(JOB)).toEqual({ name: JOB, owner: null, leaseUntil: null, lastRunAt: T0 + 1000, lastResult: 'ok' });

      // The lease of a crashed run blocks the job only until it expires.
      const crashedAt = Date.now();
      expect(await s.takeJobLease(JOB, 'contract-9/crashed', crashedAt, crashedAt + JOB_LEASE_MS)).toBe(true);
      expect(await r1.runNow(JOB)).toEqual({ result: 'skipped_lease' });
      await advance(JOB_LEASE_MS - 1);
      expect(await r2.runNow(JOB)).toEqual({ result: 'skipped_lease' });
      expect(p2.runs).toBe(0);
      await advance(1);
      expect(await r2.runNow(JOB)).toEqual({ result: 'ok', counts: { rows: 2 } });
      expect(await s.readJobLease(JOB)).toMatchObject({ owner: null, lastRunAt: crashedAt + JOB_LEASE_MS, lastResult: 'ok' });
      expect(h.lines.filter((l) => l.event === 'job_run').map((l) => l.result)).toEqual(['skipped_lease', 'skipped_lease', 'ok', 'skipped_lease', 'skipped_lease', 'ok']);
    });

    it('AC-LA-E4-01-04: after stop() a new start goes on at once; after a crash it waits until the old heartbeat is 30 s old', async () => {
      const s = f.store();
      const p1 = h.probe(JOB, { runAtStart: true });
      const r1 = h.runner(f.store(), { instanceId: 'contract-1', bootId: 'boot-1' });
      r1.addInterval(p1.job);
      r1.start();
      await settle();
      expect(r1.state()).toBe('active');
      expect(p1.runs).toBe(1);
      expect((await s.readInstance('contract-1'))?.bootId).toBe('boot-1');
      await r1.stop();
      expect(await s.readInstance('contract-1')).toBeNull();
      const p2 = h.probe(JOB, { runAtStart: true });
      const r2 = h.runner(f.store(), { instanceId: 'contract-1', bootId: 'boot-2' });
      r2.addInterval(p2.job);
      r2.start();
      await settle();
      expect(r2.state()).toBe('active');
      expect(p2.runs).toBe(1);

      // Crash: the process of boot-3 ends without stop(), so its row stays.
      const crashedAt = Date.now();
      expect(await s.claimInstance({ instanceId: 'contract-3', bootId: 'boot-3', role: 'web', now: crashedAt }, crashedAt - STALE)).toBe(true);
      await advance(1000);
      const p4 = h.probe('contract-crash', { runAtStart: true });
      const r4 = h.runner(f.store(), { instanceId: 'contract-3', bootId: 'boot-4' });
      r4.addInterval(p4.job);
      r4.start();
      await settle();
      expect(r4.state()).toBe('waiting');
      expect(await r4.runNow('contract-crash')).toEqual({ result: 'skipped_lease' });
      await advance(crashedAt + STALE - 1 - Date.now());
      expect(r4.state()).toBe('waiting');
      expect(p4.runs).toBe(0);
      expect(await s.readJobLease('contract-crash')).toBeNull();
      await advance(1 + JOB_INSTANCE_RECHECK_MS);
      expect(r4.state()).toBe('active');
      expect(p4.runs).toBe(1);
      expect((await s.readInstance('contract-3'))?.bootId).toBe('boot-4');
      expect(h.conflicts()).toEqual([]);
    });

    it('AC-LA-E4-01-05: a second live process with the same instance id gets job_instance_conflict and never takes a lease (worker: off)', async () => {
      const s = f.store();
      const r1 = h.runner(f.store(), { instanceId: 'contract-1', bootId: 'boot-1' });
      r1.addInterval(h.probe(JOB).job);
      r1.start();
      await settle();
      await advance(1000);
      const onConflict = vi.fn();
      const p2 = h.probe(JOB, { runAtStart: true, everyMs: 1000 });
      const r2 = h.runner(f.store(), { instanceId: 'contract-1', bootId: 'boot-2', role: 'worker', onConflict });
      r2.addInterval(p2.job);
      r2.start();
      await settle();
      expect(r2.state()).toBe('waiting');
      expect(await r2.runNow(JOB)).toEqual({ result: 'skipped_lease' });
      expect(h.conflicts()).toEqual([]);
      // The heartbeat of r1 moves; r2 sees it at its next check.
      await advance(JOB_HEARTBEAT_MS + JOB_INSTANCE_RECHECK_MS);
      expect(h.conflicts()).toEqual([expect.objectContaining({ level: 'error', instance_id: 'contract-1', role: 'worker' })]);
      expect(onConflict).toHaveBeenCalledTimes(1);
      expect(r2.state()).toBe('off');
      await advance(STALE);
      expect(p2.runs).toBe(0);
      expect(await s.readJobLease(JOB)).toBeNull();
      expect((await s.readInstance('contract-1'))?.bootId).toBe('boot-1');
      expect(r1.state()).toBe('active');
    });

    it('AC-LA-E4-01-05: a runner whose row another process took stops leasing', async () => {
      const p1 = h.probe(JOB, { everyMs: 1000 });
      const r1 = h.runner(f.store(), { instanceId: 'contract-1', bootId: 'boot-1' });
      r1.addInterval(p1.job);
      r1.start();
      await settle();
      await advance(1000);
      expect(p1.runs).toBe(1);
      // Another process takes the row, as after a stall of r1 of 30 s or more.
      const t = Date.now();
      expect(await f.store().claimInstance({ instanceId: 'contract-1', bootId: 'boot-x', role: 'web', now: t }, t)).toBe(true);
      await advance(JOB_HEARTBEAT_MS);
      expect(h.conflicts()).toHaveLength(1);
      expect(r1.state()).toBe('waiting');
      const runs = p1.runs;
      await advance(JOB_HEARTBEAT_MS);
      expect(p1.runs).toBe(runs);
      expect(await r1.runNow(JOB)).toEqual({ result: 'skipped_lease' });
    });

    it('AC-LA-E4-01-09: a web runner with job_instance_conflict keeps waiting without a lease and starts when the other heartbeat stops', async () => {
      const r1 = h.runner(f.store(), { instanceId: 'contract-1', bootId: 'boot-1' });
      r1.start();
      await settle();
      await advance(1000);
      const p3 = h.probe(JOB, { runAtStart: true });
      const r3 = h.runner(f.store(), { instanceId: 'contract-1', bootId: 'boot-3', role: 'web' });
      r3.addInterval(p3.job);
      r3.start();
      await advance(JOB_HEARTBEAT_MS + JOB_INSTANCE_RECHECK_MS);
      expect(h.conflicts()).toEqual([expect.objectContaining({ instance_id: 'contract-1', role: 'web' })]);
      expect(r3.state()).toBe('waiting');
      await advance(STALE);
      expect(h.conflicts()).toHaveLength(1);
      expect(p3.runs).toBe(0);
      expect(await r3.runNow(JOB)).toEqual({ result: 'skipped_lease' });
      await r1.stop();
      await advance(JOB_INSTANCE_RECHECK_MS);
      expect(r3.state()).toBe('active');
      expect(p3.runs).toBe(1);
    });

    it('AC-LA-E4-01-06: stop() deletes the heartbeat row only after the run in flight ends; a start in the grace time waits', async () => {
      const s = f.store();
      const p1 = h.probe(JOB);
      const r1 = h.runner(f.store(), { instanceId: 'contract-1', bootId: 'boot-1' });
      r1.addInterval(p1.job);
      r1.start();
      await settle();
      p1.gate = h.gate();
      const run = r1.runNow(JOB);
      await settle();
      let stopped = false;
      const stopping = r1.stop().then(() => { stopped = true; });
      await settle();
      expect(r1.state()).toBe('stopping');
      expect(await r1.runNow(JOB)).toEqual({ result: 'skipped_lease' });
      const row = await s.readInstance('contract-1');
      expect(row?.bootId).toBe('boot-1');
      const p2 = h.probe('contract-other', { runAtStart: true });
      const r2 = h.runner(f.store(), { instanceId: 'contract-1', bootId: 'boot-2' });
      r2.addInterval(p2.job);
      r2.start();
      // No heartbeat in the grace time: the row does not change, and r2 waits without a conflict.
      await advance(2 * JOB_HEARTBEAT_MS);
      expect(await s.readInstance('contract-1')).toEqual(row);
      expect(stopped).toBe(false);
      expect(r2.state()).toBe('waiting');
      p1.gate.open();
      expect(await run).toEqual({ result: 'ok', counts: { rows: 2 } });
      await stopping;
      expect(r1.state()).toBe('off');
      expect(await s.readInstance('contract-1')).toBeNull();
      await advance(JOB_INSTANCE_RECHECK_MS);
      expect(r2.state()).toBe('active');
      expect(p2.runs).toBe(1);
      expect(h.conflicts()).toEqual([]);
    });

    it('AC-LA-E4-01-06: stop() deletes the heartbeat row after leaseMs when a run does not end', async () => {
      const s = f.store();
      const p1 = h.probe(JOB);
      const r1 = h.runner(f.store(), { instanceId: 'contract-1', bootId: 'boot-1' });
      r1.addInterval(p1.job);
      r1.start();
      await settle();
      p1.gate = h.gate();
      void r1.runNow(JOB);
      await settle();
      let stopped = false;
      void r1.stop().then(() => { stopped = true; });
      await advance(JOB_LEASE_MS - 1);
      expect(stopped).toBe(false);
      expect((await s.readInstance('contract-1'))?.bootId).toBe('boot-1');
      await advance(1);
      expect(stopped).toBe(true);
      expect(await s.readInstance('contract-1')).toBeNull();
    });
  });
}

/** Lease, one in flight per key, fairness order and recovery on the queue store (AC-LA-E4-01-01 to -04, -10). */
export function describeQueueStoreContract(name: string, makeFixture: () => Awaitable<QueueStoreFixture>): void {
  describe(`queue store contract: ${name}`, () => {
    let f: QueueStoreFixture;
    let h: Harness;
    beforeEach(async () => {
      fakeTimers();
      f = await makeFixture();
      h = harness();
    });
    afterEach(async () => {
      await h.cleanUp();
      vi.useRealTimers();
      await f.close();
    });

    it('AC-LA-E4-01-01: one conditional update takes the lease; a second taker gets false; another boot id records nothing', async () => {
      const id = await f.addRow({ key: 'k1', partition: 'p1', score: 0.5, nextTryAt: T0 - 1000 });
      const a = h.sender();
      const jobA = f.queueJob(a.send);
      const jobB = f.queueJob(h.sender().send);
      const [itemA] = await jobA.due(T0, 10);
      const [itemB] = await jobB.due(T0, 10);
      expect(itemA === undefined || itemB === undefined).toBe(false);
      expect(f.itemId(itemA)).toBe(id);
      expect(jobA.partition(itemA)).toBe('p1');
      const until = T0 + JOB_LEASE_MS;
      expect(await jobA.lease(itemA, 'contract-1/boot-1', until, T0)).toBe(true);
      expect(await jobB.lease(itemB, 'contract-2/boot-2', until, T0)).toBe(false);
      expect(await f.readRow(id)).toMatchObject({ status: 'pending', leaseOwner: 'contract-1/boot-1', leaseUntil: until, sendStartedAt: null });
      expect(await jobB.due(T0, 10)).toEqual([]);
      await jobB.release(itemB, 'contract-2/boot-2');
      const leased = await f.readRow(id);
      expect(leased.leaseOwner).toBe('contract-1/boot-1');
      // An old process of the same instance id (another boot id) sends nothing and records nothing.
      await jobA.run(itemA, h.context('contract-1', 'boot-0'));
      expect(a.calls).toEqual([]);
      expect(await f.readRow(id)).toEqual(leased);
      await jobA.release(itemA, 'contract-1/boot-1');
      expect(await f.readRow(id)).toMatchObject({ leaseOwner: null, leaseUntil: null });

      // The runner: lease_owner = instance id + "/" + boot id, lease_until = now + leaseMs.
      const r = h.sender();
      r.hold(id);
      const runner = h.runner(f.store(), { instanceId: 'contract-3', bootId: 'boot-3' });
      runner.addQueue(f.queueJob(r.send));
      runner.start();
      await settle();
      expect(r.ids()).toEqual([id]);
      expect(await f.readRow(id)).toMatchObject({ status: 'pending', leaseOwner: 'contract-3/boot-3', leaseUntil: T0 + JOB_LEASE_MS, sendStartedAt: T0 });
    });

    it('AC-LA-E4-01-02: two runners, two due rows of one key: one lease at a time; the higher row only after the lower row has a result', async () => {
      const low = await f.addRow({ key: 'k1', partition: 'p1', score: 0.4, nextTryAt: T0 - 2000 });
      const high = await f.addRow({ key: 'k1', partition: 'p1', score: 0.8, nextTryAt: T0 - 1000 });
      const s1 = h.sender();
      const s2 = h.sender();
      const ids = [low, high];
      // The rows of the key when a send starts.
      const atSend = new Map<string, ContractRowState[]>();
      const watch = (send: (id: string) => Promise<void>) => async (id: string): Promise<void> => {
        atSend.set(id, await Promise.all(ids.map((x) => f.readRow(x))));
        await send(id);
      };
      const inFlight = async (): Promise<number> => (await Promise.all(ids.map((x) => f.readRow(x)))).filter((r) => r.leaseOwner !== null || r.sendStartedAt !== null).length;
      const r1 = h.runner(f.store(), { instanceId: 'contract-1', bootId: 'boot-1' });
      r1.addQueue(f.queueJob(watch(s1.send)));
      const r2 = h.runner(f.store(), { instanceId: 'contract-2', bootId: 'boot-2' });
      r2.addQueue(f.queueJob(watch(s2.send)));
      const gates = [s1.hold(high), s2.hold(high)];
      // Both runners start and poll at T0, when both rows are due.
      r1.start();
      r2.start();
      await settle();
      const calls = (): string[] => [...s1.ids(), ...s2.ids()];
      // The lower row is not current: it sends nothing and gets its result (superseded); only then the higher row gets the lease.
      expect(calls()).toEqual([high]);
      expect(await inFlight()).toBe(1);
      expect(atSend.get(high)![0]).toMatchObject({ leaseOwner: null, sendStartedAt: null });
      expect(atSend.get(high)![0]!.status).not.toBe('pending');

      // A better result comes while the send of `high` is in flight: it waits for the result of `high`.
      const higher = await f.addRow({ key: 'k1', partition: 'p1', score: 0.9, nextTryAt: T0 });
      ids.push(higher);
      await advance(5 * JOB_POLL_MS);
      expect(await inFlight()).toBe(1);
      expect((await f.readRow(higher)).leaseOwner).toBeNull();
      expect(calls()).toEqual([high]);
      for (const g of gates) g.open();
      await advance(JOB_POLL_MS);
      expect(calls()).toEqual([high, higher]);
      expect(atSend.get(higher)![1]).toMatchObject({ leaseOwner: null, sendStartedAt: null });
      expect(await f.readRow(higher)).toMatchObject({ status: 'sent', leaseOwner: null, sendStartedAt: null });
    });

    it('AC-LA-E4-01-03: due gives rows round-robin over partitions, the oldest next_try_at first inside a partition', async () => {
      const add = (key: string, partition: string, nextTryAt: number) => f.addRow({ key, partition, score: 0.5, nextTryAt });
      const a1 = await add('ka1', 'pa', T0 - 30_000);
      const a3 = await add('ka3', 'pa', T0 - 10_000);
      const a2 = await add('ka2', 'pa', T0 - 20_000);
      const b2 = await add('kb2', 'pb', T0 - 5_000);
      const b1 = await add('kb1', 'pb', T0 - 25_000);
      const c1 = await add('kc1', 'pc', T0 - 1_000);
      // Not due: a later row, and a row with a live lease of another process.
      await add('kf', 'pa', T0 + 60_000);
      await f.addRow({ key: 'kl', partition: 'pb', score: 0.5, nextTryAt: T0 - 40_000, leaseOwner: 'contract-9/boot-9', leaseUntil: T0 + 30_000 });
      const job = f.queueJob(h.sender().send);
      const ids = async (limit: number): Promise<string[]> => (await job.due(T0, limit)).map((item) => f.itemId(item));
      const all = await ids(20);
      expect(all).toHaveLength(6);
      expect(new Set(all.slice(0, 3))).toEqual(new Set([a1, b1, c1]));
      expect(new Set(all.slice(3, 5))).toEqual(new Set([a2, b2]));
      expect(all[5]).toBe(a3);
      // The limit cuts after the first round, so each partition gets its turn.
      expect(new Set(await ids(3))).toEqual(new Set([a1, b1, c1]));
    });

    it('AC-LA-E4-01-04: a start recovers at once the rows of its instance id, expired leases and rows without an owner; a live lease of another instance stays', async () => {
      const marked = { sendStartedAt: T0 - 10_000 };
      const own = await f.addRow({ key: 'k1', partition: 'p1', score: 0.5, nextTryAt: T0 - 5000, leaseOwner: 'contract-1/boot-old', leaseUntil: T0 + 50_000, ...marked });
      const other = await f.addRow({ key: 'k2', partition: 'p1', score: 0.5, nextTryAt: T0 - 5000, leaseOwner: 'contract-2/boot-2', leaseUntil: T0 + 50_000, ...marked });
      const expired = await f.addRow({ key: 'k3', partition: 'p2', score: 0.5, nextTryAt: T0 - 5000, leaseOwner: 'contract-2/boot-2', leaseUntil: T0 - 1, ...marked });
      const copied = await f.addRow({ key: 'k4', partition: 'p3', score: 0.5, nextTryAt: T0 - 5000, ...marked });
      const otherBefore = await f.readRow(other);
      const runner = h.runner(f.store(), { instanceId: 'contract-1', bootId: 'boot-new' });
      runner.addQueue(f.queueJob(h.sender().send));
      runner.start();
      await settle();
      expect(runner.state()).toBe('active');
      for (const id of [own, expired, copied]) {
        expect(await f.readRow(id)).toMatchObject({ deliveryUncertain: true, sendStartedAt: null, leaseOwner: null });
      }
      expect(await f.readRow(other)).toEqual(otherBefore);
      // The running recovery marks it at the first due poll after its lease expired (Reviewer-A A-LAB-11).
      await advance(50_000 + JOB_POLL_MS);
      expect(await f.readRow(other)).toMatchObject({ deliveryUncertain: true, sendStartedAt: null });
    });

    it('AC-LA-E4-01-04: after a crash a new start takes no lease and recovers nothing until the old heartbeat is 30 s old; the late result of the old boot id changes no row', async () => {
      const s = f.store();
      expect(await s.claimInstance({ instanceId: 'contract-1', bootId: 'boot-old', role: 'web', now: T0 }, T0 - STALE)).toBe(true);
      const inFlight = await f.addRow({ key: 'k1', partition: 'p1', score: 0.5, nextTryAt: T0 - 5000 });
      // The old process leased the row and started its send; then it crashed (no stop()).
      const old = h.sender();
      const late = old.hold(inFlight);
      const jobOld = f.queueJob(old.send);
      const [item] = await jobOld.due(T0, 10);
      expect(await jobOld.lease(item, 'contract-1/boot-old', T0 + JOB_LEASE_MS, T0)).toBe(true);
      const lateRun = jobOld.run(item, h.context('contract-1', 'boot-old'));
      await settle();
      expect(old.ids()).toEqual([inFlight]);
      const due = await f.addRow({ key: 'k2', partition: 'p2', score: 0.5, nextTryAt: T0 });
      await advance(1000);
      const snd = h.sender();
      const runner = h.runner(s, { instanceId: 'contract-1', bootId: 'boot-new' });
      runner.addQueue(f.queueJob(snd.send));
      runner.start();
      await settle();
      expect(runner.state()).toBe('waiting');
      const waiting = await f.readRow(inFlight);
      await advance(STALE - 1000 - 1);
      expect(runner.state()).toBe('waiting');
      expect(snd.calls).toEqual([]);
      expect(await f.readRow(inFlight)).toEqual(waiting);
      expect((await f.readRow(due)).leaseOwner).toBeNull();
      await advance(1 + JOB_INSTANCE_RECHECK_MS);
      expect(runner.state()).toBe('active');
      expect(await f.readRow(inFlight)).toMatchObject({ status: 'pending', deliveryUncertain: true, sendStartedAt: null, leaseOwner: null });
      expect(snd.ids()).toContain(due);
      // The send of the old boot id ends late: its result is refused.
      const before = await f.readRow(inFlight);
      late.open();
      await lateRun;
      expect(await f.readRow(inFlight)).toEqual(before);
    });

    it('AC-LA-E4-01-10: a running runner recovers an expired lease of another instance; the higher row follows the P2 confirmation rule; a late result changes no row', async () => {
      const low = await f.addRow({ key: 'k1', partition: 'p1', score: 0.4, nextTryAt: T0 - 2000 });
      // Runner B (instance contract-2) leases the row, starts its send, and then stops without stop().
      const b = h.sender();
      const late = b.hold(low);
      const jobB = f.queueJob(b.send);
      const [first] = await jobB.due(T0, 10);
      expect(f.itemId(first)).toBe(low);
      expect(await jobB.lease(first, 'contract-2/boot-b', T0 + JOB_LEASE_MS, T0)).toBe(true);
      const lateRun = jobB.run(first, h.context('contract-2', 'boot-b'));
      await settle();
      expect(b.ids()).toEqual([low]);
      expect((await f.readRow(low)).sendStartedAt).toBe(T0);
      // A better result of the same key comes while that send is in flight.
      const high = await f.addRow({ key: 'k1', partition: 'p1', score: 0.8, nextTryAt: T0 });

      // Runner A keeps running.
      const a = h.sender();
      const runnerA = h.runner(f.store(), { instanceId: 'contract-1', bootId: 'boot-a' });
      runnerA.addQueue(f.queueJob(a.send));
      runnerA.start();
      await settle();
      await advance(JOB_LEASE_MS - 1);
      expect(a.calls).toEqual([]);
      expect((await f.readRow(high)).leaseOwner).toBeNull();
      expect(await f.readRow(low)).toMatchObject({ leaseOwner: 'contract-2/boot-b', sendStartedAt: T0, deliveryUncertain: false });
      // The next due poll of A after leaseMs: B's row becomes uncertain, and the higher row is sent.
      await advance(JOB_POLL_MS);
      expect(await f.readRow(low)).toMatchObject({ deliveryUncertain: true, sendStartedAt: null, leaseOwner: null });
      const highSends = () => a.calls.filter((c) => c.id === high);
      expect(highSends()).toHaveLength(1);
      const acceptedAt = highSends()[0]!.at;
      const afterFirst = await f.readRow(high);
      expect(afterFirst.status).toBe('pending');
      expect(afterFirst.confirmationAfter).toBeGreaterThanOrEqual(acceptedAt + 5000);
      // P2: exactly one confirmation send, at least 5 s after the first accepted send.
      await advance(5000 + 2 * JOB_POLL_MS);
      expect(highSends()).toHaveLength(2);
      expect(highSends()[1]!.at).toBeGreaterThanOrEqual(acceptedAt + 5000);
      expect(await f.readRow(high)).toMatchObject({ status: 'sent', deliveryUncertain: false, sendStartedAt: null });
      await advance(10 * JOB_POLL_MS);
      expect(highSends()).toHaveLength(2);

      // The late result of B changes no row.
      const before = [await f.readRow(low), await f.readRow(high)];
      late.open();
      await lateRun;
      expect([await f.readRow(low), await f.readRow(high)]).toEqual(before);
    });
  });
}
