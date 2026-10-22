import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { formatReport } from './lms-names.mjs';

const unchanged = 'apps/example/src/earlier.ts';
const raised = 'services/example/src/raised.ts';
const removed = 'apps/example/src/removed.ts';
const hit = (token, line) => ({ token, line, col: 7, word: 'moodle' });
const files = [
  { path: unchanged, hits: [hit('moodleExisting', 1)] },
  { path: raised, hits: [hit('moodleBefore', 2), hit('moodleAdded', 8)] },
];
const baseline = { [unchanged]: 1, [raised]: 1, [removed]: 2 };
const cli = fileURLToPath(new URL('./lms-names.mjs', import.meta.url));

function probe(path, text, args = []) {
  const result = spawnSync(process.execPath, [cli, '--stdin', '--as', path, ...args], { input: text, encoding: 'utf8', timeout: 10_000 });
  assert.ifError(result.error);
  return result;
}

describe('F1 diagnostics', () => {
  it('puts raised files, hit locations and the fix action before lower counts', () => {
    const { lines, failed } = formatReport(files, baseline);
    assert.equal(failed, true);
    assert.equal(lines[0], `RAISED ${raised}: count 2, baseline 1, delta +1`);
    assert.equal(lines[1], `${raised}:2:7  "moodleBefore"  banned "moodle"`);
    assert.equal(lines[2], `${raised}:8:7  "moodleAdded"  banned "moodle"`);
    assert.match(lines[3], /^Action: remove.*packages\/channels\/<id>\/.*RQ-3.*never raise/);
    assert.equal(lines[4], `LOWER ${removed}: count 0, baseline 2, delta -2`);
    assert.equal(lines[5], `Action: lower f1-baseline.json for ${removed} to 0 in this commit.`);
    assert.ok(!lines.some((line) => line.includes(unchanged)));
    assert.ok(lines.includes('Use --all to list all current hits and counts.'));
    assert.equal(lines.at(-1), 'F1 FAIL: 2 files with hits, 3 hits');
  });
  it('keeps the full listing behind --all, after the actionable changes', () => {
    const { lines, failed } = formatReport(files, baseline, { all: true });
    const separator = lines.indexOf('--- All F1 hits and counts ---');
    assert.equal(failed, true);
    assert.ok(separator > lines.findIndex((line) => line.startsWith('Action: lower')));
    assert.ok(lines.findIndex((line) => line.includes(unchanged)) > separator);
    for (const path of [unchanged, raised, removed]) {
      assert.ok(lines.slice(separator + 1).some((line) => line.startsWith(`${path}: count `)));
    }
    assert.equal(lines.at(-1), 'F1 FAIL: 2 files with hits, 3 hits');
  });
  it('keeps every stdin hit when the probe is at or below its baseline', () => {
    for (const allowed of [1, 2]) {
      const { lines, failed } = formatReport([files[0]], { [unchanged]: allowed }, { stdin: true });
      assert.equal(failed, false);
      assert.ok(lines.includes(`${unchanged}:1:7  "moodleExisting"  banned "moodle"`));
      assert.equal(lines.some((line) => line.startsWith('Action: lower')), allowed > 1);
      assert.equal(lines.at(-1), 'F1 PASS: 1 files with hits, 1 hits');
    }
  });
  it('keeps the normal success summary and omits unchanged hit listings', () => {
    const { lines, failed } = formatReport([files[0]], { [unchanged]: 1 });
    assert.equal(failed, false);
    assert.deepEqual(lines, ['Use --all to list all current hits and counts.', 'F1 PASS: 1 files with hits, 1 hits']);
  });
  it('accepts --all and preserves CLI hit format, action and failure exit code', () => {
    const result = probe(raised, 'const moodleAdded = 1;', ['--all']);
    assert.equal(result.status, 1, result.stderr);
    assert.ok(result.stdout.startsWith(`RAISED ${raised}: count 1, baseline 0, delta +1\n`));
    assert.ok(result.stdout.includes(`${raised}:1:7  "moodleAdded"  banned "moodle"`));
    assert.ok(result.stdout.includes('Action: remove'));
    assert.ok(result.stdout.includes('F1 FAIL: 1 files with hits, 1 hits'));
  });
});
