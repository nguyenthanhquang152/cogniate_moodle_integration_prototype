import { createHmac } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bindKeyProvider, createLocalKeyProvider, legacyKeyRing, openSqlite, sha256Hex } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { MASTER_KEY, URLS } from '../testkit.ts';
import { ensureAccount } from './accounts.ts';
import { createPlatform } from './platforms.ts';
import { deriveServiceKey, findServiceKey, issueServiceKey, revokeScopedServiceKeys, revokeServiceKeys, serviceKeyVersions } from './service-keys.ts';

// The service binds its key ring at start; these tests bind each master key that they use, because keyProviderFor
// refuses an unbound master key after a binding in the same process.
const OTHER_MASTER_KEY = Buffer.alloc(32, 9);
for (const key of [MASTER_KEY, OTHER_MASTER_KEY]) bindKeyProvider(key, createLocalKeyProvider(legacyKeyRing(key)));

function setup() {
  const db = openDb(':memory:');
  ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
  ensureAccount(db, { id: 'qa-second', name: 'QA second', appUrl: URLS.app });
  const p = createPlatform(db, 'cogniate', { issuer: 'https://moodle.test', clientId: 'c', name: 'M', authEndpoint: 'https://moodle.test/a', tokenEndpoint: 'https://moodle.test/t', jwksUrl: 'https://moodle.test/k', deploymentIds: ['1'], active: true });
  return { db, p };
}
const scope = (platformId: string, resourceLinkId = 'rl-3') => ({ toolAccountId: 'cogniate', platformId, deploymentId: '1', contextId: '2', resourceLinkId });

describe('service keys (contract §3.3)', () => {
  it('the same activity gives the same key for any user; the claims are refreshed; only the hash is stored', () => {
    const { db, p } = setup();
    const a = issueServiceKey(db, MASTER_KEY, { ...scope(p.id), agsClaim: { lineitem: 'v1' }, nrpsClaim: null }, 1);
    const b = issueServiceKey(db, MASTER_KEY, { ...scope(p.id), agsClaim: { lineitem: 'v2' }, nrpsClaim: { url: 'n' } }, 2);
    expect('serviceKey' in a && a.serviceKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).toEqual(a);
    const key = (a as { serviceKey: string }).serviceKey;
    expect(findServiceKey(db, 'cogniate', key)).toMatchObject({ resourceLinkId: 'rl-3', agsClaim: { lineitem: 'v2' }, nrpsClaim: { url: 'n' } });
    expect(JSON.stringify(db.prepare('SELECT * FROM service_key').all())).not.toContain(key);
  });

  it('another activity, another key; another account cannot use the key (security §8)', () => {
    const { db, p } = setup();
    const a = issueServiceKey(db, MASTER_KEY, { ...scope(p.id), agsClaim: null, nrpsClaim: null }, 1) as { serviceKey: string };
    const b = issueServiceKey(db, MASTER_KEY, { ...scope(p.id, 'rl-4'), agsClaim: null, nrpsClaim: null }, 1) as { serviceKey: string };
    expect(a.serviceKey).not.toBe(b.serviceKey);
    expect(findServiceKey(db, 'qa-second', a.serviceKey)).toBeNull();
    expect(findServiceKey(db, 'cogniate', 'x'.repeat(43))).toBeNull();
    expect(findServiceKey(db, 'cogniate', 'short')).toBeNull();
  });

  it('a revoked key stays invalid while the next launch advances the epoch exactly once', () => {
    const { db, p } = setup();
    const a = issueServiceKey(db, MASTER_KEY, { ...scope(p.id), agsClaim: null, nrpsClaim: null }, 1) as { serviceKey: string };
    expect(revokeServiceKeys(db, p.id, 5)).toBe(1);
    expect(findServiceKey(db, 'cogniate', a.serviceKey)).toBeNull();
    const input = { ...scope(p.id), agsClaim: { lineitem: 'new' }, nrpsClaim: null };
    const b = issueServiceKey(db, MASTER_KEY, input, 6);
    expect(b.serviceKey).not.toBe(a.serviceKey);
    expect(b.serviceKey).toBe(deriveServiceKey(MASTER_KEY, input, 0, 'legacy', 1));
    expect(issueServiceKey(db, MASTER_KEY, input, 7)).toEqual(b);
    expect(findServiceKey(db, 'cogniate', a.serviceKey)).toBeNull();
    expect(findServiceKey(db, 'cogniate', b.serviceKey)?.agsClaim).toEqual(input.agsClaim);
    expect(db.prepare('SELECT issue_epoch, revoked_at FROM service_key').get()).toEqual({ issue_epoch: 1, revoked_at: null });
    // Even a revocation at time zero counts, and a binding change never resets an existing epoch.
    revokeServiceKeys(db, p.id, 0);
    const c = issueServiceKey(db, MASTER_KEY, { ...input, bindingGeneration: 2 }, 8);
    expect(c.serviceKey).toBe(deriveServiceKey(MASTER_KEY, input, 2, 'legacy', 2));
    expect(findServiceKey(db, 'cogniate', b.serviceKey)).toBeNull();
    expect(db.prepare('SELECT COUNT(*) AS n FROM service_key').get()?.n).toBe(1);
  });

  it('the key depends on the master key and on every scope field (no ambiguous joins)', () => {
    const k = deriveServiceKey(MASTER_KEY, scope('plt_1'));
    expect(deriveServiceKey(OTHER_MASTER_KEY, scope('plt_1'))).not.toBe(k);
    expect(deriveServiceKey(MASTER_KEY, { ...scope('plt_1'), contextId: '2|1', deploymentId: '' })).not.toBe(deriveServiceKey(MASTER_KEY, { ...scope('plt_1'), contextId: '2', deploymentId: '|1' }));
  });

  it('rolls back a failed re-issue without losing its revocation or advancing the epoch', () => {
    const { db, p } = setup();
    const input = { ...scope(p.id), agsClaim: null, nrpsClaim: null };
    const old = issueServiceKey(db, MASTER_KEY, input, 1);
    revokeServiceKeys(db, p.id, 2);
    const before = db.prepare('SELECT * FROM service_key').get();
    db.exec("CREATE TRIGGER fail_reissue BEFORE UPDATE ON service_key BEGIN SELECT RAISE(ABORT, 'write failed'); END");
    expect(() => issueServiceKey(db, MASTER_KEY, input, 3)).toThrow('write failed');
    expect(db.prepare('SELECT * FROM service_key').get()).toEqual(before);
    expect(findServiceKey(db, 'cogniate', old.serviceKey)).toBeNull();
    db.exec('DROP TRIGGER fail_reissue');
    expect(issueServiceKey(db, MASTER_KEY, input, 4).serviceKey).toBe(deriveServiceKey(MASTER_KEY, input, 0, 'legacy', 1));
    db.close();
  });

  it('combines every revoke filter, limits it to the account and counts only newly revoked rows', () => {
    const { db, p } = setup();
    const rows = [scope(p.id), { ...scope(p.id), contextId: 'other' }, { ...scope(p.id), deploymentId: 'other' }, scope(p.id, 'other')];
    const issued = rows.map((row) => issueServiceKey(db, MASTER_KEY, { ...row, agsClaim: null, nrpsClaim: null }, 1));
    expect(revokeScopedServiceKeys(db, 'qa-second', { platformId: p.id }, 2)).toBe(0);
    expect(revokeScopedServiceKeys(db, 'cogniate', rows[0]!, 2)).toBe(1);
    expect(issued.map(({ serviceKey }) => findServiceKey(db, 'cogniate', serviceKey) !== null)).toEqual([false, true, true, true]);
    expect(revokeScopedServiceKeys(db, 'cogniate', rows[0]!, 3)).toBe(0);
    expect(revokeScopedServiceKeys(db, 'cogniate', { platformId: p.id, contextId: 'no-match' }, 3)).toBe(0);
    expect(revokeScopedServiceKeys(db, 'cogniate', { platformId: p.id }, 4)).toBe(3);
    db.close();
  });
});

