// LA-E5-05 acceptance (K1-SIM): LTI CLIs (`lti:bootstrap`, `lti:shared-platform`) as operator API clients.
// Runs in the e2e container on the acceptance profile (QA_TASK=LA-E5-05). One test per K1-SIM AC; each title starts
// with its AC id.
// Source: docs/architecture/ltiaas/tasks/LA-E5-05.md; contract delta §3 "CLI mapping", §5; LA-ADR-06 D3, D7; BD-A2-02, BD-A2-14.
//
// Secret rule: no API key or operator key is ever put into an assertion message or control file.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, it } from 'vitest';
import { publicUrls } from '../../../acceptance/lib/env';
import { CONTROL_DIR, hostAction, type HostAction } from '../../../acceptance/lib/host-control';
import { httpsRequest } from '../../../acceptance/lib/https';
import { ACCOUNT, apiKey, auth, ltiApi, recordSecret } from '../../../acceptance/lib/lti';
import { TESTS_DIR } from '../../../acceptance/lib/paths';
import {
  OPERATOR_KEY_RE,
  TENANT_KEY_RE,
  listOperatorKeys,
  operatorApi,
  operatorAuth,
  readOperatorKey,
} from '../LA-E5-01/operator';
import { actorTag, listAllAudit } from '../LA-E5-02/audit-client';

const urls = publicUrls();
const runId = crypto.randomBytes(3).toString('hex');
const freshAccount = `qa2-e505-${runId}`;
const freshName = `QA2 E505 ${runId}`;
const sharedAccount = `qa2-e505-sh-${runId}`;
const sharedName = `QA2 E505 Shared ${runId}`;
const SETUP_STATE_FILE = path.join(TESTS_DIR, '.tmp', 'qa2-LA-E5-05.json');

interface BootstrapCliSummary {
  account: string;
  cliCode: number;
  jsonLineShapeOk: boolean;
  created: boolean | null;
  kid: string | null;
  hasApiKey: boolean;
  keyFileWritten: boolean;
  opCopyDeletedOnMissing?: boolean;
  stderrLines: string[];
}

interface SharedPlatformCliSummary {
  cliCode: number;
  stdout: string;
  stderr: string;
  platformId: string | null;
}

interface SetupState {
  freshCogniateBootstrap: BootstrapCliSummary;
  seed1Code: number;
  seed2Code: number;
  opKeySameAfterSeed2: boolean;
  cogniateKeySameAfterSeed2: boolean;
  secondKeySameAfterSeed2: boolean;
}

let operatorKey = '';
let operatorName = '';
let initialFreshKey = '';
let initialFreshKid = '';

async function runBootstrapCli(
  account: string,
  name: string,
  opts: {
    rotateApiKey?: boolean;
    rotateSigningKey?: boolean;
    renameOperatorKey?: boolean;
  } = {},
): Promise<BootstrapCliSummary> {
  const answer = await hostAction('qa2-e505-bootstrap' as HostAction, 180_000, {
    payload: { account, name, ...opts },
    allowFail: true,
  });
  assert.ok(answer.out, `host action qa2-e505-bootstrap returned output file (code ${answer.code})`);
  return JSON.parse(fs.readFileSync(path.join(CONTROL_DIR(), answer.out), 'utf8')) as BootstrapCliSummary;
}

async function runSharedPlatformCli(
  account: string,
  profile: string,
  clientId: string,
  name?: string,
): Promise<SharedPlatformCliSummary> {
  const answer = await hostAction('qa2-e505-shared-platform' as HostAction, 120_000, {
    payload: { account, profile, clientId, ...(name ? { name } : {}) },
    allowFail: true,
  });
  assert.ok(answer.out, `host action qa2-e505-shared-platform returned output file (code ${answer.code})`);
  return JSON.parse(fs.readFileSync(path.join(CONTROL_DIR(), answer.out), 'utf8')) as SharedPlatformCliSummary;
}

function readSetupState(): SetupState {
  assert.equal(
    fs.existsSync(SETUP_STATE_FILE),
    true,
    `Setup state file ${SETUP_STATE_FILE} exists (run with tests/ltiaas/tasks-ops/LA-E5-05/run.mjs)`,
  );
  return JSON.parse(fs.readFileSync(SETUP_STATE_FILE, 'utf8')) as SetupState;
}

