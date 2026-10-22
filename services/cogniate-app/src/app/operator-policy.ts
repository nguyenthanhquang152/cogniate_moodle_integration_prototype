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

const refuse = (reason: string, event = 'operator_refused'): OperatorPolicyDecision => ({
  allowed: false, message: JSON.stringify({ event, reason }),
});

/** Evaluate before opening a write transaction. A refusal writes no row or audit event. */
export function evaluateOperatorPolicy(input: OperatorPolicyInput, env: NodeJS.ProcessEnv = process.env): OperatorPolicyDecision {
  if (env.OPERATORS !== undefined && env.OPERATORS_FILE !== undefined) return refuse('operators_ambiguous', 'config_refused');
  const profile = env.STACK_PROFILE || 'default';
  if (!['default', 'acceptance', 'production'].includes(profile)) return refuse('stack_profile_invalid', 'config_refused');
  const explicitOperator = input.operator?.trim();
  if (input.operator !== undefined && !explicitOperator) return refuse('operator_missing');
  if (profile === 'production') {
    if (!explicitOperator) return refuse('operator_missing');
    let operators: string[];
    if (env.OPERATORS_FILE !== undefined) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(env.OPERATORS_FILE, 'utf8'));
        if (!Array.isArray(parsed) || !parsed.every((name: unknown) => typeof name === 'string' && name.trim().length > 0)) {
          return refuse('operators_file_invalid', 'config_refused');
        }
        operators = (parsed as string[]).map((name) => name.trim());
      } catch { return refuse('operators_file_invalid', 'config_refused'); }
    } else {
      operators = (env.OPERATORS ?? '').split(',').map((name) => name.trim()).filter(Boolean);
    }
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
