import type { LocalKeyProvider } from '@cogniate/shared';
import { KeyProviderError, bindKeyProvider, blobKeyVersion, createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDb } from '../db/index.ts';
import { CLAIM } from '../lti/checks.ts';
import { signToolJwt } from '../lti/tool-jwt.ts';
import { CLIENT_ID, ISSUER, MASTER_KEY, URLS, capturingLogger, harness } from '../testkit.ts';
import { ensureAccount } from './accounts.ts';
import { createLaunch } from './launches.ts';
import { createPlatform } from './platforms.ts';
import { PRIVATE_JWK_CACHE_MS, activePrivateJwk, createFirstToolKey, ensureToolKey, prepareToolKey, publicJwks, toolKeyVersions } from './tool-keys.ts';

// Fixture keys (test values, not secrets). Each test binds its ring to its own handle (the service binds LTI_MASTER_KEY).
const LEGACY = Buffer.alloc(32, 7);
const K2 = Buffer.alloc(32, 2);
const ringK2 = () => ({ active: 'k2', keys: new Map([['legacy', LEGACY], ['k2', K2]]) });

function countingProvider(provider: LocalKeyProvider): { provider: LocalKeyProvider; opens: () => number } {
  let opens = 0;
  return { opens: () => opens, provider: { ...provider, openSync: (blob, aad) => { opens += 1; return provider.openSync(blob, aad); } } };
}

function accounts() {
  const db = openDb(':memory:');
  ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
  ensureAccount(db, { id: 'qa-second', name: 'QA second', appUrl: URLS.app });
  return db;
}
const activeBlob = (db: ReturnType<typeof openDb>, accountId: string) =>
  (db.prepare("SELECT private_jwk_encrypted AS b FROM tool_key WHERE tool_account_id = ? AND status = 'active'").get(accountId) as { b: Uint8Array }).b;

afterEach(() => { vi.useRealTimers(); });

