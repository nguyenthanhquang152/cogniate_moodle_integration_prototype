// Job runner for both services (LA-ADR-03 D7, task LA-E4-01). Each service process has one runner. It runs queue
// jobs (the app outbox: leases, one send in flight per key, fairness over partitions, bounded parallelism) and
// interval jobs (retention and the E5 jobs: one single-run lease per job name).
// The runner creates no table. Each service implements JobStore on its job_instance and job_lease tables, and each
// queue job brings its own due, lease, release and recovery statements. The store-contract suite in jobs.testkit.ts
// checks an implementation; LA-E4-02 (app) and LA-E5-19 (LTI service) run it on the stores that ship.
// State      Event                                      Next state
// idle       start()                                    waiting
// waiting    free or stale instance row claimed         active
// waiting    row still live, or store error             waiting
// active     instance row lost                          waiting (web), off (worker)
// waiting    another live process confirmed             waiting (web), off (worker)
// waiting / active  stop()                              stopping
// stopping   runs end, or longest lease time ends       off
// idle       stop()                                     off
// off        any start() or stop()                      off
import { randomBytes } from 'node:crypto';
import type { Logger } from './logger.ts';

/** A store may be synchronous (node:sqlite) or async (a later async storage port, LA-E5-23). */
export type Awaitable<T> = T | Promise<T>;

/** Default lease time. It is above every outbound timeout of the app (5 s by default, 15 s at most). */
export const JOB_LEASE_MS = 60_000;
/** Default number of queue runs at the same time, over all partitions of one queue job. */
export const JOB_PARALLEL = 4;
/** Queue poll interval (the score worker of M1 also polled every 2 s). */
export const JOB_POLL_MS = 2_000;
/** The runner writes its heartbeat at this interval. */
export const JOB_HEARTBEAT_MS = 10_000;
/** A heartbeat this old or older belongs to a process that is gone. */
export const JOB_HEARTBEAT_STALE_MS = 30_000;
/** While another live process holds the instance id, the runner checks again at this interval. */
export const JOB_INSTANCE_RECHECK_MS = 5_000;
/** Minimum number of rows that one poll asks `due` for. */
const DUE_BATCH = 20;
/** Longest timer delay of Node (about 24.8 days). Node runs a longer delay after 1 ms. */
const MAX_TIMER_MS = 2_147_483_647;
/** A thrown row error starts at 2 s and doubles, up to 5 min (BD-A1-10). */
const ITEM_COOLDOWN_MS = 2_000;
const MAX_ITEM_COOLDOWN_MS = 5 * 60_000;

export type JobRole = 'web' | 'worker';

export interface JobContext {
  instanceId: string;
  bootId: string;
  /** Instance id + "/" + boot id: the lease owner of this process. Only this owner may record a result. */
  leaseOwner: string;
  /** A new trace id for each run. */
  traceId: string;
  now(): number;
  logger: Logger;
  /** Aborts when the runner stops or loses its instance id. A run then ends at its next safe point. */
  signal: AbortSignal;
}

export interface JobRunResult {
  result: 'ok' | 'failed';
  counts?: Record<string, number>;
}

export type RunNowResult = JobRunResult | { result: 'skipped_lease' };

export interface QueueLimits {
  /** Runs at the same time over all partitions (default 4). */
  parallel: number;
  /** Fixed at 1 for best-result reporters; addQueue refuses another value. */
  perPartition: number;
  /** Lease time of one run (default 60 s). */
  leaseMs: number;
}

/**
 * Input of the recovery hook. Recovery marks a row with a send marker (send_started_at) as delivery_uncertain = 1,
 * clears the marker and clears the lease, so that a late result of the old owner changes no row.
 * - 'start' (the runner may start): every row with a marker and no live lease of another instance: a lease of this
 *   instance id (any boot id), an expired lease, or no lease owner (for example a row that migration 014 copied).
 * - 'running' (before each due poll, Reviewer-A A-LAB-11): every row with a marker whose lease has expired or has no
 *   owner, except a row of `leaseOwner` (a run of this process is still in flight).
 */
export interface RecoveryScope {
  mode: 'start' | 'running';
  instanceId: string;
  leaseOwner: string;
  now: number;
}

