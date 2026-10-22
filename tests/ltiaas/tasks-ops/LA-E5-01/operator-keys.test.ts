// LA-E5-01 acceptance (K1-SIM): operator listener, operator keys, `lti:operator init`. Runs in the e2e container on
// the acceptance profile (QA_TASK=LA-E5-01). One test per AC; each title starts with its AC id.
// Source: docs/architecture/ltiaas/tasks/LA-E5-01.md; contract delta §1.2, §1.3, §3; LA-ADR-06 D3; operability §6.4.
// Host rows of the same task (run.mjs): AC-LA-E5-01-04 (default profile log line) and the stack:up part of -06.
// Order in this one file: read-only checks (-01..-03), the operator-key API (-08..-10), the init forms (-05..-07;
// -07 revokes every operator key, so it is last), then the log hygiene check.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { afterAll, beforeAll, it } from 'vitest';
import { publicUrls } from '../../../acceptance/lib/env';
import { httpsRequest } from '../../../acceptance/lib/https';
import { apiKey, auth, errorCode, hasErrorShape, ltiApi } from '../../../acceptance/lib/lti';
import { operatorInit } from './host-init';
import {
  INVALID_OPERATOR_AUTH, OPERATOR_KEY_RE, TENANT_KEY_RE, hashForms, issueOperatorKey, listOperatorKeys, logFilesContaining,
  operatorApi, operatorAuth, readOperatorKey, revokeOperatorKey, unknownOperatorKey, type OperatorKeyRow,
} from './operator';

const urls = publicUrls();
const MIN = 60_000;
const DAY = 86_400_000;
const runId = crypto.randomBytes(4).toString('hex');
const name = (label: string) => `qa2-${label}-${runId}`;

let primary = ''; // the key of infra/.secrets/lti-operator-key (after AC-07: the new key)
let tenant = '';
const seenKeys: string[] = []; // every operator key of this run (hygiene check)
const issued: { id: string; key: string }[] = []; // keys that this run issued (clean-up)

/** The list without `lastUsedAt` (each call changes it), sorted by id. */
const stable = (rows: OperatorKeyRow[]) =>
  rows.map(({ id, operator, createdAt, expiresAt, revokedAt }) => ({ id, operator, createdAt, expiresAt, revokedAt })).sort((a, b) => a.id.localeCompare(b.id));
const isDate = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const description = (res: { json: unknown }) => String((res.json as { details?: { description?: unknown } } | null)?.details?.description ?? '');

function remember(res: { status: number; json: unknown }) {
  const j = res.json as { id?: unknown; operatorKey?: unknown } | null;
  if (typeof j?.id === 'string' && typeof j.operatorKey === 'string') {
    issued.push({ id: j.id, key: j.operatorKey });
    seenKeys.push(j.operatorKey);
  }
}

function oneYearAndOneDayAhead(): number {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.getTime() + DAY;
}

beforeAll(() => {
  primary = readOperatorKey();
  assert.ok(OPERATOR_KEY_RE.test(primary), 'infra/.secrets/lti-operator-key holds one key: ltio_ + 43 base64url characters');
  seenKeys.push(primary);
  tenant = apiKey('cogniate');
  assert.ok(TENANT_KEY_RE.test(tenant), 'the cogniate tenant API key has the form ltis_ + 43 base64url characters');
});

afterAll(async () => {
  // Form (c) restore: revoke the keys that this run made and that are still active (AC-07 normally revoked them).
  const { res, rows } = await listOperatorKeys(primary);
  if (res.status !== 200) return;
  for (const k of issued) if (rows.find((r) => r.id === k.id)?.revokedAt === null) await revokeOperatorKey(primary, k.id);
});

it('AC-LA-E5-01-01 acceptance profile: GET http://lti-service:4110/operator/v1/operator-keys from the e2e container with the key file gives 200', async () => {
  const { res, rows } = await listOperatorKeys(primary);
  assert.equal(res.status, 200, `status ${res.status} ${errorCode(res) ?? ''}`);
  assert.ok(Array.isArray(res.json?.operatorKeys), 'the body has the list operatorKeys');
  assert.ok(rows.some((r) => r.revokedAt === null), 'the list has an active operator key');
  // Negative control: the 200 depends on the key. No header gives 401 INVALID_OPERATOR_AUTHORIZATION_HEADER (delta §1.3).
  const none = await operatorApi('GET', '/operator/v1/operator-keys');
  assert.equal(none.status, 401, 'no Authorization header: status');
  assert.equal(errorCode(none), INVALID_OPERATOR_AUTH, 'no Authorization header: code');
  assert.ok(hasErrorShape(none), 'no Authorization header: error body { status, error, details: { message, description } }');
});

