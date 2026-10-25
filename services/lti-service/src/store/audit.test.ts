// The audit writer (LA-ADR-06 D4): migrations 007 and 008, append only, list order and filters, details, one transaction.
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSqlite } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '../api-errors.ts';
import { openDb, transaction } from '../db/index.ts';
import { URLS } from '../testkit.ts';
import { ensureAccount } from './accounts.ts';
import type { AuditEventInput } from './audit.ts';
import { AUDIT_DETAILS_MAX_BYTES, auditDetailsText, insertAuditEvent, listAuditEvents, withAudit } from './audit.ts';
import { createPlatform, listPlatforms } from './platforms.ts';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const T0 = Date.parse('2026-10-22T10:00:00.000Z');
const temps: string[] = [];
afterEach(() => { for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true }); });

const event = (over: Partial<AuditEventInput> = {}): AuditEventInput => ({
  actor: { type: 'operator', id: 'alice' }, toolAccountId: 'cogniate', traceId: 't-1', clientIp: '127.0.0.1', action: 'platform.create',
  target: { type: 'platform', id: 'plt_1' }, result: 'ok', ...over,
});
const count = (db: ReturnType<typeof openDb>) => (db.prepare('SELECT COUNT(*) AS n FROM audit_event').get() as { n: number }).n;
const platformInput = { issuer: 'https://moodle2.test', clientId: 'c2', name: 'M2', authEndpoint: 'https://moodle2.test/a', tokenEndpoint: 'https://moodle2.test/t', jwksUrl: 'https://moodle2.test/k', deploymentIds: ['1'], active: true };

describe('007_audit_event', () => {
  it('AC-LA-E5-02-07: on a v6 database with rows it adds an empty table; UPDATE fails with "audit_event is append-only"', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lti-mig7-'));
    temps.push(dir);
    const v6 = join(dir, 'v6');
    mkdirSync(v6);
    for (const f of readdirSync(MIGRATIONS).filter((n) => n < '007')) copyFileSync(join(MIGRATIONS, f), join(v6, f));
    const file = join(dir, 'lti.db');
    let db = openSqlite(file, v6);
    db.prepare("INSERT INTO tool_account VALUES ('cogniate', 'C', 'h', 'l', 'd', 'r', 0)").run();
    db.close();
    db = openSqlite(file, MIGRATIONS);
    expect(db.prepare('SELECT id FROM tool_account').all()).toEqual([{ id: 'cogniate' }]);
    expect(count(db)).toBe(0);
    insertAuditEvent(db, event(), T0);
    expect(() => db.prepare("UPDATE audit_event SET result = 'refused'").run()).toThrow('audit_event is append-only');
    expect(() => db.prepare("UPDATE audit_event SET details = NULL WHERE action = 'platform.create'").run()).toThrow('audit_event is append-only');
    expect(listAuditEvents(db, { limit: 10 }).events.map((e) => e.result)).toEqual(['ok']);
    db.close();
  });
});

describe('008_audit_event_replace_guard', () => {
  it('keeps v7 audit rows and refuses both replacement forms without recursive triggers', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lti-mig8-'));
    temps.push(dir);
    const v7 = join(dir, 'v7');
    mkdirSync(v7);
    for (const f of readdirSync(MIGRATIONS).filter((n) => n < '008')) copyFileSync(join(MIGRATIONS, f), join(v7, f));
    const file = join(dir, 'lti.db');
    let db = openSqlite(file, v7);
    const id = insertAuditEvent(db, event({ details: { original: true } }), T0);
    const original = listAuditEvents(db, { limit: 10 }).events;
    db.close();
    db = openSqlite(file, MIGRATIONS);
    try {
      db.exec('PRAGMA recursive_triggers = OFF');
      expect(listAuditEvents(db, { limit: 10 }).events).toEqual(original);
      for (const command of ['REPLACE INTO', 'INSERT OR REPLACE INTO']) {
        expect(() => db.prepare(`${command} audit_event (id, ts, actor_type, actor_id, action, result)
          VALUES (?, ?, 'operator', 'another-actor', 'platform.delete', 'refused')`).run(id, T0 + 1))
          .toThrow('audit_event is append-only');
        expect(listAuditEvents(db, { limit: 10 }).events).toEqual(original);
      }
      insertAuditEvent(db, event(), T0 + 2);
      expect(count(db)).toBe(2);
    } finally { db.close(); }
  });
});