export interface QueueJob<Item> {
  /** For example 'record-dispatch'. */
  name: string;
  /**
   * Due rows without a live lease, round-robin over partitions, the oldest next_try_at first inside a partition.
   * Do the round-robin in the query (for example ROW_NUMBER() OVER (PARTITION BY partition_key ...)), so that the
   * limit does not hide the other partitions.
   */
  due(now: number, limit: number): Awaitable<Item[]>;
  /** Fairness key (lti-ags: the LTI platform id, or platform id + ":" + deployment id for a shared platform). */
  partition(item: Item): string;
  /** Stable row id within this queue. A thrown run cools this row, not its partition. */
  id(item: Item): string;
  /**
   * One conditional update: lease_owner = owner and lease_until = until, only when the row has no live lease and no
   * send marker, and (one in flight per key, Reviewer-A A-LAD-03) no other row with the same key has a live lease or
   * a send marker. Returns false when the update changed no row.
   */
  lease(item: Item, owner: string, until: number, now: number): Awaitable<boolean>;
  /** Clear the lease when `owner` still holds it. The runner calls it after each run. */
  release(item: Item, owner: string): Awaitable<void>;
  /** Recovery hook (see RecoveryScope). Returns the number of rows that it marked. */
  recover(scope: RecoveryScope): Awaitable<number>;
  /**
   * Send one leased row. A result write must check the lease owner (ctx.leaseOwner). A run must move its row (a
   * result, a later next_try_at, or an end status such as superseded): the runner polls again as soon as a run ends.
   * Catch row errors and move the row by the normal retry policy. If a run still throws, the runner skips that
   * item for 2 s, doubled after each next throw, up to 5 min. A run that does not throw clears this backstop.
   */
  run(item: Item, ctx: JobContext): Promise<void>;
  limits?: Partial<QueueLimits>;
}

export interface IntervalJob {
  /** For example 'retention', 'audit-retention', 'key-rewrap'. */
  name: string;
  /** null: on demand only (runNow). */
  everyMs: number | null;
  /** Run once when the runner starts. */
  runAtStart: boolean;
  /** Single-run lease time (default 60 s). Make it longer than the longest run. A crashed run blocks the job for at most this time. */
  leaseMs?: number;
  run(ctx: JobContext): Promise<JobRunResult>;
}

export interface JobInstanceRow {
  instanceId: string;
  bootId: string;
  role: JobRole;
  startedAt: number;
  heartbeatAt: number;
}

export interface JobLeaseRow {
  name: string;
  owner: string | null;
  leaseUntil: number | null;
  lastRunAt: number | null;
  lastResult: string | null;
}

/** The runner's statements on the job_instance and job_lease tables (data-model §3). */
export interface JobStore {
  readInstance(instanceId: string): Awaitable<JobInstanceRow | null>;
  /**
   * One conditional write: insert the row, or replace a row whose heartbeat_at <= staleBefore. Set started_at and
   * heartbeat_at to `now`. Returns true when the row is now the row of this boot id.
   */
  claimInstance(row: { instanceId: string; bootId: string; role: JobRole; now: number }, staleBefore: number): Awaitable<boolean>;
  /** heartbeat_at = now for the row of this instance id and boot id. Returns false when no such row exists. */
  heartbeat(instanceId: string, bootId: string, now: number): Awaitable<boolean>;
  /** Delete the row of this instance id only when it still has this boot id. */
  removeInstance(instanceId: string, bootId: string): Awaitable<void>;
  readJobLease(name: string): Awaitable<JobLeaseRow | null>;
  /** One conditional write: insert the row, or take a row whose lease is free or expired. False when another owner has a live lease. */
  takeJobLease(name: string, owner: string, now: number, until: number): Awaitable<boolean>;
  /** Free the lease of `owner` and set last_run_at and last_result. No change when another owner has the lease. */
  endJobLease(name: string, owner: string, at: number, result: JobRunResult['result']): Awaitable<void>;
}

