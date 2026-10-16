// T1 in-container: the test harness hooks that QA needs.
// Source: hooks H7 (JSON logs) and H8 (e2e mounts, NODE_EXTRA_CA_CERTS); Lead-approved change LC-T1-02 (PUBLIC_*_URL).
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

describe('T1 harness (H8)', () => {
  it('H8 NODE_EXTRA_CA_CERTS is set and is the same file content as infra/.certs/root.crt', () => {
    const extra = process.env.NODE_EXTRA_CA_CERTS;
    expect(extra, 'NODE_EXTRA_CA_CERTS').toBeTruthy();
    expect(fs.existsSync(extra!), `${extra} exists`).toBe(true);
    expect(fs.existsSync(ROOT_CA_FILE), `${ROOT_CA_FILE} exists`).toBe(true);
    expect(sha256(extra!)).toBe(sha256(ROOT_CA_FILE));
  });

  for (const dir of [CERTS_DIR, SECRETS_DIR, LOGS_DIR]) {
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
  it('LC-T1-02 .env has PUBLIC_MOODLE_URL, PUBLIC_LTI_URL, PUBLIC_APP_URL, PUBLIC_CONTENT_URL as https origins', () => {
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
  ];

  for (const { service } of services) {
    it(`H7 ${service}.jsonl: every line is JSON with ts, level, service, event, trace_id; it has service_started`, () => {
      expect(fs.existsSync(logFile(service)), logFile(service)).toBe(true);
      const log = readLog(service);
      expect(log.badLines, 'lines that are not JSON objects').toEqual([]);
      expect(log.entries.length).toBeGreaterThan(0);
      // H7 (Lead): every line has the fields ts, level, service, event, trace_id. List all gaps by event.
      const gaps = new Map<string, number>();
      for (const { entry } of log.entries) {
        for (const field of REQUIRED_LOG_FIELDS) {
          if (!(field in entry)) gaps.set(`${String(entry.event)} without ${field}`, (gaps.get(`${String(entry.event)} without ${field}`) ?? 0) + 1);
        }
      }
      expect([...gaps].map(([k, n]) => `${k} x${n}`), 'log lines with a missing field').toEqual([]);
      for (const { line, entry } of log.entries) {
        expect(Number.isNaN(Date.parse(String(entry.ts))), `line ${line} ts is a date`).toBe(false);
        expect(typeof entry.level, `line ${line} level`).toBe('string');
        expect(entry.service, `line ${line} service`).toBe(service);
        expect(typeof entry.event, `line ${line} event`).toBe('string');
      }
      expect(log.entries.some((e) => e.entry.event === 'service_started')).toBe(true);
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
