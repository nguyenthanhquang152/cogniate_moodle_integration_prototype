import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { ROOT, inClass, repoPath, runCli } from './common.mjs';

export function classifyPath(path, channel) {
  path = repoPath(path);
  if (inClass(path, 'channel')) return path.startsWith(`packages/channels/${channel}/`) ? `channel:${channel}` : 'core';
  if (path.startsWith('tests/sim/')) return 'sim';
  if (path.startsWith('tests/')) return 'tests';
  if (path.startsWith('docs/')) return 'docs';
  // BD-A1-07: every tracked infra path is core. Generated outputs are git-ignored.
  return 'core';
}

// Accept one path per line or git --name-status output. Preserve spaces in file names.
export function readPaths(text) {
  return text.split(/\r?\n/).filter((line) => line.length).flatMap((line) => {
    const fields = line.split('\t');
    if (fields.length > 1 && /^[ACDMRTUXB][0-9]*$/.test(fields[0])) return fields.slice(1);
    return [line];
  });
}

export function diffPaths(base, root = ROOT) {
  // Argument arrays and --end-of-options keep a supplied base out of the shell and git options.
  const sha = execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`], { cwd: root, encoding: 'utf8' }).trim();
  const mergeBase = execFileSync('git', ['merge-base', sha, 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const rows = execFileSync('git', ['diff', '--name-status', '--no-renames', '-z', mergeBase, 'HEAD', '--'], { cwd: root, encoding: 'utf8' }).split('\0');
  const paths = [];
  for (let i = 0; i < rows.length - 1; i += 2) paths.push(rows[i + 1]);
  return paths;
}

export function main() {
  const { values } = parseArgs({ options: { base: { type: 'string' }, channel: { type: 'string' }, 'paths-from': { type: 'string' }, 'report-only': { type: 'boolean' } } });
  if (!values.channel || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(values.channel)) throw new Error('Use --channel <channel id>.');
  if (Boolean(values.base) === Boolean(values['paths-from'])) throw new Error('Use exactly one of --base <sha> or --paths-from <file>.');
  const paths = values['paths-from'] ? readPaths(readFileSync(values['paths-from'], 'utf8')) : diffPaths(values.base);
  const counts = {};
  for (const path of paths) {
    const category = classifyPath(path, values.channel);
    counts[category] = (counts[category] ?? 0) + 1;
    console.log(`${category}\t${path}`);
  }
  const failed = (counts.core ?? 0) > 0;
  console.log(`F2 ${failed ? 'FAIL' : 'PASS'}: core = ${counts.core ?? 0}, paths = ${paths.length}${values['report-only'] ? ' (report only)' : ''}`);
  process.exitCode = failed && !values['report-only'] ? 1 : 0;
}

if (import.meta.main) runCli(main);