beforeAll(async () => {
  operatorKey = readOperatorKey();
  assert.ok(OPERATOR_KEY_RE.test(operatorKey), 'operator key format');
  const opKeys = await listOperatorKeys(operatorKey);
  assert.equal(opKeys.res.status, 200, 'GET /operator/v1/operator-keys status 200');
  const activeOp = opKeys.rows.find((r) => r.revokedAt === null);
  assert.ok(activeOp, 'active operator key row exists');
  operatorName = activeOp.operator;
});

it(
  'AC-LA-E5-05-01 on a fresh stack, npm run lti:bootstrap -- --account cogniate --name Cogniate prints one JSON line with the keys account, created, kid, apiKey (same shape as today)',
  async () => {
    const setup = readSetupState();
    const cog = setup.freshCogniateBootstrap;
    assert.equal(cog.cliCode, 0, 'fresh-stack lti:bootstrap for cogniate exits 0');
    assert.equal(cog.jsonLineShapeOk, true, 'stdout JSON line has keys account, created, kid, apiKey');
    assert.equal(cog.account, ACCOUNT, 'JSON line account is cogniate');
    assert.equal(cog.created, true, 'JSON line created is true on fresh stack');
    assert.equal(typeof cog.kid === 'string' && cog.kid.length > 0, true, 'JSON line kid is non-empty string');
    assert.equal(cog.hasApiKey, true, 'JSON line apiKey is a valid ltis_ key');
    assert.equal(cog.keyFileWritten, true, 'infra/.secrets/lti-api-key.cogniate written');

    // Also run QA form (d) on a fresh account during the pass to verify the live CLI output shape directly.
    const fresh = await runBootstrapCli(freshAccount, freshName);
    assert.equal(fresh.cliCode, 0, `lti:bootstrap for ${freshAccount} exits 0`);
    assert.equal(fresh.jsonLineShapeOk, true, 'fresh account JSON line has keys account, created, kid, apiKey');
    assert.equal(fresh.account, freshAccount, 'fresh account JSON line account matches');
    assert.equal(fresh.created, true, 'fresh account JSON line created is true');
    assert.equal(typeof fresh.kid === 'string' && fresh.kid.length > 0, true, 'fresh account JSON line kid is non-empty');
    assert.equal(fresh.hasApiKey, true, 'fresh account JSON line includes ltis_ apiKey');
    assert.equal(fresh.keyFileWritten, true, `infra/.secrets/lti-api-key.${freshAccount} written`);

    initialFreshKid = String(fresh.kid);
    initialFreshKey = apiKey(freshAccount);
    assert.ok(TENANT_KEY_RE.test(initialFreshKey), 'fresh account key file has ltis_ key');
    recordSecret('api_key', initialFreshKey);

    const checkRes = await ltiApi('GET', '/api/platforms', {
      authorization: auth.bearer(initialFreshKey),
    });
    assert.equal(checkRes.status, 200, 'issued API key for fresh account passes GET /api/platforms');
  },
);

it(
  'AC-LA-E5-05-02 the same run writes one audit event per change (account create, API key issue) with actor operator:<name of the key file>',
  async () => {
    const expectedActor = `operator:${operatorName}`;

    for (const acct of [ACCOUNT, freshAccount]) {
      const { events } = await listAllAudit(operatorKey, { toolAccountId: acct });
      const creates = events.filter((e) => e.action === 'account.create' && e.result === 'ok');
      const issues = events.filter((e) => e.action === 'api_key.issue' && e.result === 'ok');

      assert.equal(creates.length, 1, `exactly one account.create ok audit event for ${acct}`);
      assert.equal(actorTag(creates[0]), expectedActor, `account.create actor for ${acct} is ${expectedActor}`);
      assert.equal(creates[0].target.type, 'account', 'account.create target.type is account');
      assert.equal(creates[0].target.id, acct, `account.create target.id is ${acct}`);

      assert.ok(issues.length >= 1, `at least one api_key.issue ok audit event for ${acct}`);
      const firstIssue = issues[issues.length - 1];
      assert.equal(actorTag(firstIssue), expectedActor, `api_key.issue actor for ${acct} is ${expectedActor}`);
      assert.equal(firstIssue.target.type, 'api_key', 'api_key.issue target.type is api_key');
    }
  },
);

