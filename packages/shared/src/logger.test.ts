import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOOT_TRACE_ID, createCliLogger, createLogger, redact, redactPath, redactString } from './logger.ts';

const fixed = () => new Date('2026-10-16T12:00:00.000Z');
const parse = (lines: string[]) => lines.map((l) => JSON.parse(l) as Record<string, unknown>);

describe('createLogger', () => {
  it('writes one JSON line with the fixed fields and the boot trace id', () => {
    const lines: string[] = [];
    const logger = createLogger({ service: 'demo', write: (l) => lines.push(l), now: fixed });
    logger.info('service_started', { port: 4100 });
    expect(lines[0]?.endsWith('\n')).toBe(true);
    expect(parse(lines)[0]).toEqual({ ts: '2026-10-16T12:00:00.000Z', level: 'info', service: 'demo', event: 'service_started', trace_id: BOOT_TRACE_ID, port: 4100 });
  });

  it('uses the request trace id when one is given, and one boot id for all loggers of the process', () => {
    const lines: string[] = [];
    const a = createLogger({ service: 'a', write: (l) => lines.push(l) });
    const b = createLogger({ service: 'b', write: (l) => lines.push(l) });
    a.info('http_request', { trace_id: 'req-12345678' });
    a.info('service_started');
    b.info('service_started');
    const rows = parse(lines);
    expect(rows[0]?.trace_id).toBe('req-12345678');
    expect(rows[1]?.trace_id).toBe(rows[2]?.trace_id);
    expect(BOOT_TRACE_ID).toMatch(/^boot-[0-9a-f]{12}$/);
    expect(a.bootTraceId).toBe(BOOT_TRACE_ID);
  });

  it('drops lines below the level (default info)', () => {
    const lines: string[] = [];
    const info = createLogger({ service: 'demo', write: (l) => lines.push(l), level: 'info' });
    info.debug('http_request');
    info.warn('test_knob_active');
    const debug = createLogger({ service: 'demo', write: (l) => lines.push(l), level: 'debug' });
    debug.debug('http_request');
    expect(parse(lines).map((r) => `${r.level}:${r.event}`)).toEqual(['warn:test_knob_active', 'debug:http_request']);
  });

  it('appends to <dir>/<service>.jsonl', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cg-log-'));
    const logger = createLogger({ service: 'demo', dir, write: () => undefined, now: fixed });
    logger.warn('test_knob_active', { name: 'X', value: '1' });
    logger.error('boom');
    await new Promise((r) => setTimeout(r, 50));
    const rows = readFileSync(join(dir, 'demo.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(rows.map((r) => r.event)).toEqual(['test_knob_active', 'boom']);
    expect(rows.every((r) => typeof r.trace_id === 'string' && r.trace_id !== '')).toBe(true);
  });
});

describe('createCliLogger', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('appends each line to <dir>/<service>.jsonl at once (a CLI can exit after it), and nothing to stdout', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cg-cli-log-'));
    const stdout = vi.spyOn(process.stdout, 'write');
    const logger = createCliLogger({ service: 'demo', dir, now: fixed });
    logger.info('grant_issued', { trace_id: 'cli-trace', grant_id: 'grt_1' });
    logger.warn('binding_fenced', { result: 'fenced' });
    // No wait: the lines are in the file when log() returns.
    const rows = parse(readFileSync(join(dir, 'demo.jsonl'), 'utf8').trim().split('\n'));
    expect(rows).toEqual([
      { ts: '2026-10-16T12:00:00.000Z', level: 'info', service: 'demo', event: 'grant_issued', trace_id: 'cli-trace', grant_id: 'grt_1' },
      { ts: '2026-10-16T12:00:00.000Z', level: 'warn', service: 'demo', event: 'binding_fenced', trace_id: BOOT_TRACE_ID, result: 'fenced' },
    ]);
    expect(stdout).not.toHaveBeenCalled();
  });

  it('writes to stderr when no folder is set, and keeps the level and redaction rules', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = createCliLogger({ service: 'demo', dir: '', now: fixed });
    logger.debug('hidden');
    logger.warn('binding_suspended', { client_secret: 'abc', note_present: true });
    expect(stderr).toHaveBeenCalledTimes(1);
    const row = JSON.parse(String(stderr.mock.calls[0]![0])) as Record<string, unknown>;
    expect(row.event).toBe('binding_suspended');
    expect(row.client_secret).not.toBe('abc');
  });
});

