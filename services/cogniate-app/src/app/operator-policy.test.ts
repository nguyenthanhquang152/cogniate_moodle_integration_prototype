import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluateOperatorPolicy, OPERATOR_REFUSALS } from './operator-policy.ts';
import type { OperatorPolicyDecision, OperatorPolicyInput, OperatorRefusalCode } from './operator-policy.ts';

const production = { STACK_PROFILE: 'production', OPERATORS: 'qa-op' };
const valid = { operator: 'qa-op', evidenceChannel: 'lms-admin-ticket', evidenceRef: 'TICKET-42', note: 'Private institution note' };
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function refusal(decision: OperatorPolicyDecision, reason: OperatorRefusalCode, event = 'operator_refused'): void {
  expect(decision.allowed).toBe(false);
  if (decision.allowed) throw new Error('Expected refusal');
  expect(decision.message.split('\n')).toHaveLength(1);
  expect(JSON.parse(decision.message)).toEqual({ event, reason, message: OPERATOR_REFUSALS[reason][1] });
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
  });

  it('BD-A2-63: evidenceRequired false skips only the missing-evidence checks in production; the default stays true', () => {
    const revoke = { operator: 'qa-op', evidenceRequired: false };
    expect(evaluateOperatorPolicy(revoke, production)).toEqual({
      allowed: true, actor: { type: 'operator', id: 'qa-op' }, details: { note_present: false },
    });
    expect(evaluateOperatorPolicy({ ...revoke, evidenceChannel: 'support-call', evidenceRef: 'CALL-7' }, production)).toMatchObject({
      allowed: true, details: { evidence_channel: 'support-call', evidence_ref: 'CALL-7' },
    });
    refusal(evaluateOperatorPolicy({ ...revoke, evidenceChannel: 'verified-admin-launch' }, production), 'evidence_channel_invalid');
    refusal(evaluateOperatorPolicy({ ...revoke, evidenceRef: 'x'.repeat(201) }, production), 'evidence_ref_invalid');
    refusal(evaluateOperatorPolicy({ evidenceRequired: false }, production), 'operator_missing');
    refusal(evaluateOperatorPolicy({ ...revoke, operator: 'other' }, production), 'operator_unknown');
    refusal(evaluateOperatorPolicy(revoke, { STACK_PROFILE: 'production' }), 'operators_not_configured', 'config_refused');
    for (const evidenceRequired of [true, undefined]) {
      refusal(evaluateOperatorPolicy({ operator: 'qa-op', evidenceRequired }, production), 'evidence_channel_missing');
      refusal(evaluateOperatorPolicy({ operator: 'qa-op', evidenceChannel: 'other', evidenceRequired }, production), 'evidence_ref_missing');
    }
  });

  it('refuses production with no operator list, or an empty one, as operators_not_configured (BD-A2-59)', () => {
    for (const env of [{ STACK_PROFILE: 'production' }, { STACK_PROFILE: 'production', OPERATORS: '' }, { STACK_PROFILE: 'production', OPERATORS: ' , ' }]) {
      refusal(evaluateOperatorPolicy(valid, env), 'operators_not_configured', 'config_refused');
    }
    const dir = mkdtempSync(join(tmpdir(), 'operator-policy-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'operators.json'), '[]');
    refusal(evaluateOperatorPolicy(valid, { STACK_PROFILE: 'production', OPERATORS_FILE: join(dir, 'operators.json') }), 'operators_not_configured', 'config_refused');
  });

  // One row per code: the exact LA-ADR-07 D4 text. The message never repeats an input value.
  it.each([
    ['operators_ambiguous', 'config_refused', 'Set only one of OPERATORS and OPERATORS_FILE, then run the command again.', valid, { ...production, OPERATORS_FILE: '/not/a/real/file' }],
    ['operators_not_configured', 'config_refused', 'Set OPERATORS or OPERATORS_FILE to the allowed operator names, then run the command again.', valid, { STACK_PROFILE: 'production' }],
    ['operators_file_invalid', 'config_refused', 'OPERATORS_FILE must be a JSON array of operator names. Correct the file, then run the command again.', valid, { STACK_PROFILE: 'production', OPERATORS_FILE: '/not/a/real/file' }],
    ['stack_profile_invalid', 'config_refused', 'Set STACK_PROFILE to default, acceptance or production.', valid, { STACK_PROFILE: 'prod' }],
    ['operator_missing', 'operator_refused', 'Add --operator <your name>, then run the command again.', { ...valid, operator: undefined }, production],
    ['operator_unknown', 'operator_refused', 'Your operator name is not in the allowed list. Use your listed name, or ask an administrator to add it.', { ...valid, operator: 'not-listed-person' }, production],
    ['evidence_channel_missing', 'operator_refused', 'Add --evidence-channel (institution-email, support-call, lms-admin-ticket or other), then run the command again.', { ...valid, evidenceChannel: undefined }, production],
    ['evidence_ref_missing', 'operator_refused', 'Add --evidence-ref <ticket or message reference>, then run the command again.', { ...valid, evidenceRef: undefined }, production],
    ['evidence_channel_invalid', 'operator_refused', 'Use one of these evidence channels: institution-email, support-call, lms-admin-ticket, other.', { ...valid, evidenceChannel: 'verified-admin-launch' }, production],
    ['evidence_ref_invalid', 'operator_refused', 'Give an evidence reference of 1 to 200 characters.', { ...valid, evidenceRef: 'TICKET-'.repeat(30) }, production],
  ])('gives %s as %s with its fixed message (BD-A2-59)', (reason, event, message, input, env) => {
    const line = JSON.stringify({ event, reason, message });
    expect(evaluateOperatorPolicy(input, env)).toEqual({ allowed: false, message: line });
    for (const value of ['not-listed-person', 'TICKET-42', 'TICKET-TICKET', valid.note, '/not/a/real/file']) expect(line).not.toContain(value);
  });

  it.each<[OperatorPolicyInput, OperatorRefusalCode]>([
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
