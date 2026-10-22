// The service entry point binds the key ring to the master-key Buffer of every store caller before the first store
// call (LA-ADR-06 D6; Reviewer-A A-LA-E5-08-01). Both listeners use port 0 here.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KeyProviderError, blobKeyVersion, keyProviderFor } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LtiService } from './main.ts';
import { startLtiService } from './main.ts';
import { ensureAccount } from './store/accounts.ts';
import { ensureToolKey } from './store/tool-keys.ts';
import { capturingLogger } from './testkit.ts';

// Fixture keys (test values, not secrets).
const LEGACY = Buffer.alloc(32, 7).toString('hex');
const K2 = Buffer.alloc(32, 2).toString('hex');

const temps: string[] = [];
let service: LtiService | null = null;
afterEach(async () => {
  await service?.close();
  service = null;
  vi.unstubAllEnvs();
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

describe('startLtiService (main.ts)', () => {
  it('with the ring {active: "k2"}, the service master key seals k2 blobs; an unbound copy of the key fails closed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lti-main-'));
    temps.push(dir);
    const ringFile = join(dir, 'keyring.json');
    writeFileSync(ringFile, JSON.stringify({ active: 'k2', keys: { legacy: LEGACY, k2: K2 } }), { mode: 0o600 });
    for (const [name, value] of Object.entries({
      DATA_DIR: dir, LTI_KEYRING_FILE: ringFile, LTI_MASTER_KEY: LEGACY, PORT: '0', OPERATOR_PORT: '0', OPERATOR_HOST: '127.0.0.1',
      PUBLIC_MOODLE_URL: 'https://moodle.test', PUBLIC_LTI_URL: 'https://lti.cogniate.test', PUBLIC_APP_URL: 'https://app.cogniate.test',
      PUBLIC_CONTENT_URL: 'https://content.cogniate-content.test',
    })) vi.stubEnv(name, value);
    const { logger, lines } = capturingLogger();
    service = await startLtiService({ logger });
    expect(lines.map((l) => l.event)).toContain('service_started');

    // The routes and the token client get service.config.masterKey: it gives the loaded ring.
    expect(keyProviderFor(service.config.masterKey).versions()[0]).toEqual({ id: 'k2', state: 'active' });
    ensureAccount(service.db, { id: 'cogniate', name: 'Cogniate', appUrl: 'https://app.cogniate.test' });
    const kid = await ensureToolKey(service.db, service.config.masterKey, 'cogniate');
    const row = service.db.prepare('SELECT private_jwk_encrypted AS blob FROM tool_key WHERE kid = ?').get(kid) as { blob: Uint8Array };
    expect(blobKeyVersion(row.blob)).toBe('k2');
    expect(lines.map((l) => l.event)).not.toContain('key_provider_legacy_fallback');

    // Fail closed: the same bytes in another Buffer are not bound, so they never seal as "legacy".
    let error: unknown;
    try {
      keyProviderFor(Buffer.from(service.config.masterKey));
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(KeyProviderError);
    expect((error as KeyProviderError).code).toBe('key_provider_not_bound');
  });
});
