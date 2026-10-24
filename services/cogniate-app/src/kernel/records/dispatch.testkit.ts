// Deterministic unit harness: run the shipped leased queue without timers or a web process.
import { randomBytes, randomUUID } from 'node:crypto';
import type { ChannelRegistry } from '@cogniate/channel-kernel';
import type { Logger } from '@cogniate/shared';
import type { LtiClient } from '../../clients/lti-client.ts';
import type { Db } from '../../domain/db.ts';
import { ltiAgsReporter } from '../../drivers/lti-ags/index.ts';
import { createDispatchQueue } from './outbox.ts';

export function createDispatchHarness(deps: { db: Db; lti: LtiClient; channels: ChannelRegistry; masterKey: Buffer; logger: Logger; now: () => number }) {
  const job = createDispatchQueue(deps.db, [ltiAgsReporter(deps)]);
  const bootId = randomUUID();
  const leaseOwner = `unit/${bootId}`;
  const ctx = { instanceId: 'unit', bootId, leaseOwner, logger: deps.logger, now: deps.now, signal: new AbortController().signal, traceId: randomBytes(16).toString('hex') };
  void job.recover({ mode: 'start', instanceId: 'unit', leaseOwner, now: deps.now() });
  let running: Promise<void> | null = null;
  let again = false;
  async function drain() {
    do {
      again = false;
      for (const item of await job.due(deps.now(), 20)) {
        if (!await job.lease(item, leaseOwner, deps.now() + 60_000, deps.now())) continue;
        try { await job.run(item, ctx); }
        finally { await job.release(item, leaseOwner); }
      }
    } while (again);
  }
  return { kick(): Promise<void> {
    if (running) { again = true; return running; }
    running = drain().finally(() => { running = null; });
    return running;
  } };
}
