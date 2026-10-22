// Tool accounts and the bootstrap bridge (contract §7, §8 D2). API keys: api-keys.ts; signing keys: tool-keys.ts.
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';
import { createHash, randomBytes } from 'node:crypto';
import { ApiError } from '../api-errors.ts';
import { issueApiKey, revokeAccountApiKeys, revokeActiveAccountApiKeys } from './api-keys.ts';

export interface ToolAccount {
  id: string;
  name: string;
  launchUrl: string;
  deepLinkingUrl: string;
  registrationUrl: string;
  status: AccountStatus;
  statusChangedAt: number;
  createdAt: number;
  publicBaseUrl: string | null;
  limits: AccountLimits | null;
  claimPolicy: ClaimPolicy | null;
  serviceKeyWriteScope: 'context' | 'resource-link';
}

export type AccountStatus = 'active' | 'suspended' | 'closed';
export const RATE_LIMIT_CLASSES = ['protocol', 'protocol_account', 'registration', 'registration_account', 'keys', 'api', 'admin', 'auth_failure', 'operator'] as const;
export type AccountLimits = Partial<Record<typeof RATE_LIMIT_CLASSES[number], { ratePerMinute: number; burst: number }>>;
export interface ClaimPolicy { mode: 'allowlist' | 'passthrough'; keep: { names: boolean; email: boolean; custom: boolean; lis: boolean } }
// Stored null is the legacy passthrough marker. LA-E3-10 reads any other unknown value as allowlist.
// New accounts use this policy; the API requires an explicit policy and refuses null (BD-A2-26).
export const DEFAULT_CLAIM_POLICY: ClaimPolicy = { mode: 'allowlist', keep: { names: false, email: false, custom: false, lis: false } };

interface AccountRow {
  id: string; name: string; launch_url: string; deep_linking_url: string; registration_url: string;
  status: AccountStatus; status_changed_at: number; created_at: number; public_base_url: string | null;
  limits: string | null; claim_policy: string | null; service_key_write_scope: 'context' | 'resource-link';
}

const toAccount = (r: AccountRow): ToolAccount => ({
  id: r.id, name: r.name, launchUrl: r.launch_url, deepLinkingUrl: r.deep_linking_url, registrationUrl: r.registration_url,
  status: r.status, statusChangedAt: r.status_changed_at, createdAt: r.created_at, publicBaseUrl: r.public_base_url,
  limits: r.limits === null ? null : JSON.parse(r.limits) as AccountLimits,
  claimPolicy: r.claim_policy === null ? null : JSON.parse(r.claim_policy) as ClaimPolicy,
  serviceKeyWriteScope: r.service_key_write_scope,
});

export const ACCOUNT_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** No caller holds these random bytes; the frozen column cannot authenticate a new operator-created account. */
const unusableApiKeyHash = (): string => createHash('sha256').update(randomBytes(32)).digest('hex');

export interface NewAccount {
  id: string; name: string; launchUrl: string; deepLinkingUrl: string; registrationUrl: string;
  limits?: AccountLimits | null; claimPolicy?: ClaimPolicy | null;
}
export type AccountPatch = Partial<Omit<NewAccount, 'id'>> & { status?: AccountStatus; serviceKeyWriteScope?: ToolAccount['serviceKeyWriteScope'] };

