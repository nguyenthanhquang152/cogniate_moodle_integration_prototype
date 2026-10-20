import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { DAY_MS, cleanupExpired } from './retention.ts';

describe('LTI service retention cleanup (data-model §2.1)', () => {
  it('deletes past OIDC states, launches expired more than 24 h ago and registration sessions older than 24 h', () => {
    const db = openDb(':memory:');
    const now = 100 * DAY_MS;
    db.exec(`PRAGMA foreign_keys = OFF;`);
    const state = db.prepare("INSERT INTO oidc_state (state_hash, tool_account_id, platform_id, nonce, target_link_uri, expires_at, used_at) VALUES (?, 'cogniate', 'plt_1', 'n', 't', ?, NULL)");
    state.run('s-old', now - 1);
    state.run('s-new', now + 60_000);
    const launch = db.prepare("INSERT INTO launch (id, tool_account_id, platform_id, deployment_id, message_type, claims, ltik_hash, expires_at, created_at) VALUES (?, 'cogniate', 'plt_1', '1', 'LtiResourceLinkRequest', '{}', ?, ?, 0)");
    launch.run('l-old', 'h1', now - DAY_MS - 1);
    launch.run('l-new', 'h2', now - DAY_MS + 1000);
    const reg = db.prepare(`INSERT INTO registration_session (id, tool_account_id, openid_configuration_url, platform_configuration, operation, privacy_level,
      passthrough_params, expires_at, created_at) VALUES (?, 'cogniate', 'https://moodle.test/c', '{}', 'new', 'anonymous', '{}', ?, ?)`);
    reg.run('r-old', now - DAY_MS - 1 + 3_600_000, now - DAY_MS - 1);
    reg.run('r-new', now + 3_600_000, now - 1000);
    expect(cleanupExpired(db, now)).toEqual([{ table: 'oidc_state', deleted: 1 }, { table: 'launch', deleted: 1 }, { table: 'registration_session', deleted: 1 }]);
    expect(db.prepare('SELECT id FROM launch').all().map((r) => r.id)).toEqual(['l-new']);
  });
});
