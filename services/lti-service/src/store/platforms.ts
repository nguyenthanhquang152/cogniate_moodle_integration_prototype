import { randomBytes } from 'node:crypto';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';

export interface Platform {
  id: string;
  toolAccountId: string;
  issuer: string;
  clientId: string;
  name: string;
  authEndpoint: string;
  tokenEndpoint: string;
  jwksUrl: string;
  productFamilyCode: string | null;
  active: boolean;
  deploymentIds: string[];
}

interface PlatformRow {
  id: string; tool_account_id: string; issuer: string; client_id: string; name: string; auth_endpoint: string;
  token_endpoint: string; jwks_url: string; product_family_code: string | null; active: number;
}

function deploymentsOf(db: Db, platformId: string): string[] {
  return (db.prepare('SELECT deployment_id FROM deployment WHERE platform_id = ? ORDER BY deployment_id').all(platformId) as Array<{ deployment_id: string }>)
    .map((r) => r.deployment_id);
}

function toPlatform(db: Db, r: PlatformRow): Platform {
  return {
    id: r.id, toolAccountId: r.tool_account_id, issuer: r.issuer, clientId: r.client_id, name: r.name,
    authEndpoint: r.auth_endpoint, tokenEndpoint: r.token_endpoint, jwksUrl: r.jwks_url,
    productFamilyCode: r.product_family_code, active: r.active === 1, deploymentIds: deploymentsOf(db, r.id),
  };
}

export interface NewPlatform {
  issuer: string; clientId: string; name: string; authEndpoint: string; tokenEndpoint: string; jwksUrl: string;
  deploymentIds: string[]; active: boolean; productFamilyCode?: string | null;
}

export class PlatformExistsError extends Error {}

export function createPlatform(db: Db, accountId: string, input: NewPlatform): Platform {
  return transaction(db, () => {
    const dup = db.prepare('SELECT id FROM platform WHERE tool_account_id = ? AND issuer = ? AND client_id = ?').get(accountId, input.issuer, input.clientId);
    if (dup) throw new PlatformExistsError('platform exists');
    const id = `plt_${randomBytes(12).toString('base64url')}`;
    const now = Date.now();
    db.prepare(`INSERT INTO platform (id, tool_account_id, issuer, client_id, name, auth_endpoint, token_endpoint, jwks_url,
                product_family_code, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, accountId, input.issuer, input.clientId, input.name, input.authEndpoint, input.tokenEndpoint, input.jwksUrl,
        input.productFamilyCode ?? null, input.active ? 1 : 0, now, now);
    const add = db.prepare('INSERT OR IGNORE INTO deployment (platform_id, deployment_id) VALUES (?, ?)');
    for (const d of input.deploymentIds) add.run(id, d);
    return getPlatform(db, accountId, id)!;
  });
}

/** Every lookup includes the tool account (tenant isolation, security §8). */
export function getPlatform(db: Db, accountId: string, id: string): Platform | null {
  const row = db.prepare('SELECT * FROM platform WHERE tool_account_id = ? AND id = ?').get(accountId, id) as PlatformRow | undefined;
  return row ? toPlatform(db, row) : null;
}

export function listPlatforms(db: Db, accountId: string, filter: { id?: string; url?: string; clientId?: string } = {}): Platform[] {
  const where = ['tool_account_id = ?'];
  const args: string[] = [accountId];
  if (filter.id !== undefined) { where.push('id = ?'); args.push(filter.id); }
  if (filter.url !== undefined) { where.push('issuer = ?'); args.push(filter.url); }
  if (filter.clientId !== undefined) { where.push('client_id = ?'); args.push(filter.clientId); }
  const rows = db.prepare(`SELECT * FROM platform WHERE ${where.join(' AND ')} ORDER BY created_at, id`).all(...args) as unknown as PlatformRow[];
  return rows.map((r) => toPlatform(db, r));
}

export function updatePlatform(db: Db, accountId: string, id: string, patch: { name?: string; active?: boolean; deploymentIds?: string[] }): Platform | null {
  return transaction(db, () => {
    const current = getPlatform(db, accountId, id);
    if (!current) return null;
    db.prepare('UPDATE platform SET name = ?, active = ?, updated_at = ? WHERE id = ?')
      .run(patch.name ?? current.name, (patch.active ?? current.active) ? 1 : 0, Date.now(), id);
    if (patch.deploymentIds) {
      db.prepare('DELETE FROM deployment WHERE platform_id = ?').run(id);
      const add = db.prepare('INSERT OR IGNORE INTO deployment (platform_id, deployment_id) VALUES (?, ?)');
      for (const d of patch.deploymentIds) add.run(id, d);
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
  input: { clientId: string; name: string; authEndpoint: string; tokenEndpoint: string; jwksUrl: string; active: boolean; productFamilyCode: string | null; deploymentId: string },
): Platform | null {
  return transaction(db, () => {
    if (!getPlatform(db, accountId, id)) return null;
    db.prepare(`UPDATE platform SET client_id = ?, name = ?, auth_endpoint = ?, token_endpoint = ?, jwks_url = ?, active = ?,
      product_family_code = COALESCE(?, product_family_code), updated_at = ? WHERE id = ? AND tool_account_id = ?`)
      .run(input.clientId, input.name, input.authEndpoint, input.tokenEndpoint, input.jwksUrl, input.active ? 1 : 0, input.productFamilyCode, Date.now(), id, accountId);
    db.prepare('INSERT OR IGNORE INTO deployment (platform_id, deployment_id) VALUES (?, ?)').run(id, input.deploymentId);
    return getPlatform(db, accountId, id);
  });
}

/** A single account-scoped delete cascades to states, launches, deployments and service keys. */
export function deletePlatform(db: Db, accountId: string, id: string): boolean {
  return db.prepare('DELETE FROM platform WHERE tool_account_id = ? AND id = ?').run(accountId, id).changes > 0;
}
