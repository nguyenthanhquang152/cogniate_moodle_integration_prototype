// LA-E1-03 K0 acceptance tests: the channel build model and the import fence F3.
// Source: docs/architecture/ltiaas/tasks/LA-E1-03.md (AC-LA-E1-03-01 to -05); LA-ADR-01 D1 (build model, import
// table); TEST-STRATEGY §3.4, §3.5 item 3. QA-3 wrote these tests from the spec and the design only (test-first).
// Runs inside a prepared clone (README.md). Scratch files: packages/channels/zz-probe/ only (QA form (k)).
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ROOT, artifact, git, npmCheck, removeScratchDir, requireRunDir, requireScratchClone, run, scratch, scriptEchoes, type RunResult,
} from '../LA-E1-04/fitness';

const PROBE_DIR = 'packages/channels/zz-probe';
let clean: RunResult;

interface EslintMessage { ruleId: string | null; severity: number; message: string; line: number }
interface EslintResult { filePath: string; messages: EslintMessage[]; errorCount: number }

/** ESLint on one text as if it were the file at `asPath` (TEST-STRATEGY §3.5 item 3). */
async function eslintText(asPath: string, text: string): Promise<EslintResult[]> {
  const r = await run('npx', ['--no-install', 'eslint', '--stdin', '--stdin-filename', asPath, '--format', 'json'], { input: text });
  expect(r.stdout.trim().startsWith('['), `eslint JSON for ${asPath}; output:\n${r.output}`).toBe(true);
  return JSON.parse(r.stdout) as EslintResult[];
}

const IMPORT_RULE = /no-restricted-imports|no-restricted-paths|import\/no-restricted/;
function importErrors(results: EslintResult[]): EslintMessage[] {
  return results.flatMap((r) => r.messages).filter((m) => m.severity === 2 && m.ruleId !== null && IMPORT_RULE.test(m.ruleId));
}

/** The last npm step echo (`> name` or `> command`) before the check stopped. */
function lastStep(output: string): string {
  const steps = scriptEchoes(output);
  return steps[steps.length - 1] ?? '';
}

beforeAll(async () => {
  requireScratchClone();
  requireRunDir();
  clean = await npmCheck('e1-03-check-clean');
});

