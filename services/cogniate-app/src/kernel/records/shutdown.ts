import { JOB_LEASE_MS, type Logger } from '@cogniate/shared';

// BD-A2-31: the 60 s runner grace ends before this timer and the 75 s container grace.
export const SERVICE_EXIT_AFTER_MS = JOB_LEASE_MS + 10_000;

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
