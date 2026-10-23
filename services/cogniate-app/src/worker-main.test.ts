import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { encrypt, type JobRole, type LogLine } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDb } from './domain/db.ts';
import { seedAttempt, seedBase, seedLegacyDispatch, seedLink } from './kernel/records/records.testkit.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const webEntry = fileURLToPath(new URL('./main.ts', import.meta.url));
const workerEntry = fileURLToPath(new URL('./worker-main.ts', import.meta.url));
const preload = new URL('./worker-main.testkit.ts', import.meta.url).href;
const key = Buffer.alloc(32, 5);
const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

/** Actual child processes, no Docker and no external service. Each test owns its process groups and database. */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'app-worker-entry-'));
  const db = openDb(join(dir, 'cogniate.db'));
  cleanups.push(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });
  seedBase(db);
  const apiKeyFile = join(dir, 'api-key');
  writeFileSync(apiKeyFile, 'unit-api-key');
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH, NODE_OPTIONS: `--import=${preload}`, NODE_NO_WARNINGS: '1',
    PUBLIC_LTI_URL: 'https://127.0.0.1', PUBLIC_APP_URL: 'https://app.test', PUBLIC_CONTENT_URL: 'https://content.test',
    APP_MASTER_KEY: key.toString('hex'), DATA_DIR: dir, LTI_API_KEY_FILE: apiKeyFile,
    OUTBOUND_PRIVATE_HOST_ALLOWLIST: '127.0.0.1', LOG_DIR: join(dir, 'logs'), STACK_PROFILE: 'production', PORT: '0', CONTENT_PORT: '0',
    BUILD_QUEUE_DIR: join(dir, 'builds'), OPERATOR_PORT: '0',
  };
  function seed(count = 1, nextTryAt = Date.now()) {
    for (let i = 0; i < count; i++) {
      seedLink(db, `link-${i}`); seedAttempt(db, `learner-${i}`, `link-${i}`);
      db.prepare("UPDATE attempt SET outcome = 'completed', score_given = ?, score_maximum = ? WHERE id = ?")
        .run(i, count, `att_learner-${i}`);
      db.prepare('UPDATE resource_link SET line_item_id = ?, service_key_encrypted = ? WHERE id = ?')
        .run(`line-${i}`, encrypt(key, 'unit-service-key'), `link-${i}`);
      seedLegacyDispatch(db, { id: `send-${i}`, attemptId: `att_learner-${i}`, tries: 0, createdAt: Date.now(), nextTryAt });
      db.prepare('UPDATE record_dispatch SET partition_key = ?, payload = ? WHERE id = ?')
        .run(`partition-${i % 4}`, JSON.stringify({ userId: `learner-${i}`, scoreGiven: i, scoreMaximum: count,
          activityProgress: 'Completed', gradingProgress: 'FullyGraded' }), `send-${i}`);
    }
  }
  function instance(role: JobRole, instanceId = 'existing', heartbeatAt = Date.now()) {
    db.prepare('INSERT INTO job_instance (instance_id, boot_id, role, started_at, heartbeat_at) VALUES (?, ?, ?, ?, ?)')
      .run(instanceId, 'existing-boot', role, heartbeatAt, heartbeatAt);
  }
  function start(role: JobRole, extra: NodeJS.ProcessEnv = {}, npm = false) {
    const child = spawn(npm ? 'npm' : process.execPath, npm ? ['run', 'worker'] : [role === 'worker' ? workerEntry : webEntry], {
      cwd: root, env: { ...env, JOB_INSTANCE_ID: `test-${role}`, ...extra }, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    const exited = new Promise<number | null>((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
    const lines = (): LogLine[] => output.split('\n').flatMap((line) => {
      try { const value = JSON.parse(line) as LogLine; return value.event ? [value] : []; } catch { return []; }
    });
    const groupExists = () => {
      try { process.kill(-child.pid!, 0); return true; } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ESRCH') return false;
        throw err;
      }
    };
    const signal = (value: NodeJS.Signals) => { if (groupExists()) process.kill(-child.pid!, value); };
    let stopping: Promise<number | null> | undefined;
    const stop = (): Promise<number | null> => stopping ??= (async () => {
      const pid = lines().find((line) => line.event === 'unit_service_pid')?.pid;
      if (typeof pid === 'number') {
        try { process.kill(pid, 'SIGTERM'); } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ESRCH') throw err;
        }
      } else signal('SIGTERM');
      try { await vi.waitFor(() => expect(groupExists(), output).toBe(false), { timeout: 5000, interval: 25 }); }
      finally { signal('SIGKILL'); }
      return exited;
    })();
    cleanups.push(async () => { await stop(); });
    const started = async () => {
      await vi.waitFor(() => {
        expect(child.exitCode, output).toBeNull();
        expect(lines().some((line) => line.event === (role === 'web' ? 'service_started' : 'job_runner_started')), output).toBe(true);
      }, { timeout: 10_000, interval: 25 });
    };
    return { child, exited, lines, started, stop, output: () => output, logFile: join(dir, 'logs', 'cogniate-app.jsonl') };
  }
  async function lti() {
    const posts: Array<{ path: string; body: unknown; authorization: string | undefined }> = [];
    const server = createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += String(chunk);
      posts.push({ path: req.url!, body: JSON.parse(body) as unknown, authorization: req.headers.authorization });
      // Hold sends long enough for both runner processes to contend for the same due set.
      await delay(50);
      res.writeHead(204).end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    cleanups.push(() => new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing local test server address.');
    env.PUBLIC_LTI_URL = `https://127.0.0.1:${address.port}`;
    return posts;
  }
  const rows = () => db.prepare('SELECT id, status, tries, lease_owner, send_started_at FROM record_dispatch ORDER BY id').all();
  return { db, env, seed, instance, start, lti, rows };
}

type Child = ReturnType<ReturnType<typeof fixture>['start']>;
async function webUrl(child: Child): Promise<string> {
  await child.started();
  return `http://127.0.0.1:${child.lines().find((line) => line.event === 'service_started' && line.service === 'cogniate-app')!.port}`;
}
async function assertRefused(child: Child) {
  await vi.waitFor(() => expect(child.child.exitCode, child.output()).toBe(1), { timeout: 10_000, interval: 25 });
  expect(await child.exited).toBe(1);
  expect(child.lines().filter((line) => line.event === 'config_refused')).toEqual([
    expect.objectContaining({ level: 'error', reason: 'job_runner_twice' }),
  ]);
  expect(child.lines().some((line) => line.event === 'job_runner_started')).toBe(false);
  expect(readFileSync(child.logFile, 'utf8')).toContain('"reason":"job_runner_twice"');
}

describe('LA-E4-05 process entries', () => {
  it('AC-LA-E4-05-01: web off serves pages and API, leaves scores pending and logs no job run', async () => {
    const f = fixture(); f.seed(); f.instance('worker');
    const web = f.start('web', { APP_JOB_RUNNER: 'off' });
    const url = await webUrl(web);
    expect((await fetch(`${url}/healthz`)).status).toBe(200);
    expect((await fetch(`${url}/app-api/me`)).status).toBe(401);
    const page = await fetch(`${url}/tool/launch`);
    expect(page.status).toBe(401); expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toContain('INVALID_LTIK');
    await delay(2100); // Cross a queue poll: a mistakenly active web runner would send or retry the row.
    expect(f.rows()).toEqual([expect.objectContaining({ status: 'pending', tries: 0 })]);
    expect(web.lines().some((line) => ['job_run', 'job_runner_started', 'config_refused'].includes(line.event))).toBe(false);
    expect(f.db.prepare("SELECT 1 FROM job_instance WHERE role = 'web'").get()).toBeUndefined();
    expect(await web.stop()).toBe(0);
  }, 20_000);

  it('AC-LA-E4-05-02: npm run worker sends a pending score while the web runner is off', async () => {
    const f = fixture(); f.seed(); const posts = await f.lti();
    const web = f.start('web', { APP_JOB_RUNNER: 'off' }); await webUrl(web);
    const worker = f.start('worker', { APP_JOB_RUNNER: 'off' }, true); await worker.started();
    await vi.waitFor(() => expect(f.rows()).toEqual([expect.objectContaining({ status: 'sent', tries: 1 })]), { timeout: 10_000 });
    expect(posts).toEqual([{ path: '/api/lineitems/line-0/scores', authorization: 'SERVICE-AUTH-V1 unit-api-key:unit-service-key',
      body: { userId: 'learner-0', scoreGiven: 0, scoreMaximum: 1, activityProgress: 'Completed', gradingProgress: 'FullyGraded' } }]);
    expect(f.db.prepare('SELECT instance_id, role FROM job_instance').all()).toEqual([{ instance_id: 'test-worker', role: 'worker' }]);
    expect(web.lines().some((line) => line.event === 'job_run')).toBe(false);
    await worker.stop();
    expect(f.db.prepare('SELECT 1 FROM job_instance').get()).toBeUndefined();
    expect(worker.lines()).toContainEqual(expect.objectContaining({ event: 'service_stopping' }));
  }, 20_000);

  it.each(['web', 'worker'] as const)('AC-LA-E4-05-03: production %s refuses a live other role with either instance id', async (role) => {
    for (const id of [`test-${role}`, 'other-id']) {
      const f = fixture(); f.instance(role === 'web' ? 'worker' : 'web', id); f.seed();
      const child = f.start(role); await assertRefused(child);
      expect(f.rows()).toEqual([expect.objectContaining({ status: 'pending', tries: 0 })]);
      expect(f.db.prepare('SELECT instance_id, boot_id FROM job_instance').all()).toEqual([{ instance_id: id, boot_id: 'existing-boot' }]);
    }
  }, 20_000);

  it('AC-LA-E4-05-03: simultaneous production web and worker starts allow only one role', async () => {
    const f = fixture(); const web = f.start('web'); const worker = f.start('worker');
    await vi.waitFor(() => expect([web.child.exitCode, worker.child.exitCode]).toContain(1), { timeout: 10_000 });
    const refused = web.child.exitCode === 1 ? web : worker;
    const running = refused === web ? worker : web;
    await assertRefused(refused); await running.started();
    expect(f.db.prepare('SELECT role FROM job_instance').all()).toHaveLength(1);
  }, 20_000);

  it.each(['web', 'worker'] as const)('AC-LA-E4-05-03: default %s warns for the other role and still runs', async (role) => {
    const f = fixture(); f.instance(role === 'web' ? 'worker' : 'web');
    const child = f.start(role, { STACK_PROFILE: 'default' });
    await child.started();
    await vi.waitFor(() => expect(f.db.prepare('SELECT COUNT(*) AS n FROM job_instance').get()?.n).toBe(2));
    expect(child.lines().filter((line) => line.event === 'job_runner_twice')).toEqual([
      expect.objectContaining({ level: 'warn', role }),
    ]);
    expect(child.lines().some((line) => line.event === 'config_refused')).toBe(false);
  }, 20_000);

  it.each(['web', 'worker'] as const)('AC-LA-E4-05-03: production %s ignores a stale other-role heartbeat', async (role) => {
    const f = fixture(); f.instance(role === 'web' ? 'worker' : 'web', `test-${role}`, Date.now() - 30_001);
    const child = f.start(role); await child.started();
    await vi.waitFor(() => expect(f.db.prepare('SELECT role FROM job_instance').get()?.role).toBe(role));
    expect(child.lines().some((line) => line.event === 'config_refused')).toBe(false);
  }, 20_000);

  it('AC-LA-E4-05-04: two runner processes with distinct ids POST each due score once on one database', async () => {
    const f = fixture(); f.seed(20, Date.now() + 60_000); const posts = await f.lti();
    const a = f.start('worker', { JOB_INSTANCE_ID: 'worker-a' });
    const b = f.start('worker', { JOB_INSTANCE_ID: 'worker-b' });
    await Promise.all([a.started(), b.started()]);
    expect(f.db.prepare('SELECT instance_id FROM job_instance ORDER BY instance_id').all()).toEqual([
      { instance_id: 'worker-a' }, { instance_id: 'worker-b' },
    ]);
    f.db.prepare('UPDATE record_dispatch SET next_try_at = ?').run(Date.now());
    await vi.waitFor(() => expect(f.rows().filter((row) => row.status === 'sent')).toHaveLength(20), { timeout: 10_000 });
    expect(posts).toHaveLength(20); expect(new Set(posts.map((post) => post.path)).size).toBe(20);
    expect(f.rows().every((row) => row.tries === 1 && row.lease_owner === null && row.send_started_at === null)).toBe(true);
    for (const child of [a, b]) expect(child.lines()).toContainEqual(expect.objectContaining({ event: 'job_runner_started', role: 'worker' }));
  }, 20_000);
});

describe('LA-E4-07 operator listener of the web entry', () => {
  it('AC-LA-E4-07-01: production refuses a non-loopback OPERATOR_HOST with one config_refused line before any port opens', async () => {
    const f = fixture();
    const web = f.start('web', { OPERATOR_HOST: '0.0.0.0' });
    await vi.waitFor(() => expect(web.child.exitCode, web.output()).toBe(1), { timeout: 10_000, interval: 25 });
    expect(web.lines().filter((line) => line.event === 'config_refused')).toEqual([
      expect.objectContaining({ level: 'error', reason: 'operator_bind_not_loopback' }),
    ]);
    expect(web.lines().some((line) => line.event === 'service_started')).toBe(false);
    expect(readFileSync(web.logFile, 'utf8')).toContain('"reason":"operator_bind_not_loopback"');
  });

  it.each([['on', true], ['off', false]])('AC-LA-E4-07-01, AC-LA-E4-07-07: the listener answers on 127.0.0.1; send and job series only with the runner in the process (%s)', async (runner, sends) => {
    const f = fixture();
    const web = f.start('web', { APP_JOB_RUNNER: runner, JOB_INSTANCE_ID: `test-metrics-${runner}` });
    await vi.waitFor(() => expect(web.lines().some((line) => line.event === 'operator_listener_started'), web.output()).toBe(true), { timeout: 10_000, interval: 25 });
    const bind = String(web.lines().find((line) => line.event === 'operator_listener_started')!.operator_bind);
    expect(bind).toMatch(/^127\.0\.0\.1:\d+$/);
    const ready = await fetch(`http://${bind}/readyz`);
    expect([ready.status, await ready.json()]).toEqual([200, { status: 'ready' }]);
    const metrics = await (await fetch(`http://${bind}/metrics`)).text();
    expect(metrics).toContain('# TYPE app_dispatch_sends counter');
    expect(metrics.includes('app_dispatch_sends_total{reporter="lti-ags",outcome="accepted"} 0')).toBe(sends);
    if (!sends) expect(metrics).not.toMatch(/^app_(dispatch_sends_total|job_runs_total|job_last_success_timestamp_seconds)/m);
    // The store-based series stay in both topologies.
    expect(metrics).toContain('app_grant_redemptions_total{result="committed"} 0');
    expect(metrics).toContain('app_dispatch_oldest_pending_seconds{reporter="lti-ags"} 0');
  });
});