// LA-E5-08 (LA-ADR-06 D6; M1 rule "byte-identical"): the key provider derives the service keys, and every generation-0
// key keeps its exact value. todayKey is the derivation before LA-E5-08, written out here as the fixture.
const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '../db/migrations');
const LEGACY = Buffer.alloc(32, 7); // = MASTER_KEY (fixture value)
const K2 = Buffer.alloc(32, 2);
function todayKey(master: Buffer, s: { toolAccountId: string; platformId: string; deploymentId: string; contextId: string; resourceLinkId: string }, generation = 0): string {
  const subkey = createHmac('sha256', master).update('cogniate-lti/service-key/v1').digest();
  const parts = [s.toolAccountId, s.platformId, s.deploymentId, s.contextId, s.resourceLinkId, ...(generation > 0 ? [`generation=${generation}`] : [])];
  return createHmac('sha256', subkey).update(parts.map((p) => `${p.length}:${p}`).join('|')).digest('base64url');
}
const ringK2 = () => {
  const handle = Buffer.alloc(32, 7);
  bindKeyProvider(handle, createLocalKeyProvider({ active: 'k2', keys: new Map([['legacy', LEGACY], ['k2', K2]]) }));
  return handle;
};
const temps: string[] = [];
afterEach(() => { for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true }); });