describe('LA-E1-03 build model and F3 (K0)', () => {
  it('AC-LA-E1-03-04: the clean tree passes F3 inside npm run check with 0 errors', () => {
    expect(clean.code, 'npm run check on the clean tree (see e1-03-check-clean.log)').toBe(0);
    expect(scriptEchoes(clean.output), 'the lint step (ESLint, F3) ran inside npm run check').toContain('lint');
  });

  it('AC-LA-E1-03-01: a type error in packages/channels/zz-probe/manifest.ts makes npm run check fail at the typecheck step', async () => {
    scratch({ [`${PROBE_DIR}/manifest.ts`]: "export const qaProbe: number = 'not a number';\nexport default { id: 'zz-probe' };\n" });
    try {
      const r = await npmCheck('e1-03-check-type-error');
      expect(r.code, 'npm run check fails').not.toBe(0);
      expect(r.output, 'the TypeScript error names the probe file').toMatch(/zz-probe\/manifest\.ts.*error TS\d+|error TS\d+.*zz-probe\/manifest\.ts/s);
      expect(/typecheck|tsc/.test(lastStep(r.output)), `the check stopped at the typecheck step (last step: ${lastStep(r.output)})`).toBe(true);
      expect(scriptEchoes(r.output), 'the unit-test step did not start').not.toContain('test:unit');
    } finally {
      removeScratchDir(PROBE_DIR);
    }
  });

  it('AC-LA-E1-03-02: a failing test packages/channels/zz-probe/probe.test.ts makes npm run check fail at the unit-test step', async () => {
    const title = 'zz-probe QA-3 failing probe';
    scratch({ [`${PROBE_DIR}/probe.test.ts`]: `import { expect, it } from 'vitest';\n\nit('${title}', () => {\n  expect(1).toBe(2);\n});\n` });
    try {
      const r = await npmCheck('e1-03-check-failing-test');
      expect(r.code, 'npm run check fails').not.toBe(0);
      const steps = scriptEchoes(r.output);
      expect(steps, 'the unit-test step ran').toContain('test:unit');
      expect(steps, 'the check stopped before the infra tests').not.toContain('test:infra');
      expect(r.output, 'the probe test ran and failed').toContain(title);
      expect(r.output).toMatch(/zz-probe\/probe\.test\.ts/);
    } finally {
      removeScratchDir(PROBE_DIR);
    }
  });

  it('AC-LA-E1-03-03: F3 probes with eslint --stdin give an import error for each rule of the D1 table', async () => {
    const probes: Array<[string, string, string]> = [
      ['(1) core imports a channel folder', 'services/cogniate-app/src/zz-qa-probe.ts',
        "import manifest from '../../../packages/channels/canvas/manifest';\nexport default manifest;\n"],
      ['(2) channel imports another channel folder', 'packages/channels/canvas/app/zz-qa-probe.ts',
        "import manifest from '../../moodle/manifest';\nexport default manifest;\n"],
      ['(3) manifest.ts imports more than kernel types', 'packages/channels/canvas/manifest.ts',
        "import { loadConfig } from '@cogniate/shared';\nexport default { id: 'canvas', loadConfig };\n"],
      ['(4a) app.ts imports services/**/domain/**', 'packages/channels/canvas/app.ts',
        "import * as connections from '../../../services/cogniate-app/src/domain/connections';\nexport default connections;\n"],
      ['(4b) a file in app/ imports services/**/domain/**', 'packages/channels/moodle/app/zz-qa-probe.ts',
        "import * as attempts from '../../../../services/cogniate-app/src/domain/attempts';\nexport default attempts;\n"],
      ['(5) portal/ imports portal code outside apps/portal/src/sdk/', 'packages/channels/canvas/portal/index.tsx',
        "import { Integrations } from '../../../../apps/portal/src/Integrations';\nexport default Integrations;\n"],
    ];
    const log: string[] = [];
    for (const [name, asPath, text] of probes) {
      const results = await eslintText(asPath, text);
      log.push(`## ${name} ${asPath}\n${JSON.stringify(results.flatMap((r) => r.messages), null, 2)}`);
      expect(importErrors(results).length, `${name}: an import-rule error at ${asPath}; messages: ${JSON.stringify(results.flatMap((r) => r.messages))}`).toBeGreaterThan(0);
    }
    // Control: manifest.ts may import kernel types; that text gives no import-rule error.
    const control = await eslintText('packages/channels/canvas/manifest.ts',
      "import type { ChannelManifest } from '@cogniate/channel-kernel';\nexport default { id: 'canvas' } as unknown as ChannelManifest;\n");
    log.push(`## control\n${JSON.stringify(control.flatMap((r) => r.messages), null, 2)}`);
    expect(importErrors(control), 'control: a kernel type import in manifest.ts is allowed').toEqual([]);
    artifact('e1-03-ac03-eslint.log', log.join('\n'));
  });

  it('AC-LA-E1-03-05: a scratch channel folder is typechecked, linted and tested with no edit of a root build file', async () => {
    const files = {
      [`${PROBE_DIR}/manifest.ts`]: "export default { id: 'zz-probe' };\n",
      [`${PROBE_DIR}/lti-profiles.ts`]: 'export default [];\n',
      [`${PROBE_DIR}/probe.test.ts`]: "import { expect, it } from 'vitest';\n\nit('zz-probe QA-3 passing probe', () => {\n  expect(1).toBe(1);\n});\n",
    };
    scratch(files);
    try {
      const changed = git(['status', '--porcelain', '--untracked-files=all']).split('\n').map((l) => l.slice(3)).sort();
      expect(changed, 'the probe diff touches only packages/channels/zz-probe/**').toEqual(Object.keys(files).sort());
      // Tested: the root Vitest finds the probe test by its glob.
      const unit = await run('npx', ['--no-install', 'vitest', 'run', PROBE_DIR]);
      artifact('e1-03-ac05-vitest.log', unit.output);
      expect(unit.code, `the root Vitest runs the probe test; output:\n${unit.output}`).toBe(0);
      expect(unit.output).toMatch(/zz-probe QA-3 passing probe|1 passed/);
      // Linted: ESLint lints all three files (none is ignored).
      const lint = await run('npx', ['--no-install', 'eslint', PROBE_DIR, '--format', 'json']);
      const linted = (JSON.parse(lint.stdout) as EslintResult[]);
      for (const rel of Object.keys(files)) {
        const result = linted.find((r) => r.filePath.endsWith(rel));
        expect(result, `ESLint lints ${rel}`).toBeDefined();
        expect(result!.messages.some((m) => /ignored/i.test(m.message)), `${rel} is not ignored`).toBe(false);
      }
      // Typechecked: a type error in lti-profiles.ts fails the root typecheck and names the file.
      fs.writeFileSync(path.join(ROOT, PROBE_DIR, 'lti-profiles.ts'), "export const qaProbe: number = 'not a number';\nexport default [];\n");
      const types = await run('npm', ['run', 'typecheck']);
      artifact('e1-03-ac05-typecheck.log', types.output);
      expect(types.code, 'npm run typecheck fails on the probe type error').not.toBe(0);
      expect(types.output).toMatch(/zz-probe\/lti-profiles\.ts/);
    } finally {
      removeScratchDir(PROBE_DIR);
    }
  });
});
