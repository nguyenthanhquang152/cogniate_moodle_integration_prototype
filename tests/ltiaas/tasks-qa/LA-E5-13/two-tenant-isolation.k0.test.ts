// LA-E5-13 K0 host-only suite: static/contract/fixture verification for two-tenant isolation.
// Runs without Docker (LA_LEVEL=k0). Imports only the public entry point `@cogniate/channel-kernel` permitted by
// `docs/architecture/ltiaas/tasks/README.md` §3. Verifies:
// 1. All 6 frozen isolation ACs (AC-T2-18, AC-T4-16, AC-T4-29, AC-T4-34, AC-T7-08, AC-T7-09) remain intact in their
//    canonical acceptance/e2e suites (AC-LA-E5-13-06 static check).
// 2. Every discovered channel in packages/channels/* obeys the LA-ADR-07 D2 authority invariants (A1-A6:
//    binding.authority values in {'self','operatorGrant'}, shared-platform channels never use 'self', admin-value
//    manual methods use 'operatorGrant').
// 3. The LA-E5-13 K1-SIM suite covers all required ACs (AC-LA-E5-13-01, -02, -03, -05, -06) and documents cut Should/Could
//    routes as N/A per docs/architecture/ltiaas/tasks/LA-E5-13.md Scope.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildChannelRegistry, computeCapabilities, loadChannelFolders } from '@cogniate/channel-kernel';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(
  process.env.LA_TARGET_ROOT ?? process.env.QA_REPO_ROOT ?? process.env.LA_SCRATCH_CLONE ?? path.join(here, '../../../..'),
);

describe('LA-E5-13 K0 (host-only static & contract invariants)', () => {
  it('AC-LA-E5-13-06 (static): all six frozen isolation ACs (AC-T2-18, AC-T4-16, AC-T4-29, AC-T4-34, AC-T7-08, AC-T7-09) are present and unskipped in tests/', () => {
    const frozenChecks: { ac: string; relPath: string; needle: string }[] = [
      {
        ac: 'AC-T2-18',
        relPath: 'tests/acceptance/T2a/launch.spec.ts',
        needle: 'AC-T2-18 qa-second may register the same issuer + client id; a Moodle launch still belongs to cogniate',
      },
      {
        ac: 'AC-T4-16',
        relPath: 'tests/acceptance/T4b2/1-picker.spec.ts',
        needle: 'AC-T4-16 through "Cogniate (QA Library B)" in COGNIATE-DEV-102 the picker shows only library B',
      },
      {
        ac: 'AC-T4-29',
        relPath: 'tests/acceptance/T4b2/5-negative.spec.ts',
        needle: 'AC-T4-29 an unknown playId → 404; library B gets 404 for Thanh',
      },
      {
        ac: 'AC-T4-34',
        relPath: 'tests/acceptance/T4b1/3-security.spec.ts',
        needle: "AC-T4-34 tenant matrix: library B gets 404 for Thanh's connection, publication and course version endpoints",
      },
      {
        ac: 'AC-T7-08',
        relPath: 'tests/e2e/2-scenario-b.spec.ts',
        needle: 'B4 AC-T7-08',
      },
      {
        ac: 'AC-T7-09',
        relPath: 'tests/e2e/2-scenario-b.spec.ts',
        needle: 'B6 AC-T7-09',
      },
    ];

    for (const item of frozenChecks) {
      const fullPath = path.join(repoRoot, item.relPath);
      expect(fs.existsSync(fullPath), `${item.ac} file exists at ${item.relPath}`).toBe(true);
      const text = fs.readFileSync(fullPath, 'utf8');
      expect(text, `${item.ac} test title present in ${item.relPath}`).toContain(item.needle);
      expect(text, `${item.ac} is not skipped`).not.toMatch(new RegExp(`test\\.(?:skip|fixme)\\([^\\n]*${item.ac}`));
    }
  });

  it('LA-ADR-07 D2 authority invariants: every channel loaded via @cogniate/channel-kernel uses only kernel binding.authority strategies and binds admin-value manual methods with operatorGrant', async () => {
    const channelsDir = path.join(repoRoot, 'packages/channels');
    const loaded = await loadChannelFolders([channelsDir], 'app');
    const registry = buildChannelRegistry(loaded, { simulations: true });
    const manifests = registry.channels();
    expect(manifests.length).toBeGreaterThanOrEqual(4);

    for (const manifest of manifests) {
      const caps = computeCapabilities(manifest);
      const authorityMap = caps['binding.authority'];
      const entries = Object.entries(authorityMap);
      expect(entries.length, `${manifest.id} declares at least one registration method`).toBeGreaterThanOrEqual(1);
      for (const [method, auth] of entries) {
        expect(['self', 'operatorGrant'], `${manifest.id} ${method} authority ${auth}`).toContain(auth);
      }
      // Shared-platform channel (blackboard) must never use 'self' (LA-ADR-07 A4).
      if (caps['platform.sharing'] === 'shared') {
        expect(Object.values(authorityMap)).toEqual(['operatorGrant']);
      }
      // Non-Moodle channels with manual registration must use 'operatorGrant' on manual (LA-ADR-07 A3).
      if (manifest.id !== 'moodle' && authorityMap.manual) {
        expect(authorityMap.manual, `${manifest.id} manual authority`).toBe('operatorGrant');
      }
    }
  });

  it('LA-E5-13 K1-SIM suite completeness: two-tenant-isolation.k1sim.test.ts defines tests for AC-LA-E5-13-01, -02, -03, -05, and -06', () => {
    const k1File = path.join(here, 'two-tenant-isolation.k1sim.test.ts');
    expect(fs.existsSync(k1File)).toBe(true);
    const content = fs.readFileSync(k1File, 'utf8');
    for (const ac of [
      'AC-LA-E5-13-01',
      'AC-LA-E5-13-02',
      'AC-LA-E5-13-03',
      'AC-LA-E5-13-05',
      'AC-LA-E5-13-06',
    ]) {
      expect(content, `K1-SIM suite contains ${ac}`).toContain(ac);
    }
    expect(content).toContain('/tool-configuration');
    expect(content).toContain('/registration-url');
    expect(content).toContain('/platform');
    expect(content).toContain('/deployments');
    expect(content).toContain('/tool/picker/');
    expect(content).toContain('/cancel');
    expect(content).toContain('/lti/launch/qa-second/storage-check');
    expect(content).toContain('storage_check_unknown_used_or_expired');
    expect(content).toContain('/api/service-keys/revoke');
  });
});