/** Call within audit.change when the account, first signing key and audit must commit together. */
export function createAccount(db: Db, input: NewAccount, now: number): ToolAccount {
  if (!ACCOUNT_ID.test(input.id)) throw new ApiError('INVALID_REQUEST', 'Invalid field: id.');
  if (getAccount(db, input.id)) throw new ApiError('ACCOUNT_ALREADY_EXISTS');
  db.prepare(`INSERT INTO tool_account (id, name, api_key_hash, launch_url, deep_linking_url, registration_url,
    created_at, status_changed_at, limits, claim_policy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(input.id, input.name, unusableApiKeyHash(), input.launchUrl, input.deepLinkingUrl, input.registrationUrl, now, now,
      input.limits === undefined || input.limits === null ? null : JSON.stringify(input.limits),
      input.claimPolicy === null ? null : JSON.stringify(input.claimPolicy ?? DEFAULT_CLAIM_POLICY));
  return getAccount(db, input.id)!;
}

/** Stable id order; the cursor is the last id of the preceding page. */
export function listAccounts(db: Db, filter: { status?: AccountStatus; cursor?: string; limit: number }): { accounts: ToolAccount[]; next?: string } {
  const rows = db.prepare(`SELECT * FROM tool_account WHERE (? IS NULL OR status = ?) AND id > ? ORDER BY id LIMIT ?`)
    .all(filter.status ?? null, filter.status ?? null, filter.cursor ?? '', filter.limit + 1) as unknown as AccountRow[];
  const more = rows.length > filter.limit;
  const accounts = rows.slice(0, filter.limit).map(toAccount);
  return { accounts, ...(more ? { next: accounts.at(-1)!.id } : {}) };
}

export function updateAccount(db: Db, id: string, patch: AccountPatch, now: number): ToolAccount {
  return transaction(db, () => {
    const current = requireWritableAccount(db, id);
    const next = { ...current, ...patch };
    db.prepare(`UPDATE tool_account SET name = ?, launch_url = ?, deep_linking_url = ?, registration_url = ?,
      status = ?, status_changed_at = ?, limits = ?, claim_policy = ?, service_key_write_scope = ? WHERE id = ?`)
      .run(next.name, next.launchUrl, next.deepLinkingUrl, next.registrationUrl, next.status,
        next.status === current.status ? current.statusChangedAt : now,
        next.limits === null ? null : JSON.stringify(next.limits), next.claimPolicy === null ? null : JSON.stringify(next.claimPolicy),
        next.serviceKeyWriteScope, id);
    if (next.status === 'closed') {
      revokeAccountApiKeys(db, id, now);
      db.prepare('UPDATE service_key SET revoked_at = ? WHERE tool_account_id = ? AND revoked_at IS NULL').run(now, id);
    }
    return getAccount(db, id)!;
  });
}

export function getAccount(db: Db, id: string): ToolAccount | null {
  const row = db.prepare('SELECT * FROM tool_account WHERE id = ?').get(id) as AccountRow | undefined;
  return row ? toAccount(row) : null;
}

/** BD-A2-12: call inside the write transaction too, so a concurrent close cannot pass the guard. */
export function requireWritableAccount(db: Db, id: string): ToolAccount {
  const account = getAccount(db, id);
  if (!account) throw new ApiError('NOT_FOUND', 'Unknown tool account.');
  if (account.status === 'closed') throw new ApiError('ACCOUNT_CLOSED');
  return account;
}

export interface EnsureAccountInput {
  id: string;
  name: string;
  appUrl: string; // PUBLIC_APP_URL
  rotateApiKey?: boolean;
}

/** Make the account if missing; keep existing tool URLs. Returns the API key only when it was made or rotated. */
export function ensureAccount(db: Db, input: EnsureAccountInput): { account: ToolAccount; created: boolean; apiKey: string | null } {
  if (!ACCOUNT_ID.test(input.id)) throw new Error(`invalid account id: ${input.id}`);
  const urls = {
    launch: `${input.appUrl}/tool/launch`, deep: `${input.appUrl}/tool/deep-link`, reg: `${input.appUrl}/tool/register`,
  };
  return transaction(db, () => {
    const now = Date.now();
    const bootstrap = { label: 'bootstrap', scopes: ['launch', 'admin'] as const, createdBy: 'system:bootstrap' };
    const existing = getAccount(db, input.id);
    if (!existing) {
      db.prepare(`INSERT INTO tool_account (id, name, api_key_hash, launch_url, deep_linking_url, registration_url, created_at, status_changed_at, claim_policy)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.id, input.name, unusableApiKeyHash(), urls.launch, urls.deep, urls.reg, now, now, JSON.stringify(DEFAULT_CLAIM_POLICY));
      const { apiKey } = issueApiKey(db, input.id, bootstrap, now);
      return { account: getAccount(db, input.id)!, created: true, apiKey };
    }
    requireWritableAccount(db, input.id);
    db.prepare('UPDATE tool_account SET name = ? WHERE id = ?').run(input.name, input.id);
    let apiKey: string | null = null;
    if (input.rotateApiKey) {
      revokeActiveAccountApiKeys(db, input.id, now);
      apiKey = issueApiKey(db, input.id, bootstrap, now).apiKey;
    }
    return { account: getAccount(db, input.id)!, created: false, apiKey };
  });
}

// ---------------------------------------------------------------- tool signing keys (RS256, 2048 bit)
