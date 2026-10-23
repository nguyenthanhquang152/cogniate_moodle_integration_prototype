// Host-only self-test for K2 manifest coverage accounting and @cogniate/channel-kernel discovery (0 Docker).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildChannelRegistry, loadChannelFolders } from '@cogniate/channel-kernel';
import { loadManifest, verifyK2Coverage } from './coverage.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const channelsRoot = path.join(repoRoot, 'packages/channels');

const manifest = loadManifest();
assert.equal(manifest.cases.length, 12, 'Expected 12 K2 cases across U1–U4');

function makeReport(overrides = {}) {
  return {
    suites: [
      {
        title: 'root',
        specs: manifest.cases.map((c) => ({
          title: `K2 ${c.id} ${c.title} {case:${c.id}}`,
          tests: [
            {
              results: overrides[c.id] ?? [{ status: 'passed', duration: 100 }],
            },
          ],
        })),
      },
    ],
  };
}

// 1. All 12 cases pass -> ok
{
  const res = verifyK2Coverage(makeReport(), manifest);
  assert.equal(res.ok, true, `Expected ok=true, got problems: ${res.problems.join('; ')}`);
  assert.equal(res.passed, 12);
}

// 2. Missing case -> fails
{
  const report = makeReport();
  report.suites[0].specs.pop();
  const res = verifyK2Coverage(report, manifest);
  assert.equal(res.ok, false);
  assert.match(res.problems.join('\n'), /Missing K2 case: U4\.platform-storage\.negative/);
}

// 3. Skipped case -> fails
{
  const res = verifyK2Coverage(
    makeReport({ 'U4.platform-storage.positive': [{ status: 'skipped', duration: 0 }] }),
    manifest,
  );
  assert.equal(res.ok, false);
  assert.match(res.problems.join('\n'), /U4\.platform-storage\.positive did not pass \(status=skipped\)/);
}

// 4. Failed case -> fails
{
  const res = verifyK2Coverage(
    makeReport({ 'U3.brightspace.manual-flow': [{ status: 'failed', duration: 40 }] }),
    manifest,
  );
  assert.equal(res.ok, false);
  assert.match(res.problems.join('\n'), /U3\.brightspace\.manual-flow did not pass \(status=failed\)/);
}

// 5. Untagged spec -> fails
{
  const report = makeReport();
  report.suites[0].specs.push({ title: 'Untagged test', tests: [{ results: [{ status: 'passed' }] }] });
  const res = verifyK2Coverage(report, manifest);
  assert.equal(res.ok, false);
  assert.match(res.problems.join('\n'), /Test without \{case:<id>\}: Untagged test/);
}

// 6. Static source scan: every manifest id appears in 01..04 *.k2.ts and vice versa
{
  const specFiles = fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.k2.ts'))
    .sort();
  assert.deepEqual(
    specFiles,
    [
      '01-u1-cards.k2.ts',
      '02-u2-wizards.k2.ts',
      '03-u3-new-channels-flow.k2.ts',
      '04-u4-platform-storage.k2.ts',
    ],
    'Expected the 4 K2 spec files (01..04)',
  );

  const foundIds = [];
  for (const file of specFiles) {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const regex = /k2Case\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
      foundIds.push(m[1]);
    }
  }
  assert.deepEqual(
    [...foundIds].sort(),
    manifest.cases.map((c) => c.id).sort(),
    'k2Case IDs in *.k2.ts must match manifest.json 1-to-1',
  );
}

// 7. Host-only K0 channel-kernel verification for U1 and U2
{
  const appLoaded = await loadChannelFolders([channelsRoot], 'app');
  const ltiLoaded = await loadChannelFolders([channelsRoot], 'lti');
  const ltiByFolder = new Map(ltiLoaded.map((c) => [c.folder, c.ltiProfiles ?? []]));
  const merged = appLoaded.map((c) => ({
    ...c,
    ltiProfiles: ltiByFolder.get(c.folder) ?? [],
  }));
  const registry = buildChannelRegistry(merged, { simulations: true });
  const manifests = [...registry.channels()].sort((a, b) => a.card.order - b.card.order);

  assert.deepEqual(
    manifests.map((m) => m.id),
    ['moodle', 'canvas', 'blackboard', 'lti-generic', 'brightspace'],
    'Channel cards must be ordered 1..5: moodle, canvas, blackboard, lti-generic, brightspace',
  );

  const ltiGeneric = registry.channel('lti-generic');
  assert.ok(ltiGeneric, 'lti-generic manifest must exist');
  assert.deepEqual(
    ltiGeneric.registration.map((r) => r.method),
    ['dynamic', 'manual'],
    'lti-generic must expose dynamic and manual registration methods',
  );
  const genericManualFields = ltiGeneric.setup.bindingFields.filter((f) => !f.method || f.method === 'manual');
  assert.equal(genericManualFields.length, 8, 'lti-generic manual mode must expose 8 binding fields');

  const brightspace = registry.channel('brightspace');
  assert.ok(brightspace, 'brightspace manifest must exist');
  assert.deepEqual(
    brightspace.registration.map((r) => r.method),
    ['dynamic', 'manual'],
    'brightspace must expose dynamic and manual registration (LA-E2-06)',
  );
  const defaultedFields = brightspace.setup.bindingFields.filter((f) => typeof f.default === 'string');
  assert.equal(
    defaultedFields.length,
    5,
    'brightspace must define 5 default templates (issuer, authenticationEndpoint, accessTokenEndpoint, jwksUrl, tokenAudience)',
  );
  const byKey = new Map(defaultedFields.map((f) => [f.key, f.default]));
  assert.equal(byKey.get('issuer'), '{siteUrl}');
  assert.equal(byKey.get('authenticationEndpoint'), '{siteUrl}/d2l/lti/authenticate');
  assert.equal(byKey.get('accessTokenEndpoint'), 'https://auth.brightspace.com/core/connect/token');
  assert.equal(byKey.get('jwksUrl'), '{siteUrl}/d2l/.well-known/jwks');
  assert.equal(byKey.get('tokenAudience'), 'https://api.brightspace.com/auth/token');
}

console.log('k2-coverage: 7/7 selftests passed (12 K2 manifest cases + 5 channel-kernel manifests verified).');
