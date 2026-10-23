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
//   (`TOOL_MAY_EXIST`), BD-A1-90..92, BD-A1-96 (§7 refused-event catalogue: `deployment_mismatch`,
//   `bound_values_missing` for staged without `--accept-staged`, `bound_values_not_allowed`, `bound_value_invalid`,
//   `not_staged`, `staged_values_changed`, `client_id_mismatch` staged case, `foreign_hosts_unconfirmed`), BD-A1-97
//   (staged values changed after issue -> `422 GRANT_MISMATCH` with `details.fields` and `grant_rejected` reason
//   `mismatch`; staged platform gone -> `409 PLATFORM_IN_USE` naming the cause; disconnect/release of unredeemed staged
//   connection leaves the inactive staged platform alone), and Round 2 fixes (a) finalized repeat bound-value compare
//   and (b) staged generic wizard short body `{ clientId, deploymentId, grantCode }` (B-LA-E2-04-01 / A-LA-E2-04-01).
// Source: docs/architecture/ltiaas/tasks/LA-E2-04.md; LA-ADR-02 D2a, D5 item 10, D6; LA-ADR-04 D4 rules 1, 5;
// cogniate-app-api-delta.md §3.4, §5, §7; build-decisions-A1.md BD-A1-59, BD-A1-79, BD-A1-87, BD-A1-90..92, BD-A1-96, BD-A1-97.
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

  it('AC-LA-E2-04-01, AC-LA-E2-04-02, AC-LA-E2-04-05, AC-LA-E2-04-06, AC-LA-E2-04-07 (and BD-A1-59, BD-A1-79, BD-A1-87, BD-A1-90..92, BD-A1-96..97): Author unit and portal tests pass', async () => {
    // 1. Run all unit tests in the LA-E2-04 test files (including portal wizard tests for B-LA-E2-04-01 / A-LA-E2-04-01) with verbose output.
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
        'apps/portal/src/channels/shell.test.tsx',
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

  it('LA-E2-04 Round 2 host-only API & CLI checks: (a) finalized repeat compares bound values (422 GRANT_MISMATCH + grant_rejected mismatch vs 200 no LTI call), (b) staged short body {clientId, deploymentId, grantCode}, and (c) app delta §7 refused-event codes (BD-A1-96) & BD-A1-97 engine outcomes', async () => {
    const sharedUrl = pathToFileURL(path.join(ROOT, 'packages/shared/src/index.ts')).href;
    const testkitUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/testkit.ts')).href;
    const operatorUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/operator.ts')).href;
    const cleanupUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/binding-cleanup.ts')).href;
    const auditUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/app/audit.ts')).href;
    const connectionsDomUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/domain/connections.ts')).href;

    const { createLogger } = (await import(sharedUrl)) as {
      createLogger: (opts: { service: string; level: string; write: (line: string) => void }) => unknown;
    };
    const { TEST_CHANNELS, THANH, ltiPlatform, testApp } = (await import(testkitUrl)) as {
      TEST_CHANNELS: {
        channel: (id: string) => {
          setup: { bindingFields: Array<{ key: string; required: boolean; method?: string }> };
        } | null;
      };
      THANH: { library: string };
      ltiPlatform: (over: Record<string, unknown>) => Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      testApp: (opts?: unknown) => Promise<{
        app: {
          inject: (req: unknown) => Promise<{
            statusCode: number;
            body: string;
            json: () => Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
          }>;
          close: () => Promise<void>;
        };
        db: {
          prepare: (sql: string) => {
            all: (...args: unknown[]) => Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
            get: (...args: unknown[]) => Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
            run: (...args: unknown[]) => unknown;
          };
        };
        lti: {
          calls: string[];
          client: unknown;
          platforms: Map<string, Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
        };
        clock: { now: number };
        logs: Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
        login: (user: unknown) => Promise<string>;
        writeHeaders: (cookie: string) => Record<string, string>;
      }>;
    };
    const { createOperator } = (await import(operatorUrl)) as {
      createOperator: (deps: unknown) => {
        issue: (input: Record<string, unknown>) => Promise<{ exitCode: number; lines: string[] }>;
        suspend: (connectionId: string, note: string, traceId: string) => Promise<{ exitCode: number; lines: string[] }>;
        release: (connectionId: string, note: string, traceId: string) => Promise<{ exitCode: number; lines: string[] }>;
      };
    };
    const { createBindingCleanup } = (await import(cleanupUrl)) as {
      createBindingCleanup: (deps: unknown) => unknown;
    };
    const { listAuditEvents } = (await import(auditUrl)) as {
      listAuditEvents: (
        db: unknown,
        opts: { limit: number; connection?: string },
      ) => { events: Array<{ result: string; code?: string; connectionId?: string }> };
    };
    const { stageRegistration } = (await import(connectionsDomUrl)) as {
      stageRegistration: (
        db: unknown,
        connectionId: string,
        profile: string,
        platform: Record<string, unknown>,
        now: number,
      ) => boolean;
    };

    const t = await testApp();
    try {
      const logger = createLogger({
        service: 'cogniate-app',
        level: 'debug',
        write: (l) => t.logs.push(JSON.parse(l)),
      });
      const cleanup = createBindingCleanup({ db: t.db, lti: t.lti.client, logger, now: () => t.clock.now });
      const op = createOperator({
        channels: TEST_CHANNELS,
        db: t.db,
        lti: t.lti.client,
        logger,
        cleanup,
        now: () => t.clock.now,
        env: {},
      });

      const cookie = await t.login(THANH);
      const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
        t.app.inject({
          method,
          url,
          headers: method === 'GET' ? { cookie } : t.writeHeaders(cookie),
          ...(payload !== undefined ? { payload } : {}),
        });

      const libId = String(t.db.prepare('SELECT id FROM library WHERE name = ?').get(THANH.library)!.id);
      const allRefusedCodes = (): string[] =>
        listAuditEvents(t.db, { limit: 500 })
          .events.filter((e) => e.result === 'refused')
          .map((e) => String(e.code));

      const siteUrl = 'https://lms.school.edu';
      const issuer = 'https://lms.school.edu';
      const authUrl = 'https://lms.school.edu/oidc/auth';
      const tokenUrl = 'https://tokens.school-vendor.edu/oauth2/token';
      const jwksUrl = 'https://lms.school.edu/oidc/jwks.json';
      const boundValues = {
        issuer,
        authenticationEndpoint: authUrl,
        accessTokenEndpoint: tokenUrl,
        jwksUrl,
      };

      // --- 1. Manual admin-value connection: §7 refused-event codes & (a) finalized repeat ---
      const cManual = (
        await call('POST', '/app-api/connections', {
          name: 'QA3 R2 Manual Generic',
          siteUrl,
          method: 'manual',
          lms: 'lti-generic',
        })
      ).json();
      const manualId = String(cManual.id);
      const baseIssue = {
        library: libId,
        connection: manualId,
        site: siteUrl,
        clientId: 'c-manual-1',
        deploymentId: 'dep-manual-1',
        note: 'qa3-r2',
        traceId: 't-r2',
      };

      expect((await op.issue(baseIssue)).exitCode).toBe(1); // bound_values_missing
      expect((await op.issue({ ...baseIssue, acceptStaged: true })).exitCode).toBe(1); // not_staged
      expect(
        (
          await op.issue({
            ...baseIssue,
            boundValues: { ...boundValues, issuer: 'https://other.school.edu/sakai' },
          })
        ).exitCode,
      ).toBe(1); // bound_value_invalid
      expect((await op.issue({ ...baseIssue, boundValues })).exitCode).toBe(1); // foreign_hosts_unconfirmed
      const manualRefused = allRefusedCodes().sort();
      expect(manualRefused).toEqual([
        'bound_value_invalid',
        'bound_values_missing',
        'foreign_hosts_unconfirmed',
        'not_staged',
      ]);

      const issued = await op.issue({ ...baseIssue, boundValues, confirmForeignHosts: true });
      expect(issued.exitCode, issued.lines.join('\n')).toBe(0);
      const manualGrantCode = issued.lines.find((l) => l.startsWith('Approval code'))!.split(': ')[1]!;

      const baseManualBody = {
        ...boundValues,
        clientId: 'c-manual-1',
        deploymentId: 'dep-manual-1',
        grantCode: manualGrantCode,
      };

      // Initial redemption -> 200
      const redeem1 = await call('PUT', `/app-api/connections/${manualId}/platform`, baseManualBody);
      expect(redeem1.statusCode).toBe(200);
      expect(redeem1.json().status).toBe('registered');

      // (a) Finalized repeat: identical body, canonical origin variant, and blank optional tokenAudience -> 200 with no LTI call
      const callsBeforeRepeat = t.lti.calls.length;
      const repeatIdentical = await call('PUT', `/app-api/connections/${manualId}/platform`, {
        ...baseManualBody,
        issuer: 'HTTPS://LMS.School.Edu:443',
        tokenAudience: '',
      });
      expect(repeatIdentical.statusCode).toBe(200);
      expect(t.lti.calls.length, 'identical finalized repeat makes no LTI call').toBe(callsBeforeRepeat);

      // (a) Finalized repeat: changed bound value -> 422 GRANT_MISMATCH with details.fields and log grant_rejected reason mismatch, no LTI call
      const logsBeforeMismatch = t.logs.length;
      const repeatMismatch = await call('PUT', `/app-api/connections/${manualId}/platform`, {
        ...baseManualBody,
        jwksUrl: 'https://lms.school.edu/oidc/other-jwks.json',
        accessTokenEndpoint: 'https://tokens.school-vendor.edu/oauth2/other-token',
      });
      expect(repeatMismatch.statusCode).toBe(422);
      expect(repeatMismatch.json().details).toMatchObject({
        message: 'GRANT_MISMATCH',
        fields: ['accessTokenEndpoint', 'jwksUrl'],
      });
      expect(t.lti.calls.length, 'mismatched finalized repeat makes no LTI call').toBe(callsBeforeRepeat);
      expect(
        t.logs.slice(logsBeforeMismatch).some((l) => l.event === 'grant_rejected' && l.reason === 'mismatch'),
        'logs grant_rejected with reason mismatch on finalized repeat with changed bound value',
      ).toBe(true);

      // --- 2. Staged connection: (b) generic wizard dynamic fields, (c) BD-A1-96 §7 staged refused codes & BD-A1-97 engine outcomes ---
      // (b) Verify lti-generic manifest dynamic bindingFields are exactly clientId, deploymentId, grantCode
      const dynamicFields = TEST_CHANNELS.channel('lti-generic')!.setup.bindingFields.filter(
        (f) => f.method === 'dynamic',
      );
      expect(dynamicFields.map((f) => [f.key, f.required])).toEqual([
        ['clientId', true],
        ['deploymentId', true],
        ['grantCode', true],
      ]);

      // Helper to create a staged connection
      const makeStaged = async (idSuffix: string) => {
        const c = (
          await call('POST', '/app-api/connections', {
            name: `QA3 R2 Staged ${idSuffix}`,
            siteUrl,
            method: 'dynamic',
            lms: 'lti-generic',
          })
        ).json();
        const plt = ltiPlatform({
          id: `plt_staged_${idSuffix}`,
          url: `${siteUrl}/sakai`,
          clientId: `c-staged-${idSuffix}`,
          active: false,
          deploymentIds: [`dep-staged-${idSuffix}`],
          profile: 'lti-generic',
          bindingRef: `ref-${idSuffix}`,
          authenticationEndpoint: authUrl,
          accesstokenEndpoint: tokenUrl,
          authConfig: { method: 'JWK_SET', key: jwksUrl },
          clientAssertionAud: 'https://tokens.school-vendor.edu/aud',
        });
        t.lti.platforms.set(plt.id, plt);
        expect(
          stageRegistration(
            t.db,
            String(c.id),
            'lti-generic',
            {
              id: plt.id,
              issuer: plt.url,
              clientId: plt.clientId,
              deploymentIds: plt.deploymentIds,
              productFamilyCode: 'sakai',
            },
            t.clock.now,
          ),
        ).toBe(true);
        return { c, plt };
      };

      // Staged case 1: §7 refused codes (bound_values_missing without --accept-staged, bound_values_not_allowed, client_id_mismatch, deployment_mismatch, foreign_hosts_unconfirmed, staged_values_changed)
      t.db.prepare('DELETE FROM audit_event').run();
      const { c: cStaged1, plt: pltStaged1 } = await makeStaged('codes');
      const staged1Issue = {
        library: libId,
        connection: String(cStaged1.id),
        site: siteUrl,
        clientId: pltStaged1.clientId,
        deploymentId: pltStaged1.deploymentIds[0],
        note: 'qa3-staged-1',
        traceId: 't-s1',
      };
      expect((await op.issue(staged1Issue)).exitCode).toBe(1); // bound_values_missing (staged without --accept-staged)
      expect((await op.issue({ ...staged1Issue, boundValues })).exitCode).toBe(1); // bound_values_not_allowed
      expect((await op.issue({ ...staged1Issue, acceptStaged: true, clientId: 'wrong-client' })).exitCode).toBe(1); // client_id_mismatch
      expect((await op.issue({ ...staged1Issue, acceptStaged: true, deploymentId: 'wrong-dep' })).exitCode).toBe(1); // deployment_mismatch
      expect((await op.issue({ ...staged1Issue, acceptStaged: true })).exitCode).toBe(1); // foreign_hosts_unconfirmed
      pltStaged1.active = true;
      expect(
        (await op.issue({ ...staged1Issue, acceptStaged: true, confirmForeignHosts: true })).exitCode,
      ).toBe(1); // staged_values_changed (checked before printing)
      const staged1Refused = allRefusedCodes().sort();
      expect(staged1Refused).toEqual([
        'bound_values_missing',
        'bound_values_not_allowed',
        'client_id_mismatch',
        'deployment_mismatch',
        'foreign_hosts_unconfirmed',
        'staged_values_changed',
      ]);

      // Staged case 2a (BD-A1-97): staged values changed after grant issue -> 422 GRANT_MISMATCH + grant_rejected mismatch
      const { c: cStaged2, plt: pltStaged2 } = await makeStaged('changed');
      const staged2Issued = await op.issue({
        library: libId,
        connection: String(cStaged2.id),
        site: siteUrl,
        clientId: pltStaged2.clientId,
        deploymentId: pltStaged2.deploymentIds[0],
        acceptStaged: true,
        confirmForeignHosts: true,
        note: 'qa3-staged-2',
        traceId: 't-s2',
      });
      expect(staged2Issued.exitCode).toBe(0);
      const staged2Code = staged2Issued.lines.find((l) => l.startsWith('Approval code'))!.split(': ')[1]!;

      pltStaged2.authConfig = { method: 'JWK_SET', key: 'https://lms.school.edu/oidc/changed-jwks.json' };
      const logsBeforeStagedMismatch = t.logs.length;
      const stagedMismatchRes = await call('PUT', `/app-api/connections/${String(cStaged2.id)}/platform`, {
        clientId: pltStaged2.clientId,
        deploymentId: pltStaged2.deploymentIds[0],
        grantCode: staged2Code,
      });
      expect(stagedMismatchRes.statusCode).toBe(422);
      expect(stagedMismatchRes.json().details).toMatchObject({
        message: 'GRANT_MISMATCH',
        fields: ['jwksUrl'],
      });
      expect(
        t.logs.slice(logsBeforeStagedMismatch).some((l) => l.event === 'grant_rejected' && l.reason === 'mismatch'),
      ).toBe(true);

      // Staged case 3 (BD-A1-97): disconnect and release of an unredeemed staged connection leaves the inactive staged platform untouched
      const { c: cStaged3, plt: pltStaged3 } = await makeStaged('disconnect');
      const delRes = await call('DELETE', `/app-api/connections/${String(cStaged3.id)}`);
      expect([200, 204]).toContain(delRes.statusCode);
      expect(t.lti.platforms.has(pltStaged3.id), 'inactive staged platform stays in LTI service on disconnect').toBe(
        true,
      );
      expect(t.lti.platforms.get(pltStaged3.id)?.active).toBe(false);
      const relRes = await op.release(String(cStaged3.id), 'qa3-release-staged', 't-s3');
      expect(relRes.exitCode).toBe(0);
      expect(t.lti.platforms.has(pltStaged3.id), 'inactive staged platform stays in LTI service on release').toBe(true);
      expect(t.lti.platforms.get(pltStaged3.id)?.active).toBe(false);

      // Staged case 2b (BD-A1-97): staged platform gone -> 409 PLATFORM_IN_USE
      const { c: cStagedGone, plt: pltStagedGone } = await makeStaged('gone');
      const stagedGoneIssued = await op.issue({
        library: libId,
        connection: String(cStagedGone.id),
        site: siteUrl,
        clientId: pltStagedGone.clientId,
        deploymentId: pltStagedGone.deploymentIds[0],
        acceptStaged: true,
        confirmForeignHosts: true,
        note: 'qa3-staged-gone',
        traceId: 't-sgone',
      });
      expect(stagedGoneIssued.exitCode).toBe(0);
      const stagedGoneCode = stagedGoneIssued.lines.find((l) => l.startsWith('Approval code'))!.split(': ')[1]!;
      t.lti.platforms.delete(pltStagedGone.id);
      const stagedGoneRes = await call('PUT', `/app-api/connections/${String(cStagedGone.id)}/platform`, {
        clientId: pltStagedGone.clientId,
        deploymentId: pltStagedGone.deploymentIds[0],
        grantCode: stagedGoneCode,
      });
      expect(stagedGoneRes.statusCode).toBe(409);
      expect(stagedGoneRes.json().details?.message).toBe('PLATFORM_IN_USE');

      artifact(
        'e2-04-r2-summary.json',
        `${JSON.stringify(
          {
            manualRefusedCodes: manualRefused,
            stagedRefusedCodes: staged1Refused,
            finalizedRepeatIdenticalStatus: repeatIdentical.statusCode,
            finalizedRepeatMismatchDetails: repeatMismatch.json().details,
            stagedMismatchDetails: stagedMismatchRes.json().details,
            stagedGoneStatus: stagedGoneRes.statusCode,
            stagedGoneDetails: stagedGoneRes.json().details,
            stagedPlatformPreservedOnDisconnect: t.lti.platforms.has(pltStaged3.id),
            stagedPlatformPreservedOnRelease: t.lti.platforms.get(pltStaged3.id)?.active === false,
          },
          null,
          2,
        )}\n`,
      );
    } finally {
      await t.app.close();
    }
  });

  it('BD-A1-97 (cogniate-app-api-delta.md §3.4): a gone staged platform gives 409 PLATFORM_IN_USE with a description that says the staged registration is gone and to make a new connection', async () => {
    const r2SummaryPath = path.join(process.env.LA_RUN_DIR!, 'e2-04-r2-summary.json');
    expect(fs.existsSync(r2SummaryPath)).toBe(true);
    const summary = JSON.parse(fs.readFileSync(r2SummaryPath, 'utf8')) as {
      stagedGoneStatus: number;
      stagedGoneDetails: { message?: string; description?: string };
    };
    expect(summary.stagedGoneStatus).toBe(409);
    expect(summary.stagedGoneDetails?.message).toBe('PLATFORM_IN_USE');
    expect(
      String(summary.stagedGoneDetails?.description ?? ''),
      'BD-A1-97: 409 PLATFORM_IN_USE description for a gone staged platform names the cause (staged registration is gone; make a new connection)',
    ).toMatch(/staged registration/i);
  });
});
