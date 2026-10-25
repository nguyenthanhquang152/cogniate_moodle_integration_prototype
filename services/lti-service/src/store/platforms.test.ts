import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSqlite } from '@cogniate/shared';
import { expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { ensureAccount } from './accounts.ts';
import { createPlatform, getPlatform, updatePlatform } from './platforms.ts';

it('migration 018 gives old platforms an empty trusted list and preserves all old fields (LA-E3-12 AC-04)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lti-trusted-audiences-'));
  const migrations = fileURLToPath(new URL('../db/migrations', import.meta.url));
  const old = join(dir, 'old');
  mkdirSync(old);
  for (const name of readdirSync(migrations).filter((name) => name < '018')) copyFileSync(join(migrations, name), join(old, name));
  const file = join(dir, 'lti.db');
  let db = openSqlite(file, old);
  try {
    ensureAccount(db, { id: 'unit', appUrl: 'https://app.test' });
    // Historical INSERT: this schema has no trusted_audiences column.
    db.prepare(`INSERT INTO platform (id, tool_account_id, issuer, client_id, name, auth_endpoint, token_endpoint, jwks_url, active, created_at, updated_at)
      VALUES ('plt_old', 'unit', 'https://platform.test', 'client', 'Old platform', 'https://platform.test/a', 'https://platform.test/t', 'https://platform.test/k', 1, 100, 200)`).run();
    const before = db.prepare('SELECT * FROM platform WHERE id = ?').get('plt_old');
    db.close();
    db = openDb(file);
    expect(db.prepare('SELECT * FROM platform WHERE id = ?').get('plt_old')).toEqual({ ...before, trusted_audiences: '[]', client_assertion_aud: null, granted_scopes: null });
    expect(getPlatform(db, 'unit', 'plt_old')?.trustedAudiences).toEqual([]);
    updatePlatform(db, 'unit', 'plt_old', { trustedAudiences: ['https://other.test', 'opaque-audience'] });
    db.close();
    db = openDb(file);
    expect(getPlatform(db, 'unit', 'plt_old')?.trustedAudiences).toEqual(['https://other.test', 'opaque-audience']);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

it('migration 020 gives old platforms NULL assertion audience and granted scopes; old values stay (AC-LA-E2-01-09)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lti-assertion-aud-'));
  const migrations = fileURLToPath(new URL('../db/migrations', import.meta.url));
  const old = join(dir, 'old');
  mkdirSync(old);
  for (const name of readdirSync(migrations).filter((name) => name < '020')) copyFileSync(join(migrations, name), join(old, name));
  const file = join(dir, 'lti.db');
  let db = openSqlite(file, old);
  try {
    ensureAccount(db, { id: 'unit', appUrl: 'https://app.test' });
    const input = { issuer: 'https://platform.test', clientId: 'client', name: 'Old platform', authEndpoint: 'https://platform.test/a',
      tokenEndpoint: 'https://platform.test/t', jwksUrl: 'https://platform.test/k', active: true, deploymentIds: ['1'], trustedAudiences: ['extra'] };
    // Historical INSERT: this schema has no client_assertion_aud or granted_scopes column.
    db.prepare(`INSERT INTO platform (id, tool_account_id, issuer, client_id, name, auth_endpoint, token_endpoint, jwks_url, active, created_at, updated_at, trusted_audiences)
      VALUES ('plt_old', 'unit', ?, ?, ?, ?, ?, ?, 1, 100, 200, '["extra"]')`).run(input.issuer, input.clientId, input.name, input.authEndpoint, input.tokenEndpoint, input.jwksUrl);
    db.prepare("INSERT INTO deployment (platform_id, deployment_id) VALUES ('plt_old', '1')").run();
    const before = db.prepare('SELECT * FROM platform WHERE id = ?').get('plt_old');
    db.close();
    db = openDb(file);
    expect(db.prepare('SELECT * FROM platform WHERE id = ?').get('plt_old')).toEqual({ ...before, client_assertion_aud: null, granted_scopes: null });
    expect(getPlatform(db, 'unit', 'plt_old')).toMatchObject({
      issuer: input.issuer, clientId: input.clientId, tokenEndpoint: input.tokenEndpoint, trustedAudiences: ['extra'], deploymentIds: ['1'],
      clientAssertionAud: null, grantedScopes: null,
    });
    const created = createPlatform(db, 'unit', { ...input, issuer: 'https://new.test', clientAssertionAud: 'https://auth.new.test/token', grantedScopes: ['scope-a'] });
    expect(getPlatform(db, 'unit', created.id)).toMatchObject({ clientAssertionAud: 'https://auth.new.test/token', grantedScopes: ['scope-a'] });
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

it('keeps platform trust scoped to the account and leaves it unchanged on unrelated updates', () => {
  const db = openDb(':memory:');
  try {
    for (const id of ['unit', 'other']) ensureAccount(db, { id, appUrl: 'https://app.test' });
    const p = createPlatform(db, 'unit', { issuer: 'https://platform.test', clientId: 'client', name: 'Platform',
      authEndpoint: 'https://platform.test/a', tokenEndpoint: 'https://platform.test/t', jwksUrl: 'https://platform.test/k',
      active: true, deploymentIds: ['1'], trustedAudiences: ['trusted'] });
    expect(updatePlatform(db, 'other', p.id, { trustedAudiences: ['untrusted'] })).toBeNull();
    expect(getPlatform(db, 'other', p.id)).toBeNull();
    expect(updatePlatform(db, 'unit', p.id, { name: 'Renamed' })?.trustedAudiences).toEqual(['trusted']);
    expect(updatePlatform(db, 'unit', p.id, { trustedAudiences: [] })?.trustedAudiences).toEqual([]);
  } finally { db.close(); }
});
