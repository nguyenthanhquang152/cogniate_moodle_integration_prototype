// LA-E5-22 K0 and UNIT verification suite (host-only, no Docker).
// Written by QA-2 from:
// - docs/architecture/ltiaas/tasks/LA-E5-22.md
// - docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md (D6 "Scope in LA", D10, D12)
// - docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md (D5 PortContext.seal/unseal)
// - docs/architecture/ltiaas/operability.md (§2, §4.4, §6.3)
// - docs/architecture/ltiaas/security-delta.md (§10 visibility rule)
// - docs/architecture/ltiaas/build-decisions-A2.md (§37 BD-A2-77..80, §44 BD-A2-91)
// - docs/architecture/ltiaas/build-decisions-A1.md (BD-A1-72)
//
// Secret rule: never place real secrets in assertion messages.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '../../../..');
const ROOT = process.env.LA_SCRATCH_CLONE ? path.resolve(process.env.LA_SCRATCH_CLONE) : DEFAULT_ROOT;

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'qa2-la-e5-22-k0-'));
afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

function writeSecretFile(name: string, content: string, mode = 0o600): string {
  const p = path.join(TMP_DIR, name);
  fs.writeFileSync(p, content, { mode });
  fs.chmodSync(p, mode);
  return p;
}

function writeArtifact(name: string, content: string): void {
  const dir = process.env.LA_RUN_DIR?.trim();
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, name), content, { mode: 0o600 });
}

function clearVitestCache(cwd: string): void {
  fs.rmSync(path.join(cwd, 'node_modules', '.vitest-cache'), { recursive: true, force: true });
  fs.rmSync(path.join(cwd, 'node_modules', '.vite'), { recursive: true, force: true });
}

/**
 * Craft a legacy AES-256-GCM blob (iv(12) | tag(16) | ciphertext, no AAD) whose 12-byte IV begins with `"cgk1"`.
 * A naive magic prefix check (`blob.subarray(0, 4) === "cgk1"`) would mistake it for a versioned header, whereas
 * authenticated metadata (`openWithMetadataSync`, BD-A2-38 / BD-A2-91) detects `legacyFormat: true` and re-seals it.
 */
