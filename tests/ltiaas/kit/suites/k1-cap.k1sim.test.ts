import { beforeAll, describe, expect, it } from 'vitest';
import {
  CONNECTION_GUARDED_CAPABILITIES,
  isConnectionGuardedOff,
  loadSelectedChannelFixtures,
  verifyBilateralCapabilities,
} from '../lib/fixtures.js';
import {
  appApi,
  APP_URL,
  ensureKitRunInitialized,
  httpRequest,
  isK1SimEnabled,
  performSimulatorLaunch,
  recordRedactedEvidence,
  RegisteredChannelContext,
  runKitCase,
  setupActiveChannelConnection,
} from '../lib/runtime.js';

const runSuite = isK1SimEnabled() ? describe : describe.skip;
const fixtures = loadSelectedChannelFixtures();

runSuite('K1-CAP: Bilateral Capability Equality, Negative Guards & Disconnect Suite', () => {
  beforeAll(() => {
    ensureKitRunInitialized({ channels: fixtures.map((f) => f.id) });
  });

  for (const fixture of fixtures) {
    describe(`channel: ${fixture.id}`, () => {
      let ctx: RegisteredChannelContext;

      beforeAll(async () => {
        ctx = await setupActiveChannelConnection(fixture, 'cap');
      });

      it(`[${fixture.id}:K1-CAP:C1] bilateral capability equality across manifest, fixture, /app-api/lms-providers, /app-api/connections/:id, legacyFlags, and toolConfigurationKeys`, async () => {
        await runKitCase(fixture.id, 'K1-CAP', 'C1', async () => {
          const session = { cookie: ctx.cookie, csrf: ctx.csrf };

          const provRes = await appApi('/app-api/lms-providers', session);
          expect(provRes.status).toBe(200);
          const providers = (
            provRes.json as {
              providers?: Array<{
                id: string;
                channelCapabilities?: Record<string, unknown>;
                capabilities?: Record<string, unknown>;
              }>;
            }
          ).providers;
          const providerEntry = providers?.find((p) => p.id === fixture.id);
          expect(providerEntry).toBeDefined();

          const connRes = await appApi(`/app-api/connections/${ctx.connectionId}`, session);
          expect(connRes.status).toBe(200);
          const connBody = connRes.json as {
            channelCapabilities?: Record<string, unknown>;
            capabilities?: Record<string, unknown>;
          };

          const tcRes = await appApi(
            `/app-api/connections/${ctx.connectionId}/tool-configuration`,
            session,
          );
          expect(tcRes.status).toBe(200);
          const tcBody = tcRes.json as { rows?: Array<{ key: string }> };
          const toolConfigurationKeys = (tcBody.rows ?? []).map((r) => r.key);

          const check = verifyBilateralCapabilities({
            fixture,
            manifestCapabilities: fixture.capabilities as unknown as Record<string, unknown>,
            providerChannelCapabilities:
              providerEntry!.channelCapabilities as Record<string, unknown>,
            providerLegacyFlags: providerEntry!.capabilities as Record<string, unknown>,
            connectionChannelCapabilities:
              connBody.channelCapabilities as Record<string, unknown>,
            connectionLegacyFlags: connBody.capabilities as Record<string, unknown>,
            toolConfigurationKeys,
          });
          expect(check.errors).toEqual([]);
          expect(check.ok).toBe(true);

          recordRedactedEvidence(`cap-c1-${fixture.id}`, {
            channelId: fixture.id,
            bilateralOk: check.ok,
            toolConfigurationKeyCount: toolConfigurationKeys.length,
            redacted: true,
          });
        });
      });

      for (const cap of CONNECTION_GUARDED_CAPABILITIES) {
        if (fixture.notBuilt?.[cap]) {
          continue;
        }
        if (!isConnectionGuardedOff(cap, fixture.capabilities[cap])) {
          continue;
        }

        it(`[${fixture.id}:K1-CAP:C2:${cap}] negative capability guard for ${cap}`, async () => {
          await runKitCase(fixture.id, 'K1-CAP', `C2:${cap}`, async () => {
            const session = { cookie: ctx.cookie, csrf: ctx.csrf };

            if (cap === 'registration.dynamic') {
              const drPageRes = await httpRequest(
                `${APP_URL}/tool/register?connectionId=${ctx.connectionId}&openid_configuration=${encodeURIComponent(
                  `${fixture.sim.siteUrl}/.well-known/openid-configuration`,
                )}`,
                { method: 'GET' },
              );
              expect(drPageRes.status).toBeGreaterThanOrEqual(400);
            } else if (cap === 'deployments.multiple') {
              const depRes = await appApi(
                `/app-api/connections/${ctx.connectionId}/deployments`,
                session,
                {
                  method: 'POST',
                  body: { deploymentId: ctx.secondaryDeploymentId },
                },
              );
              expect(depRes.status).toBe(409);
              expect(depRes.rawBody).toContain('CAPABILITY_NOT_SUPPORTED');
            } else if (cap === 'setup.artifacts') {
              const tcRes = await appApi(
                `/app-api/connections/${ctx.connectionId}/tool-configuration`,
                session,
              );
              expect(tcRes.status).toBe(200);
              const tcJson = tcRes.json as {
                rows?: Array<{ key: string }>;
                developerKeyJson?: unknown;
              };
              expect(tcJson.developerKeyJson).toBeUndefined();
              const rowKeys = (tcJson.rows ?? []).map((r) => r.key);
              expect(rowKeys).not.toContain('lti_json');
            } else if (cap === 'siteApi.token') {
              const wsRes = await appApi(
                `/app-api/connections/${ctx.connectionId}/web-service-token`,
                session,
                {
                  method: 'PUT',
                  body: { token: 'probe-ws-token-12345' },
                },
              );
              expect(wsRes.status).toBe(409);
              expect(wsRes.rawBody).toContain('CAPABILITY_NOT_SUPPORTED');
            } else if (cap === 'publish.createCourse') {
              const shellRes = await appApi(
                `/app-api/courses/${ctx.courseId}/create-shell`,
                session,
                {
                  method: 'POST',
                  body: { connectionId: ctx.connectionId },
                },
              );
              expect(shellRes.status).toBe(409);
              expect(shellRes.rawBody).toContain('CAPABILITY_NOT_SUPPORTED');
            } else if (cap === 'setup.connectionCheck') {
              const checkRes = await appApi(
                `/app-api/connections/${ctx.connectionId}/check`,
                session,
                {
                  method: 'POST',
                  body: {},
                },
              );
              expect(checkRes.status).toBe(409);
              expect(checkRes.rawBody).toContain('CAPABILITY_NOT_SUPPORTED');
            } else if (cap === 'content.ungraded') {
              const dlNoGrade = await performSimulatorLaunch(ctx, {
                messageType: 'LtiDeepLinkingRequest',
                roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
                acceptLineitem: false,
              });
              expect(dlNoGrade.playOrPickerRes?.status).toBe(403);
              expect(dlNoGrade.playOrPickerRes?.rawBody).toContain('PLACEMENT_NOT_GRADED');
            }
          });
        });
      }

      it(`[${fixture.id}:K1-CAP:C3] disconnect disables target connection while other connections on the channel remain active`, async () => {
        await runKitCase(fixture.id, 'K1-CAP', 'C3', async () => {
          const disconnectCtx = await setupActiveChannelConnection(
            {
              ...fixture,
              sim: {
                ...fixture.sim,
                deployments: [ctx.secondaryDeploymentId, ctx.deploymentId],
              },
            },
            'cap-disconnect',
          );

          const delRes = await appApi(
            `/app-api/connections/${disconnectCtx.connectionId}`,
            { cookie: disconnectCtx.cookie, csrf: disconnectCtx.csrf },
            { method: 'DELETE' },
          );
          expect([200, 204]).toContain(delRes.status);

          const deadLaunch = await performSimulatorLaunch(disconnectCtx, {});
          expect(deadLaunch.launchRes.status).toBeGreaterThanOrEqual(400);
          expect(deadLaunch.launchRes.rawBody).toMatch(
            /PLATFORM_NOT_ACTIVE|DEPLOYMENT_NOT_ACTIVE/i,
          );

          // Primary connection on the same channel still launches cleanly
          const siblingLaunch = await performSimulatorLaunch(ctx, {});
          expect([302, 303]).toContain(siblingLaunch.launchRes.status);
          expect(siblingLaunch.ltik.length).toBeGreaterThan(10);
        });
      });
    });
  }
});
