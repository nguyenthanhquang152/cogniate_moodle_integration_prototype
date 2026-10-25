// LA-E5-02 acceptance (K1-SIM): LTI service audit log (`audit_event` rows via `GET /operator/v1/audit`).
// Runs in the e2e container on the acceptance profile (QA_TASK=LA-E5-02). One test per K1-SIM AC; each title starts
// with its AC id. AC-LA-E5-02-10 (K0, F5 rule) is in audit.k0.test.ts; AC-07 and AC-08 are Author UNIT tests.
// Source: docs/architecture/ltiaas/tasks/LA-E5-02.md; contract delta §3, §5; LA-ADR-06 D4 (AP-06-14, AP-06-16, AP-06-17).
//
// Secret rule: no API key, operator key, ltik, or service key is ever put into an assertion message.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { afterAll, beforeAll, it } from 'vitest';
import {
  ACCOUNT, SECOND_ACCOUNT, apiKey, auth, capturedSecrets, errorCode, hasErrorShape, ltiApi, recordSecret,
} from '../../../acceptance/lib/lti';
import { QA_DEPLOYMENT, QA_ISSUER, qaLaunchLtik, resourceLinkClaims, setupQaPlatform } from '../../../acceptance/lib/qa-platform';
import {
  OPERATOR_KEY_RE, TENANT_KEY_RE, hashForms, issueOperatorKey, listOperatorKeys, readOperatorKey, revokeOperatorKey,
} from '../LA-E5-01/operator';
import { actorTag, listAllAudit, listAudit, type AuditEvent, type AuditQuery } from './audit-client';

const runId = crypto.randomBytes(4).toString('hex');
const tag = (label: string) => `qa2-e502-${label}-${runId}`;

// In B1 (before LA-E5-07 makes key_... ids), a tenant API key actor is `api_key:bootstrap-<account>`; after LA-E5-07
// it is `api_key:<key id>` (LA-E5-02 AC-01 note, A-LAB-07).
const tenantActorRe = (account: string) => new RegExp(`^api_key:(bootstrap-${account}|key_[A-Za-z0-9_-]+)$`);

let operatorKey = '';
let cogniateKey = '';
let secondKey = '';
const seenOperatorKeys: string[] = [];
const issuedOperatorKeyIds: string[] = [];
const createdPlatforms: { account: string; key: string; id: string }[] = [];
const auditBodies: string[] = [];

const recordBody = (body: string) => {
  if (body) auditBodies.push(body);
};

async function queryAudit(query: AuditQuery = {}, key = operatorKey) {
  return listAudit(key, query, recordBody);
}

function checkAuditShape(e: AuditEvent, label: string) {
  assert.match(String(e.id ?? ''), /^aud_[A-Za-z0-9_-]{16,}$/, `${label}: id starts with aud_`);
  assert.ok(
    (typeof e.ts === 'number' && Number.isFinite(e.ts)) || (typeof e.ts === 'string' && !Number.isNaN(Date.parse(e.ts))),
    `${label}: ts is a valid timestamp`,
  );
  assert.ok(typeof e.actor?.type === 'string' && typeof e.actor?.id === 'string', `${label}: actor { type, id }`);
  assert.ok(typeof e.action === 'string' && e.action.includes('.'), `${label}: dotted action`);
  assert.ok(typeof e.target?.type === 'string', `${label}: target.type`);
  assert.ok(e.result === 'ok' || e.result === 'refused', `${label}: result is ok or refused`);
  if (actorTag(e) === 'system:bootstrap') {
    assert.ok(e.traceId === null || typeof e.traceId === 'string', `${label}: traceId is null or string for system:bootstrap`);
    assert.ok(e.clientIp === null || typeof e.clientIp === 'string', `${label}: clientIp is null or string for system:bootstrap`);
  } else {
    assert.ok(typeof e.traceId === 'string' && e.traceId.length > 0, `${label}: traceId is present`);
    assert.ok(typeof e.clientIp === 'string' && e.clientIp.length > 0, `${label}: clientIp is present`);
  }
}

function platformBody(clientId: string, name: string) {
  return {
    url: QA_ISSUER,
    clientId,
    name,
    authenticationEndpoint: `${QA_ISSUER}/auth`,
    accesstokenEndpoint: `${QA_ISSUER}/token`,
    authConfig: { method: 'JWK_SET', key: `${QA_ISSUER}/jwks.json` },
    deploymentIds: [QA_DEPLOYMENT],
  };
}

