// LA-E1-04 K0 acceptance tests: fitness tools F1 (LMS-name lint with ratchet), F2 (add-channel gate), F5 rule runner.
// Source: docs/architecture/ltiaas/tasks/LA-E1-04.md (AC-LA-E1-04-01 to -10); TEST-STRATEGY §3.1–§3.3, §3.5, §3.6.
// QA-3 wrote these tests from the spec and the design only (test-first). Runs inside a prepared clone (README.md).
// Scratch files (QA form (k)): packages/channels/zz-*/ and one rule file in infra/scripts/fitness/rules/; the
// clean-up removes them, and the clone is clean at the end.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT, artifact, channelDiff, f1Hits, f1Text, f5Text, git, npmCheck, removeScratchDir, requireRunDir, requireScratchClone, run,
  scratch, scriptEchoes, type RunResult,
} from './fitness';

const here = path.dirname(fileURLToPath(import.meta.url));
const CORE_TS = 'services/cogniate-app/src/zz-qa-probe.ts';
const CORE_TSX = 'apps/portal/src/zz-qa-probe.tsx';
const KERNEL_OTHER = 'packages/channel-kernel/src/zz-qa-probe.ts';
const LEGACY_WIRE = 'packages/channel-kernel/src/legacy-wire.ts';
// AC-09: one statement of the SQL portability list. The list lives in the rule file (spec: qa.md copies it); if this
// default is not on the list, set LA_SQL_PROBE and LA_SQL_PROBE_NAME to a listed statement. The assertion stays.
const SQL_PROBE = process.env.LA_SQL_PROBE ?? 'INSERT OR REPLACE INTO zz_qa_probe (id) VALUES (1);';
const SQL_PROBE_NAME = process.env.LA_SQL_PROBE_NAME ?? 'INSERT OR REPLACE';

let clean: RunResult;
let headSha = '';
let runDir = '';

function hitFor(r: RunResult, asPath: string, word: string, token: RegExp) {
  return f1Hits(r.output).find((h) => h.path === asPath && h.word === word && token.test(h.token));
}

/** f1-baseline.json: the object whose values are all numbers (top level or one level down). */
function readBaseline(): Record<string, number> {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'infra/scripts/fitness/f1-baseline.json'), 'utf8')) as Record<string, unknown>;
  const isCounts = (o: unknown): o is Record<string, number> =>
    typeof o === 'object' && o !== null && !Array.isArray(o) && Object.values(o).every((v) => typeof v === 'number');
  if (isCounts(raw)) return raw;
  const inner = Object.values(raw).find(isCounts);
  expect(inner, 'f1-baseline.json holds one object of per-file counts').toBeDefined();
  return inner!;
}

beforeAll(async () => {
  requireScratchClone();
  runDir = requireRunDir();
  headSha = git(['rev-parse', 'HEAD']);
  clean = await npmCheck('e1-04-check-clean');
});

