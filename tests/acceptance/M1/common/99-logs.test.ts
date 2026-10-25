import fs from 'node:fs';
import path from 'node:path';
import { capturedSecrets } from '../../lib/lti';
import { readLog } from '../../lib/logs';
import { artifactsDir, LOGS_DIR, TESTS_DIR } from '../../lib/paths';
import { assert, expectStatus, m1Test, rememberSecret, sim } from './client';

const eventFields: Record<string, [string, string[]]> = {
  grant_issued: ['info', ['grant_id', 'connection_id', 'purpose', 'expires_at']],
  grant_redemption_cancelled: ['warn', ['grant_id', 'connection_id', 'reason']],
  grant_cleanup: ['warn', ['grant_id', 'platform_id', 'deployment_id', 'result']],
  binding_fenced: ['warn', ['connection_id', 'platform_id', 'deployment_id', 'result']],
  grant_compensation_failed: ['error', ['grant_id', 'platform_id', 'deployment_id', 'error']],
  binding_suspended: ['warn', ['connection_id', 'note_present']],
  binding_released: ['warn', ['connection_id', 'platform_id', 'deployment_id', 'result']],
  grant_revoked: ['info', ['grant_id']],
  grant_redeemed: ['info', ['grant_id', 'connection_id', 'purpose', 'platform_id', 'deployment_id', 'attempt_id']],
  grant_rejected: ['warn', ['reason', 'connection_id']],
};
function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory() ? files(path.join(dir, item.name)) : item.isFile() ? [path.join(dir, item.name)] : []);
}
m1Test('M1-24.common.event-shapes', 'new app and deployment events have exactly the documented fields', async () => {
  const base = ['ts', 'level', 'service', 'event', 'trace_id'];
  for (const [service, schema] of [
    ['cogniate-app', eventFields],
    ['lti-service', {
      platform_created: ['info', ['platform_id', 'profile']],
      deployment_added: ['info', ['platform_id', 'deployment_id']],
      deployment_updated: ['info', ['platform_id', 'deployment_id', 'active', 'binding_generation']],
      launch_claims_minimized: ['info', ['platform_id', 'claims', 'tool_account_id']],
    }],
  ] as [string, Record<string, [string, string[]]>][]) {
    const log = readLog(service); assert.deepEqual(log.badLines, []);
    for (const [name, [level, fields]] of Object.entries(schema)) {
      const entries = log.entries.filter((e) => e.entry.event === name
        && (name !== 'platform_created' || e.entry.profile && e.entry.profile !== 'standard'));
      assert.ok(entries.length, `Required ${name} event was exercised`);
      for (const { entry } of entries) {
        assert.equal(entry.level, level);
        assert.deepEqual(Object.keys(entry).sort(), [...base, ...fields].sort(), name);
      }
    }
  }
});
m1Test('M1-24.common.secrets', 'captured secrets never appear in service, simulator or gate logs', async () => {
  const capture = await sim('/secrets'); expectStatus(capture, 200);
  assert.ok(Array.isArray(capture.json.values));
  for (const value of capture.json.values) rememberSecret(value);
  const raw = path.join(artifactsDir('acceptance'), 'm1-secrets.raw.jsonl');
  const values = [...capturedSecrets().map((s) => s.value),
    ...(fs.existsSync(raw) ? fs.readFileSync(raw, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as string) : [])];
  assert.ok(values.length > 0, 'Leak scan captured real test values');
  const logs = files(LOGS_DIR).filter((file) => file.endsWith('.jsonl'));
  assert.ok(logs.some((f) => f.endsWith('lms-sim.jsonl')), 'Simulator log present');
  assert.ok(logs.some((f) => f.endsWith('lti-gate.jsonl')), 'Gate log present');
  for (const file of logs) {
    const content = fs.readFileSync(file, 'utf8');
    for (const value of new Set(values)) if (value.length >= 8) assert.equal(content.includes(value), false, `Captured secret leaked in ${path.basename(file)}`);
  }
  for (const file of files(path.join(TESTS_DIR, 'fixtures'))) {
    const content = fs.readFileSync(file);
    assert.equal(content.includes(Buffer.from('-----BEGIN PRIVATE KEY-----')), false, 'Private key in fixture file');
    assert.equal(content.includes(Buffer.from('-----BEGIN RSA PRIVATE KEY-----')), false, 'Private RSA key in fixture file');
    if (file.endsWith('.json')) {
      const data = JSON.parse(content.toString());
      const walk = (node: any): void => {
        if (!node || typeof node !== 'object') return;
        if (node.kty === 'RSA') assert.equal(Object.hasOwn(node, 'd'), false, 'Private JWK in fixture file');
        Object.values(node).forEach(walk);
      };
      walk(data);
    }
  }
  fs.writeFileSync(path.join(artifactsDir('acceptance'), 'm1-leak-scan.json'),
    JSON.stringify({ checkedValues: new Set(values).size, checkedLogs: logs.map((p) => path.basename(p)), hits: 0 }));
});