it(
  'AC-LA-E5-05-03 (form (d)) a second run without flags prints created: false and no apiKey, and writes no api_key.issue event',
  async () => {
    const beforeAudit = await listAllAudit(operatorKey, { toolAccountId: freshAccount, action: 'api_key.issue' });
    const issueCountBefore = beforeAudit.events.length;

    const second = await runBootstrapCli(freshAccount, freshName);
    assert.equal(second.cliCode, 0, 'second lti:bootstrap without flags exits 0');
    assert.equal(second.jsonLineShapeOk, true, 'second run prints valid JSON line shape');
    assert.equal(second.account, freshAccount, 'second run account matches');
    assert.equal(second.created, false, 'second run prints created: false');
    assert.equal(second.hasApiKey, false, 'second run prints no apiKey');
    assert.equal(second.kid, initialFreshKid, 'second run keeps existing active signing key kid');

    const afterAudit = await listAllAudit(operatorKey, { toolAccountId: freshAccount, action: 'api_key.issue' });
    assert.equal(afterAudit.events.length, issueCountBefore, 'second run without flags wrote no api_key.issue audit event');
  },
);

it(
  'AC-LA-E5-05-04 (form (d), fresh account) --rotate-api-key prints a new apiKey; the old key then gives 401, and the new key passes',
  async () => {
    // Issue a second active key first so we also verify that --rotate-api-key revokes every existing active key (BD-A2-10 / LA-E5-05 scope).
    const extraKeyRes = await operatorApi<{ id: string; apiKey: string }>(
      'POST',
      `/operator/v1/accounts/${encodeURIComponent(freshAccount)}/api-keys`,
      {
        authorization: operatorAuth(operatorKey),
        body: { label: 'second-active-before-rotate', scopes: ['launch', 'admin'] },
      },
    );
    assert.equal(extraKeyRes.status, 201, 'issued second active key before --rotate-api-key');
    const extraKeyId = String(extraKeyRes.json?.id ?? '');
    const secondOldKey = String(extraKeyRes.json?.apiKey ?? '');
    recordSecret('api_key', secondOldKey);

    const beforeIssues = await listAllAudit(operatorKey, { toolAccountId: freshAccount, action: 'api_key.issue' });

    const rotated = await runBootstrapCli(freshAccount, freshName, { rotateApiKey: true });
    assert.equal(rotated.cliCode, 0, 'lti:bootstrap --rotate-api-key exits 0');
    assert.equal(rotated.jsonLineShapeOk, true, '--rotate-api-key prints valid JSON line');
    assert.equal(rotated.created, false, '--rotate-api-key prints created: false on existing account');
    assert.equal(rotated.hasApiKey, true, '--rotate-api-key prints a new apiKey');
    assert.equal(rotated.keyFileWritten, true, '--rotate-api-key updates the key file');

    const newKey = apiKey(freshAccount);
    assert.ok(TENANT_KEY_RE.test(newKey), 'new key in file matches ltis_ format');
    assert.notEqual(newKey, initialFreshKey, 'new key differs from initial key');
    assert.notEqual(newKey, secondOldKey, 'new key differs from second old key');
    recordSecret('api_key', newKey);

    const oldCheck1 = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(initialFreshKey) });
    assert.equal(oldCheck1.status, 401, 'initial old API key gives 401 after --rotate-api-key');

    const oldCheck2 = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(secondOldKey) });
    assert.equal(oldCheck2.status, 401, 'second old API key also gives 401 after --rotate-api-key');

    const newCheck = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(newKey) });
    assert.equal(newCheck.status, 200, 'new API key passes GET /api/platforms (200)');

    // BD-A2-33: --rotate-api-key calls POST .../api-keys with revokeOthers: true, writing one api_key.issue event with details.revokedKeyIds.
    const afterIssues = await listAllAudit(operatorKey, { toolAccountId: freshAccount, action: 'api_key.issue' });
    assert.equal(
      afterIssues.events.length,
      beforeIssues.events.length + 1,
      '--rotate-api-key wrote one new api_key.issue audit event (BD-A2-33)',
    );
    const rotateIssueEvent = afterIssues.events[0];
    assert.equal(rotateIssueEvent.result, 'ok');
    assert.equal(actorTag(rotateIssueEvent), `operator:${operatorName}`);
    const revokedKeyIds = rotateIssueEvent.details?.revokedKeyIds;
    assert.ok(Array.isArray(revokedKeyIds), 'api_key.issue event has details.revokedKeyIds array (BD-A2-33)');
    assert.equal((revokedKeyIds as unknown[]).length, 2, 'details.revokedKeyIds lists both previously active keys');
    assert.ok((revokedKeyIds as string[]).includes(extraKeyId), 'details.revokedKeyIds includes the second active key id');

    initialFreshKey = newKey;
  },
);

