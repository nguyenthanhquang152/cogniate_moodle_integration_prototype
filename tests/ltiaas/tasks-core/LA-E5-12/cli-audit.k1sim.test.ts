// LA-E5-12 K1-SIM acceptance tests (pending: Docker window):
// Runs inside the e2e container on a booked SIM slot with `tests/ltiaas/tasks-core/LA-E5-12/run.mjs`.
// - AC-LA-E5-12-01: With `STACK_PROFILE=production` in the CLI process, `app:grant issue …` without `--operator` exits
//   1 with one line; `app:grant list` shows no new grant and `app:audit list` shows no new event (AP-07-04).
// - AC-LA-E5-12-02: With `STACK_PROFILE=production` and `OPERATORS=qa-op`, `app:grant issue … --operator other …` exits
//   1 and stores nothing (AP-07-04); also when both `OPERATORS` and `OPERATORS_FILE` are set (BD-A2-45
//   `operators_ambiguous`), exits 1 and stores nothing.
// - AC-LA-E5-12-03: With `STACK_PROFILE=production`, `app:grant issue … --operator qa-op` without `--evidence-channel`
//   or without `--evidence-ref` exits 1 and stores nothing (AP-07-09).
// - AC-LA-E5-12-04: With `STACK_PROFILE=production`, `app:grant issue … --operator qa-op --evidence-channel support-call
//   --evidence-ref QA-1` succeeds; its one audit event has `details.evidence_channel`, `details.evidence_ref`,
//   `details.note_present` and no note text (AP-07-09).
// - AC-LA-E5-12-05: In the `acceptance` profile, the M1 grant and binding commands without the new flags work
//   unchanged; their events have actor `unknown` (or the `OPERATOR_NAME` value) (AP-07-05).
// - AC-LA-E5-12-06: Every `app:grant issue`, `revoke`, `app:binding suspend` and `release` run writes exactly one event
//   with the operator name, the connection, the result and `note_present`, visible in `app:audit list --connection <id>`
//   (AP-07-06).
// - AC-LA-E5-12-07: `app:grant revoke` of a redeemed grant exits 1 and writes one event with `result: refused`
//   (AP-07-06).
// Source: docs/architecture/ltiaas/tasks/LA-E5-12.md (at f01bfcd); LA-ADR-07 D4, D5; LA-ADR-06 D4 rule 4;
// cogniate-app-api-delta.md §7; build-decisions-A2.md BD-A2-45.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTROL_DIR, hostAction, type HostAction } from '../../../acceptance/lib/host-control';
import {
  createConnection,
  expectStatus,
  redeem,
  rememberSecret,
  session,
  sharedPlatform,
  unique,
  type Json,
} from '../../../acceptance/M1/common/client';

interface Qa3AppCliPayload {
  script: 'app:grant' | 'app:binding' | 'app:audit';
  args: string[];
  env?: Record<string, string>;
}

interface Qa3AppCliResult {
  script: string;
  args: string[];
  cliCode: number;
  stdout: string;
  stderr: string;
  cliLines: string[];
  stdoutLines: string[];
  stderrLines: string[];
}

async function runAppCli(
  script: 'app:grant' | 'app:binding' | 'app:audit',
  args: string[],
  env: Record<string, string> = {},
): Promise<Qa3AppCliResult> {
  const payload: Qa3AppCliPayload = { script, args, env };
  const act = await hostAction('qa3-app-cli' as HostAction, 120_000, {
    payload: payload as unknown as Record<string, unknown>,
    allowFail: true,
  });
  assert.ok(act.out, 'host runner returned no output file for qa3-app-cli');
  const out = JSON.parse(fs.readFileSync(path.join(CONTROL_DIR(), act.out), 'utf8')) as Qa3AppCliResult;
  for (const code of out.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/g) ?? []) {
    rememberSecret(code);
  }
  return out;
}

async function listGrantsForConnection(connectionId: string): Promise<string[]> {
  const res = await runAppCli('app:grant', ['list', '--connection', connectionId]);
  expect(res.cliCode).toBe(0);
  return res.stdoutLines.filter((line) => /\bgrt_[A-Za-z0-9_-]+\b/.test(line));
}