function craftCollidingLegacyBlob(masterKey: Buffer, plaintext: string): Buffer {
  // 12-byte IV starting with "cgk1" (4 bytes) + 8 deterministic bytes
  const iv = Buffer.from('cgk1\x02k2_iv12', 'latin1');
  assert.equal(iv.length, 12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

describe('LA-E5-22 App key provider (K0 infra + UNIT rows, no Docker)', () => {
  it('Row 10 — Compose & infra secrets check (BD-A2-91 point 1a, security-delta §10): compose.yaml mounts infra/.secrets/app-keys read-only on cogniate-app, hides it from e2e via tmpfs, stack-up.sh and prepare_e2e create it (0700), and compose-e2e-secrets.test.mjs passes', () => {
    const composePath = path.join(ROOT, 'infra', 'compose.yaml');
    const composeText = fs.readFileSync(composePath, 'utf8');

    assert.match(
      composeText,
      /\.\/\.secrets\/app-keys:\/run\/secrets\/app-keys:ro/,
      'infra/compose.yaml must mount ./.secrets/app-keys:/run/secrets/app-keys:ro on cogniate-app',
    );
    assert.match(
      composeText,
      /\/repo\/infra\/\.secrets\/app-keys\b/,
      'infra/compose.yaml must cover /repo/infra/.secrets/app-keys with an empty tmpfs in the e2e service',
    );
    assert.doesNotMatch(
      composeText,
      /\/run\/secrets\/app\/keyring\.json/,
      'infra/compose.yaml must not use /run/secrets/app/keyring.json (BD-A2-91)',
    );

    const stackUpText = fs.readFileSync(path.join(ROOT, 'infra', 'scripts', 'stack-up.sh'), 'utf8');
    assert.match(
      stackUpText,
      /\.secrets\/app-keys/,
      'infra/scripts/stack-up.sh must create infra/.secrets/app-keys before docker compose up',
    );

    const libShText = fs.readFileSync(path.join(ROOT, 'infra', 'scripts', 'lib.sh'), 'utf8');
    assert.match(
      libShText,
      /\.secrets\/app-keys/,
      'infra/scripts/lib.sh (prepare_e2e) must create infra/.secrets/app-keys before e2e runs',
    );

    const infraTestPath = path.join(ROOT, 'infra', 'scripts', 'compose-e2e-secrets.test.mjs');
    const infraTestText = fs.readFileSync(infraTestPath, 'utf8');
    assert.match(
      infraTestText,
      /app-keys/,
      'infra/scripts/compose-e2e-secrets.test.mjs must check the hidden app-keys secret folder',
    );

    const res = spawnSync(process.execPath, ['--test', infraTestPath], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
    writeArtifact('la-e5-22-compose-e2e-secrets.log', out);
    assert.equal(res.status, 0, `compose-e2e-secrets.test.mjs exited ${res.status}:\n${out}`);
  });

  it('Rows 1, 2, 3, 4 (AC-LA-E5-22-05, BD-A1-72, BD-A2-77..80, BD-A2-91): settings, file mode rule, missing ring fallback, ring rules, and production refusal app_master_key_in_env', async () => {
    const sharedMod = (await import(pathToFileURL(path.join(ROOT, 'packages/shared/src/index.ts')).href)) as {
      ConfigRefusedError: new (reason: string, message: string, setting?: string) => Error & {
        reason: string;
        setting?: string;
      };
      KeyProviderError: new (code: string, message: string) => Error & { code: string };
    };
    const configMod = (await import(
      pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/config.ts')).href
    )) as {
      APP_MASTER_KEY_IN_ENV_MESSAGE: string;
      loadConfig: (
        env?: Record<string, string | undefined>,
        logger?: { warn: (event: string, fields?: Record<string, unknown>) => void },
      ) => {
        masterKey: Buffer;
        keyRing: { active: string; keys: ReadonlyMap<string, Uint8Array> };
      };
    };
    const sealingMod = (await import(
      pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/sealing.ts')).href
    )) as {
      DEFAULT_APP_KEYRING_FILE: string;
      readAppStartupKeys: (
        env?: Record<string, string | undefined>,
        logger?: { warn: (event: string, fields?: Record<string, unknown>) => void },
      ) => {
        handle: Buffer;
        ring: { active: string; keys: ReadonlyMap<string, Uint8Array> };
      };
    };

    const baseEnv = {
      PUBLIC_MOODLE_URL: 'https://moodle.test',
      PUBLIC_LTI_URL: 'https://lti.cogniate.test',
      PUBLIC_APP_URL: 'https://app.cogniate.test',
      PUBLIC_CONTENT_URL: 'https://content.cogniate-content.test',
      APP_KEYRING_FILE: path.join(TMP_DIR, 'nonexistent-keyring.json'),
    };
    const keyHex = 'ab'.repeat(32);
    const k2Hex = 'cd'.repeat(32);

    // Row 2: default APP_KEYRING_FILE is /run/secrets/app-keys/keyring.json; missing ring falls back to legacy
    expect(sealingMod.DEFAULT_APP_KEYRING_FILE).toBe('/run/secrets/app-keys/keyring.json');
    const fallback = sealingMod.readAppStartupKeys({
      APP_KEYRING_FILE: path.join(TMP_DIR, 'missing-ring.json'),
      APP_MASTER_KEY: keyHex.toUpperCase(),
    });
    expect(fallback.handle.toString('hex')).toBe(keyHex);
    expect(fallback.ring.active).toBe('legacy');
    expect([...fallback.ring.keys.keys()]).toEqual(['legacy']);

    // Row 1 (AC-LA-E5-22-05): APP_MASTER_KEY_FILE gives the same key as APP_MASTER_KEY (case-insensitive hex)
    const keyFile0600 = writeSecretFile('app-master-key-0600', `${keyHex.toUpperCase()}\n`, 0o600);
    const fromEnv = configMod.loadConfig({ ...baseEnv, APP_MASTER_KEY: keyHex });
    const fromFile = configMod.loadConfig({ ...baseEnv, APP_MASTER_KEY: undefined, APP_MASTER_KEY_FILE: keyFile0600 });
    expect(fromFile.masterKey.equals(fromEnv.masterKey)).toBe(true);
    expect(fromFile.keyRing.active).toBe('legacy');

    // Row 1 file mode rule: 0644 refused in production (secret_file_mode), warns in default
    const keyFile0644 = writeSecretFile('app-master-key-0644', keyHex, 0o644);
    let modeErr: unknown;
    try {
      configMod.loadConfig({
        ...baseEnv,
        STACK_PROFILE: 'production',
        APP_MASTER_KEY: undefined,
        APP_MASTER_KEY_FILE: keyFile0644,
      });
    } catch (e) {
      modeErr = e;
    }
    expect(modeErr).toBeInstanceOf(sharedMod.ConfigRefusedError);
    expect((modeErr as { reason?: string; setting?: string }).reason).toBe('secret_file_mode');
    expect((modeErr as { reason?: string; setting?: string }).setting).toBe('APP_MASTER_KEY_FILE');

    const warnSpy = vi.fn();
    const openCfg = configMod.loadConfig(
      { ...baseEnv, STACK_PROFILE: 'default', APP_MASTER_KEY: undefined, APP_MASTER_KEY_FILE: keyFile0644 },
      { warn: warnSpy },
    );
    expect(openCfg.masterKey.toString('hex')).toBe(keyHex);
    expect(warnSpy).toHaveBeenCalledWith('secret_file_mode_open', { setting: 'APP_MASTER_KEY_FILE' });

    // Row 3: Ring rules (ring-only start works when ring holds legacy; ring without legacy fails; mismatching master key fails)
    const validRingPath = writeSecretFile(
      'valid-ring.json',
      JSON.stringify({ active: 'k2', keys: { legacy: keyHex, k2: k2Hex } }),
      0o600,
    );
    const ringOnly = configMod.loadConfig({
      ...baseEnv,
      STACK_PROFILE: 'production',
      APP_MASTER_KEY: undefined,
      APP_KEYRING_FILE: validRingPath,
    });
    expect(ringOnly.masterKey.toString('hex')).toBe(keyHex);
    expect(ringOnly.keyRing.active).toBe('k2');

    const noLegacyRingPath = writeSecretFile(
      'no-legacy-ring.json',
      JSON.stringify({ active: 'k2', keys: { k2: k2Hex } }),
      0o600,
    );
    expect(() =>
      sealingMod.readAppStartupKeys({
        APP_KEYRING_FILE: noLegacyRingPath,
      }),
    ).toThrow(/no legacy version/);

    expect(() =>
      sealingMod.readAppStartupKeys({
        APP_KEYRING_FILE: validRingPath,
        APP_MASTER_KEY: k2Hex,
      }),
    ).toThrow(/legacy version differ/);

    // Row 4: Production refusal app_master_key_in_env
    let envErr: unknown;
    try {
      configMod.loadConfig({
        ...baseEnv,
        STACK_PROFILE: 'production',
        APP_MASTER_KEY: keyHex,
      });
    } catch (e) {
      envErr = e;
    }
    expect(envErr).toBeInstanceOf(sharedMod.ConfigRefusedError);
    expect((envErr as { reason?: string }).reason).toBe('app_master_key_in_env');
    expect((envErr as Error).message).toBe(configMod.APP_MASTER_KEY_IN_ENV_MESSAGE);
    expect(configMod.APP_MASTER_KEY_IN_ENV_MESSAGE).not.toContain(keyHex);
  });

  it('Rows 5, 6, 7, 8, 9 (AC-LA-E5-22-02, AC-LA-E5-22-03, AC-LA-E5-22-04, BD-A2-91): cgk1 sealing & legacy open, AAD row binding, runtimeTokenFor golden, app:keys status|rewrap (including colliding legacy blob & >100 row batching), and /readyz key_version_missing', async () => {
    const sharedMod = (await import(pathToFileURL(path.join(ROOT, 'packages/shared/src/index.ts')).href)) as {
      createLocalKeyProvider: (
        ring: { active: string; keys: ReadonlyMap<string, Uint8Array> },
        opts?: Record<string, unknown>,
      ) => {
        readonly kind: 'local-keyring';
        activeVersion: () => string;
        versions: () => ReadonlyArray<{ id: string; state: 'active' | 'decrypt-only' }>;
        sealSync: (plaintext: Uint8Array, aad: string) => { bytes: Uint8Array };
        openSync: (blob: { bytes: Uint8Array }, aad: string) => Uint8Array;
        openWithMetadataSync: (
          blob: { bytes: Uint8Array },
          aad: string,
        ) => { plaintext: Uint8Array; version: string; legacyFormat: boolean };
      };
      encrypt: (key: Buffer, plaintext: string) => Buffer;
      blobKeyVersion: (bytes: Uint8Array) => string;
    };
    const sealingMod = (await import(
      pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/sealing.ts')).href
    )) as {
      WS_TOKEN_COLUMN: { table: 'connection'; column: string; rows: string; update: string; rewrap: boolean };
      REF_COPY_COLUMN: { table: 'connection'; column: string; rows: string; update: string; rewrap: boolean };
      SERVICE_KEY_COLUMN: { table: 'resource_link'; column: string; rows: string; update: string; rewrap: boolean };
      PICKER_LTIK_COLUMN: { table: 'picker_session'; column: string; rows: string; update: string; rewrap: boolean };
      appAad: (col: { table: string; column: string }, libraryId: string, rowKey: string) => string;
      sealText: (handle: Buffer, text: string, aad: string) => Buffer;
      openText: (handle: Buffer, blob: Uint8Array, aad: string) => string;
      runtimeTokenMac: (handle: Buffer, input: string) => string;
      rewrapAppBlobs: (
        db: unknown,
        provider: unknown,
      ) => {
        examined: number;
        rewrapped: number;
        skippedChanged: number;
        unreadable: number;
        unreadableVersions: string[];
      };
      appSealedVersionCounts: (db: unknown) => Map<string, number>;
    };
    const launchRulesMod = (await import(
      pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/tool-pages/launch-rules.ts')).href
    )) as {
      runtimeTokenFor: (masterKey: Buffer, playId: string) => string;
    };
    const keysCliMod = (await import(
      pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/cli/keys.ts')).href
    )) as {
      runKeysCommand: (
        deps: {
          db: unknown;
          keys: unknown;
          logger: { warn: (e: string, f?: Record<string, unknown>) => void };
          now: () => number;
          env?: NodeJS.ProcessEnv;
        },
        argv: string[],
        traceId: string,
      ) => { exitCode: number; lines: string[] };
    };
    const metricsMod = (await import(
      pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/metrics.ts')).href
    )) as {
      AppMetrics: new (db: unknown) => unknown;
      readiness: (db: unknown, keys?: unknown) => string[];
      buildOperatorListener: (deps: {
        db: unknown;
        metrics: unknown;
        keys?: unknown;
      }) => {
        inject: (opts: { method: string; url: string }) => Promise<{ statusCode: number; json: () => unknown }>;
        close: () => Promise<void>;
      };
    };
    const auditMod = (await import(
      pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/audit.ts')).href
    )) as {
      listAuditEvents: (db: unknown, filter: { action?: string; limit?: number }) => { events: unknown[] };
    };
    const testkitMod = (await import(
      pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/testkit.ts')).href
    )) as {
      TEST_MASTER_KEY: Buffer;
      TEST_CHANNELS: unknown;
      testSetupOf: (id: string) => { sharingOf: unknown } | undefined;
      testApp: () => Promise<{
        app: { close: () => Promise<void> };
        db: {
          prepare: (sql: string) => {
            run: (...args: unknown[]) => { changes: number };
            get: (...args: unknown[]) => Record<string, unknown> | undefined;
            all: (...args: unknown[]) => Array<Record<string, unknown>>;
          };
        };
        clock: { now: number };
      }>;
    };
    const librariesMod = (await import(
      pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/domain/libraries.ts')).href
    )) as {
      ensureLibrary: (db: unknown, name: string, now: number) => { id: string };
    };
    const connectionsMod = (await import(
      pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/domain/connections.ts')).href
    )) as {
      createConnection: (
        db: unknown,
        libraryId: string,
        body: Record<string, unknown>,
        ref: null,
        now: number,
        channels: unknown,
        sharingOf: unknown,
      ) => { id: string; libraryId: string };
    };

    // Row 7 (AC-LA-E5-22-04): runtimeTokenFor byte-identical golden check
    const playId = 'ply_golden0000000000000000';
    const expectedGoldenToken = crypto
      .createHmac('sha256', testkitMod.TEST_MASTER_KEY)
      .update(`runtime-token:${playId}`)
      .digest('base64url');
    expect(expectedGoldenToken).toBe('8EuoxYc7NuEdg5c8LoOwSIMR0KrMD_5FIPW4Jv73PtI');
    expect(launchRulesMod.runtimeTokenFor(testkitMod.TEST_MASTER_KEY, playId)).toBe(expectedGoldenToken);
    expect(sealingMod.runtimeTokenMac(testkitMod.TEST_MASTER_KEY, `runtime-token:${playId}`)).toBe(expectedGoldenToken);

    const t = await testkitMod.testApp();
    try {
      const { db } = t;
      const libA = librariesMod.ensureLibrary(db, 'QA2 Library A', t.clock.now);
      const libB = librariesMod.ensureLibrary(db, 'QA2 Library B', t.clock.now);
      const sharing = testkitMod.testSetupOf('moodle')!.sharingOf;
      const connA = connectionsMod.createConnection(
        db,
        libA.id,
        { name: 'Moodle A', siteUrl: 'https://moodle-a.test', method: 'manual', channel: 'moodle', profile: 'standard' },
        null,
        t.clock.now,
        testkitMod.TEST_CHANNELS,
        sharing,
      );
      const connB = connectionsMod.createConnection(
        db,
        libB.id,
        { name: 'Moodle B', siteUrl: 'https://moodle-b.test', method: 'manual', channel: 'moodle', profile: 'standard' },
        null,
        t.clock.now,
        testkitMod.TEST_CHANNELS,
        sharing,
      );

      // Row 5 (AC-LA-E5-22-02) & Row 6 (AC-LA-E5-22-03): cgk1 sealing, legacy open, and AAD row binding
      const aadA = sealingMod.appAad(sealingMod.WS_TOKEN_COLUMN, libA.id, connA.id);
      const aadB = sealingMod.appAad(sealingMod.WS_TOKEN_COLUMN, libB.id, connB.id);
      expect(aadA).toBe(`app:connection:ws_token_encrypted:${libA.id}:${connA.id}`);

      const sealedA = sealingMod.sealText(testkitMod.TEST_MASTER_KEY, 'ws-secret-a', aadA);
      expect(Buffer.from(sealedA.subarray(0, 4)).toString('ascii')).toBe('cgk1');
      expect(sealingMod.openText(testkitMod.TEST_MASTER_KEY, sealedA, aadA)).toBe('ws-secret-a');

      const legacyB = sharedMod.encrypt(testkitMod.TEST_MASTER_KEY, 'ws-legacy-b');
      expect(Buffer.from(legacyB.subarray(0, 4)).toString('ascii')).not.toBe('cgk1');
      expect(sealingMod.openText(testkitMod.TEST_MASTER_KEY, legacyB, aadB)).toBe('ws-legacy-b');

      // AC-LA-E5-22-03: blob copied to another library's row, another row key, or another column does not open
      expect(() => sealingMod.openText(testkitMod.TEST_MASTER_KEY, sealedA, aadB)).toThrow(/did not open/);
      expect(() =>
        sealingMod.openText(
          testkitMod.TEST_MASTER_KEY,
          sealedA,
          sealingMod.appAad(sealingMod.REF_COPY_COLUMN, libA.id, connA.id),
        ),
      ).toThrow(/did not open/);
      expect(() =>
        sealingMod.openText(
          testkitMod.TEST_MASTER_KEY,
          sealedA,
          sealingMod.appAad(sealingMod.SERVICE_KEY_COLUMN, libA.id, connA.id),
        ),
      ).toThrow(/did not open/);
      expect(() =>
        sealingMod.openText(
          testkitMod.TEST_MASTER_KEY,
          sealedA,
          sealingMod.appAad(sealingMod.PICKER_LTIK_COLUMN, libA.id, connA.id),
        ),
      ).toThrow(/did not open/);

      // Row 8: Colliding legacy blob (IV starts with "cgk1") is opened via legacy fallback and re-sealed by rewrapAppBlobs
      const collidingLegacy = craftCollidingLegacyBlob(testkitMod.TEST_MASTER_KEY, 'colliding-legacy-secret');
      expect(Buffer.from(collidingLegacy.subarray(0, 4)).toString('ascii')).toBe('cgk1');
      db.prepare('UPDATE connection SET ws_token_encrypted = ? WHERE id = ?').run(collidingLegacy, connA.id);
      db.prepare('UPDATE connection SET ws_token_encrypted = ? WHERE id = ?').run(legacyB, connB.id);

      const k2Key = Buffer.alloc(32, 0x22);
      const providerK2 = sharedMod.createLocalKeyProvider({
        active: 'k2',
        keys: new Map([
          ['legacy', testkitMod.TEST_MASTER_KEY],
          ['k2', k2Key],
        ]),
      });

      // Verify openWithMetadataSync identifies the colliding blob as legacyFormat: true
      const meta = providerK2.openWithMetadataSync({ bytes: collidingLegacy }, aadA);
      expect(meta.legacyFormat).toBe(true);
      expect(meta.version).toBe('legacy');
      expect(Buffer.from(meta.plaintext).toString('utf8')).toBe('colliding-legacy-secret');

      // Run app:keys rewrap via runKeysCommand
      const warn = vi.fn();
      const rewrapCmd = keysCliMod.runKeysCommand(
        { db, keys: providerK2, logger: { warn }, now: () => 1_700_000_000_000, env: { STACK_PROFILE: 'default' } },
        ['rewrap', '--operator', 'qa2-op'],
        'trace-qa2-e522',
      );
      expect(rewrapCmd.exitCode).toBe(0);
      expect(rewrapCmd.lines[0]).toBe(
        'Re-wrap: complete. Examined 2, re-wrapped 2, skipped because changed 0, unreadable 0.',
      );

      // Verify the colliding legacy blob is now genuinely sealed with k2 (authenticated metadata legacyFormat: false)
      const rewrappedBlobA = db
        .prepare('SELECT ws_token_encrypted AS blob FROM connection WHERE id = ?')
        .get(connA.id)!.blob as Uint8Array;
      const metaAfter = providerK2.openWithMetadataSync({ bytes: rewrappedBlobA }, aadA);
      expect(metaAfter.legacyFormat).toBe(false);
      expect(metaAfter.version).toBe('k2');
      expect(Buffer.from(metaAfter.plaintext).toString('utf8')).toBe('colliding-legacy-secret');

      // Verify one key_provider.rewrap audit event was written
      const events = auditMod.listAuditEvents(db, { action: 'key_provider.rewrap', limit: 10 }).events;
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        action: 'key_provider.rewrap',
        actor: { type: 'operator', id: 'qa2-op' },
        result: 'ok',
        traceId: 'trace-qa2-e522',
        details: {
          outcome: 'complete',
          activeVersion: 'k2',
          examined: 2,
          rewrapped: 2,
          skippedChanged: 0,
          unreadable: 0,
        },
      });

      // Row 9: Readiness key_version_missing when ring lacks k2 (which stored rows now use)
      const providerMissingK2 = sharedMod.createLocalKeyProvider({
        active: 'legacy',
        keys: new Map([['legacy', testkitMod.TEST_MASTER_KEY]]),
      });
      expect(metricsMod.readiness(db, providerMissingK2)).toEqual(['key_version_missing']);
      expect(metricsMod.readiness(db, providerK2)).toEqual([]);

      const opListener = metricsMod.buildOperatorListener({
        db,
        metrics: new metricsMod.AppMetrics(db),
        keys: providerMissingK2,
      });
      try {
        const res503 = await opListener.inject({ method: 'GET', url: '/readyz' });
        expect(res503.statusCode).toBe(503);
        expect(res503.json()).toEqual({ status: 'not_ready', reasons: ['key_version_missing'] });
      } finally {
        await opListener.close();
      }
    } finally {
      await t.app.close();
    }
  });

  it('Author unit suites for LA-E5-22 pass with a fresh Vitest cache', () => {
    clearVitestCache(ROOT);

    const testFiles = [
      'services/cogniate-app/src/app/sealing.test.ts',
      'services/cogniate-app/src/app/sealing-start.test.ts',
      'services/cogniate-app/src/cli/keys.test.ts',
      'services/cogniate-app/src/config.test.ts',
      'services/cogniate-app/src/app/metrics.test.ts',
      'services/cogniate-app/src/kernel/port-context.test.ts',
      'services/cogniate-app/src/tool-pages/launch.test.ts',
      'services/cogniate-app/src/worker-main.test.ts',
    ];
    for (const rel of testFiles) {
      assert.equal(fs.existsSync(path.join(ROOT, rel)), true, `expected unit test file ${rel} to exist`);
    }

    const res = spawnSync('npx', ['--no-install', 'vitest', 'run', '--reporter=verbose', ...testFiles], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env },
    });
    const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
    writeArtifact('la-e5-22-unit-tests.log', out);
    assert.equal(res.status, 0, `cogniate-app LA-E5-22 unit tests exited ${res.status}:\n${out}`);
  });
});