it(
  'AC-LA-E5-05-05 (form (d), fresh account) --rotate-signing-key prints a new kid; GET /lti/keys/<account> lists it first, and one signing_key.activate event has details.forced: true',
  async () => {
    // Per BD-A2-14: when a waiting `next` key exists, `lti:bootstrap --rotate-signing-key` first retires it with
    // {immediate: true}, then creates a new `next` key and activates it with {force: true}.
    const waitingRes = await operatorApi<{ kid: string; status: string }>(
      'POST',
      `/operator/v1/accounts/${encodeURIComponent(freshAccount)}/signing-keys`,
      { authorization: operatorAuth(operatorKey) },
    );
    assert.equal(waitingRes.status, 201, 'POST /operator/v1/accounts/:id/signing-keys creates a waiting next key');
    const waitingKid = String(waitingRes.json?.kid ?? '');
    assert.ok(waitingKid.length > 0, 'waiting next key has a kid');

    const rotated = await runBootstrapCli(freshAccount, freshName, { rotateSigningKey: true });
    assert.equal(rotated.cliCode, 0, 'lti:bootstrap --rotate-signing-key exits 0');
    assert.equal(rotated.jsonLineShapeOk, true, '--rotate-signing-key prints valid JSON line');
    const newKid = String(rotated.kid ?? '');
    assert.ok(newKid.length > 0, '--rotate-signing-key prints non-empty kid');
    assert.notEqual(newKid, initialFreshKid, 'new kid differs from initial kid');
    assert.notEqual(newKid, waitingKid, 'new kid differs from the untrusted waiting next key (BD-A2-14)');

    const jwksRes = await httpsRequest(`${urls.lti}/lti/keys/${encodeURIComponent(freshAccount)}`);
    assert.equal(jwksRes.status, 200, 'GET /lti/keys/<account> returns 200');
    const jwks = JSON.parse(jwksRes.body) as { keys?: { kid?: string }[] };
    assert.ok(Array.isArray(jwks.keys) && jwks.keys.length >= 2, 'JWKS has active and retired keys');
    assert.equal(jwks.keys[0].kid, newKid, 'GET /lti/keys/<account> lists the new active kid first');
    assert.equal(
      jwks.keys.some((k) => k.kid === waitingKid),
      false,
      'waiting next key was retired immediately and is not in JWKS (BD-A2-14)',
    );

    const { events } = await listAllAudit(operatorKey, {
      toolAccountId: freshAccount,
      action: 'signing_key.activate',
    });
    const matchingActivate = events.filter((e) => e.result === 'ok' && e.target.id === newKid);
    assert.equal(matchingActivate.length, 1, 'one signing_key.activate audit event for the new kid');
    assert.equal(
      matchingActivate[0].details?.forced,
      true,
      'signing_key.activate audit event has details.forced: true',
    );
    assert.equal(actorTag(matchingActivate[0]), `operator:${operatorName}`, 'signing_key.activate actor is operator:<name>');
  },
);

it(
  'AC-LA-E5-05-06 lti:shared-platform for an existing shared platform with the same client id prints the same output as today and creates no second platform',
  async () => {
    const bootShared = await runBootstrapCli(sharedAccount, sharedName);
    assert.equal(bootShared.cliCode, 0, `bootstrap ${sharedAccount} exits 0`);
    const sharedKey = apiKey(sharedAccount);
    recordSecret('api_key', sharedKey);

    const first = await runSharedPlatformCli(sharedAccount, 'blackboard-sim', 'qa-bb-app', 'QA2 Blackboard');
    assert.equal(first.cliCode, 0, 'first lti:shared-platform exits 0');
    assert.ok(first.platformId && first.platformId.startsWith('plt_'), `first run prints platform id (got ${first.stdout.trim()})`);

    const second = await runSharedPlatformCli(sharedAccount, 'blackboard-sim', 'qa-bb-app', 'QA2 Blackboard');
    assert.equal(second.cliCode, 0, 'second lti:shared-platform with same client id exits 0');
    assert.equal(second.stdout.trim(), first.stdout.trim(), 'second run prints the exact same output as the first run');
    assert.equal(second.platformId, first.platformId, 'second run prints the same platform id');

    const otherClient = await runSharedPlatformCli(sharedAccount, 'blackboard-sim', 'other-bb-app', 'Other Blackboard');
    assert.equal(otherClient.cliCode, 1, 'lti:shared-platform with a different client id exits 1');

    const platformsRes = await ltiApi<{ platforms?: { id: string; clientId: string }[] }>('GET', '/api/platforms', {
      authorization: auth.bearer(sharedKey),
    });
    assert.equal(platformsRes.status, 200, 'GET /api/platforms on sharedAccount returns 200');
    const platforms = platformsRes.json?.platforms ?? [];
    assert.equal(platforms.length, 1, 'no second platform was created');
    assert.equal(platforms[0].id, first.platformId, 'stored platform id matches CLI output');
    assert.equal(platforms[0].clientId, 'qa-bb-app', 'stored clientId is unchanged');
  },
);

