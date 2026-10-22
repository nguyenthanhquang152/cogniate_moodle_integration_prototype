// LA-E5-12 (LA-ADR-07 D4, D5; LA-ADR-06 D4 rule 4): the operator commands ask the operator policy first and write one
// app audit event per run, in the transaction of the local change. Unit level; QA proves the CLI processes (K1-SIM).
import { createLogger } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { grantsOfConnection } from '../domain/bindings.ts';
import { getConnectionAnyLibrary } from '../domain/connections.ts';
import type { TestApp } from '../testkit.ts';
import { TEST_CHANNELS, THANH, testApp } from '../testkit.ts';
import { listAuditEvents } from './audit.ts';
import { createBindingCleanup } from './binding-cleanup.ts';
import { createOperator } from './operator.ts';
import type { IssueInput } from './operator.ts';

const LEARN_A = 'https://learn-a.blackboard.sim.test';
const BB = 'qa-bb-app';
const NOTE = 'private note: ask Ms. Lan, phone 0901';
const PRODUCTION = { STACK_PROFILE: 'production', OPERATORS: 'qa-op, other-op' };

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let t: TestApp;
afterEach(async () => { await t?.app.close(); });

async function setup(env: NodeJS.ProcessEnv = {}) {
  t = await testApp({ outbound: { allowlist: [], request: async () => { throw new Error('unexpected outbound call'); } } });
  t.lti.addSharedPlatform('blackboard-sim', BB);
  const logger = createLogger({ service: 'cogniate-app', level: 'debug', write: (l) => t.logs.push(JSON.parse(l)) });
  const cleanup = createBindingCleanup({ db: t.db, lti: t.lti.client, logger, now: () => t.clock.now });
  const op = createOperator({ channels: TEST_CHANNELS, db: t.db, lti: t.lti.client, logger, cleanup, now: () => t.clock.now, env });
  const cookie = await t.login(THANH);
  const res = await t.app.inject({ method: 'POST', url: '/app-api/connections', headers: t.writeHeaders(cookie),
    payload: { name: 'Learn', siteUrl: LEARN_A, method: 'manual', lms: 'blackboard', profile: 'blackboard-sim' } });
  expect(res.statusCode).toBe(201);
  const con = res.json() as Json;
  const library = String(t.db.prepare('SELECT id FROM library WHERE name = ?').get(THANH.library)!.id);
  const input = (over: Partial<IssueInput> = {}): IssueInput => ({ library, connection: con.id, site: LEARN_A, clientId: BB, deploymentId: 'dA', note: NOTE, traceId: 'trace-1', ...over });
  const redeem = (code: string) => t.app.inject({ method: 'PUT', url: `/app-api/connections/${con.id}/platform`, headers: t.writeHeaders(cookie), payload: { deploymentId: 'dA', grantCode: code } });
  return { op, con, input, redeem };
}

const events = () => listAuditEvents(t.db, { limit: 500 }).events;
/** Events sort by time, newest first: each step runs one second later. */
const tick = () => { t.clock.now += 1000; };
const grantIdOf = (lines: string[]) => lines.find((l) => l.startsWith('Grant id: '))!.slice('Grant id: '.length);
const codeOf = (lines: string[]) => lines.find((l) => l.startsWith('Approval code (shown once): '))!.split(': ')[1]!;
const logged = (event: string) => t.logs.filter((l) => l.event === event);
const failTrigger = (name: string, when: string) =>
  t.db.exec(`CREATE TRIGGER ${name} ${when} BEGIN SELECT RAISE(ABORT, 'test: the local change fails'); END`);