it('AC-LA-E5-01-02 the same path on the public host https://lti.cogniate.test gives 404 (the proxy has no route)', async () => {
  const res = await httpsRequest(`${urls.lti}/operator/v1/operator-keys`, {
    headers: { accept: 'application/json', authorization: operatorAuth(primary) },
  });
  assert.equal(res.status, 404, `status ${res.status}`);
  assert.equal(res.body.includes('operatorKeys'), false, 'the answer has no operator data');
  // Control: the public host answers, so the 404 does not come from a host that is down.
  const health = await httpsRequest(`${urls.lti}/healthz`);
  assert.equal(health.status, 200, 'public /healthz');
});

it('AC-LA-E5-01-03 a tenant API key (ltis_…) in OPERATOR-AUTH-V1 on the operator listener gives 401 INVALID_OPERATOR_AUTHORIZATION_HEADER; an operator key as Bearer on GET /api/platforms gives 401', async () => {
  const tenantOnOperator = await operatorApi('GET', '/operator/v1/operator-keys', { authorization: operatorAuth(tenant) });
  assert.equal(tenantOnOperator.status, 401, 'tenant key on the operator listener: status');
  assert.equal(errorCode(tenantOnOperator), INVALID_OPERATOR_AUTH, 'tenant key on the operator listener: code');
  assert.ok(hasErrorShape(tenantOnOperator), 'tenant key on the operator listener: error body');
  const operatorOnApi = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(primary) });
  assert.equal(operatorOnApi.status, 401, `operator key as Bearer on /api/platforms: status (code ${errorCode(operatorOnApi) ?? 'none'})`);
  assert.ok(hasErrorShape(operatorOnApi), 'operator key as Bearer on /api/platforms: error body');
  // Controls: each credential works where it belongs, so the two 401 answers come from the credential kind.
  const tenantOnApi = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(tenant) });
  assert.equal(tenantOnApi.status, 200, 'control: tenant key as Bearer on /api/platforms');
  assert.equal((await listOperatorKeys(primary)).res.status, 200, 'control: operator key on the operator listener');
  const unknown = await operatorApi('GET', '/operator/v1/operator-keys', { authorization: operatorAuth(unknownOperatorKey()) });
  assert.equal(errorCode(unknown), INVALID_OPERATOR_AUTH, 'control: an unknown operator key gives the same code');
});

it('AC-LA-E5-01-08 POST /operator/v1/operator-keys with expiresAt 59 minutes or 1 year + 1 day ahead gives 400 INVALID_REQUEST (field expiresAt); without expiresAt, expiresAt = now + 90 days (± 1 minute)', async () => {
  for (const [label, at] of [['59 minutes ahead', Date.now() + 59 * MIN], ['1 year and 1 day ahead', oneYearAndOneDayAhead()]] as const) {
    const res = await issueOperatorKey(primary, { operator: name('08-refused'), expiresAt: new Date(at).toISOString() });
    remember(res);
    assert.equal(res.status, 400, `${label}: status`);
    assert.equal(errorCode(res), 'INVALID_REQUEST', `${label}: code`);
    assert.ok(hasErrorShape(res), `${label}: error body`);
    assert.match(description(res), /expiresAt/, `${label}: the description names the field expiresAt`);
  }
  const list = await listOperatorKeys(primary);
  assert.equal(list.rows.some((r) => r.operator === name('08-refused')), false, 'a refused request stores no key');

  const t0 = Date.now();
  const byDefault = await issueOperatorKey(primary, { operator: name('08-default') });
  const t1 = Date.now();
  remember(byDefault);
  assert.equal(byDefault.status, 201, `no expiresAt: status (code ${errorCode(byDefault) ?? 'none'})`);
  const exp = Date.parse(String(byDefault.json?.expiresAt));
  assert.ok(exp >= t0 + 90 * DAY - MIN && exp <= t1 + 90 * DAY + MIN, `no expiresAt: expiresAt ${String(byDefault.json?.expiresAt)} = now + 90 days ± 1 minute`);

  // Controls inside the range, in the same date form: so the two 400 answers come from the range rule.
  for (const at of [Date.now() + 61 * MIN, Date.now() + 364 * DAY]) {
    const iso = new Date(at).toISOString();
    const res = await issueOperatorKey(primary, { operator: name('08-inside'), expiresAt: iso });
    remember(res);
    assert.equal(res.status, 201, `control ${iso}: status (code ${errorCode(res) ?? 'none'})`);
    assert.ok(Math.abs(Date.parse(String(res.json?.expiresAt)) - at) <= 1_000, `control ${iso}: the answer keeps expiresAt`);
  }
});

