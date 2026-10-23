// The service entry point binds the key ring to the master-key Buffer of every store caller before the first store
// call (LA-ADR-06 D6; Reviewer-A A-LA-E5-08-01). Both listeners use port 0 here.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigRefusedError, KeyProviderError, blobKeyVersion, keyProviderFor } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LtiService } from './main.ts';
import { createShutdownHandler, SERVICE_EXIT_AFTER_MS, startLtiService } from './main.ts';
import { AGS_SCOPES } from './platform/ags.ts';
import { ensureAccount } from './store/accounts.ts';
import { createPlatform } from './store/platforms.ts';
import { issueServiceKey } from './store/service-keys.ts';
import { ensureToolKey } from './store/tool-keys.ts';
import { capturingLogger } from './testkit.ts';
import { openDb } from './db/index.ts';
import * as signingJobs from './jobs/signing-key-cleanup.ts';

// Fixture keys (test values, not secrets).
const LEGACY = Buffer.alloc(32, 7).toString('hex');
const K2 = Buffer.alloc(32, 2).toString('hex');

const temps: string[] = [];
let service: LtiService | null = null;
afterEach(async () => {
  await service?.close();
  service = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

describe('startLtiService (main.ts)', () => {
  it('checks startup config through a symlink instead of exiting without starting', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lti-main-link-'));
    temps.push(dir);
    const entry = join(dir, 'main.ts');
    symlinkSync(new URL('./main.ts', import.meta.url), entry);
    const result = spawnSync(process.execPath, [entry], {
      cwd: dir, encoding: 'utf8', timeout: 10_000,
      env: { ...process.env, LTI_MASTER_KEY: '' },
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('LTI_MASTER_KEY must be 64 hex characters');
  });

  it('LA-E5-21: a production refusal logs one config_refused line and opens no database; the entry point exits 1 with no stack trace', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lti-main-refused-'));
    temps.push(dir);
    const env = {
      DATA_DIR: dir, LTI_MASTER_KEY: LEGACY, STACK_PROFILE: 'production', LTIK_TTL_SECONDS: '20', PORT: '0', OPERATOR_PORT: '0',
      PUBLIC_MOODLE_URL: 'https://moodle.test', PUBLIC_LTI_URL: 'https://lti.cogniate.test', PUBLIC_APP_URL: 'https://app.cogniate.test',
      PUBLIC_CONTENT_URL: 'https://content.cogniate-content.test',
    };
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const { logger, lines } = capturingLogger();
    await expect(startLtiService({ logger })).rejects.toBeInstanceOf(ConfigRefusedError);
    const message = 'Production does not allow test knobs. Remove every test knob setting, then start the service again.';
    expect(lines).toEqual([expect.objectContaining({ level: 'error', event: 'config_refused', reason: 'test_knob_active', message })]);
    expect(existsSync(join(dir, 'lti.db'))).toBe(false);
    vi.unstubAllEnvs();
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./main.ts', import.meta.url))], {
      cwd: dir, encoding: 'utf8', timeout: 10_000, env: { ...process.env, ...env, LOG_DIR: '', NODE_NO_WARNINGS: '1' },
    });
    expect([result.status, result.stderr]).toEqual([1, '']);
    const out = result.stdout.trim().split('\n');
    expect(out).toHaveLength(1);
    expect(JSON.parse(out[0]!)).toMatchObject({ level: 'error', service: 'lti-service', event: 'config_refused', reason: 'test_knob_active', message });
    expect(result.stdout).not.toContain(LEGACY);
  });

  it('with the ring {active: "k2"}, the service master key seals k2 blobs; an unbound copy of the key fails closed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lti-main-'));
    temps.push(dir);
    const ringFile = join(dir, 'keyring.json');
    writeFileSync(ringFile, JSON.stringify({ active: 'k2', keys: { legacy: LEGACY, k2: K2 } }), { mode: 0o600 });
    for (const [name, value] of Object.entries({
      DATA_DIR: dir, LTI_KEYRING_FILE: ringFile, LTI_MASTER_KEY: LEGACY, PORT: '0', OPERATOR_PORT: '0', OPERATOR_HOST: '127.0.0.1',
      PUBLIC_MOODLE_URL: 'https://moodle.test', PUBLIC_LTI_URL: 'https://lti.cogniate.test', PUBLIC_APP_URL: 'https://app.cogniate.test',
      PUBLIC_CONTENT_URL: 'https://content.cogniate-content.test',
    })) vi.stubEnv(name, value);
    const { logger, lines } = capturingLogger();
    service = await startLtiService({ logger });
    expect(lines.map((l) => l.event)).toContain('service_started');

    // The routes and the token client get service.config.masterKey: it gives the loaded ring.
    expect(keyProviderFor(service.config.masterKey).versions()[0]).toEqual({ id: 'k2', state: 'active' });
    ensureAccount(service.db, { id: 'cogniate', name: 'Cogniate', appUrl: 'https://app.cogniate.test' });
    const kid = await ensureToolKey(service.db, service.config.masterKey, 'cogniate');
    const row = service.db.prepare('SELECT private_jwk_encrypted AS blob FROM tool_key WHERE kid = ?').get(kid) as { blob: Uint8Array };
    expect(blobKeyVersion(row.blob)).toBe('k2');
    expect(lines.map((l) => l.event)).not.toContain('key_provider_legacy_fallback');

    // Fail closed: the same bytes in another Buffer are not bound, so they never seal as "legacy".
    let error: unknown;
    try {
      keyProviderFor(Buffer.from(service.config.masterKey));
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(KeyProviderError);
    expect((error as KeyProviderError).code).toBe('key_provider_not_bound');
  });
});

