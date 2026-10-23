import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSqlite, sha256Hex } from '@cogniate/shared';
import { expect, it } from 'vitest';
import { getAccount } from '../store/accounts.ts';
import { useApiKey } from '../store/api-keys.ts';
import { openDb } from '../db/index.ts';

it('AC-LA-E5-04-11: migrates M1 accounts without changing tool URLs, credentials or claim policy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lti-account-migration-'));
  const migrations = fileURLToPath(new URL('../db/migrations', import.meta.url));
  const old = join(dir, 'm1');
  mkdirSync(old);
  for (const f of readdirSync(migrations).filter((n) => n < '005')) copyFileSync(join(migrations, f), join(old, f));
  let db = openSqlite(join(dir, 'lti.db'), old);
  try {
    const apiKey = `ltis_${'a'.repeat(43)}`;
    db.prepare('INSERT INTO tool_account VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('cogniate', 'Cogniate', sha256Hex(apiKey), 'https://app.test/tool/launch', 'https://app.test/tool/deep-link', 'https://app.test/tool/register', 1234);
    db.close();
    db = openDb(join(dir, 'lti.db'));
    expect(getAccount(db, 'cogniate')).toEqual({ id: 'cogniate', name: 'Cogniate', launchUrl: 'https://app.test/tool/launch',
      deepLinkingUrl: 'https://app.test/tool/deep-link', registrationUrl: 'https://app.test/tool/register', createdAt: 1234,
      status: 'active', statusChangedAt: 1234, publicBaseUrl: null, limits: null, claimPolicy: null, serviceKeyWriteScope: 'context', autoRotate: false });
    expect(useApiKey(db, apiKey, Date.now())?.toolAccountId).toBe('cogniate');
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});
