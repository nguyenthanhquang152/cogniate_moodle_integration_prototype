import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSqlite } from '@cogniate/shared';
import { expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { RateLimiter, checkRegistrationSessionCap } from '../http/rate-limit.ts';
import { capturingLogger, URLS } from '../testkit.ts';
import { ensureAccount } from './accounts.ts';
import { createRegistrationSession } from './registrations.ts';
import { patchRateLimitSettings, readRateLimitSettings } from './settings.ts';

it('migration 012 preserves existing sessions; new client keys and settings survive reopening', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lti-settings-migration-'));
  const migrations = fileURLToPath(new URL('../db/migrations', import.meta.url));
  const old = join(dir, 'old');
  mkdirSync(old);
  for (const f of readdirSync(migrations).filter((n) => n < '012')) copyFileSync(join(migrations, f), join(old, f));
  let db = openSqlite(join(dir, 'lti.db'), old);
  try {
    ensureAccount(db, { id: 'one', name: 'One', appUrl: URLS.app });
    // This fixture uses the pre-012 schema, before client_key exists.
    const session = { id: 'reg_before_012' };
    db.prepare(`INSERT INTO registration_session (id, tool_account_id, openid_configuration_url, platform_configuration,
      operation, privacy_level, passthrough_params, status, expires_at, created_at)
      VALUES (?, 'one', 'https://platform.test/config', '{}', 'new', 'anonymous', '{}', 'open', 2000, 1000)`).run(session.id);
    db.close();
    db = openDb(join(dir, 'lti.db'));
    expect(db.prepare('SELECT id, status, client_key, expires_at FROM registration_session').get()).toEqual({ id: session.id, status: 'open', client_key: null, expires_at: 2000 });
    expect(readRateLimitSettings(db)).toEqual({});
    const expected = patchRateLimitSettings(db, { classes: { api: { ratePerMinute: 7, burst: 3 } }, registrationSessionsPerAddress: 9 });
    db.close();
    db = openDb(join(dir, 'lti.db'));
    expect(readRateLimitSettings(db)).toEqual(expected);
    expect(new RateLimiter(db, capturingLogger().logger, () => 1000, '').view()).toMatchObject({ classes: { api: { ratePerMinute: 7, burst: 3, source: 'operator' } }, registrationSessionsPerAddress: 9 });
    patchRateLimitSettings(db, { classes: { api: null }, registrationSessionsPerAddress: null });
    expect(readRateLimitSettings(db)).toEqual({ classes: {} });
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});

it('the session cap counts unexpired open/completing rows per address prefix AND account', () => {
  const db = openDb(':memory:');
  const limiter = new RateLimiter(db, capturingLogger().logger, () => 1000, '');
  try {
    for (const id of ['one', 'two']) ensureAccount(db, { id, name: id, appUrl: URLS.app });
    limiter.replaceSettings({ registrationSessionsPerAddress: 2 });
    const add = (account: string, client: string | null, status: string, expires = 2000) => {
      const s = createRegistrationSession(db, Buffer.alloc(32, 7), {
        toolAccountId: account, openidConfigurationUrl: 'https://platform.test/config', registrationToken: null,
        platformConfiguration: {}, operation: 'new', existingPlatformId: null, privacyLevel: 'anonymous', passthrough: {}, expiresAt: expires,
      }, 1000);
      db.prepare('UPDATE registration_session SET client_key = ?, status = ? WHERE id = ?').run(client, status, s.id);
      return s.id;
    };
    const client = '2001:db8:0:0::/64';
    add('one', client, 'open');
    const pending = add('one', client, 'completing');
    add('one', client, 'completed');
    add('one', client, 'open', 1000);
    add('one', null, 'open');
    add('two', client, 'open');
    expect(checkRegistrationSessionCap(db, limiter, '2001:db8::abcd', 'one', 1000)).toEqual({ allowed: false, clientKey: client, open: 2, limit: 2 });
    expect(checkRegistrationSessionCap(db, limiter, '2001:db8::ffff', 'two', 1000)).toMatchObject({ allowed: true, open: 1 });
    expect(checkRegistrationSessionCap(db, limiter, '2001:db8:0:1::1', 'one', 1000)).toMatchObject({ allowed: true, open: 0 });
    db.prepare("UPDATE registration_session SET status = 'completed', client_key = NULL WHERE id = ?").run(pending);
    expect(checkRegistrationSessionCap(db, limiter, '2001:db8::1', 'one', 1000)).toMatchObject({ allowed: true, open: 1 });
    expect(checkRegistrationSessionCap(db, limiter, '2001:db8::1', 'one', 2000)).toMatchObject({ allowed: true, open: 0 });
    limiter.replaceSettings({ registrationSessionsPerAddress: 1 });
    expect(checkRegistrationSessionCap(db, limiter, '2001:db8::1', 'one', 1000).allowed).toBe(false);
    expect(checkRegistrationSessionCap(db, limiter, '192.0.2.1', 'one', 1000).clientKey).toBe('192.0.2.1');
  } finally { db.close(); }
});
