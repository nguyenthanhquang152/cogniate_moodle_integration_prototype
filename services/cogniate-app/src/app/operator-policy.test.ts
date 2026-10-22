import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluateOperatorPolicy } from './operator-policy.ts';
import type { OperatorPolicyDecision } from './operator-policy.ts';

const production = { STACK_PROFILE: 'production', OPERATORS: 'qa-op' };
const valid = { operator: 'qa-op', evidenceChannel: 'lms-admin-ticket', evidenceRef: 'TICKET-42', note: 'Private institution note' };
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function refusal(decision: OperatorPolicyDecision, reason: string, event = 'operator_refused'): void {
  expect(decision.allowed).toBe(false);
  if (decision.allowed) throw new Error('Expected refusal');
  expect(decision.message.split('\n')).toHaveLength(1);
  expect(JSON.parse(decision.message)).toEqual({ event, reason });
  expect(decision.message).not.toContain(valid.note);
}

describe('operator policy (LA-E5-11 AC-02..05, BD-A2-45)', () => {
  it('requires an explicit production operator even with OPERATOR_NAME', () => {
    refusal(evaluateOperatorPolicy({ evidenceChannel: valid.evidenceChannel, evidenceRef: valid.evidenceRef }, {
      ...production, OPERATOR_NAME: 'qa-op',
    }), 'operator_missing');
  });

  it('refuses an unknown operator and allows a listed operator with evidence', () => {
    refusal(evaluateOperatorPolicy({ ...valid, operator: 'other' }, production), 'operator_unknown');
    expect(evaluateOperatorPolicy(valid, production)).toEqual({
      allowed: true, actor: { type: 'operator', id: 'qa-op' },
      details: { evidence_channel: 'lms-admin-ticket', evidence_ref: 'TICKET-42', note_present: true },
    });
    expect(evaluateOperatorPolicy(valid, { ...production, OPERATORS: ' first, qa-op,third ' }).allowed).toBe(true);
    refusal(evaluateOperatorPolicy(valid, { STACK_PROFILE: 'production' }), 'operator_unknown');
  });

  it.each([
    [{ ...valid, evidenceChannel: undefined }, 'evidence_channel_missing'],
    [{ ...valid, evidenceRef: undefined }, 'evidence_ref_missing'],
    [{ ...valid, evidenceChannel: 'verified-admin-launch' }, 'evidence_channel_invalid'],
    [{ ...valid, evidenceChannel: 'unknown' }, 'evidence_channel_invalid'],
    [{ ...valid, evidenceRef: 'x'.repeat(201) }, 'evidence_ref_invalid'],
    [{ ...valid, evidenceRef: '' }, 'evidence_ref_invalid'],
    [{ ...valid, evidenceRef: '  ' }, 'evidence_ref_invalid'],
  ])('refuses invalid or missing production evidence: %j', (input, reason) => {
    refusal(evaluateOperatorPolicy(input, production), reason);
  });

  it.each(['institution-email', 'support-call', 'lms-admin-ticket', 'other'])('allows channel %s and boundary reference lengths', (evidenceChannel) => {
    for (const evidenceRef of ['x', 'x'.repeat(200)]) {
      expect(evaluateOperatorPolicy({ ...valid, evidenceChannel, evidenceRef }, production).allowed).toBe(true);
    }
  });

  it.each([undefined, 'default', 'acceptance'])('uses optional operator/evidence in profile %s', (STACK_PROFILE) => {
    expect(evaluateOperatorPolicy({}, { STACK_PROFILE })).toEqual({
      allowed: true, actor: { type: 'operator', id: 'unknown' }, details: { note_present: false },
    });
    expect(evaluateOperatorPolicy({}, { STACK_PROFILE, OPERATOR_NAME: 'ops1' })).toMatchObject({ actor: { id: 'ops1' } });
    expect(evaluateOperatorPolicy({ operator: 'explicit' }, { STACK_PROFILE, OPERATOR_NAME: 'ops1' }))
      .toMatchObject({ actor: { id: 'explicit' } });
    refusal(evaluateOperatorPolicy({ evidenceChannel: 'verified-admin-launch' }, { STACK_PROFILE }), 'evidence_channel_invalid');
    refusal(evaluateOperatorPolicy({ evidenceRef: 'x'.repeat(201) }, { STACK_PROFILE }), 'evidence_ref_invalid');
  });

  it.each(['default', 'acceptance', 'production'])('refuses both operator sources in %s without reading the file', (STACK_PROFILE) => {
    refusal(evaluateOperatorPolicy(valid, { STACK_PROFILE, OPERATORS: '', OPERATORS_FILE: '/not/a/real/file' }),
      'operators_ambiguous', 'config_refused');
  });

  it('loads the JSON operator list on each evaluation and fails closed on invalid or missing files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'operator-policy-'));
    dirs.push(dir);
    const file = join(dir, 'operators.json');
    const env = { STACK_PROFILE: 'production', OPERATORS_FILE: file };
    writeFileSync(file, JSON.stringify(['first', 'qa-op']));
    expect(evaluateOperatorPolicy(valid, env).allowed).toBe(true);
    writeFileSync(file, JSON.stringify(['other']));
    refusal(evaluateOperatorPolicy(valid, env), 'operator_unknown');
    for (const content of ['{', '{}', 'null', '[42]', '[""]', '["qa-op",null]']) {
      writeFileSync(file, content);
      refusal(evaluateOperatorPolicy(valid, env), 'operators_file_invalid', 'config_refused');
    }
    rmSync(file);
    refusal(evaluateOperatorPolicy(valid, env), 'operators_file_invalid', 'config_refused');
  });

  it('refuses an invalid profile or an empty explicit operator', () => {
    refusal(evaluateOperatorPolicy({}, { STACK_PROFILE: 'prod' }), 'stack_profile_invalid', 'config_refused');
    refusal(evaluateOperatorPolicy({ operator: ' ' }, {}), 'operator_missing');
  });
});
