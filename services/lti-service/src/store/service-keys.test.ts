import { createHmac } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bindKeyProvider, createLocalKeyProvider, openSqlite, sha256Hex } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { MASTER_KEY, URLS } from '../testkit.ts';
import { ensureAccount } from './accounts.ts';
import { createPlatform } from './platforms.ts';
import { deriveServiceKey, findServiceKey, issueServiceKey, revokeServiceKeys, serviceKeyVersions } from './service-keys.ts';

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

  it('a revoked key stops working and is not issued again', () => {
    const { db, p } = setup();
    const a = issueServiceKey(db, MASTER_KEY, { ...scope(p.id), agsClaim: null, nrpsClaim: null }, 1) as { serviceKey: string };
    expect(revokeServiceKeys(db, p.id, 5)).toBe(1);
    expect(findServiceKey(db, 'cogniate', a.serviceKey)).toBeNull();
    expect(issueServiceKey(db, MASTER_KEY, { ...scope(p.id), agsClaim: null, nrpsClaim: null }, 6)).toEqual({ revoked: true });
  });

  it('the key depends on the master key and on every scope field (no ambiguous joins)', () => {
    const k = deriveServiceKey(MASTER_KEY, scope('plt_1'));
    expect(deriveServiceKey(Buffer.alloc(32, 9), scope('plt_1'))).not.toBe(k);
    expect(deriveServiceKey(MASTER_KEY, { ...scope('plt_1'), contextId: '2|1', deploymentId: '' })).not.toBe(deriveServiceKey(MASTER_KEY, { ...scope('plt_1'), contextId: '2', deploymentId: '|1' }));
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
    expect(after.map(({ derivation_version: _v, ...rest }) => rest)).toEqual(before);
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
