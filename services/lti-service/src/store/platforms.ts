import { randomBytes } from 'node:crypto';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';

/** One deployment row (data-model §4.1). `siteUrl` is the stored deployment value (shared profiles), else null. */
export interface DeploymentRecord {
  deploymentId: string;
  siteUrl: string | null;
  active: boolean;
  bindingGeneration: number;
  bindingRef: string | null;
  createdAt: number | null;
}

export interface Platform {
  id: string;
  toolAccountId: string;
  issuer: string;
  clientId: string;
  /** Extra launch audiences allowed by check 5; an empty list permits only the client id. */
  trustedAudiences: string[];
  /** The client assertion `aud` of a `{platformValue}` profile (LA-ADR-02 D2); null = the token URL. */
  clientAssertionAud: string | null;
  /** The scopes that the platform granted at Dynamic Registration; null = every requested scope (old rows). */
  grantedScopes: string[] | null;
  name: string;
  authEndpoint: string;
  tokenEndpoint: string;
  jwksUrl: string;
  productFamilyCode: string | null;
  active: boolean;
  /** Provider profile id (ADR-011 §6); `standard` for every old row. */
  profile: string;
  /** Canvas profiles: the site origin; else null (canonical origin). */
  siteUrl: string | null;
  /** Canvas profiles: the service origin; else null (canonical origin). */
  serviceUrl: string | null;
  bindingRef: string | null;
  /** Every deployment, sorted by deployment id. */
  deployments: DeploymentRecord[];
  /** The ACTIVE deployment ids (LTI contract §9.4). For Moodle every deployment is active, so the value is unchanged. */
  deploymentIds: string[];
}

interface PlatformRow {
  id: string; tool_account_id: string; issuer: string; client_id: string; name: string; auth_endpoint: string;
  token_endpoint: string; jwks_url: string; product_family_code: string | null; active: number;
  profile: string; site_url: string | null; service_url: string | null; binding_ref: string | null;
  trusted_audiences: string; client_assertion_aud: string | null; granted_scopes: string | null;
}

interface DeploymentRow { deployment_id: string; site_url: string | null; active: number; binding_generation: number; binding_ref: string | null; created_at: number | null }

const toDeployment = (r: DeploymentRow): DeploymentRecord => ({
  deploymentId: r.deployment_id, siteUrl: r.site_url, active: r.active === 1, bindingGeneration: Number(r.binding_generation),
  bindingRef: r.binding_ref, createdAt: r.created_at === null ? null : Number(r.created_at),
});

function deploymentsOf(db: Db, platformId: string): DeploymentRecord[] {
  return (db.prepare('SELECT deployment_id, site_url, active, binding_generation, binding_ref, created_at FROM deployment WHERE platform_id = ? ORDER BY deployment_id')
    .all(platformId) as unknown as DeploymentRow[]).map(toDeployment);
}

function toPlatform(db: Db, r: PlatformRow): Platform {
  const deployments = deploymentsOf(db, r.id);
  return {
    id: r.id, toolAccountId: r.tool_account_id, issuer: r.issuer, clientId: r.client_id, name: r.name,
    trustedAudiences: JSON.parse(r.trusted_audiences) as string[],
    clientAssertionAud: r.client_assertion_aud, grantedScopes: r.granted_scopes === null ? null : JSON.parse(r.granted_scopes) as string[],
    authEndpoint: r.auth_endpoint, tokenEndpoint: r.token_endpoint, jwksUrl: r.jwks_url,
    productFamilyCode: r.product_family_code, active: r.active === 1, profile: r.profile, siteUrl: r.site_url, serviceUrl: r.service_url,
    bindingRef: r.binding_ref, deployments, deploymentIds: deployments.filter((d) => d.active).map((d) => d.deploymentId),
  };
}

/** Site origin of a deployment (LTI contract §9.4): deployment `siteUrl`, else platform `siteUrl`, else the issuer origin. */
export function siteOriginOf(p: Platform, d: Pick<DeploymentRecord, 'siteUrl'> | null): string {
  return d?.siteUrl ?? p.siteUrl ?? new URL(p.issuer).origin;
}

/** Service origin: platform `serviceUrl`, else the site origin. */
export function serviceOriginOf(p: Platform, d: Pick<DeploymentRecord, 'siteUrl'> | null): string {
  return p.serviceUrl ?? siteOriginOf(p, d);
}

export function findDeployment(p: Platform, deploymentId: string): DeploymentRecord | null {
  return p.deployments.find((d) => d.deploymentId === deploymentId) ?? null;
}

