import { createCipheriv } from 'node:crypto';
import type { JobContext, LocalKeyProvider } from '@cogniate/shared';
import { associatedData, blobKeyVersion, createLocalKeyProvider, encrypt } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/index.ts';
import { openDb } from '../db/index.ts';
import { ensureAccount } from '../store/accounts.ts';
import { listAuditEvents } from '../store/audit.ts';
import { createPlatform } from '../store/platforms.ts';
import { deriveServiceKey, issueServiceKey } from '../store/service-keys.ts';
import { legacyBlobsRefused } from '../store/settings.ts';
import { capturingLogger } from '../testkit.ts';
import { KEY_REWRAP_BATCH_SIZE, keyProviderStatus, keyRewrapJob } from './key-rewrap.ts';

const T0 = 1_000_000;
const LEGACY = Buffer.alloc(32, 7);
const K1 = Buffer.alloc(32, 1);
const K2 = Buffer.alloc(32, 2);
const databases: Db[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const db of databases.splice(0)) db.close(); });
const aad = (table: 'tool_key' | 'registration_session', id: string) =>
  associatedData('lti', table, table === 'tool_key' ? 'private_jwk_encrypted' : 'registration_token_encrypted', 'tool', id);

function fixture(active = 'k2') {
  const db = openDb(':memory:'); databases.push(db);
  ensureAccount(db, { id: 'tool', name: 'Tool', appUrl: 'https://app.test' });
  const { logger, lines } = capturingLogger();
  const keys = new Map([['legacy', LEGACY], ['k1', K1], ['k2', K2]]);
  const provider = createLocalKeyProvider({ active, keys }, { logger, legacyBlobsRefused: () => legacyBlobsRefused(db) });
  const older = createLocalKeyProvider({ active: 'k1', keys });
  const blob = (table: 'tool_key' | 'registration_session', id: string, format: 'legacy' | 'old' | 'current') => {
    const plain = `fixture:${table}:${id}`;
    return format === 'legacy' ? encrypt(LEGACY, plain) : (format === 'old' ? older : provider).sealSync(Buffer.from(plain), aad(table, id)).bytes;
  };
  const tool = (id: string, format: 'legacy' | 'old' | 'current' = 'legacy') => {
    db.prepare(`INSERT INTO tool_key (kid, tool_account_id, public_jwk, private_jwk_encrypted, status, created_at)
      VALUES (?, 'tool', ?, ?, 'retired', ?)`).run(id, JSON.stringify({ kid: id }), blob('tool_key', id, format), T0);
  };
  const session = (id: string, format: 'legacy' | 'old' | 'current' = 'legacy') => {
    db.prepare(`INSERT INTO registration_session (id, tool_account_id, openid_configuration_url, registration_token_encrypted,
      platform_configuration, operation, privacy_level, passthrough_params, expires_at, created_at)
      VALUES (?, 'tool', 'https://platform.test/oidc', ?, '{}', 'new', 'public', '{}', ?, ?)`)
      .run(id, blob('registration_session', id, format), T0 - 1, T0 - 3600_000);
  };
  const run = (controller = new AbortController(), leaseMs = 60_000, now = () => T0) => {
    db.prepare(`INSERT INTO job_lease (name, owner, lease_until) VALUES ('key-rewrap', 'unit/boot', ?)
      ON CONFLICT(name) DO UPDATE SET owner = excluded.owner, lease_until = excluded.lease_until`).run(T0 + leaseMs);
    const ctx: JobContext = { instanceId: 'unit', bootId: 'boot', leaseOwner: 'unit/boot', traceId: 'job-trace-unit',
      now, signal: controller.signal, logger };
    return keyRewrapJob(db, provider).run(ctx);
  };
  const events = () => listAuditEvents(db, { action: 'key_provider.rewrap', limit: 100 }).events;
  return { db, provider, tool, session, run, events, lines };
}

function cleartext(db: Db, provider: LocalKeyProvider) {
  return (db.prepare('SELECT kid, private_jwk_encrypted AS blob FROM tool_key ORDER BY kid').all() as Array<{ kid: string; blob: Uint8Array }>)
    .map((row) => ({ kid: row.kid, version: blobKeyVersion(row.blob), plain: Buffer.from(provider.openSync({ bytes: row.blob }, aad('tool_key', row.kid))).toString() }));
}

