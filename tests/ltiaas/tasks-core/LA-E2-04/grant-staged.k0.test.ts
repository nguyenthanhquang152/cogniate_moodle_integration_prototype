// LA-E2-04 K0 and UNIT-row acceptance tests (no Docker):
// - R0: `npm run check` exits 0 (lint, typecheck, unit tests, infra tests, K0 contract suite, F1 0 hits, F5 6 rules).
// - AC-LA-E2-04-01 (UNIT): `app:grant issue` on an admin-value connection with no staged platform and without
//   `--issuer`, `--auth-url`, `--token-url` or `--jwks-url` exits 1 and stores nothing; the same flags on a
//   fixed-endpoint (Canvas) connection exit 1.
// - AC-LA-E2-04-02 (UNIT): The CLI prints the bound values before the code and marks each value whose host is not the
//   issuer host; without `--confirm-foreign-hosts` it then exits 1 and stores nothing; with it the grant row has
//   `bound_values`.
// - AC-LA-E2-04-05 (UNIT): Writer test (LA-ADR-04 D4 rule 5 / BD-A1-90): the staged DR leaves
//   `binding_authority = 'operatorGrant'` and `lms = 'canvas'`, written in the same transaction as the staged platform
//   record (`stageRegistration` in `domain/connections.ts`, guarded by `status = 'pending' AND binding_authority = 'self'`).
// - AC-LA-E2-04-06 (UNIT): `--accept-staged` on a connection without a staged platform exits 1 and stores nothing.
// - AC-LA-E2-04-07 (UNIT): `app:grant list` prints the bound values; `app:binding suspend` and `release` pick the
//   record kind from the stored `target_kind`.
// - Design & BD invariants: BD-A1-59 (`UPDATE_NOT_ALLOWED`), BD-A1-79 (first-use `endpoints: fixed` check), BD-A1-87
//   (`TOOL_MAY_EXIST`), BD-A1-90..92 (staged DR & 6 refused-event codes: `bound_values_missing`,
//   `bound_values_not_allowed`, `bound_value_invalid`, `not_staged`, `staged_values_changed`,
//   `foreign_hosts_unconfirmed`).
// Source: docs/architecture/ltiaas/tasks/LA-E2-04.md; LA-ADR-02 D2a, D5 item 10, D6; LA-ADR-04 D4 rules 1, 5;
// cogniate-app-api-delta.md §3.4, §5, §7; build-decisions-A1.md BD-A1-59, BD-A1-79, BD-A1-87, BD-A1-90..92.
// QA-3 wrote these tests from the spec, contracts and ADRs only (test-first).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT,
  artifact,
  npmCheck,
  requireRunDir,
  requireScratchClone,
  run,
  scriptEchoes,
  type RunResult,
} from '../LA-E1-04/fitness';

let clean: RunResult;

beforeAll(async () => {
  requireScratchClone();
  requireRunDir();
  clean = await npmCheck('e2-04-check-clean');
});

describe('LA-E2-04 grant bound values, staged registration in the app, and operator CLI flags (K0 + UNIT rows)', () => {
  it('R0 & F5 connection-lms guard: npm run check exits 0, F1 has 0 hits, F5 passes all 6 rules, and lti-generic exposes dynamic (self) and manual (operatorGrant) on an admin-value profile', async () => {
    expect(clean.code, `npm run check exits 0:\n${clean.output}`).toBe(0);
    const echoes = scriptEchoes(clean.output);
    expect(echoes.some((s) => /test:unit|vitest/.test(s)), 'npm run check ran unit tests').toBe(true);
    expect(echoes.some((s) => /test:k0/.test(s)), 'npm run check ran K0').toBe(true);
    expect(echoes.some((s) => /fitness:lms-names/.test(s)), 'npm run check ran F1').toBe(true);
    expect(echoes.some((s) => /fitness:rules/.test(s)), 'npm run check ran F5').toBe(true);
    expect(clean.output).toContain('F1 PASS: 0 files with hits, 0 hits');

    const kernelEntry = pathToFileURL(path.join(ROOT, 'packages/channel-kernel/src/index.ts')).href;
    const kernel = (await import(kernelEntry)) as {
      loadChannelFolders(
        roots: readonly string[],
        side: 'lti' | 'app',
      ): Promise<
        Array<{
          manifest: {
            id: string;
            registration: Array<{ method: string; authority: string; profiles: string[]; defaultProfile: string }>;
            texts?: { registration?: Record<string, string> };
          };
          ltiProfiles?: Array<{ id: string; endpoints: string }>;
        }>
      >;
    };
    const channelsRoot = [path.join(ROOT, 'packages/channels')];
    const ltiLoaded = await kernel.loadChannelFolders(channelsRoot, 'lti');
    const generic = ltiLoaded.find((c) => c.manifest.id === 'lti-generic');
    expect(generic, 'lti-generic channel loaded').toBeDefined();
    expect(generic!.manifest.registration).toEqual([
      { method: 'dynamic', authority: 'self', profiles: ['lti-generic'], defaultProfile: 'lti-generic' },
      { method: 'manual', authority: 'operatorGrant', profiles: ['lti-generic'], defaultProfile: 'lti-generic' },
    ]);
    expect(generic!.ltiProfiles?.[0]?.endpoints).toBe('admin');

    const moodle = ltiLoaded.find((c) => c.manifest.id === 'moodle');
    expect(moodle?.manifest.texts?.registration?.UPDATE_NOT_ALLOWED, 'BD-A1-59 Moodle UPDATE_NOT_ALLOWED text').toBe(
      'Go back in {LMS} and choose Register as a new external tool.',
    );
    expect(moodle?.manifest.texts?.registration?.TOOL_MAY_EXIST, 'BD-A1-87 Moodle TOOL_MAY_EXIST text').toContain(
      '{LMS} may have saved a Pending tool',
    );
  });

  it('AC-LA-E2-04-01, AC-LA-E2-04-02, AC-LA-E2-04-05, AC-LA-E2-04-06, AC-LA-E2-04-07 (and BD-A1-59, BD-A1-79, BD-A1-87, BD-A1-90..92): Author unit tests pass', async () => {
    // 1. Run all unit tests in the LA-E2-04 test files with verbose output.
    const byAc = await run(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'services/cogniate-app/src/app/operator-bound-values.test.ts',
        'services/cogniate-app/src/app/redemption-admin.test.ts',
        'services/cogniate-app/src/tool-pages/register-staged.test.ts',
        'services/cogniate-app/src/tool-pages/lms-texts.test.ts',
        'services/cogniate-app/src/clients/lti-client.test.ts',
      ],
      { timeoutMs: 5 * 60_000 },
    );
    artifact('e2-04-unit-by-ac.log', byAc.output);
    expect(byAc.code, `LA-E2-04 unit test files exit 0:\n${byAc.output}`).toBe(0);

    for (const acId of [
      'AC-LA-E2-04-01',
      'AC-LA-E2-04-02',
      'AC-LA-E2-04-05',
      'AC-LA-E2-04-06',
      'AC-LA-E2-04-07',
    ]) {
      expect(
        byAc.output.includes(acId) || clean.output.includes(acId),
        `unit test suite covers ${acId}`,
      ).toBe(true);
    }
  });
});
