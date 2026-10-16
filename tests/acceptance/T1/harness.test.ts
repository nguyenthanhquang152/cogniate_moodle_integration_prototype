// T1 in-container: the test harness hooks that QA needs.
// Source: T1.md (round 2 text) H7 (JSON logs, trace id on every event, one boot trace id per process),
// H8 (e2e mounts, no key files visible, NODE_EXTRA_CA_CERTS); LC-T1-02 (PUBLIC_*_URL).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { publicUrls, readEnvFile, URL_KEYS } from '../lib/env';
import { httpsRequest, ROOT_CA_FILE } from '../lib/https';
import { logFile, readLog, REQUIRED_LOG_FIELDS, waitForLog } from '../lib/logs';
import { CERTS_DIR, ENV_FILE, LOGS_DIR, SECRETS_DIR } from '../lib/paths';

const urls = publicUrls();
const sha256 = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const LIFECYCLE_EVENTS = new Set(['service_started', 'test_knob_active', 'service_stopping']);

/** Folders where the e2e container can see certificate files: infra/.certs and the NODE_EXTRA_CA_CERTS folder. */
function certFolders(): string[] {
  const dirs = [CERTS_DIR];
  if (process.env.NODE_EXTRA_CA_CERTS) dirs.push(path.dirname(process.env.NODE_EXTRA_CA_CERTS));
  return [...new Set(dirs)].filter((d) => fs.existsSync(d));
}

describe('T1 harness (H8)', () => {
  it('H8 NODE_EXTRA_CA_CERTS is set to a CA certificate; it equals infra/.certs/root.crt where both are visible', () => {
    const extra = process.env.NODE_EXTRA_CA_CERTS;
    expect(extra, 'NODE_EXTRA_CA_CERTS').toBeTruthy();
    expect(fs.existsSync(extra!), `${extra} exists`).toBe(true);
    expect(new crypto.X509Certificate(fs.readFileSync(extra!)).ca, 'NODE_EXTRA_CA_CERTS is a CA certificate').toBe(true);
    if (fs.existsSync(ROOT_CA_FILE)) expect(sha256(extra!)).toBe(sha256(ROOT_CA_FILE));
  });

  it('H8 ca.key, stack.key and every other *.key file are not visible in the e2e container', () => {
    const visible = certFolders().flatMap((d) =>
      fs.readdirSync(d).filter((f) => f.endsWith('.key') || f === 'ca.key' || f === 'stack.key').map((f) => path.join(d, f)),
    );
    expect(visible, 'key files visible in e2e').toEqual([]);
  });

  for (const dir of [SECRETS_DIR, LOGS_DIR]) {
    it(`H8 ${path.basename(dir)} is mounted and read-only in the e2e container`, () => {
      expect(fs.existsSync(dir), `${dir} exists`).toBe(true);
      const probe = path.join(dir, `.qa-ro-probe-${process.pid}`);
      let wrote = false;
      let code = '';
      try {
        fs.writeFileSync(probe, 'qa');
        wrote = true;
      } catch (e) {
        code = (e as NodeJS.ErrnoException).code ?? '';
      } finally {
        if (wrote) fs.rmSync(probe, { force: true });
      }
      expect(wrote, `${dir} must not be writable`).toBe(false);
      expect(code).toMatch(/EROFS|EACCES|EPERM/);
    });
  }
});

describe('T1 public URLs (LC-T1-02)', () => {
  it('LC-T1-02 .env has PUBLIC_MOODLE_URL, PUBLIC_LTI_URL, PUBLIC_APP_URL, PUBLIC_CONTENT_URL as https origins with distinct hosts', () => {
    const env = readEnvFile();
    expect(env, `${ENV_FILE} readable`).not.toBeNull();
    const hosts = new Set<string>();
    for (const key of Object.values(URL_KEYS)) {
      const value = env![key];
      expect(value, key).toBeTruthy();
      const u = new URL(value);
      expect(u.protocol, key).toBe('https:');
      expect(u.pathname.replace(/\/+$/, ''), `${key} has no path`).toBe('');
      if (env!.PUBLIC_PORT && env!.PUBLIC_PORT !== '443') expect(u.port, `${key} port = PUBLIC_PORT`).toBe(env!.PUBLIC_PORT);
      hosts.add(u.hostname);
    }
    expect(hosts.size).toBe(4);
  });
});