describe('tool keys with the key provider (LA-ADR-06 D6)', () => {
  it('BD-A2-07: inserts the first active key and refuses an absent account or any existing key state', async () => {
    const db = accounts();
    try {
      const key = await prepareToolKey(MASTER_KEY, 'cogniate');
      const missing = await prepareToolKey(MASTER_KEY, 'absent');
      expect(() => createFirstToolKey(db, missing, 1234)).toThrow('requires an account.');
      expect(createFirstToolKey(db, key, 1234)).toMatchObject({ kid: key.kid, status: 'active', publishedAt: 1234, activatedAt: 1234 });
      expect(publicJwks(db, 'cogniate')[0]?.kid).toBe(key.kid);
      expect(db.prepare('SELECT created_at FROM tool_key WHERE kid = ?').get(key.kid)?.created_at).toBe(1234);
      for (const status of ['active', 'next', 'retired', 'removed']) {
        db.prepare('UPDATE tool_key SET status = ? WHERE kid = ?').run(status, key.kid);
        expect(() => createFirstToolKey(db, key, 1235)).toThrow('requires an account with no signing key.');
      }
    } finally { db.close(); }
  });

  it('a new private key is sealed with the active version and opens; the kid is in the associated data', async () => {
    const db = accounts();
    const handle = Buffer.alloc(32, 7);
    bindKeyProvider(handle, createLocalKeyProvider(ringK2()));
    const kid = await ensureToolKey(db, handle, 'cogniate');
    expect(blobKeyVersion(activeBlob(db, 'cogniate'))).toBe('k2');
    expect(toolKeyVersions(db)).toEqual(['k2']);
    expect(activePrivateJwk(db, handle, 'cogniate')).toMatchObject({ kid, kty: 'RSA', alg: 'RS256' });
    expect(Buffer.from(activeBlob(db, 'cogniate')).toString('latin1')).not.toContain('"d"');
  });

  it('AC-LA-E5-08-05 (store): a blob copied from the row of cogniate into the row of qa-second does not open', async () => {
    const db = accounts();
    const handle = Buffer.alloc(32, 7);
    const { logger, lines } = capturingLogger();
    bindKeyProvider(handle, createLocalKeyProvider(ringK2(), { logger }));
    await ensureToolKey(db, handle, 'cogniate');
    await ensureToolKey(db, handle, 'qa-second');
    db.prepare("UPDATE tool_key SET private_jwk_encrypted = ? WHERE tool_account_id = 'qa-second'").run(activeBlob(db, 'cogniate'));
    expect(() => activePrivateJwk(db, handle, 'qa-second')).toThrow(KeyProviderError);
    expect(lines.filter((l) => l.event === 'key_open_failed')).toEqual([expect.objectContaining({ table: 'tool_key', reason: 'auth_failed' })]);
    expect(activePrivateJwk(db, handle, 'cogniate')).not.toBeNull();
  });

  it('AC-LA-E5-08-05: the signing call gives 500 INTERNAL_ERROR with the trace id, and the log has key_open_failed {table: "tool_key"}', async () => {
    const { logger, lines } = capturingLogger();
    // The service binds its ring to LTI_MASTER_KEY at start (keys/key-config.ts); here the same legacy ring with a logger.
    bindKeyProvider(MASTER_KEY, createLocalKeyProvider(legacyKeyRing(MASTER_KEY), { logger }));
    const h = await harness();
    const qa = createPlatform(h.db, 'qa-second', {
      issuer: ISSUER, clientId: CLIENT_ID, name: 'Moodle', authEndpoint: `${ISSUER}/mod/lti/auth.php`, tokenEndpoint: `${ISSUER}/mod/lti/token.php`,
      jwksUrl: `${ISSUER}/mod/lti/certs.php`, deploymentIds: ['1'], active: true,
    });
    const { ltik } = createLaunch(h.db, {
      toolAccountId: 'qa-second', platformId: qa.id, deploymentId: '1', messageType: 'LtiDeepLinkingRequest',
      claims: { [CLAIM.deepLinkingSettings]: { deep_link_return_url: `${ISSUER}/mod/lti/contentitem_return.php?course=2&id=1`, accept_types: ['ltiResourceLink'] } },
    }, 3600, h.clock.now);
    const own = activeBlob(h.db, 'qa-second');
    h.db.prepare("UPDATE tool_key SET private_jwk_encrypted = ? WHERE tool_account_id = 'qa-second'").run(activeBlob(h.db, 'cogniate'));
    const traceId = 'la-e5-08-ac-05-trace';
    const sign = () => h.app.inject({
      method: 'POST', url: '/api/deeplinking', headers: { authorization: `LTIK-AUTH-V2 ${h.otherApiKey}:${ltik}`, 'x-trace-id': traceId },
      payload: { contentItems: [{ type: 'ltiResourceLink', title: 'QA', url: `${URLS.lti}/lti/launch/qa-second?resource=qa-dl` }] },
    });
    const r = await sign();
    expect([r.statusCode, r.json().details.message]).toEqual([500, 'INTERNAL_ERROR']);
    expect(r.json().details.description).toContain(traceId);
    expect(lines.filter((l) => l.event === 'key_open_failed')).toEqual([expect.objectContaining({ table: 'tool_key' })]);
    expect(h.lines).toContainEqual(expect.objectContaining({ event: 'internal_error', trace_id: traceId, error: 'KeyProviderError' }));
    // Control: with its own blob back, the same call signs.
    h.db.prepare("UPDATE tool_key SET private_jwk_encrypted = ? WHERE tool_account_id = 'qa-second'").run(own);
    expect((await sign()).statusCode).toBe(200);
  });

  it('AC-LA-E5-08-09: under repeated signing (controlled clock) the active private JWK is decrypted at most once per 10 minutes per kid', async () => {
    const db = accounts();
    const handle = Buffer.alloc(32, 7);
    const counting = countingProvider(createLocalKeyProvider(ringK2()));
    bindKeyProvider(handle, counting.provider);
    await ensureToolKey(db, handle, 'cogniate');
    await ensureToolKey(db, handle, 'qa-second');
    vi.useFakeTimers({ toFake: ['Date'] });
    const t0 = Date.parse('2026-10-22T08:00:00Z');
    const signAt = async (ms: number, account = 'cogniate') => {
      vi.setSystemTime(t0 + ms);
      await signToolJwt(db, handle, account, { iss: CLIENT_ID }, Date.now());
    };
    for (const ms of [0, 1, 60_000, 5 * 60_000, PRIVATE_JWK_CACHE_MS - 1]) await signAt(ms);
    expect(counting.opens()).toBe(1);
    await signAt(0, 'qa-second'); // another kid has its own entry
    expect(counting.opens()).toBe(2);
    await signAt(PRIVATE_JWK_CACHE_MS);
    await signAt(PRIVATE_JWK_CACHE_MS + 1);
    await signAt(2 * PRIVATE_JWK_CACHE_MS - 1);
    expect(counting.opens()).toBe(3);
    expect(PRIVATE_JWK_CACHE_MS).toBe(10 * 60 * 1000);
  });

  it('a new active kid is used at once, inside the 10 minutes', async () => {
    const db = accounts();
    const handle = Buffer.alloc(32, 7);
    bindKeyProvider(handle, createLocalKeyProvider(ringK2()));
    const first = await ensureToolKey(db, handle, 'cogniate');
    expect(activePrivateJwk(db, handle, 'cogniate', 1000)?.kid).toBe(first);
    const second = await ensureToolKey(db, handle, 'cogniate', true);
    expect(second).not.toBe(first);
    expect(activePrivateJwk(db, handle, 'cogniate', 2000)?.kid).toBe(second);
  });
});
