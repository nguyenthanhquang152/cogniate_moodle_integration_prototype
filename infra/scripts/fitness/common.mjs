import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, matchesGlob, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.js', '.mjs', '.sql', '.json', '.css', '.html']);
export const SCOPE = JSON.parse(readFileSync(new URL('../../../packages/channel-kernel/fitness-scope.json', import.meta.url), 'utf8'));
export const APPLIED_MIGRATIONS = new Set(JSON.parse(readFileSync(new URL('./applied-migrations.json', import.meta.url), 'utf8')).paths);

export function repoPath(path) {
  if (isAbsolute(path) || path.includes('\\') || path.includes('\0')) throw new Error('Use a relative repository path with forward slashes.');
  const normalized = relative(ROOT, resolve(ROOT, path));
  if (!normalized || normalized === '..' || normalized.startsWith('../')) throw new Error('Path must stay inside the repository.');
  return normalized;
}

export function inClass(path, name) {
  return SCOPE.classes[name].globs.some((glob) => matchesGlob(path, glob));
}

export function isUnitFile(path) {
  return /(?:^|\/)(?:[^/]+\.test\.[cm]?[jt]sx?|(?:[^/]+\.)?testkit\.ts)$/.test(path);
}

export function isMigration(path) {
  return inClass(path, 'coreExceptions') && path.endsWith('.sql');
}

// Include untracked probes, but respect gitignore and never follow a symlink out of the tree.
export function trackedFiles(root = ROOT, paths = []) {
  return [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', ...paths], { cwd: root, encoding: 'utf8' }).split('\0'))]
    .filter(Boolean)
    .filter((path) => {
      return lstatSync(resolve(root, path), { throwIfNoEntry: false })?.isFile();
    }).sort();
}

export function sourceFiles(root = ROOT) {
  return trackedFiles(root).filter((path) => TEXT_EXTENSIONS.has(extname(path)));
}

export function position(text, offset) {
  const before = text.slice(0, offset);
  return { line: before.split('\n').length, col: offset - before.lastIndexOf('\n') };
}

export function isMain(url) {
  return process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === url;
}

export function runCli(main) {
  Promise.resolve().then(main).catch((error) => {
    console.error(`fitness: ${error.message}`);
    process.exitCode = 2;
  });
}

// Keep offsets and quoted values intact while removing comments from non-TS input.
export function maskComments(text, kind, maskStrings = false) {
  let result = '';
  for (let i = 0; i < text.length;) {
    const tail = text.slice(i);
    const blockEnd = tail.startsWith('/*') ? '*/' : kind === 'html' && tail.startsWith('<!--') ? '-->' : null;
    const lineComment = (kind === 'sql' && tail.startsWith('--')) || (kind === 'json' && tail.startsWith('//'));
    if (blockEnd || lineComment) {
      const end = blockEnd ? text.indexOf(blockEnd, i + 2) : text.indexOf('\n', i);
      const stop = end < 0 ? text.length : end + (blockEnd ? blockEnd.length : 0);
      result += text.slice(i, stop).replace(/[^\r\n]/g, ' ');
      i = stop;
    } else if (['\'', '"', '`'].includes(text[i])) {
      const quote = text[i];
      const start = i++;
      while (i < text.length) {
        if (text[i] === '\\' && kind !== 'sql') { i += 2; continue; }
        if (text[i++] === quote) {
          if (kind === 'sql' && text[i] === quote) { i++; continue; }
          break;
        }
      }
      const value = text.slice(start, i);
      result += maskStrings ? value.replace(/[^\r\n]/g, ' ') : value;
    } else {
      result += text[i++];
    }
  }
  return result;
}
