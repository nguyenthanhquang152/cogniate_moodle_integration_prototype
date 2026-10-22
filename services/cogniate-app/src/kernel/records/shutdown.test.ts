import { createLogger, type LogLine } from '@cogniate/shared';
import { afterEach, expect, it, vi } from 'vitest';
import { createShutdownHandler, SERVICE_EXIT_AFTER_MS } from './shutdown.ts';

afterEach(() => vi.useRealTimers());
function fixture(close: () => Promise<void>) {
  vi.useFakeTimers();
  const lines: LogLine[] = [];
  const loggers = ['cogniate-app', 'cogniate-content'].map((service) => createLogger({ service, write: (line) => lines.push(JSON.parse(line) as LogLine) }));
  const exit = vi.fn();
  return { lines, exit, stop: createShutdownHandler({ close, loggers }, exit) };
}

it('A-LA-E4-02-01: logs stopping for both listeners and forces exit only after 70 seconds', async () => {
  const close = vi.fn(() => new Promise<void>(() => {}));
  const f = fixture(close);
  expect(SERVICE_EXIT_AFTER_MS).toBe(70_000);
  f.stop('SIGTERM');
  await vi.advanceTimersByTimeAsync(60_000);
  expect(f.exit).not.toHaveBeenCalled();
  f.stop('SIGINT');
  expect(close).toHaveBeenCalledOnce();
  expect(f.lines.filter((l) => l.event === 'service_stopping')).toEqual([
    expect.objectContaining({ service: 'cogniate-app', signal: 'SIGTERM', level: 'info' }),
    expect.objectContaining({ service: 'cogniate-content', signal: 'SIGTERM', level: 'info' }),
  ]);
  await vi.advanceTimersByTimeAsync(9999);
  expect(f.exit).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(f.exit).toHaveBeenCalledExactlyOnceWith(1);
  expect(f.lines.filter((l) => l.event === 'service_exit_forced')).toEqual([
    expect.objectContaining({ service: 'cogniate-app', after_ms: 70_000, level: 'error' }),
    expect.objectContaining({ service: 'cogniate-content', after_ms: 70_000, level: 'error' }),
  ]);
});

it('cancels the fallback and exits 0 after a clean close beyond the runner grace', async () => {
  const closing = Promise.withResolvers<void>();
  const f = fixture(() => closing.promise);
  f.stop('SIGINT');
  await vi.advanceTimersByTimeAsync(65_000);
  expect(f.exit).not.toHaveBeenCalled();
  closing.resolve(); await vi.advanceTimersByTimeAsync(0);
  expect(f.exit).toHaveBeenCalledExactlyOnceWith(0);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(f.exit).toHaveBeenCalledTimes(1);
  expect(f.lines.some((l) => l.event === 'service_exit_forced')).toBe(false);
});

it.each(['throw', 'reject'])('cancels the fallback and exits 1 when close fails (%s)', async (mode) => {
  const f = fixture(() => { if (mode === 'throw') throw new Error('close failed'); return Promise.reject(new Error('close failed')); });
  f.stop('SIGTERM');
  await vi.advanceTimersByTimeAsync(70_000);
  expect(f.exit).toHaveBeenCalledExactlyOnceWith(1);
  expect(f.lines.some((l) => l.event === 'service_exit_forced')).toBe(false);
});
