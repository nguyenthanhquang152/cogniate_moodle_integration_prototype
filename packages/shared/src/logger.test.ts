import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLogger, redact } from './logger.ts';

const fixed = () => new Date('2026-10-16T12:00:00.000Z');

describe('createLogger', () => {
  it('writes one JSON line with the fixed fields', () => {
    const lines: string[] = [];
    const logger = createLogger({ service: 'demo', write: (l) => lines.push(l), now: fixed });
    logger.info('service_started', { port: 4100 });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.endsWith('\n')).toBe(true);
    expect(JSON.parse(lines[0] ?? '')).toEqual({ ts: '2026-10-16T12:00:00.000Z', level: 'info', service: 'demo', event: 'service_started', port: 4100 });
  });

  it('appends to <dir>/<service>.jsonl', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cg-log-'));
    const logger = createLogger({ service: 'demo', dir, write: () => undefined, now: fixed });
    logger.warn('test_knob_active', { name: 'X', value: '1' });
    logger.error('boom');
    await new Promise((r) => setTimeout(r, 50));
    const rows = readFileSync(join(dir, 'demo.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(rows.map((r) => r.event)).toEqual(['test_knob_active', 'boom']);
  });
});

describe('redact', () => {
  it('hides secret fields and keeps the others', () => {
    expect(redact({ Authorization: 'Bearer x', ltik: 'abc', path: '/healthz' })).toEqual({
      Authorization: '[redacted]', ltik: '[redacted]', path: '/healthz',
    });
  });
});