describe('operator policy before any change (AP-07-04, AP-07-09)', () => {
  it('production refusals print the one policy line, exit 1, store no grant and no event, and log the reason', async () => {
    const { op, con, input } = await setup(PRODUCTION);
    const cases: Array<[Partial<IssueInput>, string]> = [
      [{}, 'operator_missing'],
      [{ operator: 'someone', evidenceChannel: 'support-call', evidenceRef: 'QA-1' }, 'operator_unknown'],
      [{ operator: 'qa-op', evidenceRef: 'QA-1' }, 'evidence_channel_missing'],
      [{ operator: 'qa-op', evidenceChannel: 'support-call' }, 'evidence_ref_missing'],
      [{ operator: 'qa-op', evidenceChannel: 'verified-admin-launch', evidenceRef: 'QA-1' }, 'evidence_channel_invalid'],
    ];
    for (const [over, reason] of cases) {
      const r = await op.issue(input(over));
      expect([r.exitCode, r.lines.length]).toEqual([1, 1]);
      expect(JSON.parse(r.lines[0]!)).toMatchObject({ event: 'operator_refused', reason });
    }
    expect(grantsOfConnection(t.db, con.id)).toEqual([]);
    expect(events()).toEqual([]);
    expect(logged('operator_refused').map((l) => l.reason)).toEqual(cases.map(([, reason]) => reason));
    expect(JSON.stringify(t.logs)).not.toContain(NOTE);
  });

  it('OPERATORS and OPERATORS_FILE together refuse every command (operators_ambiguous), also outside production', async () => {
    const { op, con, input } = await setup({ OPERATORS: 'qa-op', OPERATORS_FILE: '/nonexistent/operators.json' });
    const results = [await op.issue(input({ operator: 'qa-op' })), await op.suspend(con.id, 'n', 't', { operator: 'qa-op' }),
      await op.release(con.id, 'n', 't'), await op.revoke('grt_unknown', 't')];
    for (const r of results) expect([r.exitCode, JSON.parse(r.lines[0]!)]).toEqual([1, expect.objectContaining({ event: 'config_refused', reason: 'operators_ambiguous' })]);
    expect(getConnectionAnyLibrary(t.db, con.id)!.status).toBe('pending');
    expect([grantsOfConnection(t.db, con.id), events()]).toEqual([[], []]);
    expect(logged('config_refused')).toHaveLength(4);
  });

  it('production: a listed operator with both evidence fields issues; the one event holds the evidence and no note text or code', async () => {
    const { op, con, input } = await setup(PRODUCTION);
    const r = await op.issue(input({ operator: 'qa-op', evidenceChannel: 'support-call', evidenceRef: 'QA-1' }));
    expect(r.exitCode, r.lines.join('\n')).toBe(0);
    const [event, ...others] = events();
    expect(others).toEqual([]);
    expect(event).toMatchObject({
      actor: { type: 'operator', id: 'qa-op' }, libraryId: con.libraryId ?? expect.any(String), connectionId: con.id, action: 'grant.issue',
      target: { type: 'grant', id: grantIdOf(r.lines) }, result: 'ok', code: null, traceId: 'trace-1', clientIp: null,
      details: { evidence_channel: 'support-call', evidence_ref: 'QA-1', note_present: true },
    });
    expect(JSON.stringify(event)).not.toContain(NOTE);
    expect(JSON.stringify(event)).not.toContain(codeOf(r.lines));
  });

  it('default and acceptance profiles: the M1 commands work without the new flags; the actor is OPERATOR_NAME, else unknown', async () => {
    const { op, con, input, redeem } = await setup({ STACK_PROFILE: 'acceptance' });
    const issued = await op.issue(input());
    expect(issued.exitCode).toBe(0);
    expect((await redeem(codeOf(issued.lines))).statusCode).toBe(200);
    await t.app.close();
    const again = await setup({ OPERATOR_NAME: 'ops-env' });
    expect((await again.op.suspend(again.con.id, 'ticket-2', 't')).exitCode).toBe(0);
    expect(events().map((e) => [e.action, e.actor.id, e.details])).toEqual([['binding.suspend', 'ops-env', { note_present: true }]]);
    expect(con.id).not.toBe(again.con.id);
  });
});

