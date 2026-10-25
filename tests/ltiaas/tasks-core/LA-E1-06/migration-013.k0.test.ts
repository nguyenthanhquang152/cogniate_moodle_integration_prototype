// LA-E1-06 K0 acceptance tests: F5 `connection-lms` rule (AC-LA-E1-06-04) and F1 ratchet + full F5 run on the clean
// tree (AC-LA-E1-06-09).
// Source: docs/architecture/ltiaas/tasks/LA-E1-06.md (AC-LA-E1-06-04, AC-LA-E1-06-09); LA-ADR-04 D4 rule 3;
// docs/architecture/ltiaas/README.md §4 (N7, F1, F5); tasks/README.md §4 RQ-3; TEST-STRATEGY §3.2, §3.6.
// QA-3 wrote these tests from the spec and the design only (test-first). Runs inside a prepared clone (README.md).
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT, artifact, f1Hits, f1Text, f5Text, git, isF1Core, npmCheck, requireRunDir, requireScratchClone, run,
  scriptEchoes, type RunResult,
} from '../LA-E1-04/fitness';

const CONNECTION_REPO = 'services/cogniate-app/src/domain/connections.ts';
const BASE_SHA = process.env.LA_BASE_SHA ?? 'HEAD~1';

let clean: RunResult;

function readBaselineCounts(ref: string): Record<string, number> | null {
  try {
    const text = git(['show', `${ref}:infra/scripts/fitness/f1-baseline.json`]);
    const raw = JSON.parse(text) as Record<string, unknown>;
    const isCounts = (o: unknown): o is Record<string, number> =>
      typeof o === 'object' && o !== null && !Array.isArray(o) && Object.values(o).every((v) => typeof v === 'number');
    if (isCounts(raw)) return raw;
    return Object.values(raw).find(isCounts) ?? null;
  } catch {
    return null;
  }
}

function fileExistsAt(ref: string, relPath: string): boolean {
  try {
    git(['cat-file', '-e', `${ref}:${relPath}`]);
    return true;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  requireScratchClone();
  requireRunDir();
  clean = await npmCheck('e1-06-check-clean');
});

describe('LA-E1-06 migration 013 and channel/authority reads (K0)', () => {
  it('AC-LA-E1-06-04: F5 connection-lms: a probe SQL text outside the connection repository that names lms of connection fails; the clean tree passes', async () => {
    const ruleFile = path.join(ROOT, 'infra/scripts/fitness/rules/connection-lms.mjs');
    expect(fs.existsSync(ruleFile), 'infra/scripts/fitness/rules/connection-lms.mjs exists').toBe(true);

    const probes: Array<[string, string]> = [
      [
        'services/cogniate-app/src/domain/attempts.ts',
        "export const q = 'SELECT c.id, c.lms FROM connection c WHERE c.id = :id';\n",
      ],
      [
        'services/cogniate-app/src/domain/score-syncs.ts',
        "export const q = 'SELECT lms FROM connection WHERE id = ?';\n",
      ],
      [
        'services/cogniate-app/src/app/results.ts',
        "export const q = \"SELECT con.id FROM connection AS con WHERE con.lms = 'moodle'\";\n",
      ],
    ];
    const log: string[] = [];
    for (const [asPath, text] of probes) {
      const r = await f5Text(asPath, text);
      log.push(`## probe ${asPath}\n${text}-> exit ${r.code}\n${r.output}`);
      expect(r.code, `${asPath}: probe SQL reading connection.lms fails`).not.toBe(0);
      expect(r.output, `${asPath}: output names connection-lms or connection.lms`).toMatch(/connection[-_.]lms|\blms\b/i);
    }

    // Positive control 1: the connection repository at HEAD passes F5.
    const repoText = git(['show', `HEAD:${CONNECTION_REPO}`]);
    const repoRes = await f5Text(CONNECTION_REPO, repoText);
    log.push(`## control ${CONNECTION_REPO} -> exit ${repoRes.code}\n${repoRes.output}`);
    expect(repoRes.code, `${CONNECTION_REPO} at HEAD passes F5; output:\n${repoRes.output}`).toBe(0);

    // Positive control 2: the clean tree passes F5 inside npm run check.
    expect(clean.code, 'clean tree passes npm run check').toBe(0);
    artifact('e1-06-ac04-connection-lms.log', log.join('\n'));
  });

  it('AC-LA-E1-06-09: F1 counts of every file changed by this task go down or stay (RQ-3), and the full F5 run has 0 hits on the clean tree', async () => {
    expect(clean.code, 'npm run check exits 0 on the clean tree').toBe(0);
    const echoes = scriptEchoes(clean.output);
    expect(echoes.some((s) => /fitness:lms-names|lms-names/.test(s)), 'npm run check ran F1').toBe(true);
    expect(echoes.some((s) => /fitness:rules/.test(s)), 'npm run check ran F5').toBe(true);

    // Full F5 run on the clean tree has 0 hits and exits 0.
    const f5Clean = await run('npm', ['run', '--silent', 'fitness:rules']);
    artifact('e1-06-f5-clean.log', f5Clean.output);
    expect(f5Clean.code, `full F5 run exits 0; output:\n${f5Clean.output}`).toBe(0);

    // Check every file changed between BASE_SHA and HEAD.
    const baseSha = git(['rev-parse', BASE_SHA]);
    const headSha = git(['rev-parse', 'HEAD']);
    const changedFiles = git(['diff', '--name-only', baseSha, headSha]).split('\n').filter(Boolean);
    const changedCore = changedFiles.filter(isF1Core);
    expect(changedCore.length, `changed core files between ${baseSha} and ${headSha}`).toBeGreaterThan(0);

    const deltas: Array<{ file: string; baseHits: number | null; headHits: number }> = [];
    for (const rel of changedCore) {
      if (!fileExistsAt(headSha, rel)) continue;
      const headRes = await f1Text(rel, git(['show', `${headSha}:${rel}`]));
      expect(headRes.code, `${rel}: passes F1 ratchet at HEAD; output:\n${headRes.output}`).toBe(0);
      const headHits = f1Hits(headRes.output).filter((h) => h.path === rel).length;

      let baseHits: number | null = null;
      if (fileExistsAt(baseSha, rel)) {
        const baseRes = await f1Text(rel, git(['show', `${baseSha}:${rel}`]));
        baseHits = f1Hits(baseRes.output).filter((h) => h.path === rel).length;
        expect(headHits, `${rel}: F1 hit count at HEAD (${headHits}) <= at ${baseSha.slice(0, 7)} (${baseHits})`).toBeLessThanOrEqual(baseHits);
      } else {
        expect(headHits, `new core file ${rel} has 0 F1 hits`).toBe(0);
      }
      deltas.push({ file: rel, baseHits, headHits });
    }

    // If f1-baseline.json existed at baseSha, also check that no entry in f1-baseline.json rose.
    const baseBaseline = readBaselineCounts(baseSha);
    const headBaseline = readBaselineCounts(headSha);
    expect(headBaseline, 'f1-baseline.json exists at HEAD').not.toBeNull();
    if (baseBaseline && headBaseline) {
      for (const [file, headCount] of Object.entries(headBaseline)) {
        const prev = baseBaseline[file] ?? 0;
        expect(headCount, `f1-baseline.json ${file}: ${headCount} <= ${prev} (RQ-3)`).toBeLessThanOrEqual(prev);
      }
    }

    artifact('e1-06-ac09-f1-deltas.json', `${JSON.stringify({ baseSha, headSha, deltas }, null, 2)}\n`);
  });
});
