import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import ts from 'typescript';
import { APPLIED_MIGRATIONS, ROOT, TEXT_EXTENSIONS, inClass, isMain, isUnitFile, maskComments, position, repoPath, runCli, sourceFiles } from './common.mjs';

// BD-A1-07 reserves the planned generic channel before its folder lands.
const VENDORS = ['moodle', 'canvas', 'instructure', 'blackboard', 'brightspace', 'd2l', 'desire2learn', 'schoology', 'sakai', 'totara', 'lti-generic'];
const WEB_API = new Set(['HTMLCanvasElement', 'CanvasRenderingContext2D', 'OffscreenCanvas', 'OffscreenCanvasRenderingContext2D', 'CanvasGradient', 'CanvasPattern', 'CanvasCaptureMediaStreamTrack', 'CanvasImageSource', 'CanvasImageData']);

// BD-A1-09: use the same consecutive-part rule for every checked token.
export function parts(value) {
  return value.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2').replace(/(\d)([a-zA-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function manifestNames(text, path) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = [];
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(source).replace(/['"]/g, '') === 'names' && ts.isObjectLiteralExpression(node.initializer)) {
      for (const item of node.initializer.properties) {
        if (ts.isPropertyAssignment(item) && ['text', 'label'].includes(item.name.getText(source).replace(/['"]/g, '')) && ts.isStringLiteralLike(item.initializer)) names.push(item.initializer.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (names.length !== 2) throw new Error(`${path}: expected literal names.text and names.label`);
  return names;
}

// Read data as syntax. A lint must not execute a channel's manifest or imports.
export function bannedWords(root = ROOT) {
  const words = new Set(VENDORS);
  const folder = resolve(root, 'packages/channels');
  for (const entry of readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    words.add(entry.name.toLowerCase());
    const path = `packages/channels/${entry.name}/manifest.ts`;
    if (entry.name !== 'lti-generic' && existsSync(resolve(root, path))) {
      for (const name of manifestNames(readFileSync(resolve(root, path), 'utf8'), path)) words.add(name.toLowerCase());
    }
  }
  return [...words].sort();
}

export function isF1Path(path) {
  return inClass(path, 'core') && !inClass(path, 'channel') && !isUnitFile(path) && TEXT_EXTENSIONS.has(extname(path)) && !APPLIED_MIGRATIONS.has(path);
}

function tokenHits(token, words) {
  const tokens = parts(token);
  return words.filter((word) => {
    const target = parts(word);
    return target.length && tokens.some((_, index) => target.every((part, j) => tokens[index + j] === part));
  });
}

export function checkText({ path, text }, words = bannedWords()) {
  if (!isF1Path(path) || path === 'packages/channel-kernel/src/legacy-wire.ts') return [];
  const hits = [];
  const add = (token, offset, identifier = false) => {
    if (identifier && WEB_API.has(token)) return;
    // This exception covers only the dev-stack URL, not other LMS tokens in config.ts.
    if (path === 'packages/shared/src/config.ts' && ['moodle', 'PUBLIC_MOODLE_URL'].includes(token)) return;
    for (const word of tokenHits(token, words)) hits.push({ ...position(text, offset), token, word });
  };
  if (/\.(?:[jt]sx?|mts|mjs|json)$/.test(path)) {
    const kind = path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = path.endsWith('.json') ? ts.parseJsonText(path, text) : ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
    function visit(node) {
      if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
        const parent = node.parent;
        const htmlCanvas = node.text === 'canvas' && (ts.isJsxOpeningElement(parent) || ts.isJsxClosingElement(parent) || ts.isJsxSelfClosingElement(parent)) && parent.tagName === node;
        if (!htmlCanvas) add(node.text, node.getStart(source), true);
      } else if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
        add(node.text, node.getStart(source));
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  } else {
    const kind = extname(path).slice(1);
    const clean = maskComments(text, kind);
    const lex = (value, offset) => {
      // Keep a quoted SQL identifier or a string value as one token.
      const pattern = /'(?:''|\\[\s\S]|[^'\\])*'|"(?:""|\\[\s\S]|[^"\\])*"|`(?:``|[^`])*`|[A-Za-z0-9_$-]+/g;
      for (const match of value.matchAll(pattern)) add(match[0], offset + match.index, kind === 'sql');
    };
    if (kind === 'html') {
      for (const match of clean.matchAll(/<(?:"[^"]*"|'[^']*'|[^'">])*>|[^<]+/g)) {
        if (match[0].startsWith('<')) {
          const tag = match[0].replace(/^(<\/?)(canvas)(?=[\s/>])/i, (_, prefix, name) => prefix + ' '.repeat(name.length));
          lex(tag, match.index);
        } else add(match[0], match.index);
      }
    } else {
      lex(clean, 0);
    }
  }
  return hits;
}

export function compareCounts(counts, baseline) {
  return [...new Set([...Object.keys(counts), ...Object.keys(baseline)])].sort().map((path) => {
    const count = counts[path] ?? 0;
    const allowed = baseline[path] ?? 0;
    if (!Number.isSafeInteger(allowed) || allowed < 0) throw new Error(`${path}: invalid F1 baseline count`);
    return { path, count, allowed, delta: count - allowed };
  });
}

export function main() {
  const { values } = parseArgs({ options: { stdin: { type: 'boolean' }, as: { type: 'string' } } });
  if (Boolean(values.stdin) !== Boolean(values.as)) throw new Error('Use --stdin with --as <repo path>.');
  const words = bannedWords();
  const baseline = JSON.parse(readFileSync(new URL('./f1-baseline.json', import.meta.url), 'utf8'));
  const files = values.stdin ? [{ path: repoPath(values.as), text: readFileSync(0, 'utf8') }]
    : sourceFiles().filter(isF1Path).map((path) => ({ path, text: readFileSync(resolve(ROOT, path), 'utf8') }));
  const counts = {};
  for (const file of files) {
    const hits = checkText(file, words);
    counts[file.path] = hits.length;
    for (const hit of hits) console.log(`${file.path}:${hit.line}:${hit.col}  ${JSON.stringify(hit.token)}  banned ${JSON.stringify(hit.word)}`);
  }
  const limits = values.stdin ? { [files[0].path]: baseline[files[0].path] ?? 0 } : baseline;
  const deltas = compareCounts(counts, limits);
  for (const item of deltas.filter((item) => item.count || item.allowed)) {
    console.log(`${item.path}: count ${item.count}, baseline ${item.allowed}, delta ${item.delta >= 0 ? '+' : ''}${item.delta}`);
  }
  const failed = deltas.some((item) => item.delta > 0);
  console.log(`F1 ${failed ? 'FAIL' : 'PASS'}: ${deltas.filter((item) => item.count > 0).length} files with hits, ${Object.values(counts).reduce((sum, count) => sum + count, 0)} hits`);
  process.exitCode = failed ? 1 : 0;
}

if (isMain(import.meta.url)) runCli(main);