let ac01ClientId = '';
let ac01PlatformId = '';
let ac01TraceId = '';

beforeAll(() => {
  operatorKey = readOperatorKey();
  assert.ok(OPERATOR_KEY_RE.test(operatorKey), 'infra/.secrets/lti-operator-key has valid operator key format');
  seenOperatorKeys.push(operatorKey);

  cogniateKey = apiKey(ACCOUNT);
  secondKey = apiKey(SECOND_ACCOUNT);
  assert.ok(TENANT_KEY_RE.test(cogniateKey), 'cogniate API key has valid format');
  assert.ok(TENANT_KEY_RE.test(secondKey), 'qa-second API key has valid format');
});

afterAll(async () => {
  for (const p of createdPlatforms.splice(0)) {
    await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(p.id)}`, { authorization: auth.bearer(p.key) }).catch(() => undefined);
  }
  const { res, rows } = await listOperatorKeys(operatorKey);
  if (res.status === 200) {
    for (const id of issuedOperatorKeyIds) {
      if (rows.find((r) => r.id === id)?.revokedAt === null) {
        await revokeOperatorKey(operatorKey, id).catch(() => undefined);
      }
    }
  }
});

it('AC-LA-E5-02-01 one successful POST /api/platforms makes one platform.create event with actor api_key:<id>, toolAccountId cogniate and result ok in GET /operator/v1/audit?action=platform.create', async () => {
  // Rule 1 negative control: an unauthenticated POST /api/platforms writes no audit event.
  const unauthClientId = tag('unauth-client');
  const unauthRes = await ltiApi('POST', '/api/platforms', { body: platformBody(unauthClientId, 'QA2 unauth platform') });
  assert.equal(unauthRes.status, 401, 'unauthenticated POST /api/platforms gives 401');

  ac01ClientId = tag('ac01-client');
  const createRes = await ltiApi<{ id?: string }>('POST', '/api/platforms', {
    authorization: auth.bearer(cogniateKey),
    body: platformBody(ac01ClientId, 'QA2 AC-01 platform'),
  });
  assert.equal(createRes.status, 201, `POST /api/platforms status ${createRes.status} (${errorCode(createRes) ?? 'ok'})`);
  ac01PlatformId = String(createRes.json?.id ?? '');
  ac01TraceId = createRes.traceId;
  assert.match(ac01PlatformId, /^plt_/, 'created platform id starts with plt_');
  assert.ok(ac01TraceId, 'POST /api/platforms returns X-Trace-Id');
  createdPlatforms.push({ account: ACCOUNT, key: cogniateKey, id: ac01PlatformId });

  const audit = await queryAudit({ action: 'platform.create', limit: 200 });
  assert.equal(audit.res.status, 200, `GET /operator/v1/audit?action=platform.create status ${audit.res.status}`);
  assert.ok(
    audit.events.every((e) => e.action === 'platform.create'),
    'action filter returns only platform.create events',
  );
  assert.equal(
    audit.events.some((e) => e.traceId === unauthRes.traceId),
    false,
    'unauthenticated POST /api/platforms wrote no audit event (LA-ADR-06 D4 rule 1)',
  );

  const matches = audit.events.filter((e) => e.traceId === ac01TraceId || e.target?.id === ac01PlatformId);
  assert.equal(matches.length, 1, `exactly one platform.create event for ${ac01PlatformId} (found ${matches.length})`);
  const ev = matches[0];
  checkAuditShape(ev, 'AC-01 platform.create');
  assert.equal(ev.action, 'platform.create');
  assert.match(actorTag(ev), tenantActorRe(ACCOUNT), `actor ${actorTag(ev)} matches api_key:<id>`);
  assert.equal(ev.toolAccountId, ACCOUNT, 'toolAccountId is cogniate');
  assert.equal(ev.target.type, 'platform', 'target.type is platform');
  assert.equal(ev.target.id, ac01PlatformId, 'target.id is the new platform id');
  assert.equal(ev.result, 'ok', 'result is ok');
  assert.equal(ev.code, null, 'code is null on ok');
  assert.equal(ev.traceId, ac01TraceId, 'traceId matches X-Trace-Id of the POST response');
});

it('AC-LA-E5-02-02 a POST /api/platforms that gives 409 PLATFORM_ALREADY_EXISTS makes one platform.create event with result refused and code PLATFORM_ALREADY_EXISTS', async () => {
  assert.ok(ac01ClientId && ac01PlatformId, 'AC-01 created the initial platform');
  const dupRes = await ltiApi('POST', '/api/platforms', {
    authorization: auth.bearer(cogniateKey),
    body: platformBody(ac01ClientId, 'QA2 duplicate platform'),
  });
  assert.equal(dupRes.status, 409, 'duplicate POST /api/platforms status');
  assert.equal(errorCode(dupRes), 'PLATFORM_ALREADY_EXISTS', 'duplicate POST /api/platforms code');
  assert.ok(hasErrorShape(dupRes), 'duplicate POST /api/platforms error shape');
  assert.ok(dupRes.traceId, '409 response carries X-Trace-Id');

  const audit = await queryAudit({ action: 'platform.create', limit: 200 });
  assert.equal(audit.res.status, 200, 'GET /operator/v1/audit?action=platform.create status');
  const matches = audit.events.filter((e) => e.traceId === dupRes.traceId);
  assert.equal(matches.length, 1, `exactly one refused platform.create event for trace ${dupRes.traceId}`);
  const ev = matches[0];
  checkAuditShape(ev, 'AC-02 refused platform.create');
  assert.equal(ev.action, 'platform.create');
  assert.match(actorTag(ev), tenantActorRe(ACCOUNT), 'actor is the cogniate API key');
  assert.equal(ev.toolAccountId, ACCOUNT, 'toolAccountId is cogniate');
  assert.equal(ev.target.type, 'platform', 'target.type is platform');
  assert.equal(ev.result, 'refused', 'result is refused');
  assert.equal(ev.code, 'PLATFORM_ALREADY_EXISTS', 'code is PLATFORM_ALREADY_EXISTS');
});

it('AC-LA-E5-02-03 PATCH /api/platforms/:id, POST .../deployments, PATCH .../deployments/:deploymentId and DELETE /api/platforms/:id each make one event with the contract delta §5 action', async () => {
  assert.ok(ac01PlatformId, 'AC-01 created the platform under test');
  const depId = tag('dep');

  const patchPlatform = await ltiApi('PATCH', `/api/platforms/${encodeURIComponent(ac01PlatformId)}`, {
    authorization: auth.bearer(cogniateKey),
    body: { name: `QA2 patched ${runId}` },
  });
  assert.equal(patchPlatform.status, 200, `PATCH /api/platforms/:id status ${patchPlatform.status}`);

  const createDep = await ltiApi('POST', `/api/platforms/${encodeURIComponent(ac01PlatformId)}/deployments`, {
    authorization: auth.bearer(cogniateKey),
    body: { deploymentId: depId },
  });
  assert.equal(createDep.status, 201, `POST /api/platforms/:id/deployments status ${createDep.status}`);

  const patchDep = await ltiApi(
    'PATCH',
    `/api/platforms/${encodeURIComponent(ac01PlatformId)}/deployments/${encodeURIComponent(depId)}`,
    {
      authorization: auth.bearer(cogniateKey),
      body: { active: false },
    },
  );
  assert.equal(patchDep.status, 200, `PATCH /api/platforms/:id/deployments/:deploymentId status ${patchDep.status}`);

  const delPlatform = await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(ac01PlatformId)}`, {
    authorization: auth.bearer(cogniateKey),
  });
  assert.equal(delPlatform.status, 204, `DELETE /api/platforms/:id status ${delPlatform.status}`);
  const idx = createdPlatforms.findIndex((p) => p.id === ac01PlatformId);
  if (idx >= 0) createdPlatforms.splice(idx, 1);

  const expected: Array<[string, string, string]> = [
    [patchPlatform.traceId, 'platform.update', 'platform'],
    [createDep.traceId, 'deployment.create', 'deployment'],
    [patchDep.traceId, 'deployment.update', 'deployment'],
    [delPlatform.traceId, 'platform.delete', 'platform'],
  ];

  for (const [traceId, action, targetType] of expected) {
    assert.ok(traceId, `${action}: response has X-Trace-Id`);
    const audit = await queryAudit({ action, limit: 100 });
    assert.equal(audit.res.status, 200, `GET /operator/v1/audit?action=${action} status`);
    const hits = audit.events.filter((e) => e.traceId === traceId);
    assert.equal(hits.length, 1, `${action}: exactly one event with traceId ${traceId}`);
    const ev = hits[0];
    checkAuditShape(ev, action);
    assert.equal(ev.action, action);
    assert.match(actorTag(ev), tenantActorRe(ACCOUNT), `${action}: actor is cogniate API key`);
    assert.equal(ev.toolAccountId, ACCOUNT, `${action}: toolAccountId is cogniate`);
    assert.equal(ev.target.type, targetType, `${action}: target.type is ${targetType}`);
    assert.ok(ev.target.id, `${action}: target.id is present`);
    assert.equal(ev.result, 'ok', `${action}: result is ok`);
    assert.equal(ev.code, null, `${action}: code is null`);
  }
});

