import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalKeyProvider, legacyKeyRing, openSqlite } from '@cogniate/shared';
import { describeJobStoreContract } from '@cogniate/shared/jobs.testkit';
import { expect, it } from 'vitest';
import type { Db } from '../db/index.ts';
import { openDb } from '../db/index.ts';
import { capturingLogger } from '../testkit.ts';
import { createLtiJobRunner, createLtiJobStore } from './index.ts';

// AC-LA-E5-19-06: use the shared suite on independent connections to the real LTI schema.
describeJobStoreContract('LTI migration 013', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lti-job-contract-'));
  const dbs: Db[] = [];
  return {
    store: () => { const db = openDb(join(dir, 'lti.db')); dbs.push(db); return createLtiJobStore(db); },
    close: () => { for (const db of dbs) db.close(); rmSync(dir, { recursive: true, force: true }); },
  };
});

it('AC-LA-E5-19-05: adds the runner tables to an upgraded M1 fixture without changing existing rows', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lti-jobs-migration-'));
  const migrations = fileURLToPath(new URL('../db/migrations', import.meta.url));
  const old = join(dir, 'migrations');
  mkdirSync(old);
  for (const f of readdirSync(migrations).filter((n) => n < '005')) copyFileSync(join(migrations, f), join(old, f));
  const file = join(dir, 'lti.db');
  let db = openSqlite(file, old);
  try {
    db.prepare("INSERT INTO tool_account VALUES ('tool', 'Original name', 'fixture-hash', 'launch', 'deep', 'register', 123)").run();
    db.close();
    for (const f of readdirSync(migrations).filter((n) => n >= '005' && n < '013')) copyFileSync(join(migrations, f), join(old, f));
    db = openSqlite(file, old);
    const before = db.prepare('SELECT * FROM tool_account').all();
    const keys = db.prepare('SELECT * FROM api_key').all();
    db.close();
    db = openDb(file);
    // Later migrations may add columns (019: auto_rotate); the existing columns keep their values.
    expect(db.prepare('SELECT * FROM tool_account').all().map((row) => Object.fromEntries(Object.keys(before[0]!).map((key) => [key, row[key]]))))
      .toEqual(before);
    expect(db.prepare('SELECT * FROM api_key').all()).toEqual(keys);
    expect(db.prepare('SELECT * FROM job_instance').all()).toEqual([]);
    expect(db.prepare('SELECT * FROM job_lease').all()).toEqual([]);
    expect(db.prepare('PRAGMA table_info(job_instance)').all().map((r) => r.name)).toEqual(['instance_id', 'boot_id', 'role', 'started_at', 'heartbeat_at']);
    expect(db.prepare('PRAGMA table_info(job_lease)').all().map((r) => r.name)).toEqual(['name', 'owner', 'lease_until', 'last_run_at', 'last_result']);
    db.prepare("INSERT INTO job_instance (instance_id, boot_id, started_at, heartbeat_at) VALUES ('lti-1', 'boot', 1, 1)").run();
    expect(db.prepare('SELECT role FROM job_instance').get()?.role).toBe('web');
    expect(() => db.prepare("UPDATE job_instance SET role = 'invalid'").run()).toThrow();
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});

it('uses lti-1 by default and checks JOB_INSTANCE_ID and audit retention before start', () => {
  const db = openDb(':memory:');
  const logger = capturingLogger().logger;
  const keys = createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7)));
  try {
    expect(createLtiJobRunner({ db, logger, keys, env: {} }).instanceId).toBe('lti-1');
    expect(createLtiJobRunner({ db, logger, keys, env: { JOB_INSTANCE_ID: 'lti-test' } }).instanceId).toBe('lti-test');
    expect(() => createLtiJobRunner({ db, logger, keys, env: { JOB_INSTANCE_ID: 'bad/id' } })).toThrow('instance id');
    expect(() => createLtiJobRunner({ db, logger, keys, env: { AUDIT_RETENTION_DAYS: '-1' } })).toThrow('AUDIT_RETENTION_DAYS');
    expect(db.prepare('SELECT * FROM job_instance').all()).toEqual([]);
    // LA-E5-20: the list that GET /operator/v1/jobs shows.
    expect(createLtiJobRunner({ db, logger, keys, env: {} }).jobs).toEqual([
      { name: 'retention', everyMs: 600_000 }, { name: 'audit-retention', everyMs: 86_400_000 },
      { name: 'signing-key-cleanup', everyMs: 86_400_000 }, { name: 'key-rewrap', everyMs: null },
      { name: 'api-key-expiry', everyMs: 3_600_000 }, { name: 'idempotency-cleanup', everyMs: 3_600_000 },
    ]);
  } finally { db.close(); }
});

it('a late end from an expired lease owner leaves the newer lease and its result alone', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lti-late-lease-'));
  const file = join(dir, 'lti.db');
  const first = openDb(file); const second = openDb(file);
  try {
    const a = createLtiJobStore(first); const b = createLtiJobStore(second);
    expect(await a.takeJobLease('retention', 'instance-a/boot-a', 0, 60_000)).toBe(true);
    expect(await b.takeJobLease('retention', 'instance-b/boot-b', 60_000, 120_000)).toBe(true);
    const newer = await b.readJobLease('retention');
    expect(newer).toMatchObject({ owner: 'instance-b/boot-b', leaseUntil: 120_000, lastRunAt: null, lastResult: null });
    await a.endJobLease('retention', 'instance-a/boot-a', 61_000, 'failed');
    expect(await b.readJobLease('retention')).toEqual(newer);
    await b.endJobLease('retention', 'instance-b/boot-b', 62_000, 'ok');
    expect(await a.readJobLease('retention')).toMatchObject({ owner: null, leaseUntil: null, lastRunAt: 62_000, lastResult: 'ok' });
  } finally { first.close(); second.close(); rmSync(dir, { recursive: true, force: true }); }
});
