// The SQL modules are SQLite adapter internals. Production callers use the async port.
import type { Db } from '../db/index.ts';
import type { LtiStore } from './port.ts';
import * as accounts from './accounts.ts';
import * as apiKeys from './api-keys.ts';
import * as audit from './audit.ts';
import * as idempotency from './idempotency.ts';
import * as launches from './launches.ts';
import * as operatorKeys from './operator-keys.ts';
import * as platforms from './platforms.ts';
import * as registrations from './registrations.ts';
import * as retention from './retention.ts';
import * as serviceKeys from './service-keys.ts';
import * as settings from './settings.ts';
import * as states from './states.ts';
import * as storageChecks from './storage-checks.ts';
import * as toolKeys from './tool-keys.ts';
import * as sharedPlatforms from './shared-platforms.ts';
import { sqliteAuditedOperations } from './audited-operations.ts';

export function createSqliteLtiStore(db: Db): LtiStore {
  return {
    sharedPlatforms: {
      checkSharedPlatform: async (...args) => sharedPlatforms.checkSharedPlatform(db, ...args),
      provisionSharedPlatform: async (...args) => sharedPlatforms.provisionSharedPlatform(db, ...args),
    },
    accounts: {
      createAccount: async (...args) => accounts.createAccount(db, ...args),
      listAccounts: async (...args) => accounts.listAccounts(db, ...args),
      updateAccount: async (...args) => accounts.updateAccount(db, ...args),
      getAccount: async (...args) => accounts.getAccount(db, ...args),
      requireWritableAccount: async (...args) => accounts.requireWritableAccount(db, ...args),
      ensureAccount: async (...args) => accounts.ensureAccount(db, ...args),
    },
    apiKeys: {
      requireApiKeyAccount: async (...args) => apiKeys.requireApiKeyAccount(db, ...args),
      listApiKeys: async (...args) => apiKeys.listApiKeys(db, ...args),
      getApiKey: async (...args) => apiKeys.getApiKey(db, ...args),
      requireApiKeySlot: async (...args) => apiKeys.requireApiKeySlot(db, ...args),
      issueApiKey: async (...args) => apiKeys.issueApiKey(db, ...args),
      useApiKey: async (...args) => apiKeys.useApiKey(db, ...args),
      revokeApiKey: async (...args) => apiKeys.revokeApiKey(db, ...args),
      revokeAccountApiKeys: async (...args) => apiKeys.revokeAccountApiKeys(db, ...args),
      revokeActiveAccountApiKeys: async (...args) => apiKeys.revokeActiveAccountApiKeys(db, ...args),
    },
    audit: {
      request: (now, base, body) => audit.withAudit(db, now, base, (change) => body(sqliteAuditedOperations(db, change))),
      observeAuditEvents: async (...args) => audit.observeAuditEvents(db, ...args),
      insertAuditEvent: async (...args) => audit.insertAuditEvent(db, ...args),
      listAuditEvents: async (...args) => audit.listAuditEvents(db, ...args),
    },
    idempotency: {
      claimIdempotency: async (...args) => idempotency.claimIdempotency(db, ...args),
      completeIdempotency: async (...args) => idempotency.completeIdempotency(db, ...args),
      abandonIdempotency: async (...args) => idempotency.abandonIdempotency(db, ...args),
    },
    launches: {
      createLaunch: async (...args) => launches.createLaunch(db, ...args),
      findLaunchByLtik: async (...args) => launches.findLaunchByLtik(db, ...args),
    },
    operatorKeys: {
      listOperatorKeys: async (...args) => operatorKeys.listOperatorKeys(db, ...args),
      getOperatorKey: async (...args) => operatorKeys.getOperatorKey(db, ...args),
      issueOperatorKey: async (...args) => operatorKeys.issueOperatorKey(db, ...args),
      findActiveOperatorKey: async (...args) => operatorKeys.findActiveOperatorKey(db, ...args),
      revokeOperatorKey: async (...args) => operatorKeys.revokeOperatorKey(db, ...args),
      initOperatorKey: async (...args) => operatorKeys.initOperatorKey(db, ...args),
      hasActiveOperatorKey: async (...args) => operatorKeys.hasActiveOperatorKey(db, ...args),
    },
    platforms: {
      createPlatform: async (...args) => platforms.createPlatform(db, ...args),
      getPlatform: async (...args) => platforms.getPlatform(db, ...args),
      listPlatforms: async (...args) => platforms.listPlatforms(db, ...args),
      findSharedPlatform: async (...args) => platforms.findSharedPlatform(db, ...args),
      updatePlatform: async (...args) => platforms.updatePlatform(db, ...args),
      setProductFamilyCode: async (...args) => platforms.setProductFamilyCode(db, ...args),
      findLoginPlatforms: async (...args) => platforms.findLoginPlatforms(db, ...args),
      findPlatformByDeployment: async (...args) => platforms.findPlatformByDeployment(db, ...args),
      applyRegistrationUpdate: async (...args) => platforms.applyRegistrationUpdate(db, ...args),
      deletePlatform: async (...args) => platforms.deletePlatform(db, ...args),
      addDeployment: async (...args) => platforms.addDeployment(db, ...args),
      changeDeployment: async (...args) => platforms.changeDeployment(db, ...args),
    },
    registrations: {
      countOpenRegistrationSessions: async (...args) => registrations.countOpenRegistrationSessions(db, ...args),
      createCappedRegistrationSession: async (...args) => registrations.createCappedRegistrationSession(db, ...args),
      createRegistrationSession: async (...args) => registrations.createRegistrationSession(db, ...args),
      getRegistrationSession: async (...args) => registrations.getRegistrationSession(db, ...args),
      claimRegistrationSession: async (...args) => registrations.claimRegistrationSession(db, ...args),
      releaseRegistrationSession: async (...args) => registrations.releaseRegistrationSession(db, ...args),
      completeRegistrationSession: async (...args) => registrations.completeRegistrationSession(db, ...args),
      registrationTokenVersions: async (...args) => registrations.registrationTokenVersions(db, ...args),
    },
    retention: {
      cleanupExpired: async (...args) => retention.cleanupExpired(db, ...args),
    },
    serviceKeys: {
      issueServiceKey: async (...args) => serviceKeys.issueServiceKey(db, ...args),
      findServiceKey: async (...args) => serviceKeys.findServiceKey(db, ...args),
      serviceKeyVersions: async (...args) => serviceKeys.serviceKeyVersions(db, ...args),
      revokeServiceKeys: async (...args) => serviceKeys.revokeServiceKeys(db, ...args),
      revokeScopedServiceKeys: async (...args) => serviceKeys.revokeScopedServiceKeys(db, ...args),
    },
    settings: {
      readRateLimitSettings: async (...args) => settings.readRateLimitSettings(db, ...args),
      patchRateLimitSettings: async (...args) => settings.patchRateLimitSettings(db, ...args),
      legacyBlobsRefused: async (...args) => settings.legacyBlobsRefused(db, ...args),
      refuseLegacyBlobs: async (...args) => settings.refuseLegacyBlobs(db, ...args),
    },
    states: {
      saveState: async (...args) => states.saveState(db, ...args),
      consumeState: async (...args) => states.consumeState(db, ...args),
    },
    storageChecks: {
      createStorageCheck: async (...args) => storageChecks.createStorageCheck(db, ...args),
      consumeStorageCheck: async (...args) => storageChecks.consumeStorageCheck(db, ...args),
      cleanupStorageChecks: async (...args) => storageChecks.cleanupStorageChecks(db, ...args),
    },
    toolKeys: {
      requireSigningKeyAccount: async (...args) => toolKeys.requireSigningKeyAccount(db, ...args),
      listSigningKeys: async (...args) => toolKeys.listSigningKeys(db, ...args),
      requireNextKeySlot: async (...args) => toolKeys.requireNextKeySlot(db, ...args),
      createFirstToolKey: async (...args) => toolKeys.createFirstToolKey(db, ...args),
      createNextToolKey: async (...args) => toolKeys.createNextToolKey(db, ...args),
      activateToolKey: async (...args) => toolKeys.activateToolKey(db, ...args),
      checkToolKeyActivation: async (...args) => toolKeys.checkToolKeyActivation(db, ...args),
      checkToolKeyRemoval: async (...args) => toolKeys.checkToolKeyRemoval(db, ...args),
      removeToolKey: async (...args) => toolKeys.removeToolKey(db, ...args),
      ensureToolKey: async (...args) => toolKeys.ensureToolKey(db, ...args),
      publicJwks: async (...args) => toolKeys.publicJwks(db, ...args),
      activePublicKeyPem: async (...args) => toolKeys.activePublicKeyPem(db, ...args),
      activePrivateJwk: async (...args) => toolKeys.activePrivateJwk(db, ...args),
      toolKeyVersions: async (...args) => toolKeys.toolKeyVersions(db, ...args),
    },
  };
}
