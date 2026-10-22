import type { JobContext } from '@cogniate/shared';
import { expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { DAY_MS } from '../store/retention.ts';
import { capturingLogger } from '../testkit.ts';
import { retentionJob } from './retention.ts';

it('AC-LA-E5-19-02: retains boundary/new rows, deletes expired rows of every retained table, and keeps per-table logs', async () => {
  const db = openDb(':memory:');
  const now = 100 * DAY_MS;
  const { logger, lines } = capturingLogger();
  const ctx: JobContext = { instanceId: 'lti-1', bootId: 'test', leaseOwner: 'lti-1/test', traceId: 'retention-trace', now: () => now, logger, signal: new AbortController().signal };
  try {
    db.exec('PRAGMA foreign_keys = OFF');
    const state = db.prepare("INSERT INTO oidc_state (state_hash, tool_account_id, platform_id, nonce, target_link_uri, expires_at) VALUES (?, 'tool', 'platform', 'n', 'target', ?)");
    const launch = db.prepare("INSERT INTO launch (id, tool_account_id, platform_id, deployment_id, message_type, claims, ltik_hash, expires_at, created_at) VALUES (?, 'tool', 'platform', '1', 'LtiResourceLinkRequest', '{}', ?, ?, 0)");
    const registration = db.prepare(`INSERT INTO registration_session (id, tool_account_id, openid_configuration_url, platform_configuration, operation, privacy_level,
      passthrough_params, expires_at, created_at) VALUES (?, 'tool', 'https://platform.test/config', '{}', 'new', 'anonymous', '{}', ?, ?)`);
    for (const [id, delta] of [['old', -1], ['boundary', 0], ['new', 1]] as const) {
      state.run(id, now + delta);
      launch.run(id, id, now - DAY_MS + delta);
      registration.run(id, now + DAY_MS, now - DAY_MS + delta);
    }
    // These data belong to other retention rules.
    db.prepare("INSERT INTO service_setting (key, value) VALUES ('fixture', '{}')").run();
    const job = retentionJob(db);
    expect([job.everyMs, job.runAtStart]).toEqual([600_000, true]);
    expect(await job.run(ctx)).toEqual({ result: 'ok', counts: { oidc_state: 1, launch: 1, registration_session: 1 } });
    for (const table of ['oidc_state', 'launch', 'registration_session']) expect(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n).toBe(2);
    expect(db.prepare('SELECT count(*) AS n FROM service_setting').get()?.n).toBe(1);
    expect(lines.map((l) => [l.event, l.trace_id, l.table, l.deleted])).toEqual([
      ['retention_cleanup', ctx.traceId, 'oidc_state', 1], ['retention_cleanup', ctx.traceId, 'launch', 1], ['retention_cleanup', ctx.traceId, 'registration_session', 1],
    ]);
    await job.run(ctx);
    expect(lines).toHaveLength(3); // no zero-deletion lines
  } finally { db.close(); }
});
