import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyMigrations, createLocalKeyProvider, legacyKeyRing, openSqlite, sha256Hex } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../db/index.ts';
import { newApiKey } from '../crypto.ts';
import { issueApiKey, listApiKeys, revokeAccountApiKeys, revokeApiKey } from '../store/api-keys.ts';
import { createLaunch } from '../store/launches.ts';
import { createPlatform } from '../store/platforms.ts';
import { issueServiceKey } from '../store/service-keys.ts';
import { harness } from '../testkit.ts';
import type { Scheme } from './auth.ts';
import { authenticate } from './auth.ts';

const T0 = Date.parse('2026-10-22T10:00:00Z');
const HOUR = 3600_000;
const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const temps: string[] = [];
afterEach(() => { for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const onFail = () => { throw new Error('unexpected authentication refusal'); };

function credentials(db: Db, accountId: string, now: number) {
  const platform = createPlatform(db, accountId, { issuer: 'https://lms.test', clientId: accountId, name: 'Unit LMS',
    authEndpoint: 'https://lms.test/auth', tokenEndpoint: 'https://lms.test/token', jwksUrl: 'https://lms.test/jwks', deploymentIds: ['1'], active: true });
  const { ltik } = createLaunch(db, { toolAccountId: accountId, platformId: platform.id, deploymentId: '1',
    messageType: 'LtiResourceLinkRequest', claims: {} }, 3 * 3600, now);
  const keys = createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7)));
  const service = issueServiceKey(db, keys, { toolAccountId: accountId, platformId: platform.id, deploymentId: '1',
    contextId: 'context', resourceLinkId: 'link', agsClaim: null, nrpsClaim: null }, now);
  if (!('serviceKey' in service)) throw new Error('expected service key');
  return (key: string): Array<[Scheme, string]> => [
    ['bearer', `Bearer ${key}`], ['ltik', `LTIK-AUTH-V2 ${key}:${ltik}`], ['service', `SERVICE-AUTH-V1 ${key}:${service.serviceKey}`],
  ];
}

describe('API key authentication', () => {
  it('AC-LA-E5-07-06: Bearer passes at expiry - 1 s and gives the unknown-key 401 at expiry + 1 s', async () => {
    const h = await harness();
    try {
      const t0 = h.clock.now;
      const issued = issueApiKey(h.db, 'cogniate', { label: 'expiry', scopes: ['admin'], createdBy: 'operator:unit', expiresAt: t0 + HOUR }, t0);
      const get = (key: string) => h.app.inject({ url: '/api/platforms', headers: { authorization: `Bearer ${key}` } });
      h.clock.now = t0 + HOUR - 1000;
      expect((await get(issued.apiKey)).statusCode).toBe(200);
      h.clock.now = t0 + HOUR + 1000;
      const expired = await get(issued.apiKey); const unknown = await get(`ltis_${'A'.repeat(43)}`);
      expect(expired.statusCode).toBe(401);
      expect(expired.json().details.message).toBe('INVALID_LTIK_AUTH_AUTHORIZATION_HEADER');
      expect(expired.json()).toEqual(unknown.json());
    } finally { await h.app.close(); h.db.close(); }
  });

  it('expired and revoked keys are unknown in all three schemes; valid keys keep their account and real audit id', async () => {
    const h = await harness();
    try {
      const now = h.clock.now; const headers = credentials(h.db, 'cogniate', now);
      const issued = issueApiKey(h.db, 'cogniate', { label: 'expiry', scopes: ['launch', 'admin'], createdBy: 'operator:unit', expiresAt: now + HOUR }, now);
      for (const [scheme, header] of headers(issued.apiKey)) {
        expect((await authenticate(h.db, header, [scheme], now + HOUR - 1000, onFail))).toMatchObject({ account: { id: 'cogniate' }, actor: { type: 'api_key', id: issued.record.id } });
      }
      for (const [scheme, header] of headers(issued.apiKey)) {
        const code = scheme === 'service' ? 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER' : 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER';
        await expect(authenticate(h.db, header, [scheme], now + HOUR + 1000, () => {})).rejects.toThrow(expect.objectContaining({ status: 401, code }));
      }
      revokeApiKey(h.db, 'cogniate', issued.record.id, now + 1);
      for (const [scheme, header] of headers(issued.apiKey)) {
        await expect(authenticate(h.db, header, [scheme], now + 2, () => {})).rejects.toThrow(expect.objectContaining({ status: 401 }));
      }
    } finally { await h.app.close(); h.db.close(); }
  });

  it('a valid key needs launch for credential routes and admin for Bearer; a scope refusal is not an auth failure', async () => {
    const h = await harness();
    try {
      const now = h.clock.now; const headers = credentials(h.db, 'cogniate', now);
      revokeAccountApiKeys(h.db, 'cogniate', now);
      for (const scope of ['launch', 'admin'] as const) {
        const issued = issueApiKey(h.db, 'cogniate', { label: scope, scopes: [scope], createdBy: 'operator:unit' }, now);
        for (const [scheme, header] of headers(issued.apiKey)) {
          const needed = scheme === 'bearer' ? 'admin' : 'launch';
          if (scope === needed) expect((await authenticate(h.db, header, [scheme], now, onFail)).actor.id).toBe(issued.record.id);
          else await expect(authenticate(h.db, header, [scheme], now, onFail)).rejects
            .toThrow(expect.objectContaining({ status: 403, code: 'API_KEY_SCOPE_MISSING', description: expect.stringContaining(needed) }));
        }
      }
    } finally { await h.app.close(); h.db.close(); }
  });

  it('AC-LA-E5-07-09: migration backfills every old hash; the unchanged keys pass all schemes after the frozen column changes', async () => {
    const root = mkdtempSync(join(tmpdir(), 'api-key-migration-')); temps.push(root);
    const old = join(root, 'migrations'); mkdirSync(old);
    // M1 has migrations 001–004. Populate its legacy account hashes before applying every LA migration.
    for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql') && name < '005')) copyFileSync(join(MIGRATIONS, file), join(old, file));
    const db = openSqlite(join(root, 'lti.db'), old);
    try {
      const keys = new Map(['cogniate', 'second'].map((id) => [id, newApiKey()]));
      for (const [id, key] of keys) db.prepare(`INSERT INTO tool_account
        (id, name, api_key_hash, launch_url, deep_linking_url, registration_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(id, id, sha256Hex(key), 'https://app.test/launch', 'https://app.test/deep', 'https://app.test/register', T0);
      applyMigrations(db, MIGRATIONS);
      for (const [id, key] of keys) {
        const records = listApiKeys(db, id); expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({ toolAccountId: id, prefix: null, label: 'bootstrap', scopes: ['launch', 'admin'],
          createdAt: T0, createdBy: 'system:bootstrap', expiresAt: null, lastUsedAt: null, revokedAt: null });
        db.prepare('UPDATE tool_account SET api_key_hash = ? WHERE id = ?').run(sha256Hex(`unusable-${id}`), id);
        for (const [scheme, header] of credentials(db, id, T0)(key)) {
          expect((await authenticate(db, header, [scheme], T0, onFail))).toMatchObject({ account: { id }, actor: { type: 'api_key', id: records[0]!.id } });
        }
      }
      applyMigrations(db, MIGRATIONS);
      expect(db.prepare('SELECT count(*) AS n FROM api_key').get()?.n).toBe(2);
    } finally { db.close(); }
  });
});
