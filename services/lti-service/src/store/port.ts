import type { Db } from '../db/index.ts';
import type * as accounts from './accounts.ts';
import type * as apiKeys from './api-keys.ts';
import type * as audit from './audit.ts';
import type * as idempotency from './idempotency.ts';
import type * as launches from './launches.ts';
import type * as operatorKeys from './operator-keys.ts';
import type * as platforms from './platforms.ts';
import type * as registrations from './registrations.ts';
import type * as retention from './retention.ts';
import type * as serviceKeys from './service-keys.ts';
import type * as settings from './settings.ts';
import type * as states from './states.ts';
import type * as storageChecks from './storage-checks.ts';
import type * as toolKeys from './tool-keys.ts';

/** A store area has no database handle in its public methods. */
type AsyncArea<T> = {
  [K in keyof T]: T[K] extends (db: Db, ...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : never;
};

export type AccountsStore = AsyncArea<Pick<typeof accounts, 'createAccount' | 'listAccounts' | 'updateAccount' | 'getAccount' | 'requireWritableAccount' | 'ensureAccount'>>;
export type ApiKeysStore = AsyncArea<Pick<typeof apiKeys, 'requireApiKeyAccount' | 'listApiKeys' | 'getApiKey' | 'requireApiKeySlot' | 'issueApiKey' | 'useApiKey' | 'revokeApiKey' | 'revokeAccountApiKeys' | 'revokeActiveAccountApiKeys'>>;
export type AuditStore = AsyncArea<Pick<typeof audit, 'observeAuditEvents' | 'insertAuditEvent' | 'listAuditEvents'>>;
export type IdempotencyStore = AsyncArea<Pick<typeof idempotency, 'claimIdempotency' | 'completeIdempotency' | 'abandonIdempotency'>>;
export type LaunchesStore = AsyncArea<Pick<typeof launches, 'createLaunch' | 'findLaunchByLtik'>>;
export type OperatorKeysStore = AsyncArea<Pick<typeof operatorKeys, 'listOperatorKeys' | 'getOperatorKey' | 'issueOperatorKey' | 'findActiveOperatorKey' | 'revokeOperatorKey' | 'initOperatorKey' | 'hasActiveOperatorKey'>>;
export type PlatformsStore = AsyncArea<Pick<typeof platforms, 'createPlatform' | 'getPlatform' | 'listPlatforms' | 'findSharedPlatform' | 'updatePlatform' | 'setProductFamilyCode' | 'findLoginPlatforms' | 'findPlatformByDeployment' | 'applyRegistrationUpdate' | 'deletePlatform' | 'addDeployment' | 'changeDeployment'>>;
export type RegistrationsStore = AsyncArea<Pick<typeof registrations, 'createRegistrationSession' | 'getRegistrationSession' | 'claimRegistrationSession' | 'releaseRegistrationSession' | 'completeRegistrationSession' | 'registrationTokenVersions'>>;
export type RetentionStore = AsyncArea<Pick<typeof retention, 'cleanupExpired'>>;
export type ServiceKeysStore = AsyncArea<Pick<typeof serviceKeys, 'issueServiceKey' | 'findServiceKey' | 'serviceKeyVersions' | 'revokeServiceKeys' | 'revokeScopedServiceKeys'>>;
export type SettingsStore = AsyncArea<Pick<typeof settings, 'readRateLimitSettings' | 'patchRateLimitSettings' | 'legacyBlobsRefused' | 'refuseLegacyBlobs'>>;
export type StatesStore = AsyncArea<Pick<typeof states, 'saveState' | 'consumeState'>>;
export type StorageChecksStore = AsyncArea<Pick<typeof storageChecks, 'createStorageCheck' | 'consumeStorageCheck' | 'cleanupStorageChecks'>>;
export type ToolKeysStore = AsyncArea<Pick<typeof toolKeys, 'requireSigningKeyAccount' | 'listSigningKeys' | 'requireNextKeySlot' | 'createFirstToolKey' | 'createNextToolKey' | 'activateToolKey' | 'checkToolKeyActivation' | 'checkToolKeyRemoval' | 'removeToolKey' | 'ensureToolKey' | 'publicJwks' | 'activePublicKeyPem' | 'activePrivateJwk' | 'toolKeyVersions'>>;

/** Database-independent data access for the LTI service (LA-ADR-06 D13). */
export interface LtiStore {
  readonly accounts: AccountsStore;
  readonly apiKeys: ApiKeysStore;
  readonly audit: AuditStore;
  readonly idempotency: IdempotencyStore;
  readonly launches: LaunchesStore;
  readonly operatorKeys: OperatorKeysStore;
  readonly platforms: PlatformsStore;
  readonly registrations: RegistrationsStore;
  readonly retention: RetentionStore;
  readonly serviceKeys: ServiceKeysStore;
  readonly settings: SettingsStore;
  readonly states: StatesStore;
  readonly storageChecks: StorageChecksStore;
  readonly toolKeys: ToolKeysStore;
}