describe('service keys with the key provider (LA-E5-08)', () => {
  const fixture = { toolAccountId: 'cogniate', platformId: 'plt_fixture', deploymentId: '1', contextId: '2', resourceLinkId: '3' };

  it("generation 0 and 1 keep today's values, also when another version is active", () => {
    expect(todayKey(LEGACY, fixture)).toBe('V3E5DSnWMnzgVWKdms3-tBr1bKoNQxY2xGFqn4xN2ag'); // golden, captured before LA-E5-08
    expect(todayKey(LEGACY, fixture, 1)).toBe('MIVWS5VjaV2T631rr3w9_OLOAmnf064nXEsyDlYep_o');
    for (const keys of [MASTER_KEY, ringK2()]) {
      expect(deriveServiceKey(keys, fixture)).toBe(todayKey(LEGACY, fixture));
      expect(deriveServiceKey(keys, fixture, 1)).toBe(todayKey(LEGACY, fixture, 1));
    }
    expect(deriveServiceKey(ringK2(), fixture, 0, 'k2')).not.toBe(todayKey(LEGACY, fixture));
  });

  it('AC-LA-E5-15-04: epoch 0 keeps the golden inputs; epoch 1 adds a length-framed epoch part', () => {
    for (const generation of [0, 1]) {
      const epoch0 = deriveServiceKey(MASTER_KEY, fixture, generation, 'legacy', 0);
      expect(epoch0).toBe(todayKey(LEGACY, fixture, generation));
      const parts = ['cogniate', 'plt_fixture', '1', '2', '3', ...(generation ? ['generation=1'] : []), 'epoch=1'];
      const subkey = createHmac('sha256', LEGACY).update('cogniate-lti/service-key/v1').digest();
      const expected = createHmac('sha256', subkey).update(parts.map((part) => `${part.length}:${part}`).join('|')).digest('base64url');
      expect(deriveServiceKey(MASTER_KEY, fixture, generation, 'legacy', 1)).toBe(expected);
      expect(expected).not.toBe(epoch0);
    }
    for (const epoch of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => deriveServiceKey(MASTER_KEY, fixture, 0, 'legacy', epoch)).toThrow('Invalid service key issue epoch');
    }
  });

  it('AC-LA-E5-08-10: on an M1 database, every old service_key row gets derivation_version = legacy, and its key value is unchanged', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lti-mig-'));
    temps.push(dir);
    const m1 = join(dir, 'm1');
    mkdirSync(m1);
    for (const f of readdirSync(MIGRATIONS).filter((n) => n < '005')) copyFileSync(join(MIGRATIONS, f), join(m1, f)); // M1 = 001..004
    const file = join(dir, 'lti.db');
    let db = openSqlite(file, m1);
    db.prepare("INSERT INTO tool_account VALUES ('cogniate', 'C', 'h', 'l', 'd', 'r', 0)").run();
    db.prepare("INSERT INTO platform (id, tool_account_id, issuer, client_id, name, auth_endpoint, token_endpoint, jwks_url, active, created_at, updated_at) VALUES ('plt_fixture', 'cogniate', 'https://moodle.test', 'c', 'M', 'https://moodle.test/a', 'https://moodle.test/t', 'https://moodle.test/k', 1, 0, 0)").run();
    const rows = [{ ...fixture, generation: 0, revoked: null }, { ...fixture, resourceLinkId: '4', generation: 1, revoked: null }, { ...fixture, resourceLinkId: '5', generation: 0, revoked: 9 }];
    for (const r of rows) {
      db.prepare(`INSERT INTO service_key (key_hash, tool_account_id, platform_id, deployment_id, context_id, resource_link_id, created_at, updated_at, binding_generation, revoked_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`).run(sha256Hex(todayKey(LEGACY, r, r.generation)), r.toolAccountId, r.platformId, r.deploymentId, r.contextId, r.resourceLinkId, r.generation, r.revoked);
    }
    const before = db.prepare('SELECT * FROM service_key ORDER BY resource_link_id').all();
    db.close();

    db = openSqlite(file, MIGRATIONS);
    const after = db.prepare('SELECT * FROM service_key ORDER BY resource_link_id').all();
    expect(after.map((r) => r.derivation_version)).toEqual(['legacy', 'legacy', 'legacy']);
    expect(after.map((r) => r.issue_epoch)).toEqual([0, 0, 0]);
    expect(after.map(({ derivation_version: _v, issue_epoch: _e, ...rest }) => rest)).toEqual(before);
    expect(serviceKeyVersions(db)).toEqual(['legacy']);
    // The old keys still work, and a new launch with a k2-active ring gives the same values.
    const keys = ringK2();
    for (const r of rows.slice(0, 2)) {
      const old = todayKey(LEGACY, r, r.generation);
      expect(findServiceKey(db, 'cogniate', old)).toMatchObject({ resourceLinkId: r.resourceLinkId, bindingGeneration: r.generation });
      expect(issueServiceKey(db, keys, { ...r, bindingGeneration: r.generation, agsClaim: null, nrpsClaim: null }, 1)).toEqual({ serviceKey: old });
    }
    expect(db.prepare('SELECT key_hash, derivation_version FROM service_key ORDER BY resource_link_id').all()).toEqual(
      before.map((r) => ({ key_hash: r.key_hash, derivation_version: 'legacy' })));
    db.close();
  });
});