it('AC-LA-E5-02-04 POST and .../revoke of /operator/v1/operator-keys each make one event with actor operator:<name>; lti:operator init makes one event with actor system:bootstrap', async () => {
  // Issue an operator key for a known operator name, then use that key to issue and revoke a second key so the
  // actor name on both events is deterministic (`operator:${opName}`).
  const opName = tag('op');
  const actorKeyRes = await issueOperatorKey(operatorKey, { operator: opName });
  assert.equal(actorKeyRes.status, 201, `issue actor operator key status ${actorKeyRes.status}`);
  const actorKeyId = String(actorKeyRes.json?.id ?? '');
  const actorKeySecret = String(actorKeyRes.json?.operatorKey ?? '');
  issuedOperatorKeyIds.push(actorKeyId);
  seenOperatorKeys.push(actorKeySecret);

  const targetOpName = tag('target-op');
  const issueRes = await issueOperatorKey(actorKeySecret, { operator: targetOpName });
  assert.equal(issueRes.status, 201, `POST /operator/v1/operator-keys status ${issueRes.status}`);
  const targetKeyId = String(issueRes.json?.id ?? '');
  const targetKeySecret = String(issueRes.json?.operatorKey ?? '');
  issuedOperatorKeyIds.push(targetKeyId);
  seenOperatorKeys.push(targetKeySecret);

  const revokeRes = await revokeOperatorKey(actorKeySecret, targetKeyId);
  assert.equal(revokeRes.status, 200, `POST /operator/v1/operator-keys/:id/revoke status ${revokeRes.status}`);

  const issuedAudit = await queryAudit({ action: 'operator_key.issue', limit: 200 });
  assert.equal(issuedAudit.res.status, 200, 'GET /operator/v1/audit?action=operator_key.issue status');
  const issueHits = issuedAudit.events.filter((e) => e.traceId === issueRes.traceId || e.target?.id === targetKeyId);
  assert.equal(issueHits.length, 1, `exactly one operator_key.issue event for ${targetKeyId}`);
  const issueEv = issueHits[0];
  checkAuditShape(issueEv, 'operator_key.issue');
  assert.equal(actorTag(issueEv), `operator:${opName}`, 'operator_key.issue actor is operator:<name>');
  assert.equal(issueEv.toolAccountId, null, 'operator_key.issue is operator-global (toolAccountId null)');
  assert.equal(issueEv.target.type, 'operator_key', 'operator_key.issue target.type');
  assert.equal(issueEv.target.id, targetKeyId, 'operator_key.issue target.id');
  assert.equal(issueEv.result, 'ok');

  const revokedAudit = await queryAudit({ action: 'operator_key.revoke', limit: 200 });
  assert.equal(revokedAudit.res.status, 200, 'GET /operator/v1/audit?action=operator_key.revoke status');
  const revokeHits = revokedAudit.events.filter((e) => e.traceId === revokeRes.traceId || e.target?.id === targetKeyId);
  assert.equal(revokeHits.length, 1, `exactly one operator_key.revoke event for ${targetKeyId}`);
  const revokeEv = revokeHits[0];
  checkAuditShape(revokeEv, 'operator_key.revoke');
  assert.equal(actorTag(revokeEv), `operator:${opName}`, 'operator_key.revoke actor is operator:<name>');
  assert.equal(revokeEv.toolAccountId, null, 'operator_key.revoke toolAccountId is null');
  assert.equal(revokeEv.target.type, 'operator_key', 'operator_key.revoke target.type');
  assert.equal(revokeEv.target.id, targetKeyId, 'operator_key.revoke target.id');
  assert.equal(revokeEv.result, 'ok');

  // `lti:operator init --if-none --name local-dev` ran at stack bootstrap to create the first operator key.
  const allIssued = await listAllAudit(operatorKey, { action: 'operator_key.issue', limit: 200 }, { onBody: recordBody });
  const initHits = allIssued.events.filter((e) => actorTag(e) === 'system:bootstrap');
  assert.ok(initHits.length >= 1, 'lti:operator init wrote an operator_key.issue event with actor system:bootstrap');
  const initEv = initHits[0];
  checkAuditShape(initEv, 'lti:operator init operator_key.issue');
  assert.equal(initEv.action, 'operator_key.issue');
  assert.equal(initEv.target.type, 'operator_key');
  assert.equal(initEv.result, 'ok');
});

