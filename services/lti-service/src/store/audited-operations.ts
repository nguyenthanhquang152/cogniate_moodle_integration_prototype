// BD-A2-96: one method is one synchronous change and ok event. No caller supplies a database callback.
import { ApiError } from '../api-errors.ts';
import type { Db } from '../db/index.ts';
import type { ProfileOptions } from '../profiles/index.ts';
import type { AccountPatch, NewAccount } from './accounts.ts';
import { createAccount, getAccount, requireWritableAccount, updateAccount } from './accounts.ts';
import type { IssueApiKeyInput } from './api-keys.ts';
import { issueApiKey, listApiKeys, revokeActiveAccountApiKeys, revokeApiKey } from './api-keys.ts';
import type { AuditContext, AuditFilter, AuditTarget, AuditedRequest } from './audit.ts';
import { listAuditEvents } from './audit.ts';
import { issueOperatorKey, revokeOperatorKey } from './operator-keys.ts';
import type { NewDeployment, NewPlatform, Platform, PlatformPatch, RefCondition } from './platforms.ts';
import { addDeployment, applyRegistrationUpdate, changeDeployment, createPlatform, deletePlatform, getPlatform, listPlatforms, PlatformExistsError, updatePlatform } from './platforms.ts';
import type { RegistrationOperation } from './registrations.ts';
import { completeRegistrationSession } from './registrations.ts';
import type { ServiceKeyFilter } from './service-keys.ts';
import { revokeScopedServiceKeys } from './service-keys.ts';
import { patchRateLimitSettings } from './settings.ts';
import type { SharedPlatformInput } from './shared-platforms.ts';
import { provisionSharedPlatform } from './shared-platforms.ts';
import type { PreparedToolKey } from './tool-keys.ts';
import { activateToolKey, createFirstToolKey, createNextToolKey, removeToolKey } from './tool-keys.ts';

export type AuditBase = AuditContext & { action: string; target: AuditTarget; details?: Record<string, unknown> | null };
export type AuditedOperations = ReturnType<typeof sqliteAuditedOperations>;
const iso = (ms: number | null) => ms === null ? null : new Date(ms).toISOString();

