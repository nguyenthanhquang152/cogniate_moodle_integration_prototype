// LA-E5-21 acceptance (K1-SIM): production profile and secrets from files.
// Runs in the e2e container on the acceptance profile (QA_TASK=LA-E5-21). One test per K1-SIM AC; each title starts
// with its AC id. AC-02..AC-06 are Author UNIT tests.
// Source: docs/architecture/ltiaas/tasks/LA-E5-21.md; LA-ADR-06 D12; security delta §15; operability §2.
//
// Secret rule: no API key, operator key, ltik, service key, or master key is ever put into an assertion message.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';
import { publicUrls } from '../../../acceptance/lib/env';
import { httpsRequest } from '../../../acceptance/lib/https';
import { artifactsDir } from '../../../acceptance/lib/paths';
import {
  checkAcceptanceOutboundAllowlist, loadSimAllowlist,
} from '../../golden/lib/compare.mjs';

const urls = publicUrls();
const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '../../../..');
const G1_GOLDEN_FILE = path.join(
  REPO_ROOT,
  'tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/G1.json',
);
const SETUP_STATE_FILE = path.join(REPO_ROOT, 'tests', '.tmp', 'qa2-LA-E5-21.json');

interface ProductionKnobRunResult {
  code: number;
  configRefusedCount: number;
  configRefusedEvents: {
    event?: string;
    reason?: string;
    service?: string;
    level?: string;
    [field: string]: unknown;
  }[];
}

interface SetupCaptureState {
  defaultHealth?: Record<string, unknown> | null;
  productionKnobRun?: ProductionKnobRunResult | null;
}

function readSetupCapture(): SetupCaptureState | null {
  if (!fs.existsSync(SETUP_STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(SETUP_STATE_FILE, 'utf8')) as SetupCaptureState;
  } catch {
    return null;
  }
}

async function hostProductionKnobRun(timeoutMs = 120_000): Promise<ProductionKnobRunResult> {
  const controlDir = path.join(artifactsDir('acceptance'), 'control');
  fs.mkdirSync(controlDir, { recursive: true });
  const id = `e521-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const reqFile = path.join(controlDir, `req-${id}.json`);
  const ackFile = path.join(controlDir, `ack-${id}.json`);
  fs.writeFileSync(`${reqFile}.tmp`, JSON.stringify({ id, action: 'qa2-e521-production-knob' }), { mode: 0o600 });
  fs.renameSync(`${reqFile}.tmp`, reqFile);

  const deadline = Date.now() + timeoutMs;
  while (!fs.existsSync(ackFile)) {
    if (Date.now() >= deadline) {
      throw new Error(
        `Host control action qa2-e521-production-knob timed out after ${timeoutMs} ms (run via tests/ltiaas/tasks-ops/LA-E5-21/run.mjs)`,
      );
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  const ack = JSON.parse(fs.readFileSync(ackFile, 'utf8')) as ProductionKnobRunResult;
  return ack;
}

it('AC-LA-E5-21-01 One LTI service process started with STACK_PROFILE=production and an active test knob exits 1 with one line config_refused {reason: "test_knob_active"}', async () => {
  const captured = readSetupCapture();
  const result = captured?.productionKnobRun ?? (await hostProductionKnobRun());

  assert.equal(
    result.code,
    1,
    'docker compose run --rm -e STACK_PROFILE=production -e <knob>=<value> lti-service npm start exits with code 1',
  );
  assert.equal(
    result.configRefusedCount,
    1,
    'exactly one config_refused JSON log line emitted on start refusal',
  );
  assert.equal(result.configRefusedEvents.length, 1, 'configRefusedEvents has length 1');
  const event = result.configRefusedEvents[0];
  assert.equal(event.event, 'config_refused');
  assert.equal(event.reason, 'test_knob_active', 'config_refused reason is "test_knob_active"');
});

it('AC-LA-E5-21-07 The default and acceptance profiles start with today environment values (the stack starts; G1 /healthz unchanged)', async () => {
  assert.equal(fs.existsSync(G1_GOLDEN_FILE), true, `G1 golden file exists at ${G1_GOLDEN_FILE}`);
  const g1 = JSON.parse(fs.readFileSync(G1_GOLDEN_FILE, 'utf8')) as {
    default: {
      ltiHealth: {
        knobs: unknown[];
        outbound_allowlist: string[];
        profile: string;
        service: string;
        simulation_profiles: string[];
        status: string;
      };
    };
    acceptance: {
      ltiHealth: {
        knobs: unknown[];
        outbound_allowlist: string[];
        profile: string;
        service: string;
        simulation_profiles: string[];
        status: string;
      };
    };
  };

  // 1. Verify default profile /healthz (captured by run.mjs when stack:up started in default profile).
  const captured = readSetupCapture();
  assert.ok(
    captured?.defaultHealth && typeof captured.defaultHealth === 'object',
    'default profile /healthz was captured by LA-E5-21/run.mjs during stack:up',
  );
  const actualDefault = captured!.defaultHealth!;
  const expectedDefault = g1.default.ltiHealth;
  assert.deepEqual(
    Object.keys(actualDefault).sort(),
    Object.keys(expectedDefault).sort(),
    'default profile /healthz field set equals G1.default.ltiHealth',
  );
  assert.deepEqual(actualDefault, expectedDefault, 'default profile /healthz is strictly equal to G1.default.ltiHealth');

  // 2. Verify acceptance profile /healthz (running now in test:acceptance).
  const res = await httpsRequest(`${urls.lti}/healthz`);
  assert.equal(res.status, 200, 'acceptance profile GET /healthz returns 200');
  const actualAcceptance = JSON.parse(res.body) as Record<string, unknown>;
  const expectedAcceptance = g1.acceptance.ltiHealth;

  assert.deepEqual(
    Object.keys(actualAcceptance).sort(),
    Object.keys(expectedAcceptance).sort(),
    'acceptance profile /healthz field set equals G1.acceptance.ltiHealth',
  );
  assert.equal(actualAcceptance.status, expectedAcceptance.status, 'acceptance healthz.status equals G1');
  assert.equal(actualAcceptance.service, expectedAcceptance.service, 'acceptance healthz.service equals G1');
  assert.equal(actualAcceptance.profile, expectedAcceptance.profile, 'acceptance healthz.profile equals G1');
  assert.deepEqual(actualAcceptance.knobs, expectedAcceptance.knobs, 'acceptance healthz.knobs equals G1');

  const simHosts = loadSimAllowlist();
  const allowlistCheck = checkAcceptanceOutboundAllowlist(
    expectedAcceptance.outbound_allowlist,
    actualAcceptance.outbound_allowlist as string[],
    simHosts,
  );
  assert.equal(
    allowlistCheck.ok,
    true,
    `acceptance healthz.outbound_allowlist matches G1 (under LA-IC-16): ${allowlistCheck.reason ?? 'ok'}`,
  );
  assert.ok(Array.isArray(actualAcceptance.simulation_profiles), 'acceptance simulation_profiles is an array');
  assert.deepEqual(
    (actualAcceptance.simulation_profiles as string[]).slice(0, expectedAcceptance.simulation_profiles.length),
    expectedAcceptance.simulation_profiles,
    'acceptance simulation_profiles preserves G1 baseline entries in order',
  );
});