it('AC-LA-E5-02-05 GET /api/platforms writes no event; GET /operator/v1/audit writes one audit.read event', async () => {
  const getPlatforms = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(cogniateKey) });
  assert.equal(getPlatforms.status, 200, 'GET /api/platforms status');
  assert.ok(getPlatforms.traceId, 'GET /api/platforms has X-Trace-Id');

  const firstAuditRead = await queryAudit({ limit: 50 });
  assert.equal(firstAuditRead.res.status, 200, 'first GET /operator/v1/audit status');
  const readTrace = firstAuditRead.res.traceId;
  assert.ok(readTrace, 'GET /operator/v1/audit has X-Trace-Id');
  assert.equal(
    firstAuditRead.events.some((e) => e.traceId === getPlatforms.traceId),
    false,
    'GET /api/platforms wrote no audit event (LA-ADR-06 D4 rule 1)',
  );

  const readEvents = await queryAudit({ action: 'audit.read', limit: 100 });
  assert.equal(readEvents.res.status, 200, 'GET /operator/v1/audit?action=audit.read status');
  const hits = readEvents.events.filter((e) => e.traceId === readTrace);
  assert.equal(hits.length, 1, `GET /operator/v1/audit wrote one audit.read event for trace ${readTrace}`);
  const ev = hits[0];
  checkAuditShape(ev, 'audit.read');
  assert.equal(ev.action, 'audit.read');
  assert.equal(ev.target.type, 'audit', 'audit.read target.type is audit');
  assert.equal(ev.result, 'ok');
  assert.match(actorTag(ev), /^operator:/, 'audit.read actor is an operator');
});

