import { readFileSync } from 'node:fs';

const EVIDENCE_CHANNELS = ['institution-email', 'support-call', 'lms-admin-ticket', 'other'] as const;
export type OperatorEvidenceChannel = typeof EVIDENCE_CHANNELS[number];

export interface OperatorPolicyInput {
  operator?: string;
  evidenceChannel?: string;
  evidenceRef?: string;
  /** The note stays in the grant or binding store. Only its presence goes to audit details. */
  note?: string;
}

export type OperatorPolicyDecision = {
  allowed: true;
  actor: { type: 'operator'; id: string };
  details: { evidence_channel?: OperatorEvidenceChannel; evidence_ref?: string; note_present: boolean };
} | { allowed: false; message: string };

/** BD-A2-59 (LA-ADR-07 D4): the event and one fixed sentence with the fix for each code. A message never echoes input. */
export const OPERATOR_REFUSALS = {
  operators_ambiguous: ['config_refused', 'Set only one of OPERATORS and OPERATORS_FILE, then run the command again.'],
  operators_not_configured: ['config_refused', 'Set OPERATORS or OPERATORS_FILE to the allowed operator names, then run the command again.'],
  operators_file_invalid: ['config_refused', 'OPERATORS_FILE must be a JSON array of operator names. Correct the file, then run the command again.'],
  stack_profile_invalid: ['config_refused', 'Set STACK_PROFILE to default, acceptance or production.'],
  operator_missing: ['operator_refused', 'Add --operator <your name>, then run the command again.'],
  operator_unknown: ['operator_refused', 'Your operator name is not in the allowed list. Use your listed name, or ask an administrator to add it.'],
  evidence_channel_missing: ['operator_refused', 'Add --evidence-channel (institution-email, support-call, lms-admin-ticket or other), then run the command again.'],
  evidence_ref_missing: ['operator_refused', 'Add --evidence-ref <ticket or message reference>, then run the command again.'],
  evidence_channel_invalid: ['operator_refused', 'Use one of these evidence channels: institution-email, support-call, lms-admin-ticket, other.'],
  evidence_ref_invalid: ['operator_refused', 'Give an evidence reference of 1 to 200 characters.'],
} as const satisfies Record<string, readonly ['config_refused' | 'operator_refused', string]>;
export type OperatorRefusalCode = keyof typeof OPERATOR_REFUSALS;

/** One JSON line: {event, reason, message}. */
const refuse = (reason: OperatorRefusalCode): OperatorPolicyDecision => {
  const [event, message] = OPERATOR_REFUSALS[reason];
  return { allowed: false, message: JSON.stringify({ event, reason, message }) };
};

/** Evaluate before opening a write transaction. A refusal writes no row or audit event. */
export function evaluateOperatorPolicy(input: OperatorPolicyInput, env: NodeJS.ProcessEnv = process.env): OperatorPolicyDecision {
  if (env.OPERATORS !== undefined && env.OPERATORS_FILE !== undefined) return refuse('operators_ambiguous');
  const profile = env.STACK_PROFILE || 'default';
  if (!['default', 'acceptance', 'production'].includes(profile)) return refuse('stack_profile_invalid');
  const explicitOperator = input.operator?.trim();
  if (input.operator !== undefined && !explicitOperator) return refuse('operator_missing');
  if (profile === 'production') {
    if (!explicitOperator) return refuse('operator_missing');
    let operators: string[];
    if (env.OPERATORS_FILE !== undefined) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(env.OPERATORS_FILE, 'utf8'));
        if (!Array.isArray(parsed) || !parsed.every((name: unknown) => typeof name === 'string' && name.trim().length > 0)) {
          return refuse('operators_file_invalid');
        }
        operators = (parsed as string[]).map((name) => name.trim());
      } catch { return refuse('operators_file_invalid'); }
    } else {
      operators = (env.OPERATORS ?? '').split(',').map((name) => name.trim()).filter(Boolean);
    }
    // No list, or an empty one: the configuration is wrong, not the name.
    if (operators.length === 0) return refuse('operators_not_configured');
    if (!operators.includes(explicitOperator)) return refuse('operator_unknown');
    if (input.evidenceChannel === undefined) return refuse('evidence_channel_missing');
    if (input.evidenceRef === undefined) return refuse('evidence_ref_missing');
  }
  if (input.evidenceChannel !== undefined && !EVIDENCE_CHANNELS.some((channel) => channel === input.evidenceChannel)) {
    return refuse('evidence_channel_invalid');
  }
  if (input.evidenceRef !== undefined && (input.evidenceRef.trim().length === 0 || input.evidenceRef.length > 200)) {
    return refuse('evidence_ref_invalid');
  }
  return {
    allowed: true,
    actor: { type: 'operator', id: explicitOperator || env.OPERATOR_NAME?.trim() || 'unknown' },
    details: {
      ...(input.evidenceChannel !== undefined ? { evidence_channel: input.evidenceChannel as OperatorEvidenceChannel } : {}),
      ...(input.evidenceRef !== undefined ? { evidence_ref: input.evidenceRef } : {}),
      note_present: Boolean(input.note),
    },
  };
}