export interface NewPlatform {
  issuer: string; clientId: string; name: string; authEndpoint: string; tokenEndpoint: string; jwksUrl: string;
  deploymentIds: string[]; active: boolean; productFamilyCode?: string | null;
  profile?: string; siteUrl?: string | null; serviceUrl?: string | null; bindingRef?: string | null;
  trustedAudiences?: string[];
  clientAssertionAud?: string | null;
  grantedScopes?: string[] | null;
  /** A shared profile: at most one platform per (tool account, profile), checked in the same transaction. */
  shared?: boolean;
}

export class PlatformExistsError extends Error {}
export class SharedPlatformExistsError extends Error {}
export class SharedPlatformInUseError extends Error {}
export class DeploymentExistsError extends Error {}
export class BindingRefMismatchError extends Error {}
export class UnknownDeploymentError extends Error {}

export function createPlatform(db: Db, accountId: string, input: NewPlatform): Platform {
  return transaction(db, () => {
    const profile = input.profile ?? 'standard';
    if (input.shared && db.prepare('SELECT id FROM platform WHERE tool_account_id = ? AND profile = ?').get(accountId, profile)) {
      throw new SharedPlatformExistsError('shared platform exists');
    }
    const dup = db.prepare('SELECT id FROM platform WHERE tool_account_id = ? AND issuer = ? AND client_id = ?').get(accountId, input.issuer, input.clientId);
    if (dup) throw new PlatformExistsError('platform exists');
    const id = `plt_${randomBytes(12).toString('base64url')}`;
    const now = Date.now();
    db.prepare(`INSERT INTO platform (id, tool_account_id, issuer, client_id, name, auth_endpoint, token_endpoint, jwks_url,
                product_family_code, active, created_at, updated_at, profile, site_url, service_url, binding_ref, trusted_audiences,
                client_assertion_aud, granted_scopes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, accountId, input.issuer, input.clientId, input.name, input.authEndpoint, input.tokenEndpoint, input.jwksUrl,
        input.productFamilyCode ?? null, input.active ? 1 : 0, now, now, profile, input.siteUrl ?? null, input.serviceUrl ?? null, input.bindingRef ?? null,
        JSON.stringify(input.trustedAudiences ?? []), input.clientAssertionAud ?? null, input.grantedScopes ? JSON.stringify(input.grantedScopes) : null);
    const add = db.prepare('INSERT OR IGNORE INTO deployment (platform_id, deployment_id, created_at) VALUES (?, ?, ?)');
    for (const d of input.deploymentIds) add.run(id, d, now);
    return getPlatform(db, accountId, id)!;
  });
}

/** Every lookup includes the tool account (tenant isolation, security §8). */
export function getPlatform(db: Db, accountId: string, id: string): Platform | null {
  const row = db.prepare('SELECT * FROM platform WHERE tool_account_id = ? AND id = ?').get(accountId, id) as PlatformRow | undefined;
  return row ? toPlatform(db, row) : null;
}

export function listPlatforms(db: Db, accountId: string, filter: { id?: string; url?: string; clientId?: string; profile?: string } = {}): Platform[] {
  const where = ['tool_account_id = ?'];
  const args: string[] = [accountId];
  if (filter.id !== undefined) { where.push('id = ?'); args.push(filter.id); }
  if (filter.url !== undefined) { where.push('issuer = ?'); args.push(filter.url); }
  if (filter.clientId !== undefined) { where.push('client_id = ?'); args.push(filter.clientId); }
  if (filter.profile !== undefined) { where.push('profile = ?'); args.push(filter.profile); }
  const rows = db.prepare(`SELECT * FROM platform WHERE ${where.join(' AND ')} ORDER BY created_at, id`).all(...args) as unknown as PlatformRow[];
  return rows.map((r) => toPlatform(db, r));
}

/** The platform of a shared profile in this account (at most one), or null. */
export function findSharedPlatform(db: Db, accountId: string, profile: string): Platform | null {
  return listPlatforms(db, accountId, { profile })[0] ?? null;
}

/** `undefined` = no condition; `null` = "no ref stored"; else the expected stored ref (LTI contract §9.15). */
export type RefCondition = string | null | undefined;

const refMatches = (stored: string | null, expected: RefCondition): boolean => expected === undefined || stored === expected;

export interface PlatformPatch {
  name?: string;
  active?: boolean;
  trustedAudiences?: string[];
  deploymentIds?: string[];
  bindingRef?: string;
  ifBindingRef?: RefCondition;
}

/**
 * PATCH /api/platforms/:id (LTI contract §9.4, §9.15). The condition and the change run in ONE transaction. A
 * `deploymentIds` list is a diff: listed rows that exist keep their values and become active; new ids get new rows
 * (active, generation 0); rows that are not listed are deleted (the same result as today's delete-and-insert for
 * `standard`). The caller refuses `deploymentIds` on a shared platform. Returns null when the platform is unknown.
 */
export function updatePlatform(db: Db, accountId: string, id: string, patch: PlatformPatch): Platform | null {
  return transaction(db, () => {
    const current = getPlatform(db, accountId, id);
    if (!current) return null;
    if (!refMatches(current.bindingRef, patch.ifBindingRef)) throw new BindingRefMismatchError('binding ref mismatch');
    const now = Date.now();
    db.prepare('UPDATE platform SET name = ?, active = ?, binding_ref = ?, trusted_audiences = ?, updated_at = ? WHERE id = ?')
      .run(patch.name ?? current.name, (patch.active ?? current.active) ? 1 : 0, patch.bindingRef ?? current.bindingRef,
        JSON.stringify(patch.trustedAudiences ?? current.trustedAudiences), now, id);
    if (patch.deploymentIds) {
      const wanted = new Set(patch.deploymentIds);
      for (const d of current.deployments) {
        if (!wanted.has(d.deploymentId)) db.prepare('DELETE FROM deployment WHERE platform_id = ? AND deployment_id = ?').run(id, d.deploymentId);
      }
      const add = db.prepare('INSERT OR IGNORE INTO deployment (platform_id, deployment_id, created_at) VALUES (?, ?, ?)');
      const activate = db.prepare('UPDATE deployment SET active = 1 WHERE platform_id = ? AND deployment_id = ?');
      for (const d of wanted) { add.run(id, d, now); activate.run(id, d); }
    }
    return getPlatform(db, accountId, id);
  });
}

export function setProductFamilyCode(db: Db, platformId: string, code: string): void {
  db.prepare('UPDATE platform SET product_family_code = ? WHERE id = ? AND (product_family_code IS NULL OR product_family_code <> ?)').run(code, platformId, code);
}

/**
 * Platforms of the account for (issuer, client_id) at login (security §2.1). Without client_id, all platforms of
 * the account with that issuer (the caller fails when there is more than one).
 */
export function findLoginPlatforms(db: Db, accountId: string, issuer: string, clientId?: string): Platform[] {
  return listPlatforms(db, accountId, clientId === undefined ? { url: issuer } : { url: issuer, clientId });
}

/** The platform of the account with this issuer and deployment id (dynamic registration "update", security §2.5). */
export function findPlatformByDeployment(db: Db, accountId: string, issuer: string, deploymentId: string): Platform | null {
  const row = db.prepare(`SELECT p.* FROM platform p JOIN deployment d ON d.platform_id = p.id
    WHERE p.tool_account_id = ? AND p.issuer = ? AND d.deployment_id = ? ORDER BY p.created_at LIMIT 1`).get(accountId, issuer, deploymentId) as PlatformRow | undefined;
  return row ? toPlatform(db, row) : null;
}

/**
 * Store the result of a dynamic registration "update" on the existing platform (contract §3.8): client id, endpoints,
 * name, active, product family code; the deployment id is added. The platform keeps its id.
 */
export function applyRegistrationUpdate(
  db: Db,
  accountId: string,
  id: string,
  input: {
    clientId: string; name: string; authEndpoint: string; tokenEndpoint: string; jwksUrl: string; active: boolean; productFamilyCode: string | null; deploymentId: string;
    /** BD-A1-89: the credential set is written as one: the audience and the granted scopes too (null clears them). */
    clientAssertionAud: string | null;
    grantedScopes: string[] | null;
    /** LA-ADR-05 D6: the site and service origins that a profile rule derived (null for an admin-value platform). */
    siteUrl: string | null;
    serviceUrl: string | null;
    /** D5 item 10: the binding ref of a staged registration; null keeps the stored value. */
    bindingRef?: string | null;
  },
): Platform | null {
  return transaction(db, () => {
    if (!getPlatform(db, accountId, id)) return null;
    db.prepare(`UPDATE platform SET client_id = ?, name = ?, auth_endpoint = ?, token_endpoint = ?, jwks_url = ?, active = ?,
      product_family_code = COALESCE(?, product_family_code), client_assertion_aud = ?, granted_scopes = ?, site_url = ?, service_url = ?,
      binding_ref = COALESCE(?, binding_ref), updated_at = ? WHERE id = ? AND tool_account_id = ?`)
      .run(input.clientId, input.name, input.authEndpoint, input.tokenEndpoint, input.jwksUrl, input.active ? 1 : 0, input.productFamilyCode,
        input.clientAssertionAud, input.grantedScopes ? JSON.stringify(input.grantedScopes) : null, input.siteUrl, input.serviceUrl, input.bindingRef ?? null,
        Date.now(), id, accountId);
    db.prepare('INSERT OR IGNORE INTO deployment (platform_id, deployment_id, created_at) VALUES (?, ?, ?)').run(id, input.deploymentId, Date.now());
    return getPlatform(db, accountId, id);
  });
}

/**
 * A single account-scoped delete cascades to states, launches, deployments and service keys. `ifBindingRef` makes it
 * conditional (LTI contract §9.15); `shared` refuses a shared platform that has an active deployment (§9.4). The
 * checks and the delete run in one transaction. False when the platform is unknown.
 */
export function deletePlatform(db: Db, accountId: string, id: string, opts: { ifBindingRef?: RefCondition; shared?: boolean } = {}): boolean {
  return transaction(db, () => {
    const current = getPlatform(db, accountId, id);
    if (!current) return false;
    if (!refMatches(current.bindingRef, opts.ifBindingRef)) throw new BindingRefMismatchError('binding ref mismatch');
    if (opts.shared && current.deployments.some((d) => d.active)) throw new SharedPlatformInUseError('shared platform in use');
    return db.prepare('DELETE FROM platform WHERE tool_account_id = ? AND id = ?').run(accountId, id).changes > 0;
  });
}

// ---------------------------------------------------------------- deployments (LTI contract §9.5, §9.6)

export interface NewDeployment {
  deploymentId: string;
  /** Stored deployment site URL (shared profiles), else null. */
  siteUrl: string | null;
  active: boolean;
  bindingGeneration: number;
  bindingRef: string | null;
}

/** POST …/deployments. Throws DeploymentExistsError when the platform has the id (active or not). Null: unknown platform. */
export function addDeployment(db: Db, accountId: string, platformId: string, input: NewDeployment): DeploymentRecord | null {
  return transaction(db, () => {
    if (!getPlatform(db, accountId, platformId)) return null;
    if (db.prepare('SELECT 1 FROM deployment WHERE platform_id = ? AND deployment_id = ?').get(platformId, input.deploymentId)) throw new DeploymentExistsError('deployment exists');
    db.prepare(`INSERT INTO deployment (platform_id, deployment_id, site_url, active, binding_generation, binding_ref, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(platformId, input.deploymentId, input.siteUrl, input.active ? 1 : 0, input.bindingGeneration, input.bindingRef, Date.now());
    return findDeployment(getPlatform(db, accountId, platformId)!, input.deploymentId);
  });
}

export interface DeploymentChange {
  active: boolean;
  siteUrl: string | null;
  bindingGeneration: number;
  bindingRef: string | null;
}

/**
 * PATCH …/deployments/:deploymentId. In ONE transaction: the platform and the deployment are read, the condition
 * `ifBindingRef` is compared with the CURRENT ref, then `plan` decides the new row from the current one (it may throw
 * to refuse the change) and the row is written. Null: unknown platform. Throws UnknownDeploymentError and
 * BindingRefMismatchError.
 */
export function changeDeployment(
  db: Db, accountId: string, platformId: string, deploymentId: string, ifBindingRef: RefCondition,
  plan: (current: DeploymentRecord, platform: Platform) => DeploymentChange,
): DeploymentRecord | null {
  return transaction(db, () => {
    const platform = getPlatform(db, accountId, platformId);
    if (!platform) return null;
    const current = findDeployment(platform, deploymentId);
    if (!current) throw new UnknownDeploymentError('unknown deployment');
    if (!refMatches(current.bindingRef, ifBindingRef)) throw new BindingRefMismatchError('binding ref mismatch');
    const next = plan(current, platform);
    db.prepare('UPDATE deployment SET active = ?, site_url = ?, binding_generation = ?, binding_ref = ? WHERE platform_id = ? AND deployment_id = ?')
      .run(next.active ? 1 : 0, next.siteUrl, next.bindingGeneration, next.bindingRef, platformId, deploymentId);
    return findDeployment(getPlatform(db, accountId, platformId)!, deploymentId);
  });
}