describe('app:grant revoke in production (BD-A2-63: the operator rule without evidence)', () => {
  it('a production revoke needs a listed operator but no evidence fields', async () => {
    const { op, input } = await setup(PRODUCTION);
    const issued = await op.issue(input({ operator: 'qa-op', evidenceChannel: 'support-call', evidenceRef: 'QA-1' }));
    const grantId = grantIdOf(issued.lines);
    for (const [flags, reason] of [[{}, 'operator_missing'], [{ operator: 'someone' }, 'operator_unknown']] as const) {
      const refused = await op.revoke(grantId, 't', flags);
      expect([refused.exitCode, JSON.parse(refused.lines[0]!).reason]).toEqual([1, reason]);
    }
    expect(events()).toHaveLength(1);
    tick();
    expect((await op.revoke(grantId, 't', { operator: 'other-op' })).exitCode).toBe(0);
    expect(events()[0]).toMatchObject({ action: 'grant.revoke', result: 'ok', actor: { id: 'other-op' }, details: { note_present: false } });
  });
});

describe('one audit event per command (AP-07-06)', () => {
  it('issue, revoke, issue, suspend and release write one ok event each, with the operator, the connection and note_present', async () => {
    const { op, con, input, redeem } = await setup();
    const first = await op.issue(input({ operator: 'op-issue-1' }));
    tick();
    expect((await op.revoke(grantIdOf(first.lines), 't-revoke', { operator: 'op-revoke' })).exitCode).toBe(0);
    tick();
    const second = await op.issue(input({ operator: 'op-issue-2' }));
    expect((await redeem(codeOf(second.lines))).statusCode).toBe(200);
    tick();
    expect((await op.suspend(con.id, 'suspend note', 't-suspend', { operator: 'op-suspend', evidenceChannel: 'lms-admin-ticket', evidenceRef: 'TKT-10' })).exitCode).toBe(0);
    tick();
    expect((await op.release(con.id, 'release note', 't-release', { operator: 'op-release', evidenceChannel: 'institution-email', evidenceRef: 'EML-20' })).exitCode).toBe(0);
    const list = events();
    expect(list.map((e) => [e.action, e.actor.id, e.result, e.connectionId, e.target])).toEqual([
      ['binding.release', 'op-release', 'ok', con.id, { type: 'binding', id: con.id }],
      ['binding.suspend', 'op-suspend', 'ok', con.id, { type: 'binding', id: con.id }],
      ['grant.issue', 'op-issue-2', 'ok', con.id, { type: 'grant', id: grantIdOf(second.lines) }],
      ['grant.revoke', 'op-revoke', 'ok', con.id, { type: 'grant', id: grantIdOf(first.lines) }],
      ['grant.issue', 'op-issue-1', 'ok', con.id, { type: 'grant', id: grantIdOf(first.lines) }],
    ]);
    expect(list.map((e) => e.details)).toEqual([
      { evidence_channel: 'institution-email', evidence_ref: 'EML-20', note_present: true },
      { evidence_channel: 'lms-admin-ticket', evidence_ref: 'TKT-10', note_present: true },
      { note_present: true }, { note_present: false }, { note_present: true },
    ]);
    expect(listAuditEvents(t.db, { connectionId: con.id, limit: 500 }).events).toHaveLength(5);
    expect(JSON.stringify(list)).not.toMatch(/private note|suspend note|release note/);
  });

  it('a refusal on a known grant or connection writes one refused event with a stable code; an unknown target writes none', async () => {
    const { op, con, input, redeem } = await setup();
    const issued = await op.issue(input({ operator: 'qa-op' }));
    expect((await redeem(codeOf(issued.lines))).statusCode).toBe(200);
    const before = events().length;
    const cases: Array<[() => Promise<{ exitCode: number; lines: string[] }>, string, string]> = [
      [() => op.revoke(grantIdOf(issued.lines), 't', { operator: 'qa-op' }), 'grant.revoke', 'grant_redeemed'],
      [() => op.issue(input({ operator: 'qa-op' })), 'grant.issue', 'connection_not_pending'],
      [() => op.issue(input({ operator: 'qa-op', ttlSeconds: 5 })), 'grant.issue', 'ttl_invalid'],
      [() => op.release(con.id, 'n', 't', { operator: 'qa-op' }), 'binding.release', 'binding_active'],
      [() => op.suspend(con.id, '', 't', { operator: 'qa-op' }), 'binding.suspend', 'note_invalid'],
    ];
    for (const [run, action, code] of cases) {
      tick();
      const r = await run();
      expect(r.exitCode, `${action} ${code}`).toBe(1);
      expect(events()[0]).toMatchObject({ action, code, result: 'refused', actor: { id: 'qa-op' }, connectionId: con.id });
    }
    expect(events()).toHaveLength(before + cases.length);
    expect(events()[4]).toMatchObject({ action: 'grant.revoke', target: { type: 'grant', id: grantIdOf(issued.lines) } });
    expect(events()[3]).toMatchObject({ action: 'grant.issue', target: { type: 'grant', id: null } });
    // The M1 lines do not change.
    expect((await op.revoke(grantIdOf(issued.lines), 't')).lines).toEqual(['This grant is redeemed. Use app:binding suspend instead.']);
    const count = events().length;
    expect((await op.issue(input({ connection: 'con_unknown' }))).lines).toEqual(['Unknown connection: con_unknown.']);
    expect((await op.revoke('grt_unknown', 't')).lines).toEqual(['Unknown grant: grt_unknown.']);
    expect((await op.suspend('con_unknown', 'n', 't')).lines).toEqual(['Unknown connection: con_unknown.']);
    expect(events()).toHaveLength(count);
  });
});