describe('key-rewrap', () => {
  it('AC-06: stop after one 100-row batch, resume to the full-run result, and change no blob on a third run', async () => {
    const h = fixture();
    const full = fixture();
    for (let i = 0; i < 205; i++) { const id = `kid-${String(i).padStart(3, '0')}`; h.tool(id); full.tool(id); }
    h.session('expired'); full.session('expired');
    const controller = new AbortController();
    const seal = h.provider.sealSync;
    let calls = 0;
    const spy = vi.spyOn(h.provider, 'sealSync').mockImplementation((plain, data) => {
      const sealed = seal(plain, data);
      // Last seal of batch one: this task is queued before the job's yield, so the next batch sees the abort.
      if (++calls === KEY_REWRAP_BATCH_SIZE) setImmediate(() => controller.abort());
      return sealed;
    });
    expect(await h.run(controller)).toEqual({ result: 'ok', counts: { rewrapped: 100, skippedChanged: 0, notReached: 106, unreadable: 0 } });
    expect(legacyBlobsRefused(h.db)).toBe(false);
    expect(h.events()[0]?.details).toEqual({ outcome: 'partial', rewrapped: 100, skippedChanged: 0, notReached: 106, unreadable: 0, stopReason: 'stopping' });
    spy.mockRestore();
    expect(await h.run()).toEqual({ result: 'ok', counts: { rewrapped: 106, skippedChanged: 0, notReached: 0, unreadable: 0 } });
    expect(await full.run()).toEqual({ result: 'ok', counts: { rewrapped: 206, skippedChanged: 0, notReached: 0, unreadable: 0 } });
    expect(cleartext(h.db, h.provider)).toEqual(cleartext(full.db, full.provider));
    const before = h.db.prepare('SELECT * FROM tool_key ORDER BY kid').all();
    const registrations = h.db.prepare('SELECT * FROM registration_session').all();
    expect(await h.run()).toEqual({ result: 'ok', counts: { rewrapped: 0, skippedChanged: 0, notReached: 0, unreadable: 0 } });
    expect(h.db.prepare('SELECT * FROM tool_key ORDER BY kid').all()).toEqual(before);
    expect(h.db.prepare('SELECT * FROM registration_session').all()).toEqual(registrations);
  });

  it('AC-07: authenticated legacy format is re-sealed even when legacy is active; row binding and derived keys survive', async () => {
    const h = fixture('legacy'); h.tool('old'); h.tool('current', 'current'); h.session('registration');
    const platform = createPlatform(h.db, 'tool', { name: 'Unit', issuer: 'https://platform.test', clientId: 'client',
      authEndpoint: 'https://platform.test/a', tokenEndpoint: 'https://platform.test/t', jwksUrl: 'https://platform.test/j', deploymentIds: ['1'], active: true });
    const scope = { toolAccountId: 'tool', platformId: platform.id, deploymentId: '1', contextId: 'c', resourceLinkId: 'r' };
    const issued = issueServiceKey(h.db, h.provider, { ...scope, agsClaim: null, nrpsClaim: null }, T0);
    const serviceRows = h.db.prepare('SELECT * FROM service_key').all();
    const oldBlob = h.db.prepare("SELECT private_jwk_encrypted AS blob FROM tool_key WHERE kid = 'old'").get()!.blob as Uint8Array;
    const currentBefore = h.db.prepare("SELECT * FROM tool_key WHERE kid = 'current'").get();
    expect(await h.run()).toEqual({ result: 'ok', counts: { rewrapped: 2, skippedChanged: 0, notReached: 0, unreadable: 0 } });
    expect(legacyBlobsRefused(h.db)).toBe(true);
    expect(h.events()).toEqual([expect.objectContaining({ result: 'ok', actor: { type: 'system', id: 'key-rewrap' },
      details: { outcome: 'complete', rewrapped: 2, skippedChanged: 0, notReached: 0, unreadable: 0, legacyBlobsRefused: true } })]);
    await expect(h.provider.open({ bytes: oldBlob }, aad('tool_key', 'old'))).rejects.toThrow('legacy_refused');
    expect(h.lines).toContainEqual(expect.objectContaining({ event: 'key_open_failed', table: 'tool_key', reason: 'legacy_refused' }));
    const wrapped = h.db.prepare("SELECT private_jwk_encrypted AS blob FROM tool_key WHERE kid = 'old'").get()!.blob as Uint8Array;
    expect(Buffer.from(h.provider.openSync({ bytes: wrapped }, aad('tool_key', 'old'))).toString()).toBe('fixture:tool_key:old');
    expect(() => h.provider.openSync({ bytes: wrapped }, aad('tool_key', 'another'))).toThrow('auth_failed');
    expect(h.db.prepare("SELECT * FROM tool_key WHERE kid = 'current'").get()).toEqual(currentBefore);
    expect(h.db.prepare('SELECT * FROM service_key').all()).toEqual(serviceRows);
    expect(issued).toEqual({ serviceKey: deriveServiceKey(h.provider, scope) });
  });

  it('BD-A2-38: re-wrap identifies a legacy IV that resembles an active cgk1 header', async () => {
    const h = fixture(); h.tool('collision');
    const iv = Buffer.concat([Buffer.from('cgk1'), Buffer.from([2]), Buffer.from('k2'), Buffer.from([0, 60, 0, 0, 0])]);
    const cipher = createCipheriv('aes-256-gcm', LEGACY, iv);
    const plain = 'collision fixture'.repeat(8);
    const data = Buffer.concat([cipher.update(plain), cipher.final()]);
    const old = Buffer.concat([iv, cipher.getAuthTag(), data]);
    expect(blobKeyVersion(old)).toBe('k2');
    h.db.prepare("UPDATE tool_key SET private_jwk_encrypted = ? WHERE kid = 'collision'").run(old);
    expect((await h.run()).counts?.rewrapped).toBe(1);
    expect(legacyBlobsRefused(h.db)).toBe(true);
    const row = h.db.prepare("SELECT private_jwk_encrypted AS blob FROM tool_key WHERE kid = 'collision'").get()!;
    expect(Buffer.from(h.provider.openSync({ bytes: row.blob as Uint8Array }, aad('tool_key', 'collision'))).toString()).toBe(plain);
  });

  it.each([9_999, 0])('AC-08: a lease with %s ms left leaves legacy rows and the refusal setting unchanged', async (left) => {
    const h = fixture(); h.tool('one');
    const before = h.db.prepare('SELECT * FROM tool_key').all();
    const open = vi.spyOn(h.provider, 'openWithMetadataSync');
    expect(await h.run(new AbortController(), left)).toEqual({ result: 'ok', counts: { rewrapped: 0, skippedChanged: 0, notReached: 1, unreadable: 0 } });
    expect(open).not.toHaveBeenCalled();
    expect(h.db.prepare('SELECT * FROM tool_key').all()).toEqual(before);
    expect(legacyBlobsRefused(h.db)).toBe(false);
    expect(h.events()[0]?.details).toMatchObject({ outcome: 'partial', stopReason: 'lease', notReached: 1 });
  });

  it('starts a batch with exactly 10 seconds left and refuses work with another lease owner', async () => {
    const h = fixture(); h.tool('one');
    expect((await h.run(new AbortController(), 10_000)).counts?.rewrapped).toBe(1);
    const other = fixture(); other.tool('one');
    const ctx: JobContext = { instanceId: 'unit', bootId: 'boot', leaseOwner: 'wrong/owner', traceId: 'unit',
      now: () => T0, signal: new AbortController().signal, logger: capturingLogger().logger };
    other.db.prepare("INSERT INTO job_lease (name, owner, lease_until) VALUES ('key-rewrap', 'another/owner', ?)").run(T0 + 60_000);
    expect((await keyRewrapJob(other.db, other.provider).run(ctx)).counts?.rewrapped).toBe(0);
    expect(legacyBlobsRefused(other.db)).toBe(false);
  });

  it('compare-and-set preserves a blob changed after selection and counts the skip', async () => {
    const h = fixture(); h.tool('one');
    const replacement = h.provider.sealSync(Buffer.from('replacement'), aad('tool_key', 'one')).bytes;
    const seal = h.provider.sealSync;
    vi.spyOn(h.provider, 'sealSync').mockImplementationOnce((plain, data) => {
      h.db.prepare("UPDATE tool_key SET private_jwk_encrypted = ? WHERE kid = 'one'").run(replacement);
      return seal(plain, data);
    });
    expect(await h.run()).toEqual({ result: 'ok', counts: { rewrapped: 0, skippedChanged: 1, notReached: 0, unreadable: 0 } });
    expect(Buffer.from(h.db.prepare("SELECT private_jwk_encrypted AS blob FROM tool_key WHERE kid = 'one'").get()!.blob as Uint8Array)).toEqual(Buffer.from(replacement));
  });

  it('BD-A2-43: final verification finds a legacy row inserted after its table was processed', async () => {
    const h = fixture(); h.tool('one'); h.session('last');
    const seal = h.provider.sealSync;
    vi.spyOn(h.provider, 'sealSync').mockImplementation((plain, data) => {
      if (data.includes(':registration_session:')) setImmediate(() => h.tool('late'));
      return seal(plain, data);
    });
    expect((await h.run()).result).toBe('ok');
    expect(legacyBlobsRefused(h.db)).toBe(false);
    expect(h.events()[0]?.details).toMatchObject({ outcome: 'partial', stopReason: 'legacy_remains', rewrapped: 2, unreadable: 0 });
    vi.restoreAllMocks();
    expect((await h.run()).counts?.rewrapped).toBe(1);
    expect(legacyBlobsRefused(h.db)).toBe(true);
  });

  it('BD-A2-43: a final verification that reaches the lease margin stops without refusal', async () => {
    const h = fixture(); h.tool('one'); h.tool('two');
    const open = h.provider.openWithMetadataSync;
    let calls = 0;
    let now = T0;
    vi.spyOn(h.provider, 'openWithMetadataSync').mockImplementation((blob, data) => {
      if (++calls === 3) now = T0 + 50_001; // Two batch opens, then the first open of final verification.
      return open(blob, data);
    });
    expect((await h.run(new AbortController(), 60_000, () => now)).result).toBe('ok');
    expect(calls).toBe(3);
    expect(legacyBlobsRefused(h.db)).toBe(false);
    expect(h.events()[0]?.details).toMatchObject({ outcome: 'partial', stopReason: 'lease', notReached: 0, rewrapped: 2 });
  });

  it('a failed batch rolls back all its changes, keeps earlier batches, audits the class only, and leaves refusal off', async () => {
    const h = fixture();
    for (let i = 0; i < 102; i++) h.tool(String(i).padStart(3, '0'));
    const seal = h.provider.sealSync;
    let calls = 0;
    vi.spyOn(h.provider, 'sealSync').mockImplementation((plain, data) => {
      // Fail at the second row of batch two: its first row must roll back while batch one stays committed.
      if (++calls === KEY_REWRAP_BATCH_SIZE + 2) throw new TypeError('fixture-secret-not-for-audit');
      return seal(plain, data);
    });
    expect(await h.run()).toEqual({ result: 'failed', counts: { rewrapped: 100, skippedChanged: 0, notReached: 2, unreadable: 0 } });
    expect(legacyBlobsRefused(h.db)).toBe(false);
    expect(h.events()).toEqual([expect.objectContaining({ result: 'ok', code: null,
      details: { outcome: 'failed', rewrapped: 100, skippedChanged: 0, notReached: 2, unreadable: 0, errorClass: 'TypeError' } })]);
    expect(JSON.stringify(h.events())).not.toContain('fixture-secret-not-for-audit');
  });

  it('an unreadable blob prevents refusal and produces a failed event', async () => {
    const h = fixture(); h.tool('bad'); h.tool('healthy');
    h.db.prepare("UPDATE tool_key SET private_jwk_encrypted = ? WHERE kid = 'bad'").run(Buffer.from('broken fixture'));
    expect(await h.run()).toEqual({ result: 'failed', counts: { rewrapped: 1, skippedChanged: 0, notReached: 0, unreadable: 1 } });
    expect(legacyBlobsRefused(h.db)).toBe(false);
    expect(h.events()[0]).toMatchObject({ result: 'ok', code: null, details: { outcome: 'failed', unreadable: 1, unreadableVersions: ['legacy'] } });
  });

  it('an audit insert failure rolls back refusal; already committed blobs remain safe to resume', async () => {
    const h = fixture(); h.tool('one');
    h.db.exec("CREATE TRIGGER fail_job_audit BEFORE INSERT ON audit_event BEGIN SELECT RAISE(ABORT, 'unit fault'); END");
    await expect(h.run()).rejects.toThrow('unit fault');
    expect(legacyBlobsRefused(h.db)).toBe(false);
    expect(h.events()).toEqual([]);
    h.db.exec('DROP TRIGGER fail_job_audit');
    expect((await h.run()).counts?.rewrapped).toBe(0);
    expect(legacyBlobsRefused(h.db)).toBe(true);
  });

  it('status counts all sealed and derived rows, omits cleared blobs, and exposes no values', async () => {
    const h = fixture(); h.tool('legacy'); h.tool('old', 'old'); h.tool('current', 'current'); h.tool('cleared'); h.session('expired');
    h.db.prepare("UPDATE tool_key SET private_jwk_encrypted = ? WHERE kid = 'cleared'").run(new Uint8Array(0));
    const status = (await keyProviderStatus(h.db, h.provider));
    expect(status).toEqual({ kind: 'local-keyring', activeVersion: 'k2', versions: [
      { id: 'k2', state: 'active', sealedCount: 1, derivedCount: 0 },
      { id: 'legacy', state: 'decrypt-only', sealedCount: 2, derivedCount: 0 },
      { id: 'k1', state: 'decrypt-only', sealedCount: 1, derivedCount: 0 },
    ] });
    expect(JSON.stringify(status)).not.toContain('fixture:');
  });
});