describe('T1 JSON logs (H7)', () => {
  const services = [
    { service: 'lti-service', url: urls.lti },
    { service: 'cogniate-app', url: urls.app },
    { service: 'cogniate-content', url: urls.content },
  ];

  for (const { service } of services) {
    it(`H7 ${service}.jsonl: every line is JSON with ts, level, service, event and a non-empty trace_id; it has service_started`, () => {
      expect(fs.existsSync(logFile(service)), logFile(service)).toBe(true);
      const log = readLog(service);
      expect(log.badLines, 'lines that are not JSON objects').toEqual([]);
      expect(log.entries.length).toBeGreaterThan(0);
      const gaps = new Map<string, number>();
      const note = (k: string) => gaps.set(k, (gaps.get(k) ?? 0) + 1);
      for (const { entry } of log.entries) {
        for (const field of REQUIRED_LOG_FIELDS) if (!(field in entry)) note(`${String(entry.event)} without ${field}`);
        if ('trace_id' in entry && (typeof entry.trace_id !== 'string' || entry.trace_id === '')) note(`${String(entry.event)} with empty trace_id`);
      }
      expect([...gaps].map(([k, n]) => `${k} x${n}`), 'log lines with a missing or empty field').toEqual([]);
      for (const { line, entry } of log.entries) {
        expect(Number.isNaN(Date.parse(String(entry.ts))), `line ${line} ts is a date`).toBe(false);
        expect(typeof entry.level, `line ${line} level`).toBe('string');
        expect(entry.service, `line ${line} service`).toBe(service);
        expect(typeof entry.event, `line ${line} event`).toBe('string');
      }
      expect(log.entries.some((e) => e.entry.event === 'service_started')).toBe(true);
    });

    it(`H7 ${service}.jsonl: all lifecycle lines of one process share one boot trace id`, () => {
      // The spec does not fix the order of lifecycle lines (test_knob_active can come before service_started, and a
      // stopping process can write after a new one started). So the rule is checked without order:
      // - each process start (service_started) has its own boot trace id;
      // - every test_knob_active and service_stopping line carries the boot trace id of some service_started line;
      // - one boot trace id has at most one service_stopping line.
      const log = readLog(service);
      const lifecycle = log.entries.filter((e) => LIFECYCLE_EVENTS.has(String(e.entry.event)));
      const starts = lifecycle.filter((e) => e.entry.event === 'service_started');
      const bootIds = starts.map((e) => String(e.entry.trace_id));
      const problems: string[] = [];
      const seen = new Map<string, number>();
      for (const id of bootIds) seen.set(id, (seen.get(id) ?? 0) + 1);
      for (const [id, n] of seen) if (n > 1) problems.push(`boot trace id ${id} is on ${n} service_started lines`);
      const stops = new Map<string, number>();
      for (const { line, entry } of lifecycle) {
        if (entry.event === 'service_started') continue;
        const id = String(entry.trace_id);
        if (!seen.has(id)) problems.push(`line ${line} ${String(entry.event)} trace_id ${id} is not the boot trace id of any service_started line`);
        if (entry.event === 'service_stopping') stops.set(id, (stops.get(id) ?? 0) + 1);
      }
      for (const [id, n] of stops) if (n > 1) problems.push(`boot trace id ${id} is on ${n} service_stopping lines`);
      const summary = lifecycle.map(({ line, entry }) => `${line}:${String(entry.event)}:${String(entry.trace_id)}`).join(' ');
      expect(problems, `lifecycle lines: ${summary}`).toEqual([]);
    });
  }

  for (const { service, url } of services) {
    it(`H7 ${service}: one HTTP request gives an http_request line that QA can match (trace id or path)`, async () => {
      const probeId = `qa-probe-${crypto.randomUUID()}`;
      const startedAt = Date.now() - 2_000;
      const res = await httpsRequest(`${url}/${probeId}`);
      const traceHeader = res.headers['x-trace-id'];
      const traceId = Array.isArray(traceHeader) ? traceHeader[0] : traceHeader;
      const hit = await waitForLog(
        service,
        (entry, raw) =>
          entry.event === 'http_request' &&
          Date.parse(String(entry.ts)) >= startedAt &&
          ((traceId !== undefined && entry.trace_id === traceId) || raw.includes(probeId)),
        10_000,
      );
      expect(hit, `no http_request line for ${probeId} (x-trace-id: ${traceId ?? 'none'})`).toBeDefined();
      expect(typeof hit!.entry.trace_id === 'string' && hit!.entry.trace_id.length > 0, 'trace_id is set').toBe(true);
    });
  }
});
