import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { openDb, transaction } from '../domain/db.ts';
import type { Db } from '../domain/db.ts';
import { ApiError } from './api-errors.ts';
import { AUDIT_DETAILS_MAX_BYTES, auditDetailsText, insertAuditEvent, listAuditEvents, withAudit } from './audit.ts';
import type { AuditEventInput } from './audit.ts';

const dirs: string[] = [];
const databases: Db[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const open = () => { const db = openDb(':memory:'); databases.push(db); return db; };
const event = (overrides: Partial<AuditEventInput> = {}): AuditEventInput => ({
  actor: { type: 'operator', id: 'qa-op' }, libraryId: 'lib_1', connectionId: 'con_1',
  traceId: 'trace-1', clientIp: null, action: 'grant.issue', target: { type: 'grant', id: 'grant_1' }, result: 'ok', ...overrides,
});
const count = (db: Db) => (db.prepare('SELECT COUNT(*) AS n FROM audit_event').get() as { n: number }).n;
const addLibrary = (db: Db, id = 'lib_1') => db.prepare('INSERT INTO library VALUES (?, ?, 1)').run(id, 'Library');
const libraries = (db: Db) => db.prepare('SELECT id FROM library ORDER BY id').all();

describe('migration 015 (AC-LA-E5-11-01, BD-A2-45)', () => {
  it('keeps old connection rows unchanged, adds an empty audit table, and guards updates and replacements', () => {
    const dir = mkdtempSync(join(tmpdir(), 'app-mig15-'));
    dirs.push(dir);
    const old = join(dir, 'old');
    mkdirSync(old);
    const migrations = fileURLToPath(new URL('../domain/migrations', import.meta.url));
    for (const file of readdirSync(migrations).filter((name) => name < '015')) copyFileSync(join(migrations, file), join(old, file));
    const path = join(dir, 'cogniate.db');
    let db = openDb(path, old);
    addLibrary(db);
    db.prepare(`INSERT INTO connection (id, library_id, name, site_url, method, status, created_at, updated_at, channel, binding_authority)
      VALUES ('con_1', 'lib_1', 'Existing', 'https://lms.test', 'manual', 'pending', 1, 2, 'canvas', 'operatorGrant')`).run();
    const before = db.prepare('SELECT * FROM connection').all();
    db.close();
    db = openDb(path);
    databases.push(db);
    expect(db.prepare('SELECT * FROM connection').all()).toEqual(before);
    expect(count(db)).toBe(0);
    const id = insertAuditEvent(db, event(), 10);
    const original = listAuditEvents(db, { limit: 10 });
    expect(() => db.prepare('UPDATE audit_event SET details = NULL').run()).toThrow('audit_event is append-only');
    db.exec('PRAGMA recursive_triggers = OFF');
    for (const command of ['INSERT OR REPLACE', 'REPLACE']) {
      expect(() => db.prepare(`${command} INTO audit_event (id, ts, actor_type, actor_id, action, result)
        VALUES (?, 11, 'operator', 'other', 'grant.revoke', 'refused')`).run(id)).toThrow('audit_event is append-only');
    }
    expect(listAuditEvents(db, { limit: 10 })).toEqual(original);
    expect(db.prepare('PRAGMA index_info(audit_event_connection)').all().map((row) => row.name)).toEqual(['library_id', 'connection_id', 'ts']);
  });
});

describe('app audit insert and list (AC-LA-E5-11-06)', () => {
  it('round-trips the event with its connection separate from its grant target and redacts app secrets at any depth', () => {
    const db = open();
    const details = {
      evidence_channel: 'support-call', evidence_ref: 'CALL-42', note_present: true, note: 'Private note',
      apiKey: 'key-value', token: 'token-value', grant_code: 'grant-value', nested: [{ NoteText: 'Nested note', approvalCode: 'approval-value' }],
      notes: 'Notes text', operatorNote: 'Operator note', grant_note: 'Grant note', approvalCodeShown: 'shown-value', 'grant-code-hash': 'hash-value',
    };
    const id = insertAuditEvent(db, event({ details }), 42);
    const rows = listAuditEvents(db, { limit: 10 }).events;
    expect(rows).toEqual([{
      ...event(), id, ts: 42, code: null,
      details: {
        evidence_channel: 'support-call', evidence_ref: 'CALL-42', note_present: true, note: '[redacted]',
        apiKey: '[redacted]', token: '[redacted]', grant_code: '[redacted]', nested: [{ NoteText: '[redacted]', approvalCode: '[redacted]' }],
        notes: '[redacted]', operatorNote: '[redacted]', grant_note: '[redacted]', approvalCodeShown: '[redacted]', 'grant-code-hash': '[redacted]',
      },
    }]);
    expect(id).toMatch(/^aud_[A-Za-z0-9_-]{22}$/);
    expect(details.note).toBe('Private note');
    const stored = String(db.prepare('SELECT details FROM audit_event').get()!.details);
    for (const secret of ['Private note', 'key-value', 'token-value', 'grant-value', 'Nested note', 'approval-value',
      'Notes text', 'Operator note', 'Grant note', 'shown-value', 'hash-value']) expect(stored).not.toContain(secret);
  });

  it('hides every code field on purpose, also an error code, and keeps note_present and evidence_ref (B-LA-E5-11-02)', () => {
    expect(JSON.parse(auditDetailsText({ code: 'INVALID_REQUEST', Code: 'ABC-123', note_present: true, evidence_ref: 'T-1', approval: 'kept' })!))
      .toEqual({ code: '[redacted]', Code: '[redacted]', note_present: true, evidence_ref: 'T-1', approval: 'kept' });
  });

  it('measures UTF-8 bytes after redaction and truncates above 4096 without blocking a change (BD-A2-45)', async () => {
    expect(auditDetailsText(null)).toBeNull();
    const boundary = { text: 'x'.repeat(AUDIT_DETAILS_MAX_BYTES - Buffer.byteLength('{"text":""}')) };
    expect(Buffer.byteLength(auditDetailsText(boundary)!)).toBe(4096);
    expect(auditDetailsText({ text: boundary.text + 'x' })).toBe('{"truncated":true}');
    expect(auditDetailsText({ text: 'é'.repeat(2048) })).toBe('{"truncated":true}');
    expect(auditDetailsText({ token: 'x'.repeat(5000), note: 'y'.repeat(5000) })).toBe('{"token":"[redacted]","note":"[redacted]"}');
    const db = open();
    await withAudit(db, () => 1, event({ details: { text: 'x'.repeat(5000) } }), (audit) => audit.change(() => addLibrary(db)));
    expect(libraries(db)).toEqual([{ id: 'lib_1' }]);
    expect(listAuditEvents(db, { limit: 1 }).events[0]!.details).toEqual({ truncated: true });
  });

  it('filters library, connection, action, actor and inclusive time range and paginates equal timestamps', () => {
    const db = open();
    const ids = Array.from({ length: 3 }, () => insertAuditEvent(db, event(), 20)).sort().reverse();
    insertAuditEvent(db, event(), 19);
    insertAuditEvent(db, event(), 21);
    insertAuditEvent(db, event({ libraryId: 'lib_2' }), 20);
    insertAuditEvent(db, event({ connectionId: 'con_2' }), 20);
    insertAuditEvent(db, event({ action: 'binding.suspend' }), 20);
    insertAuditEvent(db, event({ actor: { type: 'system', id: 'job' }, connectionId: null }), 20);
    const filter = { libraryId: 'lib_1', connectionId: 'con_1', action: 'grant.issue', actorId: 'qa-op', since: 20, until: 20, limit: 2 };
    const first = listAuditEvents(db, filter);
    expect(first.events.map((row) => row.id)).toEqual(ids.slice(0, 2));
    expect(first.next).toEqual({ ts: 20, id: ids[1] });
    const second = listAuditEvents(db, { ...filter, cursor: first.next! });
    expect(second.events.map((row) => row.id)).toEqual(ids.slice(2));
    expect(second.next).toBeNull();
    expect(listAuditEvents(db, { connectionId: "con_1' OR 1=1 --", limit: 500 }).events).toEqual([]);
    for (const limit of [0, -1, 501, 1.5, NaN]) expect(() => listAuditEvents(db, { limit })).toThrow(RangeError);
  });
});

describe('withAudit transaction rules T0–T5 and described actions', () => {
  it('uses nested store transactions and describes the changed target and action in the same transaction', async () => {
    const db = open();
    await withAudit(db, () => 1, event(), (audit) => audit.change(() => transaction(db, () => {
      addLibrary(db);
      expect(db.isTransaction).toBe(true);
      return 'lib_1';
    }), (id) => {
      expect(db.isTransaction).toBe(true);
      return { action: 'binding.suspend', target: { type: 'binding', id }, details: { note_present: true } };
    }));
    expect(libraries(db)).toEqual([{ id: 'lib_1' }]);
    expect(listAuditEvents(db, { limit: 10 }).events).toMatchObject([{
      action: 'binding.suspend', target: { type: 'binding', id: 'lib_1' }, result: 'ok', details: { note_present: true },
    }]);
  });

  it('rolls back nested writes on a 4xx and writes one refusal with the base action after rollback', async () => {
    const db = open();
    const error = new ApiError('GRANT_MISMATCH');
    await expect(withAudit(db, () => 2, event(), (audit) => audit.change(() => {
      transaction(db, () => addLibrary(db));
      throw error;
    }, () => ({ action: 'binding.suspend' })))).rejects.toBe(error);
    expect(libraries(db)).toEqual([]);
    expect(listAuditEvents(db, { limit: 10 }).events).toMatchObject([{ action: 'grant.issue', result: 'refused', code: 'GRANT_MISMATCH' }]);
  });

  it('audits an authorized pre-change 4xx, but not a bug or 5xx', async () => {
    const db = open();
    for (const error of [new ApiError('INTERNAL_ERROR'), new TypeError('bug')]) {
      await expect(withAudit(db, () => 1, event(), () => { throw error; })).rejects.toBe(error);
      expect(count(db)).toBe(0);
    }
    const error = new ApiError('GRANT_INVALID');
    await expect(withAudit(db, () => 1, event(), () => { throw error; })).rejects.toBe(error);
    expect(listAuditEvents(db, { limit: 10 }).events[0]!.code).toBe('GRANT_INVALID');
  });

  it('rolls back the change when describe or the audit insert fails', async () => {
    const db = open();
    const error = new Error('describe failed');
    await expect(withAudit(db, () => 1, event(), (audit) => audit.change(() => addLibrary(db), () => { throw error; }))).rejects.toBe(error);
    expect(libraries(db)).toEqual([]);
    expect(count(db)).toBe(0);
    db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_event BEGIN SELECT RAISE(ABORT, 'audit write failed'); END");
    await expect(withAudit(db, () => 1, event(), (audit) => audit.change(() => addLibrary(db)))).rejects.toThrow('audit write failed');
    expect(libraries(db)).toEqual([]);
    expect(count(db)).toBe(0);
  });

  it.each(['change', 'describe'])('rejects a thenable from %s and rolls back all writes', async (where) => {
    const db = open();
    const thenable = { then() { throw new Error('must not call then'); } };
    await expect(withAudit(db, () => 1, event(), (audit) => audit.change(() => {
      addLibrary(db);
      return where === 'change' ? thenable : 'done';
    }, () => where === 'describe' ? Object.assign({ details: {} }, thenable) : {}))).rejects.toThrow('must be synchronous');
    expect(libraries(db)).toEqual([]);
    expect(count(db)).toBe(0);
  });

  it('requires exactly one change and does not append a refusal after a committed success', async () => {
    const db = open();
    await expect(withAudit(db, () => 1, event(), () => 'no change')).rejects.toThrow('without a successful audit.change');
    expect(count(db)).toBe(0);
    await expect(withAudit(db, () => 1, event(), (audit) => {
      audit.change(() => addLibrary(db));
      audit.change(() => addLibrary(db, 'lib_2'));
    })).rejects.toThrow('only once');
    expect(libraries(db)).toEqual([{ id: 'lib_1' }]);
    expect(count(db)).toBe(1);
    const error = new ApiError('GRANT_MISMATCH');
    await expect(withAudit(db, () => 1, event(), (audit) => {
      audit.change(() => addLibrary(db, 'lib_2'));
      throw error;
    })).rejects.toBe(error);
    expect(listAuditEvents(db, { limit: 10 }).events.map((row) => row.result)).toEqual(['ok', 'ok']);
  });

  it('keeps the first SQLite error when nested SQL cancels the whole transaction', async () => {
    const db = open();
    addLibrary(db);
    await expect(withAudit(db, () => 1, event(), (audit) => audit.change(() => transaction(db, () => {
      addLibrary(db, 'lib_2');
      db.prepare("INSERT OR ROLLBACK INTO library VALUES ('lib_1', 'duplicate', 2)").run();
    })))).rejects.toThrow('UNIQUE constraint failed: library.id');
    expect(libraries(db)).toEqual([{ id: 'lib_1' }]);
    expect(count(db)).toBe(0);
    expect(db.isTransaction).toBe(false);
  });
});