it('AC-LA-E5-01-09 the issue answer shows operatorKey once; GET /operator/v1/operator-keys lists id, operator, dates and revokedAt, and never the key or its hash', async () => {
  const res = await issueOperatorKey(primary, { operator: name('09') });
  remember(res);
  assert.equal(res.status, 201, `issue: status (code ${errorCode(res) ?? 'none'})`);
  const k = res.json;
  assert.ok(typeof k?.id === 'string' && typeof k.operatorKey === 'string', 'the answer has id and operatorKey');
  assert.ok(OPERATOR_KEY_RE.test(k.operatorKey), 'operatorKey: ltio_ + 43 base64url characters');
  assert.equal(k.operator, name('09'));
  assert.ok(isDate(k.expiresAt), 'the answer has expiresAt');
  // The issued key works, so the checks below look for a real key.
  assert.equal((await listOperatorKeys(k.operatorKey)).res.status, 200, 'the issued key works on the operator listener');

  for (const [who, sender] of [['list read with the old key', primary], ['list read with the new key', k.operatorKey]] as const) {
    const list = await listOperatorKeys(sender);
    assert.equal(list.res.status, 200, `${who}: status`);
    const row = list.rows.find((r) => r.id === k.id);
    assert.ok(row, `${who}: the list has the id of the new key`);
    assert.equal(row.operator, name('09'), `${who}: operator`);
    assert.ok(isDate(row.createdAt) && isDate(row.expiresAt), `${who}: createdAt and expiresAt are dates`);
    assert.ok('lastUsedAt' in row && 'revokedAt' in row, `${who}: lastUsedAt and revokedAt are present`);
    assert.equal(row.revokedAt, null, `${who}: revokedAt of an active key`);
    for (const secret of [k.operatorKey, primary]) {
      assert.equal(list.res.body.includes(secret), false, `${who}: the body never has a key value`);
      for (const h of hashForms(secret)) assert.equal(list.res.body.includes(h), false, `${who}: the body never has a key hash (hex, base64, base64url)`);
    }
    assert.equal(list.rows.some((r) => Object.keys(r).some((f) => /hash|secret/i.test(f))), false, `${who}: no hash or secret field`);
  }
});

it('AC-LA-E5-01-10 revoke of the key that sends the request gives 409 OPERATOR_KEY_IN_USE; revoke of another key gives 200 and that key then gives 401', async () => {
  const res = await issueOperatorKey(primary, { operator: name('10') });
  remember(res);
  assert.equal(res.status, 201, `issue: status (code ${errorCode(res) ?? 'none'})`);
  const b = res.json;

  const self = await revokeOperatorKey(b.operatorKey, b.id);
  assert.equal(self.status, 409, 'revoke of the own key: status');
  assert.equal(errorCode(self), 'OPERATOR_KEY_IN_USE', 'revoke of the own key: code');
  assert.ok(hasErrorShape(self), 'revoke of the own key: error body');
  const still = await listOperatorKeys(b.operatorKey);
  assert.equal(still.res.status, 200, 'after the 409 the key still works');
  assert.equal(still.rows.find((r) => r.id === b.id)?.revokedAt, null, 'after the 409 the key is not revoked');

  const other = await revokeOperatorKey(primary, b.id);
  assert.equal(other.status, 200, `revoke of another key: status (code ${errorCode(other) ?? 'none'})`);
  const after = await listOperatorKeys(b.operatorKey);
  assert.equal(after.res.status, 401, 'the revoked key: status');
  assert.equal(errorCode(after.res), INVALID_OPERATOR_AUTH, 'the revoked key: code');
  const unknown = await operatorApi('GET', '/operator/v1/operator-keys', { authorization: operatorAuth(unknownOperatorKey()) });
  assert.equal(errorCode(after.res), errorCode(unknown), 'a revoked key gives the same 401 code as an unknown key (delta §1.3)');
  const listed = await listOperatorKeys(primary);
  assert.equal(listed.res.status, 200, 'the sender of the revoke still works');
  assert.ok(isDate(listed.rows.find((r) => r.id === b.id)?.revokedAt), 'the list shows revokedAt of the revoked key');
});

