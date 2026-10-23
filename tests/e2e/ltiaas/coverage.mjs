// K2 manifest coverage verifier (LA-E7-07: U1–U4).
// Mirrors tests/e2e/M2/coverage.mjs: every case in tests/e2e/ltiaas/manifest.json must run and pass
// (no missing, skipped, unexpected, or untagged tests).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MANIFEST_PATH = path.join(__dirname, 'manifest.json');

export function loadManifest(manifestPath = MANIFEST_PATH) {
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!parsed || !Array.isArray(parsed.cases) || parsed.cases.length === 0) {
    throw new Error(`Invalid K2 manifest at ${manifestPath}: missing cases[]`);
  }
  const seen = new Set();
  for (const item of parsed.cases) {
    if (!item?.id || !item?.unit || !item?.file || !Array.isArray(item?.acs) || item.acs.length === 0 || !item?.title) {
      throw new Error(`Invalid K2 manifest entry: ${JSON.stringify(item)}`);
    }
    if (seen.has(item.id)) {
      throw new Error(`Duplicate K2 manifest case id: ${item.id}`);
    }
    seen.add(item.id);
  }
  return parsed;
}

function collectSpecs(suite, out = []) {
  if (!suite || typeof suite !== 'object') return out;
  for (const spec of suite.specs ?? []) out.push(spec);
  for (const child of suite.suites ?? []) collectSpecs(child, out);
  return out;
}

export function extractCaseId(title) {
  return String(title ?? '').match(/\{case:([A-Za-z0-9._-]+)\}/)?.[1] ?? null;
}

export function verifyK2Coverage(report, manifest = loadManifest()) {
  const problems = [];
  const specs = collectSpecs(report);
  const byId = new Map();

  for (const spec of specs) {
    const id = extractCaseId(spec.title);
    if (!id) {
      problems.push(`Test without {case:<id>}: ${spec.title}`);
      continue;
    }
    if (byId.has(id)) {
      problems.push(`Duplicate {case:${id}} in Playwright report`);
      continue;
    }
    const tests = Array.isArray(spec.tests) ? spec.tests : [];
    const results = tests.flatMap((t) => (Array.isArray(t.results) ? t.results : []));
    const statuses = results.map((r) => r.status);
    let status = 'missing';
    if (statuses.length === 0) status = 'not-run';
    else if (statuses.every((s) => s === 'passed')) status = 'passed';
    else if (statuses.some((s) => s === 'skipped')) status = 'skipped';
    else status = statuses.find((s) => s !== 'passed') ?? 'failed';

    byId.set(id, {
      id,
      title: spec.title,
      status,
      durationMs: results.reduce((sum, r) => sum + (r.duration ?? 0), 0),
    });
  }

  const rows = [];
  for (const entry of manifest.cases) {
    const observed = byId.get(entry.id);
    if (!observed) {
      problems.push(`Missing K2 case: ${entry.id}`);
      rows.push({ ...entry, status: 'missing', durationMs: 0 });
      continue;
    }
    rows.push({ ...entry, status: observed.status, durationMs: observed.durationMs });
    if (observed.status !== 'passed') {
      problems.push(`K2 case ${entry.id} did not pass (status=${observed.status})`);
    }
  }

  for (const id of byId.keys()) {
    if (!manifest.cases.some((c) => c.id === id)) {
      problems.push(`Unexpected K2 case in report: ${id}`);
    }
  }

  const coveredAcs = new Set(manifest.cases.flatMap((c) => c.acs));
  for (const ac of manifest.requiredAcs ?? []) {
    if (!coveredAcs.has(ac)) {
      problems.push(`Required AC ${ac} is not covered by any K2 manifest case`);
    }
  }

  return {
    ok: problems.length === 0,
    total: manifest.cases.length,
    passed: rows.filter((r) => r.status === 'passed').length,
    rows,
    problems,
  };
}