describe('LA-E1-04 fitness tools (K0)', () => {
  it('AC-LA-E1-04-01: the clean tree passes F1 inside npm run check; f1-baseline.json has one count per core file with a hit', async () => {
    expect(clean.code, 'npm run check on the clean tree (see e1-04-check-clean.log)').toBe(0);
    expect(scriptEchoes(clean.output).some((s) => /fitness:lms-names|lms-names/.test(s)), 'npm run check runs the F1 step').toBe(true);
    const counts = readBaseline();
    const entries = Object.entries(counts);
    artifact('e1-04-f1-baseline-summary.json', `${JSON.stringify({ files: entries.length, total: entries.reduce((s, [, n]) => s + n, 0) }, null, 2)}\n`);
    expect(entries.length, 'the baseline has entries').toBeGreaterThan(0);
    for (const [p, n] of entries) {
      expect(/^(services|packages|apps)\/[^/]+\/src\//.test(p) && !p.startsWith('packages/channels/'), `${p} is a core path`).toBe(true);
      expect(Number.isInteger(n) && n > 0, `${p}: count ${n} is a positive integer (one count per file with a hit)`).toBe(true);
    }
    // Spot check: the check-one-text count of three baseline files equals their baseline count, and passes.
    for (const [p, n] of entries.slice(0, 3)) {
      const r = await f1Text(p, git(['show', `HEAD:${p}`]));
      expect(f1Hits(r.output).filter((h) => h.path === p).length, `${p}: hits of the file text`).toBe(n);
      expect(r.code, `${p}: the unchanged file text passes`).toBe(0);
    }
  });

  it('AC-LA-E1-04-02: probes at core paths fail and name the token in the form path:line:col "<token>" banned "<word>"', async () => {
    const probes: Array<[string, string, string, RegExp]> = [
      [CORE_TS, 'export function createMoodleWsClient(): number {\n  return 1;\n}\n', 'moodle', /^createMoodleWsClient$/],
      [CORE_TS, 'export const lmsName = "canvas";\n', 'canvas', /canvas/i],
      [CORE_TS, 'export const url = (host: string): string => `https://${host}/blackboard/x`;\n', 'blackboard', /blackboard/i],
      [CORE_TSX, 'export const Probe = () => <p>Connect your Moodle site</p>;\n', 'moodle', /Moodle/],
      [CORE_TS, "import client from 'moodle-client';\nexport default client;\n", 'moodle', /moodle-client/],
      ['services/cogniate-app/src/domain/migrations/999_zz_qa_probe.sql', 'ALTER TABLE connection ADD COLUMN moodle_x TEXT;\n', 'moodle', /^moodle_x$/],
      [CORE_TS, 'export const re = /canvas/;\n', 'canvas', /canvas/i],
      [CORE_TS, 'export const reWord = /\\bcanvas\\b/i;\n', 'canvas', /canvas/i],
      [CORE_TS, 'export const rePrefix = /^(moodle|canvas)-/;\n', 'moodle', /moodle/i],
      [CORE_TS, 'export const rePrefix = /^(moodle|canvas)-/;\n', 'canvas', /canvas/i],
      [CORE_TS, 'export const reHost = /\\.instructure\\.com$/i;\n', 'instructure', /instructure/i],
    ];
    const log: string[] = [];
    for (const [asPath, text, word, token] of probes) {
      const r = await f1Text(asPath, text);
      log.push(`## ${asPath}\n${text}-> exit ${r.code}\n${r.output}`);
      expect(r.code, `${asPath}: ${text.trim()} fails`).not.toBe(0);
      expect(hitFor(r, asPath, word, token), `${asPath}: a hit line names ${token} banned "${word}"; output:\n${r.output}`).toBeDefined();
    }
    artifact('e1-04-ac02-probes.log', log.join('\n'));
  });

  it('AC-LA-E1-04-03: comment-only text, a <canvas> element, HTMLCanvasElement and "generic" pass', async () => {
    const probes: Array<[string, string]> = [
      [CORE_TS, '// Notes about Moodle, Canvas and Blackboard sites.\nexport const a = 1;\n'],
      [CORE_TSX, 'export const Board = () => <canvas width={10} height={10} />;\n'],
      [CORE_TS, 'export function width(e: HTMLCanvasElement): number {\n  return e.width;\n}\n'],
      [CORE_TS, "export const generic = 'generic';\n"],
    ];
    for (const [asPath, text] of probes) {
      const r = await f1Text(asPath, text);
      expect(r.code, `${asPath}: ${text.trim()} passes; output:\n${r.output}`).toBe(0);
      expect(f1Hits(r.output), `${asPath}: no hit`).toEqual([]);
    }
  });

  // BD-A1-07: the F1 fixed list holds the vendor words and the planned channel id `lti-generic` before its folder exists.
  it('AC-LA-E1-04-03 (lti-generic part): ltiGeneric and "lti-generic" fail', async () => {
    for (const text of ['export const ltiGeneric = 1;\n', 'export const id = "lti-generic";\n']) {
      const r = await f1Text(CORE_TS, text);
      expect(r.code, `${text.trim()} fails`).not.toBe(0);
      expect(f1Hits(r.output).some((h) => h.word === 'lti-generic'), `banned "lti-generic"; output:\n${r.output}`).toBe(true);
    }
  });

  it('AC-LA-E1-04-04: a new scratch folder packages/channels/zz-lms/ bans zzLms with no edit of the banned list', async () => {
    const probe = 'export const zzLms = 1;\n';
    const before = await f1Text(CORE_TS, probe);
    expect(before.code, 'control: zzLms passes before the folder exists').toBe(0);
    scratch({ 'packages/channels/zz-lms/manifest.ts': "export default { id: 'zz-lms', family: 'lti13', names: { text: 'ZZ LMS', label: 'ZZ LMS' } };\n" });
    try {
      expect(git(['status', '--porcelain', '--untracked-files=all']), 'only the scratch folder changed').toBe('?? packages/channels/zz-lms/manifest.ts');
      const after = await f1Text(CORE_TS, probe);
      expect(after.code, 'zzLms fails with the zz-lms folder').not.toBe(0);
      expect(hitFor(after, CORE_TS, 'zz-lms', /^zzLms$/), `hit zzLms banned "zz-lms"; output:\n${after.output}`).toBeDefined();
      const str = await f1Text(CORE_TS, 'export const id = "zz-lms";\n');
      expect(str.code, '"zz-lms" fails').not.toBe(0);
      // Multi-part rule: one part alone never matches (TEST-STRATEGY §3.2 "Matching").
      const part = await f1Text(CORE_TS, "export const lms = 'lms';\nexport const zz = 'zz';\n");
      expect(part.code, `"lms" or "zz" alone passes; output:\n${part.output}`).toBe(0);
    } finally {
      removeScratchDir('packages/channels/zz-lms');
    }
  });

  it('AC-LA-E1-04-05: ratchet: a higher count exits 1 and prints the delta; a lower count passes and prints the delta', async () => {
    const entry = Object.entries(readBaseline()).find(([p]) => p.endsWith('.ts'));
    expect(entry, 'a .ts file in f1-baseline.json').toBeDefined();
    const [p, n] = entry!;
    const raised = await f1Text(p, `${git(['show', `HEAD:${p}`])}\nexport const zzQaRatchetMoodle = 1;\n`);
    expect(raised.code, `${p}: count ${n} + 1 exits 1`).toBe(1);
    expect(raised.output.split('\n').some((l) => l.includes(p) && /\+\s*1\b/.test(l)), `${p}: the delta +1 is printed; output:\n${raised.output}`).toBe(true);
    const lowered = await f1Text(p, 'export const zzQaLower = 1;\n');
    expect(lowered.code, `${p}: count 0 (< ${n}) passes`).toBe(0);
    expect(lowered.output.split('\n').some((l) => l.includes(p) && new RegExp(`-\\s*${n}\\b|\\b${n}\\s*(?:→|->|to)\\s*0\\b`).test(l)),
      `${p}: the delta -${n} is printed; output:\n${lowered.output}`).toBe(true);
    artifact('e1-04-ac05-ratchet.log', `## raised\n${raised.output}\n## lowered\n${lowered.output}`);
  });

  it('AC-LA-E1-04-06: a frozen wire name passes in legacy-wire.ts and fails at any other core path', async () => {
    const text = '// Frozen wire name: docs/architecture/contracts/cogniate-app-api.md §4.2 (capabilities).\n'
      + "export const LEGACY_FLAG = 'canvasConfiguration' as const;\n";
    const inWire = await f1Text(LEGACY_WIRE, text);
    expect(inWire.code, `legacy-wire.ts passes; output:\n${inWire.output}`).toBe(0);
    for (const other of [KERNEL_OTHER, CORE_TS]) {
      const r = await f1Text(other, text);
      expect(r.code, `${other} fails`).not.toBe(0);
      expect(hitFor(r, other, 'canvas', /canvasConfiguration/), `${other}: hit canvasConfiguration; output:\n${r.output}`).toBeDefined();
    }
  });

  it('AC-LA-E1-04-07: F2 --paths-from: a core path and another channel path exit 1; channel, sim, tests and docs paths exit 0; every path has its class', async () => {
    const dir = fs.mkdtempSync(path.join(runDir, 'f2-'));
    const lists: Array<[string, string[], number, string[]]> = [
      ['core', ['services/cogniate-app/src/app/connections.ts'], 1, ['core']],
      ['other-channel', ['packages/channels/moodle/manifest.ts'], 1, ['core']],
      ['allowed', ['packages/channels/canvas/manifest.ts', 'tests/sim/canvas/provider.mjs', 'tests/acceptance/M1/common/00-profiles.test.ts', 'docs/architecture/ltiaas/README.md'],
        0, ['channel:canvas', 'sim', 'tests', 'docs']],
    ];
    const log: string[] = [];
    try {
      for (const [name, paths, code, classes] of lists) {
        const file = path.join(dir, `${name}.txt`);
        fs.writeFileSync(file, `${paths.join('\n')}\n`, { mode: 0o600 });
        const r = await channelDiff(['--channel', 'canvas', '--paths-from', file]);
        log.push(`## ${name}\n${r.output}`);
        expect(r.code, `${name}: exit code; output:\n${r.output}`).toBe(code);
        paths.forEach((p, i) => {
          const line = r.output.split('\n').find((l) => l.includes(p));
          expect(line, `${name}: the report lists ${p}`).toBeDefined();
          expect(line!.split(/\s+/), `${name}: ${p} has class ${classes[i]}: ${line}`).toContain(classes[i]);
        });
      }
    } finally {
      artifact('e1-04-ac07-f2.log', log.join('\n'));
    }
  });

  it('AC-LA-E1-04-08: F2 on a scratch branch that renames a core file classes the change as core (--no-renames)', async () => {
    const from = 'services/cogniate-app/src/app/connections.ts';
    const to = 'packages/channels/canvas/zz-qa-moved.ts';
    git(['switch', '--quiet', '-c', 'zz-qa-f2-rename']);
    try {
      git(['mv', from, to]);
      git(['-c', 'user.name=qa3', '-c', 'user.email=qa3@invalid', 'commit', '--quiet', '--no-verify', '-m', 'QA-3 scratch rename probe']);
      const r = await channelDiff(['--base', headSha, '--channel', 'canvas']);
      artifact('e1-04-ac08-rename.log', r.output);
      expect(r.code, `rename of a core file exits 1; output:\n${r.output}`).toBe(1);
      const line = r.output.split('\n').find((l) => l.includes(from));
      expect(line, `the report lists the old core path ${from}`).toBeDefined();
      expect(line!.split(/\s+/), `${from} is classed core: ${line}`).toContain('core');
    } finally {
      git(['switch', '--quiet', '--detach', headSha]);
      git(['branch', '--quiet', '-D', 'zz-qa-f2-rename']);
    }
    expect(git(['status', '--porcelain']), 'the clone is clean after the scratch branch').toBe('');
  });

  it('AC-LA-E1-04-09: F5: a new migration with a listed SQL statement fails and names it; the same text at an applied migration passes', async () => {
    const applied = git(['ls-files', 'services/cogniate-app/src/domain/migrations/*.sql']).split('\n').filter(Boolean).sort()[0];
    expect(applied, 'an applied app migration').toBeTruthy();
    const fresh = path.posix.join(path.posix.dirname(applied), '999_zz_qa_probe.sql');
    const r = await f5Text(fresh, `${SQL_PROBE}\n`);
    expect(r.code, `${fresh}: ${SQL_PROBE} fails; output:\n${r.output}`).not.toBe(0);
    expect(r.output.toUpperCase(), `the output names ${SQL_PROBE_NAME}`).toContain(SQL_PROBE_NAME.toUpperCase());
    const old = await f5Text(applied, `${SQL_PROBE}\n`);
    expect(old.code, `${applied} (applied, history) passes; output:\n${old.output}`).toBe(0);
    artifact('e1-04-ac09-f5.log', `## new ${fresh}\n${r.output}\n## applied ${applied}\n${old.output}`);
  });

  it('AC-LA-E1-04-10: F5: a probe rule file in rules/ runs in npm run check with no runner edit, and its hit fails the check', async () => {
    const rule = 'infra/scripts/fitness/rules/zz-qa-probe.mjs';
    const cleanup = scratch({ [rule]: fs.readFileSync(path.join(here, 'zz-qa-probe-rule.mjs'), 'utf8') });
    try {
      expect(git(['status', '--porcelain', '--untracked-files=all']), 'only the probe rule file is new').toBe(`?? ${rule}`);
      const r = await npmCheck('e1-04-check-probe-rule');
      expect(r.code, 'npm run check fails on the probe hit').not.toBe(0);
      expect(r.output, 'the output names the probe rule').toContain('zz-qa-probe');
    } finally {
      cleanup();
    }
    expect(git(['status', '--porcelain']), 'the clone is clean after the probe').toBe('');
    // The runner itself is unchanged: no tracked file under infra/scripts/fitness/ differs from HEAD.
    expect((await run('git', ['diff', '--name-only', 'HEAD', '--', 'infra/scripts/fitness'])).stdout.trim()).toBe('');
  });
});
