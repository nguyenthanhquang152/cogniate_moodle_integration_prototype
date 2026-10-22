// LA-E1-06 AC-LA-E1-06-05 (K1-SIM): the connection DTO and each `GET /app-api/lms-providers` entry show `channel`,
// `channelName` and `channelCapabilities` with the baseline values; every baseline field equals the golden
// (LA-IC-01 expected delta).
// Source: docs/architecture/ltiaas/tasks/LA-E1-06.md (AC-LA-E1-06-05); contracts/cogniate-app-api-delta.md §1, §2;
// LA-ADR-01 D3, D11; LA-ADR-04 D8 (LA-IC-01); TEST-STRATEGY §4.6, §4.7.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { G1_PROVIDERS_AND_CONNECTIONS, expectGoldenEqual } from '../LA-E1-01/golden-binding';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../../../..');

const EXPECTED_NAMES: Record<string, string> = {
  moodle: 'Moodle',
  canvas: 'Canvas',
  blackboard: 'Blackboard',
};

interface LegacyCaps {
  dynamicRegistration: boolean;
  operatorApproval: boolean;
  webServices: boolean;
  courseShell: boolean;
  addDeployment: boolean;
  canvasConfiguration: boolean;
}

function projectFromChannelCapabilities(cap: Record<string, unknown>): LegacyCaps {
  const auth = (cap['binding.authority'] ?? {}) as Record<string, string>;
  const artifacts = Array.isArray(cap['setup.artifacts']) ? (cap['setup.artifacts'] as string[]) : [];
  return {
    dynamicRegistration: Boolean(cap['registration.dynamic']),
    operatorApproval: Object.values(auth).includes('operatorGrant'),
    webServices: Boolean(cap['siteApi.token']),
    courseShell: Boolean(cap['publish.createCourse']),
    addDeployment: Boolean(cap['deployments.multiple']),
    canvasConfiguration: artifacts.includes('developer-key-json'),
  };
}

function assertAdditiveFieldsOnG1(captureDir: string): void {
  const g1File = path.join(captureDir, 'G1.json');
  expect(fs.existsSync(g1File), `G1.json exists in ${captureDir}`).toBe(true);
  const g1 = JSON.parse(fs.readFileSync(g1File, 'utf8')) as {
    acceptance?: { lmsProviders?: { lms?: Array<Record<string, unknown>> } };
    default?: { lmsProviders?: { lms?: Array<Record<string, unknown>> } };
    connectionList?: { connections?: Array<Record<string, unknown>> };
    connections?: Record<string, Record<string, unknown>>;
  };

  for (const mode of ['acceptance', 'default'] as const) {
    const entries = g1[mode]?.lmsProviders?.lms ?? [];
    expect(entries.length, `${mode}.lmsProviders.lms has the 3 baseline entries`).toBeGreaterThanOrEqual(3);
    for (const id of ['moodle', 'canvas', 'blackboard']) {
      const entry = entries.find((e) => e.lms === id);
      expect(entry, `${mode}.lmsProviders.lms has ${id}`).toBeDefined();
      expect(entry!.channel, `${mode} ${id}: channel === lms`).toBe(id);
      expect(entry!.channelName, `${mode} ${id}: channelName`).toBe(EXPECTED_NAMES[id]);
      expect(typeof entry!.channelCapabilities === 'object' && entry!.channelCapabilities !== null, `${mode} ${id}: channelCapabilities is an object`).toBe(true);
      expect(
        projectFromChannelCapabilities(entry!.channelCapabilities as Record<string, unknown>),
        `${mode} ${id}: channelCapabilities projects to the six legacy flags`,
      ).toStrictEqual(entry!.capabilities);
    }
  }

  const allConnections: Array<[string, Record<string, unknown>]> = [
    ...(g1.connectionList?.connections ?? []).map((c, i): [string, Record<string, unknown>] => [`connectionList[${i}]`, c]),
    ...Object.entries(g1.connections ?? {}),
  ];
  expect(allConnections.length, 'G1 capture contains connection DTOs').toBeGreaterThan(0);
  for (const [label, dto] of allConnections) {
    const lms = String(dto.lms);
    expect(dto.channel, `${label}: dto.channel === dto.lms`).toBe(lms);
    if (EXPECTED_NAMES[lms]) {
      expect(dto.channelName, `${label}: dto.channelName`).toBe(EXPECTED_NAMES[lms]);
    }
    expect(typeof dto.channelCapabilities === 'object' && dto.channelCapabilities !== null, `${label}: dto.channelCapabilities is an object`).toBe(true);
    expect(
      projectFromChannelCapabilities(dto.channelCapabilities as Record<string, unknown>),
      `${label}: dto.channelCapabilities projects to dto.capabilities`,
    ).toStrictEqual(dto.capabilities);
  }
}

describe('LA-E1-06 K1-SIM', () => {
  it('AC-LA-E1-06-05: connection DTOs and GET /app-api/lms-providers show channel, channelName and channelCapabilities, and equal the G-BASE golden with LA-IC-01', () => {
    const expectedDelta = process.env.LA_EXPECTED_DELTA ?? path.join(ROOT, 'tests/ltiaas/golden/expected/LA-IC-01.json');
    expectGoldenEqual('e1-06-ac05', G1_PROVIDERS_AND_CONNECTIONS, expectedDelta);
    assertAdditiveFieldsOnG1(process.env.LA_GOLDEN_CAPTURE!);
  });
});