it(
  'AC-LA-E5-05-07 (form (e)) with the operator key file renamed, lti:bootstrap exits 1 with one line that names the key file, and lti.db does not change (no new audit event)',
  async () => {
    const beforeAudit = await listAllAudit(operatorKey);
    // Filter out audit.read events so we count only state/admin events.
    const nonReadBefore = beforeAudit.events.filter((e) => e.action !== 'audit.read');

    const unmatchedAccount = `qa2-e505-no-opkey-${runId}`;
    const failed = await runBootstrapCli(unmatchedAccount, 'Should Fail', { renameOperatorKey: true });
    assert.equal(failed.cliCode, 1, 'lti:bootstrap with operator key file renamed exits 1');
    assert.equal(failed.opCopyDeletedOnMissing, true, 'wrapper deleted infra/.secrets/lti/lti-operator-key copy when original was missing (BD-A2-34)');
    assert.equal(failed.stderrLines.length, 1, `expected 1 error line naming the key file, got: ${JSON.stringify(failed.stderrLines)}`);
    assert.match(
      failed.stderrLines[0],
      /lti-operator-key/,
      'the single error line names the operator key file (lti-operator-key)',
    );

    // Verify operator key file was restored by the host action and operator API still works.
    const afterAudit = await listAllAudit(operatorKey);
    const nonReadAfter = afterAudit.events.filter((e) => e.action !== 'audit.read');
    assert.equal(nonReadAfter.length, nonReadBefore.length, 'no new audit event was written while operator key file was missing');

    const accRes = await operatorApi('GET', `/operator/v1/accounts/${encodeURIComponent(unmatchedAccount)}`, {
      authorization: operatorAuth(operatorKey),
    });
    assert.equal(accRes.status, 404, 'unmatchedAccount was not created in lti.db (no direct DB fallback)');
  },
);

it(
  'AC-LA-E5-05-08 npm run seed twice on the same volume: both runs pass; the second run issues no operator key and no API key',
  async () => {
    const setup = readSetupState();
    assert.equal(setup.seed1Code, 0, 'first npm run seed exited 0');
    assert.equal(setup.seed2Code, 0, 'second npm run seed exited 0');
    assert.equal(setup.opKeySameAfterSeed2, true, 'infra/.secrets/lti-operator-key unchanged after second seed');
    assert.equal(setup.cogniateKeySameAfterSeed2, true, 'infra/.secrets/lti-api-key.cogniate unchanged after second seed');
    assert.equal(setup.secondKeySameAfterSeed2, true, 'infra/.secrets/lti-api-key.qa-second unchanged after second seed');

    const opKeys = await listOperatorKeys(operatorKey);
    assert.equal(opKeys.res.status, 200, 'GET /operator/v1/operator-keys returns 200');
    assert.equal(opKeys.rows.length, 1, 'second seed issued no second operator key');

    for (const seededAcct of ['cogniate', 'qa-second']) {
      const keysRes = await operatorApi<{ apiKeys?: { id: string; revokedAt: string | null }[] }>(
        'GET',
        `/operator/v1/accounts/${encodeURIComponent(seededAcct)}/api-keys`,
        { authorization: operatorAuth(operatorKey) },
      );
      assert.equal(keysRes.status, 200, `GET /operator/v1/accounts/${seededAcct}/api-keys returns 200`);
      const activeKeys = (keysRes.json?.apiKeys ?? []).filter((k) => k.revokedAt === null);
      assert.equal(activeKeys.length, 1, `${seededAcct} has exactly 1 active API key after two seeds`);
    }
  },
);
