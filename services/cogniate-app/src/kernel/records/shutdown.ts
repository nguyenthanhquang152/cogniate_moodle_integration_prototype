import type { Server } from 'node:http';
import { JOB_LEASE_MS, type Logger } from '@cogniate/shared';

// BD-A2-31: the 60 s runner grace ends before this timer and the 75 s container grace.
export const SERVICE_EXIT_AFTER_MS = JOB_LEASE_MS + 10_000;

/** BD-A2-109: the longest time that an in-flight HTTP request gets after SIGTERM. */
export const HTTP_DRAIN_MS = 3_000;

/**
 * The stop order of the service (BD-A2-109; LA-ADR-06 D11):
 * 1. At once, every listener stops accepting and its idle keep-alive connections close. The runner stop starts at
 *    the same time, not before.
 * 2. In-flight requests get at most `drainMs`. Then the remaining connections are destroyed: the handler of a cut
 *    request ends with the process (the ADR-011 dead-handler path).
 * 3. When the listeners are closed and the runner stop has returned (at once when idle; up to the 60 s lease when a
 *    run is in flight), the database closes. A failed step still closes the database; its error is then thrown.
 */
export async function stopService(parts: { servers: readonly Server[]; runner: { stop(): Promise<void> } | null; closeDb: () => void },
  drainMs = HTTP_DRAIN_MS): Promise<void> {
  // One promise per listener: a listener that fails to close must not end the wait for the others (A-LA-E4-02-04).
  const listeners = parts.servers.map((server) => new Promise<void>((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
    server.closeIdleConnections();
  }));
  const cut = setTimeout(() => { for (const server of parts.servers) server.closeAllConnections(); }, drainMs);
  // The cutoff stays armed until every listener and the runner have settled.
  const results = await Promise.allSettled([...listeners, Promise.resolve().then(() => parts.runner?.stop())]);
  clearTimeout(cut);
  parts.closeDb();
  const failed = results.find((r) => r.status === 'rejected');
  if (failed) throw failed.reason;
}

export function createShutdownHandler(service: { close(): Promise<void>; loggers: readonly Logger[] }, exit: (code: number) => void = (code) => process.exit(code)): (signal: string) => void {
  let stopping = false;
  let exited = false;
  return (signal) => {
    if (stopping) return;
    stopping = true;
    for (const logger of service.loggers) logger.info('service_stopping', { signal });
    const fallback = setTimeout(() => {
      exited = true;
      for (const logger of service.loggers) logger.error('service_exit_forced', { after_ms: SERVICE_EXIT_AFTER_MS });
      exit(1);
    }, SERVICE_EXIT_AFTER_MS);
    const finish = (code: number) => {
      clearTimeout(fallback);
      if (exited) return;
      exited = true;
      exit(code);
    };
    void Promise.resolve().then(() => service.close()).then(() => finish(0), () => finish(1));
  };
}