describe('insertAuditEvent and listAuditEvents', () => {
  it('BD-A2-51: retains valid opaque idempotency ids but still redacts credentials and malformed values', () => {
    expect(JSON.parse(auditDetailsText({ idempotencyKey: 'request-123', apiKey: 'secret' })!))
      .toEqual({ idempotencyKey: 'request-123', apiKey: '[redacted]' });
    expect(auditDetailsText({ idempotencyKey: `ltio_${'x'.repeat(43)}` })).not.toContain('x'.repeat(43));
    expect(auditDetailsText({ idempotencyKey: `ltis_${'x'.repeat(43)}` })).not.toContain('x'.repeat(43));
    for (const idempotencyKey of ['bad key', 'x'.repeat(65)]) {
      expect(JSON.parse(auditDetailsText({ idempotencyKey })!).idempotencyKey).toBe('[redacted]');
    }
  });

  it('stores every field and reads it back; details go through redact()', () => {
    const db = openDb(':memory:');
    const id = insertAuditEvent(db, event({ code: null, details: { fields: ['name'], apiKey: 'ltis_secret', note: `x ltio_${'a'.repeat(43)}` } }), T0);
    expect(id).toMatch(/^aud_[A-Za-z0-9_-]{22}$/);
    expect(listAuditEvents(db, { limit: 10 }).events).toEqual([{
      id, ts: T0, actor: { type: 'operator', id: 'alice' }, toolAccountId: 'cogniate', action: 'platform.create', target: { type: 'platform', id: 'plt_1' },
      result: 'ok', code: null, traceId: 't-1', clientIp: '127.0.0.1', details: { fields: ['name'], apiKey: '[redacted]', note: 'x [redacted-operator-key]' },
    }]);
  });

  it('keeps details at most 4 KB', () => {
    expect(auditDetailsText({ big: 'x'.repeat(AUDIT_DETAILS_MAX_BYTES) })).toBe('{"truncated":true}');
    expect(auditDetailsText({ ok: 'x'.repeat(100) })).toBe(JSON.stringify({ ok: 'x'.repeat(100) }));
    expect(auditDetailsText(null)).toBeNull();
  });

  it('lists newest first (ts, then id) with the filters, and pages with a cursor', () => {
    const db = openDb(':memory:');
    insertAuditEvent(db, event({ toolAccountId: 'cogniate', action: 'platform.create' }), T0);
    insertAuditEvent(db, event({ toolAccountId: 'qa-second', action: 'platform.create', actor: { type: 'api_key', id: 'bootstrap-qa-second' } }), T0 + 1);
    insertAuditEvent(db, event({ toolAccountId: 'cogniate', action: 'platform.update' }), T0 + 2);
    insertAuditEvent(db, event({ toolAccountId: null, action: 'operator_key.issue' }), T0 + 2);
    const all = listAuditEvents(db, { limit: 10 }).events;
    expect(all.map((e) => e.ts)).toEqual([T0 + 2, T0 + 2, T0 + 1, T0]);
    expect(all[0]!.id > all[1]!.id).toBe(true);
    // Tenant isolation: one tool account sees only its own rows (LA-ADR-07; AP-06-17).
    expect(listAuditEvents(db, { limit: 10, toolAccountId: 'qa-second' }).events.map((e) => e.toolAccountId)).toEqual(['qa-second']);
    expect(listAuditEvents(db, { limit: 10, toolAccountId: 'cogniate' }).events.map((e) => e.action)).toEqual(['platform.update', 'platform.create']);
    expect(listAuditEvents(db, { limit: 10, action: 'platform.create' }).events).toHaveLength(2);
    expect(listAuditEvents(db, { limit: 10, actorId: 'bootstrap-qa-second' }).events).toHaveLength(1);
    expect(listAuditEvents(db, { limit: 10, since: T0 + 1, until: T0 + 1 }).events.map((e) => e.ts)).toEqual([T0 + 1]);
    const first = listAuditEvents(db, { limit: 3 });
    expect(first.events.map((e) => e.id)).toEqual(all.slice(0, 3).map((e) => e.id));
    expect(first.next).toEqual({ ts: all[2]!.ts, id: all[2]!.id });
    const second = listAuditEvents(db, { limit: 3, cursor: first.next! });
    expect([second.events.map((e) => e.id), second.next]).toEqual([[all[3]!.id], null]);
  });
});

