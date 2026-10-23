// Migration 004 on a v3 database with rows (ADR-011 §14, data-model §4.1): old rows keep today's behaviour.
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSqlite, sha256Hex } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { deriveServiceKey, findServiceKey, issueServiceKey } from '../store/service-keys.ts';
import { getPlatform } from '../store/platforms.ts';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const temps: string[] = [];
afterEach(() => { for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true }); });

describe('004_provider_profiles on a v3 schema with rows', () => {
  it('adds the columns with the old-row defaults; the service key keeps its exact value', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lti-mig-'));
    temps.push(dir);
    const v3 = join(dir, 'v3');
    mkdirSync(v3);
    for (const f of readdirSync(MIGRATIONS).filter((n) => n < '004')) copyFileSync(join(MIGRATIONS, f), join(v3, f));
    const file = join(dir, 'lti.db');
    let db = openSqlite(file, v3);
    db.prepare("INSERT INTO tool_account VALUES ('cogniate', 'C', 'h', 'l', 'd', 'r', 0)").run();
    db.prepare("INSERT INTO platform (id, tool_account_id, issuer, client_id, name, auth_endpoint, token_endpoint, jwks_url, active, created_at, updated_at) VALUES ('plt_1', 'cogniate', 'https://moodle.test', 'c', 'M', 'https://moodle.test/a', 'https://moodle.test/t', 'https://moodle.test/k', 1, 0, 0)").run();
    db.prepare("INSERT INTO deployment VALUES ('plt_1', '1')").run();
    const key = deriveServiceKey(Buffer.alloc(32, 7), { toolAccountId: 'cogniate', platformId: 'plt_1', deploymentId: '1', contextId: '2', resourceLinkId: '3' });
    db.prepare("INSERT INTO service_key (key_hash, tool_account_id, platform_id, deployment_id, context_id, resource_link_id, created_at, updated_at) VALUES (?, 'cogniate', 'plt_1', '1', '2', '3', 0, 0)").run(sha256Hex(key));
    db.close();
    db = openSqlite(file, MIGRATIONS);
    const p = getPlatform(db, 'cogniate', 'plt_1')!;
    expect(p).toMatchObject({ profile: 'standard', siteUrl: null, serviceUrl: null, bindingRef: null, deploymentIds: ['1'],
      deployments: [{ deploymentId: '1', siteUrl: null, active: true, bindingGeneration: 0, bindingRef: null, createdAt: null }] });
    expect(findServiceKey(db, 'cogniate', key)).toMatchObject({ bindingGeneration: 0, platformId: 'plt_1' });
    // A new launch of the same activity returns the same key value (generation 0).
    expect(issueServiceKey(db, Buffer.alloc(32, 7), { toolAccountId: 'cogniate', platformId: 'plt_1', deploymentId: '1', contextId: '2', resourceLinkId: '3', agsClaim: null, nrpsClaim: null }, 1)).toEqual({ serviceKey: key });
    expect(db.prepare('SELECT name FROM schema_migration ORDER BY name').all().map((r) => r.name)).toEqual(['001_init.sql', '002_service_keys.sql', '003_registration_sessions.sql', '004_provider_profiles.sql']);
    db.close();
  });
});
