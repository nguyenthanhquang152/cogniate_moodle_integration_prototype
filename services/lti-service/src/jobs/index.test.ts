import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSqlite } from '@cogniate/shared';
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
    expect(db.prepare('SELECT * FROM tool_account').all()).toEqual(before);
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
  try {
    expect(createLtiJobRunner({ db, logger, env: {} }).instanceId).toBe('lti-1');
    expect(createLtiJobRunner({ db, logger, env: { JOB_INSTANCE_ID: 'lti-test' } }).instanceId).toBe('lti-test');
    expect(() => createLtiJobRunner({ db, logger, env: { JOB_INSTANCE_ID: 'bad/id' } })).toThrow('instance id');
    expect(() => createLtiJobRunner({ db, logger, env: { AUDIT_RETENTION_DAYS: '-1' } })).toThrow('AUDIT_RETENTION_DAYS');
    expect(db.prepare('SELECT * FROM job_instance').all()).toEqual([]);
  } finally { db.close(); }
});
