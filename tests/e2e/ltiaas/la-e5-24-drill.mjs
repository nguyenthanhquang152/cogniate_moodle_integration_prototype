// LA-E5-24: Pilot backup and restore drill helpers (host & container).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E5-24.md (AC-LA-E5-24-01..06)
// - docs/architecture/ltiaas/operability.md (§7, §7.2 backup, §7.3 restore)
// - docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md (D3, D6, D14)
// - docs/architecture/ltiaas/tasks/README.md (§2 form (g), form (h))
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { validate as validateStackBackup } from '../../../infra/scripts/stack-data.mjs';

export const DRILL_ACS = Object.freeze([
  'AC-LA-E5-24-01',
  'AC-LA-E5-24-02',
  'AC-LA-E5-24-03',
  'AC-LA-E5-24-04',
  'AC-LA-E5-24-05',
  'AC-LA-E5-24-06',
]);

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const HEX32_RE = /^[0-9a-f]{32}$/;
export const OPERATOR_KEY_RE = /^ltio_[A-Za-z0-9_-]{43}$/;
export const TENANT_KEY_RE = /^ltis_[A-Za-z0-9_-]{43}$/;
export const JOURNAL_FILE = '.storage-journal.json';

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * AC-LA-E5-24-01: Validates the database backup folder (`<drillRoot>/db`) produced by
 * `npm run stack:data-backup -- --out <drillRoot>/db` using `infra/scripts/stack-data.mjs` `validate()`
 * plus drill manifest checks (ISO 8601 `createdAt`, non-empty migration lists for both services).
 */
export function inspectDrillBackup(backupDbDir, project) {
  assert.ok(backupDbDir && fs.existsSync(backupDbDir), `Backup directory exists: ${backupDbDir}`);
  const manifest = validateStackBackup(backupDbDir, project);
  assert.equal(manifest.formatVersion, 1, 'manifest.formatVersion === 1');
  assert.match(String(manifest.backupId ?? ''), UUID_RE, 'manifest.backupId is a UUID');
  assert.equal(manifest.composeProject, project, 'manifest.composeProject matches drill project');
  assert.equal(manifest.source, 'volume', 'manifest.source === "volume"');
  assert.match(String(manifest.pairId ?? ''), HEX32_RE, 'manifest.pairId is 32-char hex');
  assert.ok(Number.isInteger(manifest.generation) && manifest.generation >= 0, 'manifest.generation >= 0');
  const createdMs = Date.parse(String(manifest.createdAt ?? ''));
  assert.ok(!Number.isNaN(createdMs), 'manifest.createdAt is a valid ISO 8601 timestamp');

  for (const requiredDb of ['lti-service/lti.db', 'cogniate-app/cogniate.db']) {
    const fileEntry = manifest.files.find((f) => f.name === requiredDb);
    assert.ok(fileEntry, `manifest.files lists ${requiredDb}`);
    const fullPath = path.join(backupDbDir, requiredDb);
    assert.ok(fs.existsSync(fullPath), `Backed-up database file exists on disk: ${requiredDb}`);
    assert.equal(fs.statSync(fullPath).size, fileEntry.size, `Size matches manifest for ${requiredDb}`);
    assert.equal(sha256File(fullPath), fileEntry.sha256, `SHA-256 matches manifest for ${requiredDb}`);
    const migs = manifest.migrations?.[requiredDb];
    assert.ok(Array.isArray(migs) && migs.length > 0, `manifest.migrations[${requiredDb}] is non-empty`);
  }

  return {
    manifest,
    filesChecked: manifest.files.length,
    ltiMigrations: manifest.migrations['lti-service/lti.db'].length,
    appMigrations: manifest.migrations['cogniate-app/cogniate.db'].length,
  };
}

/**
 * AC-LA-E5-24-02 & operability.md §7.2 step 5: Builds the operator backup record (`backup-record.json`)
 * listing the key version IDs from `GET /operator/v1/key-provider` and holding zero key material.
 * Stored at `<drillRoot>/backup-record.json` (sibling of `<drillRoot>/db` so `<drillRoot>/db` has no unlisted files).
 */