describe('withAudit (rule 1: one event per authenticated admin request)', () => {
  const base = { actor: { type: 'api_key' as const, id: 'bootstrap-cogniate' }, toolAccountId: 'cogniate', traceId: 't', clientIp: '127.0.0.1', action: 'platform.create', target: { type: 'platform', id: null } };
  const setup = () => {
    const db = openDb(':memory:');
    ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
    return db;
  };

  it.each([
    ['synchronous', (): string => 'missing change'],
    ['asynchronous', async (): Promise<string> => 'missing change'],
  ] as const)('fails a %s body that completes without a change', async (_name, body) => {
    const db = setup();
    try {
      await expect(withAudit(db, () => T0, base, body)).rejects.toThrow('without a successful audit.change()');
      expect(count(db)).toBe(0);
      expect(db.isTransaction).toBe(false);
    } finally { db.close(); }
  });

  it('refuses a second change before it writes data or a second event', async () => {
    const db = setup();
    try {
      let secondRan = false;
      await expect(withAudit(db, () => T0, base, (audit) => {
        audit.change(() => createPlatform(db, 'cogniate', platformInput));
        audit.change(() => { secondRan = true; });
      })).rejects.toThrow('audit.change() must be called only once');
      expect(secondRan).toBe(false);
      expect(listPlatforms(db, 'cogniate', {})).toHaveLength(1);
      expect(listAuditEvents(db, { limit: 10 }).events.map((e) => e.result)).toEqual(['ok']);
    } finally { db.close(); }
  });

  it('refuses a reentrant change and rolls back the first change with no event', async () => {
    const db = setup();
    try {
      await expect(withAudit(db, () => T0, base, (audit) => audit.change(() => {
        createPlatform(db, 'cogniate', platformInput);
        audit.change(() => undefined);
      }))).rejects.toThrow('audit.change() must be called only once');
      expect(listPlatforms(db, 'cogniate', {})).toEqual([]);
      expect(count(db)).toBe(0);
    } finally { db.close(); }
  });

  it('writes ok with the target of the result, in the change transaction', async () => {
    const db = setup();
    const p = await withAudit(db, () => T0, base, (audit) => audit.change(() => createPlatform(db, 'cogniate', platformInput), (made) => ({ target: { type: 'platform', id: made.id } })));
    expect(listAuditEvents(db, { limit: 10 }).events.map((e) => [e.action, e.result, e.target.id, e.code])).toEqual([['platform.create', 'ok', p.id, null]]);
  });

  it('writes refused with the code after a 4xx API error, and nothing for another error', async () => {
    const db = setup();
    await expect(withAudit(db, () => T0, base, () => { throw new ApiError('PLATFORM_ALREADY_EXISTS'); })).rejects.toThrow('PLATFORM_ALREADY_EXISTS');
    await expect(withAudit(db, () => T0, base, () => { throw new ApiError('INTERNAL_ERROR'); })).rejects.toThrow();
    await expect(withAudit(db, () => T0, base, () => { throw new Error('bug'); })).rejects.toThrow('bug');
    expect(listAuditEvents(db, { limit: 10 }).events.map((e) => [e.result, e.code])).toEqual([['refused', 'PLATFORM_ALREADY_EXISTS']]);
  });

  it('a 4xx in the change rolls the change back and writes only the refused event', async () => {
    const db = setup();
    await expect(withAudit(db, () => T0, base, (audit) => audit.change(() => {
      createPlatform(db, 'cogniate', platformInput);
      throw new ApiError('INVALID_REQUEST', 'Invalid field: x.');
    }))).rejects.toThrow('INVALID_REQUEST');
    expect(listPlatforms(db, 'cogniate', {}).map((p) => p.issuer)).not.toContain('https://moodle2.test');
    expect(listAuditEvents(db, { limit: 10 }).events.map((e) => [e.result, e.code])).toEqual([['refused', 'INVALID_REQUEST']]);
  });

  it('AC-LA-E5-02-08: a failure after the audit insert, in the same transaction, stores neither the change nor the event', () => {
    const db = setup();
    // The store function opens its own transaction(); inside the outer one it is a savepoint (shared transaction()).
    expect(() => transaction(db, () => {
      createPlatform(db, 'cogniate', platformInput);
      insertAuditEvent(db, event(), T0);
      throw new Error('a later step fails');
    })).toThrow('a later step fails');
    expect(listPlatforms(db, 'cogniate', {})).toEqual([]);
    expect(count(db)).toBe(0);
  });

  it('AC-LA-E5-02-08: when the audit insert fails, the change is rolled back too', async () => {
    const db = setup();
    db.exec("CREATE TRIGGER audit_down BEFORE INSERT ON audit_event BEGIN SELECT RAISE(ABORT, 'audit insert fails'); END;");
    await expect(withAudit(db, () => T0, base, (audit) => audit.change(() => createPlatform(db, 'cogniate', platformInput)))).rejects.toThrow('audit insert fails');
    expect(listPlatforms(db, 'cogniate', {})).toEqual([]);
    expect(count(db)).toBe(0);
  });
});

it('describes the successful action inside the transaction and keeps the base action on refusal', async () => {
  const db = openDb(':memory:');
  try {
    await withAudit(db, () => T0, event({ action: 'account.update' }), (audit) => audit.change(() => 'active', (status) => {
      expect(db.isTransaction).toBe(true);
      return { action: 'account.status', details: { status } };
    }));
    await expect(withAudit(db, () => T0, event({ action: 'account.update' }), (audit) => audit.change(() => {
      throw new ApiError('ACCOUNT_CLOSED');
    }, () => ({ action: 'account.status' })))).rejects.toThrow('ACCOUNT_CLOSED');
    expect(listAuditEvents(db, { limit: 10 }).events.map((e) => [e.action, e.result]).sort()).toEqual([
      ['account.status', 'ok'], ['account.update', 'refused'],
    ]);
  } finally { db.close(); }
});