it('AC-LA-E5-02-06 GET /operator/v1/audit?toolAccountId=qa-second returns only qa-second events', async () => {
  const secondClientId = tag('second-client');
  const createSecond = await ltiApi<{ id?: string }>('POST', '/api/platforms', {
    authorization: auth.bearer(secondKey),
    body: platformBody(secondClientId, 'QA2 qa-second platform'),
  });
  assert.equal(createSecond.status, 201, `qa-second POST /api/platforms status ${createSecond.status}`);
  const secondPlatformId = String(createSecond.json?.id ?? '');
  createdPlatforms.push({ account: SECOND_ACCOUNT, key: secondKey, id: secondPlatformId });

  const delSecond = await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(secondPlatformId)}`, {
    authorization: auth.bearer(secondKey),
  });
  assert.equal(delSecond.status, 204, `qa-second DELETE /api/platforms/:id status ${delSecond.status}`);
  const idx = createdPlatforms.findIndex((p) => p.id === secondPlatformId);
  if (idx >= 0) createdPlatforms.splice(idx, 1);

  const secondAudit = await queryAudit({ toolAccountId: SECOND_ACCOUNT, limit: 200 });
  assert.equal(secondAudit.res.status, 200, 'GET /operator/v1/audit?toolAccountId=qa-second status');
  assert.ok(secondAudit.events.length >= 2, 'at least two qa-second events exist');
  for (const e of secondAudit.events) {
    assert.equal(e.toolAccountId, SECOND_ACCOUNT, `event ${e.id} has toolAccountId === qa-second`);
    assert.ok(
      tenantActorRe(SECOND_ACCOUNT).test(actorTag(e)) || actorTag(e) === 'system:bootstrap' || actorTag(e).startsWith('operator:'),
      `event ${e.id} actor (${actorTag(e)}) belongs to qa-second or bootstrap/operator`,
    );
  }
  assert.ok(
    secondAudit.events.some((e) => e.traceId === createSecond.traceId && e.action === 'platform.create'),
    'qa-second platform.create event is present',
  );
  assert.ok(
    secondAudit.events.some((e) => e.traceId === delSecond.traceId && e.action === 'platform.delete'),
    'qa-second platform.delete event is present',
  );
  assert.equal(
    secondAudit.events.some((e) => e.traceId === ac01TraceId),
    false,
    'cogniate events are excluded from toolAccountId=qa-second',
  );

  // Control: toolAccountId=cogniate returns only cogniate events and includes ac01TraceId.
  const cogniateAudit = await queryAudit({ toolAccountId: ACCOUNT, limit: 200 });
  assert.equal(cogniateAudit.res.status, 200, 'control GET /operator/v1/audit?toolAccountId=cogniate status');
  assert.ok(cogniateAudit.events.every((e) => e.toolAccountId === ACCOUNT), 'control: only cogniate events');
  assert.ok(cogniateAudit.events.some((e) => e.traceId === ac01TraceId), 'control: includes cogniate event');
});

it('AC-LA-E5-02-09 QA secret scan of every GET /operator/v1/audit answer of the run finds no API key, operator key, private JWK, ltik or service key', async () => {
  // Produce a real launch ltik and serviceKey during this run so capturedSecrets() holds every secret class of AP-06-16.
  const p = await setupQaPlatform(cogniateKey, tag('scan'));
  createdPlatforms.push({ account: ACCOUNT, key: cogniateKey, id: p.platformId });
  const ltik = await qaLaunchLtik(p, (login) => ({
    ...resourceLinkClaims(p, login),
    'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': {
      scope: [
        'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
        'https://purl.imsglobal.org/spec/lti-ags/scope/score',
      ],
      lineitems: `${QA_ISSUER}/lineitems`,
      lineitem: `${QA_ISSUER}/lineitems/1`,
    },
  }));
  const tok = await ltiApi<{ services?: { serviceKey?: string } }>('GET', '/api/idtoken', {
    authorization: auth.ltik(cogniateKey, ltik),
  });
  assert.equal(tok.status, 200, 'GET /api/idtoken for secret-scan control launch');
  const serviceKey = String(tok.json?.services?.serviceKey ?? '');
  assert.ok(serviceKey.length >= 16, 'control launch produced a serviceKey');
  recordSecret('service_key', serviceKey);

  // Read every page of the audit log so all stored events of the run are in auditBodies.
  const sweep = await listAllAudit(operatorKey, { limit: 500 }, { onBody: recordBody });
  assert.ok(sweep.events.length >= 8, `full audit sweep returned ${sweep.events.length} events across ${sweep.pages} page(s)`);
  assert.ok(auditBodies.length >= 6, `captured ${auditBodies.length} GET /operator/v1/audit response bodies`);

  const exactSecrets = new Set<string>([
    cogniateKey,
    secondKey,
    ...seenOperatorKeys,
    ltik,
    serviceKey,
    ...capturedSecrets().map((s) => s.value).filter((v) => v.length >= 12),
  ]);
  const hashes = [...exactSecrets].flatMap((s) => hashForms(s));

  for (let i = 0; i < auditBodies.length; i += 1) {
    const body = auditBodies[i];
    assert.equal(/\bltis_[A-Za-z0-9_-]{20,}/.test(body), false, `audit answer #${i + 1} has no ltis_ API key`);
    assert.equal(/\bltio_[A-Za-z0-9_-]{20,}/.test(body), false, `audit answer #${i + 1} has no ltio_ operator key`);
    assert.equal(
      /"(d|p|q|dp|dq|qi|privateJwk|private_jwk)"\s*:/.test(body),
      false,
      `audit answer #${i + 1} has no private JWK component`,
    );
    for (const secret of exactSecrets) {
      assert.equal(body.includes(secret), false, `audit answer #${i + 1} contains no captured secret value`);
    }
    for (const h of hashes) {
      assert.equal(body.includes(h), false, `audit answer #${i + 1} contains no secret SHA-256 hash`);
    }
  }
});