export interface JobRunnerOptions {
  store: JobStore;
  logger: Logger;
  /** JOB_INSTANCE_ID (default of the services: app-1, lti-1). Format: ^[A-Za-z0-9-]{1,64}$. */
  instanceId: string;
  /** 'web' (default): the runner in the web process. 'worker': the runner alone (npm run worker, LA-E4-05). */
  role?: JobRole;
  /** Clock (default Date.now). Tests give a controlled clock. */
  now?: () => number;
  /** Queue poll interval (default 2 s). */
  pollMs?: number;
  /** Default: a random id. Tests give a fixed id. */
  bootId?: string;
  /** A worker runner calls it after job_instance_conflict. The worker entry gives () => process.exit(1). */
  onConflict?: () => void;
}

/** idle: not started; waiting: checks the instance row; active: leases and runs; stopping: drains; off: finished. */
export type JobRunnerState = 'idle' | 'waiting' | 'active' | 'stopping' | 'off';

export interface JobRunner {
  readonly instanceId: string;
  readonly bootId: string;
  readonly leaseOwner: string;
  addQueue<Item>(job: QueueJob<Item>): void;
  addInterval(job: IntervalJob): void;
  /** The on-demand trigger. An operator request may supply its trace id for the run and its logs. */
  runNow(name: string, options?: { traceId?: string }): Promise<RunNowResult>;
  /** Poll a queue job now (for example after a new dispatch row). No effect when the runner is not active. */
  kick(name: string): void;
  start(): void;
  /** Stop leasing, wait for the runs in flight (at most the longest lease time), then delete the heartbeat row. */
  stop(): Promise<void>;
  state(): JobRunnerState;
}

interface QueueState {
  job: QueueJob<unknown>;
  limits: QueueLimits;
  /** Partitions with a run in flight in this process (perPartition = 1). */
  busy: Set<string>;
  /** Row backoff lives only in this runner. Keep the delay after expiry until the row runs without a throw. */
  cooling: Map<string, { until: number; delayMs: number }>;
  running: number;
  polling: boolean;
  again: boolean;
}

interface IntervalState {
  job: IntervalJob;
  running: boolean;
}

type SkippedLeaseReason = 'runner_not_active' | 'already_running' | 'lease_held';

/** The class name of an error, never its message (the message can hold secrets or personal data). */
function errorClass(err: unknown): string {
  if (err instanceof Error) return err.constructor.name || err.name;
  return typeof err;
}

const newTraceId = (): string => randomBytes(16).toString('hex');