describe('redact', () => {
  it('hides secret keys in any spelling and keeps the others', () => {
    expect(redact({
      Authorization: 'Bearer x', ltik: 'a', apiKey: 'b', service_key: 'c', accessToken: 'd', idToken: 'e',
      registrationToken: 'f', clientAssertion: 'g', 'Set-Cookie': 'h', password: 'i', LTI_MASTER_KEY: 'j', wsToken: 'k',
      path: '/healthz', status: 200, name: 'LTIK_TTL_SECONDS',
    })).toEqual({
      Authorization: '[redacted]', ltik: '[redacted]', apiKey: '[redacted]', service_key: '[redacted]', accessToken: '[redacted]',
      idToken: '[redacted]', registrationToken: '[redacted]', clientAssertion: '[redacted]', 'Set-Cookie': '[redacted]',
      password: '[redacted]', LTI_MASTER_KEY: '[redacted]', wsToken: '[redacted]', path: '/healthz', status: 200, name: 'LTIK_TTL_SECONDS',
    });
  });

  it('looks into nested objects, arrays and errors', () => {
    const out = redact({ config: { headers: { authorization: 'Bearer abc' } }, list: [{ token: 't' }], err: new Error('bad ltik=xyz') });
    expect(out).toEqual({ config: { headers: { authorization: '[redacted]' } }, list: [{ token: '[redacted]' }], err: { name: 'Error', message: 'bad ltik=[redacted]' } });
  });

  it('masks secret-looking values inside strings', () => {
    const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1In0.c2lnbmF0dXJl';
    expect(redactString(`id_token ${jwt} end`)).toBe('id_token [redacted-jwt] end');
    expect(redactString('Authorization: Bearer abc.def')).toBe('Authorization: Bearer [redacted]');
    expect(redactString('LTIK-AUTH-V2 key:ltik')).toBe('LTIK-AUTH-V2 [redacted]');
    expect(redactString('/tool/launch?resource=pub_1&ltik=secret123')).toBe('/tool/launch?resource=pub_1&ltik=[redacted]');
    expect(redactString('key ltis_0123456789abcdef')).toBe('key [redacted-api-key]');
  });

  it('AC-LA-E5-01-12: writes a field value that starts with ltio_ (operator key) redacted, also in an operator header', () => {
    const lines: string[] = [];
    const logger = createLogger({ service: 'demo', write: (l) => lines.push(l), now: fixed });
    const operatorKey = `ltio_${'A'.repeat(21)}-_${'b'.repeat(20)}`;
    logger.info('demo_event', { note: operatorKey, short: 'ltio_x', header: `OPERATOR-AUTH-V1 ${operatorKey}`, nested: { list: [`${operatorKey} end`] } });
    expect(lines.join('')).not.toContain(operatorKey);
    expect(parse(lines)[0]).toMatchObject({
      note: '[redacted-operator-key]', short: '[redacted-operator-key]', header: 'OPERATOR-AUTH-V1 [redacted]', nested: { list: ['[redacted-operator-key] end'] },
    });
    expect(redactString('format ltio_ + 43 characters')).toBe('format ltio_ + 43 characters');
  });
});

describe('redactPath', () => {
  it('drops the query string and masks token-like segments', () => {
    expect(redactPath('/healthz?x=1')).toBe('/healthz');
    expect(redactPath('/rt/Abc123_def456-ghi789XYZ/commit')).toBe('/rt/:redacted/commit');
    expect(redactPath('/lti/keys/cogniate')).toBe('/lti/keys/cogniate');
  });
});
