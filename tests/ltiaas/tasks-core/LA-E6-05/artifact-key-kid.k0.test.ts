// LA-E6-05 K0 + UNIT suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E6-05.md, LA-ADR-08 D5,
// and data-model.md §5a).
//
// Covers:
// - AC-LA-E6-05-01 (UNIT): A jwk=inline export writes the kid of the first JWKS key into connection.artifact_key_kid.
// - AC-LA-E6-05-02 (UNIT): A jwk=url export writes NULL into connection.artifact_key_kid.
// - Host-only API checks for AC-LA-E6-05-03 & AC-LA-E6-05-04: Canvas JSON shapes (jwk=url and jwk=inline) have no
//   extra member, and another library's session gets 404 without modifying connection.artifact_key_kid.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { ROOT, artifact, requireRunDir, requireScratchClone, run } from '../LA-E1-04/fitness';

function clearVitestCache(): void {
  for (const rel of [
    'node_modules/.vitest-cache',
    'node_modules/.vite',
    'tests/node_modules/.vitest-cache',
    'tests/node_modules/.vite',
  ]) {
    fs.rmSync(path.join(ROOT, rel), { recursive: true, force: true });
  }
}

beforeAll(() => {
  requireScratchClone();
  requireRunDir();
});

describe('LA-E6-05 Record the key of an inline-key setup artifact (K0 + UNIT + host API checks)', () => {
  it('AC-LA-E6-05-01 & AC-LA-E6-05-02 UNIT suites: packages/channels/canvas/app/configuration.test.ts and services/cogniate-app/src/app/canvas-configuration.test.ts pass', async () => {
    clearVitestCache();
    const unitRun = await run(
      'npx',
      [
        '--no-install',
        'vitest',
        'run',
        '--reporter=verbose',
        'packages/channels/canvas/app/configuration.test.ts',
        'services/cogniate-app/src/app/canvas-configuration.test.ts',
      ],
      { timeoutMs: 5 * 60_000 },
    );
    artifact('e6-05-unit.log', unitRun.output);
    expect(unitRun.code, `LA-E6-05 unit suites exit 0:\n${unitRun.output}`).toBe(0);
  });

  it('Host-only API checks for AC-LA-E6-05-01..04: jwk=inline writes connection.artifact_key_kid, jwk=url writes NULL, foreign library gets 404 and writes nothing, and JSON answers add no new member', async () => {
    const kernelEntry = pathToFileURL(path.join(ROOT, 'packages/channel-kernel/src/index.ts')).href;
    const testkitUrl = pathToFileURL(path.join(ROOT, 'services/cogniate-app/src/testkit.ts')).href;

    const kernel = (await import(kernelEntry)) as {
      loadChannelFolders(roots: readonly string[], side: 'lti' | 'app'): Promise<unknown[]>;
      buildChannelRegistry(channels: readonly unknown[], opts: { simulations: boolean }): unknown;
    };
    const appLoaded = await kernel.loadChannelFolders([path.join(ROOT, 'packages/channels')], 'app');
    const reg = kernel.buildChannelRegistry(appLoaded, { simulations: true });

    const { QA_B, THANH, testApp } = (await import(testkitUrl)) as {
      QA_B: { library: string };
      THANH: { library: string };
      testApp: (opts?: unknown) => Promise<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
    };

    const t = await testApp({ channels: reg });
    try {
      const cookieA = await t.login(THANH);
      const cookieB = await t.login(QA_B);
      const call = (cookie: string, method: 'GET' | 'POST', url: string, payload?: unknown) =>
        t.app.inject({
          method,
          url,
          headers: method === 'GET' ? { cookie } : t.writeHeaders(cookie),
          ...(payload !== undefined ? { payload } : {}),
        });

      const canvasCreate = await call(cookieA, 'POST', '/app-api/connections', {
        name: 'QA3 E6-05 Canvas',
        lms: 'canvas',
        method: 'manual',
        profile: 'canvas-sim-cloud',
        siteUrl: 'https://school-a.canvas.sim.test',
      });
      expect(canvasCreate.statusCode).toBe(201);
      const canvasId = String(canvasCreate.json().id);

      const readKid = () =>
        (
          t.db.prepare('SELECT artifact_key_kid FROM connection WHERE id = ?').get(canvasId) as {
            artifact_key_kid: string | null;
          }
        ).artifact_key_kid;

      expect(readKid()).toBeNull();

      // AC-LA-E6-05-04: Foreign library gets 404 and writes nothing
      const otherInline = await call(cookieB, 'GET', `/app-api/connections/${canvasId}/canvas-configuration?jwk=inline`);
      expect(otherInline.statusCode).toBe(404);
      expect(readKid()).toBeNull();

      // AC-LA-E6-05-01: jwk=inline writes the kid of the first JWKS key into connection.artifact_key_kid
      const inlineRes = await call(cookieA, 'GET', `/app-api/connections/${canvasId}/canvas-configuration?jwk=inline`);
      expect(inlineRes.statusCode).toBe(200);
      const inlineBody = inlineRes.json();
      expect(inlineBody.artifactKeyKid).toBeUndefined();
      expect(readKid()).toBe(inlineBody.public_jwk.kid);

      // AC-LA-E6-05-02: jwk=url writes NULL into connection.artifact_key_kid
      const urlRes = await call(cookieA, 'GET', `/app-api/connections/${canvasId}/canvas-configuration?jwk=url`);
      expect(urlRes.statusCode).toBe(200);
      const urlBody = urlRes.json();
      expect(urlBody.artifactKeyKid).toBeUndefined();
      expect(readKid()).toBeNull();

      artifact(
        'e6-05-host-api-summary.json',
        `${JSON.stringify(
          {
            inlineKid: inlineBody.public_jwk.kid,
            afterUrlKid: readKid(),
            otherLibraryStatus: otherInline.statusCode,
          },
          null,
          2,
        )}\n`,
      );
    } finally {
      await t.app.close();
    }
  });
});