export function createJobRunner(options: JobRunnerOptions): JobRunner {
  const { store, logger: log, instanceId } = options;
  if (instanceId.length < 1 || instanceId.length > 64 || /[^A-Za-z0-9-]/.test(instanceId)) {
    throw new Error('The job instance id must have 1 to 64 letters, digits or hyphens.');
  }
  const role = options.role ?? 'web';
  const now = options.now ?? Date.now;
  const pollMs = options.pollMs ?? JOB_POLL_MS;
  if (!(pollMs > 0 && pollMs <= MAX_TIMER_MS)) throw new Error(`pollMs must be above 0 (got ${pollMs}).`);
  const bootId = options.bootId ?? randomBytes(8).toString('hex');
  const leaseOwner = `${instanceId}/${bootId}`;
  const queues = new Map<string, QueueState>();
  const intervals = new Map<string, IntervalState>();
  const inflight = new Set<Promise<unknown>>();
  const activeTimers = new Set<NodeJS.Timeout>();
  let state: JobRunnerState = 'idle';
  let controller = new AbortController();
  let waitTimer: NodeJS.Timeout | null = null;
  // The row of the other process while this runner waits; a change of it means a second live process.
  let seen: { bootId: string; heartbeatAt: number } | null = null;
  let conflicted = false;
  let stopping: Promise<void> | null = null;

  const track = <T>(p: Promise<T>): Promise<T> => {
    inflight.add(p);
    void p.finally(() => inflight.delete(p)).catch(() => undefined);
    return p;
  };
  const context = (traceId: string): JobContext => ({ instanceId, bootId, leaseOwner, traceId, now, logger: log, signal: controller.signal });
  const internalError = (path: string, step: string, err: unknown, traceId?: string): void => {
    log.error('internal_error', { trace_id: traceId ?? log.bootTraceId, method: 'JOB', path, step, error: errorClass(err) });
  };
  const logRun = (job: string, traceId: string, startedAt: number, result: RunNowResult['result'], counts?: Record<string, number>, error?: string, reason?: SkippedLeaseReason): void => {
    const fields = { trace_id: traceId, job, ms: Math.max(0, now() - startedAt), result, ...(counts ? { counts } : {}), ...(error ? { error } : {}), ...(reason ? { reason } : {}) };
    if (result === 'failed') log.warn('job_run', fields);
    else log.info('job_run', fields);
  };

  function assertNew(name: string): void {
    if (state !== 'idle') throw new Error(`Add job ${name} before start().`);
    if (queues.has(name) || intervals.has(name)) throw new Error(`Job ${name} is already added.`);
  }

  function addQueue<Item>(job: QueueJob<Item>): void {
    assertNew(job.name);
    const perPartition = job.limits?.perPartition ?? 1;
    if (perPartition !== 1) throw new Error(`perPartition is fixed at 1 for a queue job (job ${job.name}, got ${perPartition}).`);
    const parallel = job.limits?.parallel ?? JOB_PARALLEL;
    if (!Number.isInteger(parallel) || parallel < 1) throw new Error(`parallel must be a whole number of 1 or more (job ${job.name}, got ${parallel}).`);
    const leaseMs = job.limits?.leaseMs ?? JOB_LEASE_MS;
    if (!(leaseMs > 0 && leaseMs <= MAX_TIMER_MS)) throw new Error(`leaseMs must be above 0 and at most ${MAX_TIMER_MS} (job ${job.name}).`);
    queues.set(job.name, { job: job as QueueJob<unknown>, limits: { parallel, perPartition, leaseMs }, busy: new Set(), cooling: new Map(), running: 0, polling: false, again: false });
  }

  function addInterval(job: IntervalJob): void {
    assertNew(job.name);
    if (job.everyMs !== null && !(job.everyMs > 0 && job.everyMs <= MAX_TIMER_MS)) throw new Error(`everyMs must be null, or above 0 and at most ${MAX_TIMER_MS} (job ${job.name}).`);
    if (job.leaseMs !== undefined && !(job.leaseMs > 0 && job.leaseMs <= MAX_TIMER_MS)) throw new Error(`leaseMs must be above 0 and at most ${MAX_TIMER_MS} (job ${job.name}).`);
    intervals.set(job.name, { job, running: false });
  }

  function every(ms: number, fn: () => void): void {
    activeTimers.add(setInterval(fn, ms));
  }

  /** Stop all work of the active phase: timers, and the signal of the runs in flight. */
  function deactivate(): void {
    for (const t of activeTimers) clearInterval(t);
    activeTimers.clear();
    controller.abort();
  }

  function scheduleCheck(): void {
    waitTimer = setTimeout(() => void track(check()), JOB_INSTANCE_RECHECK_MS);
  }

  function conflict(): void {
    conflicted = true;
    log.error('job_instance_conflict', { instance_id: instanceId, role });
    deactivate();
    if (role === 'worker') {
      // The worker process exits 1 (B-LAD-09).
      state = 'off';
      if (waitTimer) clearTimeout(waitTimer);
      waitTimer = null;
      options.onConflict?.();
    } else if (state === 'active') {
      // The web process keeps serving; its runner waits without a lease until the other heartbeat stops (Could, B round 3).
      state = 'waiting';
      seen = null;
      scheduleCheck();
    }
  }

  /** Instance id rule (Q-LAD-23): start when the row is gone or its heartbeat is 30 s old; else wait and check every 5 s. */
  async function check(): Promise<void> {
    waitTimer = null;
    if (state !== 'waiting') return;
    try {
      const t = now();
      const row = await store.readInstance(instanceId);
      if (state !== 'waiting') return;
      if (row === null || t - row.heartbeatAt >= JOB_HEARTBEAT_STALE_MS) {
        if (await store.claimInstance({ instanceId, bootId, role, now: t }, t - JOB_HEARTBEAT_STALE_MS)) {
          if (state === 'waiting') return await activate();
          await store.removeInstance(instanceId, bootId);
          return;
        }
      } else if (seen === null) {
        seen = { bootId: row.bootId, heartbeatAt: row.heartbeatAt };
        if (!conflicted) log.warn('job_instance_wait', { instance_id: instanceId, role });
      } else if (row.bootId !== seen.bootId || row.heartbeatAt !== seen.heartbeatAt) {
        // The other heartbeat moved after this runner started: a second live process has the same instance id.
        seen = { bootId: row.bootId, heartbeatAt: row.heartbeatAt };
        if (!conflicted) conflict();
      }
    } catch (err) {
      internalError('job_instance', 'check', err);
    }
    if (state === 'waiting') scheduleCheck();
  }

  async function activate(): Promise<void> {
    state = 'active';
    seen = null;
    conflicted = false;
    controller = new AbortController();
    let recovered = 0;
    for (const q of queues.values()) recovered += await recoverQueue(q, 'start');
    if (state !== 'active') return;
    log.info('job_runner_started', { instance_id: instanceId, boot_id: bootId, role, recovered });
    every(JOB_HEARTBEAT_MS, () => void track(beat()));
    for (const q of queues.values()) {
      every(pollMs, () => void poll(q));
      void poll(q);
    }
    for (const s of intervals.values()) {
      if (s.job.everyMs !== null) every(s.job.everyMs, () => void runInterval(s));
      if (s.job.runAtStart) void runInterval(s);
    }
  }

  async function beat(): Promise<void> {
    if (state !== 'active') return;
    let ok: boolean;
    try {
      ok = await store.heartbeat(instanceId, bootId, now());
    } catch (err) {
      internalError('job_instance', 'heartbeat', err);
      return;
    }
    // The row is gone or has another boot id: another process took the instance id (for example after a long stall).
    if (!ok && state === 'active') conflict();
  }

  async function recoverQueue(q: QueueState, mode: RecoveryScope['mode']): Promise<number> {
    try {
      const rows = await q.job.recover({ mode, instanceId, leaseOwner, now: now() });
      if (rows > 0) log.warn('job_recovered', { job: q.job.name, mode, rows });
      return rows;
    } catch (err) {
      internalError(q.job.name, 'recover', err);
      return 0;
    }
  }

  function poll(q: QueueState): Promise<void> {
    if (state !== 'active') return Promise.resolve();
    if (q.polling) {
      q.again = true;
      return Promise.resolve();
    }
    q.polling = true;
    return track((async () => {
      try {
        do {
          q.again = false;
          if (q.running >= q.limits.parallel) break;
          await recoverQueue(q, 'running');
          if (state !== 'active') break;
          // Ask past the cooled rows, so a full batch of them cannot hide healthy work.
          const limit = Math.max(DUE_BATCH, q.limits.parallel * 2) + q.cooling.size;
          const items = await q.job.due(now(), limit);
          // A complete due set proves that an absent row moved or was removed. Keep cooling for every returned
          // row, including expired entries: a repeated throw must still double its backoff.
          if (items.length < limit && q.cooling.size) {
            const dueIds = new Set(items.map((item) => q.job.id(item)));
            for (const id of q.cooling.keys()) if (!dueIds.has(id)) q.cooling.delete(id);
          }
          for (const item of items) {
            if (state !== 'active' || q.running >= q.limits.parallel) break;
            const partition = q.job.partition(item);
            if (q.busy.has(partition)) continue;
            const id = q.job.id(item);
            const t = now();
            if ((q.cooling.get(id)?.until ?? -Infinity) > t) continue;
            if (!(await q.job.lease(item, leaseOwner, t + q.limits.leaseMs, t))) continue;
            if (state !== 'active') {
              await q.job.release(item, leaseOwner);
              break;
            }
            startRun(q, item, partition, id);
          }
        } while (q.again && state === 'active');
      } catch (err) {
        internalError(q.job.name, 'poll', err);
      } finally {
        q.polling = false;
      }
    })());
  }

  function startRun(q: QueueState, item: unknown, partition: string, id: string): void {
    q.busy.add(partition);
    q.running += 1;
    const traceId = newTraceId();
    const startedAt = now();
    void track((async () => {
      let result: JobRunResult['result'] = 'ok';
      let error: string | undefined;
      try {
        await q.job.run(item, context(traceId));
        q.cooling.delete(id);
      } catch (err) {
        result = 'failed';
        error = errorClass(err);
        const delayMs = Math.min((q.cooling.get(id)?.delayMs ?? ITEM_COOLDOWN_MS / 2) * 2, MAX_ITEM_COOLDOWN_MS);
        q.cooling.set(id, { until: now() + delayMs, delayMs });
      }
      try {
        await q.job.release(item, leaseOwner);
      } catch (err) {
        internalError(q.job.name, 'release', err, traceId);
      }
      q.busy.delete(partition);
      q.running -= 1;
      logRun(q.job.name, traceId, startedAt, result, undefined, error);
      // A slot is free: look for more work now.
      void poll(q);
    })());
  }

  function runInterval(s: IntervalState, traceId = newTraceId()): Promise<RunNowResult> {
    const startedAt = now();
    if (state !== 'active' || s.running) {
      logRun(s.job.name, traceId, startedAt, 'skipped_lease', undefined, undefined, state !== 'active' ? 'runner_not_active' : 'already_running');
      return Promise.resolve({ result: 'skipped_lease' });
    }
    s.running = true;
    return track((async (): Promise<RunNowResult> => {
      try {
        let leased: boolean;
        try {
          leased = await store.takeJobLease(s.job.name, leaseOwner, startedAt, startedAt + (s.job.leaseMs ?? JOB_LEASE_MS));
        } catch (err) {
          logRun(s.job.name, traceId, startedAt, 'failed', undefined, errorClass(err));
          return { result: 'failed' };
        }
        if (!leased) {
          logRun(s.job.name, traceId, startedAt, 'skipped_lease', undefined, undefined, 'lease_held');
          return { result: 'skipped_lease' };
        }
        let out: JobRunResult;
        let error: string | undefined;
        try {
          out = await s.job.run(context(traceId));
        } catch (err) {
          error = errorClass(err);
          out = { result: 'failed' };
        }
        try {
          await store.endJobLease(s.job.name, leaseOwner, now(), out.result);
        } catch (err) {
          internalError(s.job.name, 'end_lease', err, traceId);
        }
        logRun(s.job.name, traceId, startedAt, out.result, out.counts, error);
        return out;
      } finally {
        s.running = false;
      }
    })());
  }

  async function runNow(name: string, options?: { traceId?: string }): Promise<RunNowResult> {
    const s = intervals.get(name);
    if (!s) throw new Error(`Unknown interval job: ${name}.`);
    return runInterval(s, options?.traceId);
  }

  function kick(name: string): void {
    const q = queues.get(name);
    if (!q) throw new Error(`Unknown queue job: ${name}.`);
    void poll(q);
  }

  function start(): void {
    if (state !== 'idle') return;
    state = 'waiting';
    void track(check());
  }

  function stop(): Promise<void> {
    if (stopping) return stopping;
    if (state === 'idle' || state === 'off') {
      state = 'off';
      return Promise.resolve();
    }
    state = 'stopping';
    deactivate();
    if (waitTimer) clearTimeout(waitTimer);
    waitTimer = null;
    stopping = (async () => {
      // Reviewer-A round 3: delete the row only after leasing stopped and the runs in flight ended, or after the
      // longest lease time. So a new start in this grace time waits, and does not mark live sends uncertain.
      const leases = [...[...queues.values()].map((q) => q.limits.leaseMs), ...[...intervals.values()].map((s) => s.job.leaseMs ?? JOB_LEASE_MS)];
      const graceMs = leases.length > 0 ? Math.max(...leases) : JOB_LEASE_MS;
      let timedOut = false;
      let timer: NodeJS.Timeout | undefined;
      const deadline = new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          timedOut = true;
          resolve();
        }, graceMs);
      });
      while (inflight.size > 0 && !timedOut) await Promise.race([Promise.allSettled([...inflight]), deadline]);
      clearTimeout(timer);
      try {
        await store.removeInstance(instanceId, bootId);
      } catch (err) {
        internalError('job_instance', 'remove', err);
      }
      state = 'off';
      log.info('job_runner_stopped', { instance_id: instanceId, role });
    })();
    return stopping;
  }

  return { instanceId, bootId, leaseOwner, addQueue, addInterval, runNow, kick, start, stop, state: () => state };
}
