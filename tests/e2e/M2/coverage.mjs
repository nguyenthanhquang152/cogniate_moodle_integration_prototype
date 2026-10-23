// M2 inventory (QA-E2E), written from docs/architecture/tasks/M2.md independently of test discovery. Every AC and
// every named variant below is a required browser row; a missing, empty, skipped, retried or mixed-SHA result fails.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export const M2_REQUIRED = {
  'M2-01': ['cards', 'isolated-newest', 'moodle-card'],
  'M2-02': ['not-ready', 'ready'],
  'M2-03': ['profile-labels', 'rule1-http', 'rule1-path', 'rule1-query', 'rule1-fragment', 'rule1-userinfo',
    'rule2-ipv4', 'rule2-ipv6', 'rule2-localhost', 'rule2-sub-localhost', 'rule3-lti', 'rule3-app', 'rule3-content',
    'rule4-sso', 'rule4-sso-port', 'rule5-instructure', 'rule4-service-sso', 'valid-split', 'valid-default-service'],
  'M2-04': ['rows', 'copy-json', 'download-json', 'inline', 'clipboard-denied', 'download-failure'],
  'M2-05': ['success', 'grant-invalid', 'grant-mismatch', 'platform-in-use', 'invalid-values', 'lti-service-error'],
  'M2-06': ['success', 'deployment-in-use', 'retry-after-error', 'second-deployment'],
  'M2-07': ['badges', 'canvas-detail', 'no-add-elsewhere'],
  'M2-08': ['canvas-no-moodle-features', 'blackboard-no-moodle-features', 'moodle-controls'],
  'M2-09': ['blackboard-dialog', 'canvas-dialog', 'moodle-dialog'],
  'M2-10': ['publish-dialog', 'canvas-results'],
  'M2-11': ['canvas-keyboard', 'blackboard-keyboard', 'add-deployment-keyboard', 'axe-canvas', 'axe-blackboard', 'axe-canvas-detail'],
  'M2-12': ['canvas', 'blackboard'],
  'M2-13': ['routes-open', 'cross-provider', 'no-stale-values', 'form-state', 'cross-library'],
};
export function readM2Manifest(testsDir) {
  const file = path.join(testsDir, 'e2e', 'M2', 'manifest.json');
  assert.ok(fs.existsSync(file), `M2 manifest missing: ${file}`);
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(Array.isArray(rows) && rows.length > 0, 'M2 manifest is empty');
  const ids = new Set();
  for (const row of rows) {
    assert.match(row.id, /^M2-\d{2}\.[a-z0-9-]+$/);
    assert.equal(row.ac, 'AC-' + row.id.split('.')[0], `AC mismatch: ${row.id}`);
    assert.equal(row.environment, 'SIM', `M2 rows are SIM: ${row.id}`);
    assert.equal(row.kind, 'browser', `M2 rows are browser rows: ${row.id}`);
    assert.ok(row.title.includes(`{case:${row.id}}`), `Title carries the case tag: ${row.id}`);
    assert.ok(!ids.has(row.id), `Duplicate case: ${row.id}`); ids.add(row.id);
    assert.ok(fs.existsSync(path.join(testsDir, row.file)), `Case file missing: ${row.id}`);
  }
  for (const [ac, variants] of Object.entries(M2_REQUIRED)) {
    for (const variant of variants) assert.ok(ids.has(`${ac}.${variant}`), `Required M2 row missing: ${ac}.${variant}`);
  }
  for (const id of ids) {
    const [ac, variant] = id.split('.');
    assert.ok(M2_REQUIRED[ac]?.includes(variant), `Manifest row outside the inventory: ${id}`);
  }
  return rows;
}
