import { beforeAll, describe, it } from 'vitest';
import { loadActiveChannelFixtures } from '../lib/fixtures';
import {
  recordNaCasesForSuite,
  recordSuiteCase,
  runAddDeploymentCase,
  runConnectOperatorGrantCase,
  runConnectSelfCase,
  runConnectionCheckCase,
  runDynamicRegistrationDisabledGuardCase,
  runDynamicRegistrationHappyAndNegativeCase,
  runStagedDynamicRegistrationCase,
} from '../lib/runtime';

const channels = loadActiveChannelFixtures();

describe('K1-REG registration and binding authority simulator suite per channel', () => {
  for (const fixture of channels) {
    describe(`channel ${fixture.id} (${fixture.simProvider})`, () => {
      const authorities = Object.values(fixture.capabilities['binding.authority']);

      beforeAll(() => {
        recordNaCasesForSuite(fixture, 'K1-REG');
      });

      if (authorities.includes('self')) {
        it(`[${fixture.id}] R1: self authority connect activates immediately`, async () => {
          await runConnectSelfCase(fixture);
          recordSuiteCase(fixture, 'K1-REG', 'R1', 'PASS');
        });
      }

      if (authorities.includes('operatorGrant')) {
        it(`[${fixture.id}] R2: operatorGrant authority connect remains pending until grant redemption and refuses mismatched bound values with 422 GRANT_MISMATCH`, async () => {
          await runConnectOperatorGrantCase(fixture);
          recordSuiteCase(fixture, 'K1-REG', 'R2', 'PASS');
        });
      }

      if (
        fixture.capabilities['registration.dynamic'] &&
        fixture.sim.supportsStagedRegistrationOnSim
      ) {
        it(`[${fixture.id}] R3: staged Dynamic Registration creates inactive platform with bindingRef, refuses launch with PLATFORM_NOT_ACTIVE before grant, and activates on redemption`, async () => {
          await runStagedDynamicRegistrationCase(fixture);
          recordSuiteCase(fixture, 'K1-REG', 'R3', 'PASS');
        });
      }

      if (fixture.capabilities['registration.dynamic']) {
        if (
          !fixture.coveredBy['registration.dynamic'] ||
          fixture.sim.supportsDynamicRegistrationOnSim
        ) {
          it(`[${fixture.id}] R4: Dynamic Registration happy path, single-use registration token, and invalid token refusal`, async () => {
            await runDynamicRegistrationHappyAndNegativeCase(fixture);
            recordSuiteCase(fixture, 'K1-REG', 'R4', 'PASS');
          });
        }
      } else {
        it(`[${fixture.id}] R4-GUARD: dynamic method on channel without registration.dynamic returns 422 CAPABILITY_NOT_SUPPORTED`, async () => {
          await runDynamicRegistrationDisabledGuardCase(fixture);
          recordSuiteCase(fixture, 'K1-REG', 'R4-GUARD', 'PASS');
        });
      }

      if (fixture.capabilities['deployments.multiple']) {
        it(`[${fixture.id}] R5: additional deployment on existing registration succeeds and launches`, async () => {
          await runAddDeploymentCase(fixture);
          recordSuiteCase(fixture, 'K1-REG', 'R5', 'PASS');
        });
      }

      if (fixture.capabilities['setup.connectionCheck']) {
        it(`[${fixture.id}] R6: connection check returns result ok on valid platform and result failed on invalid_client`, async () => {
          await runConnectionCheckCase(fixture);
          recordSuiteCase(fixture, 'K1-REG', 'R6', 'PASS');
        });
      }
    });
  }
});