it('AC-LA-E5-01-05 docker compose exec lti-service npm run lti:operator -- init --name qa, with an active operator key, exits 1 with one line and changes nothing', async () => {
  const before = await listOperatorKeys(primary);
  assert.equal(before.res.status, 200, 'list before');
  const r = await operatorInit('plain');
  assert.equal(r.cliCode, 1, `exit code (CLI lines ${JSON.stringify(r.cliLines)})`);
  assert.equal(r.cliLines.length, 1, `one line (CLI lines ${JSON.stringify(r.cliLines)})`);
  assert.equal(r.keyCount, 0, 'no key printed');
  const after = await listOperatorKeys(primary);
  assert.equal(after.res.status, 200, 'the key of the key file still works');
  assert.deepEqual(stable(after.rows), stable(before.rows), 'the operator key list did not change');
});

it('AC-LA-E5-01-06 init --if-none on the same stack exits 0 with the line "operator key exists" and issues no key (the second npm run seed is the host row)', async () => {
  const before = await listOperatorKeys(primary);
  assert.equal(before.res.status, 200, 'list before');
  const r = await operatorInit('if-none');
  assert.equal(r.cliCode, 0, `exit code (CLI lines ${JSON.stringify(r.cliLines)})`);
  assert.ok(r.cliLines.some((l) => l.trim() === 'operator key exists'), `the line "operator key exists" (CLI lines ${JSON.stringify(r.cliLines)})`);
  assert.equal(r.keyCount, 0, 'no key printed');
  const after = await listOperatorKeys(primary);
  assert.equal(after.res.status, 200, 'the key of the key file still works');
  assert.deepEqual(stable(after.rows), stable(before.rows), 'no key issued, nothing changed');
});

it('AC-LA-E5-01-07 init --replace --name qa revokes every operator key and prints one new key; the old key then gives 401 on the operator listener and the new key gives 200', async () => {
  const before = await listOperatorKeys(primary);
  assert.equal(before.res.status, 200, 'list before');
  const oldIds = before.rows.map((row) => row.id);
  const r = await operatorInit('replace');
  assert.equal(r.cliCode, 0, `exit code (CLI lines ${JSON.stringify(r.cliLines)})`);
  assert.equal(r.keyCount, 1, 'exactly one new key printed');
  assert.ok(r.keyFileWritten, 'the host wrote the new key to infra/.secrets/lti-operator-key (operability §6.4)');
  const next = readOperatorKey();
  assert.ok(OPERATOR_KEY_RE.test(next), 'the new key: ltio_ + 43 base64url characters');
  assert.ok(next !== primary, 'the new key differs from the old key');
  seenKeys.push(next);

  const old = await listOperatorKeys(primary);
  assert.equal(old.res.status, 401, 'the old key: status');
  assert.equal(errorCode(old.res), INVALID_OPERATOR_AUTH, 'the old key: code');
  const now = await listOperatorKeys(next);
  assert.equal(now.res.status, 200, 'the new key: status');
  for (const id of oldIds) assert.ok(isDate(now.rows.find((row) => row.id === id)?.revokedAt), `key ${id} (active before) is revoked`);
  const active = now.rows.filter((row) => row.revokedAt === null);
  assert.equal(active.length, 1, 'exactly one active operator key');
  assert.equal(active[0].operator, 'qa', 'the new key belongs to operator "qa"');
  assert.equal(oldIds.includes(active[0].id), false, 'the active key is a new row');
  for (const k of issued) assert.equal((await listOperatorKeys(k.key)).res.status, 401, `a key issued earlier in this run (${k.id}) gives 401`);
  primary = next;
});

it('LA-E5-01-HYG no operator key value of this run is in a service log (infra/.logs)', () => {
  assert.deepEqual(logFilesContaining(seenKeys), [], 'log files that contain an operator key value');
});