function jobServiceConfig(): string {
  const dir = mkdtempSync(join(tmpdir(), 'lti-job-service-'));
  temps.push(dir);
  for (const [name, value] of Object.entries({
    DATA_DIR: dir, LTI_KEYRING_FILE: join(dir, 'absent-keyring.json'), LTI_MASTER_KEY: LEGACY, PORT: '0', OPERATOR_PORT: '0', OPERATOR_HOST: '127.0.0.1',
    PUBLIC_MOODLE_URL: 'https://moodle.test', PUBLIC_LTI_URL: 'https://lti.cogniate.test', PUBLIC_APP_URL: 'https://app.cogniate.test',
    PUBLIC_CONTENT_URL: 'https://content.cogniate-content.test', JOB_INSTANCE_ID: 'lti-1', AUDIT_RETENTION_DAYS: '400',
  })) vi.stubEnv(name, value);
  return dir;
}
async function settleJobs(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => setImmediate(resolve));
}

it('AC-LA-E5-19-07: the service runs retention exactly at start, 10 and 20 minutes, with one job log per run', async () => {
  jobServiceConfig();
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  const t0 = Date.UTC(2026, 9, 22);
  vi.setSystemTime(t0);
  const { logger, lines } = capturingLogger();
  service = await startLtiService({ logger });
  await settleJobs();
  expect(service.jobs.state()).toBe('active');
  await vi.advanceTimersByTimeAsync(25 * 60_000);
  const runs = lines.filter((l) => l.event === 'job_run' && l.job === 'retention');
  expect(runs).toHaveLength(3);
  expect(runs.every((l) => l.result === 'ok')).toBe(true);
  expect(new Set(runs.map((l) => l.trace_id)).size).toBe(3);
  expect(service.db.prepare("SELECT last_run_at FROM job_lease WHERE name = 'retention'").get()?.last_run_at).toBe(t0 + 20 * 60_000);
  expect(lines.filter((l) => l.event === 'job_run' && l.job === 'signing-key-cleanup')).toHaveLength(1);
  expect(lines.filter((l) => l.event === 'job_run' && l.job === 'audit-retention')).toHaveLength(1);
  expect(service.db.prepare('SELECT instance_id, role FROM job_instance').all()).toEqual([{ instance_id: 'lti-1', role: 'web' }]);
});

it('drains a job beyond 3 seconds before closing the database, then the same instance restarts without waiting', async () => {
  const dir = jobServiceConfig();
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  vi.spyOn(signingJobs, 'signingKeyCleanupJob').mockReturnValue({
    name: 'signing-key-cleanup', everyMs: null, runAtStart: true, leaseMs: 10_000,
    async run() { await gate; return { result: 'ok' }; },
  });
  const { logger, lines } = capturingLogger();
  service = await startLtiService({ logger });
  await settleJobs();
  const boot = service.jobs.bootId;
  let closed = false;
  const closing = service.close().then(() => { closed = true; });
  try {
    await vi.advanceTimersByTimeAsync(4000);
    expect(closed).toBe(false);
    expect(service.db.prepare('SELECT boot_id FROM job_instance').get()?.boot_id).toBe(boot);
  } finally { release(); await closing; }
  const inspect = openDb(join(dir, 'lti.db'));
  try { expect(inspect.prepare('SELECT * FROM job_instance').all()).toEqual([]); }
  finally { inspect.close(); }
  service = await startLtiService({ logger });
  await settleJobs();
  expect(service.jobs.state()).toBe('active');
  expect(service.jobs.bootId).not.toBe(boot);
  expect(lines.filter((l) => ['job_instance_wait', 'job_instance_conflict'].includes(String(l.event)))).toEqual([]);
});