export function buildBackupRecord({ manifest, keyProviderStatus, sourceRevision, contentSummary = null }) {
  assert.ok(manifest && typeof manifest === 'object', 'manifest is required');
  assert.ok(keyProviderStatus && typeof keyProviderStatus === 'object', 'keyProviderStatus is required');
  assert.ok(
    typeof keyProviderStatus.kind === 'string' && keyProviderStatus.kind.length > 0,
    'keyProviderStatus.kind is a non-empty string',
  );
  assert.ok(
    typeof keyProviderStatus.activeVersion === 'string' && keyProviderStatus.activeVersion.length > 0,
    'keyProviderStatus.activeVersion is a non-empty string',
  );
  assert.ok(
    Array.isArray(keyProviderStatus.versions) && keyProviderStatus.versions.length > 0,
    'keyProviderStatus.versions is a non-empty array',
  );

  const sanitizedVersions = keyProviderStatus.versions.map((v) => {
    assert.ok(v && typeof v.id === 'string' && v.id.length > 0, 'version entry has non-empty string id');
    assert.ok(
      v.state === 'active' || v.state === 'decrypt-only',
      `version ${v.id} state is active or decrypt-only`,
    );
    assert.ok(Number.isInteger(v.sealedCount) && v.sealedCount >= 0, `version ${v.id} sealedCount >= 0`);
    assert.ok(Number.isInteger(v.derivedCount) && v.derivedCount >= 0, `version ${v.id} derivedCount >= 0`);
    return {
      id: v.id,
      state: v.state,
      sealedCount: v.sealedCount,
      derivedCount: v.derivedCount,
    };
  });

  const versionIds = sanitizedVersions.map((v) => v.id);
  assert.ok(
    versionIds.includes(keyProviderStatus.activeVersion),
    'keyProviderStatus.versions includes activeVersion',
  );

  return {
    formatVersion: 1,
    backupId: manifest.backupId,
    createdAt: manifest.createdAt,
    composeProject: manifest.composeProject,
    pairId: manifest.pairId,
    generation: manifest.generation,
    sourceRevision: String(sourceRevision ?? 'unknown'),
    keyProvider: {
      kind: keyProviderStatus.kind,
      activeVersion: keyProviderStatus.activeVersion,
      versionIds,
      versions: sanitizedVersions,
    },
    databases: (manifest.files ?? []).map((f) => ({
      name: f.name,
      size: f.size,
      sha256: f.sha256,
    })),
    migrations: manifest.migrations ?? {},
    content: contentSummary ?? { packagesFiles: 0, uploadsFiles: 0, totalBytes: 0 },
  };
}

/**
 * AC-LA-E5-24-02: Scans `backup-record.json` (and optionally `manifest.json`) for any secret values
 * or key-material patterns. Returns `{ checkedSecretsCount, patternChecks, hits, matched }`.
 */
export function scanBackupRecordForSecrets(recordObjOrText, candidateSecrets = []) {
  const text = typeof recordObjOrText === 'string' ? recordObjOrText : JSON.stringify(recordObjOrText, null, 2);
  const usableSecrets = [...new Set(candidateSecrets.filter((s) => typeof s === 'string' && s.trim().length >= 8))];
  const matched = [];

  for (const secret of usableSecrets) {
    if (text.includes(secret)) {
      matched.push('candidate_secret_value');
    }
  }

  const forbiddenPatterns = [
    { name: 'operator_key_token', re: /ltio_[A-Za-z0-9_-]{43}/ },
    { name: 'tenant_api_key_token', re: /ltis_[A-Za-z0-9_-]{43}/ },
    { name: 'pem_private_key', re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/ },
    { name: 'raw_key_property', re: /"(?:masterKey|secretKey|privateKey|rawKey|keyMaterial|secret)"\s*:/ },
  ];

  for (const { name, re } of forbiddenPatterns) {
    if (re.test(text)) {
      matched.push(name);
    }
  }

  return {
    checkedSecretsCount: usableSecrets.length,
    patternChecks: forbiddenPatterns.length,
    hits: matched.length,
    matched,
  };
}

/**
 * AC-LA-E5-24-03: Builds the post-backup marker account payload for `POST /operator/v1/accounts`.
 */
export function buildDrillMarkerAccount(runId, publicAppUrl) {
  assert.ok(runId && /^[a-z0-9-]+$/i.test(String(runId)), 'runId must be alphanumeric/hyphen');
  const base = String(publicAppUrl).replace(/\/+$/, '');
  return {
    id: `drill-${runId}`,
    name: `Drill Marker ${runId}`,
    launchUrl: `${base}/tool/launch`,
    deepLinkingUrl: `${base}/tool/deep-link`,
    registrationUrl: `${base}/tool/register`,
  };
}

/**
 * AC-LA-E5-24-04: Verifies that `GET /operator/v1/accounts` after restore does not contain `drill-<runId>`.
 */
export function verifyDrillMarkerAbsent(accountsList, drillAccountId) {
  assert.ok(Array.isArray(accountsList), 'accountsList must be an array');
  assert.ok(typeof drillAccountId === 'string' && drillAccountId.startsWith('drill-'), 'drillAccountId must start with drill-');
  const found = accountsList.find((a) => a && a.id === drillAccountId);
  assert.equal(found, undefined, `Restored account list must not contain post-backup marker ${drillAccountId}`);
  const cogniate = accountsList.find((a) => a && a.id === 'cogniate');
  assert.ok(cogniate, 'Restored account list still contains baseline account "cogniate"');
  return {
    accountIds: accountsList.map((a) => a.id),
    drillMarkerPresent: false,
  };
}

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