/** Private SQLite operations. Pure deployment and registration checks run under the same writer lock. */
export function sqliteAuditedOperations(db: Db, audit: AuditedRequest) {
  return {
    async createAccount(input: NewAccount, key: PreparedToolKey, now: number) {
      return audit.change(() => {
        const created = createAccount(db, input, now);
        createFirstToolKey(db, key, now);
        return created;
      }, () => ({ details: { fields: Object.keys(input), kid: key.kid } }));
    },
    async updateAccount(accountId: string, patch: AccountPatch, now: number) {
      return audit.change(() => {
        const current = requireWritableAccount(db, accountId);
        const account = updateAccount(db, accountId, patch, now);
        return { account, changedStatus: account.status !== current.status };
      }, ({ changedStatus }) => ({ action: changedStatus ? 'account.status' : 'account.update',
        details: { fields: Object.keys(patch), ...(changedStatus ? { status: patch.status } : {}) } }));
    },
    async issueApiKey(accountId: string, input: IssueApiKeyInput, revokeOthers: boolean, now: number) {
      return audit.change(() => {
        requireWritableAccount(db, accountId);
        const revokedKeyIds = revokeOthers ? listApiKeys(db, accountId)
          .filter((key) => key.revokedAt === null && (key.expiresAt === null || key.expiresAt > now)).map((key) => key.id) : [];
        if (revokeOthers) revokeActiveAccountApiKeys(db, accountId, now);
        return { ...issueApiKey(db, accountId, input, now), revokedKeyIds };
      }, (issued) => ({ target: { type: 'api_key', id: issued.record.id }, details: { label: issued.record.label,
        scopes: issued.record.scopes, expiresAt: iso(issued.record.expiresAt), ...(revokeOthers ? { revokedKeyIds: issued.revokedKeyIds } : {}) } }));
    },
    async revokeApiKey(accountId: string, id: string, now: number) {
      return audit.change(() => revokeApiKey(db, accountId, id, now)!);
    },
    async issueOperatorKey(input: Parameters<typeof issueOperatorKey>[1], now: number) {
      return audit.change(() => issueOperatorKey(db, input, now), (issued) => ({ target: { type: 'operator_key', id: issued.record.id },
        details: { operator: issued.record.operator, expiresAt: iso(issued.record.expiresAt) } }));
    },
    async revokeOperatorKey(id: string, now: number) {
      return audit.change(() => revokeOperatorKey(db, id, now)!, (revoked) => ({ details: { operator: revoked.operator } }));
    },
    async createSigningKey(key: PreparedToolKey, now: number) {
      return audit.change(() => { requireWritableAccount(db, key.accountId); return createNextToolKey(db, key, now); },
        (created) => ({ target: { type: 'signing_key', id: created.kid }, details: { status: created.status } }));
    },
    async activateSigningKey(accountId: string, kid: string, options: NonNullable<Parameters<typeof activateToolKey>[3]>, now: number) {
      return audit.change(() => { requireWritableAccount(db, accountId); return activateToolKey(db, accountId, kid, options, now); },
        (activated) => ({ details: { forced: options.force, retired: activated.retired } }));
    },
    async removeSigningKey(accountId: string, kid: string, now: number) {
      return audit.change(() => removeToolKey(db, accountId, kid, now));
    },
    async patchRateLimits(input: Parameters<typeof patchRateLimitSettings>[1], fields: string[]) {
      return audit.change(() => patchRateLimitSettings(db, input), () => ({ details: { fields, ...input } }));
    },
    async readAudit(filter: AuditFilter, query: Record<string, unknown>, cursor: boolean) {
      return audit.change(() => listAuditEvents(db, filter), (page) => ({ details: { query, cursor, count: page.events.length } }));
    },
    async revokeServiceKeys(accountId: string, filter: ServiceKeyFilter, now: number) {
      return audit.change(() => {
        if (!getAccount(db, accountId)) throw new ApiError('NOT_FOUND', 'Unknown tool account.');
        if (!getPlatform(db, accountId, filter.platformId)) throw new ApiError('UNREGISTERED_PLATFORM');
        return { revoked: revokeScopedServiceKeys(db, accountId, filter, now) };
      }, ({ revoked }) => ({ details: { ...filter, revoked } }));
    },
    async acceptJob(name: string, now: number) {
      return audit.change(() => {
        const held = db.prepare('SELECT 1 FROM job_lease WHERE name = ? AND owner IS NOT NULL AND lease_until > ?').get(name, now);
        if (held) throw new ApiError('JOB_RUNNING');
      });
    },
    async createPlatform(accountId: string, plan: NewPlatform) {
      return audit.change(() => createPlatform(db, accountId, plan),
        (created) => ({ target: { type: 'platform', id: created.id }, details: { profile: created.profile, active: created.active } }));
    },
    async deletePlatform(accountId: string, id: string, options: Parameters<typeof deletePlatform>[3], profile: string) {
      return audit.change(() => {
        if (!deletePlatform(db, accountId, id, options)) throw new ApiError('UNREGISTERED_PLATFORM');
      }, () => ({ details: { profile } }));
    },
    async updatePlatform(accountId: string, id: string, patch: PlatformPatch) {
      return audit.change(() => {
        const updated = updatePlatform(db, accountId, id, patch);
        if (!updated) throw new ApiError('UNREGISTERED_PLATFORM', 'Unknown platform id.');
        return updated;
      }, () => ({ details: { fields: Object.keys(patch), ...(patch.active !== undefined ? { active: patch.active } : {}) } }));
    },
    async addDeployment(accountId: string, platformId: string, input: NewDeployment) {
      return audit.change(() => {
        const added = addDeployment(db, accountId, platformId, input);
        if (!added) throw new ApiError('UNREGISTERED_PLATFORM', 'Unknown platform id.');
        return added;
      }, (added) => ({ target: { type: 'deployment', id: added.deploymentId }, details: { platformId, active: added.active } }));
    },
    async changeDeployment(accountId: string, platformId: string, deploymentId: string, condition: RefCondition,
      plan: Parameters<typeof changeDeployment>[5], fields: string[]) {
      return audit.change(() => {
        const changed = changeDeployment(db, accountId, platformId, deploymentId, condition, plan);
        if (!changed) throw new ApiError('UNREGISTERED_PLATFORM', 'Unknown platform id.');
        return changed;
      }, (changed) => ({ details: { platformId, fields, active: changed.active } }));
    },
    async provisionSharedPlatform(opts: ProfileOptions, input: SharedPlatformInput) {
      return audit.change(() => provisionSharedPlatform(db, opts, input),
        ({ platform, created }) => ({ target: { type: 'platform', id: platform.id }, details: { profile: platform.profile, created } }));
    },
    async completeRegistration(accountId: string, sessionId: string, existingId: string | null, operation0: RegistrationOperation,
      input: NewPlatform, values: Parameters<typeof applyRegistrationUpdate>[3], staged: boolean,
      updateProblem: (platform: Platform) => ApiError | null, traceId: string, now: number) {
      return audit.change(() => {
        const update = (existing: Platform | null): Platform | null => {
          if (!existing) return null;
          const problem = updateProblem(existing);
          if (problem) throw problem;
          return applyRegistrationUpdate(db, accountId, existing.id, { ...values, active: staged ? false : existing.active });
        };
        let platform: Platform | null;
        let operation = operation0;
        if (operation0 === 'update') platform = update(getPlatform(db, accountId, existingId!));
        else {
          try { platform = createPlatform(db, accountId, input); }
          catch (err) {
            if (!(err instanceof PlatformExistsError)) throw err;
            const same = listPlatforms(db, accountId, { url: input.issuer, clientId: values.clientId })[0]!;
            platform = update(same);
            operation = 'update';
          }
        }
        if (!platform) throw new ApiError('INTERNAL_ERROR', `Internal error. Trace id: ${traceId}`);
        completeRegistrationSession(db, accountId, sessionId, platform.id, now);
        return { platform, operation };
      }, ({ platform, operation }) => ({ details: { platformId: platform.id, operation } }));
    },
  };
}