it('BD-A2-52, BD-A2-54: wires the platform observers and the JWKS cache age to the operator /metrics', async () => {
  jobServiceConfig();
  service = await startLtiService({ logger: capturingLogger().logger });
  const { apiKey } = ensureAccount(service.db, { id: 'cogniate', name: 'Cogniate', appUrl: 'https://app.cogniate.test' });
  await ensureToolKey(service.db, service.config.masterKey, 'cogniate');
  // A loopback token endpoint: the outbound guard refuses the token request with no network call.
  const platform = createPlatform(service.db, 'cogniate', {
    issuer: 'https://127.0.0.1', clientId: 'unit', name: 'Unit', authEndpoint: 'https://127.0.0.1/auth',
    tokenEndpoint: 'https://127.0.0.1/token', jwksUrl: 'https://127.0.0.1/keys', deploymentIds: ['1'], active: true,
  });
  const { serviceKey } = issueServiceKey(service.db, service.config.masterKey, {
    toolAccountId: 'cogniate', platformId: platform.id, deploymentId: '1', contextId: '2', resourceLinkId: '3',
    agsClaim: { lineitems: 'https://127.0.0.1/lineitems', scope: Object.values(AGS_SCOPES) }, nrpsClaim: null,
  }, Date.now());
  const call = await service.app.inject({ method: 'POST', url: '/api/lineitems',
    headers: { authorization: `SERVICE-AUTH-V1 ${apiKey}:${serviceKey}` }, payload: { label: 'Unit', scoreMaximum: 10 } });
  expect(call.statusCode).toBe(502);
  const text = (await service.operatorApp.inject('/metrics')).body;
  expect(text).toContain(`lti_platform_token_failures_total{platform_id="${platform.id}"} 1\n`);
  expect(text).toContain('# TYPE lti_jwks_fetch_failures counter\n');
  // The age source is attached; the platform has no cache entry yet, so it has no series.
  expect(text).toContain('# TYPE lti_jwks_cache_age_seconds gauge\n');
  expect(text).not.toMatch(/^lti_jwks_cache_age_seconds\{/m);
});

it('BD-A2-31: forces exit 1 only at 70 seconds, after the full runner grace', async () => {
  vi.useFakeTimers();
  const { logger, lines } = capturingLogger();
  const close = vi.fn(() => new Promise<void>(() => {}));
  const exit = vi.fn();
  const stop = createShutdownHandler({ close, logger }, exit);
  expect(SERVICE_EXIT_AFTER_MS).toBe(70_000);
  stop('SIGTERM');
  await vi.advanceTimersByTimeAsync(60_000);
  expect(exit).not.toHaveBeenCalled();
  stop('SIGINT'); // another signal does not reset the deadline or close twice
  expect(close).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(9_999);
  expect(lines.filter((line) => line.event === 'service_exit_forced')).toEqual([]);
  await vi.advanceTimersByTimeAsync(1);
  expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  expect(lines.filter((line) => line.event === 'service_exit_forced')).toEqual([
    expect.objectContaining({ level: 'error', after_ms: 70_000 }),
  ]);
});

it('cancels the fallback and exits 0 when close finishes after the runner grace', async () => {
  vi.useFakeTimers();
  const { logger, lines } = capturingLogger();
  let release!: () => void;
  const closing = new Promise<void>((resolve) => { release = resolve; });
  const exit = vi.fn();
  createShutdownHandler({ close: () => closing, logger }, exit)('SIGTERM');
  await vi.advanceTimersByTimeAsync(65_000);
  expect(exit).not.toHaveBeenCalled();
  release(); await vi.advanceTimersByTimeAsync(0);
  expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(exit).toHaveBeenCalledTimes(1);
  expect(lines.some((line) => line.event === 'service_exit_forced')).toBe(false);
});

it('exits 1 and cancels the fallback when close rejects', async () => {
  vi.useFakeTimers();
  const exit = vi.fn();
  createShutdownHandler({ close: async () => { throw new Error('close failed'); }, logger: capturingLogger().logger }, exit)('SIGTERM');
  await vi.advanceTimersByTimeAsync(70_000);
  expect(exit).toHaveBeenCalledExactlyOnceWith(1);
});