async function listAuditForConnection(connectionId: string): Promise<Json[]> {
  const res = await runAppCli('app:audit', ['list', '--connection', connectionId]);
  expect(res.cliCode, `app:audit list failed: ${res.stderr}`).toBe(0);
  return res.stdoutLines.filter((line) => line.trim().startsWith('{')).map((line) => JSON.parse(line) as Json);
}

function actorIdOf(event: Json): string {
  if (typeof event.actor === 'string') return event.actor;
  if (event.actor && typeof event.actor === 'object') return String(event.actor.id ?? '');
  return String(event.actor_id ?? '');
}

function baseIssueArgs(libraryId: string, connection: Json, deploymentId: string, note = 'QA-3 E5-12 private note'): string[] {
  return [
    'issue',
    '--library',
    libraryId,
    '--connection',
    String(connection.id),
    '--site',
    String(connection.siteUrl),
    '--client-id',
    'qa-bb-app',
    '--deployment-id',
    deploymentId,
    '--purpose',
    'initial',
    '--note',
    note,
  ];
}

describe('LA-E5-12 K1-SIM (pending: Docker window)', () => {
  it('AC-LA-E5-12-01: with STACK_PROFILE=production, app:grant issue without --operator exits 1 with one line and stores no grant and no audit event (AP-07-04)', async () => {
    await sharedPlatform();
    const s = await session('A');
    const conn = await createConnection(s);
    const depId = unique('dep-e512-ac01');

    const res = await runAppCli('app:grant', baseIssueArgs(s.library.id, conn, depId), {
      STACK_PROFILE: 'production',
      OPERATORS: 'qa-op',
    });

    expect(res.cliCode).toBe(1);
    expect(res.cliLines.length, `expected 1 refusal line, got: ${JSON.stringify(res.cliLines)}`).toBe(1);
    expect(await listGrantsForConnection(conn.id)).toEqual([]);
    expect(await listAuditForConnection(conn.id)).toEqual([]);
  });

  it('AC-LA-E5-12-02: with STACK_PROFILE=production and OPERATORS=qa-op, --operator other exits 1 and stores nothing (and OPERATORS+OPERATORS_FILE refuses as operators_ambiguous, BD-A2-45)', async () => {
    await sharedPlatform();
    const s = await session('A');
    const conn = await createConnection(s);
    const depId = unique('dep-e512-ac02');

    const resOther = await runAppCli(
      'app:grant',
      [
        ...baseIssueArgs(s.library.id, conn, depId),
        '--operator',
        'other',
        '--evidence-channel',
        'support-call',
        '--evidence-ref',
        'QA-2',
      ],
      {
        STACK_PROFILE: 'production',
        OPERATORS: 'qa-op',
      },
    );
    expect(resOther.cliCode).toBe(1);
    expect(resOther.cliLines.length).toBe(1);
    expect(await listGrantsForConnection(conn.id)).toEqual([]);
    expect(await listAuditForConnection(conn.id)).toEqual([]);

    // BD-A2-45: OPERATORS and OPERATORS_FILE both set -> refuse (`operators_ambiguous`), exit 1, nothing stored.
    const resAmbiguous = await runAppCli(
      'app:grant',
      [
        ...baseIssueArgs(s.library.id, conn, depId),
        '--operator',
        'qa-op',
        '--evidence-channel',
        'support-call',
        '--evidence-ref',
        'QA-2',
      ],
      {
        STACK_PROFILE: 'production',
        OPERATORS: 'qa-op',
        OPERATORS_FILE: '/tmp/nonexistent-operators.txt',
      },
    );
    expect(resAmbiguous.cliCode).toBe(1);
    expect(await listGrantsForConnection(conn.id)).toEqual([]);
    expect(await listAuditForConnection(conn.id)).toEqual([]);
  });

  it('AC-LA-E5-12-03: with STACK_PROFILE=production, app:grant issue --operator qa-op without --evidence-channel or without --evidence-ref exits 1 and stores nothing (AP-07-09)', async () => {
    await sharedPlatform();
    const s = await session('A');
    const conn = await createConnection(s);
    const depId = unique('dep-e512-ac03');

    const noChannel = await runAppCli(
      'app:grant',
      [...baseIssueArgs(s.library.id, conn, depId), '--operator', 'qa-op', '--evidence-ref', 'QA-3'],
      { STACK_PROFILE: 'production', OPERATORS: 'qa-op' },
    );
    expect(noChannel.cliCode).toBe(1);
    expect(noChannel.cliLines.length).toBe(1);

    const noRef = await runAppCli(
      'app:grant',
      [...baseIssueArgs(s.library.id, conn, depId), '--operator', 'qa-op', '--evidence-channel', 'support-call'],
      { STACK_PROFILE: 'production', OPERATORS: 'qa-op' },
    );
    expect(noRef.cliCode).toBe(1);
    expect(noRef.cliLines.length).toBe(1);

    expect(await listGrantsForConnection(conn.id)).toEqual([]);
    expect(await listAuditForConnection(conn.id)).toEqual([]);
  });

  it('AC-LA-E5-12-04: with STACK_PROFILE=production, app:grant issue --operator qa-op --evidence-channel support-call --evidence-ref QA-1 succeeds and writes one audit event with evidence fields, note_present and no note text (AP-07-09)', async () => {
    await sharedPlatform();
    const s = await session('A');
    const conn = await createConnection(s);
    const depId = unique('dep-e512-ac04');
    const secretNote = 'DO-NOT-STORE-IN-AUDIT-NOTE-E512-04';

    const res = await runAppCli(
      'app:grant',
      [
        ...baseIssueArgs(s.library.id, conn, depId, secretNote),
        '--operator',
        'qa-op',
        '--evidence-channel',
        'support-call',
        '--evidence-ref',
        'QA-1',
      ],
      { STACK_PROFILE: 'production', OPERATORS: 'qa-op' },
    );
    expect(res.cliCode, `expected exit 0, got ${res.cliCode}: ${res.stderr}`).toBe(0);
    expect((await listGrantsForConnection(conn.id)).length).toBe(1);

    const events = await listAuditForConnection(conn.id);
    expect(events.length).toBe(1);
    const ev = events[0];
    expect(ev.action).toBe('grant.issue');
    expect(ev.result).toBe('ok');
    expect(actorIdOf(ev)).toBe('qa-op');
    expect(ev.connection_id ?? ev.connectionId).toBe(conn.id);
    expect(ev.details?.evidence_channel).toBe('support-call');
    expect(ev.details?.evidence_ref).toBe('QA-1');
    expect(ev.details?.note_present).toBe(true);
    expect(JSON.stringify(ev).includes(secretNote), 'audit event must never contain the note text').toBe(false);
  });

  it('AC-LA-E5-12-05: in the acceptance profile, M1 grant and binding commands without new flags work unchanged with actor unknown or OPERATOR_NAME (AP-07-05)', async () => {
    await sharedPlatform();
    const s = await session('A');
    const conn = await createConnection(s);
    const depId = unique('dep-e512-ac05');

    // Issue without `--operator` or evidence flags -> actor `unknown`.
    const issueRes = await runAppCli('app:grant', baseIssueArgs(s.library.id, conn, depId));
    expect(issueRes.cliCode).toBe(0);
    const grantCode = issueRes.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/)?.[0];
    expect(grantCode).toBeTruthy();

    // Redeem so we can suspend and release the binding.
    expectStatus(await redeem(s, conn, depId, { code: grantCode! }), 200);

    // Suspend with OPERATOR_NAME=ops-env -> actor `ops-env`.
    const suspendRes = await runAppCli(
      'app:binding',
      ['suspend', '--connection', conn.id, '--note', 'M1 suspend without new flags'],
      { OPERATOR_NAME: 'ops-env' },
    );
    expect(suspendRes.cliCode).toBe(0);

    const releaseRes = await runAppCli('app:binding', [
      'release',
      '--connection',
      conn.id,
      '--note',
      'M1 release without new flags',
    ]);
    expect(releaseRes.cliCode).toBe(0);

    const events = await listAuditForConnection(conn.id);
    expect(events.length).toBe(3);
    const byAction = new Map(events.map((e) => [String(e.action), e]));
    expect(actorIdOf(byAction.get('grant.issue')!)).toBe('unknown');
    expect(actorIdOf(byAction.get('binding.suspend')!)).toBe('ops-env');
    expect(actorIdOf(byAction.get('binding.release')!)).toBe('unknown');
  });

  it('AC-LA-E5-12-06: every app:grant issue, revoke, app:binding suspend and release writes exactly one event with operator name, connection, result and note_present in app:audit list --connection <id> (AP-07-06)', async () => {
    await sharedPlatform();
    const s = await session('A');
    const conn = await createConnection(s);
    const dep1 = unique('dep-e512-ac06-1');
    const dep2 = unique('dep-e512-ac06-2');

    // 1. Issue grant 1 and revoke it (unredeemed).
    const issue1 = await runAppCli('app:grant', [
      ...baseIssueArgs(s.library.id, conn, dep1, 'note-1'),
      '--operator',
      'op-issue-1',
    ]);
    expect(issue1.cliCode).toBe(0);
    const grant1Id = issue1.stdout.match(/\bgrt_[A-Za-z0-9_-]+\b/)?.[0];
    expect(grant1Id).toBeTruthy();

    const revoke1 = await runAppCli('app:grant', ['revoke', '--grant', grant1Id!, '--operator', 'op-revoke-1']);
    expect(revoke1.cliCode).toBe(0);

    // 2. Issue grant 2, redeem it, then suspend and release the binding.
    const issue2 = await runAppCli('app:grant', [
      ...baseIssueArgs(s.library.id, conn, dep2, 'note-2'),
      '--operator',
      'op-issue-2',
    ]);
    expect(issue2.cliCode).toBe(0);
    const grant2Code = issue2.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/)?.[0];
    expectStatus(await redeem(s, conn, dep2, { code: grant2Code! }), 200);

    const suspend = await runAppCli('app:binding', [
      'suspend',
      '--connection',
      conn.id,
      '--note',
      'suspend-note',
      '--operator',
      'op-suspend',
      '--evidence-channel',
      'lms-admin-ticket',
      '--evidence-ref',
      'TKT-10',
    ]);
    expect(suspend.cliCode).toBe(0);

    const rel = await runAppCli('app:binding', [
      'release',
      '--connection',
      conn.id,
      '--note',
      'release-note',
      '--operator',
      'op-release',
      '--evidence-channel',
      'institution-email',
      '--evidence-ref',
      'EML-20',
    ]);
    expect(rel.cliCode).toBe(0);

    const events = await listAuditForConnection(conn.id);
    expect(events.length).toBe(5);
    for (const ev of events) {
      expect(ev.connection_id ?? ev.connectionId).toBe(conn.id);
      expect(ev.result).toBe('ok');
      expect(typeof ev.details?.note_present).toBe('boolean');
    }
    const actionsNewestFirst = events.map((e) => e.action);
    expect(actionsNewestFirst).toEqual([
      'binding.release',
      'binding.suspend',
      'grant.issue',
      'grant.revoke',
      'grant.issue',
    ]);
  });

  it('AC-LA-E5-12-07: app:grant revoke of a redeemed grant exits 1 and writes one event with result: refused (AP-07-06)', async () => {
    await sharedPlatform();
    const s = await session('A');
    const conn = await createConnection(s);
    const depId = unique('dep-e512-ac07');

    const issueRes = await runAppCli('app:grant', [
      ...baseIssueArgs(s.library.id, conn, depId),
      '--operator',
      'qa-op',
    ]);
    expect(issueRes.cliCode).toBe(0);
    const grantId = issueRes.stdout.match(/\bgrt_[A-Za-z0-9_-]+\b/)?.[0];
    const grantCode = issueRes.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/)?.[0];
    expect(grantId && grantCode).toBeTruthy();

    expectStatus(await redeem(s, conn, depId, { code: grantCode! }), 200);

    const revokeRedeemed = await runAppCli('app:grant', ['revoke', '--grant', grantId!, '--operator', 'qa-op']);
    expect(revokeRedeemed.cliCode).toBe(1);

    const events = await listAuditForConnection(conn.id);
    const refusedRevoke = events.find((e) => e.action === 'grant.revoke');
    expect(refusedRevoke).toBeDefined();
    expect(refusedRevoke!.result).toBe('refused');
    expect(actorIdOf(refusedRevoke!)).toBe('qa-op');
    expect(refusedRevoke!.connection_id ?? refusedRevoke!.connectionId).toBe(conn.id);
  });
});