describe('AC-LA-E5-12-08: the event and the local change commit or roll back together', () => {
  it('AC-LA-E5-12-08: when the local change of issue, revoke, suspend or release fails in its transaction, no audit event is stored', async () => {
    const { op, con, input, redeem } = await setup();
    failTrigger('fail_grant_insert', 'BEFORE INSERT ON binding_grant');
    await expect(op.issue(input({ operator: 'qa-op' }))).rejects.toThrow(/the local change fails/);
    expect([grantsOfConnection(t.db, con.id), events()]).toEqual([[], []]);
    t.db.exec('DROP TRIGGER fail_grant_insert');

    const issued = await op.issue(input({ operator: 'qa-op' }));
    failTrigger('fail_grant_update', 'BEFORE UPDATE ON binding_grant');
    await expect(op.revoke(grantIdOf(issued.lines), 't', { operator: 'qa-op' })).rejects.toThrow(/the local change fails/);
    expect(events().map((e) => e.action)).toEqual(['grant.issue']);
    expect(grantsOfConnection(t.db, con.id)[0]!.revokedAt).toBeNull();
    t.db.exec('DROP TRIGGER fail_grant_update');

    expect((await redeem(codeOf(issued.lines))).statusCode).toBe(200);
    failTrigger('fail_connection_update', "BEFORE UPDATE OF status ON connection WHEN NEW.status = 'disabled'");
    await expect(op.suspend(con.id, 'n', 't', { operator: 'qa-op' })).rejects.toThrow(/the local change fails/);
    expect(getConnectionAnyLibrary(t.db, con.id)!.status).toBe('registered');
    expect(events().map((e) => e.action)).toEqual(['grant.issue']);
    t.db.exec('DROP TRIGGER fail_connection_update');

    tick();
    expect((await op.suspend(con.id, 'n', 't', { operator: 'qa-op' })).exitCode).toBe(0);
    failTrigger('fail_reservation_delete', 'BEFORE DELETE ON connection_deployment');
    await expect(op.release(con.id, 'n', 't', { operator: 'qa-op' })).rejects.toThrow(/the local change fails/);
    expect(events().map((e) => e.action)).toEqual(['binding.suspend', 'grant.issue']);
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM connection_deployment WHERE connection_id = ?').get(con.id)!.n).toBe(1);
  });

  it('AC-LA-E5-12-08: when the event cannot be stored, the local change rolls back', async () => {
    const { op, con, input } = await setup();
    failTrigger('fail_audit_insert', 'BEFORE INSERT ON audit_event');
    await expect(op.issue(input({ operator: 'qa-op' }))).rejects.toThrow(/the local change fails/);
    await expect(op.suspend(con.id, 'n', 't', { operator: 'qa-op' })).rejects.toThrow(/the local change fails/);
    expect(grantsOfConnection(t.db, con.id)).toEqual([]);
    expect(getConnectionAnyLibrary(t.db, con.id)!.status).toBe('pending');
  });
});