/**
 * operability.md §7.2 step 4: Copies `infra/.data/cogniate-app/{packages,uploads}` to `<drillRoot>/content/`.
 */
export function copyContentFolders(srcAppDataDir, destContentDir) {
  fs.mkdirSync(destContentDir, { recursive: true, mode: 0o700 });
  let packagesFiles = 0;
  let uploadsFiles = 0;
  let totalBytes = 0;

  for (const sub of ['packages', 'uploads']) {
    const srcSub = path.join(srcAppDataDir, sub);
    const dstSub = path.join(destContentDir, sub);
    fs.rmSync(dstSub, { recursive: true, force: true });
    if (fs.existsSync(srcSub)) {
      fs.cpSync(srcSub, dstSub, { recursive: true });
      const files = listFilesRecursive(dstSub);
      for (const f of files) totalBytes += fs.statSync(f).size;
      if (sub === 'packages') packagesFiles = files.length;
      else uploadsFiles = files.length;
    } else {
      fs.mkdirSync(dstSub, { recursive: true, mode: 0o700 });
    }
  }

  return { packagesFiles, uploadsFiles, totalBytes };
}

/**
 * operability.md §7.3 step 5: Restores `<drillRoot>/content/{packages,uploads}` back to `infra/.data/cogniate-app/`.
 */
export function restoreContentFolders(srcContentDir, destAppDataDir) {
  fs.mkdirSync(destAppDataDir, { recursive: true });
  let restoredFiles = 0;
  for (const sub of ['packages', 'uploads']) {
    const srcSub = path.join(srcContentDir, sub);
    const dstSub = path.join(destAppDataDir, sub);
    fs.rmSync(dstSub, { recursive: true, force: true });
    if (fs.existsSync(srcSub)) {
      fs.cpSync(srcSub, dstSub, { recursive: true });
      restoredFiles += listFilesRecursive(dstSub).length;
    } else {
      fs.mkdirSync(dstSub, { recursive: true });
    }
  }
  return { restoredFiles };
}

/**
 * AC-LA-E5-24-06: Computes the drill RPO (backup age at restore start) and RTO (restore start to post-restore readyz).
 */
export function computeDrillMetrics({ backupCreatedAt, restoreStartedAt, restoreCompletedAt }) {
  const backupMs = Date.parse(String(backupCreatedAt ?? ''));
  const startMs = Date.parse(String(restoreStartedAt ?? ''));
  const endMs = Date.parse(String(restoreCompletedAt ?? ''));
  assert.ok(!Number.isNaN(backupMs), `Invalid backupCreatedAt ISO timestamp: ${backupCreatedAt}`);
  assert.ok(!Number.isNaN(startMs), `Invalid restoreStartedAt ISO timestamp: ${restoreStartedAt}`);
  assert.ok(!Number.isNaN(endMs), `Invalid restoreCompletedAt ISO timestamp: ${restoreCompletedAt}`);
  assert.ok(startMs >= backupMs, 'restoreStartedAt must be >= backupCreatedAt');
  assert.ok(endMs >= startMs, 'restoreCompletedAt must be >= restoreStartedAt');

  const rpoMs = startMs - backupMs;
  const rtoMs = endMs - startMs;
  return {
    backupCreatedAt: new Date(backupMs).toISOString(),
    restoreStartedAt: new Date(startMs).toISOString(),
    restoreCompletedAt: new Date(endMs).toISOString(),
    rpoMs,
    rpoSeconds: Number((rpoMs / 1000).toFixed(3)),
    rtoMs,
    rtoSeconds: Number((rtoMs / 1000).toFixed(3)),
  };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Pure Node.js ZIP builder for creating the 10-question HTML course package without external dependencies.
 */
export function makeZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const rawBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8');
    const compressed = zlib.deflateRawSync(rawBuf);
    const crc = crc32(rawBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    localParts.push(localHeader, nameBuf, compressed);
    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

export function makeHtmlCourseZipBuffer(title = 'LA-E5-24 Drill Course') {
  const questions = Array.from(
    { length: 10 },
    (_, n) =>
      `<fieldset data-cog-quiz="q${n}"><input type="radio" data-cog-correct="true"><input type="radio" data-cog-correct="false"></fieldset>`,
  ).join('');
  return makeZipBuffer([
    {
      name: 'index.html',
      data: `<!doctype html><meta charset="utf-8"><title>${title}</title><body data-lesson-id="index">${questions}</body>`,
    },
  ]);
}
