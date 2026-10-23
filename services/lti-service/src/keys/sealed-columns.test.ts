import { createLocalKeyProvider, encrypt } from '@cogniate/shared';
import { expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { keyProviderStatus } from '../jobs/key-rewrap.ts';
import { ensureAccount } from '../store/accounts.ts';
import { createRegistrationSession, registrationTokenVersions } from '../store/registrations.ts';
import { toolKeyVersions } from '../store/tool-keys.ts';
import { keyVersionsInUse } from './key-config.ts';
import { REGISTRATION_TOKEN_COLUMN, SEALED_COLUMNS, TOOL_KEY_COLUMN, sealedVersionCounts } from './sealed-columns.ts';

it('registers every encrypted column in the LTI schema exactly once', () => {
  const db = openDb(':memory:');
  try {
    const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>;
    const schema = tables.flatMap(({ name: table }) => (db.prepare('SELECT name FROM pragma_table_info(?)').all(table) as Array<{ name: string }>)
      .filter(({ name }) => name.endsWith('_encrypted')).map(({ name }) => `${table}.${name}`)).sort();
    expect(SEALED_COLUMNS.map((column) => `${column.table}.${column.column}`).sort()).toEqual(schema);
    for (const spec of SEALED_COLUMNS) {
      const columns = db.prepare('SELECT name FROM pragma_table_info(?)').all(spec.table).map((row) => row.name);
      expect(columns).toContain(spec.key);
      expect(columns).toContain('tool_account_id');
    }
  } finally { db.close(); }
});

it('readiness, status and stores count removed-key blobs and expired tokens, but omit cleared blobs', async () => {
  const db = openDb(':memory:');
  try {
    const legacy = Buffer.alloc(32, 7);
    const keys = createLocalKeyProvider({ active: 'k2', keys: new Map([['legacy', legacy], ['k2', Buffer.alloc(32, 2)]]) });
    ensureAccount(db, { id: 'tool', name: 'Tool', appUrl: 'https://app.test' });
    for (const [kid, blob] of [['old', encrypt(legacy, 'old private key')], ['cleared', Buffer.alloc(0)]] as const) {
      db.prepare(`INSERT INTO tool_key (kid, tool_account_id, public_jwk, private_jwk_encrypted, status, created_at)
        VALUES (?, 'tool', '{}', ?, 'removed', 0)`).run(kid, blob);
    }
    const input = { toolAccountId: 'tool', openidConfigurationUrl: 'https://lms.test/oidc', registrationToken: 'expired token',
      platformConfiguration: {}, operation: 'new' as const, existingPlatformId: null, privacyLevel: 'public' as const, passthrough: {}, expiresAt: 0 };
    const session = createRegistrationSession(db, keys, input, 1000);
    createRegistrationSession(db, keys, { ...input, registrationToken: null }, 1000);
    expect(Object.fromEntries((await sealedVersionCounts(db)))).toEqual({ legacy: 1, k2: 1 });
    expect((await keyVersionsInUse(db))).toEqual(['k2', 'legacy']);
    expect(toolKeyVersions(db)).toEqual(['legacy']);
    expect(registrationTokenVersions(db)).toEqual(['k2']);
    expect((await keyProviderStatus(db, keys)).versions).toEqual([
      { id: 'k2', state: 'active', sealedCount: 1, derivedCount: 0 },
      { id: 'legacy', state: 'decrypt-only', sealedCount: 1, derivedCount: 0 },
    ]);
    expect(TOOL_KEY_COLUMN.aad('tool', 'kid')).toBe('lti:tool_key:private_jwk_encrypted:tool:kid');
    expect(REGISTRATION_TOKEN_COLUMN.aad('tool', session.id)).toBe(`lti:registration_session:registration_token_encrypted:tool:${session.id}`);
    const stored = db.prepare('SELECT registration_token_encrypted AS blob FROM registration_session WHERE id = ?').get(session.id)!;
    expect(Buffer.from(keys.openSync({ bytes: stored.blob as Uint8Array }, `lti:registration_session:registration_token_encrypted:tool:${session.id}`)).toString())
      .toBe('expired token');
  } finally { db.close(); }
});
