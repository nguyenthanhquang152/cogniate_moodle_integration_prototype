import type { ToolAccount } from '../store/accounts.ts';

/** The result of the status gate: the account, or the page code and the safe log detail of the refusal. */
export type StatusGate =
  | { ok: true; account: ToolAccount }
  | { ok: false; code: 'UNKNOWN_TOOL_ACCOUNT'; detail: 'unknown_tool_account' }
  | { ok: false; code: 'TOOL_ACCOUNT_SUSPENDED'; detail: 'account_suspended' };

/**
 * The status gate of each protocol entry point: login, launch, storage check and registration start (contract
 * delta §1.5). A missing or closed account is unknown (404); a suspended account is switched off (403).
 * The tool JWKS route has its own rule: it still serves a suspended account.
 */
export function statusGate(account: ToolAccount | null): StatusGate {
  if (!account || account.status === 'closed') return { ok: false, code: 'UNKNOWN_TOOL_ACCOUNT', detail: 'unknown_tool_account' };
  if (account.status === 'suspended') return { ok: false, code: 'TOOL_ACCOUNT_SUSPENDED', detail: 'account_suspended' };
  return { ok: true, account };
}
